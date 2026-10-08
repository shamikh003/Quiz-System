// One API address for all pages. Local previews never call the production API.
(() => {
    const host = location.hostname;
    const octets = host.split('.').map(Number);
    const ipv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host)
        && octets.every(n => n >= 0 && n <= 255);
    const privateAddress = ipv4 && (octets[0] === 127 || octets[0] === 10
        || (octets[0] === 192 && octets[1] === 168)
        || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
    const local = host === 'localhost' || host === '[::1]' || privateAddress;
    window.QUIZ_BACKEND_URL = location.protocol === 'file:'
        ? 'http://127.0.0.1:5000'
        : local ? `http://${host}:5000` : 'https://quiz-system-wf0d.onrender.com';
})();
