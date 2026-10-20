const express = require('express');
const { Result, Attempt } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');
const { resultRows, resultFilters } = require('../services/result-reports');
const { resultsPdf, resultsWorkbook } = require('../services/results-export');

const router = express.Router();

router.get('/results', requireAdmin, async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await resultRows(req.query)); }
    catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
});

for (const format of ['pdf', 'xlsx']) router.get(`/results/export.${format}`, requireAdmin, async (req, res) => {
    try {
        const filters = resultFilters(req.query), rows = await resultRows(filters);
        if (!rows.length) return res.status(404).json({ error: 'No results match these filters.' });
        const buffer = await (format === 'pdf' ? resultsPdf(rows, filters) : resultsWorkbook(rows, filters));
        const label = filters.grade ? (filters.grade === '0' ? 'Hifz' : `Grade-${filters.grade}`) : 'All-Grades';
        res.set({ 'Cache-Control': 'no-store', 'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="QuizBoard-${label}-${filters.attempts}-results.${format}"` }).send(buffer);
    } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
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
