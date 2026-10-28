const { isObjectIdOrHexString } = require('mongoose');
const { Student, Attempt, Result } = require('../models/models');
const { studentRecords } = require('../sections');

const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };

async function getStudent(studentId, session = null) {
    if (!isObjectIdOrHexString(studentId)) fail(400, 'Invalid student ID.');
    const student = await Student.findById(studentId).session(session);
    if (!student) fail(404, 'Student not found.');
    return student;
}

async function listQuizRecords(studentId) {
    const student = await getStudent(studentId);
    const results = await Result.find(studentRecords(student))
        .select('_id attempt score total date').sort({ date: -1 }).lean();
    return results.map(result => ({
        id: String(result._id),
        attemptId: result.attempt ? String(result.attempt) : null,
        score: Number(result.score) || 0,
        total: Number(result.total) || 0,
        percentage: result.total ? Number(((Number(result.score) || 0) * 100 / result.total).toFixed(2)) : 0,
        date: result.date
    }));
}

async function deleteQuizRecord(studentId, resultId, expectedAttemptId) {
    if (!isObjectIdOrHexString(resultId) || (expectedAttemptId !== null &&
        (typeof expectedAttemptId !== 'string' || !isObjectIdOrHexString(expectedAttemptId)))) {
        fail(400, 'Invalid quiz record.');
    }

    return Result.db.transaction(async session => {
        const student = await getStudent(studentId, session);
        const result = await Result.findOne({ $and: [{ _id: resultId }, studentRecords(student)] }).session(session);
        if (!result) fail(404, 'Quiz record not found. Refresh the list and try again.');
        const actualAttemptId = result.attempt ? String(result.attempt) : null;
        if (actualAttemptId !== expectedAttemptId) fail(409, 'This quiz record changed. Refresh the list before deleting it.');

        let attempt = null;
        if (actualAttemptId) {
            attempt = await Attempt.findOne({ _id: actualAttemptId, student: student._id }).session(session);
            if (attempt?.status === 'active') fail(409, 'This quiz is still active and cannot be deleted.');
        }

        const deletedResult = await Result.deleteOne({ _id: result._id }, { session });
        if (deletedResult.deletedCount !== 1) fail(409, 'The quiz record changed during deletion. Nothing was removed.');
        if (attempt) {
            const deletedAttempt = await Attempt.deleteOne({ _id: attempt._id, student: student._id, status: 'submitted' }, { session });
            if (deletedAttempt.deletedCount !== 1) fail(409, 'The linked quiz attempt changed. Nothing was removed.');
        }

        return { message: 'Selected quiz record deleted.', resultId: String(result._id), attemptDeleted: Boolean(attempt) };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
}

module.exports = { listQuizRecords, deleteQuizRecord };
