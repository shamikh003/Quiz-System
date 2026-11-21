const express = require('express');
const rateLimit = require('express-rate-limit');
const { Attempt, Question, Settings, Result } = require('../models/models');
const { requireStudent } = require('../middleware/auth');
const { pakistanDay, validateAnswers } = require('../quiz-policy');
const { finalizeAttempt } = require('../services/attempts');
const { studentRecords } = require('../sections');
const { resultMetrics } = require('../result-ranking');
const { cachedUrdu, studentQuestion } = require('../services/translation');
const { quizTime } = require('../services/quiz-settings');
const router = express.Router();
router.use('/quiz', requireStudent);
async function resultView(result) {
    const summary = { score: result.score, total: result.total, date: result.date, ...resultMetrics(result) };
    const attempt = result.attempt && await Attempt.findById(result.attempt);
    if (!attempt) return summary;
    const questions = await Question.find({ _id: { $in: attempt.questions.map(q => q.questionId) } });
    const byId = new Map(questions.map(q => [String(q._id), q]));
    const answers = new Map(attempt.answers.map(a => [String(a.questionId), a.selected]));
    return { ...summary, details: attempt.questions.map(key => {
        const question = byId.get(String(key.questionId));
        const selected = answers.get(String(key.questionId)) || null;
        return { questionText: question?.text || 'Question removed', selected,
            options: question?.options.map(o => ({ id: o.id, text: o.text })) || [],
            urdu: question ? cachedUrdu(question) : null };
    }) };
}

router.post('/quiz/start', async (req, res) => {
    const student = req.student;
    const day = pakistanDay();
    // Finish older expired sessions before allowing a new day's quiz.
    const old = await Attempt.find({ student: student._id, status: 'active', $or: [
        { timeBudgetMs: null, expiresAt: { $lte: new Date() } }, { remainingMs: 0 }
    ] });
    for (const attempt of old) await finalizeAttempt(attempt, student);
    let attempt = await Attempt.findOne({ student: student._id, day });
    if (!attempt) {
        // A quiz spanning midnight remains the same attempt until its deadline.
        attempt = await Attempt.findOne({ student: student._id, status: 'active', $or: [
            { remainingMs: { $gt: 0 } }, { timeBudgetMs: null, expiresAt: { $gt: new Date() } }
        ] });
    }
    if (!attempt) {
        // Respect quizzes taken before student accounts were deployed on this day.
        const start = new Date(`${day}T00:00:00+05:00`);
        if (await Result.exists({ ...studentRecords(student), date: { $gte: start, $lt: new Date(start.getTime() + 86400000) } })) {
            return res.status(409).json({ error: 'You have already completed today’s quiz. Please return tomorrow.' });
        }
        const settings = await Settings.findOne({ settings_id: 'main' });
        if (settings?.quizAccessOpen !== true) {
            return res.status(403).json({ code: 'QUIZ_CLOSED', error: 'Quiz access is closed. Please wait for your teacher to open it.' });
        }
        const questions = await Question.find({ grade: student.grade });
        if (!questions.length) return res.status(404).json({ error: 'No quiz is available for your grade yet.' });
        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }
        try {
            const duration = quizTime(settings, student.grade) * 60000;
            attempt = await Attempt.create({ student: student._id, day,
                expiresAt: new Date(Date.now() + duration), timeBudgetMs: duration, remainingMs: duration,
                questions: questions.map(q => ({ questionId: q._id, correct: q.correct, options: q.options.map(o => o.id) })) });
        } catch (error) {
            if (error.code !== 11000) throw error;
            attempt = await Attempt.findOne({ student: student._id, day });
        }
    }
    if (attempt.status === 'submitted' || (attempt.timeBudgetMs == null ? attempt.expiresAt <= new Date() : attempt.remainingMs <= 0)) {
        const result = await finalizeAttempt(attempt, student);
        return res.status(409).json({ error: 'Today’s quiz is complete. You can take another quiz tomorrow.', result: await resultView(result) });
    }
    const questions = await Question.find({ _id: { $in: attempt.questions.map(q => q.questionId) } }).select('-correct');
    const map = new Map(questions.map(q => [String(q._id), q]));
    res.json({ attemptId: attempt._id, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt, serverNow: new Date(), revision: attempt.revision,
        timeBudgetMs: attempt.timeBudgetMs, remainingMs: attempt.remainingMs,
        answers: attempt.answers, tabSwitchCount: attempt.tabSwitchCount, fullscreenExitCount: attempt.fullscreenExitCount,
        questions: attempt.questions.map(q => map.has(String(q.questionId)) ? studentQuestion(map.get(String(q.questionId))) :
            { _id: q.questionId, text: 'This question is no longer available. Please contact your teacher.', options: [] }) });
});

