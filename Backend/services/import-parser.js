const { validGrade } = require('../grades');
const { sectionName, sectionKey } = require('../sections');

const MAX_QUESTIONS = 1000, MAX_STUDENTS = 5000;
function gradeValue(value) {
    if (typeof value === 'string') value = value.trim().replace(/^(?:grade|class)\s*/i, '');
    return /^hifz$/i.test(String(value)) ? 0 : validGrade(value) ? Number(value) : null;
}
function questionErrors(row) {
    const errors = [...(row.sourceErrors || [])];
    if (gradeValue(row.grade) === null) errors.push('Choose Grade 4–7 or Hifz.');
    if (typeof row.text !== 'string' || !row.text.trim() || row.text.length > 10000) errors.push('Question text must have 1–10,000 characters.');
    if (!Array.isArray(row.options) || ![3, 4].includes(row.options.length)
        || row.options.some((o, i) => !o || o.id !== 'ABCD'[i] || typeof o.text !== 'string' || !o.text.trim() || o.text.length > 5000)) {
        errors.push('Provide options A, B, C and optionally D (up to 5,000 characters each).');
    }
    if (!Array.isArray(row.options) || !row.options.some(o => o && o.id === row.correct && typeof o.text === 'string' && o.text.trim())) errors.push('Choose a correct answer matching a filled option.');
    return errors;
}
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
function questionKey(row) {
    return JSON.stringify([row.grade, normalize(row.text), (row.options || []).map(o => [o.id, normalize(o.text)])]);
}
function studentKey(row) { return JSON.stringify([row.grade, row.rollNum, sectionKey(row.section)]); }

function parseQuestionText(text, grade) {
    if (typeof text !== 'string' || text.length > 2000000) throw new Error('Use a smaller document (at most two million extracted characters).');
    const rows = [], keys = new Map(), keyCounts = new Map(), warnings = [];
    let current = null, answerSection = false;
    const store = () => { if (current) { rows.push(current); current = null; } };
    for (let line of text.replace(/\r/g, '').split('\n')) {
        line = line.replace(/\u00a0/g, ' ').trim();
        if (!line || /^--\s*\d+\s*(?:of|\/)\s*\d+\s*--$/i.test(line)) continue;
        // "Answer: B" belongs to a question; "Answer Key" begins the final key.
        const inline = line.match(/^(?:correct\s*(?:answer|key)|answer)\s*[:=-]\s*([A-D])\s*[.)]?\s*$/i);
        if (inline && current && !answerSection) {
            if (current.correct && current.correct !== inline[1].toUpperCase()) current.sourceErrors.push('Conflicting inline answers.');
            current.correct = inline[1].toUpperCase(); continue;
        }
        if (/^(?:answer\s*key|correct\s*answers|answers)\s*[:\s]*$/i.test(line)
            || /^(?:answer\s*key|correct\s*answers)\s*:/i.test(line)) {
            store(); answerSection = true;
            line = line.replace(/^(?:answer\s*key|correct\s*answers|answers)\s*:?\s*/i, '');
        }
        if (answerSection) {
            for (const match of line.matchAll(/(?:^|[\s,;|])(\d{1,4})\s*[.):-]?\s*([A-D])\b/gi)) {
                const number = Number(match[1]); keys.set(number, match[2].toUpperCase());
                keyCounts.set(number, (keyCounts.get(number) || 0) + 1);
            }
            continue;
        }
        const question = line.match(/^(?:Q(?:uestion)?\s*)?(\d{1,4})\s*[.)]\s+(.+)/i);
        if (question) {
            store(); current = { number: Number(question[1]), grade: gradeValue(grade), text: question[2], options: [], correct: '', sourceErrors: [] };
            // Handle options following a question on the same line too.
            const optionStart = current.text.search(/\s+\(?A[.)]\s+/i);
            if (optionStart < 0) continue;
            line = current.text.slice(optionStart).trim(); current.text = current.text.slice(0, optionStart).trim();
        }
        if (!current) continue;
        const options = [...line.matchAll(/(?:^|\s)\(?([A-D])[.)]\s+/gi)];
        if (options.length) {
            options.forEach((match, i) => {
                const id = match[1].toUpperCase();
                if (current.options.some(o => o.id === id)) current.sourceErrors.push(`Option ${id} is repeated in the source.`);
                current.options.push({ id, text: line.slice(match.index + match[0].length, options[i + 1]?.index ?? line.length).trim() });
            });
        } else if (current.options.length) current.options.at(-1).text += ' ' + line;
        else current.text += ' ' + line;
    }
    store();
    if (!rows.length) throw new Error('No numbered questions found. Use the sample Word format. Scanned/image-only PDFs need conversion to readable text first.');
    if (rows.length > MAX_QUESTIONS) throw new Error(`Import at most ${MAX_QUESTIONS.toLocaleString()} questions per file.`);
    const counts = new Map(); rows.forEach(r => counts.set(r.number, (counts.get(r.number) || 0) + 1));
    for (const row of rows) {
        if (counts.get(row.number) > 1) row.sourceErrors.push('Repeated question number: number the document continuously.');
        if (keyCounts.get(row.number) > 1) row.sourceErrors.push('Repeated answer-key number.');
        if (keys.has(row.number)) {
            if (row.correct && row.correct !== keys.get(row.number)) row.sourceErrors.push('Inline answer and final key disagree.');
            row.correct = keys.get(row.number);
        }
        row.options.sort((a, b) => a.id.localeCompare(b.id)); row.errors = questionErrors(row);
    }
    const unused = [...keys.keys()].filter(n => !counts.has(n));
    if (unused.length) warnings.push(`Answer keys without questions: ${unused.join(', ')}.`);
    warnings.push('Review extracted wording, options and answer keys before importing. Images, formulas and document formatting are not imported.');
    return { rows, warnings };
}

