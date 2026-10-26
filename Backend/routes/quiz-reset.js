const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { previewTodayReset, resetTodayQuiz } = require('../services/quiz-reset');

const router = express.Router();

router.get('/admin/students/:id/quiz-reset', requireAdmin, async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await previewTodayReset(req.params.id)); }
    catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});

router.post('/admin/students/:id/quiz-reset', requireAdmin, async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await resetTodayQuiz(req.params.id, req.body)); }
    catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});

module.exports = router;
