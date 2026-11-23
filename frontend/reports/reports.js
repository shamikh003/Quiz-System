const API = window.QUIZ_BACKEND_URL || 'http://127.0.0.1:5000';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const gradeLabel = grade => Number(grade) === 0 ? 'Hifz' : `Grade ${grade}`;
let token = sessionStorage.getItem('reportViewerToken'), directory, overviewRequest, mode = "overview", session = 0, historyCache = new Map();
const headers = () => ({ Authorization: `Bearer ${token}` });
function closeMenu() {
    $('viewer-sidebar').classList.remove('is-open');
    $('viewer-menu-backdrop').hidden = true;
    $('viewer-menu-toggle').setAttribute('aria-expanded', 'false');
    document.body.classList.remove('viewer-menu-open');
}
$('viewer-menu-toggle').onclick = () => {
    $('viewer-sidebar').classList.add('is-open');
    $('viewer-menu-backdrop').hidden = false;
    $('viewer-menu-toggle').setAttribute('aria-expanded', 'true');
    document.body.classList.add('viewer-menu-open');
    $('viewer-menu-close').focus();
};
$('viewer-menu-close').onclick = $('viewer-menu-backdrop').onclick = closeMenu;
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
function logout() { sessionStorage.removeItem('reportViewerToken'); sessionStorage.removeItem('reportViewerName'); token = null; session++; directory = null; overviewRequest?.abort(); historyCache.clear(); $('viewer-app').hidden = true; $('viewer-login').hidden = false; }
function showApp() { $('viewer-login').hidden = true; $('viewer-app').hidden = false; $('viewer-name').textContent = sessionStorage.getItem('reportViewerName') || 'Report Viewer'; switchView("overview"); }
async function json(path, options = {}) { const response = await fetch(`${API}/api${path}`, { cache:'no-store', ...options, headers:{ ...headers(), ...options.headers } }); let data; try { data = await response.json(); } catch { data = null; } if (response.status === 401 || response.status === 403) { logout(); throw new Error('Please log in again.'); } if (!response.ok) throw new Error(data?.error || 'Could not load reports.'); return data; }
$('viewer-login-form').onsubmit = async event => { event.preventDefault(); const button = $('viewer-login-btn'); button.disabled = true; $('viewer-login-message').textContent = ''; try { const response = await fetch(`${API}/api/auth/report-login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:$('viewer-username').value.trim(), password:$('viewer-password').value }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Login failed.'); token = data.token; sessionStorage.setItem('reportViewerToken', token); sessionStorage.setItem('reportViewerName', data.name); showApp(); } catch (error) { $('viewer-login-message').textContent = error.message; } finally { button.disabled = false; } };
$('viewer-logout').onclick = () => { closeMenu(); logout(); };
function fillSections(values) { const selected = $('viewer-section').value; $('viewer-section').innerHTML = '<option value="">All Sections</option>' + values.map(value => `<option>${esc(value)}</option>`).join(''); if (values.includes(selected)) $('viewer-section').value = selected; }
const grade = $('viewer-grade'), section = $('viewer-section'), search = $('viewer-search');
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().trim();
function render(students, ranking = false) {
    $('viewer-summary').textContent = ranking ? '' : `${students.length} students`;
    const head = $('viewer-results').closest('table').tHead.rows[0];
    head.innerHTML = ranking
        ? '<th>Rank</th><th>Student</th><th>Grade / Section</th><th>Quiz Avg</th><th>Worksheet Avg</th><th>Assignment Avg</th><th>Overall Score</th><th></th>'
        : '<th>Student</th><th>Roll Number</th><th>Grade / Section</th><th></th>';
    const entries = students.map((row, index) => {
        const identity = `${gradeLabel(row.grade)} · ${esc(row.section)}`;
        const button = `<button type="button" class="viewer-history-btn" data-key="${esc(row.key || row.reportKey)}">View report</button>`;
        const name = `<b>${esc(row.name)}</b>`, roll = esc(row.rollNum);
        const scores = [['Quiz Avg', row.quizAverage], ['Worksheet Avg', row.worksheetAverage], ['Assignment Avg', row.assignmentAverage]];
        const overall = ReportUtils.percent(row.overallPercentage);
        return {
            table: ranking
                ? `<tr><td>${index + 1}</td><td>${name}<small>Roll ${roll}</small></td><td>${identity}</td>${scores.map(([, score]) => `<td>${ReportUtils.percent(score)}</td>`).join('')}<td><strong>${overall}</strong></td><td>${button}</td></tr>`
                : `<tr><td>${name}</td><td>${roll}</td><td>${identity}</td><td>${button}</td></tr>`,
            card: `<article><div>${name}<small>Roll ${roll} · ${identity}</small></div>${ranking ? `
                <div><strong>${overall}</strong><small>Overall Score</small></div>
                <dl class="viewer-score-breakdown">${scores.map(([label, score]) => `<div><dt>${label}</dt><dd>${ReportUtils.percent(score)}</dd></div>`).join('')}</dl>` : ''}${button}</article>`
        };
    });
    $('viewer-results').innerHTML = entries.map(entry => entry.table).join('') || `<tr><td colspan="${ranking ? 8 : 4}" class="viewer-empty">No matching records.</td></tr>`;
    $('viewer-cards').innerHTML = entries.map(entry => entry.card).join('') || '<p>No matching records.</p>';
}
function getDirectory() {
    return directory ||= json('/admin/student-reports/directory').catch(error => {
        directory = null;
        throw error;
    });
}
async function updateView() {
    overviewRequest?.abort();
    const request = overviewRequest = new AbortController();
    const activeSession = session;
    $('viewer-message').textContent = 'Loading…';
    try {
        if (mode === 'overview') {
            const params = new URLSearchParams({ grade: grade.value, section: section.value });
            getDirectory().then(students => {
                if (request.signal.aborted || activeSession !== session) return;
                $('viewer-total-students').textContent = students.length;
                fillSections([...new Set(students.filter(row => !grade.value || String(row.grade) === grade.value).map(row => row.section))].sort());
            }).catch(() => {});
            const rows = await json(`/admin/student-reports/top-scorers?${params}`, { signal: request.signal });
            if (!request.signal.aborted && activeSession === session) render(rows, true);
        } else {
            const students = await getDirectory();
            if (request.signal.aborted || activeSession !== session) return;
            const inGrade = students.filter(row => !grade.value || String(row.grade) === grade.value);
            fillSections([...new Set(inGrade.map(row => row.section))].sort());
            const terms = normalize(search.value).split(/\s+/);
            render(inGrade.filter(row => (!section.value || row.section === section.value)
                && terms.every(term => normalize(`${row.name} ${row.rollNum}`).includes(term))));
        }
        if (!request.signal.aborted) $('viewer-message').textContent = '';
    } catch (error) {
        if (!request.signal.aborted && activeSession === session) $('viewer-message').textContent = error.message;
    }
}
function switchView(view) {
    closeMenu();
    mode = view;
    const overview = view === 'overview';
    $('viewer-overview-nav').classList.toggle('active', overview);
    $('viewer-students-nav').classList.toggle('active', !overview);
    $('viewer-overview-nav').setAttribute('aria-current', overview ? 'page' : 'false');
    $('viewer-students-nav').setAttribute('aria-current', overview ? 'false' : 'page');
    document.querySelector('.viewer-main h1').textContent = overview ? 'Reports Overview' : 'Student Reports';
    $('viewer-panel-title').textContent = overview ? 'Top Scorers' : 'Student Directory';
    search.closest('label').hidden = overview;
    $('viewer-stats').hidden = !overview;
    $('viewer-results').replaceChildren();
    $('viewer-cards').replaceChildren();
    $('viewer-summary').textContent = '';
    updateView();
}
$('viewer-overview-nav').onclick = () => switchView('overview');
$('viewer-students-nav').onclick = () => switchView('students');
grade.onchange = () => { section.value = ''; updateView(); };
section.onchange = updateView;
search.oninput = updateView;
function getHistory(key) {
    if (!historyCache.has(key)) {
        historyCache.set(key, json(`/admin/student-reports/${encodeURIComponent(key)}`).catch(error => {
            historyCache.delete(key);
            throw error;
        }));
    }
    return historyCache.get(key);
}
let historyVersion = 0;
function appendWorkMarks(content, title, assignments = []) {
    const graded = assignments.filter(row => ['graded', 'absent'].includes(row.status));
    if (!graded.length) return;
    const section = document.createElement('section');
    section.innerHTML = `<h3>${title}</h3><ul>${graded.map(row =>
        `<li>${esc(row.title)} · ${row.status === 'absent' ? 'Absent' : `${esc(row.marks ?? '—')} / ${esc(row.maxMarks ?? '—')}${row.feedback ? ` · ${esc(row.feedback)}` : ''}`}</li>`).join('')}</ul>`;
    content.append(section);
}
async function downloadStudentPdf(key, name, version) {
    const button = $('viewer-student-pdf'), message = $('viewer-pdf-message');
    button.disabled = true;
    button.textContent = 'Preparing PDF…';
    message.textContent = '';
    try {
        const response = await fetch(`${API}/api/admin/student-reports/${encodeURIComponent(key)}/pdf`, { headers: headers(), cache: 'no-store' });
        if (!response.ok) {
            let body;
            try { body = await response.json(); } catch {}
            throw new Error(body?.error || 'Could not download PDF. Please try again.');
        }
        if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The server did not return a PDF. Please try again.');
        const blob = await response.blob();
        if (version !== historyVersion || !$('viewer-history').open) return;
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url;
        link.download = `${name.replace(/[<>:"/\\|?*]/g, '').trim() || 'Student'}-report.pdf`;
        link.hidden = true;
        $('viewer-history').append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
        if (version === historyVersion) message.textContent = error.message;
    } finally {
        if (version === historyVersion) { button.disabled = false; button.textContent = 'Download PDF'; }
    }
}
document.addEventListener('click', async event => { const button=event.target.closest('.viewer-history-btn'); if(!button) return; const dialog=$('viewer-history'), content=$('viewer-history-content'); const version = ++historyVersion; $('viewer-student-pdf').disabled = true; $('viewer-student-pdf').textContent = 'Download PDF'; $('viewer-pdf-message').textContent = ''; content.innerHTML='<p role="status">Loading student report…</p>'; if (!dialog.open) dialog.showModal(); try { const report=await getHistory(button.dataset.key); if (version !== historyVersion || !dialog.open) return; const quizRows=[...report.quizzes, ...(report.absences || [])].sort((a,b) => new Date(b.date) - new Date(a.date)); content.innerHTML=`<header class="viewer-history-profile"><img src="../assets/dar-e-arqam.png" alt="Dar-e-Arqam School logo"><div><small>Student Report</small><h2>${esc(report.student.name)}</h2><p>Father: ${esc(report.student.fatherName||'—')} · Roll ${esc(report.student.rollNum)} · ${gradeLabel(report.student.grade)} · ${esc(report.student.section)}</p></div></header><div class="viewer-history-stats"><article><span>Quizzes</span><b>${report.summary.quizzesTaken}</b></article><article><span>Average</span><b>${report.summary.averageQuiz==null?'—':report.summary.averageQuiz.toFixed(1)+'%'}</b></article><article><span>Best Score</span><b>${report.summary.bestQuiz==null?'—':report.summary.bestQuiz.toFixed(1)+'%'}</b></article></div><h3>Complete Quiz History</h3><div class="viewer-table-wrap"><table><thead><tr><th>Date</th><th>Score</th><th>Marks</th><th>Time</th></tr></thead><tbody>${quizRows.length?quizRows.map(row=>`<tr><td>${new Date(row.date).toLocaleDateString('en-GB',{timeZone:'Asia/Karachi'})}</td><td>${row.absent ? "Absent" : `${row.score ?? "—"} / ${row.total ?? "—"}`}</td><td>${ReportUtils.percent(row.percentage)}</td><td>${ReportUtils.duration(row.elapsedMs)}</td></tr>`).join(''):'<tr><td colspan="4">No quiz history.</td></tr>'}</tbody></table></div>`; appendWorkMarks(content, 'Assignment Marks', report.assignments); appendWorkMarks(content, 'Worksheet Marks', report.worksheets); $('viewer-student-pdf').disabled = false; $('viewer-student-pdf').onclick = () => downloadStudentPdf(button.dataset.key, report.student.name, version); } catch(error){if (version === historyVersion && dialog.open) content.innerHTML=`<p>${esc(error.message)}</p>`;} });
$('viewer-history-close').onclick=()=>$('viewer-history').close();
if (token) showApp();
