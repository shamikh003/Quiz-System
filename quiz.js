// DOM Elements
const loginContainer = document.getElementById('login-container');
const quizContainer = document.getElementById('quiz-container');
const resultContainer = document.getElementById('result-container');
const loginForm = document.getElementById('login-form');
const loadingContainer = document.getElementById('loading-container'); // NAYA

const questionTitle = document.getElementById('question-title');
const optionsContainer = document.getElementById('options-container');
const nextBtn = document.getElementById('next-btn');
const scoreDisplay = document.getElementById('score-display');
const greetingMessage = document.getElementById('greeting-message');
const timerDisplay = document.getElementById('time-left');

// Backend URL
const BACKEND_URL = 'https://quiz-system-hpy5.onrender.com';

// Timer Variables
let quizTimer;
let timeRemainingInSeconds;

// Quiz State Variables
let allQuestions = []; 
let currentQuestionIndex = 0;
let score = 0;
let studentName = '';
let studentRollNum = '';
let studentAnswers = []; 

// NAYA: Login Form ka poora logic
loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    studentName = document.getElementById('student-name').value;
    studentRollNum = document.getElementById('student-roll').value;
    
    if (studentName && studentRollNum) {
        // Reset state
        currentQuestionIndex = 0;
        score = 0;
        studentAnswers = []; 

        // 1. Loading... dikhayein
        loginContainer.style.display = 'none';
        resultContainer.style.display = 'none'; 
        loadingContainer.style.display = 'block'; // Naya step
        quizContainer.style.display = 'none'; 

        try {
            // 2. Dono cheezein (sawal aur time) server se mangwayein
            await loadQuiz(); 
            await startTimer(); 

            // 3. Jab data aa jaye, tab quiz dikhayein
            loadingContainer.style.display = 'none';
            quizContainer.style.display = 'block';
        } catch (error) {
            // Agar server (Render) so (sleep) raha ho aur error aaye
            console.error("Error loading data:", error);
            loadingContainer.innerHTML = "<h2>Error connecting to server.</h2><p>Please try refreshing the page in a minute.</p>";
        }
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

// NAYA: Shuffle Function
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Function: Start Timer (Ab 'async' hai)
async function startTimer() {
    const response = await fetch(`${BACKEND_URL}/api/settings`);
    const settings = await response.json();
    
    timeRemainingInSeconds = (settings ? settings.time : 10) * 60; 

    if (quizTimer) {
        clearInterval(quizTimer);
    }
    quizTimer = setInterval(updateTimer, 1000);
}

// Function: Update Timer
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

// Function: Load Quiz (Ab 'async' hai aur SHUFFLE karta hai)
async function loadQuiz() {
    const response = await fetch(`${BACKEND_URL}/api/questions`);
    allQuestions = await response.json();
    
    if (allQuestions.length === 0) {
        quizContainer.innerHTML = '<h1>No questions found in database.</h1>';
        return;
    }

    // NAYA: Sawalon ko shuffle karein
    shuffleArray(allQuestions);

    const resultsListDiv = document.getElementById('detailed-results-list');
    resultsListDiv.innerHTML = '';
    
    displayQuestion();
}

// Function: Display Question
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

// NAYA: Handle Answer Click (BINA FEEDBACK KE)
function handleAnswerClick(event) {
    const selectedButton = event.target;
    const selectedAnswer = selectedButton.dataset.id;
    const correctAnswer = allQuestions[currentQuestionIndex].correct;

    // Student ka answer save karein
    studentAnswers.push({
        questionText: allQuestions[currentQuestionIndex].text,
        selected: selectedAnswer,
        correct: correctAnswer,
        options: allQuestions[currentQuestionIndex].options
    });

    // Score ko background mein check karein
    if (selectedAnswer === correctAnswer) {
        score++;
    }

    // Tamam buttons ko disable karein
    Array.from(optionsContainer.children).forEach(btn => {
        btn.disabled = true;
    });

    // Sirf selected button ko style karein (feedback ke baghair)
    selectedButton.classList.add('selected');

    // Next button dikhayein
    nextBtn.style.display = 'block'; 
}

// Function: Show Results
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
    
    // Detailed results (yahan red/green dikhana zaroori hai)
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
    
    await saveResult(); 
}

// Function: Save Result
async function saveResult() {
    const resultData = {
        name: studentName,
        rollNum: studentRollNum,
        score: score,
        total: allQuestions.length
    };
    await fetch(`${BACKEND_URL}/api/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultData)
    });
}