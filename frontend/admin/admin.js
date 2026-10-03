const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const gradeLabel = grade => Number(grade) === 0 ? 'Hifz' : `Grade ${grade}`;
// Backend server ka URL
const BACKEND_URL = window.QUIZ_BACKEND_URL || 'https://quiz-system-wf0d.onrender.com';

// ---------- Theme toggle (shared logic, works on any page) ----------
function applyStoredTheme() {
    const theme = localStorage.getItem('quizTheme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    });
}
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('quizTheme', next);
    applyStoredTheme();
}
applyStoredTheme();
document.querySelectorAll('.theme-toggle').forEach(btn => btn.addEventListener('click', toggleTheme));

// ---------- Auth helpers ----------
function getToken() { return localStorage.getItem('adminToken'); }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

const teacherLoginContainer = document.getElementById('teacher-login-container');
const adminPanel = document.getElementById('admin-panel');
const loginFormAdmin = document.getElementById('login-form-admin');
const loginError = document.getElementById('login-error');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const logoutBtn = document.getElementById('logout-btn');

function showLoggedOutView() {
    teacherLoginContainer.style.display = 'block';
    adminPanel.style.display = 'none';
    document.body.classList.remove('app-shell-page');
}
function showLoggedInView() {
    teacherLoginContainer.style.display = 'none';
    adminPanel.style.display = 'flex';
    document.body.classList.add('app-shell-page');
    loadSettings();
    loadQuestionList();
    loadDashboard();
}


loginFormAdmin.addEventListener('submit', async function (event) {
    event.preventDefault();
    loginError.textContent = '';
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.innerHTML = 'Logging in... <span class="spinner"></span>';

    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('login-username').value,
                password: document.getElementById('login-password').value
            })
        });
        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('adminToken', data.token);
            showLoggedInView();
        } else {
            loginError.textContent = data.error || 'Login failed.';
        }
    } catch (error) {
        loginError.textContent = 'Could not connect to server. It may be waking up — try again in a moment.';
    } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.innerHTML = 'Log In';
    }
});

logoutBtn.addEventListener('click', function () {
    localStorage.removeItem('adminToken');
    showLoggedOutView();
});

// ---------- Tabs ----------
const tabDashboard = document.getElementById('tab-dashboard');
const tabAdd = document.getElementById('tab-add');
const tabManage = document.getElementById('tab-manage');
const tabAssignments = document.getElementById('tab-assignments');
const dashboardTabContent = document.getElementById('dashboard-tab-content');
const addTabContent = document.getElementById('add-tab-content');
const manageTabContent = document.getElementById('manage-tab-content');
const assignmentsTabContent = document.getElementById('assignments-tab-content');

const tabButtons = { dashboard: tabDashboard, add: tabAdd, manage: tabManage, assignments: tabAssignments };
const tabContents = { dashboard: dashboardTabContent, add: addTabContent, manage: manageTabContent, assignments: assignmentsTabContent };

function activateTab(key) {
    Object.keys(tabButtons).forEach(k => {
        tabButtons[k].classList.toggle('active', k === key);
        tabContents[k].classList.toggle('hidden', k !== key);
    });
    if (key === 'dashboard') loadDashboard();
    if (key === 'manage') loadQuestionList();
    if (key === 'assignments') loadAssignments();

    // Close the mobile sidebar (if open) after picking a section.
    const sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) sidebarEl.classList.remove('open');
}

tabDashboard.addEventListener('click', () => activateTab('dashboard'));
tabAdd.addEventListener('click', () => activateTab('add'));
tabManage.addEventListener('click', () => activateTab('manage'));
tabAssignments.addEventListener('click', () => activateTab('assignments'));

const mobileMenuBtn = document.getElementById('mobile-menu-btn');
if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
}

