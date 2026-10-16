const mongoose = require('mongoose');
const { Student, Result, Submission, Assignment } = require('../models/models');
const { sectionName, sectionKey, studentRecords } = require('../sections');
const { validGrade } = require('../grades');
const { resultMetrics } = require('../result-ranking');
const problem = (status, message) => Object.assign(new Error(message), { status });
const identity = row => JSON.stringify([row.rollNum, row.grade, sectionKey(row.section)]);
const legacyKey = row => 'legacy:' + Buffer.from(identity(row)).toString('base64url');
const profile = row => ({ key: `student:${row._id}`, name: row.name, rollNum: row.rollNum,
    grade: row.grade, section: sectionName(row.section), historical: false });
function legacyFilter(row) {
    const key = sectionKey(row.section);
    return { student: null, rollNum: row.rollNum, grade: row.grade,
        sectionKey: key === 'unassigned' ? { $in: [null, key] } : key };
}
async function historicalIdentities(Model, date) {
    return Model.aggregate([
        { $match: { student: null, rollNum: { $type: 'string', $ne: '' } } },
        { $sort: { [date]: -1, _id: -1 } },
        { $group: { _id: { rollNum: '$rollNum', grade: '$grade', sectionKey: { $ifNull: ['$sectionKey', 'unassigned'] } },
            name: { $first: '$name' }, section: { $first: '$section' } } },
        { $project: { _id: 0, name: 1, section: 1, rollNum: '$_id.rollNum', grade: '$_id.grade' } }
    ]);
}
async function searchStudents(query = {}) {
    for (const field of ['q', 'grade', 'section']) if (query[field] != null && typeof query[field] !== 'string') throw problem(400, 'Use a name, grade and section in the search.');
    const q = (query.q || '').trim().toLowerCase();
    if (q.length > 100 || (query.section || '').length > 80) throw problem(400, 'Use a shorter search.');
    if (query.grade && !validGrade(query.grade)) throw problem(400, 'Choose a valid grade.');
    const [accounts, oldQuizzes, oldAssignments] = await Promise.all([
        Student.find({}).select('name rollNum grade section').lean(),
        historicalIdentities(Result, 'date'), historicalIdentities(Submission, 'submittedAt')
    ]);
    const known = new Set(accounts.map(identity)), legacy = new Map();
    for (const row of [...oldQuizzes, ...oldAssignments]) {
        if (!known.has(identity(row)) && !legacy.has(identity(row))) legacy.set(identity(row), {
            ...profile(row), key: legacyKey(row), name: row.name || 'Historical student', historical: true
        });
    }
    const candidates = [...accounts.map(profile), ...legacy.values()];
    const matched = candidates.filter(row => (!q || `${row.name} ${row.rollNum}`.toLowerCase().includes(q))
        && (!query.grade || row.grade === Number(query.grade))
        && (!query.section || sectionKey(row.section) === sectionKey(query.section)))
        .sort((a, b) => a.name.localeCompare(b.name) || a.rollNum.localeCompare(b.rollNum) || a.grade - b.grade || a.section.localeCompare(b.section));
    return { students: matched.slice(0, 50), total: matched.length,
        sections: [...new Set(candidates.filter(row => !query.grade || row.grade === Number(query.grade)).map(row => row.section))].sort() };
}
async function resolveStudent(key) {
    if (key.startsWith('student:')) {
        const id = key.slice(8);
        if (!mongoose.isObjectIdOrHexString(id)) throw problem(400, 'Invalid student.');
        const student = await Student.findById(id).select('name rollNum grade section');
        if (!student) throw problem(404, 'This student is no longer available. Search again.');
        return { student: profile(student), filter: studentRecords(student) };
    }
    if (!key.startsWith('legacy:') || key.length > 500 || !/^[A-Za-z0-9_-]+$/.test(key.slice(7))) throw problem(400, 'Invalid student.');
    let values;
    try { values = JSON.parse(Buffer.from(key.slice(7), 'base64url').toString('utf8')); } catch { throw problem(400, 'Invalid historical student.'); }
    if (!Array.isArray(values) || values.length !== 3 || typeof values[0] !== 'string' || !values[0] || values[0].length > 40
        || !validGrade(values[1]) || typeof values[2] !== 'string' || values[2].length > 80) throw problem(400, 'Invalid historical student.');
    const row = { rollNum: values[0], grade: Number(values[1]), section: sectionName(values[2]) };
    const account = await Student.findOne({ rollNum: row.rollNum, grade: row.grade, sectionKey: sectionKey(row.section) }).select('name rollNum grade section');
    if (account) return { student: profile(account), filter: studentRecords(account) };
    const filter = legacyFilter(row);
    const record = await Result.findOne(filter).sort({ date: -1, _id: -1 }).select('name section')
        || await Submission.findOne(filter).sort({ submittedAt: -1, _id: -1 }).select('name section');
    if (!record) throw problem(404, 'No saved report was found for this student.');
    return { student: { ...row, key, name: record.name || 'Historical student', section: sectionName(record.section), historical: true }, filter };
}
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const validPercent = value => Number.isFinite(value) && value >= 0 && value <= 100;
async function studentReport(key) {
    const { student, filter } = await resolveStudent(key);
    const [savedQuizzes, submissions] = await Promise.all([
        Result.find(filter).select('score total date grade section elapsedMs timeLimitMs').sort({ date: 1, _id: 1 }).lean(),
        Submission.find(filter).select('assignment grade section status marks percentage submittedAt gradedAt assignmentDeletedAt').sort({ submittedAt: -1, _id: -1 }).lean()
    ]);
    const tasks = await Assignment.find({ _id: { $in: submissions.map(row => row.assignment) } }).select('title maxMarks deletedAt').lean();
    const byId = new Map(tasks.map(row => [String(row._id), row]));
    const quizzes = savedQuizzes.map(row => ({ id: String(row._id), date: row.date || null, grade: row.grade,
        section: sectionName(row.section), score: row.score ?? null, total: row.total ?? null,
        percentage: Number.isFinite(row.score) && Number.isFinite(row.total) && row.total > 0 && row.score >= 0 && row.score <= row.total ? row.score / row.total * 100 : null,
        elapsedMs: resultMetrics(row).elapsedMs }));
    const assignments = submissions.flatMap(row => {
        const task = byId.get(String(row.assignment));
        const archived = Boolean(row.assignmentDeletedAt || task?.deletedAt || !task);
        if (archived && row.status !== 'graded') return [];
        const graded = row.status === 'graded';
        const percentage = graded && validPercent(row.percentage) ? row.percentage
            : graded && Number.isFinite(row.marks) && task?.maxMarks > 0 && row.marks >= 0 && row.marks <= task.maxMarks ? row.marks / task.maxMarks * 100 : null;
        return [{ id: String(row._id), title: task?.title || 'Archived assignment', grade: row.grade, section: sectionName(row.section),
            status: row.status, marks: graded ? row.marks ?? null : null, maxMarks: task?.maxMarks ?? null,
            percentage, submittedAt: row.submittedAt || null, gradedAt: row.gradedAt || null, archived }];
    });
    const scored = quizzes.filter(row => row.percentage != null), graded = assignments.filter(row => row.status === 'graded');
    return { student, generatedAt: new Date().toISOString(), summary: {
        quizzesTaken: quizzes.length, scoredQuizzes: scored.length, averageQuiz: average(scored.map(row => row.percentage)),
        bestQuiz: scored.length ? Math.max(...scored.map(row => row.percentage)) : null,
        assignmentAverage: average(graded.map(row => row.percentage).filter(validPercent)), gradedAssignments: graded.length,
        assignmentsSubmitted: assignments.length, firstQuiz: scored[0]?.percentage ?? null, latestQuiz: scored.at(-1)?.percentage ?? null
    }, quizzes, assignments };
}
module.exports = { searchStudents, studentReport };
