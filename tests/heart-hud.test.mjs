import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
function image(selector) {
    const rule = css.split(selector + ' {')[1]?.split('}')[0];
    assert.ok(rule, `regra ${selector}`);
    const encoded = rule.match(/data:image\/svg\+xml;base64,([^"\)]+)/)?.[1];
    assert.ok(encoded, `imagem ${selector}`);
    return Buffer.from(encoded, 'base64').toString('utf8');
}
test('corações do HUD têm imagens pixeladas para os três estados', () => {
    const images = ['.heart', '.heart.half', '.heart.empty-stat'].map(image);
    for (const svg of images) {
        assert.match(svg, /viewBox="0 0 13 13"/);
        assert.match(svg, /shape-rendering="crispEdges"/);
    }
    assert.equal(new Set(images).size, 3);
    const positions = svg => [...svg.matchAll(/<rect x="(\d+)" y="(\d+)"/g)].map(m => `${m[1]},${m[2]}`);
    assert.deepEqual(positions(images[0]), positions(images[1]));
    assert.deepEqual(positions(images[0]), positions(images[2]));
    assert.match(css, /\.heart\.empty-stat\s*\{[^}]*border:\s*0/);
    assert.match(game, /updateSurvivalIcons\(survivalIcons\.hearts, 'heart', Math\.ceil\(health\)\)/);
});
