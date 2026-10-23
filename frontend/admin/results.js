const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const gradeLabel = grade => Number(grade) === 0 ? 'Hifz' : `Grade ${grade}`;
const BACKEND_URL = window.QUIZ_BACKEND_URL || 'https://quiz-system-wf0d.onrender.com';
function getToken() { return localStorage.getItem('adminToken'); }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id);
    const exports = [$('export-pdf-btn'), $('export-excel-btn')], initial = new URLSearchParams(location.search);
    const filterGrade = $('filter-grade'), filterSection = $('filter-section'), filterRoll = $('filter-roll'), filterAttempts = $('filter-attempts');
    if ([...filterGrade.options].some(option => option.value === initial.get('grade'))) filterGrade.value = initial.get('grade');
    filterAttempts.value = initial.get('attempts') === 'latest' ? 'latest' : 'all';
    filterRoll.value = (initial.get('rollNum') || '').slice(0, 100);
    const filters = () => ({ grade: filterGrade.value, section: filterSection.value, rollNum: filterRoll.value.trim(), attempts: filterAttempts.value });
    let rows = [], sourceRows = [], applied = filters(), requestId = 0, controller, exportController, rollTimer;
    const disableExports = disabled => exports.forEach(button => { button.disabled = disabled; });
    if (getToken()) $('clear-results-btn').classList.remove('hidden');

    function render() {
        $('results-count').textContent = `${rows.length} ${rows.length === 1 ? 'result' : 'results'} · ${applied.attempts === 'latest' ? 'Latest Attempt' : 'All Attempts'}`;
        disableExports(!rows.length);
        if (!rows.length) {
            $('results-body').innerHTML = '<tr><td colspan="10" class="shell-empty">No results match these filters.</td></tr>';
            $('report-result-cards').innerHTML = '<p class="shell-empty" role="status">No results match these filters.</p>'; return;
        }
        $('report-result-cards').innerHTML = ReportUtils.resultCards(rows);
        $('results-body').innerHTML = rows.map(row => `<tr>
            <td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.rollNum)}</td><td>${gradeLabel(row.grade)}</td><td>${escapeHtml(ReportUtils.section(row))}</td>
            <td>${row.score} / ${row.total}</td><td>${ReportUtils.marks(row.percentage)}</td><td>${ReportUtils.duration(row.elapsedMs)}</td>
            <td>${(row.tabSwitchCount || 0) + (row.fullscreenExitCount || 0)}</td><td>${row.assignmentPercentage == null ? '—' : `${row.assignmentPercentage}%`}</td>
            <td>${row.date ? escapeHtml(new Date(row.date).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' })) : '—'}</td></tr>`).join('');
    }
    async function fetchResults(first = false) {
        const current = ++requestId; controller?.abort(); exportController?.abort();
        controller = new AbortController(); disableExports(true); $('results-note').textContent = '';
        const chosen = first ? { grade: '', section: '', rollNum: '', attempts: 'all' } : filters();
        const stopLoading = QuizLoader.show($('reports-loader'), 'Loading reports…');
        try {
            // Search both visible names and rolls, including during a backend rollout.
            const response = await fetch(`${BACKEND_URL}/api/results?${new URLSearchParams({ ...chosen, rollNum: '' })}`, { headers: authHeaders(), signal: controller.signal, cache: 'no-store' });
            if (!response.ok) throw new Error('Could not load reports. Please log in as teacher.');
            const data = await response.json();
            if (current !== requestId) return;
            if (!Array.isArray(data)) throw new Error('Could not load reports.');
            if (first) {
                sourceRows = data; ReportUtils.fillSections(filterSection, sourceRows, filterGrade.value);
                if ([...filterSection.options].some(option => option.value === initial.get('section'))) filterSection.value = initial.get('section');
            } else {
                const url = new URL(location.href);
                for (const [key, value] of Object.entries(chosen)) value && !(key === 'attempts' && value === 'all') ? url.searchParams.set(key, value) : url.searchParams.delete(key);
                history.replaceState(null, '', url.pathname + url.search + url.hash);
            }
            rows = ReportUtils.searchResults(data, chosen.rollNum); applied = chosen; render();
        } catch (error) {
            if (error.name === 'AbortError' || current !== requestId) return;
            rows = []; render(); $('results-note').textContent = error.message;
        } finally { stopLoading(); }
    }
    filterGrade.addEventListener('change', () => { clearTimeout(rollTimer); ReportUtils.fillSections(filterSection, sourceRows, filterGrade.value); fetchResults(); });
    filterSection.addEventListener('change', () => { clearTimeout(rollTimer); fetchResults(); });
    filterAttempts.addEventListener('change', () => { clearTimeout(rollTimer); fetchResults(); });
    filterRoll.addEventListener('input', () => { ++requestId; disableExports(true); controller?.abort(); exportController?.abort(); clearTimeout(rollTimer); rollTimer = setTimeout(() => fetchResults(), 250); });
    exports.forEach((button, index) => button.addEventListener('click', async () => {
        const format = index === 0 ? 'pdf' : 'xlsx', snapshot = applied, current = requestId;
        exportController?.abort(); exportController = new AbortController(); disableExports(true);
        const label = button.textContent; button.textContent = 'Preparing…'; $('results-note').textContent = '';
        try {
            const response = await fetch(`${BACKEND_URL}/api/results/export.${format}?${new URLSearchParams(snapshot)}`, { headers: authHeaders(), signal: exportController.signal, cache: 'no-store' });
            if (!response.ok) { let body; try { body = await response.json(); } catch {} throw new Error(body?.error || 'Could not download results.'); }
            const blob = await response.blob();
            if (current !== requestId) return;
            const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url;
            link.download = `QuizBoard-${snapshot.grade ? gradeLabel(snapshot.grade).replace(/ /g, '-') : 'All-Grades'}-${snapshot.attempts}-results.${format}`;
            document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch (error) { if (error.name !== 'AbortError') $('results-note').textContent = error.message; }
        finally { button.textContent = label; if (current === requestId) disableExports(!rows.length); }
    }));
    $('clear-results-btn').addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete ALL results from the database?')) return;
        const button = $('clear-results-btn'); button.disabled = true;
        try {
            const response = await fetch(`${BACKEND_URL}/api/results`, { method: 'DELETE', headers: authHeaders() });
            if (!response.ok) throw new Error('Could not delete results.');
            ++requestId; controller?.abort(); exportController?.abort(); clearTimeout(rollTimer);
            sourceRows = []; rows = []; ReportUtils.fillSections(filterSection, [], filterGrade.value); render();
            document.dispatchEvent(new CustomEvent('quiz-results:cleared'));
        } catch (error) { $('results-note').textContent = error.message; }
        finally { button.disabled = false; }
    });
    await fetchResults(true);
    if (['grade', 'section', 'rollNum', 'attempts'].some(key => initial.has(key))) await fetchResults();
});
