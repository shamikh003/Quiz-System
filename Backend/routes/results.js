const express = require('express');
const { Result, Submission, Attempt } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');
const { sectionName, sectionKey, studentRecords } = require('../sections');
const { rankingStages } = require('../result-ranking');

const router = express.Router();

const { VALID_GRADES } = require('../grades');

// ---- ADMIN: leaderboard / all results ----
// Optional ?grade=4|5|6|7 filter for viewing one grade's leaderboard at a time.
// Each result also carries the student's latest graded assignment percentage
// (matched by student ownership and section), so scores cannot cross sections.
router.get('/results', requireAdmin, async (req, res) => {
    const filter = {};
    if (req.query.grade && VALID_GRADES.includes(Number(req.query.grade))) {
        filter.grade = Number(req.query.grade);
    }
    if (typeof req.query.section === 'string' && req.query.section.trim()) {
        const key = sectionKey(req.query.section);
        filter.sectionKey = key === 'unassigned' ? { $in: [null, key] } : key;
    }
    if (typeof req.query.rollNum === 'string' && req.query.rollNum.trim()) filter.rollNum = req.query.rollNum.trim();
    const results = await Result.aggregate([{ $match: filter }, ...rankingStages()]);

    const withAssignments = await Promise.all(results.map(async (r) => {
        const submission = await Submission.findOne({
            ...(r.student ? studentRecords({ _id: r.student, rollNum: r.rollNum, grade: r.grade, section: r.section }) : { student: null, rollNum: r.rollNum, grade: r.grade,
                sectionKey: sectionKey(r.section) === 'unassigned' ? { $in: [null, 'unassigned'] } : sectionKey(r.section) }),
            status: 'graded'
        }).sort({ gradedAt: -1 });

        return {
            ...r,
            section: sectionName(r.section),
            assignmentPercentage: submission ? submission.percentage : null
        };
    }));

    res.json(withAssignments);
});

// ---- ADMIN: delete all results (protected) ----
router.delete('/results', requireAdmin, async (req, res) => {
    // Preserve today's attempt lock even when the teacher clears reports.
    await Attempt.updateMany({ status: 'submitted', purgeAt: { $exists: false } }, { $set: { purgeAt: new Date(Date.now() + 30 * 86400000) } });
    await Attempt.updateMany({ status: 'submitted' }, { $set: { reportDeleted: true } });
    await Result.deleteMany({});
    res.json({ message: 'All results deleted.' });
});

module.exports = router;
