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
            carne: Object.freeze([178, 66, 62]),
            borda: Object.freeze([122, 38, 40]),
            gordura: Object.freeze([236, 198, 178]),
            osso: Object.freeze([236, 232, 218]),
        }),
        cooked: Object.freeze({
            carne: Object.freeze([150, 84, 42]),
            borda: Object.freeze([96, 50, 22]),
            gordura: Object.freeze([214, 166, 108]),
            osso: Object.freeze([210, 186, 146]),
            marca: Object.freeze([66, 34, 14]),
        }),
    }),
});
