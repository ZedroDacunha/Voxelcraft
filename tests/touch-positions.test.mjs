import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    TOUCH_EDIT_EVENT, TOUCH_EDIT_MARGIN, TOUCH_OFFSET_LIMIT, TOUCH_PIECES,
    TOUCH_POSITIONS_KEY, TOUCH_RESET_EVENT,
    clampOffsetPx, emptyTouchPositions, hasCustomPositions, loadTouchPositions,
    offsetPercent, offsetPixels, resetTouchPositions, sanitizeTouchPositions, saveTouchPositions,
} from '../world-touch-positions.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../world-options-view.js', import.meta.url), 'utf8');
const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));

function fakeStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: key => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => { map.set(key, String(value)); },
        removeItem: key => { map.delete(key); },
        entries: () => [...map.entries()],
    };
}

function sliceFn(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start > 0, `função ${name} não encontrada`);
    const next = source.indexOf('\nfunction ', start + 1);
    return source.slice(start, next > 0 ? next : undefined);
}

// --- storage ------------------------------------------------------------

test('sem nada arrastado, todas as peças ficam no lugar de fábrica', () => {
    assert.deepEqual(TOUCH_PIECES, ['stick', 'crouch', 'use', 'break', 'jump', 'inventory', 'chat', 'pause']);
    const empty = emptyTouchPositions();
    assert.deepEqual(Object.keys(empty), [...TOUCH_PIECES]);
    for (const piece of TOUCH_PIECES) assert.deepEqual(empty[piece], { x: 0, y: 0 });
    assert.equal(hasCustomPositions(empty), false);
    assert.deepEqual(loadTouchPositions(fakeStorage()), empty);
});

test('arrastar uma peça grava e volta igual', () => {
    const storage = fakeStorage();
    const positions = emptyTouchPositions();
    positions.jump = { x: -22.5, y: 14.25 };
    const saved = saveTouchPositions(positions, storage);
    assert.deepEqual(saved.jump, { x: -22.5, y: 14.25 });

    const [[key, value]] = storage.entries();
    assert.equal(key, TOUCH_POSITIONS_KEY);
    assert.deepEqual(loadTouchPositions(storage).jump, { x: -22.5, y: 14.25 });
    assert.deepEqual(JSON.parse(value).jump, { x: -22.5, y: 14.25 });
    assert.equal(hasCustomPositions(saved), true);
});

test('storage estragado não vira posição quebrada', () => {
    const storage = fakeStorage({
        [TOUCH_POSITIONS_KEY]: JSON.stringify({
            jump: { x: 'abc', y: null },
            break: { x: 999, y: -999 },
            naoExiste: { x: 10, y: 10 },
            stick: 'lixo',
        }),
    });
    const positions = loadTouchPositions(storage);
    assert.deepEqual(positions.jump, { x: 0, y: 0 });
    assert.deepEqual(positions.break, { x: TOUCH_OFFSET_LIMIT, y: -TOUCH_OFFSET_LIMIT },
        'fora da trava dura é preso no limite');
    assert.equal('naoExiste' in positions, false, 'peça desconhecida é descartada');
    assert.deepEqual(positions.stick, { x: 0, y: 0 });

    // salvar só o que foi mexido também funciona: o resto completa com zero
    const partial = sanitizeTouchPositions({ jump: { x: 10, y: 20 } });
    assert.deepEqual(partial.jump, { x: 10, y: 20 });
    assert.deepEqual(partial.pause, { x: 0, y: 0 });
    assert.deepEqual(sanitizeTouchPositions(null), emptyTouchPositions(), 'nada salvo = tudo zero');

    // JSON inválido e storage bloqueado devolvem o padrão, sem lançar
    const broken = fakeStorage({ [TOUCH_POSITIONS_KEY]: '{não é json' });
    assert.deepEqual(loadTouchPositions(broken), emptyTouchPositions());
    const blocked = {
        getItem() { throw new Error('bloqueado'); },
        setItem() { throw new Error('bloqueado'); },
        removeItem() { throw new Error('bloqueado'); },
    };
    assert.deepEqual(loadTouchPositions(blocked), emptyTouchPositions());
    assert.deepEqual(saveTouchPositions({ jump: { x: 5, y: 5 } }, blocked).jump, { x: 5, y: 5 });
    assert.deepEqual(resetTouchPositions(blocked), emptyTouchPositions());
});

