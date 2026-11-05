import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../vendor/three/three.module.js';
import {
    DUST_FADE_STEPS,
    DUST_LIFETIME,
    DUST_MAX,
    DUST_MAX_PER_FRAME,
    DUST_PER_METER,
    createCreatureDust,
    dustFade,
    dustScaleFor,
    dustStep,
} from '../world-creature-dust.js';

// ------------------------------------------------ quanto pó o modo comporta

test('o pó cai com a qualidade gráfica: cheio, metade, nada', () => {
    for (const cheio of ['auto', 'max', 1]) {
        assert.equal(dustScaleFor(cheio), 1, `modo ${cheio} comporta tudo`);
    }
    assert.equal(dustScaleFor(0.75), 0.5, 'modo médio fica com a metade');
    assert.equal(dustScaleFor(0.5), 0, 'modo baixo não comporta pó');
});

// ------------------------------------------------ ritmo do rastro (puro)

test('parado não solta pó', () => {
    const passo = dustStep({ budget: 0, distance: 0, scale: 1 });
    assert.equal(passo.count, 0);
    assert.equal(passo.budget, 0);
});

test('a distância vira partículas, com sobra para o próximo quadro', () => {
    // 1 bloco andado = DUST_PER_METER partículas, mas o teto por quadro manda.
    const passo = dustStep({ budget: 0, distance: 1, scale: 1 });
    assert.equal(passo.count, DUST_MAX_PER_FRAME, 'um quadro nunca solta mais que o teto');
    assert.ok(passo.budget > 0, 'e o resto fica guardado para os próximos quadros');
});

test('passos pequenos acumulam em vez de sumir', () => {
    // 60 quadros por segundo: cada quadro anda 2 cm, muito menos que uma partícula.
    let budget = 0;
    let total = 0;
    const porQuadro = 0.02 * DUST_PER_METER;
    const quadrosParaUma = Math.ceil(1 / porQuadro);
    for (let i = 0; i < quadrosParaUma - 1; i++) {
        const passo = dustStep({ budget, distance: 0.02, scale: 1 });
        budget = passo.budget;
        total += passo.count;
    }
    assert.equal(total, 0, 'nos primeiros quadros ainda não deu uma partícula inteira');
    assert.ok(budget > 0.5, 'mas a sobra guardada já é quase uma');
    const ultimo = dustStep({ budget, distance: 0.02, scale: 1 });
    assert.equal(ultimo.count, 1, 'e no quadro seguinte ela sai');
});

test('escala zero não solta nada e nem acumula sobra', () => {
    // Nem a sobra antiga: voltar do modo baixo não pode despejar um punhado
    // atrasado de uma vez.
    const passo = dustStep({ budget: 3.7, distance: 5, scale: 0 });
    assert.equal(passo.count, 0);
    assert.equal(passo.budget, 0);
});

test('o pó desbota em linha reta até apagar', () => {
    assert.equal(dustFade(DUST_LIFETIME), 1, 'nasce opaco');
    assert.ok(Math.abs(dustFade(DUST_LIFETIME / 2) - 0.5) < 1e-9, 'na metade do tempo, metade');
    assert.equal(dustFade(0), 0, 'morreu, sumiu');
    assert.equal(dustFade(-1), 0);
    let anterior = 1;
    for (let life = DUST_LIFETIME; life > 0; life -= 0.1) {
        const fade = dustFade(life);
        assert.ok(fade <= anterior + 1e-9, 'nunca volta a acender');
        anterior = fade;
    }
});

// ------------------------------------------------ o pool em si

function makeDust(extra = {}) {
    const scene = new THREE.Scene();
    const dust = createCreatureDust({
        THREE,
        getScene: () => scene,
        random: () => 0.5, // previsível: sem desvio no nascimento
        ...extra,
    });
    return { scene, dust };
}

const visiveis = scene => scene.children.filter(c => c.visible);

test('o pó nasce, sobe e some sozinho', () => {
    const { scene, dust } = makeDust();
    assert.equal(dust.count, 0, 'começa sem nada no ar');

    assert.equal(dust.emit(0, 10, 0, 3), 3, 'três partículas nasceram');
    assert.equal(dust.count, 3);
    assert.equal(visiveis(scene).length, 3, 'e estão na cena');
    const y0 = visiveis(scene)[0].position.y;

    dust.update(0.5);
    assert.equal(dust.count, 3, 'meio segundo depois elas ainda estão lá');
    assert.ok(visiveis(scene)[0].position.y > y0, 'e subiram');

    dust.update(DUST_LIFETIME);
    assert.equal(dust.count, 0, 'passado o tempo de vida, sumiram');
    assert.equal(visiveis(scene).length, 0);
});

test('as vagas são reaproveitadas: o rastro nunca passa do teto', () => {
    const { scene, dust } = makeDust();
    dust.emit(0, 10, 0, DUST_MAX + 15);
    assert.equal(dust.count, DUST_MAX, 'o pool é fixo');
    assert.equal(scene.children.length, DUST_MAX, 'e nenhuma malha nova foi criada');
});

test('quanto mais velho o pó, mais transparente e menor', () => {
    const { scene, dust } = makeDust();
    dust.emit(0, 10, 0, 1);
    const mesh = visiveis(scene)[0];
    const opacidadeCheia = mesh.material.opacity;
    const escalaCheia = mesh.scale.x;
    dust.update(DUST_LIFETIME * 0.9);
    assert.ok(mesh.material.opacity < opacidadeCheia, 'desbotou');
    assert.ok(mesh.scale.x < escalaCheia, 'e encolheu');
    assert.ok(mesh.material.opacity > 0, 'mas ainda tem o que desbotar');
});

test('o pó é barato: quatro materiais no total, não um por partícula', () => {
    const { scene, dust } = makeDust();
    dust.emit(0, 10, 0, DUST_MAX);
    const materiais = new Set(scene.children.map(mesh => mesh.material));
    assert.ok(materiais.size <= DUST_FADE_STEPS, `no máximo ${DUST_FADE_STEPS} materiais em uso`);
});

test('clear() apaga tudo de uma vez (mundo recomeçando)', () => {
    const { scene, dust } = makeDust();
    dust.emit(0, 10, 0, 5);
    dust.clear();
    assert.equal(dust.count, 0);
    assert.equal(visiveis(scene).length, 0);
});

test('sem cena, o pó não quebra: só não nasce', () => {
    const dust = createCreatureDust({ THREE, getScene: () => null, random: () => 0.5 });
    assert.equal(dust.emit(0, 10, 0, 4), 0);
    assert.equal(dust.count, 0);
    dust.update(0.016); // não pode lançar
});
