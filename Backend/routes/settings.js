const express = require('express');
const { Settings } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/settings', async (req, res) => {
    const settings = await Settings.findOne({ settings_id: 'main' });
    res.json(settings || { time: 10 });
});

router.post('/settings', requireAdmin, async (req, res) => {
    const time = Number(req.body.time);
    if (!time || time <= 0) {
        return res.status(400).json({ error: 'Quiz time must be a positive number of minutes.' });
    }

    const updated = await Settings.findOneAndUpdate(
        { settings_id: 'main' },
        { time },
        { new: true, upsert: true }
    );
    res.json(updated);
});

module.exports = router;
