(function (root) {
    const TOP_SCORER_FLAG_LIMIT = 3;
    function topScoreEligible(row) {
        const switches = Number(row.tabSwitchCount ?? 0), exits = Number(row.fullscreenExitCount ?? 0);
        return Number.isFinite(switches) && switches >= 0 && Number.isFinite(exits) && exits >= 0
            && switches + exits <= TOP_SCORER_FLAG_LIMIT;
    }
    const section = row => (row.section || 'Unassigned').trim() || 'Unassigned';
    const key = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    function searchResults(rows, search = '') {
        const term = key(search);
        return term ? rows.filter(row => key(row.name).includes(term) || key(row.rollNum).includes(term)) : rows;
    }
    function filterRows(rows, filters = {}) {
        return rows.filter(row =>
            (filters.grade === '' || filters.grade == null || String(row.grade) === String(filters.grade)) &&
            (!filters.section || key(section(row)) === key(filters.section)) &&
            (!filters.roll || String(row.rollNum || '').toLowerCase().includes(key(filters.roll))) &&
            (!filters.search || `${row.name} ${row.rollNum} ${Number(row.grade) === 0 ? 'Hifz' : `Grade ${row.grade}`} ${section(row)}`.toLowerCase().includes(key(filters.search)))
        );
    }
    function sections(rows, grade = '') {
        const unique = new Map();
        for (const row of filterRows(rows, { grade })) if (!unique.has(key(section(row)))) unique.set(key(section(row)), section(row));
        return [...unique.values()].sort((a, b) => a.localeCompare(b));
    }
    function fillSections(select, rows, grade) {
        const selected = select.value;
        const all = document.createElement('option'); all.value = ''; all.textContent = 'All Sections';
        select.replaceChildren(all);
        for (const name of sections(rows, grade)) {
            const option = document.createElement('option'); option.value = name; option.textContent = name; select.append(option);
        }
        const matching = [...select.options].find(option => key(option.value) === key(selected));
        select.value = matching ? matching.value : '';
    }
    const gradeLabel = grade => Number(grade) === 0 ? 'Hifz' : `Grade ${grade}`;
    const percent = value => Number.isFinite(value) ? `${value.toFixed(2)}%` : '—';
    function duration(ms) {
        if (!Number.isFinite(ms) || ms < 0) return '—';
        return `${Math.floor(ms / 60000)}:${(Math.floor(ms % 60000) / 1000).toFixed(3).padStart(6, '0')}`;
    }
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    // Both mobile views consume the same ordered rows as the desktop tables/CSV.
    function resultCards(rows, { dashboard = false, ranked = false } = {}) {
        return rows.map((row, index) => {
            const flagCount = (row.tabSwitchCount || 0) + (row.fullscreenExitCount || 0);
            const pillClass = flagCount === 0 ? 'good' : flagCount <= 2 ? 'warn' : 'bad';
            const flagText = flagCount === 0 ? '0 · Clean' : `${flagCount} flag${flagCount === 1 ? '' : 's'}`;
            const score = escapeHtml(`${row.score} / ${row.total}`);
            const time = escapeHtml(duration(row.elapsedMs));
            const date = row.date ? new Date(row.date) : null;
            const validDate = date && Number.isFinite(date.getTime());
            const dateText = validDate ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }) : '—';
            const submittedAt = validDate ? date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Karachi' }) : '—';
            const assignment = row.assignmentPercentage == null ? '—' : `${row.assignmentPercentage}%`;
            return `<article class="mobile-result-card${dashboard ? ' dashboard-score-card' : ''}">
                <div class="mobile-result-header">
                    <span class="${ranked ? `result-rank${index === 0 ? ' result-rank-first' : ''}` : 'result-row-number'}" aria-label="${ranked ? 'Rank' : 'Row'} ${index + 1}">${index + 1}</span>
                    <div class="mobile-result-student">
                        <h3>${escapeHtml(row.name)}</h3>
                        <p class="mobile-result-meta">${dashboard ? '' : `Roll ${escapeHtml(row.rollNum)} · `}${escapeHtml(gradeLabel(row.grade))}${dashboard ? ' · ' : '<br>'}${escapeHtml(section(row))}</p>
                        ${dashboard ? `<p class="mobile-result-meta">${score} marks</p>` : ''}
                    </div>
                    <div class="mobile-result-score"><strong>${escapeHtml(percent(row.percentage))}</strong>${dashboard ? `<span>Time ${time}</span>` : ''}</div>
                </div>
                ${dashboard ? '' : `<div class="mobile-result-metrics">
                    <div><span>Quiz score</span><strong>${score}</strong></div>
                    <div><span>Completion time</span><strong>${time}</strong></div>
                </div>`}
                <details class="mobile-result-details">
                    <summary>View Details<span class="sr-only"> for ${escapeHtml(row.name)}</span></summary>
                    <dl class="mobile-result-detail-grid">
                        ${dashboard ? '' : `<div><dt>Assignment</dt><dd>${escapeHtml(assignment)}</dd></div>`}
                        <div><dt>Activity flags</dt><dd><span class="pill ${pillClass}">${flagText}</span></dd></div>
                        <div><dt>Date</dt><dd>${escapeHtml(dateText)}</dd></div>
                        ${dashboard ? '' : `<div><dt>Submitted at</dt><dd>${escapeHtml(submittedAt)}</dd></div>`}
                    </dl>
                </details>
            </article>`;
        }).join('');
    }
    function csv(rows) {
        // BOM preserves Urdu names in Excel; neutralize spreadsheet formulas.
        return '\uFEFF' + rows.map(row => row.map(value => {
            let text = String(value ?? '');
            if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
            return `"${text.replace(/"/g, '""')}"`;
        }).join(',')).join('\r\n');
    }
    function resultCsv(rows) {
        return csv([['Name', 'Roll Number', 'Grade', 'Section', 'Score', 'Total', 'Marks %', 'Time Taken', 'Timing Available', 'Flags', 'Assignment %', 'Timestamp'],
            ...rows.map(row => [row.name, row.rollNum, gradeLabel(row.grade), section(row), row.score, row.total,
                row.percentage ?? '', duration(row.elapsedMs), row.timingKnown ? 'Yes' : 'No',
                (row.tabSwitchCount || 0) + (row.fullscreenExitCount || 0), row.assignmentPercentage ?? '',
                row.date ? new Date(row.date).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }) : ''])]);
    }
    function studentCsv(rows) {
        return csv([['Name', 'Father Name', 'Roll Number', 'Grade', 'Section'], ...rows.map(row => [row.name, row.fatherName || '', row.rollNum, gradeLabel(row.grade), section(row)])]);
    }
    function download(text, prefix, filters = {}) {
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url;
        const suffix = [filters.grade !== '' && filters.grade != null ? gradeLabel(filters.grade) : 'All Grades', filters.section || 'All Sections'].join('-').replace(/[^\p{L}\p{N}_-]+/gu, '-');
        link.download = `${prefix}-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function marks(value) {
        const numeric = Number(value);
        const width = value != null && Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
        return `<span class="marks-cell"><span class="marks-value">${escapeHtml(percent(value))}</span><span class="marks-track" aria-hidden="true"><span style="width:${width}%"></span></span></span>`;
    }
    function rankBadge(index) {
        return `<span class="score-rank score-rank-${index + 1}">${index + 1}</span>`;
    }
    function topScorers(rows) {
        const identity = row => JSON.stringify([String(row.rollNum || '').trim(), Number(row.grade), key(section(row))]);
        const owners = new Map(), seen = new Set();
        for (const row of rows) if (row.student) {
            const legacy = identity(row), owner = String(row.student);
            owners.set(legacy, owners.has(legacy) && owners.get(legacy) !== owner ? null : owner);
        }
        return rows.filter(row => Number.isFinite(row.percentage) && topScoreEligible(row)).sort((a, b) => b.percentage - a.percentage
            || (a.timingKnown && Number.isFinite(a.elapsedMs) ? a.elapsedMs : Number.MAX_SAFE_INTEGER) - (b.timingKnown && Number.isFinite(b.elapsedMs) ? b.elapsedMs : Number.MAX_SAFE_INTEGER)
            || (new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0) || String(a._id).localeCompare(String(b._id)))
            .filter(row => {
                const owner = row.student ? String(row.student) : owners.get(identity(row));
                const id = owner ? `student:${owner}` : `legacy:${identity(row)}`;
                if (seen.has(id)) return false;
                seen.add(id); return true;
            });
    }
    const api = { section, filterRows, searchResults, sections, fillSections, gradeLabel, percent, duration, resultCards, csv, resultCsv, studentCsv, download, marks, rankBadge, topScorers, topScoreEligible, TOP_SCORER_FLAG_LIMIT };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ReportUtils = api;
})(typeof window === 'undefined' ? globalThis : window);
