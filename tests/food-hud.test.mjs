import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
function rule(selector) {
    const value = css.split(selector + ' {')[1]?.split('}')[0];
    assert.ok(value, `regra ${selector}`);
    return value;
}
function image(selector) {
    const encoded = rule(selector).match(/data:image\/svg\+xml;base64,([^"\)]+)/)?.[1];
    assert.ok(encoded, `imagem ${selector}`);
    return Buffer.from(encoded, 'base64').toString('utf8');
}
test('pão de fome tem três estados pixelados com a mesma silhueta', () => {
    const images = ['.food', '.food.half', '.food.empty-stat'].map(image);
    for (const svg of images) {
        assert.match(svg, /viewBox="0 0 21 16"/);
        assert.match(svg, /shape-rendering="crispEdges"/);
    }
    assert.equal(new Set(images).size, 3);
    const positions = svg => [...svg.matchAll(/<rect x="(\d+)" y="(\d+)"/g)].map(m => `${m[1]},${m[2]}`);
    assert.deepEqual(positions(images[0]), positions(images[1]));
    assert.deepEqual(positions(images[0]), positions(images[2]));
    assert.match(rule('.food.empty-stat'), /border:\s*0/);
    assert.match(game, /updateSurvivalIcons\(survivalIcons\.food, 'food', hunger\)/);
});
test('aviso de fome zerada preserva a imagem e o movimento reduzido', () => {
    const starving = rule('#hunger-bar.starving .food');
    assert.match(starving, /animation:\s*hunger-warn/);
    assert.match(starving, /filter:/);
    assert.doesNotMatch(starving, /background\s*:/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
