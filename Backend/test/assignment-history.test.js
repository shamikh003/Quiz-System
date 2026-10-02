const { test, before, beforeEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('node:fs');
const path = require('node:path');
const models = require('../models/models');
let database, server, base, teacherToken, uploadHandler;
const deletedFiles = [];
const request = async (url, token, body, method) => {
    const response = await fetch(base + url, { method: method || (body ? 'POST' : 'GET'),
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
};
before(async () => {
    process.env.JWT_SECRET = 'isolated-assignment-history-test-secret';
    // These routes must never contact production file storage during tests.
    const storage = require('../cloudinary');
    mock.method(storage, 'deleteFile', async id => { if (id) deletedFiles.push(id); });
    mock.method(storage, 'uploadBuffer', (...args) => uploadHandler(...args));
    const binary = path.join(__dirname, '../.mongodb-binaries/mongod.exe');
    database = await MongoMemoryServer.create(fs.existsSync(binary) ? { binary: { systemBinary: binary } } : {});
    await mongoose.connect(database.getUri());
    await Promise.all(Object.values(models).map(model => model.init()));
    const app = express(); app.use(express.json());
    for (const name of ['assignments', 'students', 'results', 'dashboard']) app.use('/api', require(`../routes/${name}`));
    app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
    teacherToken = jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'admin' }, process.env.JWT_SECRET);
}, { timeout: 180000 });
beforeEach(async () => {
    await Promise.all(Object.values(models).map(model => model.deleteMany({})));
    deletedFiles.length = 0;
    uploadHandler = async () => ({ secure_url: 'https://example.invalid/new-submission', public_id: 'test/new-submission' });
});
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); if (database) await database.stop(); mock.restoreAll();
});
async function student(rollNum, section = 'A', grade = 4) {
    const record = await models.Student.create({ name: `Student ${rollNum}`, rollNum, section, grade, passwordHash: 'unused' });
    return { record, token: jwt.sign({ id: record._id, role: 'student', version: 0 }, process.env.JWT_SECRET) };
}
async function assignment(title, grade = 4) {
    return models.Assignment.create({ title, grade, maxMarks: 20, fileName: `${title}.docx`, fileUrl: 'https://example.invalid/task', filePath: `test/${title}` });
}
async function submission(task, pupil, status = 'pending') {
    return models.Submission.create({ student: pupil.record._id, assignment: task._id, name: pupil.record.name,
        rollNum: pupil.record.rollNum, grade: pupil.record.grade, section: pupil.record.section,
        fileName: 'answer.docx', fileUrl: 'https://example.invalid/answer', filePath: `test/answer-${pupil.record.rollNum}-${task._id}`, status,
        ...(status === 'graded' ? { marks: 0, percentage: 0, gradedAt: new Date() } : {}) });
}

test('deleting a graded assignment preserves student history and filtered teacher reports while removing files', async () => {
    const pupil = await student('401');
    const task = await assignment('Computer practice');
    const answer = await submission(task, pupil);
    await models.Result.create({ student: pupil.record._id, name: pupil.record.name, rollNum: '401', grade: 4, section: 'A', score: 8, total: 10 });
    assert.equal((await request(`/admin/submissions/${answer._id}/marks`, teacherToken, { marks: 18 })).status, 200);
    assert.equal((await request('/student/report', pupil.token)).data.assignments[0].submission.percentage, 90);
    assert.equal((await request(`/admin/assignments/${task._id}`, pupil.token, undefined, 'DELETE')).status, 403);
    const removed = await request(`/admin/assignments/${task._id}`, teacherToken, undefined, 'DELETE');
    assert.equal(removed.status, 200);
    const history = (await request('/student/report', pupil.token)).data.assignments;
    assert.equal(history.length, 1); assert.equal(history[0].title, 'Computer practice');
    assert.equal(history[0].maxMarks, 20); assert.ok(history[0].deletedAt);
    assert.equal(history[0].submission.marks, 18); assert.equal(history[0].submission.percentage, 90);
    const teacherReport = await request('/results?grade=4&section=A&rollNum=401', teacherToken);
    assert.equal(teacherReport.data[0].assignmentPercentage, 90);
    const stored = await models.Submission.findById(answer._id);
    assert.ok(stored.assignmentDeletedAt); assert.equal(stored.fileUrl, undefined); assert.equal(stored.filePath, undefined);
    await stored.validate();
    const archived = await models.Assignment.findById(task._id);
    assert.equal(archived.fileUrl, undefined); assert.equal(archived.filePath, undefined); await archived.validate();
    assert.deepEqual(new Set(deletedFiles), new Set([answer.filePath, task.filePath]));
    assert.deepEqual((await request('/admin/assignments', teacherToken)).data, []);
    assert.deepEqual((await request('/assignments', pupil.token)).data, []);
    assert.equal((await request(`/assignments/${task._id}/download`, pupil.token)).status, 410);
    assert.equal((await request(`/admin/submissions/${answer._id}/download`, teacherToken)).status, 410);
    assert.equal((await request(`/admin/submissions/${answer._id}/marks`, teacherToken, { marks: 20 })).status, 410);
    assert.equal((await request(`/admin/assignments/${task._id}`, teacherToken, undefined, 'DELETE')).status, 200);
    assert.equal((await models.Submission.findById(answer._id)).marks, 18);
    const form = new FormData(); form.append('file', new Blob(['demo']), 'answer.docx');
    const resubmit = await fetch(`${base}/assignments/${task._id}/submit`, { method: 'POST', headers: { Authorization: `Bearer ${pupil.token}` }, body: form });
    assert.equal(resubmit.status, 410);
});

