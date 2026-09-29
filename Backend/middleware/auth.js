const jwt = require('jsonwebtoken');
const { Student } = require('../models/models');

// Protects routes that only the logged-in teacher/admin should access.
function requireAdmin(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'No token provided. Please log in again.' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.role !== 'admin') return res.status(403).json({ error: 'Teacher access required. Please log in again.' });
        req.admin = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }
}

async function requireStudent(req, res, next) {
    try {
        const token = (req.headers.authorization || '').replace(/^Bearer /, '');
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.role !== 'student') return res.status(403).json({ error: 'Student access required.' });
        const student = await Student.findById(payload.id);
        if (!student || payload.version !== student.tokenVersion) return res.status(401).json({ error: 'Please log in again.' });
        req.student = student;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
}
module.exports = { requireAdmin, requireStudent };
