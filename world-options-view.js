import {
    DEFAULT_GAME_SETTINGS, GAME_SETTING_FIELDS, loadGameSettings, formatSetting,
    notifyGameSettingsChange, saveGameSettings, settingFraction, settingFromFraction,
    stepSetting,
} from './world-game-settings.js';

// Cada linha da tela de opções é uma barra clicável que mostra "Rótulo: valor".
// O botão (`role="slider"`) recebe o clique/arraste e o `<span>` de saída mostra
// o valor formatado — os dois vivem no index.html e são achados por id.
export const OPTION_CONTROLS = [
    { key: 'sensitivity', button: 'opt-sensitivity', output: 'opt-sensitivity-value' },
    { key: 'fov', button: 'opt-fov', output: 'opt-fov-value' },
    { key: 'renderDistance', button: 'opt-render-distance', output: 'opt-render-distance-value' },
    { key: 'volume', button: 'opt-volume', output: 'opt-volume-value' },
    { key: 'graphics', button: 'opt-graphics', output: 'opt-graphics-value' },
];

// Onde o ponteiro caiu na barra, de 0 (esquerda) a 1 (direita). Barra sem
// largura (tela escondida) não muda nada: devolve null.
function fractionFromPointer(event, element) {
    const rect = element.getBoundingClientRect();
    if (!(rect.width > 0)) return null;
    return (event.clientX - rect.left) / rect.width;
}

export function createOptionsView(dialog = document.getElementById('options-dialog'), { onChange } = {}) {
    if (!dialog) return null;

    const rows = OPTION_CONTROLS.map(({ key, button, output }) => {
        const buttonEl = dialog.querySelector(`#${button}`);
        const field = GAME_SETTING_FIELDS[key];
        if (!buttonEl || !field) return null;
        buttonEl.setAttribute('role', 'slider');
        buttonEl.setAttribute('aria-valuemin', field.choices ? '0' : String(field.min));
        buttonEl.setAttribute('aria-valuemax', field.choices ? String(field.choices.length - 1) : String(field.max));
        return { key, field, buttonEl, outputEl: dialog.querySelector(`#${output}`) };
    }).filter(Boolean);

    const render = (settings) => {
        for (const row of rows) {
            const value = settings[row.key];
            if (row.outputEl) row.outputEl.textContent = formatSetting(row.key, value);
            row.buttonEl.setAttribute('aria-valuenow', String(
                row.field.choices ? Math.max(0, row.field.choices.indexOf(value)) : value,
            ));
            row.buttonEl.setAttribute('aria-valuetext', formatSetting(row.key, value));
            // posição na barra: é ela que o CSS usa para desenhar o preenchimento
            row.buttonEl.style.setProperty('--option-fill', `${(settingFraction(row.key, value) * 100).toFixed(1)}%`);
        }
    };

    let current = loadGameSettings();
    render(current);

    const apply = (key, value) => {
        if (current[key] === value) return;
        current = saveGameSettings({ ...current, [key]: value });
        render(current);
        // o volume vale na hora; as demais opções quem escuta decide o que dá
        // para aplicar sem recarregar o mundo
        onChange?.(current);
        notifyGameSettingsChange(current);
    };

    for (const { key, buttonEl } of rows) {
        // Clique e arraste definem o valor pela posição na barra — é o gesto do
        // Minecraft e o único que serve para toque.
        const drag = (event) => {
            const fraction = fractionFromPointer(event, buttonEl);
            if (fraction === null) return;
            apply(key, settingFromFraction(key, fraction));
        };
        buttonEl.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            // preventDefault tira o foco do clique; sem o focus() as setas não
            // funcionariam logo depois de arrastar.
            buttonEl.focus?.();
            buttonEl.setPointerCapture?.(event.pointerId);
            drag(event);
        });
        buttonEl.addEventListener('pointermove', (event) => {
            if (!buttonEl.hasPointerCapture?.(event.pointerId)) return;
            drag(event);
        });
        buttonEl.addEventListener('keydown', (event) => {
            const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
            if (step !== undefined) {
                event.preventDefault();
                apply(key, stepSetting(key, current[key], step));
            } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                apply(key, settingFromFraction(key, event.key === 'Home' ? 0 : 1));
            }
        });
    }

    dialog.querySelector('#btn-options-reset')?.addEventListener('click', () => {
        current = saveGameSettings(DEFAULT_GAME_SETTINGS);
        render(current);
        onChange?.(current);
        notifyGameSettingsChange(current);
    });

    return {
        // As opções podem ser abertas no menu, no ESC do jogo e de novo depois:
        // reler do storage evita mostrar valor velho.
        refresh: () => { current = loadGameSettings(); render(current); return { ...current }; },
        get settings() { return { ...current }; },
    };
}
