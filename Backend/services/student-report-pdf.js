const PDFDocument = require('pdfkit');
const path = require('node:path');
const BLUE = '#171293', INK = '#18244D', MUTED = '#53617D', BORDER = '#DDE4F0';
const SCHOOL = 'Dar-e-Arqam School', CAMPUS = 'Metroville SITE Campus, Karachi';
const SCHOOL_LOGO = path.join(__dirname, '../assets/school/dar-e-arqam.png');
const grade = value => Number(value) === 0 ? 'Hifz' : `Grade ${value}`;
const percent = value => Number.isFinite(value) ? `${Number(value.toFixed(2))}%` : '-';
const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const duration = value => Number.isFinite(value) ? `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}` : '-';
function reportPdf(report) {
    return renderReports([report], `QuizBoard - ${report.student.name} - Student Report`, true);
}
function gradeReportPdf(reports, selectedGrade) {
    return renderReports(reports, `QuizBoard - ${grade(selectedGrade)} - Student Reports`);
}
function renderReports(reports, title, singlePage = false) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true,
            info: { Title: title, Author: `${SCHOOL} ${CAMPUS}`, Subject: 'Student performance reports' } });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
        doc.registerFont('StudentUnicode', path.join(__dirname, '../assets/fonts/NotoSansArabic.ttf'));
        const left = 44, width = doc.page.width - 88;
        let y = 0;
        function text(value, x, top, w, size = 10, bold = false, color = INK, align = 'left') {
            const copy = String(value ?? '-'), unicode = /[^\x00-\x7F]/.test(copy);
            doc.font(unicode ? 'StudentUnicode' : bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
            // Shape an Arabic-script name/title as one run, preserving word order.
            const features = /[\u0600-\u06FF]/.test(copy) && !/[A-Za-z]/.test(copy) ? {} : undefined;
            doc.text(copy, x, top, { width: w, lineGap: 2, features, align });
            return doc.y - top;
        }
        function heading(continued = false) {
            doc.rect(0, 0, doc.page.width, 7).fill('#FFF100');
            doc.image(SCHOOL_LOGO, left, 20, { fit: [46, 46], align: 'left', valign: 'center' });
            text(SCHOOL, left + 58, 24, width - 165, 17, true, BLUE);
            text(CAMPUS, left + 58, 46, width - 165, 10, false, MUTED);
            text('QuizBoard', left + width - 80, 28, 80, 12, true, BLUE, 'right');
            doc.moveTo(left, 74).lineTo(left + width, 74).lineWidth(.7).strokeColor(BORDER).stroke();
            text(continued ? 'Student Report - continued' : 'Student Report', left, 83, width, 12, true);
            y = 104;
        }
        function ensure(height, title) {
            if (y + height <= doc.page.height - 65) return false;
            doc.addPage(); heading(true);
            if (title) { text(title, left, y, width, 12, true, BLUE); y += 23; }
            return true;
        }
        const tableOverhead = 56;
        function rowHeight(row, columns) {
            return Math.max(22, ...row.map((value, i) => {
                const unicode = /[^\x00-\x7F]/.test(String(value));
                doc.font(unicode ? 'StudentUnicode' : 'Helvetica').fontSize(8);
                return doc.heightOfString(String(value ?? '-'), { width: columns[i].width - 12, lineGap: 2 }) + 12;
            }));
        }
        function table(title, columns, rows, total = rows.length) {
            ensure(tableOverhead + (rows.length ? rowHeight(rows[0], columns) : 0));
            text(title, left, y, width, 12, true, BLUE);
            if (total > rows.length) text(`Showing ${rows.length} of ${total}`, left, y + 2, width, 8, false, MUTED, 'right');
            y += 19;
            function header() {
                doc.rect(left, y, width, 21).fill(BLUE);
                let x = left;
                columns.forEach(column => { text(column.name, x + 6, y + 6, column.width - 12, 8, true, '#FFFFFF'); x += column.width; });
                y += 21;
            }
            header();
            if (!total) { text('No records.', left + 6, y + 4, width - 12, 9, false, MUTED); y += 21; return; }
            rows.forEach((row, index) => {
                const height = rowHeight(row, columns);
                if (!singlePage && ensure(height, `${title} (continued)`)) header();
                if (index % 2 === 1) doc.rect(left, y, width, height).fill('#F5F7FC');
                let x = left;
                row.forEach((value, i) => { text(value, x + 6, y + 6, columns[i].width - 12, 8); x += columns[i].width; });
                doc.moveTo(left, y + height).lineTo(left + width, y + height).lineWidth(.5).strokeColor(BORDER).stroke();
                y += height;
            });
            y += tableOverhead - 40;
        }
        try {
          for (const [studentIndex, report] of reports.entries()) {
            if (studentIndex) doc.addPage();
            const firstPage = doc.bufferedPageRange().count;
            heading();
            y += text(report.student.name, left, y, width, 20, true, BLUE) + 8;
            const fatherLabelHeight = text('Father name:', left, y, 68, 11);
            const fatherHeight = text(report.student.fatherName || '-', left + 70, y, width - 70, 11);
            y += Math.max(fatherLabelHeight, fatherHeight) + 5;
            y += text(`Roll ${report.student.rollNum} | ${grade(report.student.grade)} | Section: ${report.student.section}`, left, y, width, 11) + 5;
            y += text(`Computer | ${date(report.generatedAt)}`, left, y, width, 9, false, MUTED) + 12;
            const metrics = [['Quizzes Taken', report.summary.quizzesTaken], ['Average Quiz Marks', percent(report.summary.averageQuiz)],
                ['Best Quiz Score', percent(report.summary.bestQuiz)], ['Assignment Average', percent(report.summary.assignmentAverage)],
                ['Worksheet Average', percent(report.summary.worksheetAverage)]];
            metrics.forEach(([label, value], i) => {
                const w = (width - 24) / metrics.length, x = left + i * (w + 6);
                doc.roundedRect(x, y, w, 42, 5).fillAndStroke('#F5F7FC', BORDER);
                text(label, x + 7, y + 7, w - 14, 8, false, MUTED);
                text(value, x + 7, y + 21, w - 14, 14, true, BLUE);
            });
            y += 54;
            const plotted = report.quizzes.filter(row => row.percentage != null).slice(-20);
            ensure(125); text(report.summary.scoredQuizzes > 20 ? 'Quiz Performance - Latest 20' : 'Quiz Performance', left, y, width, 12, true, BLUE); y += 19;
            if (plotted.length) {
                const chartLeft = left + 28, chartTop = y + 12, chartWidth = width - 40, chartHeight = 60;
                [0, 50, 100].forEach(value => {
                    const top = chartTop + chartHeight * (1 - value / 100);
                    text(`${value}%`, left, top - 4, 26, 7, false, MUTED);
                    doc.moveTo(chartLeft, top).lineTo(chartLeft + chartWidth, top).lineWidth(.5).strokeColor(BORDER).stroke();
                });
                const slotWidth = chartWidth / plotted.length, barWidth = Math.min(68, slotWidth * .68);
                plotted.forEach((row, i) => {
                    const center = chartLeft + (i + .5) * slotWidth, height = chartHeight * row.percentage / 100, top = chartTop + chartHeight - height;
                    doc.roundedRect(center - barWidth / 2, chartTop, barWidth, chartHeight, Math.min(4, barWidth / 4)).fill('#F0F2FC');
                    if (height > 0) doc.rect(center - barWidth / 2, top, barWidth, height).fill(BLUE);
                    else doc.moveTo(center - barWidth / 2, top).lineTo(center + barWidth / 2, top).lineWidth(1.5).strokeColor(BLUE).stroke();
                    text(percent(row.percentage), center - slotWidth / 2, top - 12, slotWidth, plotted.length > 10 ? 6 : 9, true, BLUE, 'center');
                });
                if (plotted.length === 1) text(date(plotted[0].date), chartLeft, chartTop + chartHeight + 8, chartWidth, 8, false, MUTED, 'center');
                else {
                    text(date(plotted[0].date), chartLeft, chartTop + chartHeight + 8, 120, 8, false, MUTED);
                    text(date(plotted.at(-1).date), chartLeft + chartWidth - 100, chartTop + chartHeight + 8, 100, 8, false, MUTED, 'right');
                }
                y += chartHeight + 37;
            } else { text('No quiz results.', left, y, width, 9, false, MUTED); y += 21; }
            const quizColumns = [['Date', 88], ['Section', 143], ['Score', 86], ['Marks %', 90], ['Time', width - 407]].map(([name, width]) => ({ name, width }));
            const absences = report.absences || [];
            const history = [...report.quizzes, ...absences].sort((a, b) => new Date(a.date) - new Date(b.date)).reverse();
            const quizRows = history.map(row => row.absent
                ? [date(row.date), row.section, 'Absent', '-', '-']
                : [date(row.date), row.section, `${row.score ?? '-'} / ${row.total ?? '-'}`, percent(row.percentage), duration(row.elapsedMs)]);
            const assignmentColumns = [['Assignment', 175], ['Date', 84], ['Marks', 75], ['Marks %', 70], ['Feedback', width - 404]].map(([name, width]) => ({ name, width }));
            const workRows = rows => rows.map(row => [row.title, date(row.gradedAt || row.submittedAt),
                row.status === 'graded' ? `${row.marks ?? '-'} / ${row.maxMarks ?? '-'}` : '-', percent(row.percentage),
                row.status === 'absent' ? 'Absent' : row.status === 'graded' ? (row.feedback || 'Graded') : 'Awaiting marking']);
            const sections = [
                { title: absences.length ? `Quiz History (Absent: ${absences.length})` : 'Quiz History', columns: quizColumns, rows: quizRows },
                { title: 'Assignment Marks', columns: assignmentColumns, rows: workRows(report.assignments) },
                { title: 'Worksheet Marks', columns: [{ ...assignmentColumns[0], name: 'Worksheet' }, ...assignmentColumns.slice(1)], rows: workRows(report.worksheets) }
            ];
            if (singlePage) {
                // Keep the latest rows from each section and reserve room for every heading.
                let remaining = doc.page.height - 65 - y - tableOverhead * sections.length;
                const counts = sections.map(() => 0);
                let added;
                do {
                    added = false;
                    for (const [i, { columns, rows }] of sections.entries()) {
                        if (counts[i] >= rows.length) continue;
                        const height = rowHeight(rows[counts[i]], columns);
                        if (height > remaining) continue;
                        remaining -= height;
                        counts[i]++;
                        added = true;
                    }
                } while (added);
                sections.forEach(({ title, columns, rows }, i) => table(title, columns, rows.slice(0, counts[i]), rows.length));
            } else {
                sections.forEach(({ title, columns, rows }) => table(title, columns, rows));
            }
            const range = doc.bufferedPageRange();
            for (let i = firstPage - 1; i < range.start + range.count; i++) {
                doc.switchToPage(i); const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
                text(`${SCHOOL} - ${CAMPUS} | Roll ${report.student.rollNum} | Page ${i - firstPage + 2} of ${range.count - firstPage + 1}`, left, doc.page.height - 30, width, 7, false, MUTED);
                doc.page.margins.bottom = bottom;
            }
            doc.switchToPage(range.start + range.count - 1);
          }
            doc.end();
        } catch (error) { doc.destroy(); reject(error); }
    });
}
module.exports = { reportPdf, gradeReportPdf };
