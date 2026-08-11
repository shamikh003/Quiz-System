// Backend URL
const BACKEND_URL = 'https://quiz-system-hpy5.onrender.com';

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

loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    studentName = document.getElementById('student-name').value;
    studentRollNum = document.getElementById('student-roll').value;
    studentGrade = document.getElementById('student-grade').value;

    if (studentName && studentRollNum && studentGrade) {
        currentQuestionIndex = 0;
        studentAnswers = [];

        loginContainer.style.display = 'none';
        resultContainer.style.display = 'none';
        loadingContainer.style.display = 'block';
        quizContainer.style.display = 'none';

        try {
            await loadQuiz();
            await startTimer();

            loadingContainer.style.display = 'none';
            quizContainer.style.display = 'block';
        } catch (error) {
            console.error("Error loading data:", error);
            if (error.message === 'NO_QUESTIONS_FOR_GRADE') {
                loadingContainer.innerHTML = `<h2>No quiz available for Grade ${studentGrade} yet.</h2><p>Please check with your teacher.</p>`;
            } else {
                loadingContainer.innerHTML = "<h2>Error connecting to server.</h2><p>Please try refreshing the page in a minute.</p>";
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
    progressText.textContent = `Question ${current} of ${total}`;
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
    nextBtn.innerText = (currentQuestionIndex === allQuestions.length - 1) ? 'Finish Quiz' : 'Next Question';
}

// Show Results: submits answers to the server, which computes the score
// and returns the detailed correct/wrong breakdown.
async function showResults(isTimeUp) {
    clearInterval(quizTimer);
    if (isTimeUp) {
        alert("Time's up! Your quiz has been automatically submitted.");
    }
    quizContainer.style.display = 'none';
    resultContainer.style.display = 'block';

    let submission;
    try {
        submission = await submitQuiz();
    } catch (error) {
        console.error('Error submitting quiz:', error);
        greetingMessage.innerText = 'Could not submit your quiz.';
        scoreDisplay.innerText = 'Please check your connection and contact your teacher.';
        return;
    }

    const { score, total, details } = submission;
    let percentage = total > 0 ? (score / total) * 100 : 0;

    if (percentage === 100) {
        greetingMessage.innerText = `Excellent, ${studentName}!`;
    } else if (percentage >= 60) {
        greetingMessage.innerText = `Good Job, ${studentName}!`;
    } else {
        greetingMessage.innerText = `Don't give up, ${studentName}!`;
    }
    scoreDisplay.innerText = `Your final score: ${score} / ${total}`;

    const resultsListDiv = document.getElementById('detailed-results-list');
    resultsListDiv.innerHTML = '';
    details.forEach((answer, index) => {
        const resultItem = document.createElement('div');
        resultItem.classList.add('result-item');
        const isCorrect = (answer.selected === answer.correct);
        const correctOption = answer.options.find(opt => opt.id === answer.correct);
        const correctText = correctOption ? correctOption.text : 'N/A';
        const studentOption = answer.options.find(opt => opt.id === answer.selected);
        const studentText = studentOption ? studentOption.text : 'No Answer';

        let innerHTML = `<p><strong>Question ${index + 1}:</strong> ${answer.questionText}</p>`;
        if (isCorrect) {
            innerHTML += `<p class="correct-answer">✔ You answered: ${studentText}</p>`;
        } else {
            innerHTML += `<p class="wrong-answer">✖ You answered: ${studentText}</p>`;
            innerHTML += `<p class="correct-answer"><strong>Correct Answer:</strong> ${correctText}</p>`;
        }

        resultItem.innerHTML = innerHTML;
        resultsListDiv.appendChild(resultItem);
    });
}

async function submitQuiz() {
    const resultData = {
        name: studentName,
        rollNum: studentRollNum,
        grade: studentGrade,
        answers: studentAnswers
    };
    const response = await fetch(`${BACKEND_URL}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultData)
    });
    if (!response.ok) throw new Error('Submit failed');
    return response.json();
}
