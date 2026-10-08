const express = require('express');
const { Question, Result, Assignment, Submission, Student } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');
const { rankingStages } = require('../result-ranking');
const { VALID_GRADES } = require('../grades');

const router = express.Router();
router.get('/admin/dashboard', requireAdmin, async (req, res) => {
    const filter = {};
    if (req.query.grade !== undefined && req.query.grade !== '') {
        if (typeof req.query.grade !== 'string' || !VALID_GRADES.map(String).includes(req.query.grade)) {
            return res.status(400).json({ error: 'Choose Grade 4, 5, 6, 7 or Hifz.' });
        }
        filter.grade = Number(req.query.grade);
    }
    try {
        const [totalQuestions, totalAssignments, pendingSubmissions, totalStudents, topResults] =
            await Promise.all([
                Question.countDocuments(),
                Assignment.countDocuments({ deletedAt: null }),
                Submission.countDocuments({ status: 'pending', assignmentDeletedAt: null }),
                Student.countDocuments(),
                Result.aggregate([
                    { $match: filter },
                    ...rankingStages(),
                    { $limit: 5 },
                    { $project: { name: 1, rollNum: 1, grade: 1, section: 1, score: 1, total: 1,
                        percentage: 1, rankingPercentage: 1, elapsedMs: 1, timingKnown: 1,
                        tabSwitchCount: 1, fullscreenExitCount: 1, date: 1 } }
                ])
            ]);

        res.json({
            grade: filter.grade ?? null,
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
