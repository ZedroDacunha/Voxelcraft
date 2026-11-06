/**
 * Base das criaturas: o que **todo** bicho do mundo precisa saber.
 *
 * O Mofim foi escrito sozinho (`world-creature.js`) e a ovelha chegou depois.
 * Copiar o "achar chão, dar passo, montar caixa" para a ovelha seria a receita
 * para os dois divergirem: um aceitaria areia, o outro não; um subiria degrau,
 * o outro travaria. Aqui fica o que é do chão e do corpo, e cada espécie cuida
 * do que é dela (andar de noite, pastar, voar, balir).
 *
 * Nada aqui conhece THREE além de caixas, e nada conhece o jogo além do `world`
 * que o jogo passa.
 */

/**
 * Degrau máximo que um bicho sobe andando (blocos).
 *
 * É o mesmo limite do jogador: um degrau de terra se sobe, um barranco de dois
 * blocos se contorna.
 */
import { HIT_COOLDOWN, HURT_FLASH, KNOCKBACK_DISTANCE } from './world-mob-hit.js';

export const CREATURE_STEP_UP = 1;

/** Altura do arco de salto ao subir um degrau (blocos). */
export const CREATURE_HOP_HEIGHT = 0.42;

/**
 * Quanto tempo o bicho leva para **parar** depois de um empurrão (segundos).
 *
 * O golpe empurrava 35 cm no mesmo quadro — um pulo seco. Agora o recuo é uma
 * velocidade que freia até zero: o corpo desliza um dedo e para, como quem levou
 * um encontrão.
 */
export const KNOCK_TIME = 0.16;

/**
 * Velocidade inicial do recuo que, freando em linha reta até zero em `time`,
 * percorre exatamente `distance` blocos (área do triângulo: v · t / 2).
 */
export function knockSpeedFor(distance, time = KNOCK_TIME) {
    const d = Math.max(0, Number(distance) || 0);
    const t = Math.max(1e-3, Number(time) || KNOCK_TIME);
    return (2 * d) / t;
}

/**
 * A queda: quanto tempo o corpo leva para tombar, ficar caído e sumir (s).
 *
 * Antes o bicho era arrancado do mundo no quadro do golpe — sumia no ar, sem
 * tombar. Agora ele cai de lado, fica um instante no chão e só então sai, com o
 * corpo encolhendo no fim para não estourar na tela.
 */
export const DYING_TIME = 0.8;
/** Fração da queda gasta só para tombar (o resto é o corpo caído sumindo). */
export const DYING_TIP = 0.45;
/** Fração final em que o corpo encolhe até sumir. */
export const DYING_FADE = 0.2;

/**
 * A pose da queda para um tempo caído (0..`DYING_TIME`).
 *
 * `roll` é o giro em Z (o corpo tombando de lado), `scale` o encolhimento do fim
 * e `done` avisa que já pode sair do mundo. A conta é pura: quem desenha é a
 * criatura.
 */
export function dyingPoseFor(t, {
    time = DYING_TIME, tip = DYING_TIP, fade = DYING_FADE, side = 1,
} = {}) {
    const total = Math.max(0.05, Number(time) || DYING_TIME);
    const tempo = Math.min(total, Math.max(0, Number(t) || 0));
    const p = tempo / total;
    // Tumba rápido e assenta: a curva é a de queda (1 − (1 − x)²), não uma reta.
    const queda = Math.min(1, p / Math.max(0.01, Number(tip) || DYING_TIP));
    const assentar = 1 - (1 - queda) ** 2;
    const sumindo = p > 1 - Math.max(0.01, Number(fade) || DYING_FADE)
        ? (1 - p) / Math.max(0.01, Number(fade) || DYING_FADE)
        : 1;
    return {
        roll: (Number(side) || 1) * (Math.PI / 2) * assentar,
        scale: Math.max(0.02, Math.min(1, sumindo)),
        progress: p,
        done: tempo >= total,
    };
}

/**
 * Altura do corpo durante o pulo do degrau.
 *
 * Sobe até `height` acima do destino e desce até pousar nele — um arco de
 * salto, não uma rampa. Rampa (linear + seno) quase não levanta o corpo quando o
 * degrau é de 1 bloco, e o pulo fica invisível.
 */
