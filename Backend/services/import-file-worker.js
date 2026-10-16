// File readers run off the request thread with a deadline and memory budget.
const { parentPort, workerData } = require('node:worker_threads');
const { parseQuestionText, parseStudentRows } = require('./import-parser');
async function checkZip(buffer) {
    const yauzl = require('yauzl');
    await new Promise((resolve, reject) => yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
        if (error) return reject(new Error('This is not a readable Word/Excel file.'));
        let count = 0, total = 0, done = false;
        const fail = message => { if (!done) { done = true; zip.close(); reject(new Error(message)); } };
        zip.on('error', () => fail('The document archive is damaged.'));
        zip.on('end', () => { if (!done) { done = true; resolve(); } });
        zip.on('entry', entry => {
            if (++count > 10000 || entry.generalPurposeBitFlag & 1) return fail('Use an unencrypted document with fewer archive entries.');
            if (entry.uncompressedSize > 30 * 1024 * 1024 || total + entry.uncompressedSize > 80 * 1024 * 1024) return fail('The expanded document is too large. Split it into smaller files.');
            if (entry.fileName.endsWith('/')) return zip.readEntry();
            zip.openReadStream(entry, (err, stream) => {
                if (err) return fail('The document archive is damaged.');
                stream.on('error', () => fail('The document archive is damaged.'));
                stream.on('data', chunk => { total += chunk.length; if (total > 80 * 1024 * 1024) { stream.destroy(); fail('The expanded document is too large.'); } });
                stream.on('end', () => { if (!done) zip.readEntry(); });
            });
        }); zip.readEntry();
    }));
}
async function readFile() {
    const { kind, extension, defaults } = workerData, buffer = Buffer.from(workerData.data);
    if (extension !== '.pdf') await checkZip(buffer);
    if (kind === 'students') {
        const Excel = require('exceljs'), book = new Excel.Workbook();
        await book.xlsx.load(buffer);
        const sheet = book.worksheets[0];
        if (!sheet || sheet.rowCount > 10001 || sheet.columnCount > 100) throw new Error('Use a first sheet with at most 10,000 rows and 100 columns.');
        const lines = [];
        sheet.eachRow({ includeEmpty: true }, row => { lines.push(row.values.slice(1)); });
        return parseStudentRows(lines, defaults);
    }
    let text;
    if (extension === '.docx') {
        text = (await require('mammoth').extractRawText({ buffer })).value;
    } else {
        if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('The file is not a valid PDF.');
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false });
        try {
            const info = await parser.getInfo();
            if (info.total > 200) throw new Error('Use at most 200 PDF pages per file.');
            text = (await parser.getText({ pageJoiner: '\n' })).text;
        } finally { await parser.destroy(); }
    }
    return parseQuestionText(text, defaults.grade);
}
readFile().then(value => parentPort.postMessage({ value }), error => parentPort.postMessage({ error: error.message }))
    .finally(() => parentPort.close());
