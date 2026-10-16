const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Excel = require('exceljs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const models = require('../models/models');
const Batch = require('../models/import-batch');
const imports = require('../services/bulk-import');
const { parseQuestionText, parseStudentRows, gradeValue } = require('../services/import-parser');
const sample = fs.readFileSync(path.join(__dirname, 'fixtures/import-questions.txt'), 'utf8');
const docx = fs.readFileSync(path.join(__dirname, '../../frontend/admin/samples/QuizBoard-questions-template.docx'));
let database, server, base, admin, secondAdmin, student;
before(async () => {
    process.env.JWT_SECRET = 'bulk-import-isolated-test-secret';
    delete process.env.GEMINI_API_KEY;
    const binary = path.join(__dirname, '../.mongodb-binaries/mongod.exe');
    database = await MongoMemoryServer.create(fs.existsSync(binary) ? { binary: { systemBinary: binary } } : {});
    await mongoose.connect(database.getUri());
    await Promise.all([...Object.values(models), Batch].map(m => m.init()));
    const app = express(); app.use(express.json());
    app.use('/api', require('../routes/imports')); app.use('/api', require('../routes/students'));
    app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
    admin = jwt.sign({ id: 'teacher-1', role: 'admin' }, process.env.JWT_SECRET);
    secondAdmin = jwt.sign({ id: 'teacher-2', role: 'admin' }, process.env.JWT_SECRET);
    student = jwt.sign({ id: 'student-1', role: 'student' }, process.env.JWT_SECRET);
}, { timeout: 180000 });
after(async () => { imports.stop(); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (database) await database.stop(); });
async function request(url, token = admin, body, method) {
    const response = await fetch(base + url, { method: method || (body ? 'POST' : 'GET'),
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
        ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
}
async function preview(buffer, filename, kind = 'questions', grade = '4', token = admin) {
    const body = new FormData(); body.append('file', new Blob([buffer]), filename); body.append('grade', grade);
    return request(`/admin/imports/${kind}/preview`, token, body);
}
async function waitBatch(id) {
    for (let i = 0; i < 200; i++) {
        const result = await request(`/admin/imports/${id}`);
        if (['completed', 'failed'].includes(result.data.status)) return result.data;
        await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.fail('Import did not finish.');
}
test('question parser reads final/inline keys and flags missing, repeated and conflicting keys', () => {
    const good = parseQuestionText(sample, 'Hifz');
    assert.equal(good.rows.length, 2); assert.equal(good.rows[0].grade, 0);
    assert.deepEqual(good.rows.map(r => r.correct), ['A', 'B']);
    assert.ok(good.rows.every(r => !r.errors.length));
    const inline = parseQuestionText('1. Test? A. First B. Second C. Third\nAnswer: B', 4).rows[0];
    assert.equal(inline.text, 'Test?'); assert.equal(inline.correct, 'B'); assert.equal(inline.options.length, 3);
    assert.ok(parseQuestionText(sample.replace('2. B', '2. D'), 4).rows[1].errors.some(e => e.includes('correct answer')));
    assert.ok(parseQuestionText(sample + '\n1. A', 4).rows[0].errors.some(e => e.includes('Repeated answer')));
    assert.ok(parseQuestionText(sample.replace('Answer Key', 'Answer: C\nAnswer Key'), 4).rows[1].sourceErrors.some(e => e.includes('disagree')));
    assert.ok(parseQuestionText(sample.replace('\n2. B', ''), 4).rows[1].errors.some(e => e.includes('correct answer')));
    assert.throws(() => parseQuestionText('No readable numbered questions.', 4));
    assert.equal(gradeValue('Grade 5'), 5); assert.equal(gradeValue('HIFZ'), 0); assert.equal(gradeValue('8'), null);
});
test('Excel parsing preserves text IDs, honors grade/section defaults, rejects formulas, and reads 3,000 rows', () => {
    const rows = [['Name', 'Roll Number', 'Grade', 'Section', 'Password'], ...Array.from({ length: 3000 }, (_, i) => [`Demo ${i}`, String(i).padStart(6, '0'), i === 0 ? 'Hifz' : '', '', 'Sample123'])];
    const parsed = parseStudentRows(rows, { grade: 4, section: ' Room  A ' });
    assert.equal(parsed.rows.length, 3000); assert.equal(parsed.rows[0].rollNum, '000000'); assert.equal(parsed.rows[0].grade, 0);
    assert.equal(parsed.rows[1].grade, 4); assert.equal(parsed.rows[0].section, 'Room A'); assert.ok(parsed.rows.every(r => !r.errors.length));
    const invalid = parseStudentRows([rows[0], ['Name', 'x', '', '', { formula: '1+1', result: '123456' }]], { grade: 4 });
    assert.ok(invalid.rows[0].errors.some(e => e.includes('formulas')));
    assert.throws(() => parseStudentRows([['Name', 'Name', 'Roll', 'Password'], ['a', 'b', 'c', '123456']]));
});
test('Excel sample and father-name aliases retain values, reject formulas and support older sheets', async () => {
    const response = await fetch(base + '/admin/imports-template/students.xlsx', { headers: { Authorization: `Bearer ${admin}` } });
    assert.equal(response.status, 200);
    const book = new Excel.Workbook(); await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
    const sheet = book.worksheets[0], lines = []; sheet.eachRow({ includeEmpty: true }, row => lines.push(row.values.slice(1)));
    assert.deepEqual(lines[0], ['Name', 'Father Name', 'Roll Number', 'Grade', 'Section', 'Password']);
    const parsed = parseStudentRows(lines);
    assert.equal(parsed.rows[0].fatherName, 'Sample Father One'); assert.equal(parsed.rows[0].rollNum, '00401');
    assert.ok(parsed.rows.every(row => !row.errors.length));
    const aliases = parseStudentRows([["Student Name", "Father's Name", 'Roll', 'Password'], ['Student', ' Parent ', '001', 'Sample123']], { grade: 4 });
    assert.equal(aliases.rows[0].fatherName, 'Parent');
    for (const value of ['x'.repeat(101), { formula: '1+1', result: 'Parent' }]) {
        const invalid = parseStudentRows([['Name', 'Father Name', 'Roll', 'Password'], ['Student', value, '001', 'Sample123']], { grade: 4 });
        assert.ok(invalid.rows[0].errors.length);
    }
    assert.equal(parseStudentRows([['Name', 'Roll', 'Password'], ['Student', '001', 'Sample123']], { grade: 4 }).rows[0].fatherName, '');
});
test('worker extracts matching Word/PDF questions and rejects renamed/broken files', async () => {
    for (const [buffer, filename] of [[docx, 'sample.docx'], [fs.readFileSync(path.join(__dirname, 'fixtures/import-questions.pdf')), 'sample.pdf']]) {
        const parsed = await imports.parseFile({ buffer, originalname: filename }, 'questions', { grade: 5 });
        assert.equal(parsed.rows.length, 2); assert.deepEqual(parsed.rows.map(r => r.correct), ['A', 'B']);
        assert.ok(parsed.rows.every(r => !r.errors.length));
    }
    await assert.rejects(imports.parseFile({ buffer: Buffer.from('Not a PDF'), originalname: 'fake.pdf' }, 'questions', { grade: 4 }));
    await assert.rejects(imports.parseFile({ buffer: Buffer.from('Not a ZIP'), originalname: 'fake.xlsx' }, 'students', {}));
    const book = new Excel.Workbook(), sheet = book.addWorksheet('Students');
    sheet.addRow(['Name', 'Roll Number', 'Password']);
    for (let i = 0; i < 3000; i++) sheet.addRow([`Student ${i}`, String(i).padStart(6, '0'), 'Sample123']);
    const students = await imports.parseFile({ buffer: Buffer.from(await book.xlsx.writeBuffer()), originalname: '3000.xlsx' }, 'students', { grade: 4 });
    assert.equal(students.rows.length, 3000); assert.equal(students.rows[0].rollNum, '000000');
    assert.ok(students.rows.every(r => !r.errors.length));
});
test('teacher-only preview/edit/commit imports selected questions, isolates owners and survives repeated commits', async () => {
    assert.equal((await preview(docx, 'sample.docx', 'questions', '4', null)).status, 401);
    assert.equal((await preview(docx, 'sample.docx', 'questions', '4', student)).status, 403);
    assert.equal((await preview(docx, 'sample.exe')).status, 400);
    const first = await preview(docx, 'sample.docx'); assert.equal(first.status, 201);
    let batch = first.data; assert.equal(await models.Question.countDocuments({}), 0);
    assert.equal((await request(`/admin/imports/${batch.id}`, secondAdmin)).status, 404);
    assert.equal((await request('/admin/imports/not-an-id')).status, 400);
    assert.equal((await request(`/admin/imports/${batch.id}/commit`, admin, { selected: [999], revision: batch.revision })).status, 400);
    const corrected = await request(`/admin/imports/${batch.id}/rows/1`, admin,
        { revision: batch.revision, text: 'Corrected printer question?', options: batch.rows[1].options, correct: 'B' }, 'PATCH');
    assert.equal(corrected.status, 200); batch = corrected.data;
    const commits = await Promise.all(Array.from({ length: 3 }, () => request(`/admin/imports/${batch.id}/commit`, admin, { selected: [0, 1], revision: batch.revision })));
    assert.ok(commits.some(r => r.status === 202));
    batch = await waitBatch(batch.id); assert.equal(batch.status, 'completed'); assert.equal(batch.counts.imported, 2);
    assert.equal(await models.Question.countDocuments({}), 2);
    const original = await models.Question.findOne({ text: 'Which device is used to type?' });
    const copy = original.toObject(); delete copy._id; copy.text = 'A concurrent copy';
    await assert.rejects(models.Question.create(copy), error => error.code === 11000);
    assert.equal((await request(`/admin/imports/${batch.id}/commit`, admin, { selected: [0, 1], revision: 0 })).status, 202);
    await imports.drain(); assert.equal(await models.Question.countDocuments({}), 2);
    const duplicate = (await preview(docx, 'sample.docx')).data;
    assert.ok(duplicate.rows[0].errors.some(e => e.includes('already exists')));
});
test('Excel preview hides/encrypts passwords, rejects duplicates and commits new students without changing existing accounts', async () => {
    const existing = await models.Student.create({ name: 'Keep This Name', rollNum: '00401', grade: 4, section: 'A', passwordHash: await bcrypt.hash('Original123', 10) });
    const book = new Excel.Workbook(), sheet = book.addWorksheet('Students');
    sheet.addRows([['Name', 'Roll Number', 'Grade', 'Section', 'Password', 'Father Name'],
        ['Overwrite Attempt', '00401', '4', ' a ', 'NewPass123', 'Do Not Overwrite'],
        ['New Student', '00402', '4', 'A', 'SecretNew123', '  New Father  '],
        ['Repeat Student', '00402', '4', 'a', 'SecretNew123', 'Repeat Father'],
        ['Hifz Student', 'H-001', 'Hifz', '', 'SecretHifz123', 'Hifz Father'],
        ['Bad Grade', 'BAD', '8', '', 'SecretNew123', ''],
        ['Conflicting Login', '00401', '4', 'B', 'Original123', '']]);
    let result = await preview(await book.xlsx.writeBuffer(), 'students.xlsx', 'students', '');
    assert.equal(result.status, 201); let batch = result.data;
    assert.ok(!JSON.stringify(batch).includes('SecretNew123'));
    assert.ok(batch.rows[0].errors.length && batch.rows[2].errors.length && batch.rows[4].errors.length);
    const stored = await Batch.findById(batch.id).select('+secrets');
    assert.ok(stored.secrets && !stored.secrets.includes('SecretNew123'));
    assert.equal(stored.rows[1].password, undefined);
    assert.equal((await request(`/admin/imports/${batch.id}/commit`, admin, { selected: [0, 1], revision: batch.revision })).status, 400);
    result = await request(`/admin/imports/${batch.id}/commit`, admin, { selected: [1, 3, 5], revision: batch.revision });
    assert.equal(result.status, 202); batch = await waitBatch(batch.id);
    assert.equal(batch.status, 'completed'); assert.equal(batch.counts.imported, 2);
    assert.equal(batch.counts.failed, 1); assert.ok(batch.rows[5].note.includes('another section'));
    assert.equal(await models.Student.countDocuments({ rollNum: '00401' }), 1);
    const original = await models.Student.findById(existing._id).select('+passwordHash');
    assert.equal(original.name, 'Keep This Name'); assert.ok(await bcrypt.compare('Original123', original.passwordHash));
    const login = await request('/student/login', null, { rollNum: '00402', grade: 4, password: 'SecretNew123' });
    assert.equal(login.status, 200); assert.equal(login.data.student.section, 'A');
    assert.equal((await Batch.findById(batch.id).select('+secrets')).secrets, undefined);
    // Replaying a row after an interrupted checkpoint uses the deterministic ID.
    const recovery = await Batch.findById(batch.id); recovery.status = 'importing'; recovery.leaseUntil = new Date(0);
    recovery.rows[1].outcome = undefined; recovery.markModified('rows'); await recovery.save();
    await imports.drain(); assert.equal((await Batch.findById(batch.id)).status, 'completed');
    assert.equal(await models.Student.countDocuments({ rollNum: '00402' }), 1);
    assert.equal((await models.Student.findOne({ rollNum: '00402' })).fatherName, 'New Father');
    assert.equal((await models.Student.findById(existing._id)).fatherName, '');
});
