const BACKEND_URL = window.QUIZ_BACKEND_URL || 'https://quiz-system-wf0d.onrender.com';
const token = localStorage.getItem('adminToken');
const $ = id => document.getElementById(id);
let students = [];
let visibleStudents = [];
const filters = () => ({ grade: $('student-filter-grade').value, section: $('student-filter-section').value, search: $('student-search').value });
document.documentElement.dataset.theme = localStorage.getItem('quizTheme') || 'light';
async function request(path, body) {
    const response = await fetch(`${BACKEND_URL}/api${path}`, {
        method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not complete request.');
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
        const card = node('article'); card.className = 'assignment-report-card';
        card.append(node('h3', student.name), node('p', `${grade} · ${ReportUtils.section(student)} · Roll ${student.rollNum}`));
        const sectionForm = node('form'); sectionForm.className = 'section-edit-form';
        const sectionLabel = node('label', 'Section');
        const sectionInput = node('input'); sectionInput.id = `section-${student.id}`; sectionInput.maxLength = 80;
        sectionInput.value = student.section === 'Unassigned' ? '' : student.section || '';
        sectionInput.placeholder = 'Enter section name when confirmed'; sectionInput.setAttribute('list', 'section-suggestions'); sectionLabel.htmlFor = sectionInput.id;
        const sectionButton = node('button', 'Save Section'); sectionButton.type = 'submit'; sectionButton.className = 'btn-secondary';
        const sectionStatus = node('p'); sectionStatus.setAttribute('role', 'status');
        sectionForm.append(sectionLabel, sectionInput, sectionButton, sectionStatus);
        sectionForm.onsubmit = async event => {
            event.preventDefault(); sectionButton.disabled = true;
            try {
                await request(`/admin/students/${student.id}/section`, { section: sectionInput.value });
                $('account-message').textContent = `Section saved for ${student.name}. Their reports remain linked to their account.`;
                await load();
            } catch (error) { sectionStatus.textContent = error.message; }
            finally { sectionButton.disabled = false; }
        };
        card.append(sectionForm);
        const form = node('form'); const label = node('label', 'New password (only to reset)');
        const password = node('input'); password.type = 'password'; password.required = true; password.minLength = 6; password.maxLength = 72;
        password.autocomplete = 'new-password'; password.id = `reset-${student.id}`; label.htmlFor = password.id;
        const button = node('button', 'Reset Password'); button.type = 'submit'; button.className = 'btn-secondary';
        const status = node('p'); status.setAttribute('role', 'status');
        form.append(label, password, button, status);
        form.onsubmit = async event => {
            event.preventDefault(); button.disabled = true;
            try { const data = await request(`/admin/students/${student.id}/password`, { password: password.value }); status.textContent = data.message; password.value = ''; }
            catch (error) { status.textContent = error.message; }
            finally { button.disabled = false; }
        };
        card.append(form); $('students-list').append(card);
    }
    if (!$('students-list').children.length) $('students-list').append(node('p', 'No students found.'));
}
async function load() {
    try {
        students = await request('/admin/students');
        ReportUtils.fillSections($('student-filter-section'), students, $('student-filter-grade').value);
        $('section-suggestions').replaceChildren();
        for (const name of ReportUtils.sections(students)) { const option = node('option'); option.value = name; $('section-suggestions').append(option); }
        render();
    }
    catch (error) { $('account-message').textContent = error.message; }
}
$('student-search').oninput = render;
$('student-filter-section').onchange = render;
$('student-filter-grade').onchange = () => { ReportUtils.fillSections($('student-filter-section'), students, $('student-filter-grade').value); render(); };
$('export-students-btn').onclick = () => { if (visibleStudents.length) ReportUtils.download(ReportUtils.studentCsv(visibleStudents), 'students', filters()); };
$('account-form').onsubmit = async event => {
    event.preventDefault(); $('create-account').disabled = true;
    try {
        await request('/admin/students', { name: $('account-name').value, rollNum: $('account-roll').value, grade: $('account-grade').value, section: $('account-section').value, password: $('account-password').value });
        $('account-message').textContent = 'Account created. Share the roll number, grade, section and password with this student.';
        $('account-form').reset(); await load();
    } catch (error) { $('account-message').textContent = error.message; }
    finally { $('create-account').disabled = false; }
};
if (!token) { $('account-form').classList.add('hidden'); $('account-message').textContent = 'Please log in from the Teacher Dashboard first.'; } else load();
