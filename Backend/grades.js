// Keep existing numeric grades unchanged. 0 is the stored code for Hifz.
const VALID_GRADES = [4, 5, 6, 7, 0];
const validGrade = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && VALID_GRADES.includes(Number(value));
module.exports = { VALID_GRADES, validGrade };
