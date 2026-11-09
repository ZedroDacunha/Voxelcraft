import {
    DEFAULT_GAME_SETTINGS, GAME_SETTING_FIELDS, loadGameSettings, formatSetting,
    notifyGameSettingsChange, saveGameSettings, settingFraction, settingFromFraction,
    stepSetting,
} from './world-game-settings.js';
import { TOUCH_EDIT_EVENT, TOUCH_RESET_EVENT, resetTouchPositions } from './world-touch-positions.js';
import { resolutionSize } from './world-render-resolution.js';

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
    { key: 'resolution', button: 'opt-resolution', output: 'opt-resolution-value', label: 'Resolução' },
    { key: 'fov', button: 'opt-fov', output: 'opt-fov-value', label: 'Campo de visão' },
    { key: 'renderDistance', button: 'opt-render-distance', output: 'opt-render-distance-value', label: 'Distância de render' },
];

export const CONTROL_OPTION_CONTROLS = [
    { key: 'sensitivity', button: 'opt-sensitivity', output: 'opt-sensitivity-value', label: 'Sensibilidade do mouse' },
];

export const TOUCH_OPTION_CONTROLS = [
    { key: 'touchAimMode', button: 'opt-touch-aim', output: 'opt-touch-aim-value', label: 'Modo de mira' },
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

// Confirmação da resolução: escolher uma resolução fixa muda o que o jogo
// desenha e, junto, pede tela cheia. Um engano (4K num aparelho fraco) deixaria
// o jogo em camera lenta, então a escolha passa por uma pergunta com contagem:
// sem confirmação, volta sozinha para a anterior — como em jogo de PC.
export const RESOLUTION_CONFIRM_MS = 10000;

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
        // lista com `slider` (a resolução) é barra de degraus: o valor ARIA é a
        // posição na lista, e o texto continua sendo a resolução escolhida
        const listSlider = Boolean(field.choices) && field.slider === true;
        const slider = !field.choices || listSlider;
        if (slider) {
            buttonEl.setAttribute('role', 'slider');
            buttonEl.setAttribute('aria-valuemin', String(listSlider ? 0 : field.min));
            buttonEl.setAttribute('aria-valuemax', String(listSlider ? field.choices.length - 1 : field.max));
        }
        return { key, field, label, slider, listSlider, buttonEl, outputEl: dialog.querySelector(`#${output}`) };
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
    const confirmPanel = dialog.querySelector('#options-confirm');
    const confirmText = dialog.querySelector('#options-confirm-text');
    const confirmCount = dialog.querySelector('#options-confirm-count');
    const keepButton = dialog.querySelector('#btn-resolution-keep');
    const revertButton = dialog.querySelector('#btn-resolution-revert');

    // Estado da confirmação da resolução. Fica declarado aqui (e não junto das
    // funções) porque `showScreen()` já pode esconder a pergunta no primeiro
    // desenho — e variável em TDZ derrubaria a janela inteira.
    let confirmTimer = 0;
    let confirmTick = 0;
    let confirmPrevious = null;
    let reverting = false;

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
        // a pergunta da resolução pertence à categoria Gráficos: sair de lá é
        // decisão do jogador, então a escolha fica e o painel sai da frente
        if (target !== 'graphics') hideResolutionConfirm();
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
            // numa lista com barra, o valor ARIA é a posição na lista
            const now = row.listSlider ? Math.max(0, row.field.choices.indexOf(value)) : value;
            row.buttonEl.setAttribute('aria-valuenow', String(now));
            row.buttonEl.setAttribute('aria-valuetext', text);
            // posição na barra: é ela que o CSS usa para pôr o cursor da barra
            row.buttonEl.style.setProperty('--option-fill', `${(settingFraction(row.key, value) * 100).toFixed(1)}%`);
        }
    };

    let current = loadGameSettings();
    render(current);
    showScreen('main', { focus: false });

    // --- confirmação da resolução ------------------------------------------
    // Só resolução fixa pede confirmação; "Janela (nativa)" é o estado de
    // fábrica e não tem como dar errado.
    const resolutionButton = () => rows.find(row => row.key === 'resolution')?.buttonEl;

    function hideResolutionConfirm() {
        clearTimeout(confirmTimer);
        clearInterval(confirmTick);
        confirmPrevious = null;
        if (confirmPanel) confirmPanel.hidden = true;
    }

    function revertResolution() {
        const previous = confirmPrevious;
        hideResolutionConfirm();
        if (previous === null) return;
        // sem marcar, o próprio revert abriria uma nova pergunta
        reverting = true;
        apply('resolution', previous);
        reverting = false;
        resolutionButton()?.focus?.();
    }

    function askResolutionConfirm(previous) {
        if (!confirmPanel || !resolutionSize(current.resolution)) {
            hideResolutionConfirm();
            return;
        }
        confirmPrevious = previous;
        if (confirmText) confirmText.textContent = `Manter ${formatSetting('resolution', current.resolution)}?`;
        let left = Math.round(RESOLUTION_CONFIRM_MS / 1000);
        if (confirmCount) confirmCount.textContent = String(left);
        confirmPanel.hidden = false;
        clearTimeout(confirmTimer);
        clearInterval(confirmTick);
        // a contagem é enfeite (aria-hidden); quem ouve recebe só a pergunta
        confirmTick = setInterval(() => {
            left -= 1;
            if (confirmCount) confirmCount.textContent = String(Math.max(0, left));
            if (left <= 0) clearInterval(confirmTick);
        }, 1000);
        confirmTimer = setTimeout(revertResolution, RESOLUTION_CONFIRM_MS);
    }

    // Chamado quando o jogador solta a barra (ou usa o teclado): pergunta só se
    // a resolução mudou de verdade e continua sendo uma resolução fixa.
    function settleResolution(previous) {
        if (reverting) return;
        if (previous === undefined || previous === current.resolution || !resolutionSize(current.resolution)) {
            hideResolutionConfirm();
            return;
        }
        askResolutionConfirm(previous);
    }

    keepButton?.addEventListener('click', () => {
        hideResolutionConfirm();
        resolutionButton()?.focus?.();
    });
    revertButton?.addEventListener('click', revertResolution);

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
        // a resolução só pergunta ao soltar a barra: durante o arrasto o jogador
        // está vendo a imagem mudar, e uma pergunta por degrau seria um assalto
        const isResolution = key === 'resolution';
        let pointerStart = null;
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
                if (isResolution) pointerStart = current[key];
                drag(event);
            });
            buttonEl.addEventListener('pointermove', (event) => {
                if (!buttonEl.hasPointerCapture?.(event.pointerId)) return;
                drag(event);
            });
            if (isResolution) {
                const settle = () => {
                    const previous = pointerStart;
                    pointerStart = null;
                    settleResolution(previous);
                };
                buttonEl.addEventListener('pointerup', settle);
                buttonEl.addEventListener('pointercancel', settle);
            }
        } else {
            // botão: um clique, um modo. Enter e Espaço já viram clique sozinhos.
            buttonEl.addEventListener('click', () => {
                apply(key, stepSetting(key, current[key], 1));
            });
        }
        buttonEl.addEventListener('keydown', (event) => {
            const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
            if (step === undefined && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();
            const before = current[key];
            if (step !== undefined) apply(key, stepSetting(key, current[key], step));
            else apply(key, settingFromFraction(key, event.key === 'Home' ? 0 : 1));
            // teclado não tem "soltar": a pergunta vem depois de cada mudança
            if (isResolution) settleResolution(before);
        });
    }

    // Categorias: cada botão troca a grade no lugar; "Voltar" sobe um nível.
    for (const [key, opener] of openers) {
        opener?.addEventListener('click', () => showScreen(key));
    }
    backButton?.addEventListener('click', goBack);
    // Fechar e reabrir as opções sempre volta para a lista de categorias: quem
    // abriu no ESC para ver o volume não quer cair na tela de toque.
    dialog.addEventListener('close', () => {
        // fechar a janela é decisão do jogador: mantém a resolução e some com a
        // pergunta (nada de reverter pelas costas de quem já saiu da tela)
        hideResolutionConfirm();
        // o aviso da linha de status é da sessão da janela: não fica para a próxima
        const status = dialog.querySelector('#options-status');
        if (status) status.textContent = '';
        showScreen('main', { focus: false });
    });

    // Fecha a janela e pede ao jogo o modo de edição (o jogo é quem desenha os
    // controles; aqui só se avisa que o jogador quer arrastá-los).
    editButton?.addEventListener('click', () => {
        if (!canEditPositions()) return;
        dialog.close();
        document.dispatchEvent(new CustomEvent(TOUCH_EDIT_EVENT));
    });

    dialog.querySelector('#btn-options-reset')?.addEventListener('click', () => {
        hideResolutionConfirm();
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
            hideResolutionConfirm();
            current = loadGameSettings();
            render(current);
            showScreen('main', { focus: false });
            return { ...current };
        },
        get settings() { return { ...current }; },
        get screen() { return screen; },
    };
}
