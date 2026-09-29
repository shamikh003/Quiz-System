const express = require('express');
const { Question, Result, Assignment, Submission, Student } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.get('/admin/dashboard', requireAdmin, async (req, res) => {
    try {
        const [totalQuestions, totalAssignments, pendingSubmissions, totalStudents, recentResults] =
            await Promise.all([
                Question.countDocuments(),
                Assignment.countDocuments(),
                Submission.countDocuments({ status: 'pending' }),
                Student.countDocuments(),
                Result.find().sort({ date: -1 }).limit(5)
                    .select('name grade score total tabSwitchCount fullscreenExitCount date')
            ]);

        res.json({
            totalQuestions,
            totalAssignments,
            totalStudents,
            pendingSubmissions,
            recentResults
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).json({ error: 'Could not load dashboard stats.' });
    }
});

module.exports = router;
