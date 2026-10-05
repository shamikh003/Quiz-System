const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('node:fs');
const path = require('node:path');
const models = require('../models/models');
const { pakistanDay, gradeAttempt, validateAnswers } = require('../quiz-policy');
const { sourceHash, cachedUrdu, createTranslationQueue, TranslationError } = require('../services/translation');
let database, server, base, adminToken, studentToken, otherToken, studentId, attemptId;
const request = async (path, token, body, method) => {
    const response = await fetch(base + path, { method: method || (body ? 'POST' : 'GET'),
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
};
before(async () => {
    process.env.JWT_SECRET = 'isolated-test-secret-not-used-outside-tests';
    const binary = path.join(__dirname, '../.mongodb-binaries/mongod.exe');
    database = await MongoMemoryServer.create(fs.existsSync(binary) ? { binary: { systemBinary: binary } } : {});
    await mongoose.connect(database.getUri());
    await Promise.all(Object.values(models).map(model => model.init()));
    const app = express(); app.use(express.json());
    for (const name of ['students', 'attempts', 'questions', 'results', 'dashboard', 'assignments']) app.use('/api', require(`../routes/${name}`));
    app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
    adminToken = jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'admin' }, process.env.JWT_SECRET);
}, { timeout: 180000 });
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (database) await database.stop(); });

const translationFixture = question => ({ sourceHash: sourceHash(question), text: 'کمپیوٹر کے لیے کون سا آلہ استعمال ہوتا ہے؟',
    options: question.options.map((option,index) => ({id:option.id,text:['کی بورڈ','مانیٹر','اسپیکر'][index]})),
    model:'test-fixture',translatedAt:new Date() });
async function eventually(check) {
    for (let i = 0; i < 100; i++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve,10)); }
    assert.fail('Timed out waiting for translation worker');
}

test('background translation persists once, old questions can be queued, and stale edits/deletes cannot overwrite content', async () => {
    const make = text => models.Question.create({grade:7,text,correct:'A',options:[{id:'A',text:'Keyboard'},{id:'B',text:'Monitor'},{id:'C',text:'Speaker'}]});
    const first = await make('Original?'), removed = await make('Removed?');
    const ids = [first._id,removed._id];
    let release, calls = 0;
    const queue = createTranslationQueue({ Question:models.Question, enabled:() => true, delayMs:() => 0,
        translate:async question => { calls++; if (calls === 1) await new Promise(resolve => { release = resolve; }); return translationFixture(question); } });
    try {
        assert.equal(await queue.enqueue(first),true);
        await eventually(() => !!release);
        assert.equal((await models.Question.findById(first._id)).translationStatus,'pending');
        const edited = await models.Question.findByIdAndUpdate(first._id,{$set:{text:'Edited?',translationSourceHash:'changed'},$unset:{urdu:1}},{new:true});
        await queue.enqueue(edited);
        await queue.enqueue(removed);
        await models.Question.deleteOne({_id:removed._id});
        release();
        await eventually(async () => !!cachedUrdu(await models.Question.findById(first._id)));
        const saved = await models.Question.findById(first._id);
        assert.equal(saved.text,'Edited?'); assert.equal(saved.urdu.sourceHash,sourceHash(saved));
        assert.equal(await queue.enqueue(saved),false); assert.equal(calls,2);
        assert.equal(await models.Question.findById(removed._id),null);
        assert.equal((await request('/admin/questions/translate-urdu',null,{})).status,401);
        // No configured key: existing English questions remain usable.
        assert.equal((await request('/admin/questions/translate-urdu',adminToken,{})).status,503);
    } finally { release?.(); await models.Question.deleteMany({_id:{$in:ids}}); }
});

