const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { isObjectIdOrHexString } = require('mongoose');
const { Student, Result, Assignment, Submission, Attempt } = require('../models/models');
const { requireAdmin, requireStudent } = require('../middleware/auth');
const { validGrade } = require('../grades');
const { pakistanDay } = require('../quiz-policy');
const { finalizeAttempt } = require('../services/attempts');
const { sectionName, sectionKey, studentRecords } = require('../sections');
const { linkLegacyRecords } = require('../services/sections');
const { resultMetrics } = require('../result-ranking');
const { deleteFile } = require('../cloudinary');
const router = express.Router();
const profile = s => ({ id: s._id, name: s.name, rollNum: s.rollNum, grade: s.grade, section: sectionName(s.section) });
router.use((req, res, next) => {
    try { if (req.body && 'section' in req.body) req.body.section = sectionName(req.body.section); next(); }
    catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/student/login', rateLimit({ windowMs: 15 * 60000, max: 60, skipSuccessfulRequests: true,
    message: { error: 'Too many login attempts. Please try again later.' } }), async (req, res) => {
    const { rollNum, grade, password } = req.body;
    if (typeof rollNum !== 'string' || !validGrade(grade) || typeof password !== 'string' || password.length > 72) {
        return res.status(400).json({ error: 'Roll number, grade and password are required.' });
    }
    const candidates = await Student.find({ rollNum: rollNum.trim(), grade: Number(grade) }).select('+passwordHash');
    const matches = [];
    for (const candidate of candidates) if (await bcrypt.compare(password, candidate.passwordHash)) matches.push(candidate);
    const student = matches.length === 1 ? matches[0] : null;
    if (!student) return res.status(401).json({ error: 'Incorrect roll number, grade or password.' });
    await linkLegacyRecords(student);
    const token = jwt.sign({ id: student._id, role: 'student', version: student.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, student: profile(student) });
});

router.get('/admin/students', requireAdmin, async (req, res) => {
    const filter = validGrade(req.query.grade) ? { grade: Number(req.query.grade) } : {};
    if (typeof req.query.section === 'string' && req.query.section.trim()) filter.sectionKey = sectionKey(req.query.section);
    const students = await Student.find(filter).sort({ grade: 1, rollNum: 1 });
    res.json(students.map(profile));
});

router.post('/admin/students', requireAdmin, async (req, res) => {
    const { name, rollNum, grade, password } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
        typeof rollNum !== 'string' || !rollNum.trim() || rollNum.trim().length > 40 ||
        !validGrade(grade) || typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password) > 72) {
        return res.status(400).json({ error: 'Enter name, roll number, grade and a password of 6–72 bytes.' });
    }
    try {
        const student = await Student.create({ name: name.trim(), rollNum: rollNum.trim(), grade: Number(grade), section: sectionName(req.body.section), passwordHash: await bcrypt.hash(password, 10) });
        await linkLegacyRecords(student);
        res.status(201).json(profile(student));
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'This roll number already has an account in this grade and section.' });
        throw error;
    }
});

router.post('/admin/students/:id/profile', requireAdmin, async (req, res) => {
    const { name, grade } = req.body;
    if (!isObjectIdOrHexString(req.params.id) || typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
        !validGrade(grade) || !Object.hasOwn(req.body, 'section')) {
        return res.status(400).json({ error: 'Enter a name of 1–100 characters, a valid grade and section (blank for Unassigned).' });
    }
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    const nextGrade = Number(grade), section = sectionName(req.body.section), key = sectionKey(section);
    if (await Student.exists({ _id: { $ne: student._id }, rollNum: student.rollNum, grade: nextGrade, sectionKey: key })) {
        return res.status(409).json({ error: 'This roll number already has an account in that grade and section. No changes were made.' });
    }
    const gradeChanged = nextGrade !== student.grade;
    if (gradeChanged && await Attempt.exists({ student: student._id, status: 'active', expiresAt: { $gt: new Date() } })) {
        return res.status(409).json({ error: 'This student is taking a quiz. Wait until it ends before changing the grade.' });
    }
    await linkLegacyRecords(student);
    if (gradeChanged) {
        // Seal unfinished quizzes with the original grade before updating the account.
        const unfinished = await Attempt.find({ student: student._id, $or: [
            { status: 'active', expiresAt: { $lte: new Date() } }, { status: 'submitted', purgeAt: { $exists: false } }
        ] });
        for (const attempt of unfinished) await finalizeAttempt(attempt, student);
    }
    student.name = name.trim(); student.grade = nextGrade; student.section = section;
    try { await student.save(); }
    catch (error) { if (error.code === 11000) return res.status(409).json({ error: 'This roll number already has an account in that grade and section.' }); throw error; }
    // Correct names everywhere; earned marks keep their original grade after a move.
    for (const model of [Result, Submission]) {
        await model.updateMany({ student: student._id }, { $set: { name: student.name } });
        if (!gradeChanged) await model.updateMany({ student: student._id, grade: student.grade }, { $set: { section, sectionKey: key } });
    }
    res.json(profile(student));
});

