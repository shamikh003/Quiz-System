const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { isObjectIdOrHexString } = require('mongoose');
const { Student, Result, Assignment, Submission, Attempt, Settings } = require('../models/models');
const { requireAdmin, requireStudent } = require('../middleware/auth');
const { validGrade } = require('../grades');
const { pakistanDay } = require('../quiz-policy');
const { finalizeAttempt } = require('../services/attempts');
const { sectionName, sectionKey, studentRecords } = require('../sections');
const { linkLegacyRecords } = require('../services/sections');
const { resultMetrics } = require('../result-ranking');
const { deleteFile } = require('../cloudinary');
const router = express.Router();
const profile = s => ({ id: s._id, name: s.name, fatherName: s.fatherName || '', rollNum: s.rollNum, grade: s.grade, section: sectionName(s.section) });
const validFatherName = value => value === undefined || (typeof value === 'string' && value.trim().length <= 100);
router.use((req, res, next) => {
    try { if (req.body && 'section' in req.body) req.body.section = sectionName(req.body.section); next(); }
    catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/student/lookup', rateLimit({ windowMs: 60000, max: 600,
    message: { error: 'Please wait a moment and try again.' } }), async (req, res) => {
    const rollNum = req.body?.rollNum;
    if (typeof rollNum !== 'string' || !rollNum.trim() || rollNum.trim().length > 40) return res.status(400).json({ error: 'Enter a valid roll number.' });
    const matches = await Student.find({ rollNum: rollNum.trim() }).select('name fatherName rollNum grade section +pinHash').limit(2).lean();
    res.set('Cache-Control', 'no-store');
    if (!matches.length) return res.json({ found: false });
    if (matches.length > 1) return res.json({ found: true, ambiguous: true });
    res.json({ found: true, needsPinSetup: !matches[0].pinHash, student: profile(matches[0]) });
});