test('quota errors pause remaining jobs; teacher retry resumes saved translations', async () => {
    const questions = await models.Question.insertMany(['First','Second'].map(text => ({grade:7,text,correct:'A',
        options:[{id:'A',text:'Keyboard'},{id:'B',text:'Monitor'},{id:'C',text:'Speaker'}]})));
    let release, blocked = true, calls = 0;
    const queue = createTranslationQueue({Question:models.Question,enabled:() => true,delayMs:() => 0,
        translate:async question => {calls++; if (blocked) {await new Promise(resolve => {release=resolve;}); throw new TranslationError('quota_exceeded');} return translationFixture(question);} });
    try {
        await queue.enqueue(questions[0]); await eventually(() => !!release); await queue.enqueue(questions[1]); release();
        await eventually(async () => (await models.Question.findById(questions[0]._id)).translationStatus === 'failed');
        assert.equal(calls,1); assert.equal((await models.Question.findById(questions[1]._id)).translationStatus,'pending');
        blocked = false;
        await queue.enqueue(await models.Question.findById(questions[0]._id),{retry:true});
        await eventually(async () => (await models.Question.countDocuments({_id:{$in:questions.map(q=>q._id)},translationStatus:'ready'})) === 2);
        assert.equal(calls,3);
    } finally {release?.(); await models.Question.deleteMany({_id:{$in:questions.map(q=>q._id)}});}
});

test('student start and completion return cached Urdu without answer keys or altering marks/deadline', async () => {
    const student = await models.Student.create({name:'Translation test',rollNum:'URDU-7',grade:7,passwordHash:'unused'});
    const token = jwt.sign({id:student._id,role:'student',version:0},process.env.JWT_SECRET);
    const question = await models.Question.create({grade:7,text:'Device?',correct:'A',options:[{id:'A',text:'Keyboard'},{id:'B',text:'Monitor'},{id:'C',text:'Speaker'}]});
    await models.Question.updateOne({_id:question._id},{$set:{urdu:translationFixture(question),translationStatus:'ready'}});
    try {
        const started = await request('/quiz/start',token,{});
        assert.equal(started.status,200);
        const view = started.data.questions.find(q=>q._id===String(question._id));
        assert.ok(view.urdu.text.includes('کمپیوٹر')); assert.equal(view.correct,undefined);
        assert.equal(view.urdu.model,undefined); assert.equal(view.urdu.sourceHash,undefined);
        const resumed = (await request('/quiz/start',token,{})).data;
        assert.ok(Number.isFinite(new Date(started.data.startedAt).getTime()));
        assert.equal(resumed.startedAt,started.data.startedAt);
        assert.equal(resumed.expiresAt,started.data.expiresAt);
        assert.equal((await request('/quiz/save',token,{attemptId:started.data.attemptId,revision:0,answers:[{questionId:question._id,selected:'A'}]})).status,200);
        const result = await request('/quiz/submit',token,{attemptId:started.data.attemptId});
        assert.equal(result.data.score,1); assert.equal(result.data.total,started.data.questions.length);
        assert.ok(result.data.details[0].urdu); assert.equal(result.data.details[0].correct,undefined);
    } finally {
        await models.Attempt.deleteMany({student:student._id}); await models.Result.deleteMany({student:student._id});
        await models.Question.deleteOne({_id:question._id}); await models.Student.deleteOne({_id:student._id});
    }
});

test('dashboard ranks top five percentages across all grades and sections, not recent results', async () => {
    const rows = [
        { name: 'Perfect A', grade: 4, section: 'A', score: 10, total: 10, elapsedMs: 600000, timeLimitMs: 900000 },
        { name: 'Perfect B', grade: 4, section: 'A', score: 20, total: 20, elapsedMs: 700000, timeLimitMs: 900000 },
        { name: 'Hifz', grade: 0, section: 'B', score: 19, total: 20, elapsedMs: 1, timeLimitMs: 900000, rankingPercentage: 999 },
        { name: 'Other section', grade: 4, section: 'B', score: 9, total: 10 },
        { name: 'Other grade', grade: 7, section: 'A', score: 25, total: 30 },
        { name: 'Recent lower', grade: 6, section: 'C', score: 20, total: 30 },
        { name: 'No total', grade: 4, score: 0, total: 0 }
    ].map((row, i) => ({ ...row, rollNum: `TOP-${i}`, date: new Date(2025, 0, i + 1) }));
    const inserted = await models.Result.insertMany(rows);
    try {
        assert.equal((await request('/admin/dashboard', null)).status, 401);
        const response = await request('/admin/dashboard', adminToken);
        assert.equal(response.status, 200);
        assert.deepEqual(response.data.topResults.map(r => r.name), ['Perfect A', 'Perfect B', 'Hifz', 'Other section', 'Other grade']);
        assert.equal(response.data.topResults[2].percentage, 95);
        assert.equal(response.data.topResults[3].section, 'B');
        assert.ok(response.data.topResults.every(r => !Object.hasOwn(r, 'details')));
        const reports = await request('/results', adminToken);
        assert.deepEqual(response.data.topResults.map(r => r._id), reports.data.slice(0, 5).map(r => r._id));
        assert.equal(response.data.topResults[0].rankingPercentage, 100);
    } finally { await models.Result.deleteMany({ _id: { $in: inserted.map(r => r._id) } }); }
});

