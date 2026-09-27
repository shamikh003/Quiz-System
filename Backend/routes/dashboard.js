const express = require('express');
const { Question, Result, Assignment, Submission } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const VALID_GRADES = [4, 5, 6, 7];

// ---- ADMIN: dashboard stats (protected) ----
// Total questions, total assignments, distinct students seen (by roll number,
// across both quiz results and assignment submissions), pending submissions
// to grade, and the most recent quiz results.
router.get('/admin/dashboard', requireAdmin, async (req, res) => {
    try {
        const [totalQuestions, totalAssignments, pendingSubmissions, resultRolls, submissionRolls, recentResults] =
            await Promise.all([
                Question.countDocuments(),
                Assignment.countDocuments(),
                Submission.countDocuments({ status: 'pending' }),
                Result.distinct('rollNum'),
                Submission.distinct('rollNum'),
                Result.find().sort({ date: -1 }).limit(5)
                    .select('name grade score total tabSwitchCount fullscreenExitCount date')
            ]);

        // A "student" is anyone who has ever taken a quiz or submitted an
        // assignment — there's no separate student-account collection.
        const distinctStudents = new Set([...resultRolls, ...submissionRolls]);

        res.json({
            totalQuestions,
            totalAssignments,
            totalStudents: distinctStudents.size,
            pendingSubmissions,
            recentResults
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).json({ error: 'Could not load dashboard stats.' });
    }
});

// ---- PUBLIC: student dashboard stats ----
// Identified the same way the rest of the app identifies a student: by
// roll number + grade, no account/password involved.
router.get('/student/dashboard', async (req, res) => {
    try {
        const rollNum = String(req.query.rollNum || '').trim();
        const grade = Number(req.query.grade);

        if (!rollNum || !VALID_GRADES.includes(grade)) {
            return res.status(400).json({ error: 'rollNum and a valid grade (4-7) are required.' });
        }

        const [results, assignments, mySubmissions] = await Promise.all([
            Result.find({ rollNum, grade }).sort({ date: -1 }),
            Assignment.find({ grade }).sort({ createdAt: 1 }),
            Submission.find({ rollNum, grade })
        ]);

        const completedQuizzes = results.length;
        const averageScore = completedQuizzes === 0
            ? null
            : Math.round(
                results.reduce((sum, r) => sum + (r.total > 0 ? (r.score / r.total) * 100 : 0), 0) / completedQuizzes
            );

        const submittedAssignmentIds = new Set(mySubmissions.map(s => s.assignment.toString()));
        const pendingAssignments = assignments.filter(a => !submittedAssignmentIds.has(a._id.toString()));

        // "Next up": the oldest not-yet-submitted assignment for this grade,
        // if any — otherwise null (the dashboard can fall back to "take the quiz").
        const nextUp = pendingAssignments.length > 0
            ? { type: 'assignment', id: pendingAssignments[0]._id, title: pendingAssignments[0].title }
            : null;

        res.json({
            completedQuizzes,
            averageScore,
            assignmentsCount: assignments.length,
            pendingAssignmentsCount: pendingAssignments.length,
            nextUp,
            recentResults: results.slice(0, 3).map(r => ({
                score: r.score,
                total: r.total,
                date: r.date
            }))
        });
    } catch (err) {
        console.error('Student dashboard error:', err);
        res.status(500).json({ error: 'Could not load dashboard stats.' });
    }
});

module.exports = router;
