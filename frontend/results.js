// Backend URL
const BACKEND_URL = 'https://quiz-system-hpy5.onrender.com';

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
    let results = [];

    // Only show the "Clear All Results" button to a logged-in teacher.
    if (getToken()) {
        clearBtn.classList.remove('hidden');
    } else {
        resultsNote.textContent = 'Log in on the Admin Panel to manage results.';
    }

    async function fetchResults() {
        const gradeFilter = filterGradeSelect.value;
        const url = gradeFilter
            ? `${BACKEND_URL}/api/results?grade=${gradeFilter}`
            : `${BACKEND_URL}/api/results`;
        try {
            const response = await fetch(url);
            results = await response.json();
        } catch (error) {
            console.error("Error fetching results:", error);
            resultsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Could not load results. Server may be offline.</td></tr>';
        }
    }

    await fetchResults();

    function renderTable() {
        resultsBody.innerHTML = '';

        if (results.length === 0) {
            resultsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No results found in database.</td></tr>';
            return;
        }

        results.forEach((result) => {
            const row = document.createElement('tr');
            const formattedDate = new Date(result.date).toLocaleString('en-US');
            row.innerHTML = `
                <td>${result.name}</td>
                <td>${result.rollNum}</td>
                <td>${result.grade}</td>
                <td>${result.score} / ${result.total}</td>
                <td>${formattedDate}</td>
            `;
            resultsBody.appendChild(row);
        });
    }

    renderTable();

    filterGradeSelect.addEventListener('change', async function () {
        resultsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
        await fetchResults();
        renderTable();
    });

    exportBtn.addEventListener('click', function () {
        if (results.length === 0) {
            alert('No results to export.');
            return;
        }
        const header = ['Name', 'Roll Number', 'Grade', 'Score', 'Total', 'Timestamp'];
        const rows = results.map((r) => [
            r.name,
            r.rollNum,
            r.grade,
            r.score,
            r.total,
            new Date(r.date).toLocaleString('en-US')
        ]);
        const csvContent = [header, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `quiz-results-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
