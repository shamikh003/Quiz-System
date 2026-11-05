// Auto-Absent: a "Quiz Day" is any Asia/Karachi date on which at least one student of a
// Grade + Section submitted a quiz. Students of that class with no result that day are Absent.
// Computed on the fly - nothing extra is stored in the database.
const { Student, Result } = require('../models/models');
const { sectionName, sectionKey } = require('../sections');
const TZ = 'Asia/Karachi';
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const karachiDay = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? dayFormat.format(d) : ''; };
// Noon Karachi time keeps the date stable when it is formatted in any timezone.
const dayDate = day => new Date(`${day}T12:00:00+05:00`);
const classKey = (grade, section) => `${Number(grade)}|${sectionKey(section)}`;
const sectionMatch = key => key === 'unassigned' ? { $in: [null, key] } : key;

// students: [{ _id, rollNum, grade, section, createdAt }] -> [{ student, day }]
async function computeAbsences(students) {
    if (!students.length) return [];
    const classes = new Map();
    for (const student of students) classes.set(classKey(student.grade, student.section), { grade: Number(student.grade), key: sectionKey(student.section) });
    const groups = await Result.aggregate([
        { $match: { $or: [...classes.values()].map(c => ({ grade: c.grade, sectionKey: sectionMatch(c.key) })) } },
        { $group: { _id: {
            grade: '$grade', sectionKey: { $ifNull: ['$sectionKey', 'unassigned'] },
            day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: TZ } },
            student: '$student', rollNum: '$rollNum' } } }
    ]);
    const days = new Map();
    for (const { _id } of groups) {
        if (!_id.day) continue;
        const key = classKey(_id.grade, _id.sectionKey);
        if (!days.has(key)) days.set(key, new Map());
        const perDay = days.get(key);
        if (!perDay.has(_id.day)) perDay.set(_id.day, new Set());
        perDay.get(_id.day).add(_id.student ? `s:${_id.student}` : `r:${_id.rollNum}`);
    }
    const absences = [];
    for (const student of students) {
        const joined = student.createdAt ? karachiDay(student.createdAt) : '';
        for (const [day, present] of days.get(classKey(student.grade, student.section)) || []) {
            if (day < joined || present.has(`s:${student._id}`) || present.has(`r:${student.rollNum}`)) continue;
            absences.push({ student, day });
        }
    }
    return absences;
}
// Absent days per student id (for Student Report web + PDF).
async function absentDaysByStudent(students) {
    const map = new Map();
    for (const { student, day } of await computeAbsences(students)) {
        const key = String(student._id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(day);
    }
    return map;
}
function absenceRecords(student, days = []) {
    return days.map(day => ({ id: `absent:${day}`, date: dayDate(day), absent: true,
        grade: student.grade, section: sectionName(student.section) }));
}
// Rows for Reports -> All Results -> Absent filter.
async function absentRows({ grade, section, rollNum } = {}) {
    const match = {};
    if (grade) match.grade = Number(grade);
    if (section) match.sectionKey = sectionMatch(sectionKey(section));
    const students = await Student.find(match).select('name rollNum grade section createdAt').lean();
    const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    const search = normalize(rollNum);
    return (await computeAbsences(students))
        .filter(({ student }) => !search || normalize(student.rollNum).includes(search) || normalize(student.name).includes(search))
        .map(({ student, day }) => ({ _id: `absent:${student._id}:${day}`, student: student._id, name: student.name, rollNum: student.rollNum,
            grade: student.grade, section: sectionName(student.section), date: dayDate(day), absent: true,
            score: null, total: null, percentage: null, elapsedMs: null, assignmentPercentage: null, tabSwitchCount: 0, fullscreenExitCount: 0 }))
        .sort((a, b) => b.date - a.date || a.grade - b.grade || a.section.localeCompare(b.section) || String(a.name).localeCompare(String(b.name)));
}
module.exports = { karachiDay, absentDaysByStudent, absenceRecords, absentRows };
