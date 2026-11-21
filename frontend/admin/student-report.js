(() => {
    const $ = id => document.getElementById(id), size = 10;
    let data = null, chosen = null, quizPage = 1, assignmentPage = 1, worksheetPage = 1, searchTimer, searchId = 0, reportId = 0;
    let directory, reportController, pdfController, started = false, allResultsQuery;
    let gradeSearchController, gradePdfController, gradeExportId = 0, gradeStudentCount = 0;
    let stopReportLoader = () => {};
    const make = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
    const pct = value => Number.isFinite(value) ? `${Number(value.toFixed(2))}%` : '—';
    const grade = value => Number(value) === 0 ? 'Hifz' : `Grade ${value}`;
    const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }) : 'Date unavailable';
    async function request(path, controller, pdf = false) {
        const token = localStorage.getItem('adminToken');
        if (!token) throw new Error('Please log in from the Teacher Dashboard to view student reports.');
        const response = await fetch(`${window.QUIZ_BACKEND_URL}/api/admin/student-reports/${path}`, {
            headers: { Authorization: `Bearer ${token}` }, signal: controller?.signal, cache: 'no-store'
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) throw new Error('Please log in again from the Teacher Dashboard.');
            let body; try { body = await response.json(); } catch { /* A hosting error may not be JSON. */ }
            throw new Error(body?.error || 'Could not load the student report. Please try again.');
        }
        return pdf ? response.blob() : response.json();
    }
    function savePdf(blob, filename) {
        const url = URL.createObjectURL(blob), link = make('a'); link.href = url; link.download = filename;
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    async function loadGradeStudents(resetSection = false) {
        const current = ++gradeExportId; gradeSearchController?.abort(); gradePdfController?.abort();
        gradeSearchController = new AbortController(); gradeStudentCount = 0;
        const selected = $('grade-report-grade').value, button = $('grade-report-download');
        button.disabled = true; button.textContent = 'Download Grade PDF'; $('grade-report-status').textContent = '';
        if (resetSection) $('grade-report-section').replaceChildren(new Option('All Sections', ''));
        $('grade-report-section').disabled = !selected;
        if (!selected) return;
        const section = $('grade-report-section').value;
        $('grade-report-status').textContent = 'Loading students…';
        try {
            const result = await request(`students?${new URLSearchParams({ grade: selected, section })}`, gradeSearchController);
            if (current !== gradeExportId) return;
            $('grade-report-section').replaceChildren(new Option('All Sections', ''), ...result.sections.map(name => new Option(name, name)));
            $('grade-report-section').value = result.sections.includes(section) ? section : '';
            if (section && !result.sections.includes(section)) return loadGradeStudents();
            gradeStudentCount = result.total; button.disabled = !gradeStudentCount;
            $('grade-report-status').textContent = `${gradeStudentCount} student${gradeStudentCount === 1 ? '' : 's'}`;
        } catch (error) {
            if (current === gradeExportId && error.name !== 'AbortError') $('grade-report-status').textContent = error.message;
        }
    }
    async function downloadGrade() {
        const selected = $('grade-report-grade').value;
        if (!selected || !gradeStudentCount) return;
        const current = gradeExportId, button = $('grade-report-download');
        gradePdfController?.abort(); gradePdfController = new AbortController(); button.disabled = true; button.textContent = 'Preparing PDF…';
        $('grade-report-status').textContent = '';
        try {
            const params = new URLSearchParams({ grade: selected, section: $('grade-report-section').value });
            const blob = await request(`grade/pdf?${params}`, gradePdfController, true);
            if (current !== gradeExportId) return;
            savePdf(blob, `QuizBoard-${selected === '0' ? 'Hifz' : `Grade-${selected}`}-student-reports.pdf`);
            $('grade-report-status').textContent = `${gradeStudentCount} student${gradeStudentCount === 1 ? '' : 's'}`;
        } catch (error) {
            if (current === gradeExportId && error.name !== 'AbortError') $('grade-report-status').textContent = error.message;
        } finally {
            if (current === gradeExportId) { button.textContent = 'Download Grade PDF'; button.disabled = !gradeStudentCount; }
        }
    }
    function setView(individual, student = null) {
        for (const [id, active] of [['all-results-tab', !individual], ['individual-report-tab', individual]]) {
            $(id).setAttribute('aria-selected', String(active)); $(id).tabIndex = active ? 0 : -1;
        }
        $('all-results-panel').hidden = individual; $('individual-report-panel').hidden = !individual;
        const url = new URL(location.href); individual ? url.searchParams.set('view', 'student') : url.searchParams.delete('view');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        if (!individual) return;
        const query = $('filter-roll').value.trim() || url.searchParams.get('rollNum') || '';
        const carrySearch = query !== allResultsQuery && (query || allResultsQuery !== undefined);
        allResultsQuery = query;
        if (student) {
            $('individual-name').value = student.name;
            selectStudent(student);
        } else if (!started || carrySearch) {
            if (carrySearch) {
                $('individual-name').value = query;
                $('individual-grade').value = '';
                $('individual-section').value = '';
            }
            scheduleSearch();
        }
        started = true;
    }
    function clearReport() {
        reportId++; reportController?.abort(); pdfController?.abort();
        stopReportLoader();
        data = null; chosen = null; $('individual-content').hidden = true; $('individual-download-pdf').disabled = true;
        $('individual-message').textContent = '';
    }
    function scheduleSearch() {
        clearReport();
        search();
    }
    async function search() {
        clearTimeout(searchTimer);
        const current = ++searchId;
        $('individual-search-retry').hidden = true;
        if (!directory) {
            $('individual-search-results').replaceChildren();
            $('individual-search-status').textContent = 'Loading students…';
            directory = request('directory').catch(error => { directory = null; throw error; });
        }
        try {
            const students = await directory;
            if (current !== searchId) return;
            const gradeFilter = $('individual-grade').value;
            const sectionFilter = $('individual-section');
            if (!sectionFilter.dataset.loaded || sectionFilter.dataset.grade !== gradeFilter) {
                ReportUtils.fillSections(sectionFilter, students, gradeFilter);
                sectionFilter.dataset.loaded = 'true';
                sectionFilter.dataset.grade = gradeFilter;
            }
            const query = $('individual-name').value.trim();
            const matches = ReportUtils.searchResults(ReportUtils.filterRows(students, { grade: gradeFilter, section: sectionFilter.value }), query);
            const visible = matches.slice(0, 50);
            $('individual-search-results').replaceChildren(...visible.map(student => match(student)));
            $('individual-search-status').textContent = !matches.length ? 'No students found.'
                : matches.length > visible.length ? `${visible.length} of ${matches.length} students`
                : `${matches.length} student${matches.length === 1 ? '' : 's'}`;
            const term = query.replace(/\s+/g, ' ').toLowerCase();
            const exact = matches.filter(student => [student.name, student.rollNum].some(value => value.trim().replace(/\s+/g, ' ').toLowerCase() === term));
            const candidate = exact.length === 1 ? exact[0] : matches.length === 1 ? matches[0] : null;
            if (query && candidate) searchTimer = setTimeout(() => selectStudent(candidate), 180);
        } catch (error) {
            if (current !== searchId || error.name === 'AbortError') return;
            $('individual-search-results').replaceChildren(); $('individual-search-status').textContent = error.message;
            $('individual-search-retry').hidden = false;
        }
    }
    function match(student, selected = false) {
        const button = make('button', null, `individual-match${selected ? ' selected' : ''}`); button.type = 'button';
        const copy = make('span'); copy.append(make('strong', student.name), make('small', `Roll ${student.rollNum} · ${grade(student.grade)} · Section ${student.section}`));
        button.append(copy, make('span', selected ? '✓' : '›', 'individual-match-check'));
        button.setAttribute('aria-label', `${student.name}, roll ${student.rollNum}, ${grade(student.grade)}, section ${student.section}`);
        button.onclick = () => selectStudent(student); return button;
    }
    async function selectStudent(student) {
        clearTimeout(searchTimer);
        searchId++;
        stopReportLoader();
        reportController?.abort(); pdfController?.abort(); reportController = new AbortController();
        chosen = student; data = null; quizPage = 1; assignmentPage = 1; worksheetPage = 1; const current = ++reportId;
        $('individual-content').hidden = true; $('individual-download-pdf').disabled = true;
        $('individual-message').textContent = ''; $('individual-search-results').replaceChildren(match(student, true));
        $('individual-search-status').textContent = '';
        stopReportLoader = window.QuizLoader?.show($('individual-loader'), 'Loading student report…') || (() => {});
        try {
            const report = await request(encodeURIComponent(student.key), reportController);
            if (current !== reportId) return;
            data = report; chosen = report.student; render(); $('individual-content').hidden = false;
            $('individual-download-pdf').disabled = false;
        } catch (error) { if (current === reportId && error.name !== 'AbortError') $('individual-message').textContent = error.message; }
        finally { if (current === reportId) stopReportLoader(); }
    }
    function render() {
        const { student, summary } = data;
        $('individual-download-pdf').textContent = 'Download PDF';
        $('individual-student-name').textContent = student.name;
        $('individual-father-name').textContent = `Father name: ${student.fatherName || '—'}`;
        $('individual-initials').textContent = student.name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
        $('individual-student-meta').textContent = `Roll ${student.rollNum} · ${grade(student.grade)} · Section ${student.section}`;
        $('individual-generated').textContent = `As of ${date(data.generatedAt)}`;
        const metrics = [['Quizzes Taken', summary.quizzesTaken], ['Average Quiz Marks', pct(summary.averageQuiz)],
            ['Best Quiz Score', pct(summary.bestQuiz)], ['Assignment Average', pct(summary.assignmentAverage)], ['Worksheet Average', pct(summary.worksheetAverage)]];
        $('individual-metrics').replaceChildren(...metrics.map(([label, value]) => { const card = make('div', null, 'individual-metric'); card.append(make('span', label), make('strong', String(value))); return card; }));
        renderChart(); renderHistory('quiz'); renderHistory('assignment'); renderHistory('worksheet');
    }
    function renderChart() {
        const rows = data.quizzes.filter(row => row.percentage != null).slice(-20), container = $('individual-chart'); container.replaceChildren();
        $('individual-chart-title').textContent = data.summary.scoredQuizzes > rows.length ? 'Quiz Performance · Latest 20' : 'Quiz Performance';
        if (!rows.length) { container.append(make('p', 'No quiz results.', 'individual-empty')); return; }
        const scroller = make('div', null, 'individual-chart-scroll'), chart = make('div', null, 'individual-chart'), plot = make('div', null, 'individual-chart-plot');
        chart.style.minWidth = `${rows.length * 64 + 44}px`;
        plot.setAttribute('role', 'img'); plot.setAttribute('aria-label', `Quiz marks, oldest to newest: ${rows.map(row => pct(row.percentage)).join(', ')}`);
        for (const value of [100, 50, 0]) { const grid = make('div', null, 'individual-chart-grid'); grid.style.top = `${100 - value}%`; grid.append(make('span', `${value}%`)); plot.append(grid); }
        const bars = make('div', null, 'individual-chart-bars');
        for (const row of rows) {
            const column = make('div', null, 'individual-chart-column'), track = make('div', null, 'individual-chart-bar-track'), bar = make('div', null, 'individual-chart-bar');
            bar.style.height = `${row.percentage}%`; bar.title = `${date(row.date)} · ${pct(row.percentage)} · ${row.score} / ${row.total}`;
            const label = make('strong', pct(row.percentage), 'individual-chart-bar-label');
            label.style.bottom = `calc(${row.percentage}% + 8px)`;
            const caption = make('span', date(row.date), 'individual-chart-date');
            track.append(bar, label); column.append(track, caption); bars.append(column);
        }
        plot.append(bars); chart.append(plot); scroller.append(chart); container.append(scroller);
    }
    function renderHistory(kind) {
        const quiz = kind === 'quiz', worksheet = kind === 'worksheet', absent = quiz ? (data.absences || []).length : 0;
        const rows = quiz ? [...data.quizzes, ...(data.absences || [])].sort((a, b) => new Date(a.date) - new Date(b.date)).reverse() : worksheet ? (data.worksheets || []) : data.assignments;
        const pages = Math.max(1, Math.ceil(rows.length / size)); let page = Math.min(quiz ? quizPage : worksheet ? worksheetPage : assignmentPage, pages);
        if (quiz) quizPage = page; else if (worksheet) worksheetPage = page; else assignmentPage = page;
        const visible = rows.slice((page - 1) * size, page * size), container = $(`individual-${kind}-history`); container.replaceChildren();
        $(`individual-${kind}-count`).textContent = `${rows.length} ${quiz ? (rows.length === 1 ? 'quiz' : 'quizzes') : (rows.length === 1 ? kind : kind + 's')}${absent ? ` · ${absent} absent` : ''}`;
        if (!rows.length) container.append(make('p', quiz ? 'No quiz results.' : worksheet ? 'No worksheets.' : 'No assignments.', 'individual-empty'));
        else {
            const table = make('table', null, `individual-table${quiz ? '' : ' individual-assignment-table'}`), head = make('thead'), tr = make('tr'), body = make('tbody');
            (quiz ? ['Date', 'Grade / Section', 'Score', 'Marks %', 'Time'] : [worksheet ? 'Worksheet' : 'Assignment', 'Date', 'Marks', 'Marks %', 'Feedback']).forEach(label => { const th = make('th', label); th.scope = 'col'; tr.append(th); });
            head.append(tr); table.append(head, body);
            const cards = make('div', null, 'individual-history-cards');
            for (const row of visible) {
                const feedback = row.status === 'absent' ? 'Absent' : row.status === 'graded' ? (row.feedback || 'Graded') : 'Awaiting marking';
                const marks = quiz ? (row.absent ? 'Absent' : `${row.score ?? '—'} / ${row.total ?? '—'}`) : row.status === 'graded' ? `${row.marks ?? '—'} / ${row.maxMarks ?? '—'}` : '—';
                const when = date(quiz ? row.date : row.gradedAt || row.submittedAt), meta = `${grade(row.grade)} · ${row.section}`;
                const record = make('tr');
                const cells = quiz ? [when, meta, marks, pct(row.percentage), ReportUtils.duration(row.elapsedMs)]
                    : [row.title, when, marks, pct(row.percentage), feedback];
                cells.forEach((value, i) => { const td = make('td', row.absent && i === 2 ? null : value); if (row.absent && i === 2) td.append(make('span', 'Absent', 'absent-badge')); if (!quiz && i === 0) td.append(make('small', meta)); record.append(td); }); body.append(record);
                const card = make('article', null, 'individual-history-card'); card.append(make('strong', quiz ? when : row.title), make('p', quiz ? meta : `${when} · ${meta}`));
                const values = make('div', null, 'individual-history-values'); values.append(make('span', `Marks: ${marks}`), make('strong', pct(row.percentage))); card.append(values);
                card.append(make('p', quiz ? `Time: ${ReportUtils.duration(row.elapsedMs)}` : feedback)); cards.append(card);
            }
            container.append(table, cards);
        }
        $(`individual-${kind}-prev`).disabled = page <= 1; $(`individual-${kind}-next`).disabled = page >= pages;
        $(`individual-${kind}-page`).textContent = `Page ${page} of ${pages}`;
    }
    async function download() {
        if (!data) return;
        pdfController?.abort(); pdfController = new AbortController(); const current = reportId, student = data.student;
        $('individual-download-pdf').disabled = true; $('individual-download-pdf').textContent = 'Preparing PDF…'; $('individual-message').textContent = '';
        try {
            const blob = await request(`${encodeURIComponent(student.key)}/pdf`, pdfController, true);
            if (current !== reportId) return;
            const name = student.name.normalize('NFKC').replace(/[^\p{L}\p{N}\p{M} _-]/gu, '').trim().replace(/\s+/g, '-').slice(0, 100) || 'Student';
            savePdf(blob, `${name}-report.pdf`);
        } catch (error) { if (current === reportId && error.name !== 'AbortError') $('individual-message').textContent = error.message; }
        finally { if (current === reportId) { $('individual-download-pdf').textContent = 'Download PDF'; $('individual-download-pdf').disabled = !data; } }
    }
    $('all-results-tab').onclick = () => setView(false); $('individual-report-tab').onclick = () => setView(true);
    for (const id of ['all-results-tab', 'individual-report-tab']) $(id).addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const next = event.key === 'Home' ? false : event.key === 'End' ? true : id === 'all-results-tab';
        setView(next); $(next ? 'individual-report-tab' : 'all-results-tab').focus();
    });
    $('individual-name').addEventListener('input', scheduleSearch);
    $('individual-grade').onchange = () => { $('individual-section').value = ''; scheduleSearch(); };
    $('individual-section').onchange = scheduleSearch; $('individual-search-retry').onclick = search;
    for (const kind of ['quiz', 'assignment', 'worksheet']) for (const direction of ['prev', 'next']) $(`individual-${kind}-${direction}`).onclick = () => {
        if (kind === 'quiz') quizPage += direction === 'next' ? 1 : -1; else if (kind === 'worksheet') worksheetPage += direction === 'next' ? 1 : -1; else assignmentPage += direction === 'next' ? 1 : -1;
        renderHistory(kind);
    };
    $('individual-download-pdf').onclick = download;
    $('grade-report-grade').onchange = () => loadGradeStudents(true);
    $('grade-report-section').onchange = () => loadGradeStudents();
    $('grade-report-download').onclick = downloadGrade;
    document.addEventListener('quiz-results:cleared', () => { if (chosen) selectStudent(chosen); });
    document.addEventListener('quiz-report:open-student', event => {
        const student = event.detail?.student;
        if (!student?.key) return;
        setView(true, student);
        document.querySelector('.report-view-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    setView(new URLSearchParams(location.search).get('view') === 'student');
})();
