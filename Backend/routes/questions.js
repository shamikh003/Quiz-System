const express = require('express');
const multer = require('multer');
const { Question, Attempt } = require('../models/models');
const { requireAdmin } = require('../middleware/auth');
const { uploadBuffer, deleteFile } = require('../cloudinary');

const router = express.Router();

const { VALID_GRADES, validGrade } = require('../grades');
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => /^image\/(png|jpeg|webp|gif)$/.test(file.mimetype)
        ? cb(null, true) : cb(new Error('Only PNG, JPG, WEBP or GIF images are allowed.')) }).single('image');

function parseMultipart(body) {
    const parsed = { ...body };
    if (typeof parsed.options === 'string') {
        try { parsed.options = JSON.parse(parsed.options); } catch { parsed.options = null; }
    }
    return parsed;
}

async function protectActiveQuestions(req, res, next) {
    const filter = { status: 'active', expiresAt: { $gt: new Date() } };
    if (req.params.id) filter['questions.questionId'] = req.params.id;
    if (await Attempt.exists(filter)) return res.status(409).json({ error: 'Students are taking this quiz. Wait until their timers end before editing or deleting questions.' });
    next();
}

function validateQuestionBody(body) {
    if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
        return 'Question text is required.';
    }
    if (!validGrade(body.grade)) {
        return 'Choose Grade 4, 5, 6, 7 or Hifz.';
    }
    if (!Array.isArray(body.options) || body.options.length < 3 || body.options.length > 4) {
        return 'Question must have 3 or 4 options.';
    }
    for (const opt of body.options) {
        if (!opt || typeof opt.id !== 'string' || typeof opt.text !== 'string' || !opt.text.trim()) {
            return 'Every option needs an id and non-empty text.';
        }
    }
    const validIds = body.options.map(o => o.id);
    if (new Set(validIds).size !== validIds.length) return 'Option IDs must be unique.';
    if (!body.correct || !validIds.includes(body.correct)) {
        return 'Correct answer must match one of the option ids.';
    }
    return null;
}

// ---- ADMIN: full question management (protected) ----
// Optional ?grade=4|5|6|7 filter so the teacher can view one grade at a time.
router.get('/admin/questions', requireAdmin, async (req, res) => {
    const filter = {};
    if (req.query.grade && VALID_GRADES.includes(Number(req.query.grade))) {
        filter.grade = Number(req.query.grade);
    }
    const questions = await Question.find(filter).sort({ createdAt: -1 });
    res.json(questions);
});

router.post('/admin/questions', requireAdmin, (req, res) => imageUpload(req, res, async uploadError => {
    if (uploadError) return res.status(400).json({ error: uploadError.message || 'Invalid image. Use PNG, JPG, WEBP or GIF up to 5 MB.' });
    try {
        const body = parseMultipart(req.body);
        const error = validateQuestionBody(body);
        if (error) return res.status(400).json({ error });
        let image = {};
        if (req.file) image = await uploadBuffer(req.file.buffer, 'quiz-system/question-images', req.file.originalname);
        const newQuestion = await Question.create({ text: body.text.trim(), grade: Number(body.grade), options: body.options, correct: body.correct,
            imageUrl: image.secure_url || null, imagePath: image.public_id || null });
        res.status(201).json(newQuestion);
    } catch (error) { console.error('Question save error:', error); res.status(500).json({ error: 'Could not save question.' }); }
}));

router.put('/admin/questions/:id', requireAdmin, protectActiveQuestions, (req, res) => imageUpload(req, res, async uploadError => {
    if (uploadError) return res.status(400).json({ error: uploadError.message || 'Invalid image. Use PNG, JPG, WEBP or GIF up to 5 MB.' });
    try {
        const body = parseMultipart(req.body);
        const error = validateQuestionBody(body);
        if (error) return res.status(400).json({ error });
        const existing = await Question.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Question not found.' });
        const update = { text: body.text.trim(), grade: Number(body.grade), options: body.options, correct: body.correct };
        if (req.file) {
            const image = await uploadBuffer(req.file.buffer, 'quiz-system/question-images', req.file.originalname);
            update.imageUrl = image.secure_url; update.imagePath = image.public_id;
            await deleteFile(existing.imagePath);
        }
        const updated = await Question.findByIdAndUpdate(req.params.id, update, { new: true });
        res.json(updated);
    } catch (error) { console.error('Question update error:', error); res.status(500).json({ error: 'Could not update question.' }); }
}));

router.delete('/admin/questions/:id', requireAdmin, protectActiveQuestions, async (req, res) => {
    const deleted = await Question.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Question not found.' });
    await deleteFile(deleted.imagePath);
    res.json({ message: 'Question deleted.' });
});

router.delete('/admin/questions', requireAdmin, async (req, res) => {
    if (!validGrade(req.query.grade)) {
        return res.status(400).json({ error: 'Select Grade 4, 5, 6, 7 or Hifz before clearing questions.' });
    }
    const grade = Number(req.query.grade);
    const questions = await Question.find({ grade }).select('imagePath');
    const ids = questions.map(q => q._id);
    if (await Attempt.exists({ status: 'active', expiresAt: { $gt: new Date() }, 'questions.questionId': { $in: ids } })) {
        return res.status(409).json({ error: 'Students are taking this grade’s quiz. Wait until their timers end before deleting its questions.' });
    }
    const deleted = await Question.deleteMany({ grade, _id: { $in: ids } });
    await Promise.all(questions.map(q => deleteFile(q.imagePath)));
    res.json({ message: `${grade === 0 ? 'Hifz' : `Grade ${grade}`} questions deleted.`, deletedCount: deleted.deletedCount });
});

module.exports = router;
