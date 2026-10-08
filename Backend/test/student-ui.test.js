const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function browser() {
    const nodes = new Map();
    const make = (tagName = '') => ({ tagName, style: {}, dataset: {}, children: [], value: '', textContent: '',
        classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } }, setAttribute() {}, remove() {}, focus() {},
        append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; } });
    const node = id => { if (!nodes.has(id)) nodes.set(id, make()); return nodes.get(id); };
    const storage = () => { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; };
    const context = vm.createContext({ console, ReportUtils: require('../../frontend/admin/report-utils'), document: { getElementById: node, createElement: make,
        querySelectorAll: () => [], querySelector: () => node('completedRule'), documentElement: make(), addEventListener() {} },
        window: { addEventListener() {} }, localStorage: storage(), sessionStorage: storage(), navigator: {},
        setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, confirm: () => true,
        fetch: async () => ({ ok: true, json: async () => ({ revision: 1 }) }) });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../frontend/student/quiz.js'), 'utf8'), context);
    vm.runInContext(`attempt = { attemptId: 'attempt', revision: 0, expiresAt: new Date(Date.now()+600000).toISOString(), questions: ['q1','q2','q3'].map(_id => ({_id,text:_id,options:[{id:'A',text:'Answer'}]})) }; queue = ['q1','q2','q3']; active = true; renderQuestion();`, context);
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
test('failed save retains a pending local draft and retry confirms it without losing the next question', async () => {
    const { context, node, read } = browser();
    vm.runInContext("selected = 'A'; fetch = async () => { throw new Error('offline'); }", context);
    await node('next-btn').onclick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(read('queue[0]'), 'q2'); assert.equal(read('selected'), null); assert.equal(read('answers.size'), 1);
    assert.equal(read('pendingCount()'), 1); assert.equal(read('saveFailed'), true);
    assert.equal(read("JSON.parse(sessionStorage.getItem('draft-attempt')).answers[0].selected"), 'A');
    vm.runInContext("fetch = async () => ({ok:true,json:async()=>({revision:1})})", context);
    await node('retry-save-btn').onclick();
    assert.equal(read('pendingCount()'), 0); assert.equal(read('attempt.revision'), 1); assert.equal(read('queue[0]'), 'q2');
});

test('slow saves do not delay Next, serialize revisions and coalesce newer answers', async () => {
    const { context, node, read } = browser(); const calls = [], release = [];
    context.fetch = (url, options) => { calls.push(JSON.parse(options.body)); return new Promise(resolve => release.push(() => resolve({ ok: true, json: async () => ({ revision: calls.length }) }))); };
    vm.runInContext("selected='A'",context); await node('next-btn').onclick();
    assert.equal(read('queue[0]'),'q2'); assert.equal(calls.length,1);
    assert.equal(node('save-status').textContent,'');
    vm.runInContext("selected='A'",context); await node('next-btn').onclick();
    assert.equal(read('queue[0]'),'q3'); assert.equal(calls.length,1); assert.equal(node('skip-btn').disabled,false);
    release.shift()(); await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.length,2); assert.equal(calls[1].revision,1); assert.equal(calls[1].answers.length,2);
    release.shift()(); await new Promise(resolve=>setImmediate(resolve));
    assert.equal(read('pendingCount()'),0); assert.equal(read('attempt.revision'),2); assert.equal(read('answers.size'),2);
    assert.equal(node('save-status').textContent,'');
});

test('final submission waits for every queued answer to be acknowledged', async () => {
    const { context, node, read } = browser(); const saves=[], release=[]; let submits=0;
    context.fetch = async (url,options) => {
        if (url.endsWith('/quiz/submit')) { submits++; return {ok:true,json:async()=>({score:3,total:3})}; }
        saves.push(JSON.parse(options.body)); const revision=saves.length;
        return new Promise(resolve=>release.push(()=>resolve({ok:true,json:async()=>({revision})})));
    };
    for (let index=0;index<2;index++) {vm.runInContext("selected='A'",context);await node('next-btn').onclick();}
    vm.runInContext("selected='A'",context); const final=node('next-btn').onclick();
    assert.equal(submits,0); assert.equal(read('submitting'),true);
    release.shift()(); await new Promise(resolve=>setImmediate(resolve));
    assert.equal(saves.length,2); assert.equal(saves[1].answers.length,3); assert.equal(submits,0);
    release.shift()(); await final;
    assert.equal(submits,1); assert.equal(read('pendingCount()'),0); assert.equal(node('score-display').textContent,'3 / 3 (100%)');
    assert.equal(read("sessionStorage.getItem('draft-attempt')"),null);
});

