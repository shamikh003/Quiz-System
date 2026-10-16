const crypto = require('node:crypto');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Batch = require('../models/import-batch');
const { Question, Student } = require('../models/models');
const { questionKey, studentKey, questionErrors } = require('./import-parser');
const { linkLegacyRecords } = require('./sections');

let parsing = false, draining = false, timer;
function parseFile(file, kind, defaults) {
    if (parsing) return Promise.reject(Object.assign(new Error('Another file is being read. Please try again in a moment.'), { status: 429 }));
    parsing = true;
    return new Promise((resolve, reject) => {
        let worker;
        try {
            worker = new Worker(path.join(__dirname, 'import-file-worker.js'), {
                workerData: { data: file.buffer, extension: path.extname(file.originalname).toLowerCase(), kind, defaults },
                resourceLimits: { maxOldGenerationSizeMb: 192 }
            });
        } catch (error) { parsing = false; reject(error); return; }
        let result, failure, done = false;
        const deadline = setTimeout(() => {
            failure = new Error('Reading the file took too long. Split it into smaller files and try again.');
            void worker.terminate();
        }, 45000);
        worker.once('message', message => { result = message; });
        worker.once('error', () => { failure = new Error('Could not read this file. Use the sample format or split a large file into smaller parts.'); });
        // Let readers release native PDF resources before allowing another file.
        // Terminating immediately after postMessage can interrupt their cleanup.
        worker.once('exit', code => {
            if (done) return;
            done = true; clearTimeout(deadline); parsing = false;
            const error = failure || (code !== 0 || !result ? new Error('The file reader stopped. Please use a smaller file.')
                : result.error ? new Error(result.error) : null);
            error ? reject(error) : resolve(result.value);
        });
    });
}
function secretKey() { return crypto.createHash('sha256').update('quizboard-import-v1:' + process.env.JWT_SECRET).digest(); }
function seal(value) {
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
function unseal(value) {
    const buffer = Buffer.from(value, 'base64'), decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), buffer.subarray(0, 12));
    decipher.setAuthTag(buffer.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8'));
}
function view(batch) {
    const rows = batch.rows.map((row, index) => ({ ...row, index }));
    return { id: String(batch._id), kind: batch.kind, filename: batch.filename, status: batch.status, revision: batch.revision,
        warnings: batch.warnings, error: batch.error || '', expiresAt: batch.expiresAt, rows,
        selected: batch.selected || [], counts: { total: rows.length, ready: rows.filter(r => !r.errors.length).length,
            imported: rows.filter(r => r.outcome === 'imported').length, skipped: rows.filter(r => r.outcome === 'skipped').length,
            failed: rows.filter(r => r.outcome === 'failed').length, processed: rows.filter(r => r.outcome).length } };
}
async function markDuplicates(kind, rows) {
    const key = kind === 'questions' ? questionKey : studentKey;
    const existing = kind === 'questions' ? await Question.find({}).select('text options grade').lean()
        : await Student.find({}).select('rollNum grade section').lean();
    const known = new Set(existing.map(key)), seen = new Set(), loginIdentities = new Set();
    for (const row of rows) {
        const identity = key(row);
        if (known.has(identity)) row.errors.push(kind === 'questions' ? 'This question already exists in this grade.' : 'This roll number already exists in this grade and section.');
        if (seen.has(identity)) row.errors.push('Repeated entry in this file.');
        seen.add(identity);
        if (kind === 'students') {
            const loginIdentity = JSON.stringify([row.grade, row.rollNum, row.password]);
            if (loginIdentities.has(loginIdentity)) row.errors.push('This roll number and grade repeat with the same password. Use a different password for each section.');
            loginIdentities.add(loginIdentity);
        }
    }
}
async function preview(file, kind, defaults, owner) {
    const parsed = await parseFile(file, kind, defaults);
    await markDuplicates(kind, parsed.rows);
    const passwords = {};
    parsed.rows.forEach((row, index) => {
        if (kind === 'students') { passwords[index] = row.password; delete row.password; }
    });
    if (Buffer.byteLength(JSON.stringify(parsed.rows)) > 8 * 1024 * 1024) throw new Error('The extracted preview is too large. Split the document.');
    const batch = await Batch.create({ owner, kind, filename: path.basename(file.originalname.replace(/\\/g, '/')).slice(0, 180),
        rows: parsed.rows, warnings: parsed.warnings, ...(kind === 'students' ? { secrets: seal(passwords) } : {}) });
    return view(batch);
}
const deterministicId = (batch, index) => new mongoose.Types.ObjectId(crypto.createHash('sha256').update(`${batch}:${index}`).digest('hex').slice(0, 24));

