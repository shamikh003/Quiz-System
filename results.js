// Backend URL
const BACKEND_URL = 'http://localhost:5000';

// 'DOMContentLoaded' ko 'async' banayein
document.addEventListener('DOMContentLoaded', async function() {
    const resultsBody = document.getElementById('results-body');
    
    // --- NAYI LOGIC (Fetch se) ---
    // Results server se fetch karein
    const response = await fetch(`${BACKEND_URL}/api/results`);
    let results = await response.json();
    // --- END ---

    // Function to render the table
    function renderTable() {
        resultsBody.innerHTML = ''; // Clear table
        
        if (results.length === 0) {
            resultsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No results found in database.</td></tr>';
            return;
        }

        // Sort results: highest score first (Server pehle se hi kar raha hai, lekin yahan bhi acha hai)
        results.sort((a, b) => b.score - a.score); 

        // Add each result to the table
        results.forEach(result => {
            const row = document.createElement('tr');
            // Date ko format karein
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
            await fetch(`${BACKEND_URL}/api/results`, { method: 'DELETE' });
            results = []; // Local array ko khaali karein
            renderTable(); // Table ko dobara render karein
            alert('All results deleted from database.');
        }
    });
});