const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function page(fetch, confirm = () => true) {
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/admin/admin.js'), 'utf8');
    const button = { addEventListener(event, fn) { this[event] = fn; } };
    const select = { value: '', addEventListener() {} };
    const element = () => ({ innerHTML: '', appendChild() {}, querySelector: () => ({ addEventListener() {} }) });
    const context = vm.createContext({ clearBtn: button, filterGradeSelect: select, questionListDiv: element(),
        questionCountBadge: {}, document: { createElement: element, getElementById: () => null }, gradeLabel: grade => Number(grade) === 0 ? 'Hifz' : `Grade ${grade}`,
        BACKEND_URL: 'http://local-test', authHeaders: () => ({}), fetch, confirm, alert() {}, escapeHtml: String,
        startEditQuestion() {}, deleteQuestion() {}, localStorage: { removeItem() {} }, showLoggedOutView() {}, encodeURIComponent });
    vm.runInContext(source.slice(source.indexOf('// ---------- Question list (manage tab)'), source.indexOf('function startEditQuestion')), context);
    vm.runInContext(source.slice(source.indexOf('// Bulk deletion always'), source.indexOf('// ================= ASSIGNMENTS TAB')), context);
    return { button, select, load: () => vm.runInContext('loadQuestionList()', context) };
}
const question = { _id: 'q', text: 'Question', grade: 0, options: [{ id: 'A', text: 'Answer' }], correct: 'A' };
const response = rows => ({ ok: true, status: 200, json: async () => rows });

test('clear button requires a loaded grade and sends Hifz explicitly', async () => {
    const requests = [], confirmations = [];
    const ui = page(async (url, options) => {
        requests.push({ url, method: options.method });
        return response(options.method === 'DELETE' ? { deletedCount: 1 } : [question]);
    }, message => { confirmations.push(message); return true; });
    await ui.load(); assert.equal(ui.button.disabled, true);
    await ui.button.click(); assert.equal(requests.filter(r => r.method === 'DELETE').length, 0);
    ui.select.value = '0'; await ui.load(); assert.equal(ui.button.disabled, false);
    assert.equal(ui.button.textContent, 'Clear Hifz Questions');
    await ui.button.click();
    assert.ok(confirmations[0].includes('1 saved questions for Hifz'));
    assert.equal(requests.find(r => r.method === 'DELETE').url, 'http://local-test/api/admin/questions?grade=0');
    assert.equal(ui.select.disabled, false);
});
test('late grade responses cannot enable deletion for the wrong selection', async () => {
    const pending = [];
    const ui = page(() => new Promise(resolve => pending.push(resolve)));
    ui.select.value = '4'; const first = ui.load();
    ui.select.value = '7'; const second = ui.load();
    assert.equal(ui.button.disabled, true);
    pending[1](response([])); await second;
    pending[0](response([question])); await first;
    assert.equal(ui.button.disabled, true); assert.equal(ui.button.textContent, 'Clear Grade 7 Questions');
});
test('cancelling confirmation never sends a delete request', async () => {
    let deletions = 0;
    const ui = page(async (url, options) => { if (options.method === 'DELETE') deletions++; return response([question]); }, () => false);
    ui.select.value = '4'; await ui.load(); await ui.button.click(); assert.equal(deletions, 0);
});
