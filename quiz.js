// DOM Elements
const loginContainer = document.getElementById('login-container');
const quizContainer = document.getElementById('quiz-container');
const resultContainer = document.getElementById('result-container');
const loginForm = document.getElementById('login-form');
const questionTitle = document.getElementById('question-title');
const optionsContainer = document.getElementById('options-container');
const nextBtn = document.getElementById('next-btn');
const scoreDisplay = document.getElementById('score-display');
const greetingMessage = document.getElementById('greeting-message');
const timerDisplay = document.getElementById('time-left');


//backend link
const BACKEND_URL = 'https://quiz-system-hpy5.onrender.com';

// Timer Variables
let quizTimer;
let timeRemainingInSeconds;

// Quiz State Variables
let allQuestions = []; // Sawal ab yahan save honge
let currentQuestionIndex = 0;
let score = 0;
let studentName = '';
let studentRollNum = '';
let studentAnswers = []; 

// Login Form Submit
loginForm.addEventListener('submit', function(event) {
    event.preventDefault();
    studentName = document.getElementById('student-name').value;
    studentRollNum = document.getElementById('student-roll').value;
    
    if (studentName && studentRollNum) {
        currentQuestionIndex = 0;
        score = 0;
        studentAnswers = []; 
        loginContainer.style.display = 'none';
        resultContainer.style.display = 'none'; 
        quizContainer.style.display = 'block';
        
        loadQuiz(); // Quiz load karein (fetch se)
        startTimer(); // Timer start karein (fetch se)
    }
});

// Next Button Click
nextBtn.addEventListener('click', function() {
    currentQuestionIndex++;
    if (currentQuestionIndex < allQuestions.length) {
        displayQuestion();
    } else {
        showResults(false); // 'false' = manually finished
    }
});

// --- NAYI LOGIC (Fetch se) ---
async function startTimer() {
    // Admin settings server se load karein
    const response = await fetch(`${BACKEND_URL}/api/settings`);
    const settings = await response.json();
    
    // Agar settings set nahi hain, 10 min default rakhein
    timeRemainingInSeconds = (settings ? settings.time : 10) * 60; 

    quizTimer = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if (timeRemainingInSeconds <= 0) {
        timerDisplay.innerText = "00:00";
        showResults(true); // 'true' = time up
    } else {
        timeRemainingInSeconds--;
        const minutes = Math.floor(timeRemainingInSeconds / 60);
        const seconds = timeRemainingInSeconds % 60;
        const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        timerDisplay.innerText = formattedTime;
    }
}

// --- NAYI LOGIC (Fetch se) ---
async function loadQuiz() {
    // Sawal server se mangwayein
    const response = await fetch(`${BACKEND_URL}/api/questions`);
    allQuestions = await response.json();
    
    if (allQuestions.length === 0) {
        quizContainer.innerHTML = '<h1>No questions found in database.</h1>';
        return;
    }
    const resultsListDiv = document.getElementById('detailed-results-list');
    resultsListDiv.innerHTML = '';
    displayQuestion();
}

function displayQuestion() {
    optionsContainer.innerHTML = '';
    let q = allQuestions[currentQuestionIndex];
    questionTitle.innerText = `Question ${currentQuestionIndex + 1}: ${q.text}`;

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
    const correctAnswer = allQuestions[currentQuestionIndex].correct;

    studentAnswers.push({
        questionText: allQuestions[currentQuestionIndex].text,
        selected: selectedAnswer,
        correct: correctAnswer,
        options: allQuestions[currentQuestionIndex].options
    });

    Array.from(optionsContainer.children).forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.id === correctAnswer) {
            btn.classList.add('correct');
        }
    });

    if (selectedAnswer === correctAnswer) {
        score++;
    } else {
        selectedButton.classList.add('wrong');
    }
    nextBtn.style.display = 'block'; 
}

// Show Results (Ismein saveResult ko 'async' kiya gaya hai)
async function showResults(isTimeUp) { 
    clearInterval(quizTimer);
    if (isTimeUp) {
        alert("Time's up! Your quiz has been automatically submitted.");
    }
    quizContainer.style.display = 'none';
    resultContainer.style.display = 'block';
    
    // Greeting Logic
    let percentage = 0;
    if (allQuestions.length > 0) {
        percentage = (score / allQuestions.length) * 100;
    }
    if (percentage === 100) {
        greetingMessage.innerText = `Excellent, ${studentName}!`;
    } else if (percentage >= 60) {
        greetingMessage.innerText = `Good Job, ${studentName}!`;
    } else {
        greetingMessage.innerText = `Don't give up, ${studentName}!`;
    }
    scoreDisplay.innerText = `Your final score: ${score} / ${allQuestions.length}`;
    
    // Detailed results
    const resultsListDiv = document.getElementById('detailed-results-list');
    resultsListDiv.innerHTML = ''; 
    studentAnswers.forEach((answer, index) => {
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
    
    // Save the score
    await saveResult(); // 'await' zaroori hai
}

// --- NAYI LOGIC (Fetch se) ---
async function saveResult() {
    const resultData = {
        name: studentName,
        rollNum: studentRollNum,
        score: score,
        total: allQuestions.length
    };

    // Result ko server (database) mein save karein
    await fetch(`${BACKEND_URL}/api/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultData)
    });
}