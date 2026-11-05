import {
    DEFAULT_GAME_SETTINGS, GAME_SETTING_FIELDS, loadGameSettings, formatSetting,
    notifyGameSettingsChange, saveGameSettings, settingFraction, settingFromFraction,
    stepSetting,
} from './world-game-settings.js';
import { TOUCH_EDIT_EVENT, TOUCH_RESET_EVENT, resetTouchPositions } from './world-touch-positions.js';

// Cada linha de opção é uma barra clicável que mostra "Rótulo: valor". O botão
// (`role="slider"`) recebe o clique/arraste e o `<span>` de saída mostra o valor
// formatado — os dois vivem no index.html e são achados por id.
//
// As linhas estão separadas por categoria porque a tela de opções deixou de ser
// uma parede de barras: a janela abre com as categorias e cada uma abre a
// própria grade no lugar (nunca duas janelas empilhadas — regra do menu).
export const AUDIO_OPTION_CONTROLS = [
    { key: 'volume', button: 'opt-volume', output: 'opt-volume-value', label: 'Volume' },
];

export const GRAPHICS_OPTION_CONTROLS = [
    { key: 'graphics', button: 'opt-graphics', output: 'opt-graphics-value', label: 'Gráficos' },
    { key: 'fov', button: 'opt-fov', output: 'opt-fov-value', label: 'Campo de visão' },
    { key: 'renderDistance', button: 'opt-render-distance', output: 'opt-render-distance-value', label: 'Distância de render' },
];

export const CONTROL_OPTION_CONTROLS = [
    { key: 'sensitivity', button: 'opt-sensitivity', output: 'opt-sensitivity-value', label: 'Sensibilidade do mouse' },
];

export const TOUCH_OPTION_CONTROLS = [
    { key: 'touchSensitivity', button: 'opt-touch-sensitivity', output: 'opt-touch-sensitivity-value', label: 'Sensibilidade do olhar' },
    { key: 'touchLayout', button: 'opt-touch-layout', output: 'opt-touch-layout-value', label: 'Mão' },
    { key: 'touchButtonSize', button: 'opt-touch-size', output: 'opt-touch-size-value', label: 'Tamanho dos botões' },
    { key: 'touchVibration', button: 'opt-touch-vibration', output: 'opt-touch-vibration-value', label: 'Vibração' },
];

// Todas as linhas de valor, na ordem em que aparecem nas categorias. A lista de
// categorias (`OPTION_SCREENS`) é quem manda na tela; esta serve para conferir
// que todo campo tem uma linha e nenhuma tela repete campo.
export const OPTION_CONTROLS = [
    ...AUDIO_OPTION_CONTROLS, ...GRAPHICS_OPTION_CONTROLS,
    ...CONTROL_OPTION_CONTROLS, ...TOUCH_OPTION_CONTROLS,
];

