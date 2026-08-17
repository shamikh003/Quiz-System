// Backend URL
const BACKEND_URL = 'https://quiz-system-hpy5.onrender.com';

// ---------- Language toggle (English / Urdu) ----------
const translations = {
    en: {
        welcome: 'Welcome to the Quiz',
        labelName: 'Enter Your Name:',
        labelRoll: 'Enter Your Roll Number:',
        labelGrade: 'Select Your Grade:',
        chooseGrade: 'Choose grade',
        grade4: 'Grade 4', grade5: 'Grade 5', grade6: 'Grade 6', grade7: 'Grade 7',
        fullscreenNotice: "This quiz runs in full-screen mode. Please don't switch tabs or exit full-screen once it starts.",
        startQuiz: 'Start Quiz',
        loadingTitle: 'Loading Quiz...',
        loadingText: 'Please wait, Quiz is starting',
        nextQuestion: 'Next Question',
        finishQuiz: 'Finish Quiz',
        detailedResults: 'Your Detailed Results',
        retakeQuiz: 'Take Quiz Again',
        progressText: (cur, total) => `Question ${cur} of ${total}`,
        noQuestions: (grade) => `No quiz available for Grade ${grade} yet.`,
        noQuestionsSub: 'Please check with your teacher.',
        connError: 'Error connecting to server.',
        connErrorSub: 'Please try refreshing the page in a minute.',
        timeUpAlert: "Time's up! Your quiz has been automatically submitted.",
        submitFailTitle: 'Could not submit your quiz.',
        submitFailSub: 'Please check your connection and contact your teacher.',
        greetExcellent: (name) => `Excellent, ${name}!`,
        greetGood: (name) => `Good Job, ${name}!`,
        greetTryAgain: (name) => `Don't give up, ${name}!`,
        finalScore: (score, total) => `Your final score: ${score} / ${total}`,
        questionLabel: (n) => `Question ${n}:`,
        youAnswered: 'You answered:',
        noAnswer: 'No Answer',
        correctAnswerLabel: 'Correct Answer:',
        tabSwitchWarning: (count) => `⚠ Warning: You switched away from the quiz tab (${count} time${count > 1 ? 's' : ''}). This has been recorded.`,
        fullscreenExitWarning: (count) => `⚠ Warning: You exited full-screen mode (${count} time${count > 1 ? 's' : ''}). Please return to full-screen. This has been recorded.`,
        reenterFullscreen: 'Return to Full-Screen'
    },
    ur: {
        welcome: 'کوئز میں خوش آمدید',
        labelName: 'اپنا نام درج کریں:',
        labelRoll: 'اپنا رول نمبر درج کریں:',
        labelGrade: 'اپنا گریڈ منتخب کریں:',
        chooseGrade: 'گریڈ منتخب کریں',
        grade4: 'گریڈ 4', grade5: 'گریڈ 5', grade6: 'گریڈ 6', grade7: 'گریڈ 7',
        fullscreenNotice: 'یہ کوئز فل اسکرین موڈ میں چلتا ہے۔ شروع ہونے کے بعد براہ کرم ٹیب تبدیل نہ کریں یا فل اسکرین سے باہر نہ نکلیں۔',
        startQuiz: 'کوئز شروع کریں',
        loadingTitle: 'کوئز لوڈ ہو رہا ہے...',
        loadingText: 'براہ کرم انتظار کریں، کوئز شروع ہو رہا ہے',
        nextQuestion: 'اگلا سوال',
        finishQuiz: 'کوئز مکمل کریں',
        detailedResults: 'آپ کے تفصیلی نتائج',
        retakeQuiz: 'دوبارہ کوئز دیں',
        progressText: (cur, total) => `سوال ${cur} از ${total}`,
        noQuestions: (grade) => `گریڈ ${grade} کے لیے ابھی کوئی کوئز دستیاب نہیں ہے۔`,
        noQuestionsSub: 'براہ کرم اپنے استاد سے رابطہ کریں۔',
        connError: 'سرور سے رابطہ کرنے میں خرابی۔',
        connErrorSub: 'براہ کرم ایک منٹ بعد صفحہ ریفریش کریں۔',
        timeUpAlert: 'وقت ختم ہو گیا! آپ کا کوئز خود بخود جمع کر دیا گیا ہے۔',
        submitFailTitle: 'آپ کا کوئز جمع نہیں ہو سکا۔',
        submitFailSub: 'براہ کرم اپنا کنکشن چیک کریں اور اپنے استاد سے رابطہ کریں۔',
        greetExcellent: (name) => `بہت خوب، ${name}!`,
        greetGood: (name) => `اچھا کام، ${name}!`,
        greetTryAgain: (name) => `ہمت نہ ہاریں، ${name}!`,
        finalScore: (score, total) => `آپ کا حتمی اسکور: ${score} / ${total}`,
        questionLabel: (n) => `سوال ${n}:`,
        youAnswered: 'آپ کا جواب:',
        noAnswer: 'کوئی جواب نہیں',
        correctAnswerLabel: 'درست جواب:',
        tabSwitchWarning: (count) => `⚠ انتباہ: آپ نے کوئز ٹیب سے دوسری جگہ رخ کیا (${count} بار)۔ یہ ریکارڈ کر لیا گیا ہے۔`,
        fullscreenExitWarning: (count) => `⚠ انتباہ: آپ فل اسکرین موڈ سے باہر نکلے (${count} بار)۔ براہ کرم فل اسکرین پر واپس جائیں۔ یہ ریکارڈ کر لیا گیا ہے۔`,
        reenterFullscreen: 'فل اسکرین پر واپس جائیں'
    }
};

