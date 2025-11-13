// DOM Elements
const loginContainer = document.getElementById('login-container');
const quizContainer = document.getElementById('quiz-container');
const resultContainer = document.getElementById('result-container');
const loginForm = document.getElementById('login-form');

const questionTitle = document.getElementById('question-title');
const optionsContainer = document.getElementById('options-container');
const nextBtn = document.getElementById('next-btn');
const scoreDisplay = document.getElementById('score-display');
const greetingMessage = document.getElementById('greeting-message'); // Get greeting element

// Quiz State Variables
let allQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let studentName = '';
let studentRollNum = '';
let studentAnswers = []; 

// Event Listener for Login Form
loginForm.addEventListener('submit', function(event) {
    event.preventDefault();
    studentName = document.getElementById('student-name').value;
    studentRollNum = document.getElementById('student-roll').value;
    
    if (studentName && studentRollNum) {
        // Reset quiz state for "Try Again"
        currentQuestionIndex = 0;
        score = 0;
        studentAnswers = []; 

        loginContainer.style.display = 'none';
        resultContainer.style.display = 'none'; 
        quizContainer.style.display = 'block';
        loadQuiz();
    }
});

// Event Listener for Next Button
nextBtn.addEventListener('click', function() {
    currentQuestionIndex++;
    if (currentQuestionIndex < allQuestions.length) {
        displayQuestion();
    } else {
        showResults();
    }
});

// Function: Load Quiz
function loadQuiz() {
    allQuestions = JSON.parse(localStorage.getItem('quizQuestions')) || [];
    if (allQuestions.length === 0) {
        quizContainer.innerHTML = '<h1>No questions found. Please ask the admin to add questions.</h1>';
        return;
    }
    // Clear old results
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

// Function: Handle Answer Click
function handleAnswerClick(event) {
    const selectedButton = event.target;
    const selectedAnswer = selectedButton.dataset.id;
    const correctAnswer = allQuestions[currentQuestionIndex].correct;

    // Store the answer
    studentAnswers.push({
        questionText: allQuestions[currentQuestionIndex].text,
        selected: selectedAnswer,
        correct: correctAnswer,
        options: allQuestions[currentQuestionIndex].options
    });

    // Disable all option buttons
    Array.from(optionsContainer.children).forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.id === correctAnswer) {
            btn.classList.add('correct');
        }
    });

    // If user's answer is wrong, show it in red
    if (selectedAnswer === correctAnswer) {
        score++;
    } else {
        selectedButton.classList.add('wrong');
    }

    nextBtn.style.display = 'block'; // Show next button
}


// Function: Show Results (With Greetings)
function showResults() {
    quizContainer.style.display = 'none';
    resultContainer.style.display = 'block';
    
    // --- GREETING LOGIC ---
    let percentage = 0;
    if (allQuestions.length > 0) {
        percentage = (score / allQuestions.length) * 100;
    }

    if (percentage === 100) {
        greetingMessage.innerText = `Excellent, ${studentName}!`;
        scoreDisplay.innerText = `You got a perfect score: ${score} / ${allQuestions.length}`;
    } else if (percentage >= 60) {
        greetingMessage.innerText = `Good Job, ${studentName}!`;
        scoreDisplay.innerText = `Your final score: ${score} / ${allQuestions.length}`;
    } else if (percentage >= 40) {
        greetingMessage.innerText = `Good effort, ${studentName}.`;
        scoreDisplay.innerText = `Your final score: ${score} / ${allQuestions.length}`;
    } else {
        greetingMessage.innerText = `Don't give up, ${studentName}!`;
        scoreDisplay.innerText = `Your final score: ${score} / ${allQuestions.length}`;
    }
    // --- END OF GREETING LOGIC ---

    
    const resultsListDiv = document.getElementById('detailed-results-list');
    resultsListDiv.innerHTML = ''; // Clear previous results

    // Loop through each answer and display it
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
    saveResult();
}

// Function: Save Result
function saveResult() {
    let results = JSON.parse(localStorage.getItem('quizResults')) || [];
    
    const newResult = {
        name: studentName,
        rollNum: studentRollNum,
        score: score,
        total: allQuestions.length,
        date: new Date().toLocaleString()
    };

    results.push(newResult);
    localStorage.setItem('quizResults', JSON.stringify(results));
}