const express = require('express');
const path = require('path');
const stream = require('stream');
const multer = require('multer');
const { Assignment, Submission } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');
const { uploadBuffer, deleteFile } = require('../cloudinary');

const router = express.Router();
const VALID_GRADES = [4, 5, 6, 7];

// ---- Storage setup ----
// Files are uploaded straight to Cloudinary (never touch Render's disk), so
// they survive redeploys/restarts. multer just holds the file in memory
// briefly while we stream it to Cloudinary.
const ALLOWED_EXTENSIONS = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];

function fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error('Only Word, Excel, or PowerPoint files are allowed.'));
    }
    cb(null, true);
}

const uploader = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB per file
}).single('file');

// ================= ADMIN: manage assignments =================

// Create a new assignment (title + grade + max marks + file)
router.post('/admin/assignments', requireAdmin, (req, res) => {
    uploader(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        try {
            const { title, grade, maxMarks } = req.body;
            if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required.' });
            if (!VALID_GRADES.includes(Number(grade))) return res.status(400).json({ error: 'Grade must be 4-7.' });
            if (!req.file) return res.status(400).json({ error: 'A file is required.' });

            const uploaded = await uploadBuffer(req.file.buffer, 'quiz-system/assignments');

            const assignment = new Assignment({
                title: title.trim(),
                grade: Number(grade),
                maxMarks: Number(maxMarks) > 0 ? Number(maxMarks) : 100,
                fileName: req.file.originalname,
                fileUrl: uploaded.secure_url,
                filePath: uploaded.public_id
            });
            await assignment.save();
            res.status(201).json(assignment);
        } catch (e) {
            console.error('Assignment upload error:', e);
            res.status(500).json({ error: 'Could not save assignment.' });
        }
    });
});

// List all assignments (admin), with submission counts
router.get('/admin/assignments', requireAdmin, async (req, res) => {
    const assignments = await Assignment.find().sort({ createdAt: -1 });
    const withCounts = await Promise.all(assignments.map(async (a) => {
        const submissionCount = await Submission.countDocuments({ assignment: a._id });
        const gradedCount = await Submission.countDocuments({ assignment: a._id, status: 'graded' });
        return { ...a.toObject(), submissionCount, gradedCount };
    }));
    res.json(withCounts);
});

// Delete an assignment and all of its submissions (+ their files)
router.delete('/admin/assignments/:id', requireAdmin, async (req, res) => {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });

    const subs = await Submission.find({ assignment: assignment._id });
    for (const s of subs) {
        await deleteFile(s.filePath);
    }
    await Submission.deleteMany({ assignment: assignment._id });
    await deleteFile(assignment.filePath);

    res.json({ message: 'Assignment and its submissions deleted.' });
});

// Download the original assignment file — public, students need this.
// Cloudinary already hosts the file directly, so we just send them there.
router.get('/assignments/:id/download', async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
    res.redirect(assignment.fileUrl);
});

// ================= PUBLIC: student-facing =================

// Assignments available for a grade — used by quiz.html to decide whether
// to show the assignment section at all.
router.get('/assignments', async (req, res) => {
    const grade = Number(req.query.grade);
    if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: 'A valid grade (4-7) is required.' });
    const assignments = await Assignment.find({ grade }).sort({ createdAt: -1 });
    res.json(assignments);
});

// Check whether a given roll number has already submitted a given assignment
router.get('/assignments/:id/status', async (req, res) => {
    const rollNum = req.query.rollNum;
    if (!rollNum) return res.json({ submitted: false });
    const existing = await Submission.findOne({ assignment: req.params.id, rollNum: String(rollNum).trim() });
    res.json({
        submitted: !!existing,
        status: existing ? existing.status : null,
        percentage: existing ? existing.percentage : null
    });
});

// Student submits their completed file — one-time only (unique index enforces it)
router.post('/assignments/:id/submit', (req, res) => {
    uploader(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        try {
            const assignment = await Assignment.findById(req.params.id);
            if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });

            const { name, rollNum, grade } = req.body;
            if (!name || !rollNum || !VALID_GRADES.includes(Number(grade))) {
                return res.status(400).json({ error: 'Name, roll number, and a valid grade are required.' });
            }
            if (!req.file) return res.status(400).json({ error: 'A file is required.' });

            const uploaded = await uploadBuffer(req.file.buffer, 'quiz-system/submissions');

            const submission = new Submission({
                assignment: assignment._id,
                name: String(name).trim(),
                rollNum: String(rollNum).trim(),
                grade: Number(grade),
                fileName: req.file.originalname,
                fileUrl: uploaded.secure_url,
                filePath: uploaded.public_id
            });
            await submission.save();
            res.status(201).json({ message: 'Assignment submitted successfully.' });
        } catch (e) {
            if (e.code === 11000) {
                return res.status(409).json({ error: 'You have already submitted this assignment.' });
            }
            console.error('Submission error:', e);
            res.status(500).json({ error: 'Could not submit assignment.' });
        }
    });
});

// ================= ADMIN: review + grade submissions =================

router.get('/admin/assignments/:id/submissions', requireAdmin, async (req, res) => {
    const submissions = await Submission.find({ assignment: req.params.id }).sort({ submittedAt: -1 });
    res.json(submissions);
});

router.get('/admin/submissions/:id/download', requireAdmin, async (req, res) => {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found.' });

    try {
        const fileResponse = await fetch(submission.fileUrl);
        if (!fileResponse.ok || !fileResponse.body) {
            return res.status(502).json({ error: 'Could not fetch file from storage.' });
        }
        res.setHeader('Content-Disposition', `attachment; filename="${submission.fileName}"`);
        res.setHeader('Content-Type', fileResponse.headers.get('content-type') || 'application/octet-stream');
        stream.Readable.fromWeb(fileResponse.body).pipe(res);
    } catch (e) {
        console.error('Download error:', e);
        res.status(500).json({ error: 'Could not download file.' });
    }
});

// Teacher enters marks (out of the assignment's maxMarks) — percentage is derived automatically
router.post('/admin/submissions/:id/marks', requireAdmin, async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found.' });

        const assignment = await Assignment.findById(submission.assignment);
        const marks = Number(req.body.marks);
        if (isNaN(marks) || marks < 0 || marks > assignment.maxMarks) {
            return res.status(400).json({ error: `Marks must be between 0 and ${assignment.maxMarks}.` });
        }

        submission.marks = marks;
        submission.percentage = Math.round((marks / assignment.maxMarks) * 100);
        submission.status = 'graded';
        submission.gradedAt = new Date();
        await submission.save();

        res.json(submission);
    } catch (e) {
        console.error('Grading error:', e);
        res.status(500).json({ error: 'Could not save marks.' });
    }
});

module.exports = router;
