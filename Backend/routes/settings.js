const express = require('express');
const { Settings } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');
const { validGrade } = require('../grades');
const { quizMinutes, quizTime, saveGradeTime } = require('../services/quiz-settings');

const router = express.Router();

router.get('/settings', async (req, res) => {
    if (req.query.grade !== undefined && !validGrade(req.query.grade)) return res.status(400).json({ error: 'Choose a valid grade.' });
    const settings = await Settings.findOne({ settings_id: 'main' });
    res.set('Cache-Control', 'no-store');
    res.json(req.query.grade === undefined ? settings || { time: 10 } : { grade: Number(req.query.grade), time: quizTime(settings, req.query.grade) });
});

router.post('/settings', requireAdmin, async (req, res) => {
    if (!validGrade(req.body.grade)) return res.status(400).json({ error: 'Choose the grade for this quiz time.' });
    let time;
    try { time = quizMinutes(req.body.time); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    await saveGradeTime(Settings, req.body.grade, time);
    res.json({ grade: Number(req.body.grade), time });
});

module.exports = router;
