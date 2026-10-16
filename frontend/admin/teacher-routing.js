// The same teacher screens have readable addresses on static hosts with rewrites.
(() => {
    const slugs = { dashboard: 'dashboard', add: 'addquestions', edit: 'editquestions',
        manage: 'managequestions', assignments: 'assignments', students: 'students', reports: 'reports' };
    const adminBase = new URL('./', document.baseURI);
    const appBase = new URL('../', adminBase);
    // VS Code Live Server cannot apply _redirects. Keep its working local links.
    const host = location.hostname;
    const local = location.protocol === 'file:' || host === 'localhost' || host === '[::1]'
        || /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
    const known = key => Object.hasOwn(slugs, key);
    function current() {
        const hash = location.hash.slice(1);
        if (known(hash)) return hash;
        const leaf = location.pathname.replace(/\/+$/, '').split('/').pop().replace(/\.html$/, '');
        return Object.keys(slugs).find(key => slugs[key] === leaf)
            || (leaf === 'results' ? 'reports' : 'dashboard');
    }
    function href(key) {
        if (!known(key)) return adminBase.pathname;
        if (!local) return new URL(slugs[key], appBase).pathname;
        return new URL(key === 'students' ? 'students.html' : key === 'reports' ? 'results.html'
            : `index.html#${key}`, adminBase).pathname + (['students', 'reports'].includes(key) ? '' : `#${key}`);
    }
    function navigate(key, { replace = false } = {}) {
        if (!known(key)) return;
        const target = href(key);
        if (location.pathname + location.hash !== target) history[replace ? 'replaceState' : 'pushState'](null, '', target);
    }
    window.TeacherRoutes = { current, href, navigate };
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-teacher-route]').forEach(link => { link.href = href(link.dataset.teacherRoute); });
        const section = document.body.dataset.teacherPage;
        if (section && known(section)) navigate(section, { replace: true });
    });
})();
