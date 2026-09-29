const UNASSIGNED = 'Unassigned';
function sectionName(value) {
    if (value == null || value === '') return UNASSIGNED;
    if (typeof value !== 'string') throw new Error('Section must be text.');
    const name = value.trim().replace(/\s+/g, ' ') || UNASSIGNED;
    if (name.length > 80) throw new Error('Section name must be 80 characters or fewer.');
    return name.toLowerCase() === 'unassigned' ? UNASSIGNED : name;
}
const sectionKey = value => sectionName(value).toLowerCase();
// Ownership remains stable if a teacher later changes a section name.
function studentRecords(student) {
    const key = sectionKey(student.section);
    return { $or: [
        { student: student._id },
        { student: null, rollNum: student.rollNum, grade: student.grade,
            sectionKey: key === 'unassigned' ? { $in: [null, key] } : key }
    ] };
}
module.exports = { UNASSIGNED, sectionName, sectionKey, studentRecords };