let currentLang = localStorage.getItem('quizLang') || 'en';

function t(key, ...args) {
    const entry = translations[currentLang][key];
    return typeof entry === 'function' ? entry(...args) : entry;
}

function applyLanguage() {
    document.documentElement.setAttribute('lang', currentLang === 'ur' ? 'ur' : 'en');
    document.documentElement.setAttribute('dir', currentLang === 'ur' ? 'rtl' : 'ltr');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const value = translations[currentLang][key];
        if (typeof value === 'string') el.textContent = value;
    });
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) langBtn.textContent = currentLang === 'ur' ? 'English' : 'اردو';
    // Re-render dynamic bits that depend on language, if the quiz is already running.
    if (typeof updateProgress === 'function' && document.getElementById('quiz-container').style.display === 'block') {
        updateProgress();
    }
}

function toggleLanguage() {
    currentLang = currentLang === 'ur' ? 'en' : 'ur';
    localStorage.setItem('quizLang', currentLang);
    applyLanguage();
}

document.addEventListener('DOMContentLoaded', applyLanguage);
applyLanguage();
document.getElementById('lang-toggle') && document.getElementById('lang-toggle').addEventListener('click', toggleLanguage);

// ---------- Theme toggle ----------
function applyStoredTheme() {
    const theme = localStorage.getItem('quizTheme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    });
}
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('quizTheme', next);
    applyStoredTheme();
}
applyStoredTheme();
document.querySelectorAll('.theme-toggle').forEach(btn => btn.addEventListener('click', toggleTheme));

// DOM Elements
const loginContainer = document.getElementById('login-container');
const quizContainer = document.getElementById('quiz-container');
const resultContainer = document.getElementById('result-container');
const loginForm = document.getElementById('login-form');
const loadingContainer = document.getElementById('loading-container');

const questionTitle = document.getElementById('question-title');
const optionsContainer = document.getElementById('options-container');
const nextBtn = document.getElementById('next-btn');
const scoreDisplay = document.getElementById('score-display');
const greetingMessage = document.getElementById('greeting-message');
const timerDisplay = document.getElementById('time-left');
const timerDisplayWrapper = document.getElementById('timer-display');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');

// Timer Variables
let quizTimer;
let timeRemainingInSeconds;

// Quiz State
let allQuestions = []; // fetched WITHOUT the correct answer
let currentQuestionIndex = 0;
let studentName = '';
let studentRollNum = '';
let studentGrade = '';
let studentAnswers = []; // [{ questionId, selected }]

// Anti-cheating state
let quizInProgress = false;
let tabSwitchCount = 0;
let fullscreenExitCount = 0;
let violationBannerTimeout;

loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    studentName = document.getElementById('student-name').value;
    studentRollNum = document.getElementById('student-roll').value;
    studentGrade = document.getElementById('student-grade').value;

    if (studentName && studentRollNum && studentGrade) {
        currentQuestionIndex = 0;
        studentAnswers = [];
        tabSwitchCount = 0;
        fullscreenExitCount = 0;

        loginContainer.style.display = 'none';
        resultContainer.style.display = 'none';
        loadingContainer.style.display = 'block';
        quizContainer.style.display = 'none';

        try {
            await loadQuiz();
            await startTimer();
            await requestFullscreen();

            loadingContainer.style.display = 'none';
            quizContainer.style.display = 'block';
            quizInProgress = true;
        } catch (error) {
            console.error("Error loading data:", error);
            if (error.message === 'NO_QUESTIONS_FOR_GRADE') {
                loadingContainer.innerHTML = `<h2>${t('noQuestions', studentGrade)}</h2><p>${t('noQuestionsSub')}</p>`;
            } else {
                loadingContainer.innerHTML = `<h2>${t('connError')}</h2><p>${t('connErrorSub')}</p>`;
            }
        }
    }
});

nextBtn.addEventListener('click', function () {
    currentQuestionIndex++;
    if (currentQuestionIndex < allQuestions.length) {
        displayQuestion();
    } else {
        showResults(false);
    }
});

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// ---------- Anti-cheating: full-screen enforcement ----------
async function requestFullscreen() {
    const el = document.documentElement;
    try {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) await el.msRequestFullscreen();
    } catch (err) {
        // Some browsers/devices (e.g. iOS Safari) don't support the Fullscreen API,
        // or the user's browser blocks it. Don't fail the quiz because of that.
        console.warn('Fullscreen request failed or unsupported:', err);
    }
}

function isFullscreenActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}

function showViolationBanner(message) {
    const banner = document.getElementById('violation-banner');
    if (!banner) return;
    banner.textContent = message;
    banner.classList.remove('hidden');
    banner.onclick = () => requestFullscreen();
    clearTimeout(violationBannerTimeout);
    violationBannerTimeout = setTimeout(() => banner.classList.add('hidden'), 6000);
}

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('msfullscreenchange', handleFullscreenChange);

function handleFullscreenChange() {
    if (!quizInProgress) return;
    if (!isFullscreenActive()) {
        fullscreenExitCount++;
        showViolationBanner(t('fullscreenExitWarning', fullscreenExitCount));
    }
}

// ---------- Anti-cheating: tab-switch / window-blur detection ----------
document.addEventListener('visibilitychange', function () {
    if (!quizInProgress) return;
    if (document.visibilityState === 'hidden') {
        tabSwitchCount++;
        showViolationBanner(t('tabSwitchWarning', tabSwitchCount));
    }
});

async function startTimer() {
    const response = await fetch(`${BACKEND_URL}/api/settings`);
    const settings = await response.json();

    timeRemainingInSeconds = (settings && settings.time ? settings.time : 10) * 60;

    if (quizTimer) clearInterval(quizTimer);
    quizTimer = setInterval(updateTimer, 1000);
    updateTimer();
}

function updateTimer() {
    if (timeRemainingInSeconds <= 0) {
        timerDisplay.innerText = "00:00";
        showResults(true);
    } else {
        const minutes = Math.floor(timeRemainingInSeconds / 60);
        const seconds = timeRemainingInSeconds % 60;
        timerDisplay.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        timerDisplayWrapper.classList.toggle('time-warning', timeRemainingInSeconds <= 30);
        timeRemainingInSeconds--;
    }
}

async function loadQuiz() {
    // Note: this endpoint never returns the correct answers to the browser.
    // Only questions matching the student's selected grade are returned.
    const response = await fetch(`${BACKEND_URL}/api/quiz/questions?grade=${studentGrade}`);
    allQuestions = await response.json();

    if (allQuestions.length === 0) {
        throw new Error(`NO_QUESTIONS_FOR_GRADE`);
    }

    shuffleArray(allQuestions);

    const resultsListDiv = document.getElementById('detailed-results-list');
    resultsListDiv.innerHTML = '';

    displayQuestion();
}

