import { windDustSpeed, windGust } from './world-wind.js';

/**
 * Rastro de pó luminoso do Mofim.
 *
 * O bicho já tem luz (entra no pool de `PointLight`), olhos que acendem e uma
 * luzinha na antena — mas nada **fica** atrás dele. Quem o vê passar de longe
 * vê um ponto cruzando o escuro; sem rastro, o caminho se apaga assim que ele
 * sai do quadro.
 *
 * Aqui ele solta pó: partículas minúsculas que nascem nos pés, sobem um fio e
 * somem em 1,5 s. A quantidade sai da **distância andada** no quadro — parado
 * não levanta nada, correndo levanta bastante, voando levanta uma cauda.
 *
 * Regras que este módulo guarda (todas testáveis sem WebGL):
 * - quanto pó um deslocamento produz (`dustStep`);
 * - quanto ele já desbotou (`dustFade`, em 0..1);
 * - se o modo gráfico comporta pó (`dustScaleFor`).
 */

/** Quanto tempo cada partícula vive, em segundos. */
export const DUST_LIFETIME = 1.5;
/** Vagas fixas: nunca nasce partícula além disso (pool, sem alocar por quadro). */
export const DUST_MAX = 40;
/** Tamanho do cubinho, no mesmo espírito dos fragmentos de bloco. */
export const DUST_SIZE = 0.08;
/** Cor: a mesma da luzinha da antena, um tom acima para não virar barro. */
export const DUST_COLOR = 0xffe0a0;
/** Partículas por bloco andado. */
export const DUST_PER_METER = 8;
/** Teto por quadro: um voo a 6,5 blocos/s não pode soltar 50 partículas de uma vez. */
export const DUST_MAX_PER_FRAME = 2;
/** Quanto sobe, em m/s (pó quente sobe; poeira de chão não). */
export const DUST_RISE = 0.45;
/** Quanto se espalha para os lados, em m/s. */
export const DUST_DRIFT = 0.28;
/** Pó do pouso: a nuvem que sobe quando ele toca o chão depois de voar. */
export const DUST_LANDING_PUFF = 6;
/** Desvio no nascimento: no chão fica junto aos pés, no ar abre mais. */
export const DUST_SPREAD_GROUND = 0.14;
export const DUST_SPREAD_AIR = 0.26;
/** Degraus de transparência (4 materiais em vez de um por partícula). */
export const DUST_FADE_STEPS = 4;
const DUST_OPACITY = [0.85, 0.6, 0.35, 0.15];

/**
 * Quanto do rastro o modo gráfico comporta.
 *
 * Escala 0,5 (o modo "Baixa") não comporta pó nenhum: a máquina já está no
 * limite e partícula é justamente o que se corta primeiro. 0,75 fica com a
 * metade.
 */
export function dustScaleFor(mode) {
    const m = Number(mode);
    if (m === 0.5) return 0;
    if (m === 0.75) return 0.5;
    return 1;
}

/**
 * Quantas partículas um deslocamento rende, com sobra para o próximo quadro.
 *
 * O acumulador é o que evita o rastro "picotado": a 60 quadros por segundo um
 * passo de 1,15 m/s anda 1,9 cm — muito menos que uma partícula. Guardar a sobra
 * faz o pó sair no ritmo certo, independentemente da taxa de quadros.
 */
export function dustStep({ budget = 0, distance = 0, scale = 1 } = {}) {
    const escala = Math.max(0, Number(scale) || 0);
    // Escala 0 é "este modo não tem pó": nada nasce e nada fica guardado, senão
    // a sobra antiga viraria um punhado atrasado ao voltar para a qualidade alta.
    if (escala === 0) return { count: 0, budget: 0 };
    const soma = (Number(budget) || 0)
        + Math.max(0, Number(distance) || 0) * DUST_PER_METER * escala;
    const count = Math.max(0, Math.min(DUST_MAX_PER_FRAME, Math.floor(soma)));
    return { count, budget: soma - count };
}

/** Quanto do pó ainda resta (0..1): nasce em 1 e apaga em 0. */
export function dustFade(life, lifetime = DUST_LIFETIME) {
    if (!(life > 0) || !(lifetime > 0)) return 0;
    return Math.min(1, life / lifetime);
}

/**
 * O sistema em si: um pool fixo de cubinhos que nascem, sobem e somem.
 *
 * Nada é criado nem descartado durante o jogo — as vagas são reaproveitadas em
 * roda, então o pó mais antigo cede o lugar quando o rastro enche.
 */
