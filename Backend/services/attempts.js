const { Attempt, Result } = require('../models/models');
const { gradeAttempt } = require('../quiz-policy');
const { sectionName, sectionKey } = require('../sections');

async function finalizeAttempt(attempt, student) {
    // Seal first: competing saves/submissions cannot change an already sealed attempt.
    const sealed = await Attempt.findOneAndUpdate({ _id: attempt._id, status: 'active' },
        { $set: { status: 'submitted' } }, { new: true }) || await Attempt.findById(attempt._id);
    const marks = gradeAttempt(sealed);
    const record = { student: student._id, attempt: sealed._id, name: student.name,
        rollNum: student.rollNum, grade: student.grade, section: sectionName(student.section), sectionKey: sectionKey(student.section), ...marks,
        tabSwitchCount: sealed.tabSwitchCount, fullscreenExitCount: sealed.fullscreenExitCount,
        date: sealed.startedAt };
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