test('lost save acknowledgement recovers the server revision before sending later answers', async () => {
    const { context, node, read } = browser(); let saved;
    context.fetch = async (url,options) => {
        if(url.endsWith('/quiz/save')) {saved=JSON.parse(options.body);throw new Error('response lost');}
        return {ok:true,json:async()=>({attemptId:'attempt',revision:1,answers:saved.answers})};
    };
    vm.runInContext("selected='A'",context);await node('next-btn').onclick();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(read('attempt.revision'),1);assert.equal(read('pendingCount()'),0);assert.equal(read('conflict'),false);assert.equal(read('saveFailed'),false);
});

test('another-tab revision conflict freezes navigation instead of overwriting server answers', async () => {
    const { context, node, read } = browser();
    context.fetch = async () => ({ok:false,status:409,json:async()=>({error:'Changed in another tab'})});
    vm.runInContext("selected='A'",context);await node('next-btn').onclick();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(read('conflict'),true);assert.equal(read('pendingCount()'),1);assert.equal(node('skip-btn').disabled,true);assert.equal(node('finish-btn').disabled,true);
    assert.ok(node('save-status').textContent.includes('another tab'));
});

test('reload restores unsent answers, including a save whose acknowledgement was lost', () => {
    const { context, read } = browser();
    vm.runInContext(`sessionStorage.setItem('draft-attempt',JSON.stringify({revision:0,confirmed:[],answers:[{questionId:'q1',selected:'A'},{questionId:'q2',selected:'A'}],inFlight:[{questionId:'q1',selected:'A'}]}));
        attempt.revision=1; confirmedAnswers=new Map([['q1','A']]);answers=new Map(confirmedAnswers); restoreDraft();`,context);
    assert.equal(read('answers.size'),2);assert.equal(read('pendingCount()'),1);
    vm.runInContext(`attempt.revision=3; answers=new Map(confirmedAnswers);restoreDraft();`,context);
    assert.equal(read('answers.size'),1);assert.equal(read("sessionStorage.getItem('draft-attempt')"),null);
});

test('offline submission does not silently mark only a subset of pending answers', async () => {
    const { context, node, read } = browser();let submits=0;
    context.fetch=async url=>{if(url.endsWith('/quiz/submit'))submits++;throw new Error('offline');};
    vm.runInContext("selected='A'",context);await node('next-btn').onclick();await new Promise(resolve=>setImmediate(resolve));
    await node('finish-btn').onclick();assert.equal(submits,0);assert.equal(read('active'),true);assert.equal(read('pendingCount()'),1);
});

test('expired saves show the authoritative result and explain unconfirmed answers', async () => {
    const { context, node, read } = browser();
    context.fetch=async()=>({ok:false,status:409,json:async()=>({error:'Ended',result:{score:0,total:3}})});
    vm.runInContext("selected='A'",context);await node('next-btn').onclick();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(read('active'),false);assert.equal(node('score-display').textContent,'0 / 3 (0%)');
    assert.ok(node('message').textContent.includes('Only confirmed answers'));
});

test('lost acknowledgement followed by expiry does not claim a marked answer was lost', async () => {
    const { context, node } = browser();
    context.fetch=async url=>{
        if(url.endsWith('/quiz/save'))throw new Error('response lost');
        return {ok:false,status:409,json:async()=>({error:'Ended',result:{score:1,total:3,details:[{questionText:'q1',selected:'A',options:[{id:'A',text:'Answer'}]}]}})};
    };
    vm.runInContext("selected='A'",context);await node('next-btn').onclick();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(node('score-display').textContent,'1 / 3 (33%)');assert.equal(node('message').textContent,'');
});
test('every JavaScript element ID is present in the student page', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/student/quiz.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '../../frontend/student/quiz.html'), 'utf8');
    for (const match of source.matchAll(/\$\('([^']+)'\)/g)) assert.ok(html.includes(`id="${match[1]}"`), match[1]);
});

