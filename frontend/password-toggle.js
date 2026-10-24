(() => {
    const fields = new Map();
    let sequence = 0;
    const eye = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="qb-password-slash" d="m3 3 18 18"/></svg>';

    function refresh(input, button) {
        const visible = input.type === 'text';
        const urdu = document.documentElement.lang === 'ur';
        const label = urdu ? (visible ? 'پاس ورڈ چھپائیں' : 'پاس ورڈ دکھائیں') : (visible ? 'Hide password' : 'Show password');
        button.setAttribute('aria-label', label); button.title = label;
        button.setAttribute('aria-pressed', String(visible));
        const disabled = input.matches(':disabled');
        if (button.disabled !== disabled) button.disabled = disabled;
    }

    function conceal(input, button) { input.type = 'password'; refresh(input, button); }

    function enhance(input) {
        if (fields.has(input)) return;
        if (!input.id) input.id = `qb-password-${++sequence}`;
        const wrapper = document.createElement('div'); wrapper.className = 'qb-password-field';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'qb-password-toggle';
        button.setAttribute('aria-controls', input.id); button.innerHTML = eye;
        input.before(wrapper); wrapper.append(input, button); fields.set(input, button);
        button.addEventListener('click', () => {
            const start = input.selectionStart, end = input.selectionEnd;
            input.type = input.type === 'password' ? 'text' : 'password';
            if (start !== null && end !== null) input.setSelectionRange(start, end);
            refresh(input, button);
        });
        refresh(input, button);
    }

    function scan(root) {
        if (!root.querySelectorAll) return;
        if (root.matches?.('input[type="password"]')) enhance(root);
        root.querySelectorAll('input[type="password"]').forEach(enhance);
    }

    function start() {
        scan(document);
        new MutationObserver(changes => {
            for (const change of changes) if (change.type === 'childList') change.addedNodes.forEach(scan);
            for (const [input, button] of fields) {
                if (!input.isConnected) fields.delete(input); else refresh(input, button);
            }
        }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
        new MutationObserver(() => fields.forEach((button, input) => refresh(input, button)))
            .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
        document.addEventListener('input', event => {
            const button = fields.get(event.target);
            if (button && !event.target.value) conceal(event.target, button);
        });
        document.addEventListener('submit', event => fields.forEach((button, input) => {
            if (input.form === event.target) conceal(input, button);
        }), true);
        document.addEventListener('reset', event => fields.forEach((button, input) => {
            if (input.form === event.target) conceal(input, button);
        }), true);
        window.addEventListener('pagehide', () => fields.forEach((button, input) => conceal(input, button)));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