function updateProgress() {
    const total = allQuestions.length;
    const current = currentQuestionIndex + 1;
    const percent = Math.round((current / total) * 100);
    progressText.textContent = t('progressText', current, total);
    progressPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
}

function displayQuestion() {
    optionsContainer.innerHTML = '';
    let q = allQuestions[currentQuestionIndex];
    questionTitle.innerText = q.text;
    updateProgress();

    q.options.forEach(option => {
        const button = document.createElement('button');
        button.innerText = `${option.id}: ${option.text}`;
        button.classList.add('option-btn');
        button.dataset.id = option.id;
        button.addEventListener('click', handleAnswerClick);
        optionsContainer.appendChild(button);
    });

    nextBtn.style.display = 'none';
}

function handleAnswerClick(event) {
    const selectedButton = event.target;
    const selectedAnswer = selectedButton.dataset.id;
    const currentQuestion = allQuestions[currentQuestionIndex];

    studentAnswers.push({
        questionId: currentQuestion._id,
        selected: selectedAnswer
    });

    Array.from(optionsContainer.children).forEach(btn => { btn.disabled = true; });
    selectedButton.classList.add('selected');

    nextBtn.style.display = 'block';
    nextBtn.innerText = (currentQuestionIndex === allQuestions.length - 1) ? t('finishQuiz') : t('nextQuestion');
}

// Show Results: submits answers to the server, which computes the score
// and returns the detailed correct/wrong breakdown.
async function showResults(isTimeUp) {
    clearInterval(quizTimer);
    quizInProgress = false; // stop counting tab-switches/fullscreen exits once the quiz is done
    exitFullscreenIfActive();

    if (isTimeUp) {
        alert(t('timeUpAlert'));
    }
    quizContainer.style.display = 'none';
    resultContainer.style.display = 'block';

    let submission;
    try {
        submission = await submitQuiz();
    } catch (error) {
        console.error('Error submitting quiz:', error);
        greetingMessage.innerText = t('submitFailTitle');
        scoreDisplay.innerText = t('submitFailSub');
        return;
    }

    const { score, total, details } = submission;
    let percentage = total > 0 ? (score / total) * 100 : 0;

    if (percentage === 100) {
        greetingMessage.innerText = t('greetExcellent', studentName);
    } else if (percentage >= 60) {
        greetingMessage.innerText = t('greetGood', studentName);
    } else {
        greetingMessage.innerText = t('greetTryAgain', studentName);
    }
    scoreDisplay.innerText = t('finalScore', score, total);

    const resultsListDiv = document.getElementById('detailed-results-list');
    resultsListDiv.innerHTML = '';
    details.forEach((answer, index) => {
        const resultItem = document.createElement('div');
        resultItem.classList.add('result-item');
        const isCorrect = (answer.selected === answer.correct);
        const correctOption = answer.options.find(opt => opt.id === answer.correct);
        const correctText = correctOption ? correctOption.text : 'N/A';
        const studentOption = answer.options.find(opt => opt.id === answer.selected);
        const studentText = studentOption ? studentOption.text : t('noAnswer');

        let innerHTML = `<p><strong>${t('questionLabel', index + 1)}</strong> ${answer.questionText}</p>`;
        if (isCorrect) {
            innerHTML += `<p class="correct-answer">✔ ${t('youAnswered')} ${studentText}</p>`;
        } else {
            innerHTML += `<p class="wrong-answer">✖ ${t('youAnswered')} ${studentText}</p>`;
            innerHTML += `<p class="correct-answer"><strong>${t('correctAnswerLabel')}</strong> ${correctText}</p>`;
        }

        resultItem.innerHTML = innerHTML;
        resultsListDiv.appendChild(resultItem);
    });
}

function exitFullscreenIfActive() {
    if (!isFullscreenActive()) return;
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
}

async function submitQuiz() {
    const resultData = {
        name: studentName,
        rollNum: studentRollNum,
        grade: studentGrade,
        answers: studentAnswers,
        tabSwitchCount,
        fullscreenExitCount
    };
    const response = await fetch(`${BACKEND_URL}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultData)
    });
    if (!response.ok) throw new Error('Submit failed');
    return response.json();
}

// ---------- PWA: register service worker (offline app-shell caching) ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.warn('Service worker registration failed:', err);
        });
    });
}
