const express = require('express');
const { Question, Assignment, Submission, Student } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');
const { resultRows } = require('../services/result-reports');
const { VALID_GRADES } = require('../grades');
const { TOP_SCORER_FLAG_LIMIT } = require('../result-ranking');

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
                resultRows({ grade: filter.grade == null ? '' : String(filter.grade) }, { includeAssignments: false, bestPerStudent: true, limit: 5 })
            ]);

        res.json({
            grade: filter.grade ?? null,
            totalQuestions,
            totalAssignments,
            totalStudents,
            pendingSubmissions,
            scoreView: 'best',
            topScoreFlagLimit: TOP_SCORER_FLAG_LIMIT,
            topResults,
            latestResults: topResults,
            recentResults: topResults
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).json({ error: 'Could not load dashboard stats.' });
    }
});

module.exports = router;
