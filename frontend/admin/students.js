const BACKEND_URL = window.QUIZ_BACKEND_URL || 'https://quiz-system-hpy5.onrender.com';
const token = localStorage.getItem('adminToken');
const $ = id => document.getElementById(id);
let students = [];
let visibleStudents = [];
const filters = () => ({ grade: $('student-filter-grade').value, section: $('student-filter-section').value, search: $('student-search').value });
document.documentElement.dataset.theme = localStorage.getItem('quizTheme') || 'light';
async function request(path, body, method) {
    const response = await fetch(`${BACKEND_URL}/api${path}`, {
        method: method || (body ? 'POST' : 'GET'), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : {};
    if (!response.ok) {
        throw new Error(data.error || 'Could not complete request.');
    }
    return data;
}
function node(tag, text) { const el = document.createElement(tag); if (text) el.textContent = text; return el; }
function render() {
    $('students-list').replaceChildren();
    visibleStudents = ReportUtils.filterRows(students, filters());
    $('students-count').textContent = `${visibleStudents.length} of ${students.length} students shown`;
    $('export-students-btn').disabled = !visibleStudents.length;
    for (const student of visibleStudents) {
        const grade = student.grade === 0 ? 'Hifz' : `Grade ${student.grade}`;
        const card = node('article'); card.className = 'student-account-card';
        const header = node('div'); header.className = 'student-account-header';
        const identity = node('div'); identity.className = 'student-account-identity';
        identity.append(node('h3', student.name), node('p', `${grade} · ${ReportUtils.section(student)} · Roll ${student.rollNum}`));
        identity.append(node('p', `Father name: ${student.fatherName || '—'}`));
        header.append(identity); card.append(header);
        const controls = node('div'); controls.className = 'student-account-controls';
        const actions = node('div'); actions.className = 'student-account-actions'; header.append(actions);
        const editButton = node('button', 'Edit Profile'); editButton.type = 'button'; editButton.className = 'btn-secondary';
        editButton.setAttribute('aria-expanded', 'false'); actions.append(editButton);
        const editor = node('form'); editor.className = 'student-account-form student-profile-editor hidden';
        editor.id = `profile-${student.id}`; editButton.setAttribute('aria-controls', editor.id);
        const nameInput = node('input'); nameInput.id = `name-${student.id}`; nameInput.required = true; nameInput.maxLength = 100;
        const fatherInput = node('input'); fatherInput.id = `father-name-${student.id}`; fatherInput.maxLength = 100;
        const gradeInput = node('select'); gradeInput.id = `grade-${student.id}`;
        for (const value of [4, 5, 6, 7, 0]) { const option = node('option', value === 0 ? 'Hifz' : `Grade ${value}`); option.value = value; gradeInput.append(option); }
        const sectionInput = node('input'); sectionInput.id = `section-${student.id}`; sectionInput.maxLength = 80;
        sectionInput.placeholder = 'Unassigned'; sectionInput.setAttribute('list', 'section-suggestions');
        const fields = node('div'); fields.className = 'student-profile-fields';
        for (const [text, input] of [['Name', nameInput], ['Father name', fatherInput], ['Grade', gradeInput], ['Section', sectionInput]]) {
            const field = node('div'); field.className = 'field'; const label = node('label', text); label.htmlFor = input.id; field.append(label, input); fields.append(field);
        }
        const editorActions = node('div'); editorActions.className = 'student-account-actions';
        const save = node('button', 'Save Changes'); save.type = 'submit';
        const cancel = node('button', 'Cancel'); cancel.type = 'button'; cancel.className = 'btn-secondary';
        const editStatus = node('p'); editStatus.setAttribute('role', 'status');
        editorActions.append(save, cancel); editor.append(fields, editorActions, editStatus); card.append(editor);
        const closeEditor = () => { editor.classList.add('hidden'); editButton.setAttribute('aria-expanded', 'false'); editButton.focus(); };
        editButton.onclick = () => {
            if (!editor.classList.contains('hidden')) { closeEditor(); return; }
            nameInput.value = student.name; gradeInput.value = student.grade;
            fatherInput.value = student.fatherName || '';
            sectionInput.value = student.section === 'Unassigned' ? '' : student.section || '';
            editStatus.textContent = ''; editor.classList.remove('hidden'); editButton.setAttribute('aria-expanded', 'true'); nameInput.focus();
        };
        cancel.onclick = closeEditor;
        editor.onsubmit = async event => {
            event.preventDefault(); save.disabled = true; cancel.disabled = true; editButton.disabled = true; editStatus.textContent = '';
            try {
                const updated = await request(`/admin/students/${student.id}/profile`, { name: nameInput.value, fatherName: fatherInput.value, grade: gradeInput.value, section: sectionInput.value });
                if ($('student-filter-grade').value && Number($('student-filter-grade').value) !== updated.grade) $('student-filter-grade').value = String(updated.grade);
                if ($('student-filter-section').value && ReportUtils.section(updated) !== ReportUtils.section(student)) $('student-filter-section').value = '';
                if ($('student-search').value && updated.name !== student.name) $('student-search').value = '';
                $('account-message').textContent = 'Profile saved.';
                await load();
                document.getElementById(`profile-${student.id}`)?.closest('article')?.querySelector('.student-account-actions button')?.focus();
            } catch (error) { editStatus.textContent = error.message; }
            finally { save.disabled = false; cancel.disabled = false; editButton.disabled = false; }
        };
        const form = node('form'); form.className = 'student-account-form'; const label = node('label', 'New password');
        const password = node('input'); password.type = 'password'; password.required = true; password.minLength = 6; password.maxLength = 72;
        password.autocomplete = 'new-password'; password.id = `reset-${student.id}`; label.htmlFor = password.id;
        const button = node('button', 'Reset Password'); button.type = 'submit'; button.className = 'btn-secondary';
        const status = node('p'); status.setAttribute('role', 'status');
        const passwordRow = node('div'); passwordRow.className = 'student-control-row'; passwordRow.append(password, button);
        form.append(label, passwordRow, status);
        form.onsubmit = async event => {
            event.preventDefault(); button.disabled = true;
            try { const data = await request(`/admin/students/${student.id}/password`, { password: password.value }); status.textContent = data.message; password.value = ''; }
            catch (error) { status.textContent = error.message; }
            finally { button.disabled = false; }
        };
        const quizRecords = node('div'); quizRecords.className = 'student-quiz-records';
        const recordsButton = node('button', 'Quiz Records'); recordsButton.type = 'button'; recordsButton.className = 'btn-secondary';
        recordsButton.setAttribute('aria-expanded', 'false');
        const recordsPanel = node('div'); recordsPanel.className = 'student-quiz-records-panel hidden';
        const recordsSelect = node('select'); recordsSelect.setAttribute('aria-label', `Quiz records for ${student.name}`);
        const deleteRecordButton = node('button', 'Delete Selected Record'); deleteRecordButton.type = 'button'; deleteRecordButton.className = 'btn-danger';
        const recordsStatus = node('p'); recordsStatus.setAttribute('role', 'status');
        const recordsRow = node('div'); recordsRow.className = 'student-quiz-records-row'; recordsRow.append(recordsSelect, deleteRecordButton);
        recordsPanel.append(recordsRow, recordsStatus); quizRecords.append(recordsButton, recordsPanel);
        const loadRecords = async () => {
            recordsButton.disabled = true; recordsStatus.textContent = ''; recordsButton.textContent = 'Loading\u2026';
            try {
                const records = await request(`/admin/students/${student.id}/quiz-records`);
                recordsSelect.replaceChildren();
                for (const record of records) {
                    const option = node('option'); option.value = record.id;
                    option.textContent = `${new Date(record.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' })} \u00b7 ${record.score}/${record.total} \u00b7 ${record.percentage}%`;
                    option.dataset.attemptId = record.attemptId || ''; option.dataset.record = JSON.stringify(record); recordsSelect.append(option);
                }
                deleteRecordButton.disabled = records.length === 0;
                if (!records.length) recordsStatus.textContent = 'No quiz records.';
            } catch (error) { recordsStatus.textContent = error.message; deleteRecordButton.disabled = true; }
            finally { recordsButton.disabled = false; recordsButton.textContent = 'Quiz Records'; }
        };
        recordsButton.onclick = async () => {
            const opening = recordsPanel.classList.contains('hidden'); recordsPanel.classList.toggle('hidden', !opening);
            recordsButton.setAttribute('aria-expanded', String(opening));
            if (opening) await loadRecords();
        };
        deleteRecordButton.onclick = async () => {
            const option = recordsSelect.selectedOptions[0]; if (!option) return;
            const record = JSON.parse(option.dataset.record);
            const date = new Date(record.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' });
            if (!confirm(`Delete this quiz record for ${student.name}?\nRoll ${student.rollNum} \u00b7 ${grade} \u00b7 ${ReportUtils.section(student)}\n${date} \u00b7 ${record.score}/${record.total} (${record.percentage}%)\n\nOnly this quiz record will be removed. This cannot be undone.`)) return;
            deleteRecordButton.disabled = true; recordsStatus.textContent = 'Deleting\u2026';
            try {
                const data = await request(`/admin/students/${student.id}/quiz-records/${record.id}`, { attemptId: record.attemptId }, 'DELETE');
                await loadRecords(); recordsStatus.textContent = data.message;
            } catch (error) { recordsStatus.textContent = error.message; }
            finally { deleteRecordButton.disabled = recordsSelect.options.length === 0; }
        };
        controls.append(form, quizRecords); card.append(controls); $('students-list').append(card);
        const deleteButton = node('button'); deleteButton.type = 'button'; deleteButton.className = 'btn-danger student-delete-btn';
        deleteButton.setAttribute('aria-label', `Delete ${student.name}`); deleteButton.title = `Delete ${student.name}`;
        deleteButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>';
        deleteButton.onclick = async () => {
            if (!confirm(`Delete ${student.name}'s account and all of their quiz results and assignment submissions? This cannot be undone.`)) return;
            deleteButton.disabled = true;
            try { const data = await request(`/admin/students/${student.id}`, undefined, 'DELETE'); $('account-message').textContent = data.message; await load(); }
            catch (error) { $('account-message').textContent = error.message; deleteButton.disabled = false; }
        };
        actions.append(deleteButton);
    }
    if (!$('students-list').children.length) $('students-list').append(node('p', 'No students found.'));
}
async function load() {
    const stopLoading = QuizLoader.show($('students-list'), 'Loading students…');
    try {
        students = await request('/admin/students');
        ReportUtils.fillSections($('student-filter-section'), students, $('student-filter-grade').value);
        $('section-suggestions').replaceChildren();
        for (const name of ReportUtils.sections(students)) { const option = node('option'); option.value = name; $('section-suggestions').append(option); }
        render();
    }
    catch (error) { $('account-message').textContent = error.message; render(); }
    finally { stopLoading(); }
}
$('student-search').oninput = render;
$('student-filter-section').onchange = render;
$('student-filter-grade').onchange = () => { ReportUtils.fillSections($('student-filter-section'), students, $('student-filter-grade').value); render(); };
$('export-students-btn').onclick = () => { if (visibleStudents.length) ReportUtils.download(ReportUtils.studentCsv(visibleStudents), 'students', filters()); };
$('account-form').onsubmit = async event => {
    event.preventDefault(); $('create-account').disabled = true;
    try {
        await request('/admin/students', { name: $('account-name').value, fatherName: $('account-father-name').value, rollNum: $('account-roll').value, grade: $('account-grade').value, section: $('account-section').value, password: $('account-password').value });
        $('account-message').textContent = 'Account created.';
        $('account-form').reset(); await load();
    } catch (error) { $('account-message').textContent = error.message; }
    finally { $('create-account').disabled = false; }
};
if (!token) { $('account-form').classList.add('hidden'); $('account-message').textContent = 'Please log in from the Teacher Dashboard first.'; } else load();
document.addEventListener('bulk-import:completed', event => { if (event.detail.kind === 'students') load(); });
