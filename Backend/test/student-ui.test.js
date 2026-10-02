const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function browser() {
    const nodes = new Map();
    const make = (tagName = '') => ({ tagName, style: {}, dataset: {}, children: [], value: '', textContent: '',
        classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, remove() {}, focus() {},
        append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; } });
    const node = id => { if (!nodes.has(id)) nodes.set(id, make()); return nodes.get(id); };
    const storage = () => { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; };
    const context = vm.createContext({ console, ReportUtils: require('../../frontend/admin/report-utils'), document: { getElementById: node, createElement: make,
        querySelectorAll: () => [], querySelector: () => node('completedRule'), documentElement: make(), addEventListener() {} },
        window: { addEventListener() {} }, localStorage: storage(), sessionStorage: storage(), navigator: {},
        setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, confirm: () => true,
        fetch: async () => ({ ok: true, json: async () => ({ revision: 1 }) }) });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../frontend/student/quiz.js'), 'utf8'), context);
    vm.runInContext(`attempt = { attemptId: 'attempt', revision: 0, questions: ['q1','q2','q3'].map(_id => ({_id,text:_id,options:[{id:'A',text:'Answer'}]})) }; queue = ['q1','q2','q3']; active = true; renderQuestion();`, context);
    return { context, node, read: expression => JSON.parse(JSON.stringify(vm.runInContext(expression, context))) };
}

test('skipped questions move to end and return after other questions', async () => {
    const { context, node, read } = browser();
    node('skip-btn').onclick(); assert.deepEqual(read('queue'), ['q2', 'q3', 'q1']);
    vm.runInContext("selected = 'A'", context); await node('next-btn').onclick();
    assert.deepEqual(read('queue'), ['q3', 'q1']); assert.equal(read('answers.size'), 1);
    node('skip-btn').onclick(); assert.deepEqual(read('queue'), ['q1', 'q3']);
    assert.ok(node('question-title').textContent.includes('q1'));
});
test('repeated skips never duplicate questions or inflate the denominator', () => {
    const { node, read } = browser();
    for (let i = 0; i < 10; i++) node('skip-btn').onclick();
    assert.equal(read('queue.length'), 3); assert.equal(read('new Set(queue).size'), 3);
    assert.equal(read('attempt.questions.length'), 3); assert.equal(read('answers.size'), 0);
});
test('failed save preserves question and selected answer for retry', async () => {
    const { context, node, read } = browser();
    vm.runInContext("selected = 'A'; fetch = async () => { throw new Error('offline'); }", context);
    await node('next-btn').onclick();
    assert.equal(read('queue[0]'), 'q1'); assert.equal(read('selected'), 'A'); assert.equal(read('answers.size'), 0);
    assert.equal(node('next-btn').disabled, false);
});
test('every JavaScript element ID is present in the student page', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/student/quiz.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '../../frontend/student/quiz.html'), 'utf8');
    for (const match of source.matchAll(/\$\('([^']+)'\)/g)) assert.ok(html.includes(`id="${match[1]}"`), match[1]);
});

test('student completion shows unchanged marks and time without a speed score', () => {
    const { context, node } = browser();
    vm.runInContext('displayResult({score:8,total:10,percentage:80,elapsedMs:300000})', context);
    assert.equal(node('score-display').textContent, '8 / 10 (80%)');
    assert.equal(node('ranking-display').textContent, 'Time: 5:00.000');
});

test('archived assignment marks stay visible without download or upload controls', () => {
    const { context, node } = browser();
    vm.runInContext(`report = {student:{name:'Student',grade:4,section:'A'},results:[],page:1,pages:1,assignments:[
        {title:'Old task',fileName:'old.docx',maxMarks:20,deletedAt:'2026-10-02T00:00:00Z',submission:{status:'graded',marks:18,percentage:90}},
        {title:'New task',fileName:'new.docx',maxMarks:10,submission:null}
    ]}; renderReport();`, context);
    const [archived, active] = node('assignments-list').children;
    assert.ok(archived.children.some(child => child.textContent === 'Graded: 18 / 20 (90%)'));
    assert.ok(archived.children.some(child => child.textContent === 'Archived'));
    assert.ok(archived.children.every(child => !['button', 'input'].includes(child.tagName)));
    assert.equal(active.children.filter(child => child.tagName === 'button').length, 2);
});
