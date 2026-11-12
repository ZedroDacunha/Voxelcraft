import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
test('opção no menu gráfico começa oculta até carregar o jogo', () => {
    const html = read('index.html');
    assert.match(html, /id="options-graphics-grid"[\s\S]*?id="opt-debug" aria-pressed="false" hidden/);
    assert.match(read('game.js'), /if \(debugOption\) debugOption\.hidden = false/);
    assert.match(read('styles.css'), /#opt-debug\[hidden\]\s*\{\s*display:\s*none/);
});
test('F3 e opção compartilham estado, acessibilidade e reinício', () => {
    const src = read('game.js');
    assert.match(src, /debugOption\?\.addEventListener\('click', \(\) => setDebugVisible\(!debugVisible\)\)/);
    assert.match(src, /case 'F3':[\s\S]*?setDebugVisible\(!debugVisible\)/);
    assert.match(src, /setAttribute\('aria-pressed', String\(visible\)\)/);
    assert.match(src, /debugFrameSamples\.reset\(\)/);
});
test('toque usa resumo compacto não interativo', () => {
    const src = read('game.js'), css = read('styles.css');
    assert.match(src, /classList\.contains\('touch-mode'\)[\s\S]*?Filas: geração/);
    assert.match(css, /#debug\s*\{[^}]*pointer-events:\s*none/);
    assert.match(css, /body\.touch-mode #debug\s*\{[^}]*max-width:[^}]*white-space:\s*pre-wrap/);
});
