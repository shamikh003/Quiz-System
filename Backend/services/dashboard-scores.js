const { Assignment, Result, Student, Submission } = require('../models/models');
const { rankingStages, resultMetrics, topScoreEligible } = require('../result-ranking');
const { sectionKey, sectionName } = require('../sections');

const identity = row => JSON.stringify([String(row.rollNum ?? '').trim(), row.grade, sectionKey(row.section)]);
const cohort = row => JSON.stringify([row.grade, sectionKey(row.section)]);
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function rankDashboardScores(students, quizzes, assignments, submissions, section = '') {
    const byId = new Map(), byIdentity = new Map(), tasks = new Map();
    const assignmentGrades = new Set();
    for (const student of students) {
        const entry = { student, quiz: [], worksheet: [], assignment: [], best: null };
        byId.set(String(student._id), entry);
        const key = identity(student);
        byIdentity.set(key, byIdentity.has(key) ? null : entry);
    }
    const owner = row => row.student ? byId.get(String(row.student)) : byIdentity.get(identity(row));
    for (const task of assignments) {
        tasks.set(String(task._id), task);
        if (!task.manual && !task.deletedAt) assignmentGrades.add(task.grade);
    }
    for (const quiz of quizzes) {
        const entry = owner(quiz);
        if (!entry || cohort(entry.student) !== cohort(quiz) || !topScoreEligible(quiz)) continue;
        entry.quiz.push(resultMetrics(quiz).percentage);
        // The database returns the best marks first, with time as the tie-breaker.
        if (!entry.best) entry.best = resultMetrics(quiz);
    }
    for (const submission of submissions) {
        const entry = owner(submission);
        if (!entry || cohort(entry.student) !== cohort(submission)) continue;
        const task = tasks.get(String(submission.assignment));
        const percentage = submission.percentage ?? (task?.maxMarks > 0 && Number.isFinite(submission.marks)
            ? submission.marks / task.maxMarks * 100 : null);
        if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) continue;
        if (task?.manual ?? submission.manual) entry.worksheet.push(percentage);
        else {
            entry.assignment.push(percentage);
            assignmentGrades.add(submission.grade);
        }
    }
    const selectedSection = section ? sectionKey(section) : null;
    return [...byId.values()].filter(entry => entry.quiz.length &&
        (!selectedSection || sectionKey(entry.student.section) === selectedSection)).map(entry => {
        const { student, best } = entry;
        const quizAverage = average(entry.quiz), worksheetAverage = average(entry.worksheet), assignmentAverage = average(entry.assignment);
        const hasAssignment = assignmentGrades.has(student.grade);
        const overallPercentage = quizAverage * (hasAssignment ? .6 : .8)
            + (worksheetAverage ?? 0) * .2 + (hasAssignment ? (assignmentAverage ?? 0) * .2 : 0);
        return { name: student.name, rollNum: student.rollNum, grade: student.grade, section: sectionName(student.section),
            reportKey: `student:${student._id}`, quizAverage, worksheetAverage, assignmentAverage,
            overallPercentage, hasAssignment, elapsedMs: best.elapsedMs };
    }).sort((a, b) => b.overallPercentage - a.overallPercentage || b.quizAverage - a.quizAverage
        || (a.elapsedMs ?? Infinity) - (b.elapsedMs ?? Infinity) || a.name.localeCompare(b.name)).slice(0, 5);
}

async function dashboardScores(filter, section) {
    const [students, quizzes, assignments, submissions] = await Promise.all([
        Student.find(filter).select('name rollNum grade section').lean(),
        Result.aggregate([{ $match: filter }, ...rankingStages()]),
        Assignment.find(filter).select('grade manual deletedAt maxMarks').lean(),
        Submission.find({ ...filter, status: 'graded' }).select('student assignment rollNum grade section manual percentage marks').lean()
    ]);
    return rankDashboardScores(students, quizzes, assignments, submissions, section);
}

module.exports = { dashboardScores, rankDashboardScores };