// ---------- Dashboard ----------
const dashboardDateEl = document.getElementById('dashboard-date');
if (dashboardDateEl) {
    dashboardDateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadDashboard() {
    const statQuestions = document.getElementById('stat-total-questions');
    const statAssignments = document.getElementById('stat-total-assignments');
    const statStudents = document.getElementById('stat-total-students');
    const statPending = document.getElementById('stat-pending-submissions');
    const resultsBody = document.getElementById('dashboard-results-body');
    const resultCards = document.getElementById('dashboard-result-cards');
    if (!statQuestions) return; // dashboard markup not on this page

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/dashboard`, { headers: authHeaders() });
        if (!response.ok) throw new Error('Request failed');
        const data = await response.json();

        statQuestions.textContent = data.totalQuestions;
        statAssignments.textContent = data.totalAssignments;
        statStudents.textContent = data.totalStudents;
        statPending.textContent = data.pendingSubmissions;

        if (!Array.isArray(data.topResults)) throw new Error('Dashboard update required');
        if (data.topResults.length === 0) {
            resultsBody.innerHTML = '<tr><td colspan="8" class="shell-empty">No quiz results yet.</td></tr>';
            resultCards.innerHTML = '<p class="shell-empty" role="status">No quiz results yet.</p>';
            return;
        }

        resultCards.innerHTML = ReportUtils.resultCards(data.topResults, { dashboard: true });
        resultsBody.innerHTML = data.topResults.map(r => {
            const flagCount = (r.tabSwitchCount || 0) + (r.fullscreenExitCount || 0);
            const pillClass = flagCount === 0 ? 'good' : (flagCount <= 2 ? 'warn' : 'bad');
            const pillText = flagCount === 0 ? 'Clean' : `${flagCount} flag${flagCount > 1 ? 's' : ''}`;
            const dateStr = r.date ? new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
            return `
                <tr>
                    <td>${escapeHtml(r.name)}</td>
                    <td class="mono">${gradeLabel(r.grade)}</td>
                    <td>${escapeHtml(r.section || 'Unassigned')}</td>
                    <td class="mono">${r.score} / ${r.total}</td>
                    <td class="mono">${ReportUtils.percent(r.percentage)}</td>
                    <td class="mono" title="${r.timingKnown ? 'Minutes:seconds' : 'Time unavailable'}">${ReportUtils.duration(r.elapsedMs)}</td>
                    <td><span class="pill ${pillClass}">${pillText}</span></td>
                    <td class="mono">${dateStr}</td>
                </tr>`;
        }).join('');
    } catch (error) {
        resultsBody.innerHTML = '<tr><td colspan="8" class="shell-empty">Could not load dashboard data.</td></tr>';
        resultCards.innerHTML = '<p class="shell-empty" role="status">Could not load dashboard data.</p>';
    }
}

// ---------- DOM Elements ----------
const optionCountSelector = document.getElementById('option-count');
const optionDWrapper = document.getElementById('option-d-wrapper');
const optionDInput = document.getElementById('option-d');
const correctOptionD = document.getElementById('correct-option-d');
const questionForm = document.getElementById('question-form');
const quizTimeInput = document.getElementById('quiz-time');
const formError = document.getElementById('form-error');
const saveBtn = document.getElementById('save-question-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const clearBtn = document.getElementById('clear-questions-btn');
const questionListDiv = document.getElementById('question-list');
const questionCountBadge = document.getElementById('question-count');
const questionGradeSelect = document.getElementById('question-grade');
const filterGradeSelect = document.getElementById('filter-grade');

let editingQuestionId = null; // null = adding new question

async function loadSettings() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/settings`);
        if (response.ok) {
            const settings = await response.json();
            if (settings && settings.time) {
                quizTimeInput.value = settings.time;
            }
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
    }
}

optionCountSelector.addEventListener('change', function () {
    const selectedCount = this.value;
    if (selectedCount === '3') {
        optionDWrapper.classList.add('hidden');
        correctOptionD.classList.add('hidden');
        optionDInput.required = false;
    } else {
        optionDWrapper.classList.remove('hidden');
        correctOptionD.classList.remove('hidden');
        optionDInput.required = true;
    }
});

