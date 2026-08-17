const express = require('express');
const { Question, Result } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const VALID_GRADES = [4, 5, 6, 7];

// ---- PUBLIC: student submits their answers, server computes the score. ----
// This is the key security fix: the correct answers never reach the browser
// during the quiz, and the score can't be tampered with client-side.
router.post('/quiz/submit', async (req, res) => {
    try {
        const { name, rollNum, answers } = req.body;
        const grade = Number(req.body.grade);
        const tabSwitchCount = Math.max(0, Number(req.body.tabSwitchCount) || 0);
        const fullscreenExitCount = Math.max(0, Number(req.body.fullscreenExitCount) || 0);

        if (!name || !rollNum || !VALID_GRADES.includes(grade) || !Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({ error: 'name, rollNum, a valid grade, and at least one answer are required.' });
        }

        const questionIds = answers.map(a => a.questionId);
        // Only match questions that belong to the submitted grade, so a student
        // can't pad their score with answers copied from another grade's quiz.
        const questions = await Question.find({ _id: { $in: questionIds }, grade });
        const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

        let score = 0;
        const details = [];

        for (const answer of answers) {
            const question = questionMap.get(answer.questionId);
            if (!question) continue;

            const isCorrect = answer.selected === question.correct;
            if (isCorrect) score++;

            details.push({
                questionText: question.text,
                selected: answer.selected || null,
                correct: question.correct,
                options: question.options
            });
        }

        const result = new Result({
            name: String(name).trim(),
            rollNum: String(rollNum).trim(),
            grade,
            score,
            total: answers.length,
            tabSwitchCount,
            fullscreenExitCount,
            details
        });
        await result.save();

        res.status(201).json({
            score,
            total: answers.length,
            details
        });
    } catch (err) {
        console.error('Submit error:', err);
        res.status(500).json({ error: 'Could not submit quiz.' });
    }
});

// ---- PUBLIC: leaderboard / all results ----
// Optional ?grade=4|5|6|7 filter for viewing one grade's leaderboard at a time.
router.get('/results', async (req, res) => {
    const filter = {};
    if (req.query.grade && VALID_GRADES.includes(Number(req.query.grade))) {
        filter.grade = Number(req.query.grade);
    }
    const results = await Result.find(filter)
        .select('-details')
        .sort({ score: -1, date: 1 });
    res.json(results);
});

// ---- ADMIN: delete all results (protected) ----
router.delete('/results', requireAdmin, async (req, res) => {
    await Result.deleteMany({});
    res.json({ message: 'All results deleted.' });
});

module.exports = router;
