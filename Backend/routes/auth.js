const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isObjectIdOrHexString } = require('mongoose');
const { Admin } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const admin = await Admin.findOne({ username, role: { $ne: 'viewer' }, active: { $ne: false } });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const match = await bcrypt.compare(password, admin.passwordHash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const token = jwt.sign(
            { id: admin._id, username: admin.username, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, username: admin.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

router.post('/report-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
        const viewer = await Admin.findOne({ username, role: 'viewer', active: { $ne: false } });
        if (!viewer || !await bcrypt.compare(password, viewer.passwordHash)) return res.status(401).json({ error: 'Invalid username or password.' });
        const token = jwt.sign({ id: viewer._id, username: viewer.username, name: viewer.displayName || viewer.username, role: 'viewer' }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, name: viewer.displayName || viewer.username });
    } catch (error) {
        res.status(500).json({ error: 'Server error during login.' });
    }
});

router.get('/report-viewer', requireAdmin, async (req, res) => {
    const viewers = await Admin.find({ role: 'viewer' }).select('username displayName').sort({ displayName: 1, username: 1 }).lean();
    res.set('Cache-Control', 'no-store').json({ viewers });
});

router.post('/report-viewer', requireAdmin, async (req, res) => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!username || username.length > 100 || !displayName || displayName.length > 100) return res.status(400).json({ error: 'Enter a name and username of at most 100 characters.' });
    const { id } = req.body;
    if (id != null && (typeof id !== 'string' || !isObjectIdOrHexString(id))) return res.status(400).json({ error: 'Invalid account.' });
    const existing = id ? await Admin.findOne({ _id: id, role: 'viewer' }).select('_id') : null;
    if (id && !existing) return res.status(404).json({ error: 'Reports account not found.' });
    if ((!existing && password.length < 6) || password && (password.length < 6 || Buffer.byteLength(password) > 72)) return res.status(400).json({ error: 'Password must contain 6–72 bytes.' });
    const update = { username, displayName, role: 'viewer' };
    if (password) update.passwordHash = await bcrypt.hash(password, 10);
    try {
        const viewer = existing
            ? await Admin.findOneAndUpdate({ _id: existing._id, role: 'viewer' }, { $set: update }, { new: true })
            : await Admin.create(update);
        if (!viewer) return res.status(404).json({ error: 'Reports account not found.' });
        res.json({ id: viewer.id, message: existing ? 'Account updated.' : 'Account created.' });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'That username is already in use.' });
        throw error;
    }
});

module.exports = router;