export function createCreatureDust({
    THREE,
    getScene,
    maxParticles = DUST_MAX,
    lifetime = DUST_LIFETIME,
    random = Math.random,
}) {
    const geometry = new THREE.BoxGeometry(DUST_SIZE, DUST_SIZE, DUST_SIZE);
    const materials = [];
    for (let i = 0; i < DUST_FADE_STEPS; i++) {
        materials.push(new THREE.MeshBasicMaterial({
            color: DUST_COLOR,
            transparent: true,
            opacity: DUST_OPACITY[i],
            depthWrite: false,
        }));
    }
    const slots = [];
    let cursor = 0;
    let prepared = false;

    function prepare() {
        if (prepared) return;
        const scene = getScene();
        if (!scene) return;
        prepared = true;
        for (let i = 0; i < maxParticles; i++) {
            const mesh = new THREE.Mesh(geometry, materials[0]);
            mesh.visible = false;
            mesh.scale.setScalar(DUST_SIZE);
            scene.add(mesh);
            slots.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, phase: 0 });
        }
    }

    /**
     * Solta `count` partículas em (x, y, z).
     *
     * `air` só muda o espalhamento: no chão o pó fica junto aos pés; no ar abre
     * mais, porque o bicho passou voando e o rastro é a coisa que se vê.
     */
    function emit(x, y, z, count, { air = false, burst = false } = {}) {
        prepare();
        if (!prepared) return 0;
        const spread = air ? DUST_SPREAD_AIR : DUST_SPREAD_GROUND;
        let born = 0;
        for (let i = 0; i < count; i++) {
            const slot = slots[cursor];
            cursor = (cursor + 1) % slots.length;
            const mesh = slot.mesh;
            mesh.position.set(
                x + (random() - 0.5) * spread * 2,
                y + random() * spread,
                z + (random() - 0.5) * spread * 2,
            );
            // Subida com folga: o pó do rasante sobe mais que o do passo.
            slot.vx = (random() - 0.5) * DUST_DRIFT * 2;
            slot.vy = DUST_RISE * (0.5 + random()) * (air || burst ? 1.6 : 1);
            slot.vz = (random() - 0.5) * DUST_DRIFT * 2;
            slot.life = lifetime;
            // Fase da rajada por partícula: o pó inteiro subindo em sincronia
            // pareceria uma placa, não poeira.
            slot.phase = random() * Math.PI * 2;
            mesh.material = materials[0];
            mesh.scale.setScalar(DUST_SIZE);
            mesh.visible = true;
            born++;
        }
        return born;
    }

    /**
     * Um passo de vida.
     *
     * `wind = { x, z, level, time }` vem do jogo (ver `world-wind.js`). O vento
     * entra como **deslocamento**, separado do arrasto da partícula: o arrasto
     * freia o empurrão do nascimento, mas não pode frear o vento — senão o pó
     * pararia no ar e a poeira "andando sozinha" pareceria bug.
     */
    function update(dt, wind = null) {
        if (!(dt > 0)) return;
        const dirX = Number(wind?.x) || 0;
        const dirZ = Number(wind?.z) || 0;
        const push = wind ? windDustSpeed(wind.level) : 0;
        const windTime = Number(wind?.time) || 0;
        for (const slot of slots) {
            if (!slot.mesh.visible) continue;
            slot.life -= dt;
            if (slot.life <= 0) {
                slot.life = 0;
                slot.mesh.visible = false;
                continue;
            }
            const mesh = slot.mesh;
            const gust = push > 0 ? windGust(windTime, slot.phase) : 0;
            mesh.position.x += (slot.vx + dirX * push * gust) * dt;
            mesh.position.y += slot.vy * dt;
            mesh.position.z += (slot.vz + dirZ * push * gust) * dt;
            // Desacelera: o pó vai ficando para trás enquanto sobe.
            const arrasto = Math.exp(-1.8 * dt);
            slot.vx *= arrasto;
            slot.vz *= arrasto;
            const fade = dustFade(slot.life, lifetime);
            // Degrau de transparência: 4 materiais no total (o [0] é o mais
            // opaco), e trocar de material aqui é só trocar uma referência — o
            // programa do shader é o mesmo, nada recompila.
            const brilho = Math.min(DUST_FADE_STEPS - 1, Math.max(0, Math.floor(fade * DUST_FADE_STEPS)));
            const material = materials[DUST_FADE_STEPS - 1 - brilho];
            if (mesh.material !== material) mesh.material = material;
            // Encolhe enquanto desbota: dois sinais do mesmo desaparecimento.
            mesh.scale.setScalar(DUST_SIZE * (0.35 + 0.65 * fade));
        }
    }

    function clear() {
        for (const slot of slots) {
            slot.life = 0;
            slot.mesh.visible = false;
        }
        cursor = 0;
    }

    return {
        emit,
        update,
        clear,
        get count() {
            let n = 0;
            for (const slot of slots) if (slot.mesh.visible) n++;
            return n;
        },
        get capacity() {
            return maxParticles;
        },
        /** Posições vivas — para depuração e para os testes verem o rastro. */
        livePositions() {
            const out = [];
            for (const slot of slots) {
                if (!slot.mesh.visible) continue;
                out.push({
                    x: slot.mesh.position.x,
                    y: slot.mesh.position.y,
                    z: slot.mesh.position.z,
                    life: slot.life,
                });
            }
            return out;
        },
    };
}
