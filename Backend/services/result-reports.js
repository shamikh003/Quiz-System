const { Result, Submission, Student } = require('../models/models');
const { resultMetrics, rankingStages, topScoreEligible } = require('../result-ranking');
const { sectionName, sectionKey } = require('../sections');
const { VALID_GRADES } = require('../grades');

function resultFilters(query = {}) {
    const read = (key, max) => {
        if (query[key] == null) return '';
        if (typeof query[key] !== 'string' || query[key].length > max) throw Object.assign(new Error('Invalid result filters.'), { status: 400 });
        return query[key].trim();
    };
    const grade = read('grade', 2), section = read('section', 80), rollNum = read('rollNum', 100), attempts = read('attempts', 10) || 'all';
    if (grade && !VALID_GRADES.map(String).includes(grade)) throw Object.assign(new Error('Choose Grade 4, 5, 6, 7 or Hifz.'), { status: 400 });
    if (!['all', 'latest'].includes(attempts)) throw Object.assign(new Error('Choose All Attempts or Latest Attempt.'), { status: 400 });
    return { grade, section, rollNum, attempts };
}
const legacyKey = row => JSON.stringify([String(row.rollNum || '').trim(), Number(row.grade), sectionKey(row.section)]);
function selectAttempts(rows, mode, accounts = []) {
    const candidates = mode === 'best' ? rows.filter(topScoreEligible) : rows;
    const ordered = [...candidates].sort((a, b) => {
        if (mode === 'best') {
            const first = resultMetrics(a), second = resultMetrics(b);
            return second.percentage - first.percentage || (first.elapsedMs ?? Number.MAX_SAFE_INTEGER) - (second.elapsedMs ?? Number.MAX_SAFE_INTEGER)
                || (new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0) || String(a._id).localeCompare(String(b._id));
        }
        return (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0) || String(b._id).localeCompare(String(a._id));
    });
    if (!['latest', 'best'].includes(mode)) return ordered;
    const owners = new Map(), seen = new Set();
    for (const student of accounts) {
        const key = legacyKey(student);
        owners.set(key, owners.has(key) ? null : String(student._id));
    }
    return ordered.filter(row => {
        const owner = row.student ? String(row.student) : owners.get(legacyKey(row));
        const key = owner ? `student:${owner}` : `legacy:${legacyKey(row)}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
    });
}
async function resultRows(query = {}, { includeAssignments = true, limit, bestPerStudent = false } = {}) {
    const filters = resultFilters(query), match = {};
    if (filters.grade) match.grade = Number(filters.grade);
    if (filters.section) {
        const key = sectionKey(filters.section);
        match.sectionKey = key === 'unassigned' ? { $in: [null, key] } : key;
    }
    const [stored, accounts] = await Promise.all([
        Result.aggregate([{ $match: match }, ...rankingStages()]),
        filters.attempts === 'latest' || bestPerStudent ? Student.find({}).select('_id rollNum grade section').lean() : []
    ]);
    let rows = selectAttempts(stored, bestPerStudent ? 'best' : filters.attempts, accounts);
    if (filters.rollNum) {
        // Keep the existing query key so saved report links still work.
        const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
        const search = normalize(filters.rollNum);
        rows = rows.filter(row => normalize(row.rollNum).includes(search) || normalize(row.name).includes(search));
    }
    if (limit) rows = rows.slice(0, limit);
    const byOwner = new Map(), byLegacy = new Map();
    if (includeAssignments && rows.length) {
        const ids = [...new Set(rows.filter(row => row.student).map(row => String(row.student)))];
        const identities = new Map(rows.map(row => [legacyKey(row), { rollNum: row.rollNum, grade: row.grade,
            sectionKey: sectionKey(row.section) === 'unassigned' ? { $in: [null, 'unassigned'] } : sectionKey(row.section) }]));
        const submissions = await Submission.find({ status: 'graded', $or: [
            { student: { $in: ids } }, { student: null, $or: [...identities.values()] }
        ] }).select('student rollNum grade section percentage gradedAt').sort({ gradedAt: -1, _id: -1 }).lean();
        for (const submission of submissions) {
            const map = submission.student ? byOwner : byLegacy, key = submission.student ? String(submission.student) : legacyKey(submission);
            if (!map.has(key)) map.set(key, submission);
        }
    }
    return rows.map(row => {
        const owned = row.student && byOwner.get(String(row.student)), legacy = byLegacy.get(legacyKey(row));
        const submission = owned && legacy ? (new Date(owned.gradedAt) >= new Date(legacy.gradedAt) ? owned : legacy) : owned || legacy;
        const assignmentPercentage = submission ? submission.percentage : null;
        return { ...row, ...resultMetrics(row), section: sectionName(row.section), assignmentPercentage };
    });
}
module.exports = { resultFilters, selectAttempts, resultRows };
