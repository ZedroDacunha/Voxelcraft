import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { craftGridTemplateColumns } from '../inventory-layout.js';

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const inventoryCss = readFileSync(new URL('../inventory.css', import.meta.url), 'utf8');
const gameSource = readFileSync(new URL('../game.js', import.meta.url), 'utf8');

test('grade de criação usa a variável responsável de slot', () => {
    assert.equal(craftGridTemplateColumns(2), 'repeat(2, var(--inv-slot-size))');
    assert.equal(craftGridTemplateColumns(3), 'repeat(3, var(--inv-slot-size))');
});

test('grade de criação rejeita número inválido de colunas', () => {
    assert.throws(() => craftGridTemplateColumns(0), RangeError);
    assert.throws(() => craftGridTemplateColumns(2.5), RangeError);
    assert.throws(() => craftGridTemplateColumns('2'), RangeError);
});

test('HUD define escala responsiva para slots e status', () => {
    assert.match(styles, /--hud-slot-size:\s*clamp\(/);
    assert.match(styles, /--inv-slot-size:\s*clamp\(/);
    assert.match(styles, /#hotbar\s*\{[^}]*gap:\s*var\(--hud-slot-gap\)/);
    assert.match(styles, /\.slot\s*\{[^}]*width:\s*var\(--hud-slot-size\)/);
    assert.match(styles, /\.heart\s*\{[^}]*width:\s*var\(--stat-size\)/);
});

test('HUD inicial fica oculta enquanto título ou seleção de mundos estão ativos', () => {
    assert.match(styles, /#title-screen:not\(\[hidden\]\) ~ #hud-bottom/);
    assert.match(styles, /#world-menu:not\(\[hidden\]\) ~ #hud-bottom/);
});

test('diálogos de mundo usam border-box e largura limitada pela viewport', () => {
    assert.match(styles, /\.world-dialog\s*\{[^}]*box-sizing:\s*border-box/);
    assert.match(styles, /\.world-dialog\s*\{[^}]*max-width:\s*calc\(100vw - 32px\)/);
    assert.match(styles, /\.world-dialog-actions\s*\{[^}]*flex-wrap:\s*wrap/);
});

test('inventário usa slots responsivos e painel com altura rolável', () => {
    assert.match(inventoryCss, /\.inv-grid\s*\{[^}]*repeat\(9, var\(--inv-slot-size\)\)/);
    assert.match(inventoryCss, /\.islot\s*\{[^}]*width:\s*var\(--inv-slot-size\)/);
    assert.match(inventoryCss, /#inv-panel\s*\{[^}]*max-height:\s*calc\(100dvh - 24px\)/);
    assert.match(inventoryCss, /#inv-panel\s*\{[^}]*overflow-y:\s*auto/);
});

test('game.js não fixa mais a grade de criação em 44px', () => {
    assert.match(gameSource, /craftGridTemplateColumns\(craftN\)/);
    assert.doesNotMatch(gameSource, /repeat\(\$\{craftN\}, 44px\)/);
});
