// Shared Pulse loader. Never represents a completion percentage.
(() => {
    const pending = new WeakMap();
    function show(target, label = 'Loading…') {
        if (!target) return () => {};
        const loader = document.createElement('div');
        loader.className = 'qb-loader';
        loader.setAttribute('role', 'status');
        loader.setAttribute('aria-live', 'polite');
        const identity = document.createElement('div');
        identity.className = 'qb-loader-identity';
        const emblem = document.createElement('div');
        emblem.className = 'qb-loader-emblem';
        emblem.setAttribute('aria-hidden', 'true');
        emblem.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2m1 10 2 2 4-4"/></svg>';
        const copy = document.createElement('div');
        const brand = document.createElement('strong');
        brand.className = 'qb-loader-brand'; brand.textContent = 'QuizBoard';
        const message = document.createElement('span');
        message.className = 'qb-loader-label'; message.textContent = label;
        copy.append(brand, message); identity.append(emblem, copy);
        const dots = document.createElement('div');
        dots.className = 'qb-loader-dots'; dots.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));
        loader.append(identity, dots);
        const slot = target.classList.contains('qb-loader-slot');
        const auth = target.hasAttribute('data-auth-loader');
        if (auth) loader.classList.add('qb-loader-auth');
        target.replaceChildren(loader);
        target.hidden = false; target.setAttribute('aria-busy', 'true');
        if (slot) target.parentElement.classList.add(auth ? 'qb-auth-loading' : 'qb-loading-section');
        pending.set(target, loader);
        return () => {
            // A late response must not remove a newer request's loader.
            if (pending.get(target) !== loader) return;
            pending.delete(target); loader.remove(); target.removeAttribute('aria-busy');
            if (slot) {
                target.hidden = true;
                target.parentElement.classList.remove(auth ? 'qb-auth-loading' : 'qb-loading-section');
            }
        };
    }
    window.QuizLoader = { show };
})();
