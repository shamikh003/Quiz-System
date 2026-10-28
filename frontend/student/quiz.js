const BACKEND_URL = window.QUIZ_BACKEND_URL || 'https://quiz-system-hpy5.onrender.com';
const $ = id => document.getElementById(id);
const labels = {
 studentPanel:['My Student Panel','میرا اسٹوڈنٹ پینل'], section:['Section','سیکشن'],
 lookupBusy:['Finding grade and section…','کلاس اور سیکشن تلاش ہو رہے ہیں…'], lookupMissing:['Roll number not found.','رول نمبر موجود نہیں۔'],
 lookupPassword:['Enter password to identify your account.','اپنے اکاؤنٹ کی شناخت کے لیے پاس ورڈ درج کریں۔'], lookupError:['Could not find grade and section. Try signing in.','کلاس اور سیکشن معلوم نہیں ہو سکے۔ لاگ اِن کریں۔'],
 signingIn:['Signing you in…','لاگ اِن ہو رہا ہے…'], loadingScores:['Loading scores…','نتائج لوڈ ہو رہے ہیں…'],
 loadingAssignments:['Loading assignments…','اسائنمنٹس لوڈ ہو رہی ہیں…'], loadingQuiz:['Loading quiz…','کوئز لوڈ ہو رہا ہے…'],
 uploading:['Uploading assignment…','اسائنمنٹ جمع ہو رہی ہے…'], submittingQuiz:['Submitting quiz…','کوئز جمع ہو رہا ہے…'],
 marksPercent:['Marks %','نمبر %'], timeTaken:['Time','وقت'], timeRemaining:['Time remaining','وقت باقی'],
 computer:['Computer','کمپیوٹر'], navigator:['Question navigator','سوالات کی فہرست'],
 legendAnswered:['Answered','جواب دیا'], legendCurrent:['Current','موجودہ'], legendSkipped:['Skipped','چھوڑا ہوا'], legendUnanswered:['Unanswered','جواب باقی'],
 skipReturn:['Skip & return','چھوڑیں اور واپس آئیں'], reviewAnswers:['Review answers','جوابات کا جائزہ'],
 allSaved:['All answers saved','تمام جوابات محفوظ ہیں'], savingAnswers:['Saving answers…','جوابات محفوظ ہو رہے ہیں…'],
 viewImage:['View larger image','بڑی تصویر دیکھیں'], questionImage:['Question image','سوال کی تصویر'], closeImage:['Close','بند کریں'],
 imageError:['This image could not be loaded. Please contact your teacher.','تصویر لوڈ نہیں ہو سکی۔ اپنے استاد سے رابطہ کریں۔'],
 leaveQuiz:['Sign out? Your saved answers remain, but the quiz timer will continue.','لاگ آؤٹ کریں؟ محفوظ جوابات رہیں گے لیکن وقت چلتا رہے گا۔'],
 translationMissing:['Urdu translation is not available for this question yet.','اس سوال کا اردو ترجمہ ابھی دستیاب نہیں ہے۔'],
 review:['Your answer','آپ کا جواب'], unanswered:['Not answered','جواب نہیں دیا'],
 login:['Student Login','طالب علم لاگ اِن'], fatherName:['Father name','والد کا نام'],
 roll:['Roll number','رول نمبر'], grade:['Grade','کلاس'], choose:['Choose grade','کلاس منتخب کریں'], password:['Password','پاس ورڈ'], logout:['Log out','لاگ آؤٹ'],
 start:['Start / Resume Quiz','کوئز شروع / جاری کریں'], refresh:['Refresh report','رپورٹ تازہ کریں'], scores:['My Test Scores','میرے ٹیسٹ کے نمبر'], date:['Date','تاریخ'], score:['Score','نمبر'],
 previous:['Previous','پچھلا'], next:['Next','اگلا'], assignments:['My Assignments','میری اسائنمنٹس'], skip:['Skip','چھوڑیں'],
 saveNext:['Save & Next','محفوظ کریں اور آگے جائیں'], finish:['Submit Quiz','کوئز جمع کریں'], complete:['Quiz Complete','کوئز مکمل'],
 retry:['Retry submission','دوبارہ جمع کریں'], back:['Back to my report','میری رپورٹ پر واپس'], emptyScores:['No test results yet.','ابھی کوئی نتیجہ نہیں۔'], emptyAssignments:['No assignments yet.','ابھی کوئی اسائنمنٹ نہیں۔'],
 pending:['Not submitted','جمع نہیں ہوئی'], submitted:['Submitted — waiting for marking','جمع ہو گئی — استاد کی جانچ باقی ہے'], graded:['Graded','نمبر مل گئے'],
 archived:['Archived','محفوظ ریکارڈ'],
 download:['Download assignment','اسائنمنٹ ڈاؤن لوڈ کریں'], upload:['Submit completed file','مکمل فائل جمع کریں'], busy:['Please wait…','براہ کرم انتظار کریں…'],
 saveError:['Save failed. Please retry.','محفوظ نہیں ہوا۔ دوبارہ کوشش کریں۔'], retrySave:['Retry saving answers','جوابات دوبارہ محفوظ کریں'],
 unsavedEnded:['The quiz ended before all pending answers reached the server. Only confirmed answers were marked.','کچھ جوابات سرور تک پہنچنے سے پہلے وقت ختم ہو گیا۔ صرف محفوظ جوابات کے نمبر ملے ہیں۔'],
 network:['Could not connect. Please try again.','رابطہ نہیں ہو سکا۔ دوبارہ کوشش کریں۔'], todayDone:['Today’s quiz is complete','آج کا کوئز مکمل ہو گیا'],
 question:['Question','سوال'], answered:['answered','جوابات دیے'], remaining:['remaining','باقی'], skipped:['Skipped question moved to the end.','چھوڑا گیا سوال آخر میں دوبارہ آئے گا۔'],
 confirm:['Submit now? Unanswered questions count as zero.','ابھی جمع کریں؟ جن سوالات کے جواب نہیں دیے ان کے نمبر صفر ہوں گے۔'],
 file:['Choose a Word, Excel or PowerPoint file (maximum 15 MB).','ورڈ، ایکسل یا پاورپوائنٹ فائل منتخب کریں (زیادہ سے زیادہ 15 MB)۔'],
 flags:['Leaving the quiz tab or full-screen is recorded. Click here to return to full-screen.','ٹیب یا فل اسکرین چھوڑنا ریکارڈ ہوتا ہے۔ فل اسکرین پر واپس جانے کے لیے یہاں کلک کریں۔'],
 submitError:['Submission not confirmed. Keep this page open and retry.','جمع ہونے کی تصدیق نہیں ہوئی۔ صفحہ کھلا رکھیں اور دوبارہ کوشش کریں۔'],
 timeUp:['Time is up. Submitting saved answers…','وقت ختم۔ محفوظ جوابات جمع ہو رہے ہیں…'],
 reload:['Answers changed in another tab or time expired. Reload to resume safely.','دوسرے ٹیب میں جوابات تبدیل ہوئے یا وقت ختم ہو گیا۔ صفحہ دوبارہ لوڈ کریں۔'],
 fullscreen:['The quiz uses full-screen. Please stay on this tab until you finish.','کوئز فل اسکرین میں ہوگا۔ مکمل ہونے تک اسی ٹیب پر رہیں۔']
};
let language = localStorage.getItem('quizLang') === 'ur' ? 'ur' : 'en';
let token = sessionStorage.getItem('studentToken');
let reportLoading = false;
let detectedStudent = null, lookupState = '', lookupController, lookupTimer, lookupId = 0;
let report, lastResult, page = 1, attempt, queue = [], selected = null, answers = new Map();
let timer, clockOffset = 0, timerDurationMs = 1, active = false, submitting = false, savePromise = null, conflict = false;
let tabSwitchCount = 0, fullscreenExitCount = 0;
let confirmedAnswers = new Map(), inFlightAnswers = null, saveFailed = false;
let reviewQuestionId = null, skippedQuestions = new Set();
const t = key => labels[key]?.[language === 'ur' ? 1 : 0] || key;
const gradeLabel = grade => Number(grade) === 0 ? (language === 'ur' ? 'حفظ' : 'Hifz') : `${t('grade')} ${grade}`;
const notify = text => { $('message').textContent = text; };
function element(tag, text, className) {
 const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
function applyLanguage() {
 renderDetectedStudent();
 document.documentElement.lang = language; document.documentElement.dir = language === 'ur' ? 'rtl' : 'ltr';
 document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
 $('lang-toggle').textContent = language === 'ur' ? 'English' : 'اردو';
 if (report) renderReport(); if (active) { renderQuestion(); updateSaveStatus(); }
 if (lastResult && !active && !$('result-container').classList.contains('hidden')) displayResult(lastResult);
}
$('lang-toggle').onclick = () => { language = language === 'en' ? 'ur' : 'en'; localStorage.setItem('quizLang', language); applyLanguage(); };
function applyTheme() {
 const dark = localStorage.getItem('quizTheme') === 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light';
 $('theme-toggle').textContent = 'Dark mode';
 $('theme-toggle').setAttribute('role', 'switch');
 $('theme-toggle').setAttribute('aria-checked', String(dark));
}
$('theme-toggle').onclick = () => { localStorage.setItem('quizTheme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); };
function screen(name) {
 for (const id of ['login-container','dashboard','quiz-container','result-container']) { $(id).classList.toggle('hidden', id !== name); $(id).style.display = id === name ? 'block' : 'none'; }
 document.body?.classList.toggle('quiz-session-active', name === 'quiz-container');
 $('logout-btn').classList.toggle('hidden', !token);
 if (name !== 'quiz-container') $('question-image-dialog').close?.();
}
async function api(path, options = {}) {
 let response;
 try { response = await fetch(`${BACKEND_URL}/api${path}`, { ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } }); }
 catch { throw new Error(t('network')); }
 const data = await response.json();
 if (!response.ok) {
  if (response.status === 401) { token = null; sessionStorage.removeItem('studentToken'); active = false; clearInterval(timer); screen('login-container'); }
  const error = new Error(data.error || t('network')); error.status = response.status; error.result = data.result; throw error;
 }
 return data;
}
const post = (path, body = {}, options = {}) => api(path, { ...options, method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
const saveTimeout = () => typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(15000) } : {};
function renderDetectedStudent() {
 $('student-grade').value = detectedStudent ? gradeLabel(detectedStudent.grade) : '';
 $('student-section').value = detectedStudent?.section || '';
 $('student-lookup-status').textContent = lookupState ? t(lookupState) : '';
}
async function findStudent() {
 const current = ++lookupId, rollNum = $('student-roll').value.trim();
 lookupController?.abort(); detectedStudent = null; lookupState = rollNum ? 'lookupBusy' : ''; renderDetectedStudent();
 if (!rollNum) return;
 lookupController = new AbortController();
 try {
  const response = await fetch(`${BACKEND_URL}/api/student/lookup`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({rollNum}), signal:lookupController.signal, cache:'no-store' });
  if (!response.ok) throw new Error('Lookup failed');
  const data = await response.json(); if(current !== lookupId) return;
  detectedStudent = data.found && !data.needsPassword ? data : null;
  lookupState = !data.found ? 'lookupMissing' : data.needsPassword ? 'lookupPassword' : '';
 } catch(error) { if(error.name === 'AbortError' || current !== lookupId) return; lookupState = 'lookupError'; }
 renderDetectedStudent();
}
$('student-roll').addEventListener('input', () => {
 ++lookupId; lookupController?.abort(); clearTimeout(lookupTimer); detectedStudent = null; lookupState = ''; renderDetectedStudent();
 lookupTimer = setTimeout(findStudent, 350);
});
$('student-roll').addEventListener('blur', () => { clearTimeout(lookupTimer); findStudent(); });
$('login-form').onsubmit = async event => {
 event.preventDefault(); $('login-btn').disabled = true; notify('');
 const stopLoading = globalThis.QuizLoader?.show($('student-login-loader'), t('signingIn')) || (() => {});
 try {
  const data = await post('/student/login', { rollNum:$('student-roll').value.trim(), password:$('student-password').value });
  ++lookupId; clearTimeout(lookupTimer); lookupController?.abort(); detectedStudent = data.student; lookupState = ''; renderDetectedStudent();
  token = data.token; sessionStorage.setItem('studentToken', token); $('student-password').value = ''; page = 1; await loadReport();
 } catch (error) { notify(error.message); } finally { stopLoading(); $('login-btn').disabled = false; }
};
$('logout-btn').onclick = async () => {
 if (active) {
  if (!confirm(t('leaveQuiz'))) return;
  persistSelection({ advance: false });
  try { if (savePromise) await savePromise; if (pendingCount()) await drainSaves(); }
  catch (error) { notify(error.message); return; }
  active = false; clearInterval(timer); exitFullscreen();
 }
 token = null; report = null; sessionStorage.removeItem('studentToken'); screen('login-container'); notify('');
 $('quiz-header-student').textContent = ''; $('quiz-header-student').classList.add('hidden');
};
async function loadReport() {
 if (reportLoading) return;
 reportLoading = true;
 const controls = ['refresh-btn','prev-page','next-page'];
 controls.forEach(id => { $(id).disabled = true; });
 const stopScores = globalThis.QuizLoader?.show($('student-report-loader'), t('loadingScores')) || (() => {});
 const stopAssignments = globalThis.QuizLoader?.show($('student-assignments-loader'), t('loadingAssignments')) || (() => {});
 const stopLogin = $('login-container').classList.contains('hidden') ? () => {} : globalThis.QuizLoader?.show($('student-login-loader'), t('signingIn')) || (() => {});
 try { report = await api(`/student/report?page=${page}`); screen('dashboard'); renderReport(); notify(''); }
 catch (error) { notify(error.message); }
 finally {
  reportLoading = false; stopScores(); stopAssignments(); stopLogin();
  $('refresh-btn').disabled = false;
  $('prev-page').disabled = !report || report.page <= 1; $('next-page').disabled = !report || report.page >= report.pages;
 }
}
function renderReport() {
 $('quiz-header-student').textContent = `${report.student.name} · ${t('roll')} ${report.student.rollNum || '—'}`;
 $('quiz-header-student').classList.remove('hidden');
 $('student-heading').textContent = report.student.name;
 $('student-father-name').textContent = `${t('fatherName')}: ${report.student.fatherName || '—'}`;
 $('student-meta').textContent = `${t('roll')} ${report.student.rollNum || '—'} · ${gradeLabel(report.student.grade)} · ${report.student.section || 'Unassigned'}`;
 const done = report.today?.status === 'submitted'; $('start-btn').disabled = done; $('start-btn').textContent = t(done ? 'todayDone' : 'start');
 $('scores-body').replaceChildren(); $('student-score-cards').replaceChildren();
 $('student-score-cards').setAttribute('aria-label',t('scores'));
 if (!report.results.length) { const cell = element('td',t('emptyScores')); cell.colSpan = 4; const row = element('tr'); row.append(cell); $('scores-body').append(row); $('student-score-cards').append(element('p',t('emptyScores'),'shell-empty')); }
 for (const result of report.results) {
  const row = element('tr'); const marks = element('td'); marks.innerHTML = ReportUtils.marks(result.percentage);
  row.append(element('td',new Date(result.date).toLocaleString(language === 'ur' ? 'ur-PK' : 'en-GB',{timeZone:'Asia/Karachi'})),element('td',`${result.score} / ${result.total}`),marks,element('td',ReportUtils.duration(result.elapsedMs))); $('scores-body').append(row);
  const date = result.date ? new Date(result.date) : null;
  const validDate = date && Number.isFinite(date.getTime());
  const locale = language === 'ur' ? 'ur-PK' : 'en-GB';
  const card = element('article',undefined,'mobile-result-card student-score-card');
  const header = element('div',undefined,'mobile-result-header');
  const info = element('div',undefined,'mobile-result-student');
  info.append(element('h3',validDate ? date.toLocaleDateString(locale,{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Karachi'}) : '—'),element('p',validDate ? date.toLocaleTimeString(locale,{timeZone:'Asia/Karachi'}) : '—','mobile-result-meta'));
  const percent = element('div',undefined,'mobile-result-score');
  percent.append(element('strong',ReportUtils.percent(result.percentage)),element('span',t('marksPercent')));
  header.append(info,percent);
  const metrics = element('div',undefined,'mobile-result-metrics');
  for (const [label,value] of [[t('score'),`${result.score} / ${result.total}`],[t('timeTaken'),ReportUtils.duration(result.elapsedMs)]]) {
   const metric = element('div'); metric.append(element('span',label),element('strong',value)); metrics.append(metric);
  }
  card.append(header,metrics); $('student-score-cards').append(card);
 }
 $('page-label').textContent = `${report.page} / ${report.pages}`; $('prev-page').disabled = report.page <= 1; $('next-page').disabled = report.page >= report.pages;
 $('assignments-list').replaceChildren(); if (!report.assignments.length) $('assignments-list').append(element('p',t('emptyAssignments')));
 for (const assignment of report.assignments) {
  const card = element('article',undefined,'assignment-report-card'); card.append(element('h3',assignment.title),element('p',assignment.fileName));
  const submission = assignment.submission;
  card.append(element('p',submission?.status === 'graded' ? `${t('graded')}: ${submission.marks} / ${assignment.maxMarks} (${submission.percentage}%)` : t(submission ? 'submitted' : 'pending'),'assignment-status'));
  if (assignment.deletedAt || assignment.historical) {
   card.append(element('p',t('archived'),'assignment-status'));
   $('assignments-list').append(card);
   continue;
  }
  const download = element('button',t('download'),'btn-secondary'); download.type = 'button';
  download.onclick = async () => {
   download.disabled = true;
   try {
    const response = await fetch(`${BACKEND_URL}/api/assignments/${assignment._id}/download`,{headers:{Authorization:`Bearer ${token}`}});
    if (!response.ok) throw new Error(t('network'));
    const url = URL.createObjectURL(await response.blob()); const link = element('a'); link.href = url; link.download = assignment.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
   } catch (error) { notify(error.message); } finally { download.disabled = false; }
  };
  card.append(download);
  if (!submission) {
   const label = element('label',t('file')); const input = element('input'); input.type = 'file'; input.accept = '.doc,.docx,.xls,.xlsx,.ppt,.pptx'; input.id = `file-${assignment._id}`; label.htmlFor = input.id;
   const upload = element('button',t('upload')); upload.type = 'button';
   upload.onclick = async () => {
    if (!input.files[0] || input.files[0].size > 15 * 1024 * 1024) return notify(t('file'));
    upload.disabled = true; notify('');
    const stopLoading = globalThis.QuizLoader?.show($('student-assignments-loader'), t('uploading')) || (() => {});
    try { const data = new FormData(); data.append('file',input.files[0]); await api(`/assignments/${assignment._id}/submit`,{method:'POST',body:data}); await loadReport(); }
    catch (error) { notify(error.message); upload.disabled = false; }
    finally { stopLoading(); }
   };
   card.append(label,input,upload);
  }
  $('assignments-list').append(card);
 }
}
$('refresh-btn').onclick = loadReport;
$('prev-page').onclick = () => { page--; loadReport(); };
$('next-page').onclick = () => { page++; loadReport(); };
$('back-btn').onclick = loadReport;
$('start-btn').onclick = async () => {
 $('start-btn').disabled = true; notify('');
 const stopLoading = globalThis.QuizLoader?.show($('quiz-start-loader'), t('loadingQuiz')) || (() => {});
 try {
  attempt = await post('/quiz/start'); clockOffset = new Date(attempt.serverNow).getTime() - Date.now();
  timerDurationMs = countdownDuration(attempt);
  answers = new Map(attempt.answers.map(a => [a.questionId,a.selected])); confirmedAnswers = new Map(answers);
  inFlightAnswers = null; saveFailed = false; restoreDraft();
  queue = attempt.questions.map(q => q._id).filter(id => !answers.has(id));
  try { const saved = JSON.parse(sessionStorage.getItem(`queue-${attempt.attemptId}`)); if (Array.isArray(saved)) queue = [...new Set([...saved.filter(id => queue.includes(id)),...queue])]; } catch { /* Ignore invalid local queue. */ }
  restoreNavigation();
  tabSwitchCount = attempt.tabSwitchCount; fullscreenExitCount = attempt.fullscreenExitCount;
  active = true; conflict = false; selected = null; screen('quiz-container'); notify(''); await enterFullscreen();
  if (!attempt.questions.length) return submit();
  renderQuestion(); updateSaveStatus(); clearInterval(timer); timer = setInterval(tick,1000); tick();
  if (pendingCount()) drainSaves().catch(error => notify(error.message));
 } catch (error) { if (error.result) displayResult(error.result); else notify(error.message); }
 finally { stopLoading(); if (report && !active) $('start-btn').disabled = report.today?.status === 'submitted'; }
};
function rememberQueue() { try { sessionStorage.setItem(`queue-${attempt.attemptId}`,JSON.stringify(queue)); } catch { /* The current queue remains available in memory. */ } }
function currentQuestion() {
 return attempt?.questions.find(q => q._id === (reviewQuestionId || queue[0])) || attempt?.questions.at(-1);
}
function rememberNavigation() {
 try { sessionStorage.setItem(`navigation-${attempt.attemptId}`, JSON.stringify({ current: currentQuestion()?._id, skipped: [...skippedQuestions] })); } catch { /* Navigation remains available in memory. */ }
}
function restoreNavigation() {
 reviewQuestionId = null; skippedQuestions = new Set();
 try {
  const saved = JSON.parse(sessionStorage.getItem(`navigation-${attempt.attemptId}`));
  if (!saved) return;
  const valid = id => attempt.questions.some(q => q._id === id);
  if (Array.isArray(saved.skipped)) skippedQuestions = new Set(saved.skipped.filter(id => valid(id) && !answers.has(id)));
  if (valid(saved.current)) {
   if (answers.has(saved.current)) reviewQuestionId = saved.current;
   else queue = [saved.current, ...queue.filter(id => id !== saved.current)];
  }
 } catch { /* Ignore malformed local navigation metadata. */ }
}
const answerList = map => [...map].map(([questionId, selected]) => ({ questionId, selected }));
const sameAnswers = (a, b) => a.size === b.size && [...a].every(([id, value]) => b.get(id) === value);
const pendingCount = () => [...answers].filter(([id, value]) => confirmedAnswers.get(id) !== value).length;
function rememberDraft() {
 try { sessionStorage.setItem(`draft-${attempt.attemptId}`, JSON.stringify({ revision: attempt.revision,
  confirmed: answerList(confirmedAnswers), answers: answerList(answers), inFlight: inFlightAnswers && answerList(inFlightAnswers) })); } catch { /* The in-memory save queue still works when storage is unavailable. */ }
}
function restoreDraft() {
 try {
  const draft = JSON.parse(sessionStorage.getItem(`draft-${attempt.attemptId}`)); if (!draft) return;
  const valid = rows => Array.isArray(rows) && rows.every(a => attempt.questions.some(q => q._id === a.questionId && q.options.some(o => o.id === a.selected))) && new Set(rows.map(a => a.questionId)).size === rows.length;
  if (!valid(draft.answers) || !valid(draft.confirmed)) return;
  const baselineMatches = draft.revision === attempt.revision && sameAnswers(new Map(draft.confirmed.map(a => [a.questionId, a.selected])), confirmedAnswers);
  const lostAcknowledgement = draft.revision + 1 === attempt.revision && valid(draft.inFlight) && sameAnswers(new Map(draft.inFlight.map(a => [a.questionId, a.selected])), confirmedAnswers);
  if (baselineMatches || lostAcknowledgement) answers = new Map(draft.answers.map(a => [a.questionId, a.selected]));
  else sessionStorage.removeItem(`draft-${attempt.attemptId}`); // Another tab changed the server copy; it remains authoritative.
 } catch { /* Ignore malformed local drafts. */ }
}
function updateSaveStatus() {
 const pending = pendingCount();
 $('save-status').textContent = conflict ? t('reload') : saveFailed && pending ? t('saveError') : '';
 $('save-status').classList.toggle('hidden', !$('save-status').textContent);
 $('retry-save-btn').classList.toggle('hidden', !saveFailed || !pending || conflict);
 $('retry-save-btn').disabled = submitting || !!savePromise;
 $('save-indicator').textContent = conflict || (saveFailed && pending) ? '' : pending || savePromise ? t('savingAnswers') : `✓ ${t('allSaved')}`;
}
function questionContent(question) {
 const urdu = question.urdu;
 const translated = language === 'ur' && typeof urdu?.text === 'string' && urdu.text.trim() &&
  Array.isArray(urdu.options) && urdu.options.length === question.options.length &&
  urdu.options.every((o,index) => o.id === question.options[index].id && typeof o.text === 'string' && o.text.trim());
 return translated ? { text: urdu.text, options: urdu.options, lang: 'ur' } :
  { text: question.text || question.questionText, options: question.options, lang: 'en' };
}
function renderQuestion() {
 const question = currentQuestion();
 if (!question) {
  $('question-title').textContent = ''; $('translation-notice').classList.add('hidden');
  $('question-media').hidden = true;
  $('progress-text').textContent = `${answers.size} / ${attempt.questions.length} ${t('answered')} · 0 ${t('remaining')}`;
  $('progress-fill').style.width = `${answers.size / attempt.questions.length * 100}%`;
  $('options-container').replaceChildren(); $('next-btn').disabled = true; $('skip-btn').disabled = true; $('finish-btn').disabled = conflict || submitting; return;
 }
 const content = questionContent(question);
 const grade = report?.student.grade ?? question.grade;
 $('quiz-grade-heading').textContent = `${t('grade')}: ${grade === undefined ? '—' : Number(grade) === 0 ? (language === 'ur' ? 'حفظ' : 'Hifz') : grade} · ${t('computer')}`;
 $('quiz-question-number').textContent = `${t('question')} ${attempt.questions.indexOf(question) + 1} / ${attempt.questions.length}`;
 $('quiz-question-grade').textContent = grade === undefined ? '' : gradeLabel(grade);
 $('question-title').textContent = content.text;
 $('question-title').setAttribute('lang',content.lang);
 $('question-title').setAttribute('dir',content.lang === 'ur' ? 'rtl' : 'ltr');
 $('translation-notice').textContent = language === 'ur' && content.lang !== 'ur' ? t('translationMissing') : '';
 $('translation-notice').classList.toggle('hidden',language !== 'ur' || content.lang === 'ur');
 $('progress-text').textContent = `${answers.size} / ${attempt.questions.length} ${t('answered')}`;
 $('progress-fill').style.width = `${answers.size / attempt.questions.length * 100}%`; $('options-container').replaceChildren();
 $('quiz-progress-percent').textContent = `${Math.round(answers.size / attempt.questions.length * 100)}%`;
 renderQuestionImage(question);
 const choice = selected || answers.get(question._id);
 content.options.forEach(option => {
  const button = element('button',undefined,'option-btn'); button.type = 'button'; button.classList.toggle('selected',choice === option.id); button.setAttribute('aria-pressed',String(choice === option.id)); button.disabled = conflict || submitting || saveFailed;
  const letter = element('span', option.id, 'quiz-option-letter'), copy = element('span', option.text, 'quiz-option-copy'), check = element('span', '✓', 'quiz-option-check');
  check.setAttribute('aria-hidden','true'); button.append(letter, copy, check);
  button.setAttribute('lang',content.lang); button.setAttribute('dir',content.lang === 'ur' ? 'rtl' : 'ltr');
  button.onclick = () => {
   if (!active || conflict || submitting || saveFailed) return;
   selected = option.id; answers.set(question._id, option.id); skippedQuestions.delete(question._id);
   rememberDraft(); rememberNavigation(); renderQuestion(); updateSaveStatus();
   drainSaves().catch(error => notify(error.message));
  }; $('options-container').append(button);
 });
 $('next-btn').disabled = !choice || conflict || submitting || saveFailed; $('skip-btn').disabled = conflict || submitting || saveFailed; $('finish-btn').disabled = conflict || submitting;
 $('next-btn').textContent = t(answers.size === attempt.questions.length && !queue.some(id => id !== question._id && !answers.has(id)) ? 'reviewAnswers' : 'saveNext');
 $('previous-question-btn').disabled = conflict || submitting || saveFailed || attempt.questions.indexOf(question) <= 0;
 renderNavigator(question);
 if (pendingCount() || conflict) updateSaveStatus();
}
function renderNavigator(question) {
 $('quiz-question-grid').replaceChildren();
 attempt.questions.forEach((q, index) => {
  const button = element('button', String(index + 1)); button.type = 'button';
  const current = q._id === question._id, answered = answers.has(q._id), skipped = skippedQuestions.has(q._id) && !answered;
  button.classList.toggle('answered', answered); button.classList.toggle('skipped', skipped); button.classList.toggle('current', current);
  button.setAttribute('aria-label', `${t('question')} ${index + 1}, ${t(current ? 'legendCurrent' : answered ? 'legendAnswered' : skipped ? 'legendSkipped' : 'legendUnanswered')}`);
  if (current) button.setAttribute('aria-current','step');
  button.disabled = conflict || submitting || saveFailed; button.onclick = () => navigateQuestion(q._id);
  $('quiz-question-grid').append(button);
 });
}
function renderQuestionImage(question) {
 const image = $('question-image-preview');
 $('quiz-question-body').classList.toggle('has-image', Boolean(question.imageUrl));
 $('question-media').hidden = !question.imageUrl;
 if (!question.imageUrl) { image.removeAttribute('src'); image.dataset.source = ''; return; }
 if (image.dataset.source === question.imageUrl) return;
 image.dataset.source = question.imageUrl; image.hidden = false;
 $('question-image-error').hidden = true; $('view-question-image').hidden = false;
 image.onload = () => { image.hidden = false; };
 image.onerror = () => { image.hidden = true; $('view-question-image').hidden = true; $('question-image-error').textContent = t('imageError'); $('question-image-error').hidden = false; };
 image.src = question.imageUrl;
}
$('view-question-image').onclick = () => {
 const question = currentQuestion(); if (!question?.imageUrl) return;
 $('question-image-full').src = question.imageUrl; $('question-image-dialog').showModal?.();
};
$('close-question-image').onclick = () => $('question-image-dialog').close?.();
$('question-image-dialog').onclose = () => $('question-image-full').removeAttribute('src');
function navigateQuestion(id) {
 if (!active || conflict || submitting || saveFailed || !attempt.questions.some(q => q._id === id)) return;
 if (id === currentQuestion()?._id) return;
 persistSelection({ advance: false });
 if (!active) return;
 if (answers.has(id)) reviewQuestionId = id;
 else { reviewQuestionId = null; queue = [id, ...queue.filter(q => q !== id)]; }
 selected = null; $('question-image-dialog').close?.(); rememberQueue(); rememberNavigation(); renderQuestion(); updateSaveStatus(); $('question-title').focus();
}
$('previous-question-btn').onclick = () => { const index = attempt.questions.indexOf(currentQuestion()); if (index > 0) navigateQuestion(attempt.questions[index - 1]._id); };
$('skip-btn').onclick = () => {
 if (!active || conflict || submitting || saveFailed) return;
 const question = currentQuestion(); if (!question) return;
 if (selected || answers.has(question._id)) persistSelection();
 else {
  skippedQuestions.add(question._id);
  queue = [...queue.filter(id => id !== question._id), question._id]; reviewQuestionId = null; selected = null;
 }
 if (!queue.length) reviewQuestionId = attempt.questions[(attempt.questions.indexOf(question) + 1) % attempt.questions.length]._id;
 rememberQueue(); rememberNavigation(); renderQuestion(); updateSaveStatus(); $('question-title').focus();
};
function persistSelection({ advance = true } = {}) {
 const question = currentQuestion(), choice = selected || (question && answers.get(question._id));
 if (!question || !choice || conflict || submitting) return;
 answers.set(question._id, choice); skippedQuestions.delete(question._id);
 queue = queue.filter(id => id !== question._id); selected = null;
 reviewQuestionId = advance ? null : question._id;
 rememberDraft(); rememberQueue(); rememberNavigation(); renderQuestion(); updateSaveStatus();
 drainSaves().catch(error => notify(error.message));
}
function drainSaves() {
 if (savePromise) return savePromise;
 if (!active || !pendingCount() || conflict) return Promise.resolve();
 const operation = (async () => {
  while (active && pendingCount() && !conflict) {
   const snapshot = new Map(answers), revision = attempt.revision;
   inFlightAnswers = snapshot; saveFailed = false; rememberDraft(); updateSaveStatus();
   try {
    let data;
    try { data = await post('/quiz/save', { attemptId: attempt.attemptId, revision, answers: answerList(snapshot), tabSwitchCount, fullscreenExitCount }, saveTimeout()); }
    catch (error) {
     if (error.result || (error.status && error.status < 500)) throw error;
     // A response can be lost after the server saves. Recover its revision
     // before retrying, without overwriting answers changed in another tab.
     const resumed = await post('/quiz/start', {}, saveTimeout());
     if (resumed.attemptId !== attempt.attemptId) throw Object.assign(new Error(t('reload')), { status: 409 });
     const serverAnswers = new Map(resumed.answers.map(a => [a.questionId, a.selected]));
     if (resumed.revision === revision + 1 && sameAnswers(serverAnswers, snapshot)) data = { revision: resumed.revision };
     else if (resumed.revision !== revision || !sameAnswers(serverAnswers, confirmedAnswers)) throw Object.assign(new Error(t('reload')), { status: 409 });
     else throw error;
    }
    attempt.revision = data.revision; confirmedAnswers = snapshot; inFlightAnswers = null; rememberDraft();
   } catch (error) {
    if (error.result) {
     const unmarkedPending = [...answers].some(([id, value]) => confirmedAnswers.get(id) !== value &&
      error.result.details?.[attempt.questions.findIndex(q => q._id === id)]?.selected !== value);
     displayResult(error.result); if (unmarkedPending) notify(t('unsavedEnded')); return;
    }
    if (error.status === 409) conflict = true; else saveFailed = true;
    updateSaveStatus(); throw error;
   }
  }
 })();
 savePromise = operation;
 operation.finally(() => { if (savePromise === operation) savePromise = null; updateSaveStatus(); if (active) renderQuestion(); }).catch(() => {});
 return operation;
}
$('next-btn').onclick = async () => {
 persistSelection();
 if (!active) return;
 if (!queue.length) { notify(t('reviewAnswers')); $('quiz-question-grid').focus(); }
 else $('question-title').focus();
};
$('retry-save-btn').onclick = async () => {
 try { if (new Date(attempt.expiresAt).getTime() <= Date.now() + clockOffset) await submit(); else { await drainSaves(); notify(''); } }
 catch (error) { notify(error.message); }
};
window.addEventListener('online', () => { if (active && pendingCount() && !conflict && !submitting) drainSaves().catch(error => notify(error.message)); });
window.addEventListener('beforeunload', event => { if (active && pendingCount()) { event.preventDefault(); event.returnValue = ''; } });
function countdownDuration(value) {
 const deadline = new Date(value.expiresAt).getTime(), start = new Date(value.startedAt).getTime();
 if (Number.isFinite(start) && deadline > start) return deadline - start;
 // Older backends omit startedAt. Preserve the first observed duration across reloads.
 const key = `timer-${value.attemptId}`;
 try {
  const saved = JSON.parse(sessionStorage.getItem(key));
  if (saved?.expiresAt === value.expiresAt && Number.isFinite(saved.duration) && saved.duration > 0) return saved.duration;
 } catch { /* Ignore invalid local display metadata. The server deadline still controls expiry. */ }
 const duration = Math.max(1, deadline - new Date(value.serverNow).getTime());
 try { sessionStorage.setItem(key,JSON.stringify({expiresAt:value.expiresAt,duration})); } catch { /* Storage is optional. */ }
 return duration;
}
function tick() {
 if (!active) return;
 const remainingMs = Math.max(0,new Date(attempt.expiresAt).getTime() - Date.now() - clockOffset);
 const seconds = Math.ceil(remainingMs / 1000);
 $('time-left').textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
 $('timer-display').classList.toggle('time-warning',seconds <= 60); if (!seconds) { notify(t('timeUp')); submit(); }
}
$('finish-btn').onclick = async () => { if (!confirm(t('confirm'))) return; persistSelection(); if (active) await submit(); };
async function submit() {
 if (submitting || conflict) return; submitting = true; clearInterval(timer); renderQuestion(); updateSaveStatus();
 try {
  if (savePromise) await savePromise;
  if (active && pendingCount()) await drainSaves();
  if (!active) { submitting = false; return; }
  if (pendingCount()) throw new Error(t('saveError'));
 } catch (error) {
  submitting = false; updateSaveStatus();
  if (active) { renderQuestion(); if (new Date(attempt.expiresAt).getTime() > Date.now() + clockOffset) timer = setInterval(tick,1000); }
  notify(error.message); return;
 }
 active = false; exitFullscreen(); screen('result-container'); $('score-display').textContent = ''; $('retry-btn').classList.add('hidden'); $('back-btn').disabled = true;
 const stopLoading = globalThis.QuizLoader?.show($('quiz-submit-loader'), t('submittingQuiz')) || (() => {});
 $('ranking-display').textContent = ''; $('answer-review').replaceChildren();
 try { displayResult(await post('/quiz/submit',{attemptId:attempt.attemptId,tabSwitchCount,fullscreenExitCount})); }
 catch (error) { $('score-display').textContent = t('submitError'); notify(error.message); $('retry-btn').classList.remove('hidden'); }
 finally { stopLoading(); submitting = false; }
}
function displayResult(result) {
 lastResult = result;
 active = false; clearInterval(timer); exitFullscreen(); screen('result-container'); notify('');
 $('score-display').textContent = `${result.score} / ${result.total} (${result.total ? Math.round(result.score / result.total * 100) : 0}%)`;
 $('ranking-display').textContent = `${t('timeTaken')}: ${ReportUtils.duration(result.elapsedMs)}`;
 $('answer-review').replaceChildren();
 for (const [index, answer] of (result.details || []).entries()) {
  const card = element('article',undefined,'result-item');
  const content = questionContent(answer);
  const selectedText = content.options.find(option => option.id === answer.selected)?.text || answer.selected || t('unanswered');
  card.append(element('h3',`${index + 1}. ${content.text}`),element('p',`${t('review')}: ${selectedText}`));
  $('answer-review').append(card);
 }
 $('retry-btn').classList.add('hidden'); $('back-btn').disabled = false;
 if (attempt) sessionStorage.removeItem(`queue-${attempt.attemptId}`);
 if (attempt) sessionStorage.removeItem(`draft-${attempt.attemptId}`);
 if (attempt) sessionStorage.removeItem(`navigation-${attempt.attemptId}`);
}
$('retry-btn').onclick = () => submit();
async function enterFullscreen() { try { await document.documentElement.requestFullscreen?.(); } catch { /* Unsupported browsers may continue. */ } }
function exitFullscreen() { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
function flag() { $('violation-banner').textContent = t('flags'); $('violation-banner').classList.remove('hidden'); }
$('violation-banner').onclick = enterFullscreen;
document.addEventListener('visibilitychange',() => { if (active && document.hidden) { tabSwitchCount++; flag(); } });
document.addEventListener('fullscreenchange',() => { if (active && !document.fullscreenElement) { fullscreenExitCount++; flag(); } });
applyLanguage(); applyTheme(); screen('login-container'); if (token) loadReport();
if ('serviceWorker' in navigator) window.addEventListener('load',() => navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {}));
