const express = require('express');
const { Question } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const VALID_GRADES = [4, 5, 6, 7];

function validateQuestionBody(body) {
    if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
        return 'Question text is required.';
    }
    if (!VALID_GRADES.includes(Number(body.grade))) {
        return 'Grade must be one of 4, 5, 6, or 7.';
    }
    if (!Array.isArray(body.options) || body.options.length < 3 || body.options.length > 4) {
        return 'Question must have 3 or 4 options.';
    }
    for (const opt of body.options) {
        if (!opt.id || !opt.text || !opt.text.trim()) {
            return 'Every option needs an id and non-empty text.';
        }
    }
    const validIds = body.options.map(o => o.id);
    if (!body.correct || !validIds.includes(body.correct)) {
        return 'Correct answer must match one of the option ids.';
    }
    return null;
}

// ---- PUBLIC: used by the student quiz page. Never sends the "correct" field. ----
// Requires ?grade=4|5|6|7 so students only ever receive questions for their own grade.
router.get('/quiz/questions', async (req, res) => {
    try {
        const grade = Number(req.query.grade);
        if (!VALID_GRADES.includes(grade)) {
            return res.status(400).json({ error: 'A valid grade (4-7) is required.' });
        }
        const questions = await Question.find({ grade }).select('-correct');
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: 'Could not load questions.' });
    }
});

// ---- ADMIN: full question management (protected) ----
// Optional ?grade=4|5|6|7 filter so the teacher can view one grade at a time.
router.get('/admin/questions', requireAdmin, async (req, res) => {
    const filter = {};
    if (req.query.grade && VALID_GRADES.includes(Number(req.query.grade))) {
        filter.grade = Number(req.query.grade);
    }
    const questions = await Question.find(filter).sort({ createdAt: -1 });
    res.json(questions);
});

router.post('/admin/questions', requireAdmin, async (req, res) => {
    const error = validateQuestionBody(req.body);
    if (error) return res.status(400).json({ error });

    const newQuestion = new Question({
        text: req.body.text.trim(),
        grade: Number(req.body.grade),
        options: req.body.options,
        correct: req.body.correct
    });
    await newQuestion.save();
    res.status(201).json(newQuestion);
});

router.put('/admin/questions/:id', requireAdmin, async (req, res) => {
    const error = validateQuestionBody(req.body);
    if (error) return res.status(400).json({ error });

    const updated = await Question.findByIdAndUpdate(
        req.params.id,
        {
            text: req.body.text.trim(),
            grade: Number(req.body.grade),
            options: req.body.options,
            correct: req.body.correct
        },
        { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Question not found.' });
    res.json(updated);
});

router.delete('/admin/questions/:id', requireAdmin, async (req, res) => {
    const deleted = await Question.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Question not found.' });
    res.json({ message: 'Question deleted.' });
});

router.delete('/admin/questions', requireAdmin, async (req, res) => {
    await Question.deleteMany({});
    res.json({ message: 'All questions deleted.' });
});

module.exports = router;