async function processBatch(batch, lease) {
    const passwordMap = batch.secrets ? unseal(batch.secrets) : {};
    const selected = new Set(batch.selected), rows = batch.rows;
    const known = batch.kind === 'questions' ? new Set((await Question.find({}).select('text options grade').lean()).map(questionKey)) : null;
    let lostLease = false;
    const dirty = new Set();
    const heartbeat = setInterval(() => {
        Batch.updateOne({ _id: batch._id, lease }, { $set: { leaseUntil: new Date(Date.now() + 120000), expiresAt: new Date(Date.now() + 24 * 3600000) } })
            .then(result => { if (!result.matchedCount) lostLease = true; }).catch(() => { lostLease = true; });
    }, 30000); heartbeat.unref();
    const checkpoint = async () => {
        const changes = { leaseUntil: new Date(Date.now() + 120000) };
        for (const index of dirty) changes[`rows.${index}`] = rows[index];
        const result = await Batch.updateOne({ _id: batch._id, lease }, { $set: changes });
        if (!result.matchedCount) throw new Error('Import ownership changed.');
        dirty.clear();
    };
    try {
        for (let index = 0; index < rows.length; index++) {
            if (lostLease) throw new Error('Import ownership changed.');
            const row = rows[index];
            if (!selected.has(index) || row.outcome) continue;
            const _id = deterministicId(batch._id, index), Model = batch.kind === 'students' ? Student : Question;
            let record = await Model.findById(_id);
            try {
                if (!record && batch.kind === 'students') {
                    const candidates = await Student.find({ rollNum: row.rollNum, grade: row.grade }).select('+passwordHash');
                    const duplicate = candidates.some(s => s.sectionKey === require('../sections').sectionKey(row.section));
                    if (duplicate) { row.outcome = 'skipped'; row.note = 'Already registered; the existing account was kept.'; }
                    else {
                        let ambiguous = false;
                        for (const candidate of candidates) if (await bcrypt.compare(passwordMap[index], candidate.passwordHash)) ambiguous = true;
                        if (ambiguous) {
                            row.outcome = 'failed'; row.note = 'This roll number and password already belong to another section in this grade. Use a different password and upload this row again.';
                        } else record = await Student.create({ _id, name: row.name, rollNum: row.rollNum, grade: row.grade, section: row.section,
                            passwordHash: await bcrypt.hash(passwordMap[index], 10) });
                    }
                } else if (!record) {
                    const identity = questionKey(row);
                    if (known.has(identity)) { row.outcome = 'skipped'; row.note = 'Already in this grade; the existing question was kept.'; }
                    else {
                        record = await Question.create({ _id, text: row.text.trim(), grade: row.grade, options: row.options, correct: row.correct,
                            bulkImportKey: crypto.createHash('sha256').update(identity).digest('hex') });
                        known.add(identity);
                    }
                }
                if (record) {
                    // Retried/recovered rows use the same document ID, never a second account/question.
                    if (batch.kind === 'students') await linkLegacyRecords(record);
                    else await require('./translation').translationQueue().enqueue(record);
                    row.outcome = 'imported'; row.note = '';
                }
            } catch (error) {
                if (error.code === 11000) { row.outcome = 'skipped'; row.note = batch.kind === 'students'
                    ? 'An account was registered meanwhile; it was kept unchanged.' : 'This question was imported meanwhile; the existing question was kept.'; }
                else if (error.name === 'ValidationError') { row.outcome = 'failed'; row.note = 'This row could not be saved. Review its values.'; }
                else throw error;
            }
            dirty.add(index);
            if (dirty.size >= 10) await checkpoint();
        }
        await checkpoint();
        await Batch.updateOne({ _id: batch._id, lease }, { $set: { status: 'completed' }, $unset: { secrets: 1, lease: 1, leaseUntil: 1, error: 1 } });
    } finally { clearInterval(heartbeat); }
}
async function drain() {
    if (draining) return; draining = true;
    try {
        while (true) {
            const lease = crypto.randomUUID();
            const batch = await Batch.findOneAndUpdate({ expiresAt: { $gt: new Date() }, $or: [
                { status: 'queued' }, { status: 'importing', leaseUntil: { $lt: new Date() } }
            ] }, { $set: { status: 'importing', lease, leaseUntil: new Date(Date.now() + 120000) } }, { new: true, sort: { createdAt: 1 } }).select('+secrets');
            if (!batch) break;
            try { await processBatch(batch, lease); }
            catch (error) {
                console.error('Bulk import paused:', error.name);
                await Batch.updateOne({ _id: batch._id, lease }, { $set: { status: 'failed', error: 'Import paused. Saved rows are safe. Select Resume import to continue without duplicates.' }, $unset: { lease: 1, leaseUntil: 1 } });
            }
        }
    } catch (error) { console.error('Bulk import worker stopped:', error.name); }
    finally { draining = false; }
}
function start() { if (!timer) { timer = setInterval(() => void drain(), 30000); timer.unref(); } void drain(); }
function stop() { clearInterval(timer); timer = null; }
module.exports = { parseFile, preview, view, markDuplicates, deterministicId, start, stop, drain, questionErrors };