test('restaurar apaga o que foi arrastado', () => {
    const storage = fakeStorage();
    const positions = emptyTouchPositions();
    positions.use = { x: -30, y: 10 };
    saveTouchPositions(positions, storage);
    assert.equal(hasCustomPositions(loadTouchPositions(storage)), true);
    assert.deepEqual(resetTouchPositions(storage), emptyTouchPositions());
    assert.equal(loadTouchPositions(storage).use.x, 0, 'storage vazio depois do restaurar');
});

// --- conversões ---------------------------------------------------------

test('porcentagem e pixel andam juntos, e girar a tela não perde a peça', () => {
    assert.deepEqual(offsetPixels({ x: 50, y: -25 }, { width: 400, height: 800 }), { x: 200, y: -200 });
    assert.deepEqual(offsetPercent({ x: 200, y: -200 }, { width: 400, height: 800 }), { x: 50, y: -25 });
    // ida e volta na %: o que foi arrastado é o que é gravado
    const percent = offsetPercent({ x: -133, y: 77 }, { width: 390, height: 844 });
    const back = offsetPixels(percent, { width: 390, height: 844 });
    assert.ok(Math.abs(back.x + 133) < 0.5 && Math.abs(back.y - 77) < 0.5);
    // mesma % em tela maior = mesmo lugar relativo
    assert.deepEqual(offsetPixels(percent, { width: 780, height: 1688 }), { x: back.x * 2, y: back.y * 2 });
    // tela sem tamanho ou número estranho não vira NaN
    assert.deepEqual(offsetPixels({ x: 10, y: 10 }, { width: 0, height: 0 }), { x: 0, y: 0 });
    assert.deepEqual(offsetPercent({ x: NaN, y: 'x' }, { width: 400, height: 800 }), { x: 0, y: 0 });
});

// --- clamp --------------------------------------------------------------

test('a peça arrastada não sai da tela', () => {
    // botão de 64 px encostado no canto inferior direito de 390x844
    const piece = {
        naturalLeft: 390 - 14 - 64, naturalTop: 844 - 20 - 64,
        width: 64, height: 64, viewportWidth: 390, viewportHeight: 844,
    };
    // tentar sair pela direita/baixo: preso na margem
    assert.deepEqual(
        clampOffsetPx({ ...piece, offsetX: 500, offsetY: 500 }),
        { x: 390 - TOUCH_EDIT_MARGIN - piece.naturalLeft - 64, y: 844 - TOUCH_EDIT_MARGIN - piece.naturalTop - 64 },
    );
    // tentar sair pela esquerda/cima: preso na margem do outro lado
    assert.deepEqual(
        clampOffsetPx({ ...piece, offsetX: -5000, offsetY: -5000 }),
        { x: TOUCH_EDIT_MARGIN - piece.naturalLeft, y: TOUCH_EDIT_MARGIN - piece.naturalTop },
    );
    // dentro da tela, o arrasto é respeitado
    assert.deepEqual(clampOffsetPx({ ...piece, offsetX: -100, offsetY: -80 }), { x: -100, y: -80 });
    // peça maior que a tela: cola no mínimo em vez de virar valor invertido
    const huge = clampOffsetPx({ naturalLeft: 0, naturalTop: 0, width: 900, height: 900, viewportWidth: 390, viewportHeight: 844, offsetX: 10, offsetY: 10 });
    assert.ok(Number.isFinite(huge.x) && Number.isFinite(huge.y));
    assert.equal(huge.x, TOUCH_EDIT_MARGIN);
    // lixo não vira NaN
    assert.deepEqual(clampOffsetPx(), { x: TOUCH_EDIT_MARGIN, y: TOUCH_EDIT_MARGIN });
});

