const { Attempt, Result } = require('../models/models');
const { gradeAttempt } = require('../quiz-policy');
const { sectionName, sectionKey } = require('../sections');
const { resultMetrics } = require('../result-ranking');

async function finalizeAttempt(attempt, student) {
    // Seal first: competing saves/submissions cannot change an already sealed attempt.
    const sealed = await Attempt.findOneAndUpdate({ _id: attempt._id, status: 'active' },
        { $set: { status: 'submitted', completedAt: new Date() } }, { new: true }) || await Attempt.findById(attempt._id);
    const marks = gradeAttempt(sealed);
    // Freeze the first server submission time. Expired/offline quizzes use the
    // deadline, never a client-supplied timer or a later retry's timestamp.
    const timeLimitMs = sealed.expiresAt.getTime() - sealed.startedAt.getTime();
    const timing = sealed.completedAt && timeLimitMs > 0 ? {
        completedAt: new Date(Math.min(sealed.completedAt.getTime(), sealed.expiresAt.getTime())),
        elapsedMs: Math.max(0, Math.min(timeLimitMs, sealed.completedAt.getTime() - sealed.startedAt.getTime())),
        timeLimitMs
    } : {};
    const metrics = resultMetrics({ ...marks, ...timing });
    const record = { student: student._id, attempt: sealed._id, name: student.name,
        rollNum: student.rollNum, grade: student.grade, section: sectionName(student.section), sectionKey: sectionKey(student.section), ...marks,
        tabSwitchCount: sealed.tabSwitchCount, fullscreenExitCount: sealed.fullscreenExitCount,
        date: sealed.startedAt, ...timing, rankingPercentage: metrics.rankingPercentage,
        speedBonus: metrics.speedBonus, rankingVersion: 2 };
    if (sealed.reportDeleted) return record;
    try {
        const result = await Result.findOneAndUpdate({ attempt: sealed._id }, { $setOnInsert: record }, { upsert: true, new: true });
        await Attempt.updateOne({ _id: sealed._id, purgeAt: { $exists: false } }, { $set: { purgeAt: new Date(Date.now() + 30 * 86400000) } });
        return result;
    } catch (error) {
        if (error.code === 11000) return Result.findOne({ attempt: sealed._id });
        throw error;
    }
}
module.exports = { finalizeAttempt };
