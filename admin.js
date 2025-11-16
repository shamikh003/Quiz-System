// DOM Elements
const optionCountSelector = document.getElementById('option-count');
const optionDWrapper = document.getElementById('option-d-wrapper');
const optionDInput = document.getElementById('option-d');
const correctOptionD = document.getElementById('correct-option-d');
const questionForm = document.getElementById('question-form');
const clearBtn = document.getElementById('clear-questions-btn');

//backend link
const BACKEND_URL = 'https://quiz-system-hpy5.onrender.com';

// Event listener for the dropdown
optionCountSelector.addEventListener('change', function() {
    const selectedCount = this.value;
    if (selectedCount === '3') {
        optionDWrapper.classList.add('hidden');
        correctOptionD.classList.add('hidden');
        optionDInput.required = false; 
    } else {
        optionDWrapper.classList.remove('hidden');
        correctOptionD.classList.remove('hidden');
        optionDInput.required = true;
    }
});

// Form submit karne ka naya logic
questionForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    // 1. Pehle Settings (Time) ko save karein
    const quizTime = document.getElementById('quiz-time').value;
    const settingsData = { time: quizTime };
    
    await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData)
    });

    // 2. Ab Naya Sawal (Question) save karein
    const optionsArray = [
        { id: 'A', text: document.getElementById('option-a').value },
        { id: 'B', text: document.getElementById('option-b').value },
        { id: 'C', text: document.getElementById('option-c').value }
    ];

    if (optionCountSelector.value === '4') {
        optionsArray.push({ id: 'D', text: optionDInput.value });
    }

    const questionData = {
        text: document.getElementById('question-text').value,
        options: optionsArray,
        correct: document.getElementById('correct-answer').value
    };

    const response = await fetch(`${BACKEND_URL}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionData)
    });

    if (response.ok) {
        alert('Question saved to database successfully!');
        event.target.reset(); // Form reset karein
        // Form reset hone ke baad, 4-options wala view wapas set karein (default)
        optionDWrapper.classList.remove('hidden');
        correctOptionD.classList.remove('hidden');
        optionDInput.required = true;
    } else {
        alert('Error saving question.');
    }
});

// "Clear All Questions" button ka naya logic
clearBtn.addEventListener('click', async function() {
    if (confirm('Are you sure you want to delete ALL questions from the database?')) {
        await fetch(`${BACKEND_URL}/api/questions`, { method: 'DELETE' });
        alert('All questions deleted from database.');
    }
});