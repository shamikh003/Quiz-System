document.addEventListener('DOMContentLoaded', function() {
    const resultsBody = document.getElementById('results-body');
    let results = JSON.parse(localStorage.getItem('quizResults')) || [];

    // Function to render the table (so we can call it again after clearing)
    function renderTable() {
        resultsBody.innerHTML = ''; // Clear table
        
        if (results.length === 0) {
            resultsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No results found yet.</td></tr>';
            return;
        }

        // Sort results: highest score first
        results.sort((a, b) => b.score - a.score); 

        // Add each result to the table
        results.forEach(result => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${result.name}</td>
                <td>${result.rollNum}</td>
                <td>${result.score} / ${result.total}</td>
                <td>${result.date}</td>
            `;
            resultsBody.appendChild(row);
        });
    }
    
    // Show the table when the page first loads
    renderTable(); 

    // --- NEW FEATURE: CLEAR ALL RESULTS ---
    const clearBtn = document.getElementById('clear-results-btn');
    clearBtn.addEventListener('click', function() {
        
        // Ask for confirmation
        if (confirm('Are you sure you want to delete ALL student results? This cannot be undone.')) {
            
            // Clear from localStorage
            localStorage.removeItem('quizResults');
            
            // Clear from our local 'results' array
            results = []; 
            
            // Re-render the table (which will now show "No results")
            renderTable(); 
            
            alert('All student results have been cleared.');
        }
    });
    // --- END OF NEW FEATURE ---
});