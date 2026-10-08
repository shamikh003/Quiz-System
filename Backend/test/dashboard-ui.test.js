const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('local previews use the local machine backend, including school LAN addresses', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/config.js'), 'utf8');
    for (const host of ['localhost', '127.0.0.1', '[::1]', '192.168.100.50', '10.0.0.5', '172.16.0.2', '172.31.255.254']) {
        const context = { location: { hostname: host, protocol: 'http:' }, window: {} };
        vm.runInNewContext(source, context);
        assert.equal(context.window.QUIZ_BACKEND_URL, `http://${host}:5000`);
    }
    for (const host of ['quizboard-io.netlify.app', 'example.com', '172.15.0.1', '172.32.0.1', '192.169.0.1', '192.168.999.1']) {
        const context = { location: { hostname: host, protocol: 'https:' }, window: {} };
        vm.runInNewContext(source, context);
        assert.equal(context.window.QUIZ_BACKEND_URL, 'https://quiz-system-wf0d.onrender.com');
    }
    const context = { location: { hostname: '', protocol: 'file:' }, window: {} };
    vm.runInNewContext(source, context);
    assert.equal(context.window.QUIZ_BACKEND_URL, 'http://127.0.0.1:5000');
});

function dashboard(fetch) {
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/admin/admin.js'), 'utf8');
    const elements = {};
    const element = id => elements[id] ||= { value: '', innerHTML: '', textContent: '', addEventListener() {}, setAttribute() {} };
    const context = vm.createContext({ document: { getElementById: element }, fetch,
        BACKEND_URL: 'http://preview', authHeaders: () => ({}), loadedQuestionGrade: null,
        questionCountBadge: {}, gradeLabel: n => Number(n) === 0 ? 'Hifz' : `Grade ${n}`,
        escapeHtml: String, ReportUtils: require('../../frontend/admin/report-utils') });
    vm.runInContext(source.slice(source.indexOf('const dashboardGrade ='), source.indexOf('// ---------- DOM Elements')), context);
    return { elements, load: grade => { element('dashboard-grade').value = grade; return vm.runInContext('loadDashboard()', context); } };
}
const response = data => ({ ok: true, json: async () => data });
const row = (grade, rank) => ({ name: `Grade ${grade} rank ${rank}`, grade, score: 10, total: 20, percentage: 50 });
const totals = { totalQuestions: 109, totalStudents: 90, totalAssignments: 4, pendingSubmissions: 2 };

test('older dashboard API uses the grade report before limiting to top five', async () => {
    const calls = [];
    const ui = dashboard(async url => {
        calls.push(url);
        const grade = Number(new URL(url).searchParams.get('grade'));
        return response(url.includes('/dashboard') ? { ...totals, topResults: [row(7, 1), row(6, 1)] }
            : [row(7, 1), ...Array.from({ length: 6 }, (_, i) => row(grade, i + 1))]);
    });
    for (const grade of ['4', '5', '6', '0']) {
        await ui.load(grade);
        const html = ui.elements['dashboard-results-body'].innerHTML;
        for (let rank = 1; rank <= 5; rank++) assert.ok(html.includes(`Grade ${grade} rank ${rank}`));
        assert.ok(!html.includes('rank 6'));
        assert.ok(!html.includes('Grade 7 rank 1'));
        assert.equal(ui.elements['stat-total-students'].textContent, 90);
    }
    assert.equal(calls.filter(url => url.includes('/api/results?grade=')).length, 4);
});

test('current backend scope and overall dashboard do not request full reports', async () => {
    const calls = [];
    const ui = dashboard(async url => {
        calls.push(url);
        const selected = new URL(url).searchParams.get('grade');
        return response({ ...totals, grade: selected === null ? null : Number(selected), topResults: [row(7, 1)] });
    });
    await ui.load('7'); await ui.load('');
    assert.equal(calls.length, 2);
    assert.ok(calls.every(url => url.includes('/dashboard')));
});

test('late compatibility report cannot replace a newer grade and errors cannot show overall scores', async () => {
    let resolveOld;
    const ui = dashboard(async url => {
        if (url.endsWith('/api/results?grade=5')) return new Promise(resolve => { resolveOld = resolve; });
        return response({ ...totals, grade: url.endsWith('grade=7') ? 7 : undefined, topResults: [row(7, 1)] });
    });
    const old = ui.load('5');
    while (!resolveOld) await new Promise(resolve => setImmediate(resolve));
    await ui.load('7'); resolveOld(response([row(5, 1)])); await old;
    assert.ok(ui.elements['dashboard-results-body'].innerHTML.includes('Grade 7 rank 1'));
    assert.ok(!ui.elements['dashboard-results-body'].innerHTML.includes('Grade 5 rank 1'));
    const failed = dashboard(async url => url.includes('/api/results') ? { ok: false }
        : response({ ...totals, topResults: [row(7, 1)] }));
    await failed.load('5');
    assert.ok(failed.elements['dashboard-results-body'].innerHTML.includes('Could not load'));
    assert.ok(!failed.elements['dashboard-results-body'].innerHTML.includes('Grade 7 rank 1'));
});