test('countdown ring follows the original deadline and server clock without altering quiz state', () => {
    const { context, node, read } = browser();
    let warning;
    node('timer-display').classList.toggle = (name, value) => { if (name === 'time-warning') warning = value; };
    vm.runInContext(`Date.now = () => 1800000; clockOffset = 5000; timerDurationMs = 120000;
        attempt.expiresAt = new Date(1870000).toISOString(); selected = 'A'; tick();`, context);
    assert.equal(node('time-left').textContent, '01:05');
    assert.ok(Math.abs(Number(node('timer-ring-progress').style.strokeDashoffset) - (100 * 55 / 120)) < 0.001);
    assert.equal(warning, false);
    vm.runInContext('Date.now = () => 1805000; tick();', context);
    assert.equal(node('time-left').textContent, '01:00');
    assert.equal(Number(node('timer-ring-progress').style.strokeDashoffset), 50);
    assert.equal(warning, true);
    assert.equal(read('selected'), 'A');
    assert.deepEqual(read('queue'), ['q1','q2','q3']);
    assert.equal(read('attempt.expiresAt'), new Date(1870000).toISOString());
});

test('resuming preserves original ring duration, including compatibility with older backends', () => {
    const { read } = browser();
    const original = `{attemptId:'timer-test',startedAt:'2026-10-05T05:00:00Z',expiresAt:'2026-10-05T05:20:00Z',serverNow:'2026-10-05T05:10:00Z'}`;
    assert.equal(read(`countdownDuration(${original})`), 1200000);
    const legacy = `{attemptId:'legacy',expiresAt:'2026-10-05T05:20:00Z',serverNow:'2026-10-05T05:10:00Z'}`;
    assert.equal(read(`countdownDuration(${legacy})`), 600000);
    assert.equal(read(`countdownDuration({...${legacy},serverNow:'2026-10-05T05:15:00Z'})`), 600000);
});

test('student completion shows unchanged marks and time without a speed score', () => {
    const { context, node } = browser();
    vm.runInContext('displayResult({score:8,total:10,percentage:80,elapsedMs:300000})', context);
    assert.equal(node('score-display').textContent, '8 / 10 (80%)');
    assert.equal(node('ranking-display').textContent, 'Time: 5:00.000');
});

test('Urdu switches question and every option without changing selected IDs, queue or deadline', () => {
    const { context, node, read } = browser();
    vm.runInContext(`attempt.expiresAt = '2026-10-05T05:00:00Z'; selected = 'A';
        attempt.questions[0].urdu = {text:'کمپیوٹر کیا ہے؟',options:[{id:'A',text:'ایک مشین'}]};`, context);
    node('lang-toggle').onclick();
    assert.ok(node('question-title').textContent.includes('کمپیوٹر کیا ہے؟'));
    assert.equal(node('options-container').children[0].textContent, 'A: ایک مشین');
    assert.equal(read('selected'), 'A'); assert.deepEqual(read('queue'), ['q1','q2','q3']);
    assert.equal(read('attempt.expiresAt'), '2026-10-05T05:00:00Z');
    node('lang-toggle').onclick();
    assert.ok(node('question-title').textContent.includes('q1'));
    assert.equal(node('options-container').children[0].textContent, 'A: Answer');
});

test('missing or mismatched Urdu options fall back to the full English question', () => {
    const { context, node } = browser();
    vm.runInContext(`attempt.questions[0].urdu = {text:'سوال',options:[{id:'B',text:'جواب'}]};`, context);
    node('lang-toggle').onclick();
    assert.ok(node('question-title').textContent.includes('q1'));
    assert.equal(node('options-container').children[0].textContent, 'A: Answer');
    assert.ok(node('translation-notice').textContent.includes('دستیاب نہیں'));
});

test('completed answer review switches language without exposing the correct answer', () => {
    const { context, node } = browser();
    vm.runInContext(`displayResult({score:1,total:1,details:[{questionText:'Device?',selected:'A',options:[{id:'A',text:'Machine'}],
        urdu:{text:'آلہ؟',options:[{id:'A',text:'مشین'}]}}]})`,context);
    node('lang-toggle').onclick();
    const card = node('answer-review').children[0];
    assert.ok(card.children[0].textContent.includes('آلہ؟'));
    assert.ok(card.children[1].textContent.includes('مشین'));
    assert.equal(card.children.length, 2);
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
