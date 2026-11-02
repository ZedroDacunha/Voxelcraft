import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { keyToSlotAction, nextSlotIndex, slotLabel, statusLabels } from '../inventory-a11y.js';
import { HUNGER_LOW } from '../world-survival-rules.js';
import { ID, ITEMS } from '../world-catalog.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const gameSource = read('game.js');
const htmlSource = read('index.html');
const inventoryCss = read('inventory.css');
const styles = read('styles.css');

const myItems = {
    1: { name: 'Tocha' },
    2: { name: 'Picareta de pedra', maxDurability: 132 },
};

test('slot vazio tem rótulo "Vazio"', () => {
    assert.equal(slotLabel(null), 'Vazio');
    assert.equal(slotLabel(undefined), 'Vazio');
    assert.equal(slotLabel({ id: ID.APPLE, count: 0 }), 'Vazio');
});

test('slot com um item usa só o nome', () => {
    assert.equal(slotLabel({ id: 1, count: 1 }, myItems), 'Tocha');
    assert.equal(slotLabel({ id: ID.APPLE, count: 1 }), 'Maçã');
});

test('pilha informa a quantidade', () => {
    assert.equal(slotLabel({ id: 1, count: 7 }, myItems), 'Tocha, 7 unidades');
    assert.equal(slotLabel({ id: ID.APPLE, count: 64 }), 'Maçã, 64 unidades');
});

test('ferramenta danificada informa a durabilidade restante', () => {
    assert.equal(slotLabel({ id: 2, count: 1, damage: 0 }, myItems), 'Picareta de pedra');
    assert.equal(slotLabel({ id: 2, count: 1, damage: 66 }, myItems), 'Picareta de pedra, 50% de durabilidade');
    assert.equal(slotLabel({ id: 2, count: 1, damage: 132 }, myItems), 'Picareta de pedra, 0% de durabilidade');
});

test('durabilidade nunca sai de 0–100', () => {
    assert.match(slotLabel({ id: 2, count: 1, damage: 999 }, myItems), /, 0% de durabilidade$/);
    assert.match(slotLabel({ id: 2, count: 1, damage: 150 }, myItems), /, 0% de durabilidade$/);
    // dano negativo não é dano: a ferramenta continua inteira e sem sufixo
    assert.equal(slotLabel({ id: 2, count: 1, damage: -50 }, myItems), 'Picareta de pedra');
});

test('item desconhecido ainda tem rótulo legível', () => {
    assert.equal(slotLabel({ id: 999, count: 1 }, myItems), 'Item');
    assert.equal(slotLabel({ id: 999, count: 3 }, myItems), 'Item, 3 unidades');
});

test('catálogo real nomeia um item de cada tipo', () => {
    const toolId = Object.keys(ITEMS).find(id => ITEMS[id].maxDurability);
    assert.ok(toolId, 'o catálogo precisa ter alguma ferramenta');
    const label = slotLabel({ id: Number(toolId), count: 1, damage: Math.floor(ITEMS[toolId].maxDurability / 2) });
    assert.match(label, /% de durabilidade$/);
    assert.ok(!label.includes('Item'), `rótulo genérico inesperado: ${label}`);
});

test('setas andam dentro da linha e param na borda', () => {
    const grid = { total: 36, columns: 9 };
    assert.equal(nextSlotIndex({ index: 0, key: 'ArrowRight', ...grid }), 1);
    assert.equal(nextSlotIndex({ index: 0, key: 'ArrowLeft', ...grid }), null);
    assert.equal(nextSlotIndex({ index: 8, key: 'ArrowRight', ...grid }), null);
    assert.equal(nextSlotIndex({ index: 4, key: 'ArrowDown', ...grid }), 13);
    assert.equal(nextSlotIndex({ index: 4, key: 'ArrowUp', ...grid }), null);
    assert.equal(nextSlotIndex({ index: 31, key: 'ArrowDown', ...grid }), null);
});

