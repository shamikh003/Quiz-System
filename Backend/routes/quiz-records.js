const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { listQuizRecords, deleteQuizRecord } = require('../services/quiz-records');

const router = express.Router();

router.get('/admin/students/:id/quiz-records', requireAdmin, async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await listQuizRecords(req.params.id)); }
    catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});

router.delete('/admin/students/:id/quiz-records/:resultId', requireAdmin, async (req, res) => {
    try {
        const expectedAttemptId = Object.hasOwn(req.body || {}, 'attemptId') ? req.body.attemptId : undefined;
        if (expectedAttemptId === undefined) return res.status(400).json({ error: 'Refresh the quiz records before deleting.' });
        res.set('Cache-Control', 'no-store').json(await deleteQuizRecord(req.params.id, req.params.resultId, expectedAttemptId));
    } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});

module.exports = router;
