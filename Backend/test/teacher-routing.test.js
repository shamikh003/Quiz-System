const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const frontend = path.resolve(__dirname, '../../frontend');
const routing = fs.readFileSync(path.join(frontend, 'admin/teacher-routing.js'), 'utf8');
function page(address, base, section = '') {
    let current = new URL(address); const visits = [], listeners = {};
    const location = Object.fromEntries(['hostname','protocol','pathname','hash'].map(key => [key, undefined]));
    for (const key of Object.keys(location)) Object.defineProperty(location, key, { get: () => current[key] });
    const document = { baseURI: new URL(base, current).href, body: { dataset: { teacherPage: section } },
        addEventListener: (event, handler) => { listeners[event] = handler; }, querySelectorAll: () => [] };
    const history = Object.fromEntries(['pushState','replaceState'].map(method => [method, (_, title, target) => {
        current = new URL(target, current); visits.push({ method, path: current.pathname + current.hash });
    }]));
    const context = { URL, document, location, history, window: {} }; vm.runInNewContext(routing, context);
    return { routes: context.window.TeacherRoutes, location, visits, listeners };
}
test('teacher clean routes preserve deep links, refresh targets, legacy hashes and host prefixes', () => {
    for (const prefix of ['/', '/school/']) {
        const p = page(`https://quizboard-app.pages.dev${prefix}addquestions`, `${prefix}admin/`);
        assert.equal(p.routes.current(), 'add');
        p.routes.navigate('edit'); assert.equal(p.location.pathname, `${prefix}editquestions`);
        assert.equal(p.routes.current(), 'edit'); assert.equal(p.visits[0].method, 'pushState');
        const refreshed = page(`https://quizboard-app.pages.dev${prefix}editquestions`, `${prefix}admin/`);
        assert.equal(refreshed.routes.current(), 'edit');
        const legacy = page(`https://quizboard-app.pages.dev${prefix}admin/index.html#manage`, `${prefix}admin/`);
        assert.equal(legacy.routes.current(), 'manage'); legacy.routes.navigate('manage', { replace: true });
        assert.equal(legacy.location.pathname, `${prefix}managequestions`); assert.equal(legacy.location.hash, '');
        assert.equal(legacy.visits[0].method, 'replaceState');
        legacy.routes.navigate('manage'); assert.equal(legacy.visits.length, 1);
    }
});
test('student/report navigation uses clean host routes and keeps VS Code Live Server links working', () => {
    const online = page('https://quizboard-app.pages.dev/admin/students.html', '/admin/', 'students');
    online.listeners.DOMContentLoaded(); assert.equal(online.location.pathname, '/students');
    assert.equal(online.routes.href('reports'), '/reports'); assert.equal(online.routes.href('add'), '/addquestions');
    const local = page('http://127.0.0.1:5500/frontend/admin/index.html#edit', '/frontend/admin/');
    assert.equal(local.routes.current(), 'edit'); local.routes.navigate('manage');
    assert.equal(local.location.pathname + local.location.hash, '/frontend/admin/index.html#manage');
    assert.equal(local.routes.href('students'), '/frontend/admin/students.html');
});
test('every published clean teacher URL rewrites to its proper page with the correct asset base', () => {
    const aliases = Object.fromEntries(fs.readFileSync(path.join(frontend, '_redirects'), 'utf8').split('\n')
        .filter(line => line.trim() && !line.startsWith('#')).map(line => line.trim().split(/\s+/)));
    for (const [slug, file] of Object.entries({ dashboard: 'index.html', addquestions: 'index.html', editquestions: 'index.html',
        managequestions: 'index.html', assignments: 'index.html', students: 'students.html', reports: 'results.html' })) {
        assert.equal(aliases[`/${slug}`], `/admin/${file}`);
        const source = fs.readFileSync(path.join(frontend, 'admin', file), 'utf8');
        const bootstrap = source.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
        for (const pathname of [`/${slug}`, `/${slug}/`, `/frontend/admin/${file}`]) {
            let base;
            vm.runInNewContext(bootstrap, { location: { pathname }, document: {
                createElement: () => ({}), head: { append: element => { base = element.href; } }
            } });
            assert.equal(base, pathname.startsWith('/frontend/') ? '/frontend/admin/' : '/admin/');
            assert.ok(fs.existsSync(path.join(frontend, 'admin/teacher-routing.js')));
        }
    }
});