test('Home e End vão para as pontas da grade', () => {
    const grid = { total: 9, columns: 9 };
    assert.equal(nextSlotIndex({ index: 5, key: 'Home', ...grid }), 0);
    assert.equal(nextSlotIndex({ index: 5, key: 'End', ...grid }), 8);
    assert.equal(nextSlotIndex({ index: 0, key: 'Home', ...grid }), null);
    assert.equal(nextSlotIndex({ index: 8, key: 'End', ...grid }), null);
});

test('grade de criação 2x2 e 3x3 andam pela linha certa', () => {
    assert.equal(nextSlotIndex({ index: 1, key: 'ArrowDown', total: 4, columns: 2 }), 3);
    assert.equal(nextSlotIndex({ index: 2, key: 'ArrowUp', total: 4, columns: 2 }), 0);
    // 3x3 com o 2x2 escondido (4 slots visíveis) não cai em slot oculto
    assert.equal(nextSlotIndex({ index: 1, key: 'ArrowDown', total: 4, columns: 2 }), 3);
    assert.equal(nextSlotIndex({ index: 3, key: 'ArrowRight', total: 4, columns: 2 }), null);
});

test('grade de um único slot não anda', () => {
    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
        assert.equal(nextSlotIndex({ index: 0, key, total: 1, columns: 1 }), null, key);
    }
});

test('posições inválidas devolvem null em vez de quebrar', () => {
    assert.equal(nextSlotIndex({ index: -1, key: 'ArrowRight', total: 9, columns: 9 }), null);
    assert.equal(nextSlotIndex({ index: 9, key: 'ArrowRight', total: 9, columns: 9 }), null);
    assert.equal(nextSlotIndex({ index: 0, key: 'ArrowRight', total: 0, columns: 9 }), null);
    assert.equal(nextSlotIndex({ index: 0.5, key: 'ArrowRight', total: 9, columns: 9 }), null);
    assert.equal(nextSlotIndex(), null);
    assert.equal(nextSlotIndex({ index: 0, total: 9, columns: 9, key: 'a' }), null);
});

test('colunas maiores que o total são limitadas ao total', () => {
    // grade de resultado do forno: 1 slot, devolver null é o comportamento certo
    assert.equal(nextSlotIndex({ index: 0, key: 'ArrowRight', total: 1, columns: 9 }), null);
});

test('Enter e Espaço mapeiam para clique esquerdo e direito', () => {
    assert.deepEqual(keyToSlotAction('Enter'), { button: 0, shiftKey: false });
    assert.deepEqual(keyToSlotAction(' '), { button: 2, shiftKey: false });
    assert.deepEqual(keyToSlotAction('Spacebar'), { button: 2, shiftKey: false });
});

test('Shift + Enter/Espaço vira movimento rápido', () => {
    assert.deepEqual(keyToSlotAction('Enter', { shiftKey: true }), { button: 0, shiftKey: true });
    assert.deepEqual(keyToSlotAction(' ', { shiftKey: true }), { button: 0, shiftKey: true });
});

test('outras teclas não ativam slot', () => {
    for (const key of ['a', 'Tab', 'Escape', 'ArrowRight', 'e']) {
        assert.equal(keyToSlotAction(key), null, key);
    }
});

test('barras de status têm texto com valor e máximo', () => {
    const labels = statusLabels({ health: 14, hunger: 9, breath: 20 });
    assert.equal(labels.health, 'Vida: 14 de 20');
    assert.equal(labels.hunger, 'Fome: 9 de 20');
    assert.equal(labels.breath, 'Fôlego: 20 de 20');
    assert.match(labels.summary, /^Vida 14 de 20\. Fome 9 de 20\. Fôlego 20 de 20\.$/);
});

test('fome baixa e zerada avisam no rótulo', () => {
    assert.doesNotMatch(statusLabels({ hunger: HUNGER_LOW + 1 }).hunger, /fome baixa/);
    assert.match(statusLabels({ hunger: HUNGER_LOW }).hunger, /\(fome baixa\)/);
    assert.match(statusLabels({ hunger: 0 }).hunger, /perdendo vida/);
});