// --- tela e fiação ------------------------------------------------------

test('a tela de opções tem a linha Editar posições, só dentro do mundo', () => {
    const start = dialog.lastIndexOf('<button', dialog.indexOf('id="opt-touch-edit"'));
    const block = dialog.slice(start, dialog.indexOf('</button>', start));
    assert.match(block, /class="classic-btn option-btn"/);
    assert.match(block, /aria-label="Editar posições"/);
    assert.ok(block.includes('<span class="option-name">Editar posições</span>'));
    // não é barra nem mostra valor: é um botão que abre o modo de edição
    assert.doesNotMatch(block, /option-track|option-knob|option-value/);

    // o jogo marca o body no modo toque; a linha só aparece lá
    assert.match(view, /import \{ TOUCH_EDIT_EVENT, TOUCH_RESET_EVENT, resetTouchPositions \} from '\.\/world-touch-positions\.js';/);
    assert.match(view, /const canEditPositions = \(\) => document\.body\.classList\.contains\('touch-mode'\);/);
    assert.match(view, /if \(editButton\) editButton\.hidden = target !== 'touch' \|\| !canEditPositions\(\);/);
    assert.match(view, /document\.dispatchEvent\(new CustomEvent\(TOUCH_EDIT_EVENT\)\);/);
});

test('Restaurar padrões também devolve os controles ao lugar', () => {
    assert.match(view, /resetTouchPositions\(\);\n {8}document\.dispatchEvent\(new CustomEvent\(TOUCH_RESET_EVENT\)\);/);
});

test('o jogo aplica o deslocamento como variável, somada ao layout', () => {
    assert.match(game, /import \{\n {4}TOUCH_EDIT_EVENT, TOUCH_EDIT_MARGIN, TOUCH_PIECES, TOUCH_RESET_EVENT,\n {4}clampOffsetPx, emptyTouchPositions, loadTouchPositions, offsetPercent, offsetPixels,\n {4}saveTouchPositions,\n\} from '\.\/world-touch-positions\.js';/);
    const apply = sliceFn(game, 'applyTouchPositions');
    assert.match(apply, /el\.style\.setProperty\('--touch-dx', `\$\{offset\.x\.toFixed\(1\)\}px`\);/);
    assert.match(apply, /el\.style\.setProperty\('--touch-dy', `\$\{offset\.y\.toFixed\(1\)\}px`\);/);
    // aplica ao entrar no mundo, ao girar a tela e ao voltar de uma edição
    assert.match(game, /applyTouchPositions\(\);\n\n\/\/ A tela de opções mora em outro módulo/);
    assert.match(game, /window\.addEventListener\('resize', applyTouchPositions\);/);
});

