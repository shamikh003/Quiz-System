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
    // Already-linked data needs no per-student updates on every wake/restart.
    // Find only legacy identities that still have matching accounts.
    for (const Model of [Result, Submission]) {
        const legacyOwners = await Model.aggregate([
            { $match: { student: null } },
            { $group: { _id: { rollNum: '$rollNum', grade: '$grade', sectionKey: '$sectionKey' } } },
            { $lookup: { from: Student.collection.name, let: { identity: '$_id' }, pipeline: [
                { $match: { $expr: { $and: [
                    { $eq: ['$rollNum', '$$identity.rollNum'] },
                    { $eq: ['$grade', '$$identity.grade'] },
                    { $eq: ['$sectionKey', '$$identity.sectionKey'] }
                ] } } }, { $project: { _id: 1, section: 1, sectionKey: 1 } }
            ], as: 'owners' } },
            { $unwind: '$owners' },
            { $project: { _id: 1, owner: '$owners' } }
        ]);
        if (legacyOwners.length) await Model.bulkWrite(legacyOwners.map(({ _id: identity, owner }) => ({ updateMany: {
            filter: { student: null, rollNum: identity.rollNum, grade: identity.grade, sectionKey: identity.sectionKey },
            update: { $set: { student: owner._id, section: owner.section, sectionKey: owner.sectionKey } }
        } })));
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