// keepGrade=true is used right after a successful save, so the teacher doesn't
// have to re-pick the grade for every single question of the same batch.
function resetForm({ keepGrade = false } = {}) {
    const currentGrade = questionGradeSelect.value;
    questionForm.reset();
    questionGradeSelect.value = keepGrade ? currentGrade : '';
    optionDWrapper.classList.remove('hidden');
    correctOptionD.classList.remove('hidden');
    optionDInput.required = true;
    editingQuestionId = null;
    const imageInput = document.getElementById('question-image');
    if (imageInput) imageInput.value = '';
    const currentImage = document.getElementById('current-question-image');
    if (currentImage) currentImage.textContent = '';
    saveBtn.textContent = 'Save Question';
    cancelEditBtn.classList.add('hidden');
    formError.textContent = '';
}

cancelEditBtn.addEventListener('click', () => resetForm());

// Form submit: creates a new question, or updates one if we're editing
questionForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    formError.textContent = '';
    saveBtn.disabled = true;
    saveBtn.innerHTML = (editingQuestionId ? 'Updating...' : 'Saving...') + ' <span class="spinner"></span>';

    const quizTime = quizTimeInput.value;

    try {
        // Save settings (time) alongside the question
        await fetch(`${BACKEND_URL}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ time: Number(quizTime) })
        });

        const optionsArray = [
            { id: 'A', text: document.getElementById('option-a').value },
            { id: 'B', text: document.getElementById('option-b').value },
            { id: 'C', text: document.getElementById('option-c').value }
        ];
        if (optionCountSelector.value === '4') {
            optionsArray.push({ id: 'D', text: optionDInput.value });
        }

        const questionData = {
            text: document.getElementById('question-text').value,
            grade: Number(questionGradeSelect.value),
            options: optionsArray,
            correct: document.getElementById('correct-answer').value
        };
        const questionImage = document.getElementById('question-image').files[0];
        if (questionImage && questionImage.size > 5 * 1024 * 1024) {
            formError.textContent = 'Question image must be 5 MB or smaller.';
            return;
        }

        const url = editingQuestionId
            ? `${BACKEND_URL}/api/admin/questions/${editingQuestionId}`
            : `${BACKEND_URL}/api/admin/questions`;
        const method = editingQuestionId ? 'PUT' : 'POST';

        const formData = new FormData();
        formData.append('text', questionData.text);
        formData.append('grade', String(questionData.grade));
        formData.append('options', JSON.stringify(questionData.options));
        formData.append('correct', questionData.correct);
        if (questionImage) formData.append('image', questionImage);
        const response = await fetch(url, {
            method,
            headers: authHeaders(),
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            alert(editingQuestionId ? 'Question updated!' : 'Question saved to database successfully!');
            resetForm({ keepGrade: true });
            quizTimeInput.value = quizTime;
            loadQuestionList();
        } else if (response.status === 401) {
            alert('Your session expired. Please log in again.');
            localStorage.removeItem('adminToken');
            showLoggedOutView();
        } else {
            formError.textContent = data.error || 'Error saving question.';
        }
    } catch (error) {
        console.error('Error saving data:', error);
        formError.textContent = 'Could not connect to server. Please check your connection.';
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = editingQuestionId ? 'Update Question' : 'Save Question';
    }
});

// ---------- Question list (manage tab) ----------
let questionListRequest = 0;
let loadedQuestionGrade = null;
let loadedQuestionCount = 0;
let clearingQuestions = false;
function updateClearQuestionsButton() {
    const grade = filterGradeSelect.value;
    clearBtn.disabled = clearingQuestions || grade === '' || loadedQuestionGrade !== grade || loadedQuestionCount === 0;
    clearBtn.textContent = clearingQuestions ? 'Deleting...' : grade === ''
        ? 'Select a Grade to Clear Questions' : `Clear ${gradeLabel(grade)} Questions`;
}
async function loadQuestionList() {
    const requestId = ++questionListRequest;
    const gradeFilter = filterGradeSelect.value;
    loadedQuestionGrade = null;
    updateClearQuestionsButton();
    questionListDiv.innerHTML = '<p class="empty-state">Loading questions...</p>';
    try {
        const url = gradeFilter
            ? `${BACKEND_URL}/api/admin/questions?grade=${gradeFilter}`
            : `${BACKEND_URL}/api/admin/questions`;
        const response = await fetch(url, { headers: authHeaders() });
        if (requestId !== questionListRequest) return;
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            showLoggedOutView();
            return;
        }
        if (!response.ok) throw new Error('Could not load questions.');
        const questions = await response.json();
        if (requestId !== questionListRequest) return;
        loadedQuestionGrade = gradeFilter;
        loadedQuestionCount = questions.length;
        updateClearQuestionsButton();
        questionCountBadge.textContent = questions.length;

        if (questions.length === 0) {
            questionListDiv.innerHTML = '<p class="empty-state">No questions saved yet.</p>';
            return;
        }

        questionListDiv.innerHTML = '';
        questions.forEach(q => {
            const card = document.createElement('div');
            card.className = 'question-card';
            const optionsText = q.options.map(o => `${escapeHtml(o.id)}: ${escapeHtml(o.text)}${o.id === q.correct ? ' ✅' : ''}`).join(' | ');
            card.innerHTML = `
                ${q.imageUrl ? `<img class="question-thumbnail" src="${escapeHtml(q.imageUrl)}" alt="Question illustration">` : ''}
                <p><strong>${escapeHtml(q.text)}</strong> <span class="badge">${gradeLabel(q.grade)}</span></p>
                <p class="q-options">${optionsText}</p>
                <div class="q-actions">
                    <button type="button" class="btn-secondary btn-small edit-q-btn">Edit</button>
                    <button type="button" class="btn-danger btn-small delete-q-btn">Delete</button>
                </div>
            `;
            card.querySelector('.edit-q-btn').addEventListener('click', () => startEditQuestion(q));
            card.querySelector('.delete-q-btn').addEventListener('click', () => deleteQuestion(q._id));
            questionListDiv.appendChild(card);
        });
    } catch (error) {
        if (requestId !== questionListRequest) return;
        questionListDiv.innerHTML = '<p class="empty-state">Could not load questions. Server may be offline.</p>';
    }
}

if (filterGradeSelect) {
    filterGradeSelect.addEventListener('change', loadQuestionList);
}

function startEditQuestion(q) {
    editingQuestionId = q._id;
    document.getElementById('question-text').value = q.text;
    questionGradeSelect.value = q.grade;
    optionCountSelector.value = q.options.length >= 4 ? '4' : '3';
    optionCountSelector.dispatchEvent(new Event('change'));

    document.getElementById('option-a').value = q.options.find(o => o.id === 'A')?.text || '';
    document.getElementById('option-b').value = q.options.find(o => o.id === 'B')?.text || '';
    document.getElementById('option-c').value = q.options.find(o => o.id === 'C')?.text || '';
    if (q.options.length >= 4) {
        optionDInput.value = q.options.find(o => o.id === 'D')?.text || '';
    }
    document.getElementById('correct-answer').value = q.correct;
    document.getElementById('question-image').value = '';
    document.getElementById('current-question-image').textContent = q.imageUrl ? 'An image is attached. Choose a new image to replace it.' : '';

    saveBtn.textContent = 'Update Question';
    cancelEditBtn.classList.remove('hidden');

    activateTab('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteQuestion(id) {
    if (!confirm('Delete this question?')) return;
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/questions/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (response.ok) {
            loadQuestionList();
        } else if (response.status === 401) {
            localStorage.removeItem('adminToken');
            showLoggedOutView();
        } else {
            alert('Could not delete question.');
        }
    } catch (error) {
        alert('Could not connect to server.');
    }
}

// Bulk deletion always requires an explicit grade; All Grades is view-only.
clearBtn.addEventListener('click', async function () {
    const grade = filterGradeSelect.value;
    if (clearBtn.disabled || grade === '' || loadedQuestionGrade !== grade) return;
    const label = gradeLabel(grade);
    if (confirm(`Delete all ${loadedQuestionCount} saved questions for ${label}? Other grades will keep their questions. This cannot be undone.`)) {
        clearingQuestions = true;
        filterGradeSelect.disabled = true;
        updateClearQuestionsButton();

        try {
            const response = await fetch(`${BACKEND_URL}/api/admin/questions?grade=${encodeURIComponent(grade)}`, {
                method: 'DELETE',
                headers: authHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                alert(`${data.deletedCount} questions deleted for ${label}.`);
                await loadQuestionList();
            } else if (response.status === 401) {
                localStorage.removeItem('adminToken');
                showLoggedOutView();
            } else {
                const data = await response.json();
                alert(data.error || 'Error deleting questions.');
            }
        } catch (error) {
            alert('Could not connect to server to delete questions.');
        } finally {
            clearingQuestions = false;
            filterGradeSelect.disabled = false;
            updateClearQuestionsButton();
        }
    }
});

// ================= ASSIGNMENTS TAB =================
const assignmentForm = document.getElementById('assignment-upload-form');
const assignmentFormError = document.getElementById('assignment-form-error');
const assignmentFileInput = document.getElementById('assignment-file');
const assignmentGradeSelect = document.getElementById('assignment-grade');
const assignmentMaxMarksInput = document.getElementById('assignment-max-marks');
const uploadAssignmentBtn = document.getElementById('upload-assignment-btn');
const assignmentList = document.getElementById('assignment-list');
const submissionsPanel = document.getElementById('submissions-panel');
const submissionsTitle = document.getElementById('submissions-title');
const submissionsList = document.getElementById('submissions-list');
const backToAssignmentsBtn = document.getElementById('back-to-assignments-btn');

assignmentForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    assignmentFormError.textContent = '';
    uploadAssignmentBtn.disabled = true;
    uploadAssignmentBtn.innerHTML = 'Uploading... <span class="spinner"></span>';

    try {
        const formData = new FormData();
        formData.append('title', document.getElementById('assignment-title').value);
        formData.append('grade', assignmentGradeSelect.value);
        formData.append('maxMarks', assignmentMaxMarksInput.value);
        formData.append('file', assignmentFileInput.files[0]);

        // Do NOT set Content-Type manually — the browser needs to add the
        // multipart boundary itself for FormData uploads.
        const response = await fetch(`${BACKEND_URL}/api/admin/assignments`, {
            method: 'POST',
            headers: authHeaders(),
            body: formData
        });
        const data = await response.json();

        if (response.ok) {
            alert('Assignment uploaded successfully!');
            assignmentForm.reset();
            assignmentMaxMarksInput.value = 100;
            loadAssignments();
        } else if (response.status === 401) {
            alert('Your session expired. Please log in again.');
            localStorage.removeItem('adminToken');
            showLoggedOutView();
        } else {
            assignmentFormError.textContent = data.error || 'Error uploading assignment.';
        }
    } catch (error) {
        assignmentFormError.textContent = 'Could not connect to server.';
    } finally {
        uploadAssignmentBtn.disabled = false;
        uploadAssignmentBtn.textContent = 'Upload Assignment';
    }
});

async function loadAssignments() {
    assignmentList.innerHTML = '<p class="empty-state">Loading assignments...</p>';
    submissionsPanel.classList.add('hidden');
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/assignments`, { headers: authHeaders() });
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            showLoggedOutView();
            return;
        }
        const assignments = await response.json();

        if (assignments.length === 0) {
            assignmentList.innerHTML = '<p class="empty-state">No assignments uploaded yet.</p>';
            return;
        }

        assignmentList.innerHTML = '';
        assignments.forEach(a => {
            const card = document.createElement('div');
            card.className = 'question-card';
            card.innerHTML = `
                <p><strong>${escapeHtml(a.title)}</strong> <span class="badge">${gradeLabel(a.grade)}</span></p>
                <p class="q-options">📎 ${escapeHtml(a.fileName)} • Max Marks: ${a.maxMarks} • Submissions: ${a.submissionCount} (${a.gradedCount} graded)</p>
                <div class="q-actions">
                    <button type="button" class="btn-secondary btn-small view-submissions-btn">View Submissions</button>
                    <button type="button" class="btn-danger btn-small delete-assignment-btn">Delete</button>
                </div>
            `;
            card.querySelector('.view-submissions-btn').addEventListener('click', () => viewSubmissions(a));
            card.querySelector('.delete-assignment-btn').addEventListener('click', () => deleteAssignment(a._id));
            assignmentList.appendChild(card);
        });
    } catch (error) {
        assignmentList.innerHTML = '<p class="empty-state">Could not load assignments. Server may be offline.</p>';
    }
}

