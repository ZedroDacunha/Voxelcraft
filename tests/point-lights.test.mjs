import test from 'node:test';
import assert from 'node:assert/strict';

import { BLOCKS, ID } from '../world-catalog.js';
import {
    LIGHT_POOL_RANGE,
    LIGHT_POOL_SIZE,
    HELD_LIGHTS,
    MOFIM_LIGHT_COLOR,
    MOFIM_LIGHT_LEVEL,
    creatureEmitterCandidates,
    creatureLightPoint,
    creatureLightsAllowed,
    emitterColor,
    emitterIntensity,
    heldLightFor,
    heldLightIntensity,
    pickEmitters,
} from '../world-point-lights.js';

// ---------------------------------------------- luz do item na mão

test('tocha e lanterna iluminam; o resto não', () => {
    assert.ok(heldLightFor(ID.TORCH), 'a tocha ilumina');
    assert.ok(heldLightFor(ID.MOFIM_LANTERN), 'a lanterna ilumina');
    for (const other of [undefined, null, 0, ID.STONE, ID.PLANKS, ID.MOFIM_DUST, ID.COBBLE]) {
        assert.equal(heldLightFor(other), null, `${other} não ilumina`);
    }
});

test('a lanterna é mais firme e alcança mais que a tocha', () => {
    const torch = heldLightFor(ID.TORCH);
    const lantern = heldLightFor(ID.MOFIM_LANTERN);
    assert.ok(lantern.distance > torch.distance, 'a lanterna joga a luz mais longe');
    assert.ok(lantern.flicker < torch.flicker, 'e tremula menos (pó, não chama)');
    assert.notEqual(lantern.color, torch.color, 'tonalidades diferentes');
    for (const spec of HELD_LIGHTS.values()) {
        const { x, y, z } = spec.offset;
        assert.ok(z < 0, 'a luz fica à frente da câmera');
        assert.ok(y < 0, 'e um pouco abaixo do olho, na altura do objeto');
        assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
    }
});

test('a intensidade da mão respira em volta da base', () => {
    const torch = heldLightFor(ID.TORCH);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < 400; i++) {
        const value = heldLightIntensity(torch, i * 0.013);
        min = Math.min(min, value);
        max = Math.max(max, value);
    }
    assert.ok(min > 0.6, `nunca apaga (min ${min.toFixed(2)})`);
    assert.ok(max < torch.base + torch.flicker * 1.5, 'nem estoura');
    assert.ok(max - min > 0.05, 'e tremula de verdade');

    // A lanterna varia bem menos que a tocha no mesmo intervalo.
    const lantern = heldLightFor(ID.MOFIM_LANTERN);
    const ranges = spec => {
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < 400; i++) {
            const v = heldLightIntensity(spec, i * 0.013);
            lo = Math.min(lo, v); hi = Math.max(hi, v);
        }
        return hi - lo;
    };
    assert.ok(ranges(lantern) < ranges(torch));
    assert.equal(heldLightIntensity(null, 1), 0, 'sem item, sem luz');
});

// ---------------------------------------------- intensidade por distância

test('a luz real cai com a distância e morre no alcance', () => {
    assert.ok(emitterIntensity(14, 1) > emitterIntensity(14, 5), 'de perto é mais forte');
    assert.ok(emitterIntensity(14, 5) > emitterIntensity(14, 9));
    assert.equal(emitterIntensity(14, LIGHT_POOL_RANGE), 0, 'na borda do alcance já não ilumina');
    assert.equal(emitterIntensity(14, LIGHT_POOL_RANGE + 4), 0);
    assert.equal(emitterIntensity(14, 0), emitterIntensity(14, 0), 'determinístico');
    assert.ok(emitterIntensity(14, 0) <= 1.2, 'sem estourar o teto');
});

test('lanterna ilumina um pouco menos que a tocha, mas ainda muito', () => {
    const torch = BLOCKS[ID.TORCH].light;
    const lantern = BLOCKS[ID.MOFIM_LANTERN].light;
    assert.ok(emitterIntensity(lantern, 2) > 0.5, 'perto, a lanterna é forte');
    assert.ok(emitterIntensity(lantern, 2) < emitterIntensity(torch, 2), 'e um tico mais fraca que a tocha');
    assert.equal(emitterIntensity(0, 2), 0, 'bloco sem luz não ilumina');
    assert.equal(emitterIntensity(-3, 2), 0);
});

// ---------------------------------------------- escolha das fontes

const origin = { x: 8, y: 64, z: 8 };

test('pega os emissores mais próximos, até o limite do pool', () => {
    const candidates = [
        { x: 14, y: 64, z: 8, level: 14, type: ID.TORCH },
        { x: 9, y: 64, z: 8, level: 13, type: ID.MOFIM_LANTERN },
        { x: 11, y: 64, z: 8, level: 14, type: ID.TORCH },
    ];
    const picked = pickEmitters(candidates, { origin });
    assert.equal(picked.length, LIGHT_POOL_SIZE, 'no máximo duas luzes');

    const distances = picked.map(p => p.distance);
    assert.deepEqual(distances, [...distances].sort((a, b) => a - b), 'da mais perto para a mais longe');
    assert.equal(picked[0].level, 13, 'a lanterna a 1,5 bloco é a primeira');
    assert.equal(picked[0].color, emitterColor(ID.MOFIM_LANTERN));
    assert.equal(picked[1].color, emitterColor(ID.TORCH));

    // A posição vem no centro do bloco, um pouco acima do meio.
    assert.equal(picked[0].x, 9.5);
    assert.equal(picked[0].y, 64.6);
    assert.equal(picked[0].z, 8.5);
});

