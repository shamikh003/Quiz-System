(function (root) {
    const section = row => (row.section || 'Unassigned').trim() || 'Unassigned';
    const key = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
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
        return csv([['Name', 'Roll Number', 'Grade', 'Section'], ...rows.map(row => [row.name, row.rollNum, gradeLabel(row.grade), section(row)])]);
    }
    function download(text, prefix, filters = {}) {
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url;
        const suffix = [filters.grade !== '' && filters.grade != null ? gradeLabel(filters.grade) : 'All Grades', filters.section || 'All Sections'].join('-').replace(/[^\p{L}\p{N}_-]+/gu, '-');
        link.download = `${prefix}-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    const api = { section, filterRows, sections, fillSections, gradeLabel, percent, duration, csv, resultCsv, studentCsv, download };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ReportUtils = api;
})(typeof window === 'undefined' ? globalThis : window);