test('rótulos arredondam e prendem valores na faixa válida', () => {
    assert.equal(statusLabels({ health: 13.6, hunger: -3, breath: 99 }).health, 'Vida: 14 de 20');
    assert.equal(statusLabels({ health: 13.6, hunger: -3, breath: 99 }).hunger, 'Fome: 0 de 20 (fome zerada, você está perdendo vida)');
    assert.equal(statusLabels({ breath: 99 }).breath, 'Fôlego: 20 de 20');
    assert.equal(statusLabels({}).health, 'Vida: 0 de 20');
    assert.equal(statusLabels({ health: 10, maxHealth: 30 }).health, 'Vida: 10 de 30');
});

test('slots do inventário são células de grade focáveis com nome', () => {
    assert.match(gameSource, /setAttribute\('role', 'gridcell'\)/);
    assert.match(gameSource, /setAttribute\('aria-label', 'Vazio'\)/);
    assert.match(gameSource, /el\.tabIndex = -1/);
    assert.match(gameSource, /refreshSlot\(el, stack\)/);
});

test('grades do inventário declaram colunas e rótulo', () => {
    assert.match(gameSource, /markGrid\(main, 9, 'Inventário'\)/);
    assert.match(gameSource, /markGrid\(bar, 9, 'Barra rápida'\)/);
    assert.match(gameSource, /markGrid\(out, 1, 'Resultado da criação'\)/);
    assert.match(gameSource, /dataset\.columns = String\(craftN\)/);
});

test('teclado do inventário é ligado ao overlay e usa o módulo puro', () => {
    assert.match(gameSource, /overlay\.addEventListener\('keydown', onInventoryKeyDown\)/);
    assert.match(gameSource, /nextSlotIndex\(\{/);
    assert.match(gameSource, /keyToSlotAction\(event\.key/);
    assert.match(gameSource, /activateSlot\(el, action\)/);
    assert.match(gameSource, /resetRovingTabIndex\(\)/);
    // abrir com E leva o foco para o primeiro slot da grade
    assert.match(gameSource, /openInventory\(null, \{ focusFirst: true \}\)/);
    assert.match(gameSource, /if \(focusFirst\) \{\s*\n\s*const first = document\.querySelector\('#inv-main \.islot'\);/);
});

test('barras da HUD e hotbar recebem rótulo textual', () => {
    assert.match(gameSource, /setAriaLabel\(healthBar, labels\.health\)/);
    assert.match(gameSource, /setAriaLabel\(hungerBar, labels\.hunger\)/);
    assert.match(gameSource, /setAriaLabel\(breathBar, statusLabels/);
    assert.match(gameSource, /\(selecionado\)/);
});

test('tela de morte recebe o foco ao aparecer', () => {
    assert.match(gameSource, /deathEl\.style\.display = 'flex';\s*\n\s*deathEl\.focus\(\);/);
    assert.match(gameSource, /deathEl\.contains\(document\.activeElement\).*btn\.focus\(\)/s);
});

test('HTML marca os elementos para leitores de tela', () => {
    assert.match(htmlSource, /id="toast" role="status" aria-live="polite"/);
    assert.match(htmlSource, /id="death" role="alertdialog"/);
    assert.match(htmlSource, /id="inventory" role="dialog" aria-labelledby="inv-title"/);
    assert.match(htmlSource, /id="health-bar" role="img" aria-label="Vida/);
    assert.match(htmlSource, /id="hunger-bar" role="img" aria-label="Fome/);
    assert.match(htmlSource, /id="breath-bar" role="img" aria-label="Fôlego/);
});

test('foco de teclado nos slots é visível', () => {
    assert.match(inventoryCss, /\.islot:focus-visible \{[^}]*outline: 2px solid/);
});

test('quem pediu menos animação não recebe pulinho no slot ativo', () => {
    const block = styles.slice(styles.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(block, /\.slot\.active \{ transform: none; \}/);
});