router.post('/admin/students/:id/section', requireAdmin, async (req, res) => {
    if (!Object.hasOwn(req.body, 'section')) return res.status(400).json({ error: 'Enter a section name, or leave it blank for Unassigned.' });
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    const section = sectionName(req.body.section);
    const key = sectionKey(section);
    if (await Student.exists({ _id: { $ne: student._id }, rollNum: student.rollNum, grade: student.grade, sectionKey: key })) {
        return res.status(409).json({ error: 'That section already has this roll number. No changes were made.' });
    }
    await linkLegacyRecords(student);
    student.section = section;
    try { await student.save(); }
    catch (error) { if (error.code === 11000) return res.status(409).json({ error: 'That section already has this roll number.' }); throw error; }
    const update = { section, sectionKey: key };
    await Result.updateMany({ student: student._id, grade: student.grade }, { $set: update });
    await Submission.updateMany({ student: student._id, grade: student.grade }, { $set: update });
    res.json(profile(student));
});

router.post('/admin/students/:id/password', requireAdmin, async (req, res) => {
    const { password } = req.body;
    if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password) > 72) return res.status(400).json({ error: 'Password must be 6–72 bytes.' });
    const student = await Student.findByIdAndUpdate(req.params.id,
        { $set: { passwordHash: await bcrypt.hash(password, 10) }, $inc: { tokenVersion: 1 } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    res.json({ message: 'Password reset. Previous sessions are now signed out.' });
});

router.delete('/admin/students/:id', requireAdmin, async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (await Attempt.exists({ student: student._id, status: 'active', expiresAt: { $gt: new Date() } })) {
        return res.status(409).json({ error: 'This student is currently taking a quiz. Wait until the quiz ends before deleting the account.' });
    }
    const submissions = await Submission.find({ student: student._id }).select('filePath');
    await Promise.all(submissions.map(submission => deleteFile(submission.filePath)));
    await Promise.all([
        Result.deleteMany({ student: student._id }),
        Submission.deleteMany({ student: student._id }),
        Attempt.deleteMany({ student: student._id }),
        Student.deleteOne({ _id: student._id })
    ]);
    res.json({ message: `${student.name}'s account and saved records were deleted.` });
});

router.get('/student/report', requireStudent, async (req, res) => {
    const student = req.student;
    // Recover expired/previously sealed attempts if a browser closed before submission.
    const unfinished = await Attempt.find({ student: student._id, $or: [{ expiresAt: { $lte: new Date() }, status: 'active' }, { status: 'submitted', purgeAt: { $exists: false } }] });
    for (const attempt of unfinished) {
        await finalizeAttempt(attempt, student);
    }
    const filter = studentRecords(student);
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const submissions = await Submission.find(filter).select('assignment marks percentage status submittedAt gradedAt');
    const [results, count, assignments, today] = await Promise.all([
        Result.find(filter).select('score total date elapsedMs timeLimitMs').sort({ date: -1 }).skip((page - 1) * 20).limit(20).lean(),
        Result.countDocuments(filter),
        Assignment.find({ $or: [{ grade: student.grade }, { _id: { $in: submissions.map(s => s.assignment) } }] })
            .select('title grade maxMarks fileName createdAt deletedAt').sort({ createdAt: -1 }),
        Attempt.findOne({ student: student._id, day: pakistanDay() }).select('status expiresAt')
    ]);
    const submissionMap = new Map(submissions.map(s => [String(s.assignment), s]));
    res.json({ student: profile(student), results: results.map(r => ({ ...r, ...resultMetrics(r) })), page, pages: Math.max(1, Math.ceil(count / 20)), totalResults: count,
        today, assignments: assignments.filter(a => !a.deletedAt || submissionMap.get(String(a._id))?.status === 'graded')
            .map(a => ({ ...a.toObject(), historical: a.grade !== student.grade, submission: submissionMap.get(String(a._id)) || null })) });
});
module.exports = router;