// As telas do diálogo. `main` é a lista de categorias; as outras trocam a grade
// no lugar, com o título acompanhando. `open` é o botão que leva à tela e
// `parent` é para onde "Voltar" retorna — o toque mora dentro de Controles.
export const OPTION_SCREENS = [
    { key: 'main', grid: 'options-main-grid', title: 'Opções' },
    { key: 'audio', grid: 'options-audio-grid', title: 'Áudio', open: 'opt-open-audio', parent: 'main', controls: AUDIO_OPTION_CONTROLS },
    { key: 'graphics', grid: 'options-graphics-grid', title: 'Gráficos', open: 'opt-open-graphics', parent: 'main', controls: GRAPHICS_OPTION_CONTROLS },
    { key: 'controls', grid: 'options-controls-grid', title: 'Controles', open: 'opt-open-controls', parent: 'main', controls: CONTROL_OPTION_CONTROLS, keys: true },
    { key: 'touch', grid: 'options-touch-grid', title: 'Controles de toque', open: 'opt-touch-open', parent: 'controls', controls: TOUCH_OPTION_CONTROLS },
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

    // Campo com faixa numérica é barra arrastável (role="slider"); campo de
    // lista (gráficos, mão, vibração) é botão: cada clique passa para o modo
    // seguinte, como no Minecraft — arrastar numa lista de dois ou quatro modos
    // só daria saltos.
    const buildRows = (list = []) => list.map(({ key, button, output, label }) => {
        const buttonEl = dialog.querySelector(`#${button}`);
        const field = GAME_SETTING_FIELDS[key];
        if (!buttonEl || !field) return null;
        const slider = !field.choices;
        if (slider) {
            buttonEl.setAttribute('role', 'slider');
            buttonEl.setAttribute('aria-valuemin', String(field.min));
            buttonEl.setAttribute('aria-valuemax', String(field.max));
        }
        return { key, field, label, slider, buttonEl, outputEl: dialog.querySelector(`#${output}`) };
    }).filter(Boolean);

    const rows = OPTION_SCREENS.flatMap(screen => buildRows(screen.controls));

    // Uma tela por vez: as grades, os botões que abrem cada uma, o caminho de
    // volta e o título de cada categoria.
    const grids = new Map(OPTION_SCREENS.map(({ key, grid }) => [key, dialog.querySelector(`#${grid}`)]));
    const openers = new Map(OPTION_SCREENS.filter(screen => screen.open)
        .map(screen => [screen.key, dialog.querySelector(`#${screen.open}`)]));
    const parents = new Map(OPTION_SCREENS.filter(screen => screen.parent)
        .map(screen => [screen.key, screen.parent]));
    const titles = new Map(OPTION_SCREENS.map(({ key, title }) => [key, title]));
    const keysScreen = OPTION_SCREENS.find(screen => screen.keys)?.key;

    const controlsDetails = dialog.querySelector('.options-controls');
    const title = dialog.querySelector('#options-title');
    const backButton = dialog.querySelector('#btn-options-back');
    const touchSummary = dialog.querySelector('#opt-touch-summary');
    const editButton = dialog.querySelector('#opt-touch-edit');

    // "Editar posições" só existe dentro do mundo e no modo toque: é lá que os
    // controles estão na tela para serem arrastados. `game.js` marca o body com
    // `touch-mode` ao carregar; no menu do título a linha fica escondida.
    const canEditPositions = () => document.body.classList.contains('touch-mode');

    let screen = 'main';

    function showScreen(next = 'main', { focus = true } = {}) {
        const target = grids.get(next) ? next : 'main';
        screen = target;
        for (const [key, grid] of grids) {
            // grade que não existe no HTML não pode virar a tela atual
            if (grid) grid.hidden = key !== target;
        }
        // a lista de teclas é da categoria Controles
        if (controlsDetails) controlsDetails.hidden = target !== keysScreen;
        if (backButton) backButton.hidden = target === 'main';
        if (title) title.textContent = titles.get(target) ?? 'Opções';
        if (editButton) editButton.hidden = target !== 'touch' || !canEditPositions();
        for (const [key, opener] of openers) opener?.setAttribute('aria-expanded', String(target === key));
        if (!focus) return;
        // foco: a primeira linha da categoria aberta não deixa o teclado num
        // botão que acabou de sair da tela
        grids.get(target)?.querySelector('button')?.focus?.();
    }

    function goBack() {
        const left = screen;
        showScreen(parents.get(left) ?? 'main', { focus: false });
        // Ao voltar, o foco vai para o botão que abriu a tela que está sendo
        // deixada. Ao fechar o diálogo não: quem devolve o foco ao que estava
        // atrás é o navegador, e roubar o foco deixaria o teclado perdido.
        openers.get(left)?.focus?.();
    }

    const render = (settings) => {
        if (touchSummary) {
            touchSummary.textContent = `${formatSetting('touchLayout', settings.touchLayout)} · ${formatSetting('touchButtonSize', settings.touchButtonSize)}`;
        }
        for (const row of rows) {
            const value = settings[row.key];
            const text = formatSetting(row.key, value);
            if (row.outputEl) row.outputEl.textContent = text;
            if (!row.slider) {
                // botão não tem valor ARIA: o nome acessível carrega o valor
                row.buttonEl.setAttribute('aria-label', `${row.label}: ${text}`);
                continue;
            }
            row.buttonEl.setAttribute('aria-valuenow', String(value));
            row.buttonEl.setAttribute('aria-valuetext', text);
            // posição na barra: é ela que o CSS usa para pôr o cursor da barra
            row.buttonEl.style.setProperty('--option-fill', `${(settingFraction(row.key, value) * 100).toFixed(1)}%`);
        }
    };

    let current = loadGameSettings();
    render(current);
    showScreen('main', { focus: false });

    const apply = (key, value) => {
        if (current[key] === value) return;
        current = saveGameSettings({ ...current, [key]: value });
        render(current);
        // o volume vale na hora; as demais opções quem escuta decide o que dá
        // para aplicar sem recarregar o mundo
        onChange?.(current);
        notifyGameSettingsChange(current);
    };

    for (const { key, buttonEl, slider } of rows) {
        if (slider) {
            // Clique e arraste definem o valor pela posição na barra — é o gesto
            // do Minecraft e o único que serve para toque.
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
        } else {
            // botão: um clique, um modo. Enter e Espaço já viram clique sozinhos.
            buttonEl.addEventListener('click', () => {
                apply(key, stepSetting(key, current[key], 1));
            });
        }
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

    // Categorias: cada botão troca a grade no lugar; "Voltar" sobe um nível.
    for (const [key, opener] of openers) {
        opener?.addEventListener('click', () => showScreen(key));
    }
    backButton?.addEventListener('click', goBack);
    // Fechar e reabrir as opções sempre volta para a lista de categorias: quem
    // abriu no ESC para ver o volume não quer cair na tela de toque.
    dialog.addEventListener('close', () => showScreen('main', { focus: false }));

    // Fecha a janela e pede ao jogo o modo de edição (o jogo é quem desenha os
    // controles; aqui só se avisa que o jogador quer arrastá-los).
    editButton?.addEventListener('click', () => {
        if (!canEditPositions()) return;
        dialog.close();
        document.dispatchEvent(new CustomEvent(TOUCH_EDIT_EVENT));
    });

    dialog.querySelector('#btn-options-reset')?.addEventListener('click', () => {
        current = saveGameSettings(DEFAULT_GAME_SETTINGS);
        render(current);
        onChange?.(current);
        notifyGameSettingsChange(current);
        // "Restaurar padrões" também devolve os controles ao lugar de fábrica; o
        // aviso deixa o jogo reaplicar na hora (se estiver aberto).
        resetTouchPositions();
        document.dispatchEvent(new CustomEvent(TOUCH_RESET_EVENT));
    });

    return {
        // As opções podem ser abertas no menu, no ESC do jogo e de novo depois:
        // reler do storage evita mostrar valor velho.
        refresh: () => {
            current = loadGameSettings();
            render(current);
            showScreen('main', { focus: false });
            return { ...current };
        },
        get settings() { return { ...current }; },
        get screen() { return screen; },
    };
}
