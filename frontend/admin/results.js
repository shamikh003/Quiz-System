const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const gradeLabel = grade => Number(grade) === 0 ? 'Hifz' : `Grade ${grade}`;
// Backend URL
const BACKEND_URL = window.QUIZ_BACKEND_URL || 'https://quiz-system-wf0d.onrender.com';

// ---------- Theme toggle ----------
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

function getToken() { return localStorage.getItem('adminToken'); }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

document.addEventListener('DOMContentLoaded', async function () {
    const resultsBody = document.getElementById('results-body');
    const clearBtn = document.getElementById('clear-results-btn');
    const exportBtn = document.getElementById('export-csv-btn');
    const resultsNote = document.getElementById('results-note');
    const filterGradeSelect = document.getElementById('filter-grade');
    const filterSection = document.getElementById('filter-section');
    const filterRoll = document.getElementById('filter-roll');
    const filters = () => ({ grade: filterGradeSelect.value, section: filterSection.value, roll: filterRoll.value });
    let results = [], visibleResults = [];

    // Only show the "Clear All Results" button to a logged-in teacher.
    if (getToken()) {
        clearBtn.classList.remove('hidden');
    } else {
        resultsNote.textContent = 'Log in on the Admin Panel to manage results.';
    }

    async function fetchResults() {
        const url = `${BACKEND_URL}/api/results`;
        try {
            const response = await fetch(url, { headers: authHeaders() });
            if (!response.ok) throw new Error('Please log in as teacher to view reports.');
            results = await response.json();
        } catch (error) {
            console.error("Error fetching results:", error);
            results = [];
            resultsNote.textContent = error.message;
        }
    }

    await fetchResults();
    ReportUtils.fillSections(filterSection, results, filterGradeSelect.value);

    function renderTable() {
        visibleResults = ReportUtils.filterRows(results, filters());
        document.getElementById('results-count').textContent = `${visibleResults.length} of ${results.length} results shown`;
        exportBtn.disabled = !visibleResults.length;
        resultsBody.innerHTML = '';

        if (visibleResults.length === 0) {
            resultsBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No results match these filters.</td></tr>';
            return;
        }

        visibleResults.forEach((result) => {
            const row = document.createElement('tr');
            const flagCount = (result.tabSwitchCount || 0) + (result.fullscreenExitCount || 0);
            const assignmentCell = (result.assignmentPercentage !== null && result.assignmentPercentage !== undefined)
                ? `${result.assignmentPercentage}%`
                : '—';
            const formattedDate = result.date ? new Date(result.date).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }) : '—';
            row.innerHTML = `
                <td>${escapeHtml(result.name)}</td>
                <td>${escapeHtml(result.rollNum)}</td>
                <td>${gradeLabel(result.grade)}</td>
                <td>${escapeHtml(ReportUtils.section(result))}</td>
                <td>${result.score} / ${result.total}</td>
                <td>${flagCount}</td>
                <td>${assignmentCell}</td>
                <td>${formattedDate}</td>
            `;
            resultsBody.appendChild(row);
        });
    }

    renderTable();

    filterGradeSelect.addEventListener('change', () => {
        ReportUtils.fillSections(filterSection, results, filterGradeSelect.value);
        renderTable();
    });
    filterSection.addEventListener('change', renderTable);
    filterRoll.addEventListener('input', renderTable);
    exportBtn.addEventListener('click', () => {
        if (visibleResults.length) ReportUtils.download(ReportUtils.resultCsv(visibleResults), 'quiz-results', filters());
    });

    clearBtn.addEventListener('click', async function () {
        if (confirm('Are you sure you want to delete ALL results from the database?')) {
            clearBtn.disabled = true;
            clearBtn.innerHTML = 'Deleting... <span class="spinner"></span>';

            try {
                const response = await fetch(`${BACKEND_URL}/api/results`, {
                    method: 'DELETE',
                    headers: authHeaders()
                });
                if (response.ok) {
                    results = [];
                    ReportUtils.fillSections(filterSection, results, filterGradeSelect.value);
                    renderTable();
                    alert('All results deleted from database.');
                } else if (response.status === 401) {
                    alert('Your session expired. Please log in again from the Admin Panel.');
                    localStorage.removeItem('adminToken');
                    clearBtn.classList.add('hidden');
                } else {
                    alert('Error deleting results.');
                }
            } catch (error) {
                alert('Could not connect to server.');
            } finally {
                clearBtn.disabled = false;
                clearBtn.innerHTML = 'Clear All Results';
            }
        }
    });
});