function parseStudentRows(lines, defaults = {}) {
    if (!lines.length) throw new Error('The first sheet needs a header and student rows.');
    const aliases = { fullname: 'name', studentname: 'name', roll: 'rollNum', rollnum: 'rollNum', rollno: 'rollNum', rollnumber: 'rollNum',
        name: 'name', grade: 'grade', class: 'grade', section: 'section', password: 'password' };
    const headers = lines[0].map(value => aliases[String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')] || '');
    for (const required of ['name', 'rollNum', 'password']) if (!headers.includes(required)) throw new Error('Required columns: Name, Roll Number, Password. Include Grade or choose a default grade. Section is optional.');
    if (headers.filter(Boolean).length !== new Set(headers.filter(Boolean)).size) throw new Error('Column names are repeated. Keep one column for each field.');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].some(v => v !== null && v !== undefined && String(v).trim())) continue;
        const record = Object.fromEntries(headers.filter(Boolean).map(h => [h, lines[i][headers.indexOf(h)]]));
        const text = key => typeof record[key] === 'object' && record[key] !== null ? '' : String(record[key] ?? '').trim();
        const errors = [];
        // Preserve password spaces and Excel text roll numbers (including leading zeros).
        const password = record.password == null || typeof record.password === 'object' ? '' : String(record.password);
        const row = { number: i + 1, name: text('name'), rollNum: text('rollNum'),
            grade: gradeValue(text('grade') || defaults.grade), password, section: '', errors };
        try { row.section = sectionName(text('section') || defaults.section); } catch (error) { errors.push(error.message); }
        if (!row.name || row.name.length > 100) errors.push('Name must have 1–100 characters.');
        if (!row.rollNum || row.rollNum.length > 40) errors.push('Roll number must have 1–40 characters.');
        if (row.grade === null) errors.push('Provide Grade 4–7 or Hifz in the sheet or choose a default grade.');
        if (password.length < 6 || Buffer.byteLength(password) > 72) errors.push('Password must have at least 6 characters and at most 72 bytes.');
        if (['name', 'rollNum', 'grade', 'section', 'password'].some(k => typeof record[k] === 'object' && record[k] !== null)) errors.push('Use plain cell values; formulas and linked cells are not accepted.');
        rows.push(row);
        if (rows.length > MAX_STUDENTS) throw new Error(`Import at most ${MAX_STUDENTS.toLocaleString()} students per file.`);
    }
    if (!rows.length) throw new Error('No student rows found in the first sheet.');
    return { rows, warnings: ['Only the first sheet is read. Format roll numbers and passwords as Text in Excel to preserve leading zeros. Existing accounts are never changed.'] };
}
module.exports = { gradeValue, parseQuestionText, parseStudentRows, questionErrors, questionKey, studentKey, MAX_QUESTIONS, MAX_STUDENTS };
