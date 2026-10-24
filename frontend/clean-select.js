// Keep the original select as the source of truth for forms and page handlers.
(() => {
    // Older browsers keep the working native control instead of a partial popup.
    if (typeof HTMLElement.prototype.showPopover !== 'function') return;
    const records = new Map();
    const nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    const nativeIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
    let sequence = 0, active = null;
    const text = option => option?.label || option?.textContent.trim() || '';
    const unavailable = option => option.disabled || option.parentElement?.disabled || option.hidden || option.parentElement?.hidden;

    function close(record = active) {
        if (!record) return;
        if (record.menu.matches(':popover-open')) record.menu.hidePopover();
        record.menu.hidden = true;
        record.button.setAttribute('aria-expanded', 'false');
        record.button.removeAttribute('aria-activedescendant');
        if (active === record) active = null;
    }

    function position(record) {
        const bounds = record.button.getBoundingClientRect();
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
        const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
        const below = top + height - bounds.bottom - 16, above = bounds.top - top - 16;
        const upwards = below < Math.min(240, record.menu.scrollHeight) && above > below;
        const available = Math.max(60, upwards ? above : below);
        record.menu.style.width = `${Math.min(bounds.width, width - 16)}px`;
        record.menu.style.maxHeight = `${Math.min(344, available)}px`;
        record.menu.style.left = `${Math.max(left + 8, Math.min(bounds.left, left + width - record.menu.offsetWidth - 8))}px`;
        record.menu.style.top = `${upwards ? bounds.top - record.menu.offsetHeight - 8 : bounds.bottom + 8}px`;
    }

    function highlight(record, index, scroll = true) {
        record.highlighted = index;
        for (const [i, row] of record.rows) row.classList.toggle('qb-select-focused', i === index);
        const row = record.rows.get(index);
        if (row) {
            record.button.setAttribute('aria-activedescendant', row.id);
            if (scroll) row.scrollIntoView({ block: 'nearest' });
        }
    }

    function choose(record, index) {
        const option = record.select.options[index];
        if (!option || unavailable(option) || record.button.disabled) return;
        const changed = record.select.selectedIndex !== index;
        record.select.selectedIndex = index;
        record.button.removeAttribute('aria-invalid');
        record.error.hidden = true;
        close(record);
        record.button.focus({ preventScroll: true });
        if (changed) {
            record.select.dispatchEvent(new Event('input', { bubbles: true }));
            record.select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function sync(record) {
        const { select, button, value, menu } = record;
        button.disabled = select.matches(':disabled');
        button.setAttribute('aria-required', String(select.required));
        if (select.validity.valid) { button.removeAttribute('aria-invalid'); record.error.hidden = true; }
        value.textContent = text(select.options[select.selectedIndex]) || 'Choose option';
        button.title = value.textContent;
        if (select.getAttribute('aria-label')) button.setAttribute('aria-label', `${select.getAttribute('aria-label')}: ${value.textContent}`);
        else {
            const labels = [...select.labels];
            labels.forEach(label => { if (!label.id) label.id = `qb-select-label-${++sequence}`; });
            button.setAttribute('aria-labelledby', [...labels.map(label => label.id), value.id].join(' '));
        }
        record.rows.clear();
        const content = document.createDocumentFragment();
        let group = null;
        [...select.options].forEach((option, index) => {
            if (option.hidden || option.parentElement?.hidden) return;
            const parent = option.parentElement;
            if (parent.tagName === 'OPTGROUP' && parent !== group) {
                const heading = document.createElement('div'); heading.className = 'qb-select-group'; heading.textContent = parent.label;
                content.append(heading); group = parent;
            }
            const row = document.createElement('div');
            row.className = 'qb-select-option'; row.id = `${menu.id}-${index}`;
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', String(index === select.selectedIndex));
            row.setAttribute('aria-disabled', String(unavailable(option)));
            const grade = /^Grade\s+(\d+)$/i.exec(text(option));
            if (grade) {
                const badge = document.createElement('span'); badge.className = 'qb-select-badge'; badge.textContent = grade[1]; badge.setAttribute('aria-hidden', 'true'); row.append(badge);
            }
            const label = document.createElement('span'); label.className = 'qb-select-option-text'; label.textContent = text(option); row.append(label);
            const check = document.createElement('span'); check.className = 'qb-select-check'; check.setAttribute('aria-hidden', 'true'); row.append(check);
            row.addEventListener('pointerdown', event => event.preventDefault());
            row.addEventListener('click', () => choose(record, index));
            record.rows.set(index, row); content.append(row);
        });
        menu.replaceChildren(content);
        if (button.disabled) close(record);
        else if (active === record) { highlight(record, select.selectedIndex, false); position(record); }
    }

    function open(record) {
        if (record.button.disabled) return;
        close(); sync(record);
        record.menu.hidden = false;
        record.menu.showPopover?.();
        record.button.setAttribute('aria-expanded', 'true'); active = record;
        position(record); highlight(record, record.select.selectedIndex);
    }

    function enhance(select) {
        if (records.has(select) || select.multiple || select.size > 1 || select.hasAttribute('data-native-select')) return;
        const wrapper = document.createElement('div'); wrapper.className = 'qb-select';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'qb-select-trigger';
        button.setAttribute('role', 'combobox'); button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
        const value = document.createElement('span'); value.className = 'qb-select-value'; value.id = `qb-select-value-${++sequence}`;
        const arrow = document.createElement('span'); arrow.className = 'qb-select-chevron'; arrow.setAttribute('aria-hidden', 'true'); button.append(value, arrow);
        const menu = document.createElement('div'); menu.className = 'qb-select-menu'; menu.id = `qb-select-menu-${sequence}`;
        menu.hidden = true; menu.setAttribute('popover', 'auto'); menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-labelledby', value.id); button.setAttribute('aria-controls', menu.id);
        const error = document.createElement('span'); error.className = 'qb-select-error'; error.hidden = true; error.setAttribute('role', 'alert');
        error.id = `qb-select-error-${sequence}`; button.setAttribute('aria-describedby', error.id);
        const record = { select, wrapper, button, value, menu, error, rows: new Map(), highlighted: -1, search: '', searchAt: 0 };
        records.set(select, record);
        const originalTab = select.getAttribute('tabindex'), originalAria = select.getAttribute('aria-hidden');
        select.before(wrapper); wrapper.append(select, button, menu, error);
        select.classList.add('qb-select-native'); select.setAttribute('tabindex', '-1'); select.setAttribute('aria-hidden', 'true');
        // Existing pages set .value directly when editing, restoring filters or resetting forms.
        for (const [property, descriptor] of [['value', nativeValue], ['selectedIndex', nativeIndex]]) {
            Object.defineProperty(select, property, {
                configurable: true, get() { return descriptor.get.call(this); },
                set(next) { descriptor.set.call(this, next); sync(record); }
            });
        }
        const onChange = () => sync(record);
        const onFocus = () => button.focus({ preventScroll: true });
        const onInvalid = event => {
            event.preventDefault(); button.setAttribute('aria-invalid', 'true');
            error.textContent = select.validationMessage; error.hidden = false; button.focus({ preventScroll: false });
        };
        select.addEventListener('change', onChange); select.addEventListener('input', onChange);
        select.addEventListener('focus', onFocus); select.addEventListener('invalid', onInvalid);
        button.addEventListener('click', () => active === record ? close(record) : open(record));
        menu.addEventListener('toggle', event => { if (event.newState === 'closed' && active === record) close(record); });
        button.addEventListener('keydown', event => {
            const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'];
            if (event.key === 'Tab') { close(record); return; }
            if (keys.includes(event.key)) {
                event.preventDefault();
                if (event.key === 'Escape') { close(record); return; }
                if (event.key === 'Enter' || event.key === ' ') {
                    if (active === record) choose(record, record.highlighted); else open(record);
                    return;
                }
                const wasOpen = active === record;
                if (!wasOpen) open(record);
                const enabled = [...select.options].map((option, i) => unavailable(option) ? -1 : i).filter(i => i >= 0 && record.rows.has(i));
                let at = enabled.indexOf(record.highlighted);
                if (event.key === 'Home') at = 0;
                else if (event.key === 'End') at = enabled.length - 1;
                else if (wasOpen) at = Math.max(0, Math.min(enabled.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)));
                highlight(record, enabled[Math.max(0, at)]);
            } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                record.search = Date.now() - record.searchAt > 700 ? event.key : record.search + event.key;
                record.searchAt = Date.now();
                const match = [...select.options].findIndex(option => !unavailable(option) && text(option).toLocaleLowerCase().startsWith(record.search.toLocaleLowerCase()));
                if (match >= 0) { if (active === record) highlight(record, match); else choose(record, match); }
            }
        });
        const observer = new MutationObserver(onChange);
        observer.observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'required', 'selected', 'label', 'value', 'hidden', 'aria-label'] });
        record.destroy = () => {
            close(record); observer.disconnect();
            select.removeEventListener('change', onChange); select.removeEventListener('input', onChange);
            select.removeEventListener('focus', onFocus); select.removeEventListener('invalid', onInvalid);
            delete select.value; delete select.selectedIndex;
            select.classList.remove('qb-select-native');
            if (originalTab === null) select.removeAttribute('tabindex'); else select.setAttribute('tabindex', originalTab);
            if (originalAria === null) select.removeAttribute('aria-hidden'); else select.setAttribute('aria-hidden', originalAria);
            records.delete(select);
        };
        sync(record);
    }

    function scan(root) {
        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
        if (root.matches?.('select')) enhance(root);
        root.querySelectorAll('select').forEach(enhance);
    }
    function start() {
        scan(document);
        new MutationObserver(changes => {
            for (const change of changes) {
                if (change.type === 'attributes') change.target.querySelectorAll('select').forEach(select => { if (records.has(select)) sync(records.get(select)); });
                else change.addedNodes.forEach(scan);
            }
            for (const record of records.values()) if (!record.select.isConnected) record.destroy();
        }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
        // The browser restores selected options after the reset event's default action.
        document.addEventListener('reset', () => setTimeout(() => records.forEach(record => {
            sync(record); record.button.removeAttribute('aria-invalid'); record.error.hidden = true;
        }), 0), true);
        document.addEventListener('pointerdown', event => { if (active && !active.wrapper.contains(event.target)) close(); }, true);
        document.addEventListener('scroll', event => { if (active && event.target !== active.menu && !active.menu.contains(event.target)) close(); }, true);
        document.addEventListener('close', () => close(), true);
        window.addEventListener('resize', () => { if (active) position(active); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
