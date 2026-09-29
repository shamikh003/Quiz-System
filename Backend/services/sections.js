const { Student, Result, Submission } = require('../models/models');
const { sectionName, sectionKey, studentRecords } = require('../sections');

async function linkLegacyRecords(student) {
    const filter = { $and: [studentRecords(student), { student: null }] };
    const owner = { student: student._id, section: sectionName(student.section), sectionKey: sectionKey(student.section) };
    await Result.updateMany(filter, { $set: owner });
    await Submission.updateMany(filter, { $set: owner });
}

// Repeatable startup migration: no reports/accounts are deleted. Replace only
// the old uniqueness constraints that prevented roll-number reuse by section.
async function migrateSections() {
    for (const Model of [Student, Result, Submission]) {
        const cursor = Model.collection.find({ $or: [{ sectionKey: { $exists: false } }, { section: null }] });
        for await (const record of cursor) {
            const section = sectionName(record.section);
            await Model.collection.updateOne({ _id: record._id }, { $set: { section, sectionKey: sectionKey(section) } });
        }
    }
    for await (const student of Student.find().cursor()) {
        await linkLegacyRecords(student);
    }
    // Build replacement indexes first, then remove the specifically retired ones.
    await Student.createIndexes();
    await Submission.createIndexes();
    for (const [Model, oldKeys] of [[Student, [{ rollNum: 1, grade: 1 }, { rollNum: 1, grade: 1, section: 1 }]],
        [Submission, [{ assignment: 1, rollNum: 1 }]]]) {
        for (const index of await Model.collection.indexes()) {
            if (oldKeys.some(key => JSON.stringify(key) === JSON.stringify(index.key))) await Model.collection.dropIndex(index.name);
        }
    }
}
module.exports = { migrateSections, linkLegacyRecords };
