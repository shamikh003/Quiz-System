// Manual attendance only. Absence is never inferred from quiz participation.
const { Student, Attendance, Settings } = require('../models/models');
const { sectionName, sectionKey } = require('../sections');
const TZ = 'Asia/Karachi';
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const karachiDay = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? dayFormat.format(d) : ''; };
const dayDate = day => new Date(`${day}T12:00:00+05:00`);
const sectionMatch = key => key === 'unassigned' ? { $in: [null, key] } : key;
let trackingStartAt = null;

async function initializeAbsenceTracking() {
    if (trackingStartAt) return trackingStartAt;
    const now = new Date();
    let settings = await Settings.findOne({ settings_id: 'main' }).select('manualAttendanceStartAt').lean();
    if (!settings) settings = (await Settings.create({ settings_id: 'main', manualAttendanceStartAt: now })).toObject();
    if (!settings.manualAttendanceStartAt) {
        await Settings.updateOne({ settings_id: 'main' }, { $set: { manualAttendanceStartAt: now, absenceStartAt: null } });
        settings.manualAttendanceStartAt = now;
    }
    trackingStartAt = new Date(settings.manualAttendanceStartAt);
    return trackingStartAt;
}

async function recordsFor(students, status = 'absent') {
    if (!students.length) return [];
    const startDay = karachiDay(await initializeAbsenceTracking());
    const byId = new Map(students.map(student => [String(student._id), student]));
    const records = await Attendance.find({ student: { $in: [...byId.keys()] }, status, day: { $gte: startDay } }).lean();
    return records.map(record => ({ student: byId.get(String(record.student)), day: record.day, status: record.status })).filter(row => row.student);
}
async function computeAbsences(students) { return recordsFor(students, 'absent'); }
async function absentDaysByStudent(students) {
    const map = new Map();
    for (const { student, day } of await computeAbsences(students)) {
        const key = String(student._id); if (!map.has(key)) map.set(key, []); map.get(key).push(day);
    }
    return map;
}
function absenceRecords(student, days = []) {
    return days.map(day => ({ id: `absent:${day}`, date: dayDate(day), absent: true, grade: student.grade, section: sectionName(student.section) }));
}
async function attendanceRows({ grade, section, rollNum } = {}, status = 'absent') {
    const match = {};
    if (grade) match.grade = Number(grade);
    if (section) match.sectionKey = sectionMatch(sectionKey(section));
    const students = await Student.find(match).select('name rollNum grade section createdAt').lean();
    const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase(), search = normalize(rollNum);
    return (await recordsFor(students, status)).filter(({ student }) => !search || normalize(student.rollNum).includes(search) || normalize(student.name).includes(search)).map(({ student, day }) => ({
        _id: `${status}:${student._id}:${day}`, student: student._id, reportKey: `student:${student._id}`, name: student.name, rollNum: student.rollNum,
        grade: student.grade, section: sectionName(student.section), date: dayDate(day), absent: status === 'absent', notAttempted: status === 'present-not-attempted',
        score: null, total: null, percentage: null, elapsedMs: null, assignmentPercentage: null, tabSwitchCount: 0, fullscreenExitCount: 0
    })).sort((a,b) => b.date-a.date || String(a.name).localeCompare(String(b.name)));
}
const absentRows = filters => attendanceRows(filters, 'absent');
const notAttemptedRows = filters => attendanceRows(filters, 'present-not-attempted');
module.exports = { initializeAbsenceTracking, karachiDay, absentDaysByStudent, absenceRecords, absentRows, notAttemptedRows };