async function deleteAssignment(id) {
    if (!confirm('Delete this assignment and its files? Graded marks will stay in reports.')) return;
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/assignments/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (response.ok) {
            loadAssignments();
        } else if (response.status === 401) {
            localStorage.removeItem('adminToken');
            showLoggedOutView();
        } else {
            alert('Could not delete assignment.');
        }
    } catch (error) {
        alert('Could not connect to server.');
    }
}

async function viewSubmissions(assignment) {
    submissionsPanel.classList.remove('hidden');
    submissionsTitle.textContent = `Submissions — ${assignment.title}`;
    submissionsList.innerHTML = '<p class="empty-state">Loading submissions...</p>';

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/assignments/${assignment._id}/submissions`, {
            headers: authHeaders()
        });
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            showLoggedOutView();
            return;
        }
        const submissions = await response.json();

        if (submissions.length === 0) {
            submissionsList.innerHTML = '<p class="empty-state">No submissions yet.</p>';
            return;
        }

        submissionsList.innerHTML = '';
        submissions.forEach(s => {
            const card = document.createElement('div');
            card.className = 'question-card';
            const statusBadge = s.status === 'graded'
                ? `<span class="badge" style="background:var(--success-subtle); color:var(--success);">Graded — ${s.percentage}%</span>`
                : `<span class="badge">Pending</span>`;
            card.innerHTML = `
                <p><strong>${escapeHtml(s.name)}</strong> (Roll: ${escapeHtml(s.rollNum)} · Section: ${escapeHtml(s.section || 'Unassigned')}) ${statusBadge}</p>
                <p class="q-options">📎 ${escapeHtml(s.fileName)} • Submitted: ${new Date(s.submittedAt).toLocaleString('en-US')}</p>
                <div class="q-actions">
                    <button type="button" class="btn-secondary btn-small download-submission-btn">⬇ Download File</button>
                    <input type="number" class="marks-input" placeholder="Marks / ${assignment.maxMarks}" min="0" max="${assignment.maxMarks}" value="${s.marks !== null && s.marks !== undefined ? s.marks : ''}" style="max-width:140px;">
                    <button type="button" class="btn-small save-marks-btn">Save Marks</button>
                </div>
            `;
            card.querySelector('.download-submission-btn').addEventListener('click', () => downloadSubmission(s));
            card.querySelector('.save-marks-btn').addEventListener('click', () => saveMarks(s._id, card, assignment));
            submissionsList.appendChild(card);
        });
    } catch (error) {
        submissionsList.innerHTML = '<p class="empty-state">Could not load submissions.</p>';
    }
}

async function downloadSubmission(submission) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/submissions/${submission._id}/download`, {
            headers: authHeaders()
        });
        if (!response.ok) {
            alert('Could not download file.');
            return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = submission.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Could not connect to server.');
    }
}

