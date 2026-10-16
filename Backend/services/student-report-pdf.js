const PDFDocument = require('pdfkit');
const path = require('node:path');
const BLUE = '#171293', INK = '#18244D', MUTED = '#53617D', BORDER = '#DDE4F0';
const grade = value => Number(value) === 0 ? 'Hifz' : `Grade ${value}`;
const percent = value => Number.isFinite(value) ? `${Number(value.toFixed(2))}%` : '-';
const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const duration = value => Number.isFinite(value) ? `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}` : '-';
function reportPdf(report) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true,
            info: { Title: `QuizBoard - ${report.student.name} - Student Report`, Author: 'QuizBoard', Subject: 'Individual student performance' } });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
        doc.registerFont('StudentUnicode', path.join(__dirname, '../assets/fonts/NotoSansArabic.ttf'));
        const left = 44, width = doc.page.width - 88;
        let y = 0;
        function text(value, x, top, w, size = 10, bold = false, color = INK) {
            const copy = String(value ?? '-'), unicode = /[^\x00-\x7F]/.test(copy);
            doc.font(unicode ? 'StudentUnicode' : bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
            // Shape an Arabic-script name/title as one run, preserving word order.
            const features = /[\u0600-\u06FF]/.test(copy) && !/[A-Za-z]/.test(copy) ? {} : undefined;
            doc.text(copy, x, top, { width: w, lineGap: 2, features });
            return doc.y - top;
        }
        function heading(continued = false) {
            doc.rect(0, 0, doc.page.width, 7).fill('#FFF100');
            doc.roundedRect(left, 32, 25, 29, 5).fill(BLUE);
            doc.roundedRect(left + 6, 37, 12, 18, 2).fill('#FFFFFF');
            doc.moveTo(left + 12, 50).lineTo(left + 16, 54).lineTo(left + 23, 45).lineWidth(3).strokeColor('#FFF100').stroke();
            text('QuizBoard', left + 36, 34, 220, 23, true, BLUE);
            text(continued ? 'Individual Student Report - continued' : 'Individual Student Report', left, 76, width, 15, true);
            y = 104;
        }
        function ensure(height, title) {
            if (y + height <= doc.page.height - 65) return false;
            doc.addPage(); heading(true);
            if (title) { text(title, left, y, width, 12, true, BLUE); y += 23; }
            return true;
        }
        function table(title, columns, rows) {
            ensure(65); text(title, left, y, width, 13, true, BLUE); y += 25;
            function header() {
                doc.rect(left, y, width, 26).fill(BLUE);
                let x = left;
                columns.forEach(column => { text(column.name, x + 6, y + 8, column.width - 12, 8, true, '#FFFFFF'); x += column.width; });
                y += 26;
            }
            header();
            if (!rows.length) { text('No records.', left + 7, y + 12, width - 14, 10, false, MUTED); y += 40; }
            rows.forEach((row, index) => {
                let height = 30;
                row.forEach((value, i) => {
                    const unicode = /[^\x00-\x7F]/.test(String(value));
                    doc.font(unicode ? 'StudentUnicode' : 'Helvetica').fontSize(8);
                    height = Math.max(height, doc.heightOfString(String(value ?? '-'), { width: columns[i].width - 12, lineGap: 2 }) + 16);
                });
                if (ensure(height, `${title} (continued)`)) header();
                if (index % 2 === 1) doc.rect(left, y, width, height).fill('#F5F7FC');
                let x = left;
                row.forEach((value, i) => { text(value, x + 6, y + 8, columns[i].width - 12, 8); x += columns[i].width; });
                doc.moveTo(left, y + height).lineTo(left + width, y + height).lineWidth(.5).strokeColor(BORDER).stroke();
                y += height;
            });
            y += 24;
        }
        try {
            heading();
            y += text(report.student.name, left, y, width, 20, true, BLUE) + 8;
            const fatherLabelHeight = text('Father name:', left, y, 68, 11);
            const fatherHeight = text(report.student.fatherName || '-', left + 70, y, width - 70, 11);
            y += Math.max(fatherLabelHeight, fatherHeight) + 5;
            y += text(`Roll ${report.student.rollNum} | ${grade(report.student.grade)} | Section ${report.student.section}`, left, y, width, 11) + 5;
            y += text(`Computer | ${date(report.generatedAt)}`, left, y, width, 9, false, MUTED) + 12;
            const metrics = [['Quizzes Taken', report.summary.quizzesTaken], ['Average Quiz Marks', percent(report.summary.averageQuiz)],
                ['Best Quiz Score', percent(report.summary.bestQuiz)], ['Assignment Average', percent(report.summary.assignmentAverage)]];
            metrics.forEach(([label, value], i) => {
                const w = (width - 12) / 2, x = left + (i % 2) * (w + 12), top = y + Math.floor(i / 2) * 70;
                doc.roundedRect(x, top, w, 60, 5).fillAndStroke('#F5F7FC', BORDER);
                text(label, x + 12, top + 10, w - 24, 9, false, MUTED);
                text(value, x + 12, top + 29, w - 24, 19, true, BLUE);
            });
            y += 145;
            const plotted = report.quizzes.filter(row => row.percentage != null).slice(-20);
            ensure(160); text(report.summary.scoredQuizzes > 20 ? 'Quiz Performance - Latest 20' : 'Quiz Performance', left, y, width, 13, true, BLUE); y += 22;
            if (plotted.length) {
                const chartLeft = left + 28, chartTop = y, chartWidth = width - 40, chartHeight = 86;
                [0, 50, 100].forEach(value => {
                    const top = chartTop + chartHeight * (1 - value / 100);
                    text(`${value}%`, left, top - 4, 26, 7, false, MUTED);
                    doc.moveTo(chartLeft, top).lineTo(chartLeft + chartWidth, top).lineWidth(.5).strokeColor(BORDER).stroke();
                });
                plotted.forEach((row, i) => {
                    const x = chartLeft + (plotted.length === 1 ? chartWidth / 2 : i / (plotted.length - 1) * chartWidth), top = chartTop + chartHeight * (1 - row.percentage / 100);
                    if (i) {
                        const previous = plotted[i - 1];
                        doc.moveTo(chartLeft + (i - 1) / (plotted.length - 1) * chartWidth, chartTop + chartHeight * (1 - previous.percentage / 100))
                            .lineTo(x, top).lineWidth(1.6).strokeColor(BLUE).stroke();
                    }
                    doc.circle(x, top, 2.4).fill(BLUE);
                });
                text(date(plotted[0].date), chartLeft, chartTop + chartHeight + 8, 120, 8, false, MUTED);
                text(date(plotted.at(-1).date), chartLeft + chartWidth - 90, chartTop + chartHeight + 8, 100, 8, false, MUTED);
                y += chartHeight + 38;
            } else { text('No quiz results.', left, y + 8, width, 10, false, MUTED); y += 40; }
            const quizColumns = [['Date', 78], ['Grade', 45], ['Section', 118], ['Score', 76], ['Marks %', 90], ['Time', width - 407]].map(([name, width]) => ({ name, width }));
            table('Quiz History', quizColumns, [...report.quizzes].reverse().map(row => [date(row.date), grade(row.grade), row.section,
                `${row.score ?? '-'} / ${row.total ?? '-'}`, percent(row.percentage), duration(row.elapsedMs)]));
            const assignmentColumns = [['Assignment', 150], ['Date', 74], ['Grade', 45], ['Marks', 70], ['Marks %', 65], ['Status', width - 404]].map(([name, width]) => ({ name, width }));
            table('Assignment History', assignmentColumns, report.assignments.map(row => [row.title, date(row.gradedAt || row.submittedAt), grade(row.grade),
                row.status === 'graded' ? `${row.marks ?? '-'} / ${row.maxMarks ?? '-'}` : '-', percent(row.percentage),
                row.status === 'graded' ? (row.archived ? 'Graded (archived)' : 'Graded') : 'Awaiting marking']));
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i); const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
                text(`QuizBoard | Roll ${report.student.rollNum} | Page ${i + 1} of ${range.count}`, left, doc.page.height - 30, width, 8, false, MUTED);
                doc.page.margins.bottom = bottom;
            }
            doc.end();
        } catch (error) { doc.destroy(); reject(error); }
    });
}
module.exports = { reportPdf };
