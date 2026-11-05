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
export const CREATURE_STEP_UP = 1;

/** Altura do arco de salto ao subir um degrau (blocos). */
export const CREATURE_HOP_HEIGHT = 0.42;

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
            const nx = e.x + (dirX / length) * step;
            const nz = e.z + (dirZ / length) * step;
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
            e.heading = Math.atan2(dirX, dirZ);
            return true;
        }

        /** Quantos bichos já estão a menos de `gap` blocos de (x, z)? */
        countNear(x, z, gap) {
            let total = 0;
            for (const entity of this.entities) {
                if ((entity.x - x) ** 2 + (entity.z - z) ** 2 < gap * gap) total++;
            }
            return total;
        }
    }
    return CreatureBase;
}