test('o arrasto é preso na tela e grava em % a cada solta', () => {
    const begin = sliceFn(game, 'beginPieceDrag');
    assert.match(begin, /if \(!touchEditing\) return false;/);
    assert.match(begin, /getBoundingClientRect\(\)/);
    // o retângulo natural é medido descontando o deslocamento atual
    assert.match(begin, /touchDrag\.natural = \{ left: rect\.left - offset\.x, top: rect\.top - offset\.y \};/);

    const move = sliceFn(game, 'movePieceDrag');
    assert.match(move, /clampOffsetPx\(\{/);
    assert.match(move, /touchPositions\[touchDrag\.piece\] = offsetPercent\(next, viewport\);/);

    const end = sliceFn(game, 'endPieceDrag');
    assert.match(end, /touchPositions = saveTouchPositions\(touchPositions\);/);
});

test('o modo de edição pausa o jogo, mostra a barra e não deixa jogar', () => {
    const set = sliceFn(game, 'setTouchEditing');
    assert.match(set, /if \(on && playing\(\)\) return;/, 'editar é da pausa, não do meio do jogo');
    assert.match(set, /document\.body\.classList\.toggle\('touch-editing', on\);/);
    assert.match(set, /resetInputFlags\(\);/, 'nada fica apertado ao entrar ou sair');
    assert.match(set, /syncPauseMenu\(\);/);

    // a UI de toque aparece mesmo pausado — é ela que se arrasta
    const sync = sliceFn(game, 'syncTouchUi');
    assert.match(sync, /const visible = touchMode && \(touchActive \|\| touchEditing\) && !inventoryOpen && !dead;/);
    assert.match(sync, /if \(editBar\) editBar\.hidden = !touchEditing;/);
    assert.match(sync, /if \(touchEditing\) return;/, 'sem a dica de jogar enquanto edita');

    // nada do jogo responde ao dedo durante a edição
    assert.match(game, /if \(touchEditing\) return; \/\/ editando, o dedo move a peça, não o jogador/);
    assert.match(game, /if \(touchEditing\) return; \/\/ o fundo não faz nada enquanto se arrasta peças/);
    assert.match(game, /if \(touchEditing\) return; \/\/ editando, o botão é peça e não ação/);
});

test('entrar e sair da edição passa por evento, com Pronto e Restaurar', () => {
    assert.match(game, /document\.addEventListener\(TOUCH_EDIT_EVENT, \(\) => setTouchEditing\(true\)\);/);
    assert.match(game, /document\.addEventListener\(TOUCH_RESET_EVENT, \(\) => \{\n {4}touchPositions = loadTouchPositions\(\);/);
    // barra da edição no HTML, escondida fora do modo
    assert.match(html, /<div id="touch-edit-bar" hidden>/);
    assert.match(html, /<button class="classic-btn touch-edit-btn" type="button" id="btn-touch-positions-reset">Restaurar<\/button>/);
    assert.match(html, /<button class="classic-btn touch-edit-btn" type="button" id="btn-touch-positions-done">Pronto<\/button>/);
    assert.match(game, /getElementById\('btn-touch-positions-done'\)\?\.addEventListener\('click', \(\) => setTouchEditing\(false\)\);/);
    const reset = game.slice(game.indexOf("getElementById('btn-touch-positions-reset')"),
        game.indexOf("// Hotbar: no toque não existe roda do mouse"));
    assert.match(reset, /touchPositions = emptyTouchPositions\(\);/);
    assert.match(reset, /applyTouchPositions\(\);/);
    // o mesmo nome de evento nas duas pontas: quem pede e quem atende
    assert.ok(game.includes('document.addEventListener(TOUCH_EDIT_EVENT'));
    assert.ok(view.includes('new CustomEvent(TOUCH_EDIT_EVENT)'));
    assert.ok(game.includes('document.addEventListener(TOUCH_RESET_EVENT'));
    assert.ok(view.includes('new CustomEvent(TOUCH_RESET_EVENT)'));
});

test('o CSS soma o deslocamento ao layout sem perder o "apertado"', () => {
    assert.match(css, /#touch-stick \{[^}]*transform: translate\(var\(--touch-dx, 0px\), var\(--touch-dy, 0px\)\);/);
    assert.match(css, /#touch-ui \.touch-btn \{ transform: translate\(var\(--touch-dx, 0px\), var\(--touch-dy, 0px\)\); \}/);
    // o seletor com # ganha do .classic-btn:active (senão o botão voltaria ao lugar no toque)
    assert.match(css, /#touch-ui \.touch-btn\.pressed, #touch-ui \.touch-btn:active \{\n {8}transform: translate\(var\(--touch-dx, 0px\), var\(--touch-dy, 0px\)\) translateY\(1px\); \}/);
    // o menu de pausa sai da frente e a tela escurece
    assert.match(css, /body\.touch-editing #menu \{ pointer-events: none; background-color: transparent;/);
    assert.match(css, /body\.touch-editing \.pause-card \{ display: none; \}/);
    assert.match(css, /body\.touch-editing #touch-ui \{ z-index: 11; background: rgba\(0, 0, 0, \.45\); \}/);
    assert.match(css, /body\.touch-editing #touch-stick,\n {4}body\.touch-editing #touch-ui \.touch-btn \{\n {8}outline: 2px dashed/);
    assert.match(css, /#touch-edit-bar\[hidden\] \{ display: none; \}/);
});
