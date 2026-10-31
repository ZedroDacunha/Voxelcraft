import {
    DEFAULT_GAME_SETTINGS, GAME_SETTING_FIELDS, loadGameSettings, saveGameSettings,
} from './world-game-settings.js';

// Cada linha da tela de opções liga um input (range) a um campo de
// GAME_SETTING_FIELDS e ao <output> que mostra o valor formatado.
export const OPTION_CONTROLS = [
    { key: 'sensitivity', input: 'opt-sensitivity', output: 'opt-sensitivity-value' },
    { key: 'fov', input: 'opt-fov', output: 'opt-fov-value' },
    { key: 'renderDistance', input: 'opt-render-distance', output: 'opt-render-distance-value' },
];

export function createOptionsView(dialog = document.getElementById('options-dialog')) {
    if (!dialog) return null;

    const rows = OPTION_CONTROLS.map(({ key, input, output }) => {
        const inputEl = dialog.querySelector(`#${input}`);
        if (!inputEl) return null;
        const field = GAME_SETTING_FIELDS[key];
        inputEl.min = String(field.min);
        inputEl.max = String(field.max);
        inputEl.step = String(field.step);
        return { key, field, inputEl, outputEl: dialog.querySelector(`#${output}`) };
    }).filter(Boolean);

    const render = (settings) => {
        for (const row of rows) {
            row.inputEl.value = String(settings[row.key]);
            if (row.outputEl) row.outputEl.textContent = row.field.format(settings[row.key]);
        }
    };

    let current = loadGameSettings();
    render(current);

    for (const row of rows) {
        row.inputEl.addEventListener('input', () => {
            current = saveGameSettings({ ...current, [row.key]: Number(row.inputEl.value) });
            render(current);
        });
    }

    dialog.querySelector('#btn-options-reset')?.addEventListener('click', () => {
        current = saveGameSettings(DEFAULT_GAME_SETTINGS);
        render(current);
    });

    return {
        // Útil se as opções voltarem a ser abertas em outro momento.
        refresh: () => render(loadGameSettings()),
        get settings() { return { ...current }; },
    };
}
