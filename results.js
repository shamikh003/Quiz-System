// Backend URL
const BACKEND_URL = 'https://quiz-system-hpy5.onrender.com';

// 'DOMContentLoaded' ko 'async' banayein
document.addEventListener('DOMContentLoaded', async function() {
    const resultsBody = document.getElementById('results-body');
    let results = [];
    
    try {
        // Results server se fetch karein
        const response = await fetch(`${BACKEND_URL}/api/results`);
        results = await response.json();
    } catch (error) {
        console.error("Error fetching results:", error);
        resultsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Could not load results. Server may be offline.</td></tr>';
    }
    
    // Function to render the table
    function renderTable() {
        resultsBody.innerHTML = ''; // Clear table
        
        if (results.length === 0) {
            resultsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No results found in database.</td></tr>';
            return;
        }

        // Sort results (Server pehle se hi kar raha hai)
        // results.sort((a, b) => b.score - a.score); 

        // Add each result to the table
        results.forEach(result => {
            const row = document.createElement('tr');
            const formattedDate = new Date(result.date).toLocaleString('en-US');
            row.innerHTML = `
                <td>${result.name}</td>
                <td>${result.rollNum}</td>
                <td>${result.score} / ${result.total}</td>
                <td>${formattedDate}</td>
            `;
            resultsBody.appendChild(row);
        });
    }
    
    renderTable(); // Pehli baar table dikhayein

    // "Clear All Results" button ka naya logic
    const clearBtn = document.getElementById('clear-results-btn');
    clearBtn.addEventListener('click', async function() {
        if (confirm('Are you sure you want to delete ALL results from the database?')) {
            
            clearBtn.disabled = true;
            clearBtn.innerHTML = 'Deleting... <span class="spinner"></span>'; // Loading state
            
            try {
                await fetch(`${BACKEND_URL}/api/results`, { method: 'DELETE' });
                results = []; 
                renderTable(); 
                alert('All results deleted from database.');
            } catch (error) {
                alert('Could not connect to server.');
            } finally {
                clearBtn.disabled = false;
                clearBtn.innerHTML = 'Clear All Results';
            }
        }
    });
});