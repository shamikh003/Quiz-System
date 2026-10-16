const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../frontend/admin/student-report.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../frontend/admin/results.html'), 'utf8');
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function setup() {
    class Element {
        constructor() { this.children = []; this.attrs = {}; this.events = {}; this.value = ''; this.textContent = ''; this.hidden = true; }
        append(...nodes) { this.children.push(...nodes); }
        replaceChildren(...nodes) { this.children = nodes; }
        setAttribute(name, value) { this.attrs[name] = value; }
        addEventListener(name, callback) { this.events[name] = callback; }
        remove() {} focus() {} click() { this.onclick?.(); }
    }
    const nodes = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
    const requests = [], timers = new Map(); let timerId = 0, downloads = 0;
    class TestURL extends URL { static createObjectURL() { downloads++; return 'blob:test'; } static revokeObjectURL() {} }
    const document = { getElementById: id => { assert.ok(nodes[id], `Missing element ${id}`); return nodes[id]; },
        createElement: () => new Element(), addEventListener() {}, body: new Element() };
    vm.runInNewContext(source, { document, window: { QUIZ_BACKEND_URL: 'http://test', QuizLoader: { show: () => () => {} } },
        localStorage: { getItem: () => 'teacher-token' }, location: { href: 'http://test/reports', search: '' }, history: { replaceState() {} },
        URL: TestURL, URLSearchParams, AbortController, Option: class { constructor(text, value) { this.text = text; this.value = value; } },
        ReportUtils: { duration: () => '—' }, setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
        fetch: (url, options) => new Promise(resolve => requests.push({ url, options, respond: value => resolve({ ok: true, json: async () => value, blob: async () => value }) })) });
    return { nodes, requests, downloads: () => downloads, flush: () => { const queued = [...timers.values()]; timers.clear(); queued.forEach(callback => callback()); } };
}
const students = [1, 2].map(id => ({ key: `student:${id}`, name: 'Same Name', rollNum: `${id}`, grade: 5, section: 'A' }));
const emptyReport = student => ({ student, generatedAt: '2026-10-16', quizzes: [], assignments: [], summary: {
    quizzesTaken: 0, scoredQuizzes: 0, averageQuiz: null, bestQuiz: null, assignmentAverage: null, gradedAssignments: 0 } });
async function search(ui) {
    ui.nodes['individual-report-tab'].click();
    ui.requests.at(-1).respond({ students, total: 2, sections: ['A'] }); await settle();
}
test('matching equal names remain unselected until a specific roll number is chosen', async () => {
    const ui = setup(); await search(ui);
    const matches = ui.nodes['individual-search-results'].children;
    assert.equal(matches.length, 2);
    assert.ok(matches.every(button => !button.className.includes('selected')));
    assert.ok(matches.every(button => button.children[1].textContent === '›'));
    matches[1].click(); assert.ok(ui.requests.at(-1).url.endsWith('student%3A2'));
});
test('late search and report responses cannot replace a newer student search', async () => {
    const ui = setup(); await search(ui);
    ui.nodes['individual-search-results'].children[0].click(); const oldReport = ui.requests.at(-1);
    ui.nodes['individual-name'].value = 'New name'; ui.nodes['individual-name'].events.input(); ui.flush();
    const oldSearch = ui.requests.at(-1);
    ui.nodes['individual-name'].value = 'Latest name'; ui.nodes['individual-name'].events.input(); ui.flush();
    ui.requests.at(-1).respond({ students: [], total: 0, sections: [] }); await settle();
    oldSearch.respond({ students, total: 2, sections: ['A'] }); oldReport.respond(emptyReport(students[0])); await settle();
    assert.equal(ui.nodes['individual-search-results'].children.length, 0);
    assert.equal(ui.nodes['individual-content'].hidden, true);
    assert.equal(ui.nodes['individual-download-pdf'].disabled, true);
    assert.ok(oldReport.options.signal.aborted); assert.ok(oldSearch.options.signal.aborted);
});
test('changing the student prevents a pending PDF download from exporting the previous report', async () => {
    const ui = setup(); await search(ui);
    ui.nodes['individual-search-results'].children[0].click(); ui.requests.at(-1).respond(emptyReport(students[0])); await settle();
    assert.equal(ui.nodes['individual-content'].hidden, false);
    ui.nodes['individual-download-pdf'].click(); const pdf = ui.requests.at(-1);
    ui.nodes['individual-name'].events.input(); pdf.respond(new Blob(['old report'])); await settle();
    assert.ok(pdf.options.signal.aborted); assert.equal(ui.downloads(), 0);
    assert.equal(ui.nodes['individual-content'].hidden, true);
});
