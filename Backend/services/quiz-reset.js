const { isObjectIdOrHexString } = require('mongoose');
const { Student, Attempt, Result } = require('../models/models');
const { pakistanDay } = require('../quiz-policy');
const { studentRecords } = require('../sections');

const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const sortedIds = rows => rows.map(row => String(row._id)).sort();

async function previewTodayReset(studentId, session = null) {
    if (!isObjectIdOrHexString(studentId)) fail(400, 'Invalid student ID.');
    const student = await Student.findById(studentId).session(session);
    if (!student) fail(404, 'Student not found.');

    const day = pakistanDay();
    const start = new Date(`${day}T00:00:00+05:00`);
    const end = new Date(start.getTime() + 86400000);
    if (await Attempt.exists({ student: student._id, status: 'active', expiresAt: { $gt: new Date() } }).session(session)) {
        fail(409, 'This student is taking a quiz. Wait until it is submitted before resetting.');
    }

    const attempts = await Attempt.find({ student: student._id, day }).select('_id status').session(session).lean();
    if (attempts.some(attempt => attempt.status !== 'submitted')) {
        fail(409, 'This quiz has not been submitted yet. Refresh the student report first.');
    }
    const results = await Result.find({ $and: [studentRecords(student), { date: { $gte: start, $lt: end } }] })
        .select('_id').session(session).lean();
    if (!attempts.length && !results.length) fail(409, 'This student has no completed quiz to reset today.');
    return { day, attemptIds: sortedIds(attempts), resultIds: sortedIds(results) };
}

async function resetTodayQuiz(studentId, snapshot) {
    const validIds = values => Array.isArray(values) && values.length <= 100 &&
        values.every(value => typeof value === 'string' && isObjectIdOrHexString(value)) && new Set(values).size === values.length;
    if (!snapshot || snapshot.day !== pakistanDay() || !validIds(snapshot.attemptIds) || !validIds(snapshot.resultIds)) {
        fail(400, 'The reset confirmation expired. Check the quiz again.');
    }

    return Attempt.db.transaction(async session => {
        const current = await previewTodayReset(studentId, session);
        const same = current.day === snapshot.day &&
            JSON.stringify(current.attemptIds) === JSON.stringify([...snapshot.attemptIds].sort()) &&
            JSON.stringify(current.resultIds) === JSON.stringify([...snapshot.resultIds].sort());
        if (!same) fail(409, 'The quiz changed since you opened the reset. Check it again before confirming.');

        const attempts = await Attempt.deleteMany({ _id: { $in: current.attemptIds }, student: studentId,
            day: current.day, status: 'submitted' }, { session });
        const results = await Result.deleteMany({ _id: { $in: current.resultIds } }, { session });
        if (attempts.deletedCount !== current.attemptIds.length || results.deletedCount !== current.resultIds.length) {
            fail(409, 'The quiz changed during the reset. Nothing was removed.');
        }
        return { message: 'Today\u2019s quiz reset. The student can start again.', day: current.day,
            deletedAttempts: attempts.deletedCount, deletedResults: results.deletedCount };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
}

module.exports = { previewTodayReset, resetTodayQuiz };
