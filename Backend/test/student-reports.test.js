const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const models = require('../models/models');
const { studentReport, searchStudents } = require('../services/student-reports');
let database, server, base, teacher, pupil;
before(async () => {
    process.env.JWT_SECRET = 'isolated-student-report-test';
    const binary = path.join(__dirname, '../.mongodb-binaries/mongod.exe');
    database = await MongoMemoryServer.create(fs.existsSync(binary) ? { binary: { systemBinary: binary } } : {});
    await mongoose.connect(database.getUri()); await Promise.all(Object.values(models).map(model => model.init()));
    const app = express(); app.use('/api', require('../routes/student-reports'));
    app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api/admin/student-reports`;
    teacher = jwt.sign({ id: 'teacher', role: 'admin' }, process.env.JWT_SECRET);
    pupil = jwt.sign({ id: new mongoose.Types.ObjectId().toString(), role: 'student' }, process.env.JWT_SECRET);
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (database) await database.stop(); });
async function request(route, token = teacher) { return fetch(base + route, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); }
const account = (rollNum, grade = 5, section = 'A', name = 'Ahmed Ali') => models.Student.create({ name, rollNum, grade, section, passwordHash: 'private-unused-test-hash' });
const result = data => models.Result.create({ name: 'Earlier name', rollNum: '501', grade: 5, section: 'A', score: 8, total: 10, date: new Date('2026-09-01'), ...data });

test('individual reports require a teacher; student searches distinguish names, sections and grades', async () => {
    for (const route of ['/students', '/student:bad', '/student:bad/pdf']) {
        assert.equal((await request(route, null)).status, 401); assert.equal((await request(route, pupil)).status, 403);
    }
    await account('501'); await account('501', 5, 'B'); await account('501', 0, 'A');
    assert.equal((await request('/students?grade=8')).status, 400);
    assert.equal((await request('/student:bad')).status, 400);
    assert.equal((await request('/legacy:abc')).status, 400);
    assert.equal((await request(`/student:${new mongoose.Types.ObjectId()}`)).status, 404);
    const response = await request('/students?q=AHMED'); const data = await response.json();
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(data.students.length, 3);
    assert.equal(new Set(data.students.map(row => row.key)).size, 3);
    assert.ok(!JSON.stringify(data).includes('passwordHash'));
    assert.equal((await searchStudents({ q: '.*' })).total, 0);
    assert.equal((await searchStudents({ q: 'Ahmed', grade: '0' })).total, 1);
    assert.equal((await searchStudents({ q: '501', grade: '5', section: 'B' })).total, 1);
});
test('existing linked and matching legacy data is preserved across grade changes without mixing identities', async () => {
    const student = await models.Student.findOne({ rollNum: '501', grade: 5, sectionKey: 'a' });
    await result({ student: student._id, grade: 4, section: 'Old Section', score: 10, total: 10 });
    const legacy = await result({ score: 6, total: 10 });
    await result({ section: 'B', score: 0, total: 10 });
    await result({ grade: 0, score: 0, total: 10 });
    const response = await request(`/student:${student._id}`), report = await response.json();
    assert.equal(response.status, 200); assert.equal(report.student.name, 'Ahmed Ali');
    assert.equal(report.student.fatherName, '');
    assert.equal(report.summary.quizzesTaken, 2); assert.equal(report.summary.averageQuiz, 80); assert.equal(report.summary.bestQuiz, 100);
    assert.ok(report.quizzes.some(row => row.grade === 4 && row.section === 'Old Section'));
    assert.ok(report.quizzes.every(row => row.section !== 'B'));
    assert.equal((await models.Result.findById(legacy._id)).student, undefined, 'report must not rewrite legacy data');
    assert.ok(!JSON.stringify(report).includes('correct')); assert.ok(!JSON.stringify(report).includes('passwordHash'));
});
test('historic students without accounts remain searchable and graded archived assignments retain zero marks', async () => {
    await result({ name: 'Historical Learner', rollNum: 'OLD-1', section: '', score: 0, total: 20 });
    const task = await models.Assignment.create({ title: 'Archived Word Task', grade: 5, maxMarks: 20, fileName: 'task.docx', deletedAt: new Date() });
    const common = { assignment: task._id, name: 'Historical Learner', rollNum: 'OLD-1', grade: 5, fileName: 'done.docx', assignmentDeletedAt: new Date() };
    await models.Submission.create({ ...common, status: 'graded', marks: 0, percentage: 0 });
    await models.Submission.create({ ...common, status: 'pending' });
    const matched = await searchStudents({ q: 'Historical Learner' }); assert.equal(matched.total, 1);
    assert.equal(matched.students[0].historical, true);
    const report = await studentReport(matched.students[0].key);
    assert.equal(report.summary.averageQuiz, 0); assert.equal(report.summary.assignmentAverage, 0);
    assert.equal(report.assignments.length, 1); assert.equal(report.assignments[0].archived, true);
    assert.equal(report.assignments[0].title, 'Archived Word Task'); assert.equal(report.assignments[0].marks, 0);
    const empty = await account('EMPTY', 4, 'A', 'No Results');
    const blank = await studentReport(`student:${empty._id}`);
    assert.equal(blank.summary.averageQuiz, null); assert.equal(blank.summary.bestQuiz, null); assert.equal(blank.summary.assignmentAverage, null);
});
test('PDF export includes full paginated history, safe filenames, headers and no invented timing', async () => {
    const student = await account('PDF-001', 5, 'A', 'Report Sample Student');
    student.fatherName = 'Report Sample Father'; await student.save();
    await models.Result.insertMany(Array.from({ length: 48 }, (_, i) => ({ student: student._id, name: student.name, rollNum: student.rollNum,
        grade: 5, section: 'A', score: i % 26, total: 25, date: new Date(Date.UTC(2026, 7, 1 + i)) })));
    const response = await request(`/student:${student._id}/pdf`); assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf'); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(response.headers.get('content-disposition').includes('QuizBoard-PDF-001-report.pdf'));
    const buffer = Buffer.from(await response.arrayBuffer()); assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    const { PDFParse } = require('pdf-parse'); const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
        const info = await parser.getInfo(), text = (await parser.getText()).text;
        assert.ok(info.total >= 2); assert.ok(text.includes('Report Sample Student')); assert.ok(text.includes('01 Aug 2026'));
        assert.match(text, /17 Sept? 2026/); assert.ok(text.includes('Assignment History'));
        assert.ok(text.includes('Report Sample Father')); assert.ok(!text.includes('private-unused-test-hash'));
        assert.ok(!text.includes('Missing historic')); assert.ok(!text.includes('Averages use'));
    } finally { await parser.destroy(); }
    const target = path.resolve(__dirname, '../../tmp/pdfs/student-report-qa.pdf'); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, buffer);
});
