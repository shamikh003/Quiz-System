const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { isObjectIdOrHexString } = require('mongoose');
const rateLimit = require('express-rate-limit');
const { requireAdmin } = require('../middleware/auth');
const Batch = require('../models/import-batch');
const imports = require('../services/bulk-import');
const { gradeValue, questionKey } = require('../services/import-parser');
const { Question } = require('../models/models');
const router = express.Router();
router.use('/admin/imports', requireAdmin);
router.use('/admin/imports', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const limit = rateLimit({ windowMs: 60000, max: 10, message: { error: 'Please wait a minute before uploading another file.' } });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 3, fieldSize: 1024 } }).single('file');
function owner(req) { return String(req.admin.id); }
const owned = req => ({ _id: req.params.id, owner: owner(req), expiresAt: { $gt: new Date() } });
router.param('id', (req, res, next, id) => isObjectIdOrHexString(id) ? next() : res.status(400).json({ error: 'Invalid import ID.' }));

router.post('/admin/imports/:kind/preview', limit, (req, res) => {
    if (!['questions', 'students'].includes(req.params.kind)) return res.status(400).json({ error: 'Choose questions or students.' });
    upload(req, res, async error => {
        if (error) return res.status(400).json({ error: 'Upload one file up to 10 MB.' });
        const extensions = req.params.kind === 'students' ? ['.xlsx'] : ['.pdf', '.docx'];
        if (!req.file || !extensions.includes(path.extname(req.file.originalname).toLowerCase())) return res.status(400).json({ error: `Choose a ${extensions.join(' or ')} file.` });
        if (req.params.kind === 'questions' && gradeValue(req.body.grade) === null) return res.status(400).json({ error: 'Choose the grade for these questions.' });
        try {
            res.status(201).json(await imports.preview(req.file, req.params.kind, { grade: req.body.grade, section: req.body.section }, owner(req)));
        } catch (error) { res.status(error.status || 400).json({ error: error.message }); }
    });
});
router.get('/admin/imports/:id', async (req, res) => {
    const batch = await Batch.findOne(owned(req));
    if (!batch) return res.status(404).json({ error: 'This import expired or is unavailable. Upload the file again.' });
    res.json(imports.view(batch));
});
router.patch('/admin/imports/:id/rows/:index', async (req, res) => {
    const batch = await Batch.findOne({ ...owned(req), status: 'preview', kind: 'questions' });
    if (!batch) return res.status(409).json({ error: 'Only questions in an open preview can be corrected.' });
    const index = Number(req.params.index), original = batch.rows[index], value = req.body;
    if (!Number.isInteger(index) || !original || !value || !Array.isArray(value.options) || value.options.length > 4
        || value.options.some(o => !o || typeof o.id !== 'string' || typeof o.text !== 'string') || typeof value.text !== 'string') return res.status(400).json({ error: 'Choose a valid preview row and provide plain question/option text.' });
    const row = { ...original, text: value.text, correct: value.correct,
        options: value.options.map(o => ({ id: o.id, text: o.text })) };
    row.errors = imports.questionErrors(row);
    const key = questionKey(row);
    if (batch.rows.some((r, i) => i !== index && questionKey(r) === key) || (await Question.find({ grade: row.grade }).select('text options grade').lean()).some(r => questionKey(r) === key)) row.errors.push('This question is repeated or already exists in this grade.');
    const updated = await Batch.findOneAndUpdate({ ...owned(req), status: 'preview', revision: value.revision },
        { $set: { [`rows.${index}`]: row }, $inc: { revision: 1 } }, { new: true });
    if (!updated) return res.status(409).json({ error: 'Preview changed in another tab. Reopen the import and review it again.' });
    res.json(imports.view(updated));
});
router.post('/admin/imports/:id/commit', async (req, res) => {
    const batch = await Batch.findOne(owned(req));
    if (!batch) return res.status(404).json({ error: 'This import expired. Upload the file again.' });
    if (['queued', 'importing', 'completed'].includes(batch.status)) return res.status(202).json(imports.view(batch));
    const selected = batch.status === 'failed' ? batch.selected : req.body.selected;
    if (!Array.isArray(selected) || !selected.length || selected.length > batch.rows.length
        || new Set(selected).size !== selected.length || selected.some(i => !Number.isInteger(i) || !batch.rows[i] || batch.rows[i].errors.length)) {
        return res.status(400).json({ error: 'Select at least one valid row. Fix or deselect rows with errors.' });
    }
    const updated = await Batch.findOneAndUpdate({ ...owned(req), status: batch.status, revision: req.body.revision },
        { $set: { selected, status: 'queued', expiresAt: new Date(Date.now() + 24 * 3600000) }, $inc: { revision: 1 }, $unset: { error: 1 } }, { new: true });
    if (!updated) return res.status(409).json({ error: 'Preview changed. Reopen it before importing.' });
    res.status(202).json(imports.view(updated));
    imports.start();
});
router.get('/admin/imports-template/students.xlsx', requireAdmin, async (req, res) => {
    const Excel = require('exceljs'), book = new Excel.Workbook(), sheet = book.addWorksheet('Students');
    sheet.addRow(['Name', 'Roll Number', 'Grade', 'Section', 'Password']);
    sheet.addRow(['Sample Student One', '00401', '4', 'A', 'Sample123']);
    sheet.addRow(['Sample Hifz Student', 'H-001', 'Hifz', '', 'Sample456']);
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF191497' } };
    [28, 20, 15, 20, 20].forEach((width, i) => { sheet.getColumn(i + 1).width = width; sheet.getColumn(i + 1).numFmt = '@'; });
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="QuizBoard-students-template.xlsx"' });
    res.send(Buffer.from(await book.xlsx.writeBuffer()));
});
module.exports = router;