// Charge only the time between consecutive server checkpoints. A long gap
// means the browser lost contact, so it resumes from the last saved checkpoint.
const heartbeatLimit = rateLimit({ windowMs: 60000, limit: 90, keyGenerator: req => String(req.student._id) });
router.post('/quiz/heartbeat', heartbeatLimit, async (req, res) => {
    const gap = { $subtract: ['$$NOW', '$lastHeartbeatAt'] };
    const attempt = await Attempt.findOneAndUpdate({
        _id: req.body.attemptId, student: req.student._id, status: 'active', timeBudgetMs: { $gt: 0 }
    }, [{ $set: {
        remainingMs: { $max: [0, { $subtract: ['$remainingMs', {
            $cond: [{ $and: [req.body.paused !== true, { $gt: [gap, 0] }, { $lte: [gap, 8000] }] }, gap, 0]
        }] }] },
        lastHeartbeatAt: req.body.paused === true ? null : '$$NOW'
    } }], { new: true }).select('remainingMs');
    if (!attempt) return res.status(409).json({ error: 'This quiz is no longer active.' });
    res.json({ remainingMs: attempt.remainingMs });
});

router.post('/quiz/save', async (req, res) => {
    const attempt = await Attempt.findOne({ _id: req.body.attemptId, student: req.student._id });
    if (!attempt) return res.status(404).json({ error: 'Quiz attempt not found.' });
    if (attempt.status !== 'active' || (attempt.timeBudgetMs == null ? attempt.expiresAt <= new Date() : attempt.remainingMs <= 0)) {
        const result = await finalizeAttempt(attempt, req.student);
        return res.status(409).json({ error: 'The quiz has ended.', result: await resultView(result) });
    }
    let answers;
    try { answers = validateAnswers(attempt.questions, req.body.answers); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    if (!Number.isInteger(req.body.revision)) return res.status(400).json({ error: 'Missing answer revision.' });
    const flags = key => Math.min(10000, Math.max(0, Math.floor(Number(req.body[key]) || 0)));
    const timingFilter = attempt.timeBudgetMs == null ? { expiresAt: { $gt: new Date() } } : { remainingMs: { $gt: 0 } };
    const saved = await Attempt.findOneAndUpdate({ _id: attempt._id, status: 'active', ...timingFilter, revision: req.body.revision },
        { $set: { answers }, $inc: { revision: 1 }, $max: { tabSwitchCount: flags('tabSwitchCount'), fullscreenExitCount: flags('fullscreenExitCount') } }, { new: true });
    if (!saved) return res.status(409).json({ error: 'Quiz changed in another tab or time expired. Reload to resume saved answers.' });
    res.json({ revision: saved.revision });
});

router.post('/quiz/submit', async (req, res) => {
    const attempt = await Attempt.findOne({ _id: req.body.attemptId, student: req.student._id });
    if (!attempt) return res.status(404).json({ error: 'Quiz attempt not found.' });
    const flags = key => Math.min(10000, Math.max(0, Math.floor(Number(req.body[key]) || 0)));
    await Attempt.updateOne({ _id: attempt._id, status: 'active' }, {
        $max: { tabSwitchCount: flags('tabSwitchCount'), fullscreenExitCount: flags('fullscreenExitCount') }
    });
    // Only persisted answers are marked. Repeated submits return the same result.
    const result = await finalizeAttempt(attempt, req.student);
    res.json(await resultView(result));
});
module.exports = router;
