// Backend server ka URL
const BACKEND_URL = 'https://quiz-system-hpy5.onrender.com';

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
}
function showLoggedInView() {
    teacherLoginContainer.style.display = 'none';
    adminPanel.style.display = 'block';
    loadSettings();
    loadQuestionList();
}

if (getToken()) {
    showLoggedInView();
} else {
    showLoggedOutView();
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
const tabAdd = document.getElementById('tab-add');
const tabManage = document.getElementById('tab-manage');
const addTabContent = document.getElementById('add-tab-content');
const manageTabContent = document.getElementById('manage-tab-content');

tabAdd.addEventListener('click', () => {
    tabAdd.classList.add('active');
    tabManage.classList.remove('active');
    addTabContent.classList.remove('hidden');
    manageTabContent.classList.add('hidden');
});
tabManage.addEventListener('click', () => {
    tabManage.classList.add('active');
    tabAdd.classList.remove('active');
    manageTabContent.classList.remove('hidden');
    addTabContent.classList.add('hidden');
    loadQuestionList();
});

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

function resetForm() {
    questionForm.reset();
    questionGradeSelect.value = '';
    optionDWrapper.classList.remove('hidden');
    correctOptionD.classList.remove('hidden');
    optionDInput.required = true;
    editingQuestionId = null;
    saveBtn.textContent = 'Save Question';
    cancelEditBtn.classList.add('hidden');
    formError.textContent = '';
}

cancelEditBtn.addEventListener('click', resetForm);

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

        const url = editingQuestionId
            ? `${BACKEND_URL}/api/admin/questions/${editingQuestionId}`
            : `${BACKEND_URL}/api/admin/questions`;
        const method = editingQuestionId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(questionData)
        });

        const data = await response.json();

        if (response.ok) {
            alert(editingQuestionId ? 'Question updated!' : 'Question saved to database successfully!');
            resetForm();
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
async function loadQuestionList() {
    questionListDiv.innerHTML = '<p class="empty-state">Loading questions...</p>';
    try {
        const gradeFilter = filterGradeSelect ? filterGradeSelect.value : '';
        const url = gradeFilter
            ? `${BACKEND_URL}/api/admin/questions?grade=${gradeFilter}`
            : `${BACKEND_URL}/api/admin/questions`;
        const response = await fetch(url, { headers: authHeaders() });
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            showLoggedOutView();
            return;
        }
        const questions = await response.json();
        questionCountBadge.textContent = questions.length;

        if (questions.length === 0) {
            questionListDiv.innerHTML = '<p class="empty-state">No questions saved yet.</p>';
            return;
        }

        questionListDiv.innerHTML = '';
        questions.forEach(q => {
            const card = document.createElement('div');
            card.className = 'question-card';
            const optionsText = q.options.map(o => `${o.id}: ${o.text}${o.id === q.correct ? ' ✅' : ''}`).join(' | ');
            card.innerHTML = `
                <p><strong>${q.text}</strong> <span class="badge">Grade ${q.grade}</span></p>
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

    saveBtn.textContent = 'Update Question';
    cancelEditBtn.classList.remove('hidden');

    tabAdd.click();
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

// "Clear All" logic
clearBtn.addEventListener('click', async function () {
    if (confirm('Are you sure you want to delete ALL questions from the database?')) {
        clearBtn.disabled = true;
        clearBtn.innerHTML = 'Deleting... <span class="spinner"></span>';

        try {
            const response = await fetch(`${BACKEND_URL}/api/admin/questions`, {
                method: 'DELETE',
                headers: authHeaders()
            });
            if (response.ok) {
                alert('All questions deleted from database.');
                loadQuestionList();
            } else if (response.status === 401) {
                localStorage.removeItem('adminToken');
                showLoggedOutView();
            } else {
                alert('Error deleting questions.');
            }
        } catch (error) {
            alert('Could not connect to server to delete questions.');
        } finally {
            clearBtn.disabled = false;
            clearBtn.innerHTML = 'Clear All Saved Questions';
        }
    }
});
