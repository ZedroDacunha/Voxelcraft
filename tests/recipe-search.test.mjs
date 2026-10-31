import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    createRecipeSearchIndex,
    filterRecipeSearch,
    normalizeRecipeSearchText,
} from '../inventory-recipe-search.js';

const craftingSection = { id: 'crafting' };
const smeltingSection = { id: 'smelting' };
const fuelSection = { id: 'fuel' };

function makeIndex() {
    return createRecipeSearchIndex([
        {
            entry: { id: 'door' },
            section: craftingSection,
            text: '3× Porta de carvalho · 6× Tábuas de carvalho · Bancada 3×3',
        },
        {
            entry: { id: 'pickaxe' },
            section: craftingSection,
            text: '1× Picareta de ferro · 3× Ferro · 2× Graveto · Bancada 3×3',
        },
        {
            entry: { id: 'iron-ingot' },
            section: smeltingSection,
            text: 'Minério de ferro · 1× Barra de ferro · Fornalha · 10s',
        },
        {
            entry: { id: 'coal' },
            section: fuelSection,
            text: 'Carvão · 80s · Combustível para fornalha',
        },
    ]);
}

test('normalização remove acentos, caixa e espaços repetidos', () => {
    assert.equal(normalizeRecipeSearchText('  MaÇÃ   Fornalha  '), 'maca fornalha');
    assert.equal(normalizeRecipeSearchText('PORTA\tde\nCarvalho'), 'porta de carvalho');
});

test('valores ausentes viram texto vazio sem lançar', () => {
    assert.equal(normalizeRecipeSearchText(null), '');
    assert.equal(normalizeRecipeSearchText(undefined), '');
});

test('busca vazia mostra todas as entradas e seções', () => {
    const index = makeIndex();
    const result = filterRecipeSearch(index, '   ');
    assert.equal(result.hasResults, true);
    assert.equal(result.visibleEntries.size, 4);
    assert.deepEqual([...result.visibleSections], [craftingSection, smeltingSection, fuelSection]);
});

test('busca por resultado encontra a receita mesmo com acento e caixa diferentes', () => {
    const result = filterRecipeSearch(makeIndex(), '  PORTA  ');
    assert.equal(result.hasResults, true);
    assert.deepEqual([...result.visibleEntries].map(entry => entry.id), ['door']);
    assert.deepEqual([...result.visibleSections], [craftingSection]);
});

test('busca por ingrediente também encontra receitas', () => {
    const result = filterRecipeSearch(makeIndex(), 'tabuas');
    assert.deepEqual([...result.visibleEntries].map(entry => entry.id), ['door']);
});

test('vários termos precisam aparecer, mas podem estar em qualquer ordem', () => {
    const index = makeIndex();
    assert.deepEqual(
        [...filterRecipeSearch(index, 'carvalho porta').visibleEntries].map(entry => entry.id),
        ['door'],
    );
    assert.deepEqual(
        [...filterRecipeSearch(index, 'porta carvalho').visibleEntries].map(entry => entry.id),
        ['door'],
    );
    assert.equal(filterRecipeSearch(index, 'porta ferro').hasResults, false);
});

test('sem correspondência nenhum conjunto fica visível', () => {
    const result = filterRecipeSearch(makeIndex(), 'diamante');
    assert.equal(result.hasResults, false);
    assert.equal(result.visibleEntries.size, 0);
    assert.equal(result.visibleSections.size, 0);
});

test('seção só fica visível quando alguma entrada dela corresponde', () => {
    const result = filterRecipeSearch(makeIndex(), 'fornalha');
    assert.deepEqual([...result.visibleEntries].map(entry => entry.id), ['iron-ingot', 'coal']);
    assert.equal(result.visibleSections.has(craftingSection), false);
    assert.equal(result.visibleSections.has(smeltingSection), true);
    assert.equal(result.visibleSections.has(fuelSection), true);
});

test('filtrar não muta o índice nem as referências de interface', () => {
    const index = makeIndex();
    const before = index.map(record => ({ ...record }));
    filterRecipeSearch(index, 'porta');
    assert.deepEqual(index, before);
    assert.equal(index[0].entry.hidden, undefined);
    assert.equal(craftingSection.hidden, undefined);
});

test('livro de receitas usa o módulo de busca e o estado vazio centralizado', () => {
    const source = readFileSync(new URL('../inventory-recipe-book.js', import.meta.url), 'utf8');
    assert.match(source, /createRecipeSearchIndex/);
    assert.match(source, /filterRecipeSearch\(searchIndex, search\.value\)/);
    assert.match(source, /empty\.hidden = hasResults/);
    assert.doesNotMatch(source, /entry\.textContent\.toLocaleLowerCase/);
});

test('CSS oculta receitas marcadas com hidden mesmo quando usam grid', () => {
    const css = readFileSync(new URL('../inventory.css', import.meta.url), 'utf8');
    assert.match(css, /\.recipe-entry-craft\s*\{[^}]*display:\s*grid/);
    assert.match(css, /\.recipe-book\[hidden\],\s*\.recipe-book \[hidden\]\s*\{\s*display:\s*none;/);
});

test('campo de busca e mensagem vazia têm semântica acessível', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /id="recipe-search"[^>]*aria-label="Buscar receita ou item"/);
    assert.match(html, /id="recipe-search"[^>]*aria-controls="inv-recipes"/);
    assert.match(html, /id="recipe-empty"[^>]*role="status"/);
});
