/**
 * As carnes do jogo — crua e **assada** — e a regra de forno que liga uma na
 * outra.
 *
 * Cada bicho que solta carne entra aqui com **duas** entradas de item: a crua
 * (o que o corpo derruba) e a assada (o que sai do forno). O forno não sabe de
 * bicho nenhum: ele lê `MEAT_SMELTING`, que é gerado desta tabela. Mob novo que
 * solta carne = **uma entrada aqui** — item, receita de forno, receita do livro
 * e arte do atlas saem de graça, desde que o `sprite.kind` tenha cores em
 * `MEAT_SPRITE_CORES`.
 *
 * A faixa de IDs é reservada (100–116, oito bichos × duas entradas) para que
 * nenhuma carne nova precise disputar número com bloco, ferramenta ou minério.
 */

/** Primeiro id da faixa das carnes; cada bicho ocupa dois (crua, assada). */
export const MEAT_ID_BASE = 100;

/** Último id da faixa — oito bichos. */
export const MEAT_ID_END = 116;

/**
 * A tabela das carnes.
 *
 * - `raw`/`cooked`: `idKey` (nome no `ID`), `id`, `name` (o que aparece no jogo),
 *   `food` (`hunger`/`sat`, iguais aos da maçã e dos outros comestíveis) e
 *   `sprite` (`kind` + `mat`; o `mat` `cooked` pede a arte tostada).
 * - `time`: segundos de forno, o mesmo relógio dos minérios.
 */
export const MEATS = Object.freeze([
    Object.freeze({
        key: 'mutton',
        raw: Object.freeze({
            idKey: 'MUTTON', id: 100,
            name: 'Carne de ovelha',
            food: Object.freeze({ hunger: 3, sat: 1.6 }),
            sprite: Object.freeze({ kind: 'mutton', mat: 'meat' }),
        }),
        cooked: Object.freeze({
            idKey: 'COOKED_MUTTON', id: 101,
            name: 'Carne de ovelha assada',
            food: Object.freeze({ hunger: 6, sat: 4 }),
            sprite: Object.freeze({ kind: 'mutton', mat: 'cooked' }),
        }),
        time: 10,
    }),
]);

/** `{ MUTTON: 100, COOKED_MUTTON: 101 }` — entra direto no `ID` do catálogo. */
export const MEAT_IDS = Object.freeze(Object.fromEntries(
    MEATS.flatMap(meat => [[meat.raw.idKey, meat.raw.id], [meat.cooked.idKey, meat.cooked.id]]),
));

/**
 * O que o forno assa: `[{ raw, cooked, time }]`. Quem consome é o `SMELT` do
 * catálogo — e, por tabela, o livro de receitas e a dica do slot do forno.
 */
export const MEAT_SMELTING = Object.freeze(MEATS.map(meat => Object.freeze({
    raw: meat.raw.id,
    cooked: meat.cooked.id,
    time: meat.time,
})));

/**
 * Cores da arte de cada carne, por `kind` do sprite.
 *
 * `raw` é o naco rosado com a ponta do osso aparecendo; `cooked` é o mesmo
 * desenho tostado, com marcas de grelha (`marca`). A silhueta é a mesma de
 * propósito: o olho tem que reconhecer que é o **mesmo** pedaço, só assado.
 */
export const MEAT_SPRITE_CORES = Object.freeze({
    mutton: Object.freeze({
        raw: Object.freeze({
            carne: Object.freeze([208, 76, 74]),
            borda: Object.freeze([92, 25, 32]),
            gordura: Object.freeze([248, 226, 212]),
            osso: Object.freeze([246, 241, 228]),
        }),
        cooked: Object.freeze({
            carne: Object.freeze([166, 92, 46]),
            borda: Object.freeze([62, 28, 14]),
            gordura: Object.freeze([236, 200, 144]),
            osso: Object.freeze([224, 200, 160]),
            marca: Object.freeze([74, 33, 15]),
        }),
    }),
});

/**
 * Arte 16×16 autoral da Carne de Ovelha (Opção B · Costela Rústica em Gota):
 * corte alongado ascendente com espessura 3D inferior, capa de gordura dorsal,
 * marmoreio interno e ponta de costela marfim. A versão assada mantém a mesma
 * silhueta exata, com crosta dourada de Maillard e duas marcas de grelha.
 */
export const MUTTON_SPRITE_GRID = Object.freeze([
    '................',
    '...........ooo..',
    '..........oBBbo.',
    '.........oBBbo..',
    '........OoFfo...',
    '......OOFF3fO...',
    '....OOFF3321O...',
    '...OFF343221O...',
    '..OF33432f11O...',
    '..O3322f221sO...',
    '..O322f211ssO...',
    '..Os22111ssO....',
    '...OssssssO.....',
    '....OOOOOO......',
    '................',
    '................',
]);

export const MUTTON_RAW_PALETTE = Object.freeze({
    O: Object.freeze([92, 25, 32]),
    o: Object.freeze([122, 102, 86]),
    s: Object.freeze([136, 36, 44]),
    '1': Object.freeze([174, 52, 56]),
    '2': Object.freeze([208, 76, 74]),
    '3': Object.freeze([232, 110, 102]),
    '4': Object.freeze([248, 168, 156]),
    f: Object.freeze([230, 184, 168]),
    F: Object.freeze([248, 226, 212]),
    b: Object.freeze([208, 194, 172]),
    B: Object.freeze([246, 241, 228]),
});

export const MUTTON_COOKED_PALETTE = Object.freeze({
    O: Object.freeze([62, 28, 14]),
    o: Object.freeze([94, 66, 40]),
    s: Object.freeze([94, 45, 21]),
    M: Object.freeze([74, 33, 15]),
    '1': Object.freeze([128, 66, 32]),
    '2': Object.freeze([166, 92, 46]),
    '3': Object.freeze([200, 122, 62]),
    '4': Object.freeze([228, 158, 90]),
    f: Object.freeze([208, 162, 108]),
    F: Object.freeze([236, 200, 144]),
    b: Object.freeze([184, 152, 110]),
    B: Object.freeze([224, 200, 160]),
});

const MUTTON_GRILL_MAP = new Map([
    ['4,9', 'M'], ['5,9', '1'], ['5,10', 'M'], ['6,10', '1'],
    ['7,7', 'M'], ['8,7', '1'], ['8,8', 'M'], ['9,8', '1'],
]);

export function createMuttonSpritePixels(cooked = false) {
    const pal = cooked ? MUTTON_COOKED_PALETTE : MUTTON_RAW_PALETTE;
    return Array.from({ length: 16 }, (_, y) =>
        Array.from({ length: 16 }, (_, x) => {
            const ch = MUTTON_SPRITE_GRID[y][x];
            if (ch === '.') return null;
            const sym = cooked ? (MUTTON_GRILL_MAP.get(`${x},${y}`) || ch) : ch;
            return [...pal[sym]];
        })
    );
}

