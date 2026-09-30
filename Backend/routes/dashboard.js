const express = require('express');
const { Question, Result, Assignment, Submission, Student } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');
const { rankingStages } = require('../result-ranking');

const router = express.Router();
router.get('/admin/dashboard', requireAdmin, async (req, res) => {
    try {
        const [totalQuestions, totalAssignments, pendingSubmissions, totalStudents, topResults] =
            await Promise.all([
                Question.countDocuments(),
                Assignment.countDocuments(),
                Submission.countDocuments({ status: 'pending' }),
                Student.countDocuments(),
                Result.aggregate([
                    ...rankingStages(),
                    { $limit: 5 },
                    { $project: { name: 1, rollNum: 1, grade: 1, section: 1, score: 1, total: 1,
                        percentage: 1, rankingPercentage: 1, elapsedMs: 1, timingKnown: 1,
                        tabSwitchCount: 1, fullscreenExitCount: 1, date: 1 } }
                ])
            ]);

        res.json({
            totalQuestions,
            totalAssignments,
            totalStudents,
            pendingSubmissions,
            topResults,
            recentResults: topResults // Support a previously cached dashboard during rollout.
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).json({ error: 'Could not load dashboard stats.' });
    }
});

module.exports = router;
