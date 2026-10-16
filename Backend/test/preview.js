// Disposable local UI preview. Never reads .env or connects to Atlas.
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const models = require('../models/models');

(async () => {
    process.env.JWT_SECRET = 'local-preview-only';
    const binary = path.join(__dirname, '../.mongodb-binaries/mongod.exe');
    const database = await MongoMemoryServer.create(fs.existsSync(binary) ? { binary: { systemBinary: binary } } : {});
    await mongoose.connect(database.getUri());
    await Promise.all(Object.values(models).map(model => model.init()));
    const passwordHash = await bcrypt.hash('demo123', 10);
    await models.Admin.create({ username: 'demo', passwordHash });
    await models.Student.create({ name: 'Demo Student', rollNum: 'H-01', grade: 0, passwordHash });
    await models.Student.create([
        { name: 'Demo Student', rollNum: '501', grade: 5, section: 'A', passwordHash },
        { name: 'Image Preview Student', rollNum: '401', grade: 4, section: 'A', passwordHash },
        { name: 'Portrait Preview Student', rollNum: '601', grade: 6, section: 'A', passwordHash }
    ]);
    await models.Question.insertMany(require('./student-preview-data').map(([text, ...texts], index) => {
        const options = texts.map((value, i) => ({ text: value, original: i }));
        for (let i = 0; i < index % 4; i++) options.push(options.shift());
        return { text, grade: 5, options: options.map((o, i) => ({ id: 'ABCD'[i], text: o.text })), correct: 'ABCD'[options.findIndex(o => o.original === 0)] };
    }));
    await models.Question.insertMany([
        { text: 'Which device is used to type?', grade: 0, options: [{ id: 'A', text: 'Keyboard' }, { id: 'B', text: 'Monitor' }, { id: 'C', text: 'Printer' }], correct: 'A' },
        { text: 'Which program creates presentations?', grade: 0, options: [{ id: 'A', text: 'PowerPoint' }, { id: 'B', text: 'Calculator' }, { id: 'C', text: 'Paint' }], correct: 'A' },
        { text: 'Which device prints on paper?', grade: 0, options: [{ id: 'A', text: 'Printer' }, { id: 'B', text: 'Mouse' }, { id: 'C', text: 'Keyboard' }], correct: 'A' }
    ]);
    await models.Result.create({ name: 'Demo Student', rollNum: 'H-01', grade: 0, score: 8, total: 10, date: new Date(Date.now() - 86400000) });
    const assignment = await models.Assignment.create({ title: 'PowerPoint practical', grade: 0, maxMarks: 20, fileName: 'presentation.pptx', fileUrl: 'https://example.invalid/test-only', filePath: 'test-only' });
    await models.Submission.create({ assignment: assignment._id, name: 'Demo Student', rollNum: 'H-01', grade: 0, fileName: 'completed.pptx', fileUrl: 'https://example.invalid/test-only', filePath: 'test-only', marks: 18, percentage: 90, status: 'graded' });
    const app = express(); app.use(require('cors')()); app.use(express.json());
    // Isolated preview storage exercises the normal multipart question route
    // without reading credentials or uploading classroom files to Cloudinary.
    const previewImages = new Map();
    const fileStore = require('../cloudinary');
    fileStore.uploadBuffer = async (buffer, folder, originalName) => {
        if (folder !== 'quiz-system/question-images') throw new Error('This local preview supports question image uploads only.');
        const id = require('node:crypto').randomUUID();
        const type = /\.jpe?g$/i.test(originalName) ? 'image/jpeg' : /\.webp$/i.test(originalName) ? 'image/webp' : /\.gif$/i.test(originalName) ? 'image/gif' : 'image/png';
        previewImages.set(id, { buffer, type });
        return { secure_url: `/preview/question-images/${id}`, public_id: `preview/${id}` };
    };
    fileStore.deleteFile = async id => { if (id?.startsWith('preview/')) previewImages.delete(id.slice(8)); };
    app.get('/preview/question-images/:id', (req, res) => {
        const image = previewImages.get(req.params.id);
        if (!image) return res.sendStatus(404);
        res.type(image.type).send(image.buffer);
    });
    // Optional demo-only delay for inspecting loaders. Production never runs this file.
    const requestedDelay = Number(process.env.PREVIEW_DELAY_MS || 0);
    const previewDelay = Number.isFinite(requestedDelay) ? Math.max(0, Math.min(10000, requestedDelay)) : 0;
    app.use('/api', (req, res, next) => {
        const previewRequest = req.method === 'GET'
            || (req.method === 'POST' && ['/auth/login', '/student/login'].includes(req.path));
        if (previewRequest && previewDelay) setTimeout(next, previewDelay);
        else next();
    });
    app.use('/api/auth', require('../routes/auth'));
    for (const route of ['students', 'attempts', 'questions', 'imports', 'results', 'student-reports', 'dashboard', 'assignments', 'settings']) app.use('/api', require(`../routes/${route}`));
    await require('../models/import-batch').init();
    require('../services/bulk-import').start();
    app.use(express.static(path.join(__dirname, '../../frontend')));
    app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
    const server = app.listen(5000, '127.0.0.1', () => console.log(`Disposable preview: http://127.0.0.1:5000/student/quiz.html (H-01 / Hifz / demo123). Teacher: demo / demo123. Loader delay: ${previewDelay} ms.`));
    const cleanup = async () => { server.close(); await mongoose.disconnect(); await database.stop(); process.exit(0); };
    process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);
})().catch(error => { console.error(error.message); process.exit(1); });
