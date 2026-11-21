const express = require('express');
const { requireReports } = require('../middleware/auth');
const { searchStudents, studentReport, gradeReports } = require('../services/student-reports');
const { reportPdf, gradeReportPdf } = require('../services/student-report-pdf');
const { resultFilters } = require('../services/result-reports');
const { dashboardScores } = require('../services/dashboard-scores');
const router = express.Router();
router.use('/admin/student-reports', requireReports, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/admin/student-reports/directory', async (req, res) => {
    const { students } = await searchStudents({}, { limit: null });
    res.json(students.map(({ key, name, rollNum, grade, section }) => ({ key, name, rollNum, grade, section })));
});
router.get('/admin/student-reports/top-scorers', async (req, res) => {
    try {
        const { grade, section } = resultFilters({ grade: req.query.grade, section: req.query.section });
        res.json(await dashboardScores(grade ? { grade: Number(grade) } : {}, section));
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        throw error;
    }
});
router.get('/admin/student-reports/students', async (req, res) => {
    try { res.json(await searchStudents(req.query)); }
    catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});
router.get('/admin/student-reports/grade/pdf', async (req, res) => {
    try {
        const group = await gradeReports(req.query);
        const pdf = await gradeReportPdf(group.reports, group.grade);
        const label = group.grade === 0 ? 'Hifz' : `Grade-${group.grade}`;
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="QuizBoard-${label}-student-reports.pdf"` });
        res.send(pdf);
    } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});
router.get('/admin/student-reports/:key/pdf', async (req, res) => {
    try {
        const report = await studentReport(req.params.key);
        const pdf = await reportPdf(report);
        const name = report.student.name.normalize('NFKC').replace(/[^\p{L}\p{N}\p{M} _-]/gu, '').trim().replace(/\s+/g, '-').slice(0, 100) || 'Student';
        const ascii = name.replace(/[^a-zA-Z0-9_-]/g, '_');
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${ascii}-report.pdf"; filename*=UTF-8''${encodeURIComponent(name + '-report.pdf')}` });
        res.send(pdf);
    } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});
router.get('/admin/student-reports/:key', async (req, res) => {
    try { res.json(await studentReport(req.params.key)); }
    catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});
module.exports = router;
