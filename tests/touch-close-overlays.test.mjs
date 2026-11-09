import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../inventory.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');

test('inventário, bancada, forno e baú compartilham botão de fechar acessível', () => {
    assert.match(html, /<div id="inventory"[\s\S]*?<button id="inv-close"[^>]*type="button"[^>]*aria-label="Fechar inventário ou estação"/);
    assert.match(game, /getElementById\('inv-close'\)\.addEventListener\('click', \(\) => \{\s*\/\/[^\n]*\n\s*restoreTouchFullscreen\(\);\s*closeInventory\(true\);/);
    assert.match(game, /function closeInventory\(relock\)[\s\S]*?giveBack\(cursorHeld\.stack\)/);
    assert.match(game, /function closeInventory\(relock\)[\s\S]*?giveBack\(craftInv\.slots\[i\]\)/);
    assert.match(game, /function closeInventory\(relock\)[\s\S]*?setChestOpen\(station\.chestKey, false\)/);
    assert.match(css, /\.inv-titlebar \{ position: sticky; top: 0/);
    assert.match(styles, /\.overlay-close \{[^}]*width: 44px; height: 44px/);
});

test('chat pode ser fechado sem enviar; livro de receitas mantém saída própria', () => {
    assert.match(html, /<button id="chat-close"[^>]*type="button"[^>]*aria-label="Fechar chat"/);
    assert.match(html, /<button id="recipe-book-close"[^>]*aria-label="Fechar livro de receitas"/);
    assert.match(game, /getElementById\('chat-close'\)\.addEventListener\('click', \(\) => \{\s*restoreTouchFullscreen\(\);\s*closeChat\(\);/);
    assert.match(game, /getElementById\('recipe-book-close'\)\.addEventListener\('click', \(\) => setRecipeBookOpen\(false\)\)/);
    assert.match(css, /body\.touch-mode \.recipe-book-close \{ width: 44px; height: 44px/);
    assert.match(styles, /#chat-form\[hidden\] \{ display: none; \}/);
});

test('restauração de tela cheia ocorre somente em gesto de retorno e sem afetar desktop', () => {
    assert.match(game, /function restoreTouchFullscreen\(\) \{\s*if \(!touchActive \|\| document\.fullscreenElement \|\| touchStandalone\(\)\) return;\s*touchImmersive\.enter\(\)/);
    assert.match(game, /if \(!playing\(\) \|\| inventoryOpen \|\| chat\.open\) return;/);
    assert.match(game, /panel\.contains\(document\.activeElement\).*document\.activeElement\.blur\(\)/);
});
