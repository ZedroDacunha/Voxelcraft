import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAYER_MODEL_COLORS } from '../player-model.js';

test('a manga em primeira pessoa usa o verde da túnica do personagem', () => {
    const color = PLAYER_MODEL_COLORS.tunic;
    const rgb = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
    assert.deepEqual(rgb, [83, 107, 71]);
    const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(game, /import \{ createPlayerModel, PLAYER_MODEL_COLORS \} from '\.\/player-model\.js'/);
    assert.match(game, /handSleeve = new THREE\.Mesh\([\s\S]*?createNoiseTexture\(\[\s*\(PLAYER_MODEL_COLORS\.tunic >> 16\) & 255, \(PLAYER_MODEL_COLORS\.tunic >> 8\) & 255, PLAYER_MODEL_COLORS\.tunic & 255,\s*\], 11\)/);
    assert.match(game, /handBlock = new THREE\.Mesh\([\s\S]*?createNoiseTexture\(\[214, 166, 125\], 12, 8\)/);
});