const pinAttemptLimit = rateLimit({
    windowMs: 15 * 60000, max: 10, skipSuccessfulRequests: true,
    skip: req => typeof req.body?.rollNum !== 'string' || !req.body.rollNum.trim() || req.body.rollNum.length > 40,
    keyGenerator: req => req.body.rollNum.trim(),
    message: { error: 'Too many PIN attempts. Try again in 15 minutes.' }
});
router.post('/student/login', rateLimit({ windowMs: 15 * 60000, max: 60, skipSuccessfulRequests: true,
    message: { error: 'Too many login attempts. Please try again later.' } }), pinAttemptLimit, async (req, res) => {
    const { rollNum, pin, pinConfirmation } = req.body;
    if (typeof rollNum !== 'string' || !rollNum.trim() || rollNum.trim().length > 40) {
        return res.status(400).json({ error: 'Roll number is required.' });
    }
    const matches = await Student.find({ rollNum: rollNum.trim() }).select('+pinHash').limit(2);
    if (matches.length > 1) return res.status(409).json({ error: 'This roll number belongs to multiple accounts. Please contact your teacher.' });
    let student = matches[0];
    if (!student) return res.status(401).json({ error: 'Roll number not found.' });
    if (!student.pinHash && (typeof pin !== 'string' || !/^\d{4}$/.test(pin) || pinConfirmation !== pin)) {
        return res.status(400).json({ code: 'PIN_SETUP', error: 'Create a 4-digit PIN and enter it again to confirm.' });
    }
    if (student.pinHash) {
        if (typeof pin !== 'string' || !/^\d{4}$/.test(pin) || !await bcrypt.compare(pin, student.pinHash)) {
            return res.status(401).json({ error: 'Incorrect PIN.' });
        }
    } else {
        const pinHash = await bcrypt.hash(pin, 10);
        student = await Student.findOneAndUpdate({ _id: student._id, pinHash: null,
            tokenVersion: student.tokenVersion === 0 ? { $in: [0, null] } : student.tokenVersion },
            { $set: { pinHash } }, { new: true });
        if (!student) return res.status(409).json({ error: 'PIN setup changed. Check your roll number and try again.' });
    }
    await linkLegacyRecords(student);
    const token = jwt.sign({ id: student._id, role: 'student', pinVerified: true, version: student.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.set('Cache-Control', 'no-store').json({ token, student: profile(student) });
});

router.post('/admin/students/:id/reset-pin', requireAdmin, async (req, res) => {
    if (!isObjectIdOrHexString(req.params.id)) return res.status(400).json({ error: 'Invalid student.' });
    const student = await Student.findByIdAndUpdate(req.params.id, { $unset: { pinHash: 1 }, $inc: { tokenVersion: 1 } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    res.json({ message: 'PIN reset. The student can create a new PIN at login.' });
});

router.get('/admin/students', requireAdmin, async (req, res) => {
    const filter = validGrade(req.query.grade) ? { grade: Number(req.query.grade) } : {};
    if (typeof req.query.section === 'string' && req.query.section.trim()) filter.sectionKey = sectionKey(req.query.section);
    const students = await Student.find(filter).sort({ grade: 1, rollNum: 1 });
    res.json(students.map(profile));
});

router.post('/admin/students', requireAdmin, async (req, res) => {
    const { name, rollNum, grade } = req.body;
    if (!validFatherName(req.body.fatherName)) return res.status(400).json({ error: 'Father name must be at most 100 characters.' });
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
        typeof rollNum !== 'string' || !rollNum.trim() || rollNum.trim().length > 40 || !validGrade(grade)) {
        return res.status(400).json({ error: 'Enter name, roll number and grade.' });
    }
    try {
        if (await Student.exists({ rollNum: rollNum.trim() })) return res.status(409).json({ error: 'This roll number is already registered.' });
        const student = await Student.create({ name: name.trim(), fatherName: req.body.fatherName?.trim() || '', rollNum: rollNum.trim(), grade: Number(grade), section: sectionName(req.body.section) });
        await linkLegacyRecords(student);
        res.status(201).json(profile(student));
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'This roll number already has an account in this grade and section.' });
        throw error;
    }
});

router.post('/admin/students/:id/profile', requireAdmin, async (req, res) => {
    const { name, grade } = req.body;
    if (!validFatherName(req.body.fatherName)) return res.status(400).json({ error: 'Father name must be at most 100 characters.' });
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
    if (gradeChanged && await Attempt.exists({ student: student._id, status: 'active', $or: [{ remainingMs: { $gt: 0 } }, { timeBudgetMs: null, expiresAt: { $gt: new Date() } }] })) {
        return res.status(409).json({ error: 'This student is taking a quiz. Wait until it ends before changing the grade.' });
    }
    await linkLegacyRecords(student);
    if (gradeChanged) {
        // Seal unfinished quizzes with the original grade before updating the account.
        const unfinished = await Attempt.find({ student: student._id, $or: [
            { status: 'active', timeBudgetMs: null, expiresAt: { $lte: new Date() } },
            { status: 'active', remainingMs: 0 }, { status: 'submitted', purgeAt: { $exists: false } }
        ] });
        for (const attempt of unfinished) await finalizeAttempt(attempt, student);
    }
    student.name = name.trim(); student.grade = nextGrade; student.section = section;
    if (Object.hasOwn(req.body, 'fatherName')) student.fatherName = req.body.fatherName.trim();
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

router.delete('/admin/students/:id', requireAdmin, async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (await Attempt.exists({ student: student._id, status: 'active', $or: [{ remainingMs: { $gt: 0 } }, { timeBudgetMs: null, expiresAt: { $gt: new Date() } }] })) {
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
    const unfinished = await Attempt.find({ student: student._id, $or: [{ expiresAt: { $lte: new Date() }, timeBudgetMs: null, status: 'active' }, { remainingMs: 0, status: 'active' }, { status: 'submitted', purgeAt: { $exists: false } }] });
    for (const attempt of unfinished) {
        await finalizeAttempt(attempt, student);
    }
    const filter = studentRecords(student);
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const submissions = await Submission.find(filter).select('assignment marks percentage status submittedAt gradedAt manual');
    const [results, count, assignments, today, settings] = await Promise.all([
        Result.find(filter).select('score total date elapsedMs timeLimitMs').sort({ date: -1 }).skip((page - 1) * 20).limit(20).lean(),
        Result.countDocuments(filter),
        Assignment.find({ $or: [{ grade: student.grade }, { _id: { $in: submissions.map(s => s.assignment) } }] })
            .select('title grade maxMarks manual fileName fileUrl createdAt deletedAt').sort({ createdAt: -1 }),
        Attempt.findOne({ student: student._id, $or: [{ day: pakistanDay() }, { status: 'active', remainingMs: { $gt: 0 } }] }).sort({ status: 1, day: -1 }).select('status expiresAt'),
        Settings.findOne({ settings_id: 'main' }).select('quizAccessOpen').lean()
    ]);
    const submissionMap = new Map(submissions.map(s => [String(s.assignment), s]));
    res.json({ student: profile(student), results: results.map(r => ({ ...r, ...resultMetrics(r) })), page, pages: Math.max(1, Math.ceil(count / 20)), totalResults: count,
        today, quizAccessOpen: settings?.quizAccessOpen === true,
        assignments: assignments.filter(a => (!a.manual && !a.deletedAt) || ['graded', 'absent'].includes(submissionMap.get(String(a._id))?.status))
            .map(a => {
                const { fileUrl, ...assignment } = a.toObject();
                const submission = submissionMap.get(String(a._id)) || null;
                return { ...assignment, manual: a.manual === true || submission?.manual === true,
                    hasFile: Boolean(fileUrl && a.fileName), historical: a.grade !== student.grade, submission };
            }) });
});
module.exports = router;