async function saveMarks(submissionId, card, assignment) {
    const input = card.querySelector('.marks-input');
    const marks = Number(input.value);
    if (input.value === '' || isNaN(marks) || marks < 0 || marks > assignment.maxMarks) {
        alert(`Marks must be between 0 and ${assignment.maxMarks}.`);
        return;
    }
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/submissions/${submissionId}/marks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ marks })
        });
        if (response.ok) {
            alert('Marks saved!');
            viewSubmissions(assignment);
        } else if (response.status === 401) {
            localStorage.removeItem('adminToken');
            showLoggedOutView();
        } else {
            const data = await response.json();
            alert(data.error || 'Could not save marks.');
        }
    } catch (error) {
        alert('Could not connect to server.');
    }
}

backToAssignmentsBtn.addEventListener('click', () => submissionsPanel.classList.add('hidden'));

// ---------- PWA: register service worker (offline app-shell caching) ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(err => {
            console.warn('Service worker registration failed:', err);
        });
    });
}

// Initialize after all form/table bindings exist. Older tokens require fresh login.
try {
    const payload = JSON.parse(atob((getToken() || '').split('.')[1] || ''));
    if (payload.role !== 'admin') localStorage.removeItem('adminToken');
} catch { localStorage.removeItem('adminToken'); }
if (getToken()) showLoggedInView(); else showLoggedOutView();
