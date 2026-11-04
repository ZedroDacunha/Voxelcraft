// Regras de simulação do forno, sem DOM e sem three.js.
//
// O forno do jogo é um registro `{ inv, burn, burnMax, cook }` guardado por
// posição. Antes esse passo morava dentro de `updateFurnaces()` e rodava para
// **todos** os fornos do save, mesmo em chunks descarregados — trabalho por
// quadro que crescia com o mundo e deixava fornos queimando sozinhos longe do
// jogador.
import { FUEL, ITEMS, SMELT } from './world-catalog.js';
import { floorDiv } from './world-grid.js';

const sameStack = (stack, id) => Boolean(stack) && stack.id === id;

/**
 * Um passo de simulação de um forno por `dt` segundos.
 *
 * - Acende quando há receita para o primeiro slot, o resultado cabe no terceiro
 *   e há combustível no segundo (consumindo uma unidade).
 * - Enquanto queima, avança o preparo; ao completar `recipe.time`, consome um
 *   item da entrada e entrega o resultado (respeitando o limite da pilha).
 * - Sem receita possível, o preparo esfria em dobro do tempo.
 *
 * Muta `furnace` (incluindo `furnace.inv.slots`) e devolve o que aconteceu:
 * `changed` (itens, combustível ou preparo mudaram), `litChanged` (o forno
 * acendeu ou apagou neste passo) e `smelted` (uma peça ficou pronta agora).
 * `smelted` existe para o som: quem ouve precisa saber que o item saiu, e
 * comparar a pilha de saída antes/depois seria frágil.
 */
export function stepFurnace(furnace, dt, { smelt = SMELT, fuel = FUEL, items = ITEMS } = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return { changed: false, litChanged: false, smelted: false };
    const slots = furnace.inv.slots;
    const wasLit = furnace.burn > 0;
    const recipe = slots[0] && smelt[slots[0].id];
    const output = slots[2];
    const maxStack = recipe ? items[recipe.result]?.maxStack ?? 64 : 0;
    const canSmelt = Boolean(recipe) && (!output || (sameStack(output, recipe.result) && output.count < maxStack));

    let changed = false;
    let smelted = false;
    if (furnace.burn <= 0 && canSmelt && slots[1] && fuel[slots[1].id]) {
        furnace.burn = furnace.burnMax = fuel[slots[1].id];
        consumeOne(slots, 1);
        changed = true;
    }

    if (furnace.burn > 0) {
        furnace.burn = Math.max(0, furnace.burn - dt);
        if (canSmelt) {
            furnace.cook += dt;
            if (furnace.cook >= recipe.time) {
                furnace.cook = 0;
                smelted = true;
                consumeOne(slots, 0);
                if (slots[2]) slots[2].count++;
                else slots[2] = { id: recipe.result, count: 1 };
                changed = true;
            }
        } else {
            furnace.cook = Math.max(0, furnace.cook - dt * 2);
        }
    } else {
        furnace.cook = Math.max(0, furnace.cook - dt * 2);
    }

    return { changed, litChanged: wasLit !== (furnace.burn > 0), smelted };
}

function consumeOne(slots, index) {
    const stack = slots[index];
    if (!stack) return false;
    stack.count--;
    if (stack.count <= 0) slots[index] = null;
    return true;
}

/**
 * Chunk que contém o forno, a partir da chave `"x,y,z"`.
 *
 * As coordenadas ficam em cache no registro (`cx`/`cz`) para o laço de
 * atualização não ficar quebrando a string de todo forno a cada quadro. O save
 * grava só `slots`/`burn`/`burnMax`/`cook`, então o cache não vai para o disco.
 */
export function furnaceChunk(furnace, key, chunkSize) {
    if (!Number.isInteger(furnace.cx) || !Number.isInteger(furnace.cz)) {
        const [x, , z] = String(key).split(',').map(Number);
        if (!Number.isFinite(x) || !Number.isFinite(z) || !(chunkSize > 0)) return null;
        furnace.cx = floorDiv(x, chunkSize);
        furnace.cz = floorDiv(z, chunkSize);
    }
    return { cx: furnace.cx, cz: furnace.cz };
}
