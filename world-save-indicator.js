export function createWorldSaveIndicator(indicator, label, { confirmationDurationMs = 1800 } = {}) {
    let hideTimer = null;

    return function setSaveIndicator(state, message) {
        label.textContent = message;
        indicator.dataset.state = state;
        indicator.title = message;
        if (hideTimer !== null) clearTimeout(hideTimer);
        hideTimer = null;

        if (state === 'pending' || state === 'saving') {
            indicator.hidden = true;
            return;
        }

        indicator.hidden = false;
        if (state === 'saved') {
            hideTimer = setTimeout(() => {
                if (indicator.dataset.state === 'saved') indicator.hidden = true;
                hideTimer = null;
            }, confirmationDurationMs);
        }
    };
}
