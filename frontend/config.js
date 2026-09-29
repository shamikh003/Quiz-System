// One API address for all pages. Local previews never call the production API.
window.QUIZ_BACKEND_URL = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://127.0.0.1:5000'
    : 'https://quiz-system-wf0d.onrender.com';
