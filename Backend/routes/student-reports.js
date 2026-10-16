const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { searchStudents, studentReport } = require('../services/student-reports');
const { reportPdf } = require('../services/student-report-pdf');
const router = express.Router();
router.use('/admin/student-reports', requireAdmin, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/admin/student-reports/students', async (req, res) => {
    try { res.json(await searchStudents(req.query)); }
    catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});
router.get('/admin/student-reports/:key/pdf', async (req, res) => {
    try {
        const report = await studentReport(req.params.key);
        const pdf = await reportPdf(report);
        const roll = report.student.rollNum.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'student';
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="QuizBoard-${roll}-report.pdf"` });
        res.send(pdf);
    } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});
router.get('/admin/student-reports/:key', async (req, res) => {
    try { res.json(await studentReport(req.params.key)); }
    catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});
module.exports = router;
