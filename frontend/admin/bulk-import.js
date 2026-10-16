// Shared, teacher-only preview/import dialog. File content is rendered as text.
(() => {
    let dialog, kind, batch, selected, page = 0, busy = false, polling, generation = 0;
    const size = 20, backend = window.QUIZ_BACKEND_URL;
    const el = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
    const $ = id => dialog.querySelector(`#${id}`);
    const savedKey = () => `qbBulkImport:${kind}`;
    async function request(path, options = {}) {
        const response = await fetch(`${backend}/api${path}`, { ...options, headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`, ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers
        } });
        let data; try { data = await response.json(); } catch { throw new Error('The server could not complete this request. Please try again.'); }
        if (!response.ok) throw Object.assign(new Error(data.error || 'Could not complete the import.'), { status: response.status });
        return data;
    }
    function message(text, error = false) { $('bulk-message').textContent = text; $('bulk-message').classList.toggle('error-text', error); }
    function lock(value) {
        busy = value;
        dialog.querySelectorAll('button, input, select, textarea').forEach(n => { n.disabled = value; });
        $('bulk-close').disabled = false;
        if (!value) { $('bulk-commit').disabled = batch?.status === 'failed' ? false : !selected?.size || !$('bulk-reviewed').checked; renderRows(); }
    }
    function newUpload() {
        clearTimeout(polling); generation++; batch = null; selected = new Set(); page = 0;
        localStorage.removeItem(savedKey()); $('bulk-upload').hidden = false; $('bulk-preview').hidden = true;
        $('bulk-upload').reset(); $('bulk-reviewed').checked = false; message('');
        $('bulk-grade').value = kind === 'questions' ? document.getElementById('filter-grade')?.value || '' : document.getElementById('account-grade')?.value || '';
    }
    function create() {
        dialog = el('dialog', undefined, 'qb-import-dialog');
        dialog.innerHTML = `<div class="qb-import-heading"><div><h2 id="bulk-title"></h2></div><button id="bulk-close" type="button" class="btn-secondary" aria-label="Close import">Close</button></div>
            <p id="bulk-message" role="status" aria-live="polite"></p>
            <form id="bulk-upload" class="qb-import-upload">
                <div class="qb-import-fields"><div class="field"><label for="bulk-grade" id="bulk-grade-label">Grade</label><select id="bulk-grade"><option value="">Choose grade</option><option value="4">Grade 4</option><option value="5">Grade 5</option><option value="6">Grade 6</option><option value="7">Grade 7</option><option value="0">Hifz</option></select></div>
                <div class="field" id="bulk-section-field"><label for="bulk-section">Default section (optional)</label><input id="bulk-section" maxlength="80" placeholder="Unassigned"></div></div>
                <div class="field"><label for="bulk-file" id="bulk-file-label">Choose a file</label><input type="file" id="bulk-file" required></div>
                <div class="qb-import-actions"><button type="submit">Read file &amp; preview</button><button type="button" id="bulk-template" class="btn-secondary">Download sample</button></div>
                <details class="qb-import-format"><summary>See the required format</summary><div id="bulk-format"></div></details>
            </form>
            <section id="bulk-preview" hidden aria-label="Import preview"><div class="qb-import-summary" id="bulk-summary"></div><div id="bulk-warnings" class="qb-import-warnings"></div>
                <div class="qb-import-actions" id="bulk-selection"><button type="button" id="bulk-select" class="btn-secondary">Select all valid rows</button><button type="button" id="bulk-deselect" class="btn-secondary">Deselect all</button><span id="bulk-selected"></span></div>
                <div id="bulk-progress-wrap" hidden><label for="bulk-progress">Import progress</label><progress id="bulk-progress" value="0" max="1"></progress><p id="bulk-progress-label"></p></div>
                <div id="bulk-rows" class="qb-import-rows"></div><div class="qb-import-pagination"><button type="button" id="bulk-prev" class="btn-secondary">Previous</button><span id="bulk-page"></span><button type="button" id="bulk-next" class="btn-secondary">Next</button></div>
                <label class="qb-import-review" id="bulk-review-label"><input type="checkbox" id="bulk-reviewed">Confirm selected rows</label>
                <div class="qb-import-actions"><button type="button" id="bulk-commit" disabled>Import selected rows</button><button type="button" id="bulk-new" class="btn-secondary">Choose another file</button></div>
            </section>`;
        dialog.setAttribute('aria-labelledby', 'bulk-title'); document.body.append(dialog);
        $('bulk-close').onclick = () => dialog.close();
        dialog.addEventListener('close', () => { clearTimeout(polling); generation++; });
        $('bulk-new').onclick = newUpload;
        $('bulk-upload').onsubmit = upload;
        $('bulk-template').onclick = downloadTemplate;
        $('bulk-prev').onclick = () => { page--; renderRows(); };
        $('bulk-next').onclick = () => { page++; renderRows(); };
        $('bulk-select').onclick = () => { selected = new Set(batch.rows.map((r, i) => !r.errors.length ? i : -1).filter(i => i >= 0)); renderRows(); };
        $('bulk-deselect').onclick = () => { selected.clear(); renderRows(); };
        $('bulk-reviewed').onchange = () => { $('bulk-commit').disabled = !selected.size || !$('bulk-reviewed').checked; };
        $('bulk-commit').onclick = commit;
    }
    async function upload(event) {
        event.preventDefault(); const file = $('bulk-file').files[0]; if (!file) return;
        if (file.size > 10 * 1024 * 1024) { message('Choose a file up to 10 MB.', true); return; }
        const body = new FormData(); body.append('file', file); body.append('grade', $('bulk-grade').value); body.append('section', $('bulk-section').value);
        const current = generation; lock(true); message('Reading file…');
        const loader = el('div'); dialog.append(loader); const stop = window.QuizLoader?.show(loader, 'Preparing your import preview…');
        try {
            const result = await request(`/admin/imports/${kind}/preview`, { method: 'POST', body });
            if (current !== generation) return;
            batch = result; localStorage.setItem(savedKey(), batch.id);
            selected = new Set(batch.rows.map((r, i) => !r.errors.length ? i : -1).filter(i => i >= 0));
            $('bulk-reviewed').checked = false; message(''); render(); dialog.scrollTop = 0;
        } catch (error) { if (current === generation) message(error.message, true); }
        finally { stop?.(); loader.remove(); if (current === generation) lock(false); }
    }
    function render() {
        $('bulk-upload').hidden = true; $('bulk-preview').hidden = false;
        const c = batch.counts, preview = batch.status === 'preview', working = ['queued', 'importing'].includes(batch.status);
        $('bulk-summary').textContent = preview ? `${batch.filename} · ${c.total} rows · ${c.ready} ready · ${c.total - c.ready} need attention`
            : `${c.imported} added · ${c.skipped} skipped · ${c.failed} failed`;
        $('bulk-warnings').replaceChildren(...batch.warnings.map(w => el('p', w)));
        $('bulk-selection').hidden = !preview; $('bulk-review-label').hidden = !preview;
        $('bulk-progress-wrap').hidden = preview;
        $('bulk-progress').max = Math.max(1, batch.selected.length); $('bulk-progress').value = c.processed;
        $('bulk-progress-label').textContent = `${c.processed} of ${batch.selected.length} selected rows processed.`;
        $('bulk-commit').hidden = !preview && batch.status !== 'failed';
        $('bulk-commit').textContent = batch.status === 'failed' ? 'Resume import' : 'Import selected rows';
        $('bulk-new').disabled = working; $('bulk-new').hidden = working;
        if (batch.status === 'failed') { $('bulk-commit').disabled = false; message(batch.error, true); }
        if (working) message('Importing…');
        if (batch.status === 'completed') message('Import complete.');
        renderRows();
    }
    function labeled(text, input) {
        const field = el('div', undefined, 'field'), label = el('label', text);
        input.id = `bulk-edit-${Math.random().toString(36).slice(2)}`; label.htmlFor = input.id; field.append(label, input); return field;
    }
    function editor(row, index) {
        const details = el('details', undefined, 'qb-import-editor'); details.append(el('summary', 'Correct extracted text or answer'));
        const form = el('form'); form.className = 'qb-import-edit-form';
        const text = el('textarea'); text.value = row.text; text.required = true; text.maxLength = 10000; form.append(labeled('Question', text));
        const inputs = 'ABCD'.split('').map(id => { const input = el('input'); input.value = row.options.find(o => o.id === id)?.text || ''; input.maxLength = 5000; input.required = id !== 'D'; form.append(labeled(`Option ${id}${id === 'D' ? ' (optional)' : ''}`, input)); return input; });
        const correct = el('select'); correct.append(el('option', 'Choose answer'));
        correct.firstElementChild.value = '';
        for (const id of 'ABCD') { const option = el('option', id); option.value = id; correct.append(option); } correct.value = row.correct;
        form.append(labeled('Correct answer', correct));
        const save = el('button', 'Update preview'); save.type = 'submit'; form.append(save); details.append(form);
        form.onsubmit = async event => {
            event.preventDefault(); lock(true); const current = generation;
            try {
                const options = inputs.map((input, i) => ({ id: 'ABCD'[i], text: input.value })).filter(o => o.id !== 'D' || o.text.trim());
                const result = await request(`/admin/imports/${batch.id}/rows/${index}`, { method: 'PATCH', body: JSON.stringify({ text: text.value, options, correct: correct.value, revision: batch.revision }) });
                if (current !== generation) return; batch = result;
                if (batch.rows[index].errors.length) selected.delete(index); else selected.add(index);
                $('bulk-reviewed').checked = false; render(); message('Preview updated.');
            } catch (error) { if (current === generation) message(error.message, true); }
            finally { if (current === generation) lock(false); }
        }; return details;
    }
    function renderRows() {
        if (!batch) return;
        const preview = batch.status === 'preview', container = $('bulk-rows'); container.replaceChildren();
        const pages = Math.max(1, Math.ceil(batch.rows.length / size)); page = Math.max(0, Math.min(page, pages - 1));
        batch.rows.slice(page * size, (page + 1) * size).forEach((row, offset) => {
            const index = page * size + offset, card = el('article', undefined, 'qb-import-row');
            const heading = el('div', undefined, 'qb-import-row-heading'), label = el('label', undefined, 'qb-import-row-check');
            if (preview) {
                const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(index);
                checkbox.disabled = busy || row.errors.length > 0; checkbox.setAttribute('aria-label', `Select row ${row.number}`);
                checkbox.onchange = () => { checkbox.checked ? selected.add(index) : selected.delete(index); $('bulk-reviewed').checked = false; updateSelection(); };
                label.append(checkbox);
            }
            label.append(el('strong', `${kind === 'questions' ? 'Question' : 'Sheet row'} ${row.number}`)); heading.append(label);
            const status = el('span', row.outcome || (row.errors.length ? 'Needs attention' : !preview && !batch.selected.includes(index) ? 'Not selected' : 'Ready'), `qb-import-tag${row.errors.length ? ' qb-import-tag-error' : ''}`); heading.append(status); card.append(heading);
            if (kind === 'questions') {
                card.append(el('p', row.text, 'qb-import-question'));
                const list = el('ul'); row.options.forEach(o => list.append(el('li', `${o.id}. ${o.text}`))); card.append(list);
                card.append(el('p', `${row.grade === 0 ? 'Hifz' : `Grade ${row.grade}`} · Correct answer: ${row.correct || 'Missing'}`, 'qb-import-key'));
            } else {
                card.append(el('p', `${row.name} · Roll ${row.rollNum} · ${row.grade === 0 ? 'Hifz' : row.grade === null ? 'Grade missing' : `Grade ${row.grade}`} · ${row.section}`));
                card.append(el('p', `Father name: ${row.fatherName || '—'}`));
            }
            if (row.errors.length) { const list = el('ul', undefined, 'error-text'); row.errors.forEach(error => list.append(el('li', error))); card.append(list); }
            if (row.note) card.append(el('p', row.note));
            if (preview && kind === 'questions') card.append(editor(row, index));
            container.append(card);
        });
        $('bulk-prev').disabled = busy || page === 0; $('bulk-next').disabled = busy || page >= pages - 1;
        $('bulk-page').textContent = `Page ${page + 1} of ${pages}`;
        updateSelection();
    }
    function updateSelection() {
        $('bulk-selected').textContent = `${selected?.size || 0} selected`;
        if (batch.status === 'preview') $('bulk-commit').disabled = busy || !selected?.size || !$('bulk-reviewed').checked;
    }
    async function commit() {
        if (busy || (batch.status === 'preview' && (!$('bulk-reviewed').checked || !selected.size))) return;
        lock(true); const current = generation;
        try {
            const result = await request(`/admin/imports/${batch.id}/commit`, { method: 'POST', body: JSON.stringify({ selected: [...selected], revision: batch.revision }) });
            if (current !== generation) return; batch = result;
            render(); dialog.scrollTop = 0; poll();
        } catch (error) { if (current === generation) message(error.message, true); }
        finally { if (current === generation) lock(false); }
    }
    function poll() {
        clearTimeout(polling); const current = generation;
        if (!dialog.open || !['queued', 'importing'].includes(batch.status)) return;
        polling = setTimeout(async () => {
            try {
                const result = await request(`/admin/imports/${batch.id}`);
                if (current !== generation) return; batch = result; render();
                if (batch.status === 'completed') { dialog.scrollTop = 0; document.dispatchEvent(new CustomEvent('bulk-import:completed', { detail: { kind } })); }
            } catch (error) { if (current === generation) message(`Progress unavailable: ${error.message} Reopen this dialog to check the saved import.`, true); }
            if (current === generation) poll();
        }, 2000);
    }
    async function downloadTemplate() {
        if (kind === 'questions') { const link = el('a'); link.href = 'samples/QuizBoard-questions-template.docx'; link.download = ''; link.click(); return; }
        try {
            const response = await fetch(`${backend}/api/admin/imports-template/students.xlsx`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });
            if (!response.ok) throw new Error('Could not download the sample. Please log in again or try later.');
            const url = URL.createObjectURL(await response.blob()), link = el('a'); link.href = url; link.download = 'QuizBoard-students-template.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { message(error.message, true); }
    }
    async function open(type) {
        if (!localStorage.getItem('adminToken')) { location.href = 'index.html'; return; }
        if (!dialog) create();
        clearTimeout(polling); generation++; kind = type; batch = null; selected = new Set(); page = 0; busy = false;
        $('bulk-title').textContent = type === 'questions' ? 'Import Questions' : 'Import Students';
        $('bulk-grade-label').textContent = type === 'questions' ? 'Grade for these questions' : 'Default grade (if not in sheet)';
        $('bulk-grade').required = type === 'questions'; $('bulk-section-field').hidden = type === 'questions';
        $('bulk-file').accept = type === 'questions' ? '.pdf,.docx' : '.xlsx';
        $('bulk-file-label').textContent = type === 'questions' ? 'PDF / Word (.docx), up to 10 MB' : 'Excel (.xlsx), up to 10 MB';
        $('bulk-format').replaceChildren(el('pre', type === 'questions' ? '1. Which device is used to type?\nA. Keyboard\nB. Monitor\nC. Printer\nD. Speaker\n\n2. Which device prints on paper?\nA. Mouse\nB. Printer\nC. Monitor\n\nAnswer Key\n1. A\n2. B' : 'Name | Father Name | Roll Number | Grade | Section | Password\nSample Student | Sample Father | 00401 | 4 | A | Sample123\nHifz Student | Sample Father | H-001 | Hifz | | Sample456'));
        const id = localStorage.getItem(savedKey());
        $('bulk-upload').hidden = false; $('bulk-preview').hidden = true; $('bulk-reviewed').checked = false;
        $('bulk-upload').reset(); $('bulk-grade').value = type === 'questions' ? document.getElementById('filter-grade')?.value || '' : document.getElementById('account-grade')?.value || '';
        lock(false); message(''); dialog.showModal();
        if (id) {
            const current = generation; message('Opening your saved import…');
            try {
                const result = await request(`/admin/imports/${id}`); if (current !== generation) return;
                batch = result; selected = new Set(batch.status === 'preview' ? batch.rows.map((r, i) => !r.errors.length ? i : -1).filter(i => i >= 0) : batch.selected); render(); poll();
                if (batch.status === 'preview') message('Your saved preview is ready. Review it before importing.');
                if (batch.status === 'completed') document.dispatchEvent(new CustomEvent('bulk-import:completed', { detail: { kind } }));
            } catch (error) { if (current !== generation) return; if (error.status === 404) localStorage.removeItem(savedKey()); message(error.message, true); }
        }
    }
    document.querySelectorAll('[data-bulk-import]').forEach(button => button.addEventListener('click', () => open(button.dataset.bulkImport)));
})();
