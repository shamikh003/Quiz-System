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
    await models.Question.insertMany([
        { text: 'Which device is used to type?', grade: 0, options: [{ id: 'A', text: 'Keyboard' }, { id: 'B', text: 'Monitor' }, { id: 'C', text: 'Printer' }], correct: 'A' },
        { text: 'Which program creates presentations?', grade: 0, options: [{ id: 'A', text: 'PowerPoint' }, { id: 'B', text: 'Calculator' }, { id: 'C', text: 'Paint' }], correct: 'A' },
        { text: 'Which device prints on paper?', grade: 0, options: [{ id: 'A', text: 'Printer' }, { id: 'B', text: 'Mouse' }, { id: 'C', text: 'Keyboard' }], correct: 'A' }
    ]);
    await models.Result.create({ name: 'Demo Student', rollNum: 'H-01', grade: 0, score: 8, total: 10, date: new Date(Date.now() - 86400000) });
    const assignment = await models.Assignment.create({ title: 'PowerPoint practical', grade: 0, maxMarks: 20, fileName: 'presentation.pptx', fileUrl: 'https://example.invalid/test-only', filePath: 'test-only' });
    await models.Submission.create({ assignment: assignment._id, name: 'Demo Student', rollNum: 'H-01', grade: 0, fileName: 'completed.pptx', fileUrl: 'https://example.invalid/test-only', filePath: 'test-only', marks: 18, percentage: 90, status: 'graded' });
    const app = express(); app.use(require('cors')()); app.use(express.json());
    app.use('/api/auth', require('../routes/auth'));
    for (const route of ['students', 'attempts', 'questions', 'results', 'dashboard', 'assignments', 'settings']) app.use('/api', require(`../routes/${route}`));
    app.use(express.static(path.join(__dirname, '../../frontend')));
    app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
    const server = app.listen(5000, '127.0.0.1', () => console.log('Disposable preview: http://127.0.0.1:5000/student/quiz.html (H-01 / Hifz / demo123). Teacher: demo / demo123.'));
    const cleanup = async () => { server.close(); await mongoose.disconnect(); await database.stop(); process.exit(0); };
    process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);
})().catch(error => { console.error(error.message); process.exit(1); });
