const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('node:path');
const grade = value => Number(value) === 0 ? 'Hifz' : `Grade ${value}`;
const duration = value => Number.isFinite(value) ? `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}` : '-';
const stamp = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }) : '-';
const columns = ['Student Name', 'Roll Number', 'Grade', 'Section', 'Quiz Score', 'Marks %', 'Time', 'Flags', 'Assignment %', 'Timestamp'];
const values = row => [row.name || '-', row.rollNum || '-', grade(row.grade), row.section, `${row.score} / ${row.total}`,
    row.percentage, duration(row.elapsedMs), (row.tabSwitchCount || 0) + (row.fullscreenExitCount || 0), row.assignmentPercentage, stamp(row.date)];
function scope(filters) {
    return [filters.grade ? grade(filters.grade) : 'All Grades', filters.section || 'All Sections',
        filters.attempts === 'latest' ? 'Latest Attempt' : 'All Attempts', filters.rollNum ? `Roll: ${filters.rollNum}` : ''].filter(Boolean).join(' | ');
}
async function resultsWorkbook(rows, filters) {
    const book = new ExcelJS.Workbook(); book.creator = 'Dar-e-Arqam School Metroville Campus';
    const sheet = book.addWorksheet('Quiz Results', { views: [{ state: 'frozen', ySplit: 5 }] });
    sheet.mergeCells('A1:J1'); sheet.getCell('A1').value = 'Dar-e-Arqam School - Metroville Campus';
    sheet.mergeCells('A2:J2'); sheet.getCell('A2').value = 'Quiz Results';
    sheet.mergeCells('A3:J3'); sheet.getCell('A3').value = scope(filters);
    sheet.mergeCells('A4:J4'); sheet.getCell('A4').value = `${rows.length} results`;
    sheet.addRow(columns);
    for (const row of rows) sheet.addRow(values(row).map(value => value == null ? '' : value));
    [28, 17, 13, 24, 15, 13, 13, 10, 16, 25].forEach((width, i) => { sheet.getColumn(i + 1).width = width; });
    sheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF171293' } };
    sheet.getRow(2).font = { bold: true, size: 13 };
    sheet.getRow(5).height = 26;
    sheet.getRow(5).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF171293' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
    sheet.eachRow((row, index) => { row.alignment = { vertical: 'middle', wrapText: true }; if (index > 5) {
        row.height = 32;
        [6, 9].forEach(column => { const cell = row.getCell(column); if (typeof cell.value === 'number') cell.numFmt = '0.00"%"'; });
    } });
    sheet.autoFilter = { from: 'A5', to: `J${Math.max(5, sheet.rowCount)}` };
    sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.headerFooter.oddFooter = '&LQuizBoard&C&P of &N';
    return book.xlsx.writeBuffer();
}
function resultsPdf(rows, filters) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true,
            info: { Title: 'QuizBoard - Filtered Quiz Results', Author: 'Dar-e-Arqam School Metroville Campus' } });
        const chunks = []; doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
        doc.registerFont('Names', path.join(__dirname, '../assets/fonts/NotoSansArabic.ttf'));
        const blue = '#171293', ink = '#18244D', muted = '#53617D', border = '#DDE4F0';
        const widths = [148, 58, 49, 121, 60, 55, 46, 34, 72, 126], left = 36, width = widths.reduce((a, b) => a + b, 0);
        let y;
        function font(value, bold = false) { return /[^\x00-\x7F]/.test(String(value)) ? 'Names' : bold ? 'Helvetica-Bold' : 'Helvetica'; }
        function shaping(value) { return /[\u0600-\u06FF]/.test(String(value)) && !/[A-Za-z]/.test(String(value)) ? {} : undefined; }
        function text(value, x, top, w, size = 8, bold = false, color = ink) {
            doc.font(font(value, bold)).fontSize(size).fillColor(color).text(String(value), x, top, { width: w, lineGap: 2, features: shaping(value) });
        }
        function heading() {
            doc.rect(0, 0, doc.page.width, 6).fill('#FFF100');
            doc.image(path.join(__dirname, '../assets/school/dar-e-arqam.png'), left, 19, { fit: [49, 49] });
            text('Dar-e-Arqam School', left + 60, 23, 400, 17, true, blue);
            text('Metroville Campus', left + 60, 48, 400, 10, false, muted);
            text('QuizBoard', doc.page.width - 135, 29, 100, 14, true, blue);
            text('Quiz Results', left, 82, width, 15, true, blue);
            text(scope(filters), left, 106, width, 9, false, muted);
            text(`${rows.length} results`, left, 123, width, 8, false, muted);
            y = 143; doc.rect(left, y, width, 31).fill(blue);
            let x = left; columns.forEach((column, i) => { text(column, x + 5, y + 7, widths[i] - 10, 7.5, true, '#FFFFFF'); x += widths[i]; }); y += 31;
        }
        try {
            heading();
            rows.forEach((row, index) => {
                const cells = values(row).map((value, i) => value == null ? '-' : [5, 8].includes(i) ? `${Number(value.toFixed(2))}%` : String(value));
                const height = Math.max(34, ...cells.map((value, i) => doc.font(font(value)).fontSize(8).heightOfString(value, { width: widths[i] - 10, lineGap: 2, features: shaping(value) }) + 16));
                if (y + height > doc.page.height - 49) { doc.addPage(); heading(); }
                if (index % 2) doc.rect(left, y, width, height).fill('#F5F7FC');
                let x = left; cells.forEach((value, i) => { text(value, x + 5, y + 8, widths[i] - 10); x += widths[i]; });
                y += height; doc.moveTo(left, y).lineTo(left + width, y).lineWidth(.5).strokeColor(border).stroke();
            });
            const pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                doc.font('Helvetica').fontSize(8).fillColor(muted).text(`QuizBoard | Page ${i + 1} of ${pages.count}`, left, doc.page.height - 33, { lineBreak: false });
            }
            doc.end();
        } catch (error) { doc.destroy(); reject(error); }
    });
}
module.exports = { resultsWorkbook, resultsPdf };