test('server timing persists once, survives retries and ranks identically in every report', async () => {
    const { finalizeAttempt } = require('../services/attempts');
    const ids = [];
    const student = await models.Student.create({ name: 'Timing test', rollNum: 'TIME-1', grade: 4, section: 'A', passwordHash: 'unused' });
    const studentJwt = jwt.sign({ id: student._id, role: 'student', version: 0 }, process.env.JWT_SECRET);
    const createAttempt = async (day, elapsed, duration, extra = {}) => {
        const startedAt = new Date(Date.now() - elapsed);
        const questionId = new mongoose.Types.ObjectId();
        const attempt = await models.Attempt.create({ student: student._id, day, startedAt, expiresAt: new Date(startedAt.getTime() + duration),
            questions: [{ questionId, correct: 'A', options: ['A', 'B', 'C'] }], answers: [{ questionId, selected: 'A' }], ...extra });
        ids.push(attempt._id); return attempt;
    };
    try {
        const slow = await createAttempt('timing-slow', 180000, 600000);
        const slowResult = await finalizeAttempt(slow, student);
        const fast = await createAttempt('timing-fast', 60000, 600000);
        const responses = await Promise.all(Array.from({ length: 3 }, () => request('/quiz/submit', studentJwt,
            { attemptId: String(fast._id), elapsedMs: 0, timeLimitMs: 99999999, rankingPercentage: 100 })));
        for (const response of responses) {
            assert.equal(response.status, 200);
            assert.ok(response.data.elapsedMs >= 60000 && response.data.elapsedMs < 90000);
            assert.equal(response.data.rankingPercentage, 100);
            assert.equal(response.data.elapsedMs, responses[0].data.elapsedMs);
        }
        const saved = await models.Result.findOne({ attempt: fast._id });
        assert.equal(saved.rankingPercentage, slowResult.rankingPercentage);
        assert.equal(saved.timeLimitMs, 600000); assert.ok(saved.completedAt);
        assert.equal((await finalizeAttempt(fast, student)).elapsedMs, saved.elapsedMs);
        const expired = await createAttempt('timing-expired', 700000, 600000);
        const timedOut = await finalizeAttempt(expired, student);
        assert.equal(timedOut.elapsedMs, 600000); assert.equal(timedOut.speedBonus, 0);
        const old = await createAttempt('timing-old-sealed', 700000, 600000, { status: 'submitted' });
        const legacy = await finalizeAttempt(old, student);
        assert.equal(legacy.elapsedMs, undefined); assert.equal(legacy.speedBonus, 0);
        const dashboard = (await request('/admin/dashboard', adminToken)).data;
        const reports = (await request('/results', adminToken)).data;
        assert.deepEqual(dashboard.topResults.map(r => r._id), reports.slice(0, 5).map(r => r._id));
        assert.equal(reports[0]._id, String(saved._id));
        assert.equal(reports[0].elapsedMs, saved.elapsedMs);
        const filtered = (await request('/results?grade=4&section=A', adminToken)).data;
        assert.deepEqual(filtered.map(r => r._id), reports.map(r => r._id));
        const own = (await request('/student/report', studentJwt)).data.results.find(r => r._id === String(saved._id));
        assert.equal(own.rankingPercentage, reports[0].rankingPercentage);
        assert.equal(own.elapsedMs, saved.elapsedMs);
    } finally {
        await models.Attempt.deleteMany({ _id: { $in: ids } });
        await models.Result.deleteMany({ student: student._id });
        await models.Student.deleteOne({ _id: student._id });
    }
});