test('ignora o que não ilumina, o que está longe e o que está quebrado', () => {
    const candidates = [
        { x: 8, y: 64, z: 8, level: 0, type: ID.TORCH },
        { x: 8, y: 64, z: 9, level: 14, type: ID.TORCH },
        { x: 8 + LIGHT_POOL_RANGE + 2, y: 64, z: 8, level: 14, type: ID.TORCH },
        { x: NaN, y: 64, z: 8, level: 14, type: ID.TORCH },
        null,
        {},
    ];
    const picked = pickEmitters(candidates, { origin });
    assert.equal(picked.length, 1, 'só o vizinho aceso entra');
    assert.equal(picked[0].z, 9.5);
});

test('sem origem, sem limite ou sem lista, devolve nada', () => {
    const candidates = [{ x: 9, y: 64, z: 8, level: 14, type: ID.TORCH }];
    assert.deepEqual(pickEmitters(candidates), []);
    assert.deepEqual(pickEmitters(candidates, { origin, max: 0 }), []);
    assert.deepEqual(pickEmitters(candidates, { origin, range: 0 }), []);
    assert.deepEqual(pickEmitters(null, { origin }), []);
    assert.deepEqual(pickEmitters([], { origin }), []);
});

test('empate de distância mantém a ordem em que a busca achou', () => {
    const candidates = [
        { x: 7, y: 64, z: 8, level: 14, type: ID.TORCH },
        { x: 9, y: 64, z: 8, level: 14, type: ID.TORCH },
    ];
    const picked = pickEmitters(candidates, { origin, max: 1 });
    assert.equal(picked.length, 1);
    assert.equal(picked[0].x, 7.5, 'o primeiro encontrado ganha o empate');
});

// ---------------------------------------------- luz do Mofim no pool

const mofim = (extra = {}) => ({ x: 3.25, y: 11, z: -2.5, visualY: 11.4, lightPulse: 0, ...extra });

test('a criatura vira candidata a luz na posição em que ela está', () => {
    const [candidato] = creatureEmitterCandidates([mofim()], {});
    assert.ok(candidato, 'entrou na lista');
    assert.equal(candidato.exact, true, 'posição exata, não centro de bloco');
    assert.equal(candidato.creature, true);
    assert.equal(candidato.x, 3.25, 'sem arredondar');
    assert.equal(candidato.z, -2.5);
    assert.equal(candidato.y, 11.4 + 0.66, 'a luz fica no alto da antena, acima do corpo');
    assert.equal(candidato.level, MOFIM_LIGHT_LEVEL);
    assert.equal(candidato.color, MOFIM_LIGHT_COLOR);
});

test('criatura indo embora, sem dados ou com a luz desligada não vira fonte', () => {
    assert.equal(creatureEmitterCandidates([mofim({ leaving: true })]).length, 0, 'quem está indo embora apaga');
    assert.equal(creatureEmitterCandidates([mofim({ x: NaN })]).length, 0, 'posição inválida fica de fora');
    assert.equal(creatureEmitterCandidates([null, undefined, {}]).length, 0);
    assert.equal(creatureEmitterCandidates([mofim()], { allowed: false }).length, 0,
        'no modo gráfico mais baixo a vaga fica com as tochas');
    assert.equal(creatureLightsAllowed(0.5), false, 'escala 0,5 = sem luz de bicho');
    for (const modo of ['auto', 'max', 1, 0.75]) {
        assert.equal(creatureLightsAllowed(modo), true, `modo ${modo} permite`);
    }
});

test('o pulso do chilreio não entra no nível: quem aplica é o quadro', () => {
    const calmo = creatureEmitterCandidates([mofim({ lightPulse: 0 })])[0];
    const aceso = creatureEmitterCandidates([mofim({ lightPulse: 1 })])[0];
    assert.equal(aceso.level, calmo.level,
        'a varredura roda a 4 Hz; se o pulso entrasse aqui, a luz piscaria aos saltos');
});

test('a luz da criatura fica onde ela está, não no centro do bloco', () => {
    const [escolhido] = pickEmitters(creatureEmitterCandidates([mofim()]), {
        origin: { x: 0, y: 11, z: 0 },
    });
    assert.ok(escolhido, 'a criatura ganhou uma vaga');
    assert.equal(escolhido.creature, true, 'e o jogo sabe que é criatura');
    assert.equal(escolhido.x, 3.25, 'a PointLight vai para a posição real');
    assert.ok(escolhido.entity, 'o candidato carrega o bicho (para ler o pulso no quadro)');
});

test('o bicho perto ganha a vaga de uma tocha longe', () => {
    const tocha = { x: 10, y: 11, z: 0, level: 14, type: ID.TORCH };
    const escolhido = pickEmitters(
        [tocha, ...creatureEmitterCandidates([mofim({ x: 2, y: 11, z: 0, visualY: 11 }), ])],
        { origin: { x: 0, y: 12, z: 0 }, max: 1 },
    );
    assert.equal(escolhido.length, 1);
    assert.equal(escolhido[0].creature, true, 'o mais próximo ganha, seja bicho ou tocha');
});

test('a luz da criatura segue a altura desenhada, não a do chão', () => {
    // No voo curto ele sobe 1,5 bloco: a luz sobe junto.
    assert.deepEqual(creatureLightPoint({ x: 1.5, y: 10, z: -0.25, visualY: 11.5 }),
        { x: 1.5, y: 11.5 + 0.66, z: -0.25 });
    // Sem visualY (parado no chão), usa a altura do corpo.
    assert.deepEqual(creatureLightPoint({ x: 0, y: 10, z: 0 }), { x: 0, y: 10.66, z: 0 });
    assert.equal(creatureLightPoint(null), null);
    assert.equal(creatureLightPoint({ x: 0, y: NaN, z: 0 }), null, 'altura inválida não vira luz');
});