test('deleted assignments hide ungraded work, preserve zero marks and leave other assignments and sections unchanged', async () => {
    const a = await student('402', 'A', 0), b = await student('402', 'B', 0);
    const oldTask = await assignment('Hifz task', 0), liveTask = await assignment('Next task', 0);
    const zero = await submission(oldTask, a, 'graded');
    const pending = await submission(oldTask, b);
    const unaffected = await submission(liveTask, b);
    await request(`/admin/assignments/${oldTask._id}`, teacherToken, undefined, 'DELETE');
    const reportA = (await request('/student/report', a.token)).data.assignments;
    const reportB = (await request('/student/report', b.token)).data.assignments;
    assert.equal(reportA.length, 2); assert.equal(reportA.find(x => x.deletedAt).submission.marks, 0);
    assert.equal(reportB.length, 1); assert.equal(reportB[0].title, 'Next task'); assert.equal(reportB[0].submission.percentage, null);
    assert.ok(await models.Submission.findById(zero._id)); assert.equal(await models.Submission.findById(pending._id), null);
    assert.equal((await models.Submission.findById(unaffected._id)).fileUrl, unaffected.fileUrl);
    const dashboard = (await request('/admin/dashboard', teacherToken)).data;
    assert.equal(dashboard.totalAssignments, 1); assert.equal(dashboard.pendingSubmissions, 1);
});

test('a grading request racing with deletion cannot remove an earned score', async () => {
    const pupil = await student('403'), task = await assignment('Timing task');
    const answer = await submission(task, pupil);
    await request(`/admin/submissions/${answer._id}/marks`, teacherToken, { marks: 18 });
    const [grade, deletion] = await Promise.all([
        request(`/admin/submissions/${answer._id}/marks`, teacherToken, { marks: 19 }),
        request(`/admin/assignments/${task._id}`, teacherToken, undefined, 'DELETE')
    ]);
    assert.equal(deletion.status, 200); assert.ok([200, 410].includes(grade.status));
    const history = (await request('/student/report', pupil.token)).data.assignments[0];
    assert.equal(history.submission.marks, grade.status === 200 ? 19 : 18); assert.equal(history.submission.status, 'graded');
});

test('deletion during a file upload rejects the upload and cleans its new file', async () => {
    const pupil = await student('404'), task = await assignment('Upload race');
    let start, finish;
    const started = new Promise(resolve => { start = resolve; });
    const release = new Promise(resolve => { finish = resolve; });
    uploadHandler = async () => { start(); await release; return { secure_url: 'https://example.invalid/late', public_id: 'test/late-upload' }; };
    const form = new FormData(); form.append('file', new Blob(['demo']), 'answer.docx');
    const uploading = fetch(`${base}/assignments/${task._id}/submit`, { method: 'POST', headers: { Authorization: `Bearer ${pupil.token}` }, body: form });
    await started;
    try { assert.equal((await request(`/admin/assignments/${task._id}`, teacherToken, undefined, 'DELETE')).status, 200); }
    finally { finish(); }
    assert.equal((await uploading).status, 410);
    assert.equal(await models.Submission.countDocuments({ assignment: task._id }), 0);
    assert.ok(deletedFiles.includes('test/late-upload'));
});
