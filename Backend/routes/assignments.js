const express = require('express');
const path = require('path');
const stream = require('stream');
const multer = require('multer');
const { Assignment, Submission } = require('../models/models');
const { requireAdmin, requireStudent } = require('../middleware/auth');
const { uploadBuffer, deleteFile } = require('../cloudinary');
const { sectionName, studentRecords } = require('../sections');

const router = express.Router();
const { VALID_GRADES, validGrade } = require('../grades');

// ---- Storage setup ----
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
            if (!validGrade(grade)) return res.status(400).json({ error: 'Choose Grade 4, 5, 6, 7 or Hifz.' });
            if (!req.file) return res.status(400).json({ error: 'A file is required.' });

            const uploaded = await uploadBuffer(req.file.buffer, 'quiz-system/assignments', req.file.originalname);

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
    const assignments = await Assignment.find({ deletedAt: null }).sort({ createdAt: -1 });
    const withCounts = await Promise.all(assignments.map(async (a) => {
        const submissionCount = await Submission.countDocuments({ assignment: a._id });
        const gradedCount = await Submission.countDocuments({ assignment: a._id, status: 'graded' });
        return { ...a.toObject(), submissionCount, gradedCount };
    }));
    res.json(withCounts);
});

// Delete files and close the assignment, retaining graded records for reports.
router.delete('/admin/assignments/:id', requireAdmin, async (req, res) => {
    const assignment = await Assignment.findOneAndUpdate({ _id: req.params.id, deletedAt: null },
        { $set: { deletedAt: new Date() } }, { new: true }) || await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });

    // Seal submissions before cleanup so a concurrent grade cannot get deleted.
    await Submission.updateMany({ assignment: assignment._id }, { $set: { assignmentDeletedAt: assignment.deletedAt } });
    const subs = await Submission.find({ assignment: assignment._id });
    for (const s of subs) {
        await deleteFile(s.filePath);
    }
    await Submission.updateMany({ assignment: assignment._id }, { $unset: { fileUrl: 1, filePath: 1 } });
    await Submission.deleteMany({ assignment: assignment._id, status: 'pending', assignmentDeletedAt: { $ne: null } });
    await deleteFile(assignment.filePath);
    await Assignment.updateOne({ _id: assignment._id }, { $unset: { fileUrl: 1, filePath: 1 } });

    res.json({ message: 'Assignment files deleted. Graded marks remain in reports.' });
});

// Download the original assignment file (Student facing - fixed with proper filename and extension)
router.get('/assignments/:id/download', requireStudent, async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
        if (req.student && assignment.grade !== req.student.grade) return res.status(403).json({ error: 'This assignment belongs to another grade.' });
        if (assignment.deletedAt) return res.status(410).json({ error: 'This assignment is no longer available.' });

        const fileResponse = await fetch(assignment.fileUrl);
        if (!fileResponse.ok || !fileResponse.body) {
            return res.status(502).json({ error: 'Could not fetch file from storage.' });
        }
        res.setHeader('Content-Disposition', `attachment; filename="${assignment.fileName}"`);
        res.setHeader('Content-Type', fileResponse.headers.get('content-type') || 'application/octet-stream');
        stream.Readable.fromWeb(fileResponse.body).pipe(res);
    } catch (e) {
        console.error('Download error:', e);
        res.status(500).json({ error: 'Could not download file.' });
    }
});

// ================= PUBLIC: student-facing =================

// Assignments available for a grade
router.get('/assignments', requireStudent, async (req, res) => {
    const grade = req.student.grade;
    if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: 'A valid grade (4-7) is required.' });
    const assignments = await Assignment.find({ grade, deletedAt: null }).sort({ createdAt: -1 });
    res.json(assignments);
});

// Check whether a given roll number has already submitted a given assignment
router.get('/assignments/:id/status', requireStudent, async (req, res) => {
    const rollNum = req.student.rollNum;
    if (!rollNum) return res.json({ submitted: false });
    const existing = await Submission.findOne({ assignment: req.params.id, ...studentRecords(req.student) });
    res.json({
        submitted: !!existing,
        status: existing ? existing.status : null,
        percentage: existing ? existing.percentage : null
    });
});

// Student submits their completed file
router.post('/assignments/:id/submit', requireStudent, (req, res) => {
    uploader(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        try {
            const assignment = await Assignment.findById(req.params.id);
            if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
            if (req.student && assignment.grade !== req.student.grade) return res.status(403).json({ error: 'This assignment belongs to another grade.' });
            if (assignment.deletedAt) return res.status(410).json({ error: 'This assignment is no longer available.' });

            const { name, rollNum, grade } = req.student;
            if (!name || !rollNum || !validGrade(grade)) {
                return res.status(400).json({ error: 'Name, roll number, and a valid grade are required.' });
            }
            if (!req.file) return res.status(400).json({ error: 'A file is required.' });

            if (await Submission.exists({ assignment: assignment._id, ...studentRecords(req.student) })) return res.status(409).json({ error: 'You have already submitted this assignment.' });
            const uploaded = await uploadBuffer(req.file.buffer, 'quiz-system/submissions', req.file.originalname);
            if (!await Assignment.exists({ _id: assignment._id, deletedAt: null })) {
                await deleteFile(uploaded.public_id);
                return res.status(410).json({ error: 'This assignment was deleted during your upload.' });
            }

            const submission = new Submission({
                student: req.student._id,
                section: sectionName(req.student.section),
                assignment: assignment._id,
                name: String(name).trim(),
                rollNum: String(rollNum).trim(),
                grade: Number(grade),
                fileName: req.file.originalname,
                fileUrl: uploaded.secure_url,
                filePath: uploaded.public_id
            });
            try { await submission.save(); } catch (error) {
                await deleteFile(uploaded.public_id).catch(() => {});
                throw error;
            }
            if (!await Assignment.exists({ _id: assignment._id, deletedAt: null })) {
                await deleteFile(uploaded.public_id);
                await Submission.deleteOne({ _id: submission._id });
                return res.status(410).json({ error: 'This assignment was deleted during your upload.' });
            }
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
    if (submission.assignmentDeletedAt || !submission.fileUrl) return res.status(410).json({ error: 'This submission file has been deleted. Its marks are retained.' });

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

// Teacher enters marks
router.post('/admin/submissions/:id/marks', requireAdmin, async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found.' });

        const assignment = await Assignment.findById(submission.assignment);
        if (!assignment || assignment.deletedAt) return res.status(410).json({ error: 'This assignment is no longer available for grading.' });
        const marks = Number(req.body.marks);
        if (isNaN(marks) || marks < 0 || marks > assignment.maxMarks) {
            return res.status(400).json({ error: `Marks must be between 0 and ${assignment.maxMarks}.` });
        }

        const graded = await Submission.findOneAndUpdate({ _id: submission._id, assignmentDeletedAt: null }, { $set: {
            marks, percentage: Math.round((marks / assignment.maxMarks) * 100), status: 'graded', gradedAt: new Date()
        } }, { new: true });
        if (!graded) return res.status(410).json({ error: 'This assignment is no longer available for grading.' });
        res.json(graded);
    } catch (e) {
        console.error('Grading error:', e);
        res.status(500).json({ error: 'Could not save marks.' });
    }
});

module.exports = router;
