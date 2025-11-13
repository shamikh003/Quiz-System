// Select elements
const optionCountSelector = document.getElementById('option-count');
const optionDWrapper = document.getElementById('option-d-wrapper');
const optionDInput = document.getElementById('option-d');
const correctOptionD = document.getElementById('correct-option-d');
const questionForm = document.getElementById('question-form');

// Event listener for the dropdown
optionCountSelector.addEventListener('change', function() {
    const selectedCount = this.value;

    if (selectedCount === '3') {
        // If 3 options, hide Option D
        optionDWrapper.classList.add('hidden');
        correctOptionD.classList.add('hidden');
        // Remove 'required' to avoid form errors
        optionDInput.required = false; 
    } else {
        // If 4 options, show it
        optionDWrapper.classList.remove('hidden');
        correctOptionD.classList.remove('hidden');
        // Add 'required' back
        optionDInput.required = true;
    }
});


questionForm.addEventListener('submit', function(event) {
    event.preventDefault();

    // Build the options array
    const optionsArray = [
        { id: 'A', text: document.getElementById('option-a').value },
        { id: 'B', text: document.getElementById('option-b').value },
        { id: 'C', text: document.getElementById('option-c').value }
    ];

    // Check if 4 options should be added
    const selectedCount = optionCountSelector.value;
    if (selectedCount === '4') {
        optionsArray.push({ id: 'D', text: optionDInput.value });
    }

    // Create the new question object
    const newQuestion = {
        text: document.getElementById('question-text').value,
        options: optionsArray,
        correct: document.getElementById('correct-answer').value
    };

    // Get existing questions from localStorage or create a new array
    let questions = JSON.parse(localStorage.getItem('quizQuestions')) || [];

    // Add new question
    questions.push(newQuestion);

    // Save back to localStorage
    localStorage.setItem('quizQuestions', JSON.stringify(questions));

    // Notify user
    alert('Question saved successfully!');
    
    // Reset the form
    event.target.reset();

    // After reset, restore the default 4-option view
    optionDWrapper.classList.remove('hidden');
    correctOptionD.classList.remove('hidden');
    optionDInput.required = true;
});

// Logic for the "Clear All Questions" button
const clearBtn = document.getElementById('clear-questions-btn');

clearBtn.addEventListener('click', function() {
    
    // Ask for confirmation
    if ( confirm('Are you sure you want to delete ALL saved questions? This cannot be undone.') ) {
        
        // Clear the questions from localStorage
        localStorage.removeItem('quizQuestions');
        
        // Tell the user it's done
        alert('All questions have been cleared.');
    }
});