test('bulk clear requires a grade and preserves other grades, reports and active quizzes', async () => {
    const make = grade => models.Question.create({ grade, text: 'Bulk deletion fixture', correct: 'A',
        options: [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }, { id: 'C', text: 'Three' }] });
    const hifz = await make(0), four = await make(4), seven = await make(7);
    const lock = await models.Attempt.create({ student: new mongoose.Types.ObjectId(), day: '2026-01-01',
        expiresAt: new Date(Date.now() + 60000), questions: [{ questionId: seven._id, correct: 'A', options: ['A', 'B', 'C'] }] });
    const result = await models.Result.create({ name: 'Preserved report', rollNum: 'BULK', grade: 0, score: 1, total: 1 });
    const ids = [hifz._id, four._id, seven._id];
    try {
        assert.equal((await request('/admin/questions?grade=4', null, undefined, 'DELETE')).status, 401);
        for (const query of ['', '?grade=', '?grade=99', '?grade=all', '?grade=4&grade=5']) {
            assert.equal((await request('/admin/questions' + query, adminToken, undefined, 'DELETE')).status, 400);
        }
        assert.equal(await models.Question.countDocuments({ _id: { $in: ids } }), 3);
        const cleared = await request('/admin/questions?grade=0', adminToken, undefined, 'DELETE');
        assert.equal(cleared.status, 200); assert.equal(cleared.data.deletedCount, 1);
        assert.equal(await models.Question.findById(hifz._id), null);
        assert.ok(await models.Question.exists({ _id: four._id }));
        assert.ok(await models.Result.exists({ _id: result._id }));
        assert.equal((await request('/admin/questions?grade=7', adminToken, undefined, 'DELETE')).status, 409);
        assert.ok(await models.Question.exists({ _id: seven._id }));
        assert.equal((await request('/admin/questions?grade=4', adminToken, undefined, 'DELETE')).data.deletedCount, 1);
        assert.equal((await request('/admin/questions?grade=4', adminToken, undefined, 'DELETE')).data.deletedCount, 0);
        await models.Attempt.updateOne({ _id: lock._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
        assert.equal((await request('/admin/questions?grade=7', adminToken, undefined, 'DELETE')).data.deletedCount, 1);
    } finally {
        await models.Question.deleteMany({ _id: { $in: ids } });
        await models.Attempt.deleteOne({ _id: lock._id });
        await models.Result.deleteOne({ _id: result._id });
    }
});

test('Pakistan calendar and full-question marking', () => {
    assert.equal(pakistanDay(new Date('2026-09-28T18:59:59Z')), '2026-09-28');
    assert.equal(pakistanDay(new Date('2026-09-28T19:00:00Z')), '2026-09-29');
    const questions = [{ questionId: '1', correct: 'A', options: ['A', 'B'] }, { questionId: '2', correct: 'B', options: ['A', 'B'] }];
    assert.deepEqual(gradeAttempt({ questions, answers: [{ questionId: '1', selected: 'A' }] }), { score: 1, total: 2 });
    assert.throws(() => validateAnswers(questions, [{ questionId: '1', selected: 'A' }, { questionId: '1', selected: 'A' }]));
    assert.throws(() => validateAnswers(questions, [{ questionId: '3', selected: 'A' }]));
    assert.throws(() => validateAnswers(questions, [{ questionId: '1', selected: 'X' }]));
});

test('section migration preserves records and replaces retired indexes', async () => {
    const { migrateSections } = require('../services/sections');
    await models.Student.collection.createIndex({ rollNum: 1, grade: 1 }, { unique: true });
    await models.Submission.collection.createIndex({ assignment: 1, rollNum: 1 }, { unique: true });
    const id = new mongoose.Types.ObjectId();
    await models.Student.collection.insertOne({ _id: id, name: 'Legacy', rollNum: 'LEGACY', grade: 7, passwordHash: 'unused' });
    await models.Result.collection.insertOne({ name: 'Legacy', rollNum: 'LEGACY', grade: 7, score: 2, total: 3 });
    await migrateSections(); await migrateSections();
    assert.equal((await models.Student.findById(id)).section, 'Unassigned');
    assert.equal(String((await models.Result.findOne({ rollNum: 'LEGACY' })).student), String(id));
    assert.ok(!(await models.Student.collection.indexes()).some(i => i.name === 'rollNum_1_grade_1'));
    assert.ok(!(await models.Submission.collection.indexes()).some(i => i.name === 'assignment_1_rollNum_1'));
});

test('same roll in different sections keeps reports, assignment marks and daily locks separate', async () => {
    const body = { name: 'Section Student', rollNum: 'SEC-01', grade: 5, password: 'sample123', section: 'Section A' };
    const a = await request('/admin/students', adminToken, body);
    const b = await request('/admin/students', adminToken, { ...body, section: 'Section B', password: 'sample456' });
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    assert.equal((await request('/admin/students', adminToken, { ...body, section: ' section   a ' })).status, 409);
    assert.equal((await request('/admin/students', adminToken, { ...body, section: {} })).status, 400);
    const tokenA = (await request('/student/login', null, { ...body, section: ' section a ' })).data.token;
    const tokenB = (await request('/student/login', null, { ...body, password: 'sample456', section: 'Section B' })).data.token;
    assert.ok(tokenA); assert.ok(tokenB);
    const autoSection = await request('/student/login', null, { ...body, section: '' });
    assert.equal(autoSection.status, 200); assert.equal(autoSection.data.student.section, 'Section A');
    await models.Result.create({ student: a.data.id, name: body.name, rollNum: body.rollNum, grade: 5, section: 'Section A', score: 1, total: 1 });
    await models.Question.create({ grade: 5, text: 'Input device?', options: [{ id: 'A', text: 'Keyboard' }, { id: 'B', text: 'Monitor' }, { id: 'C', text: 'Printer' }], correct: 'A' });
    assert.equal((await request('/quiz/start', tokenA, {})).status, 409);
    assert.equal((await request('/quiz/start', tokenB, {})).status, 200);
    const assignment = await models.Assignment.create({ title: 'Sections', grade: 5, maxMarks: 10, fileName: 'task.docx', fileUrl: 'https://example.invalid/task', filePath: 'test' });
    for (const [account, section, marks] of [[a, 'Section A', 8], [b, 'Section B', 3]]) {
        await models.Submission.create({ assignment: assignment._id, student: account.data.id, name: body.name, rollNum: body.rollNum, grade: 5, section, fileName: 'done.docx', fileUrl: 'https://example.invalid/done', filePath: 'test', marks, percentage: marks * 10, status: 'graded' });
    }
    const reportA = (await request('/student/report', tokenA)).data;
    const reportB = (await request('/student/report', tokenB)).data;
    assert.equal(reportA.results.length, 1); assert.equal(reportB.results.length, 0);
    assert.equal(reportA.assignments[0].submission.marks, 8); assert.equal(reportB.assignments[0].submission.marks, 3);
    const filtered = await request('/results?grade=5&section=Section%20A&rollNum=SEC-01', adminToken);
    assert.equal(filtered.data.length, 1); assert.equal(filtered.data[0].assignmentPercentage, 80);
    assert.equal((await request('/results?grade=5&section=Section%20B', adminToken)).data.length, 0);
    assert.equal((await request(`/admin/students/${a.data.id}/section`, adminToken, { section: 'Section B' })).status, 409);
    assert.equal((await request(`/admin/students/${a.data.id}/section`, adminToken, { section: 'Final Name' })).status, 200);
    assert.equal((await models.Result.findOne({ student: a.data.id })).section, 'Final Name');
    assert.equal((await models.Submission.findOne({ student: a.data.id })).section, 'Final Name');
    assert.equal((await request('/student/report', tokenA)).data.results.length, 1);
    assert.equal((await request('/quiz/start', tokenA, {})).status, 409);
    await models.Attempt.deleteMany({ student: { $in: [a.data.id, b.data.id] } });
});

test('student accounts, private reports and daily attempts', async t => {
    await t.test('teacher creates Hifz account; duplicate account and blank grade rejected', async () => {
        const body = { name: 'Hifz Student', rollNum: 'H-01', grade: 0, password: 'sample123' };
        const created = await request('/admin/students', adminToken, body);
        assert.equal(created.status, 201); assert.equal(created.data.grade, 0); studentId = created.data.id;
        assert.equal((await request('/admin/students', adminToken, body)).status, 409);
        assert.equal((await request('/admin/students', adminToken, { ...body, grade: '' })).status, 400);
        assert.equal((await request('/admin/students', null, body)).status, 401);
        await request('/admin/students', adminToken, { ...body, rollNum: 'H-02', name: 'Other Student' });
    });
    await t.test('login rejects wrong password and student tokens cannot access teacher routes', async () => {
        const login = { rollNum: 'H-01', grade: '0', password: 'sample123' };
        assert.equal((await request('/student/login', null, { ...login, password: 'incorrect' })).status, 401);
        const loggedIn = await request('/student/login', null, login); assert.equal(loggedIn.status, 200); studentToken = loggedIn.data.token;
        otherToken = (await request('/student/login', null, { ...login, rollNum: 'H-02' })).data.token;
        assert.equal((await request('/admin/students', studentToken)).status, 403);
        assert.equal((await request('/results', studentToken)).status, 403);
        assert.equal((await request('/student/report', null)).status, 401);
        assert.equal((await request('/quiz/start', null, {})).status, 401);
    });
    await t.test('Hifz questions; concurrent starts produce one attempt; answer keys stay private', async () => {
        for (const text of ['Keyboard', 'Monitor', 'Mouse']) {
            const response = await request('/admin/questions', adminToken, { text, grade: 0, options: [{ id: 'A', text: 'Input' }, { id: 'B', text: 'Output' }, { id: 'C', text: 'Storage' }], correct: 'A' });
            assert.equal(response.status, 201);
        }
        const starts = await Promise.all(Array.from({ length: 5 }, () => request('/quiz/start', studentToken, {})));
        for (const start of starts) assert.equal(start.status, 200);
        attemptId = starts[0].data.attemptId;
        assert.equal(new Set(starts.map(s => s.data.attemptId)).size, 1);
        assert.equal(await models.Attempt.countDocuments(), 1);
        assert.equal(starts[0].data.questions.length, 3);
        assert.ok(starts[0].data.questions.every(q => q.correct === undefined));
        assert.equal((await request('/quiz/submit', otherToken, { attemptId })).status, 404);
        assert.equal((await request('/admin/questions/' + starts[0].data.questions[0]._id, adminToken, undefined, 'DELETE')).status, 409);
    });
    await t.test('saved answers resume; invalid, duplicate and stale saves rejected', async () => {
        const start = (await request('/quiz/start', studentToken, {})).data;
        const answer = { questionId: start.questions[0]._id, selected: 'A' };
        assert.equal((await request('/quiz/save', studentToken, { attemptId, revision: 0, answers: [answer, answer] })).status, 400);
        assert.equal((await request('/quiz/save', studentToken, { attemptId, revision: 0, answers: [{ ...answer, selected: 'X' }] })).status, 400);
        assert.equal((await request('/quiz/save', studentToken, { attemptId, revision: 0, answers: [answer] })).status, 200);
        assert.equal((await request('/quiz/save', studentToken, { attemptId, revision: 0, answers: [] })).status, 409);
        const resumed = (await request('/quiz/start', studentToken, {})).data;
        assert.equal(resumed.expiresAt, start.expiresAt); assert.equal(resumed.answers.length, 1);
    });
    await t.test('concurrent submissions create one result with full denominator; restart blocked', async () => {
        const submissions = await Promise.all(Array.from({ length: 5 }, () => request('/quiz/submit', studentToken, { attemptId, name: 'Impersonation', score: 999 })));
        for (const submitted of submissions) { assert.equal(submitted.status, 200); assert.equal(submitted.data.score, 1); assert.equal(submitted.data.total, 3); }
        assert.equal(await models.Result.countDocuments({ attempt: attemptId }), 1);
        const result = await models.Result.findOne({ attempt: attemptId }); assert.equal(result.name, 'Hifz Student'); assert.equal(result.details.length, 0);
        assert.equal((await request('/quiz/start', studentToken, {})).status, 409);
        assert.ok((await models.Attempt.findById(attemptId)).purgeAt);
    });
    await t.test('private report includes legacy scores and assignment marks, ignoring query spoofing', async () => {
        await models.Result.create({ name: 'Old name', rollNum: 'H-01', grade: 0, score: 8, total: 10, date: new Date('2025-01-01') });
        const assignment = await models.Assignment.create({ title: 'Word task', grade: 0, maxMarks: 50, fileName: 'task.docx', fileUrl: 'https://example.invalid/task', filePath: 'test' });
        await models.Submission.create({ assignment: assignment._id, name: 'Hifz Student', rollNum: 'H-01', grade: 0, fileName: 'done.docx', fileUrl: 'https://example.invalid/done', filePath: 'test', marks: 40, percentage: 80, status: 'graded' });
        const report = (await request('/student/report?rollNum=H-02&grade=4', studentToken)).data;
        assert.equal(report.student.rollNum, 'H-01'); assert.equal(report.results.length, 2); assert.equal(report.assignments[0].submission.marks, 40);
        const other = (await request('/student/report', otherToken)).data; assert.equal(other.results.length, 0); assert.equal(other.assignments[0].submission, null);
    });
    await t.test('expired quiz cannot accept new answers; zero-answer result counts all questions', async () => {
        const start = (await request('/quiz/start', otherToken, {})).data;
        await models.Attempt.updateOne({ _id: start.attemptId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
        const save = await request('/quiz/save', otherToken, { attemptId: start.attemptId, revision: 0, answers: [{ questionId: start.questions[0]._id, selected: 'A' }] });
        assert.equal(save.status, 409); assert.equal(save.data.result.score, 0); assert.equal(save.data.result.total, 3);
    });
    await t.test('teacher password reset revokes previous student session', async () => {
        assert.equal((await request(`/admin/students/${studentId}/password`, adminToken, { password: 'newpass123' })).status, 200);
        assert.equal((await request('/student/report', studentToken)).status, 401);
        assert.equal((await request('/student/login', null, { rollNum: 'H-01', grade: 0, password: 'newpass123' })).status, 200);
    });
    await t.test('new login cannot bypass completed attempt and old daily history blocks new accounts', async () => {
        const relogin = await request('/student/login', null, { rollNum: 'H-01', grade: 0, password: 'newpass123' });
        assert.equal((await request('/quiz/start', relogin.data.token, {})).status, 409);
        await request('/admin/students', adminToken, { name: 'Grade Four', rollNum: '4-01', grade: 4, password: 'sample123' });
        await models.Result.create({ name: 'Grade Four', rollNum: '4-01', grade: 4, score: 1, total: 3 });
        const login = await request('/student/login', null, { rollNum: '4-01', grade: 4, password: 'sample123' });
        assert.equal((await request('/quiz/start', login.data.token, {})).status, 409);
        const assignment = await models.Assignment.findOne({ grade: 0 });
        assert.equal((await request(`/assignments/${assignment._id}/download`, login.data.token)).status, 403);
    });
    await t.test('new Pakistan day permits a fresh attempt and old permanent scores remain', async () => {
        const previousDay = pakistanDay(new Date(Date.now() - 86400000));
        const other = await models.Student.findOne({ rollNum: 'H-02' });
        await models.Attempt.updateMany({ student: other._id }, { $set: { day: previousDay } });
        await models.Result.updateMany({ student: other._id }, { $set: { date: new Date(Date.now() - 86400000) } });
        assert.equal((await request('/quiz/start', otherToken, {})).status, 200);
        assert.equal(await models.Result.countDocuments({ student: other._id }), 1);
    });
    await t.test('clearing results does not reopen the same-day attempt or restore deleted reports', async () => {
        const relogin = await request('/student/login', null, { rollNum: 'H-01', grade: 0, password: 'newpass123' });
        assert.equal((await request('/results', adminToken, undefined, 'DELETE')).status, 200);
        assert.equal((await request('/quiz/start', relogin.data.token, {})).status, 409);
        assert.equal((await request('/student/report', relogin.data.token)).data.results.length, 0);
        assert.equal(await models.Result.countDocuments({ student: studentId }), 0);
    });
});
