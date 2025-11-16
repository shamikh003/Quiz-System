// Backend server ka URL
const BACKEND_URL = 'https://quiz-system-hpy5.onrender.com'; 

// DOM Elements
const optionCountSelector = document.getElementById('option-count');
const optionDWrapper = document.getElementById('option-d-wrapper');
const optionDInput = document.getElementById('option-d');
const correctOptionD = document.getElementById('correct-option-d');
const questionForm = document.getElementById('question-form');
const quizTimeInput = document.getElementById('quiz-time'); 

// Buttons ko select karein
const saveBtn = document.getElementById('save-question-btn');
const clearBtn = document.getElementById('clear-questions-btn');

// Page Load par settings load karein
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/settings`);
        if (response.ok) {
            const settings = await response.json();
            if (settings && settings.time) {
                // Input field mein purana time dikhayein
                quizTimeInput.value = settings.time;
            }
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
    }
});

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

// Form submit ka logic (Loading state ke sath)
questionForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    // 1. Loading state shuru karein
    saveBtn.disabled = true;
    saveBtn.innerHTML = 'Saving... <span class="spinner"></span>';

    const quizTime = quizTimeInput.value; // Time save karein

    try {
        // 2. Settings (Time) ko save karein
        const settingsData = { time: quizTime };
        await fetch(`${BACKEND_URL}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsData)
        });

        // 3. Naya Sawal (Question) save karein
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
            quizTimeInput.value = quizTime; // Time wapas set karein
            optionDWrapper.classList.remove('hidden');
            correctOptionD.classList.remove('hidden');
            optionDInput.required = true;
        } else {
            alert('Error saving question.');
        }
    } catch (error) {
        console.error('Error saving data:', error);
        alert('Could not connect to server. Please check your connection.');
    } finally {
        // 4. Loading state khatam karein
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Question';
    }
});

// "Clear All" ka logic (Loading state ke sath)
clearBtn.addEventListener('click', async function() {
    if (confirm('Are you sure you want to delete ALL questions from the database?')) {
        
        clearBtn.disabled = true;
        clearBtn.innerHTML = 'Deleting... <span class="spinner"></span>';

        try {
            await fetch(`${BACKEND_URL}/api/questions`, { method: 'DELETE' });
            alert('All questions deleted from database.');
        } catch (error) {
            alert('Could not connect to server to delete questions.');
        } finally {
            clearBtn.disabled = false;
            clearBtn.innerHTML = 'Clear All Saved Questions';
        }
    }
});