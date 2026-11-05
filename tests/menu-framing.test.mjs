import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sunDirectionAt } from '../world-sky.js';
import {
    MENU_CAMERA,
    MENU_SUN_TIME,
    MENU_TURN_SPEED,
    menuAngleAt,
    menuCameraPosition,
    menuStartAngle,
    menuSun,
    sunOnScreen,
} from '../menu-framing.js';

// ------------------------------------------------ a direção do sol (pura)

test('a direção do sol é unitária e sobe e desce com a hora do dia', () => {
    for (const t of [0, 0.1, 0.25, 0.4, 0.75]) {
        const d = sunDirectionAt(t);
        assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9, `unitária em ${t}`);
    }
    assert.ok(sunDirectionAt(0).y < 1e-9, 'na hora 0 o sol está no horizonte');
    assert.ok(sunDirectionAt(0.25).y > 0.94, 'na hora 0,25 está a pino');
    assert.ok(Math.abs(sunDirectionAt(0.5).y) < 0.05, 'na metade da volta está se pondo');
    assert.ok(sunDirectionAt(0.75).y < -0.9, 'e de madrugada está no fundo do poço');
    // A inclinação fixa em z é o que impede o sol de passar pelo zênite exato.
    assert.equal(sunDirectionAt(0).z, sunDirectionAt(0.25).z);
});

test('a direção do sol preenche um alvo, sem alocar a cada quadro', () => {
    const alvo = { x: 0, y: 0, z: 0 };
    const devolvido = sunDirectionAt(0.25, alvo);
    assert.equal(devolvido, alvo, 'devolve o mesmo objeto');
    assert.ok(alvo.y > 0.9, 'e escreveu nele');
});

// ------------------------------------------------ a hora do menu

test('o menu é fim de tarde: sol baixo, quase no horizonte', () => {
    const sun = menuSun();
    assert.ok(sun.y > 0, 'acima do horizonte (senão o sol não aparece)');
    assert.ok(sun.y < 0.1, `baixo o bastante para o céu ficar quente (${sun.y.toFixed(3)})`);
    assert.ok(Math.abs(Math.hypot(sun.x, sun.y, sun.z) - 1) < 1e-9, 'unitária');
    assert.ok(MENU_SUN_TIME > 0 && MENU_SUN_TIME < 0.02, 'hora de fim de tarde');
});

test('a câmera abre virada para o sol', () => {
    const sun = menuSun();
    const angle = menuStartAngle(sun);
    // A câmera fica no lado oposto ao sol: olhando de lá para a origem, o azimute
    // da vista é o do sol.
    const position = menuCameraPosition(0);
    assert.ok(Math.abs(Math.hypot(position.x, position.z) - MENU_CAMERA.radius) < 1e-9, 'no raio');
    const viewX = -position.x, viewZ = -position.z;
    const dot = (viewX * sun.x + viewZ * sun.z) / Math.hypot(viewX, viewZ);
    assert.ok(dot > 0.999, `vista apontando para o sol (${dot.toFixed(4)})`);
    assert.ok(Math.abs(angle - menuStartAngle(sun)) < 1e-12, 'e o ângulo é estável');
});

// ------------------------------------------------ o sol no quadro

test('o sol aparece no quadro em qualquer formato de tela', () => {
    for (const [w, h] of [[1920, 1080], [1600, 900], [1440, 900], [1024, 768], [2560, 1080], [390, 844], [844, 390]]) {
        const r = sunOnScreen({ width: w, height: h });
        assert.equal(r.visible, true, `sol visível em ${w}x${h} (y=${r.y?.toFixed(2)})`);
        assert.ok(r.y > 0.1 && r.y < 0.95, `e dentro, não colado na borda (${w}x${h}: y=${r.y.toFixed(2)})`);
        assert.ok(Math.abs(r.x - 0.5) < 0.02, `centralizado na horizontal (${w}x${h}: x=${r.x.toFixed(2)})`);
    }
});

test('o sol fica na metade de cima, acima da linha da ilha', () => {
    const r = sunOnScreen({ width: 1600, height: 900 });
    assert.ok(r.y < 0.5, `acima do meio do quadro (${r.y.toFixed(3)})`);
    assert.ok(r.elevation > 0, 'e acima do horizonte');
    // A câmera olha um pouco para baixo: é o que abre céu em cima da ilha.
    assert.ok(r.pitch > 0 && r.pitch < 5, `olhar quase rente (${r.pitch.toFixed(2)}°)`);
});

test('o enquadramento antigo não mostrava o sol (é por isso que mudou)', () => {
    const antigo = { height: 18.5, radius: 39, targetY: 5, fov: 43 };
    const r = sunOnScreen({ width: 1600, height: 900, camera: antigo, time: 0.06 });
    assert.equal(r.visible, false, 'com a ilha ocupando a tela, o sol ficava fora');
});

test('girando, o sol sai de quadro — mas não nos primeiros segundos', () => {
    const noInicio = sunOnScreen({ width: 1600, height: 900, now: 0 });
    assert.equal(noInicio.visible, true, 'começa em cena');
    // Quanto tempo até sair: o giro é lento, então tem de durar dezenas de segundos.
    let saiuEm = null;
    for (let s = 0; s <= 400; s += 1) {
        if (!sunOnScreen({ width: 1600, height: 900, now: s * 1000 }).visible) { saiuEm = s; break; }
    }
    assert.ok(saiuEm !== null, 'sai de quadro em algum momento');
    assert.ok(saiuEm > 20, `e demora o suficiente para não parecer bug (${saiuEm}s)`);
    const giro = MENU_TURN_SPEED * 1000;
    assert.ok(giro > 0 && giro < 0.05, 'giro lento, em rad/s');
});

test('com movimento reduzido, o sol fica parado em cena', () => {
    const a = sunOnScreen({ now: 0, reduced: true });
    const b = sunOnScreen({ now: 400000, reduced: true });
    assert.equal(a.visible, true);
    assert.equal(b.visible, true, 'sem giro, o sol nunca sai de quadro');
    assert.equal(menuAngleAt(0, { reduced: true }), menuAngleAt(99999, { reduced: true }));
});

// ------------------------------------------------ ligação com o menu

test('o menu usa a hora e o enquadramento testados aqui', () => {
    const source = readFileSync(new URL('../menu-background.js', import.meta.url), 'utf8');
    assert.match(source, /worldTime: MENU_SUN_TIME/, 'o céu recebe a hora do menu');
    assert.match(source, /menuCameraPosition\(now, \{ reduced: reduceMotion\.matches \}\)/,
        'a câmera vem do enquadramento testado');
    assert.ok(!/const radius = 39/.test(source), 'o enquadramento antigo saiu do arquivo');
    assert.ok(!/MENU_SUN_TIME = /.test(source), 'a hora do menu não é redefinida aqui');

    // Este arquivo só roda no navegador: nada aqui o importa, então um nome usado
    // e não importado passaria batido (já aconteceu com MENU_CAMERA).
    const importLine = /import \{([^}]+)\} from '\.\/menu-framing\.js';/.exec(source);
    assert.ok(importLine, 'o menu importa do módulo de enquadramento');
    const importados = new Set(importLine[1].split(',').map(nome => nome.trim()));
    for (const nome of ['MENU_CAMERA', 'MENU_SUN_TIME', 'menuCameraPosition', 'menuStartAngle']) {
        if (!new RegExp(`\\b${nome}\\b`).test(source)) continue;
        assert.ok(importados.has(nome), `${nome} é usado no menu mas não foi importado`);
    }
});
