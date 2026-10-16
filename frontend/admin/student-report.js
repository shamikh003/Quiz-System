(() => {
    const $ = id => document.getElementById(id), size = 10;
    let data = null, chosen = null, quizPage = 1, assignmentPage = 1, searchTimer, searchId = 0, reportId = 0;
    let searchController, reportController, pdfController, started = false;
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
            if (response.status === 404) throw new Error('Student reports are temporarily unavailable, or this student record has changed. Please search again shortly.');
            if (response.status === 401 || response.status === 403) throw new Error('Please log in again from the Teacher Dashboard.');
            let body; try { body = await response.json(); } catch { /* A hosting error may not be JSON. */ }
            throw new Error(body?.error || 'Could not load the student report. Please try again.');
        }
        return pdf ? response.blob() : response.json();
    }
    function setView(individual) {
        for (const [id, active] of [['all-results-tab', !individual], ['individual-report-tab', individual]]) {
            $(id).setAttribute('aria-selected', String(active)); $(id).tabIndex = active ? 0 : -1;
        }
        $('all-results-panel').hidden = individual; $('individual-report-panel').hidden = !individual;
        const url = new URL(location.href); individual ? url.searchParams.set('view', 'student') : url.searchParams.delete('view');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        if (individual && !started) { started = true; search(); }
        else if (individual && chosen) selectStudent(chosen);
    }
    function clearReport() {
        reportId++; reportController?.abort(); pdfController?.abort();
        stopReportLoader();
        data = null; chosen = null; $('individual-content').hidden = true; $('individual-download-pdf').disabled = true;
        $('individual-message').textContent = '';
    }
    function scheduleSearch() {
        clearReport(); searchController?.abort(); searchId++; clearTimeout(searchTimer);
        $('individual-search-results').replaceChildren(); $('individual-search-status').textContent = 'Searching…';
        searchTimer = setTimeout(search, 250);
    }
    async function search() {
        clearTimeout(searchTimer); searchController?.abort(); searchController = new AbortController();
        const current = ++searchId;
        $('individual-search-retry').hidden = true; $('individual-search-status').textContent = 'Searching students…';
        const params = new URLSearchParams({ q: $('individual-name').value.trim(), grade: $('individual-grade').value, section: $('individual-section').value });
        try {
            const result = await request(`students?${params}`, searchController);
            if (current !== searchId) return;
            const section = $('individual-section').value;
            $('individual-section').replaceChildren(new Option('All Sections', ''), ...result.sections.map(name => new Option(name, name)));
            $('individual-section').value = result.sections.includes(section) ? section : '';
            $('individual-search-results').replaceChildren(...result.students.map(student => match(student)));
            $('individual-search-status').textContent = !result.total ? 'No students found.'
                : result.total > result.students.length ? `${result.students.length} of ${result.total} students`
                : `${result.total} student${result.total === 1 ? '' : 's'}`;
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
        stopReportLoader();
        reportController?.abort(); pdfController?.abort(); reportController = new AbortController();
        chosen = student; data = null; quizPage = 1; assignmentPage = 1; const current = ++reportId;
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
            ['Best Quiz Score', pct(summary.bestQuiz)], ['Assignment Average', pct(summary.assignmentAverage)]];
        $('individual-metrics').replaceChildren(...metrics.map(([label, value]) => { const card = make('div', null, 'individual-metric'); card.append(make('span', label), make('strong', String(value))); return card; }));
        renderChart(); renderHistory('quiz'); renderHistory('assignment');
    }
    function renderChart() {
        const rows = data.quizzes.filter(row => row.percentage != null).slice(-20), container = $('individual-chart'); container.replaceChildren();
        $('individual-chart-title').textContent = data.summary.scoredQuizzes > rows.length ? 'Quiz Performance · Latest 20' : 'Quiz Performance';
        if (!rows.length) { container.append(make('p', 'No quiz results.', 'individual-empty')); return; }
        const chart = make('div', null, 'individual-chart'), plot = make('div', null, 'individual-chart-plot');
        plot.setAttribute('role', 'img'); plot.setAttribute('aria-label', `Quiz marks, oldest to newest: ${rows.map(row => pct(row.percentage)).join(', ')}`);
        for (const value of [100, 50, 0]) { const grid = make('div', null, 'individual-chart-grid'); grid.style.top = `${100 - value}%`; grid.append(make('span', `${value}%`)); plot.append(grid); }
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 1000 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
        const points = rows.map((row, i) => [rows.length === 1 ? 500 : i / (rows.length - 1) * 1000, 100 - row.percentage]);
        const fill = document.createElementNS(svg.namespaceURI, 'polygon'); fill.setAttribute('points', `${points[0][0]},100 ${points.map(p => p.join(',')).join(' ')} ${points.at(-1)[0]},100`); fill.setAttribute('fill', 'var(--accent)'); fill.setAttribute('opacity', '.09'); svg.append(fill);
        const line = document.createElementNS(svg.namespaceURI, 'polyline'); line.setAttribute('points', points.map(p => p.join(',')).join(' ')); line.setAttribute('fill', 'none'); line.setAttribute('stroke', 'var(--accent)'); line.setAttribute('stroke-width', '2'); line.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(line); plot.append(svg);
        points.forEach(([x, y], i) => { const dot = make('span', null, 'individual-chart-dot'); dot.style.left = `${x / 10}%`; dot.style.top = `${y}%`; dot.title = `${date(rows[i].date)} · ${pct(rows[i].percentage)}`; plot.append(dot); });
        plot.append(make('span', date(rows[0].date), 'individual-chart-date'));
        if (rows.length > 1) plot.append(make('span', date(rows.at(-1).date), 'individual-chart-date'));
        chart.append(plot); container.append(chart);
    }
    function renderHistory(kind) {
        const quiz = kind === 'quiz', rows = quiz ? [...data.quizzes].reverse() : data.assignments;
        const pages = Math.max(1, Math.ceil(rows.length / size)); let page = Math.min(quiz ? quizPage : assignmentPage, pages);
        if (quiz) quizPage = page; else assignmentPage = page;
        const visible = rows.slice((page - 1) * size, page * size), container = $(`individual-${kind}-history`); container.replaceChildren();
        $(`individual-${kind}-count`).textContent = `${rows.length} ${quiz ? (rows.length === 1 ? 'quiz' : 'quizzes') : (rows.length === 1 ? 'assignment' : 'assignments')}`;
        if (!rows.length) container.append(make('p', quiz ? 'No quiz results.' : 'No assignments.', 'individual-empty'));
        else {
            const table = make('table', null, `individual-table${quiz ? '' : ' individual-assignment-table'}`), head = make('thead'), tr = make('tr'), body = make('tbody');
            (quiz ? ['Date', 'Grade / Section', 'Score', 'Marks %', 'Time'] : ['Assignment', 'Date', 'Marks', 'Marks %', 'Status']).forEach(label => { const th = make('th', label); th.scope = 'col'; tr.append(th); });
            head.append(tr); table.append(head, body);
            const cards = make('div', null, 'individual-history-cards');
            for (const row of visible) {
                const status = row.status === 'graded' ? (row.archived ? 'Graded · Archived' : 'Graded') : 'Awaiting marking';
                const marks = quiz ? `${row.score ?? '—'} / ${row.total ?? '—'}` : row.status === 'graded' ? `${row.marks ?? '—'} / ${row.maxMarks ?? '—'}` : '—';
                const when = date(quiz ? row.date : row.gradedAt || row.submittedAt), meta = `${grade(row.grade)} · ${row.section}`;
                const record = make('tr');
                const cells = quiz ? [when, meta, marks, pct(row.percentage), ReportUtils.duration(row.elapsedMs)]
                    : [row.title, when, marks, pct(row.percentage), status];
                cells.forEach((value, i) => { const td = make('td', value); if (!quiz && i === 0) td.append(make('small', meta)); record.append(td); }); body.append(record);
                const card = make('article', null, 'individual-history-card'); card.append(make('strong', quiz ? when : row.title), make('p', quiz ? meta : `${when} · ${meta}`));
                const values = make('div', null, 'individual-history-values'); values.append(make('span', `Marks: ${marks}`), make('strong', pct(row.percentage))); card.append(values);
                card.append(make('p', quiz ? `Time: ${ReportUtils.duration(row.elapsedMs)}` : status)); cards.append(card);
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
            const url = URL.createObjectURL(blob), link = make('a'); link.href = url;
            link.download = `QuizBoard-${student.rollNum.replace(/[^a-zA-Z0-9_-]/g, '_') || 'student'}-report.pdf`;
            document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
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
    for (const kind of ['quiz', 'assignment']) for (const direction of ['prev', 'next']) $(`individual-${kind}-${direction}`).onclick = () => {
        if (kind === 'quiz') quizPage += direction === 'next' ? 1 : -1; else assignmentPage += direction === 'next' ? 1 : -1;
        renderHistory(kind);
    };
    $('individual-download-pdf').onclick = download;
    document.addEventListener('quiz-results:cleared', () => { if (chosen) selectStudent(chosen); });
    setView(new URLSearchParams(location.search).get('view') === 'student');
})();
