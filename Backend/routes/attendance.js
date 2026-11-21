const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { Student, Attendance, Result } = require('../models/models');
const { VALID_GRADES } = require('../grades');
const { sectionName, sectionKey } = require('../sections');
const { initializeAbsenceTracking, karachiDay } = require('../services/absences');
const TZ = 'Asia/Karachi';
router.use('/admin/attendance', requireAdmin, (req,res,next) => { res.set('Cache-Control','no-store'); next(); });

const classFilter = (grade, section) => {
    const numeric = Number(grade), key = sectionKey(section);
    if (!VALID_GRADES.includes(numeric) || !String(section || '').trim()) throw Object.assign(new Error('Choose a grade and section.'), { status: 400 });
    return { grade: numeric, sectionKey: key === 'unassigned' ? { $in: [null, key] } : key };
};
const validateDay = async day => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) throw Object.assign(new Error('Choose a valid attendance date.'), { status: 400 });
    const start = karachiDay(await initializeAbsenceTracking()), today = karachiDay(new Date());
    if (day < start) throw Object.assign(new Error('Old attendance is locked. Mark attendance from today onward.'), { status: 400 });
    if (day > today) throw Object.assign(new Error('Future attendance cannot be marked.'), { status: 400 });
};
async function attemptedIds(students, day) {
    const ids = students.map(row => row._id), from = new Date(`${day}T00:00:00+05:00`), to = new Date(`${day}T23:59:59.999+05:00`);
    const rows = await Result.find({ student: { $in: ids }, date: { $gte: from, $lte: to } }).select('student').lean();
    return new Set(rows.map(row => String(row.student)));
}
router.get('/admin/attendance', async (req,res,next) => { try {
    await validateDay(req.query.day); const match = classFilter(req.query.grade, req.query.section);
    const students = await Student.find(match).select('name fatherName rollNum grade section').sort({ name: 1 }).lean();
    const [saved, attempted] = await Promise.all([Attendance.find({ student: { $in: students.map(row=>row._id) }, day:req.query.day }).lean(), attemptedIds(students, req.query.day)]);
    const byStudent = new Map(saved.map(row => [String(row.student), row.status]));
    res.json({ students: students.map(student => ({ ...student, section:sectionName(student.section), attempted:attempted.has(String(student._id)), status:byStudent.get(String(student._id)) || '' })) });
} catch(error) { next(error); } });
router.post('/admin/attendance', express.json({ limit:'200kb' }), async (req,res,next) => { try {
    await validateDay(req.body.day); const match = classFilter(req.body.grade, req.body.section), records = Array.isArray(req.body.records) ? req.body.records : [];
    const students = await Student.find(match).select('_id grade section').lean(), allowed = new Map(students.map(row=>[String(row._id),row])), attempted = await attemptedIds(students, req.body.day);
    for (const record of records) {
        const id = String(record.studentId || ''), student = allowed.get(id); if (!student) continue;
        if (attempted.has(id) || !['absent','present-not-attempted'].includes(record.status)) await Attendance.deleteOne({ student:id, day:req.body.day });
        else await Attendance.updateOne({ student:id, day:req.body.day }, { $set:{ grade:student.grade, section:student.section, status:record.status, updatedAt:new Date() }, $setOnInsert:{ createdAt:new Date() } }, { upsert:true });
    }
    res.json({ message:'Attendance saved.' });
} catch(error) { next(error); } });
module.exports = router;
