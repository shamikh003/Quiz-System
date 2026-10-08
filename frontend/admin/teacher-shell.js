// Shared navigation for the teacher's Students and Reports pages.
(() => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const paths = {
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        add: '<path d="M12 5v14M5 12h14"/>',
        manage: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
        assignments: '<path d="M8 7v10a4 4 0 0 0 8 0V6a3 3 0 0 0-6 0v11a1 1 0 0 0 2 0V7"/>',
        students: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
        reports: '<path d="M4 3v18h17M9 17v-5M14 17V7M19 17V4"/>'
    };
    const links = [['dashboard','Dashboard','index.html'], ['add','Add / Edit Question','index.html#add'],
        ['manage','Manage Questions','index.html#manage'], ['assignments','Assignments','index.html#assignments'],
        ['students','Students','students.html'], ['reports','Reports','results.html']];
    sidebar.innerHTML = `<div class="sidebar-brand"><div class="sidebar-brand-text">QuizBoard</div></div>
        <nav class="sidebar-nav" aria-label="Teacher navigation">${links.map(([key,label,href]) =>
            `<a href="${href}" class="sidebar-link${document.body.dataset.teacherPage === key ? ' active' : ''}"${document.body.dataset.teacherPage === key ? ' aria-current="page"' : ''}><span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24">${paths[key]}</svg></span><span class="sidebar-label">${label}</span></a>`).join('')}</nav>
        <div class="sidebar-footer"><button type="button" class="theme-toggle" role="switch" aria-checked="false">Dark mode</button>
        <button type="button" class="sidebar-logout" id="teacher-logout">Log Out</button></div>`;
    const applyTheme = () => {
        const dark = localStorage.getItem('quizTheme') === 'dark';
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        const themeButton = sidebar.querySelector('.theme-toggle');
        themeButton.textContent = 'Dark mode';
        themeButton.setAttribute('role', 'switch');
        themeButton.setAttribute('aria-checked', String(dark));
    };
    sidebar.querySelector('.theme-toggle').onclick = () => {
        localStorage.setItem('quizTheme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme();
    };
    document.getElementById('teacher-logout').onclick = () => { localStorage.removeItem('adminToken'); location.href = 'index.html'; };
    const toggle = document.getElementById('mobile-menu-btn');
    const close = () => { sidebar.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); };
    toggle.onclick = () => toggle.setAttribute('aria-expanded', String(sidebar.classList.toggle('open')));
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && sidebar.classList.contains('open')) { close(); toggle.focus(); } });
    document.addEventListener('click', event => { if (!sidebar.contains(event.target) && !toggle.contains(event.target)) close(); });
    applyTheme();
})();