export function hopHeightAt(from, to, progress, height = CREATURE_HOP_HEIGHT) {
    if (!(progress > 0)) return from;
    if (progress >= 1) return to;
    const peak = to + height;
    const subida = 0.6;
    return progress < subida
        ? from + (peak - from) * (progress / subida)
        : peak + (to - peak) * ((progress - subida) / (1 - subida));
}

/**
 * Altura do corpo ao descer um degrau.
 *
 * É o inverso do pulo: desce depressa no começo e **pousa devagar** (a curva
 * desacelera até parar no chão). Queda `to + (from - to) * (1 - p)²` — sem
 * "quique", sem passar do chão.
 */
export function glideHeightAt(from, to, progress) {
    if (!(progress > 0)) return from;
    if (progress >= 1) return to;
    const queda = 1 - progress;
    return to + (from - to) * queda * queda;
}

export function createCreatureBaseClass({
    THREE,
    BLOCKS = {},
    CHUNK_SIZE,
    floorDiv,
}) {
    class CreatureBase {
        constructor(world) {
            this.world = world;
            this.entities = [];
            this.nextId = 1;
            // Uma caixa só serve de molde para todos os pedaços de todos os bichos.
            this.cube = new THREE.BoxGeometry(1, 1, 1);
        }

        /** Chão serve se for sólido: grama, terra, areia, pedra, neve… */
        isGround(type) {
            return type !== 0 && (BLOCKS[type]?.solid ?? true);
        }

        /**
         * Ele atravessa o que não é sólido — grama alta, tocha, flor — mas não
         * água: sem isso ficava preso na primeira touceira do caminho (a grama
         * alta ocupava a célula de cima e a coluna era recusada) e, num campo
         * cheio dela, nem nascia.
         */
        isClear(type) {
            if (type === 0) return true;
            const block = BLOCKS[type];
            if (!block) return true;
            return !(block.solid ?? true) && block.render !== 'liquid';
        }

        /**
         * Onde fica o chão em (x, z)? Altura (y) da primeira célula livre sobre um
         * bloco sólido, ou `null` se não há chão ou o ar acima está tomado.
         */
        surfaceAt(x, z) {
            const bx = Math.floor(x), bz = Math.floor(z);
            if (!this.world.getChunk(floorDiv(bx, CHUNK_SIZE), floorDiv(bz, CHUNK_SIZE))) return null;
            const y = this.world.generator.heightAt(bx, bz);
            if (!this.isGround(this.world.getBlock(bx, y, bz))) return null;
            if (!this.isClear(this.world.getBlock(bx, y + 1, bz))) return null;
            if (!this.isClear(this.world.getBlock(bx, y + 2, bz))) return null;
            return y + 1;
        }

        /** Tipo do bloco que serve de chão em (x, z) — 0 quando não há chão. */
        groundTypeAt(x, z) {
            const bx = Math.floor(x), bz = Math.floor(z);
            if (!this.world.getChunk(floorDiv(bx, CHUNK_SIZE), floorDiv(bz, CHUNK_SIZE))) return 0;
            if (this.surfaceAt(x, z) === null) return 0;
            return this.world.getBlock(bx, this.world.generator.heightAt(bx, bz), bz);
        }

        addPart(group, material, x, y, z, sx, sy, sz) {
            const mesh = new THREE.Mesh(this.cube, material);
            mesh.position.set(x, y, z);
            mesh.scale.set(sx, sy, sz);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            group.add(mesh);
            return mesh;
        }

        /**
         * Começa a cair: o bicho **não** sai do mundo na hora — o corpo tomba,
         * fica caído e só então some (`stepDying`).
         *
         * Devolve `false` se ele já estava caindo (o segundo golpe não derruba
         * de novo).
         */
        startDying(e, at = 0) {
            if (e.dying) return false;
            e.dying = true;
            e.dieT = 0;
            e.diedAt = Number(at) || 0;
            // Cai sempre para o lado "de fora" do golpe: par ou ímpar dá o lado.
            e.dieSide = (Number(e.id) || 0) % 2 === 0 ? 1 : -1;
            // Nada mais de vida: sem fuga, sem susto, sem pasto, sem recuo.
            e.fleeUntil = 0;
            e.fleeFrom = null;
            e.alertUntil = 0;
            e.alertAt = 0;
            e.grazeT = null;
            e.knockFor = 0;
            return true;
        }

        /**
         * Um quadro de queda: devolve a pose do corpo e tira o bicho do mundo
         * quando o tempo acaba. Quem chama só desenha.
         */
        stepDying(e, dt) {
            e.dieT = Math.min(DYING_TIME, (Number(e.dieT) || 0) + Math.max(0, Number(dt) || 0));
            const pose = dyingPoseFor(e.dieT, { side: e.dieSide ?? 1 });
            if (pose.done) this.removeEntity(e);
            return pose;
        }

        /**
         * O golpe num bicho, em um lugar só: tira vida, acende o clarão, empurra
         * o corpo e — quando a vida acaba — derruba (o corpo tomba e só então
         * sai do mundo).
         *
         * Todo mob ganha isso de graça ao estender a base: o que é da espécie
         * vem por `onHurt` (fugir, assustar-se), `dropsFor` (o que solta) e
         * `onDeath` (o jogo põe os itens no chão). Devolve `{ entity, killed,
         * drops }` ou `null` quando o bicho não leva o golpe agora (já caído,
         * ainda no cooldown ou sem vida declarada).
         */
        takeHit(entity, {
            at = 0,
            damage = 1,
            from = null,
            flash = HURT_FLASH,
            cooldown = HIT_COOLDOWN,
            knockback = KNOCKBACK_DISTANCE,
            onHurt = null,
            dropsFor = null,
            onDeath = null,
        } = {}) {
            if (!entity || entity.dying) return null;
            // A trava do bicho: dois golpes do mesmo corpo não saem no mesmo
            // instante, venha o segundo de onde vier.
            // A folga de 1e-9 é a mesma de `attackReady`: somar o cooldown em
            // ponto flutuante (10 + 0,35 = 10,349999…) não pode travar um golpe
            // que deveria entrar.
            const ultimo = Number(entity.lastHitAt);
            if (Number.isFinite(ultimo) && at - ultimo < cooldown - 1e-9) return null;
            entity.lastHitAt = at;
            entity.health = (Number(entity.health) || 0) - Math.max(0, Number(damage) || 0);
            entity.hurtUntil = at + flash;
            // Recuo: o corpo desliza na direção contrária ao golpe, freando.
            // No ar (voo) o empurrão brigaria com o arco: o dano conta, o corpo
            // não se mexe até pousar.
            const dx = entity.x - (from?.x ?? entity.x - 1);
            const dz = entity.z - (from?.z ?? entity.z);
            if (!entity.flight && knockback > 0 && Math.hypot(dx, dz) > 1e-4) {
                this.pushAway(entity, dx, dz, knockback);
            }
            onHurt?.(entity, { at, from, damage });
            if (entity.health > 0) return { entity, killed: false, drops: null };
            const drops = dropsFor ? dropsFor(entity) : null;
            this.startDying(entity, at);
            onDeath?.({ entity, killed: true, drops });
            return { entity, killed: true, drops };
        }

        /** Tira o bicho do mundo e solta o material dele (não é compartilhado). */
        removeEntity(entity) {
            const index = this.entities.indexOf(entity);
            if (index >= 0) this.entities.splice(index, 1);
            this.world.scene.remove(entity.group);
            entity.bodyMaterial?.dispose?.();
        }

        /**
         * Dá um passo na direção pedida, se o chão à frente servir. Devolve
         * `false` quando o caminho está barrado (encosta, água, buraco) — quem
         * chama decide o que fazer, e o passo nunca é dado "no escuro".
         *
         * Subir um degrau deixa o pulo armado (`hopFrom/hopTo/hopT`) e descer
         * arma o planeio (`glideFrom/glideT`); quem desenha o bicho lê esses
         * campos para o corpo acompanhar o chão em vez de teletransportar.
         */
        stepToward(e, dirX, dirZ, speed, dt) {
            const length = Math.hypot(dirX, dirZ);
            if (!(length > 1e-6)) return false;
            const step = speed * dt;
            if (!this.moveTo(e, e.x + (dirX / length) * step, e.z + (dirZ / length) * step)) return false;
            e.heading = Math.atan2(dirX, dirZ);
            return true;
        }

        /**
         * Dá um passo **no rumo em que o corpo está** (`e.heading`), sem mexer
         * nele. Devolve a distância andada — `0` quando o chão barra.
         *
         * É o par do `stepToward` para quem gira o corpo antes de andar: bicho
         * de quatro patas não anda de lado nem de costas, então quem quer
         * virar suave vira o `heading` primeiro e chama este passo depois.
         */
        stepHeading(e, distance) {
            const passo = Number(distance) || 0;
            if (!(passo > 0)) return 0;
            const nx = e.x + Math.sin(e.heading) * passo;
            const nz = e.z + Math.cos(e.heading) * passo;
            return this.moveTo(e, nx, nz) ? passo : 0;
        }

        /**
         * Empurrão do golpe: o bicho recua `distance` blocos em `time`, freando
         * até parar. Não move nada na hora — quem move é o `stepKnock`, um pouco
         * por quadro.
         */
        pushAway(e, dirX, dirZ, distance, time = KNOCK_TIME) {
            const comprimento = Math.hypot(dirX, dirZ);
            if (!(comprimento > 1e-6) || !(distance > 0)) return false;
            const velocidade = knockSpeedFor(distance, time);
            e.knockX = (dirX / comprimento) * velocidade;
            e.knockZ = (dirZ / comprimento) * velocidade;
            e.knockT = 0;
            e.knockFor = Math.max(1e-3, Number(time) || KNOCK_TIME);
            return true;
        }

        /**
         * Avança o recuo do golpe (se houver) e devolve a distância andada.
         *
         * A velocidade cai em linha reta até zero, então o corpo desacelera como
         * um empurrão de verdade. Bateu em encosta/água? O recuo acaba ali.
         */
        stepKnock(e, dt) {
            if (!(e.knockFor > 0) || !(e.knockT < e.knockFor)) return 0;
            const passo = Math.min(Number(dt) || 0, e.knockFor - e.knockT);
            if (!(passo > 0)) return 0;
            e.knockT += passo;
            // Velocidade no **meio** do quadro: é a integral certa da reta que
            // freia até zero, então a soma dos quadros dá o empurrão exato.
            const freio = 1 - (e.knockT - passo / 2) / e.knockFor;   // 1 → 0
            const andado = Math.hypot(e.knockX, e.knockZ) * freio * passo;
            if (!(andado > 1e-9)) { e.knockFor = 0; return 0; }
            const ok = this.moveTo(e, e.x + e.knockX * freio * passo, e.z + e.knockZ * freio * passo);
            if (!ok) { e.knockFor = 0; return 0; }
            if (e.knockT >= e.knockFor) e.knockFor = 0;
            return andado;
        }

        /**
         * O passo em si: confere o chão, arma pulo/planeio e move o bicho. É a
         * conta que o `stepToward` e o `stepHeading` têm em comum.
         */
        moveTo(e, nx, nz) {
            const ny = this.surfaceAt(nx, nz);
            if (ny === null || Math.abs(ny - e.y) > CREATURE_STEP_UP) return false;
            if (ny > e.y) {
                e.hopFrom = e.visualY;
                e.hopTo = ny;
                e.hopT = 0;
            } else if (ny < e.y) {
                e.glideFrom = e.visualY;
                e.glideT = 0;
            }
            e.x = nx; e.z = nz; e.y = ny;
            return true;
        }

        /** Quantos bichos já estão a menos de `gap` blocos de (x, z)? */
        countNear(x, z, gap) {
            let total = 0;
            for (const entity of this.entities) {
                // Quem está caindo já não ocupa lugar no mundo.
                if (entity.dying) continue;
                if ((entity.x - x) ** 2 + (entity.z - z) ** 2 < gap * gap) total++;
            }
            return total;
        }
    }
    return CreatureBase;
}
