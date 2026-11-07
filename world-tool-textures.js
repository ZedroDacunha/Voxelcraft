// Arte das FERRAMENTAS: picareta, machado e pá.
//
// Módulo puro (sem DOM, sem THREE): devolve os pixels do ícone para o
// `world-textures.js` montar no atlas. Assim a arte pode ser testada no Node.
//
// A arte segue o `GUIA-DE-ARTE.md`, com duas famílias de desenho:
//
// - **picareta**, **machado** e **pá** — **base fiel** do sprite clássico com
//   **pequenos ajustes**: mesmo desenho, 2 px de forma e paleta própria. Foi a
//   decisão do usuário em 07/11/2026: continuar com a leitura clássica e mudar só
//   o suficiente para a peça ser nossa.
//
// As regras valem para as três: **contorno tingido** (`O`, nunca preto puro),
// **quatro tons** (`1`…`4`, do escuro ao claro) e o **cabo de madeira** (`a`…`d`)
// das tábuas do jogo. Nenhuma ferramenta tem acento.
//
// Um desenho por ferramenta, para todos os materiais: o que muda é a paleta.

/**
 * A **picareta** — 16×16. `O` contorno · `1`…`4` cabeça · `a`…`d` cabo.
 *
 * É a base fiel do #119 com **dois ajustes de forma**: o topo da cabeça cresce
 * 1 px para a direita (a barra fica com 6 px) e a ponta esquerda ganha 1 px.
 */
export const PICARETA_GRADE = Object.freeze([
    '................',
    '................',
    '......111111....',
    '....11432231bc..',
    '......1OOO22da..',
    '..........b32O..',
    '.........bca23O.',
    '........bda.O2O.',
    '.......bca..O2O.',
    '......bda...O3O.',
    '.....bca....O4O.',
    '....bda......O..',
    '...bca..........',
    '..bda...........',
    '..aa............',
    '................',
]);

/**
 * O **machado** — 16×16, mesmo alfabeto.
 *
 * Também é a **base fiel** do sprite clássico, com **2 pixels** de forma nossa
 * (a receita da picareta): o topo da cabeça fica 1 px mais largo e a barba
 * ganha 1 px à direita. O acento (`5`) fica no canto iluminado do topo, em
 * `(8,2)`, e o cabo é liso — **sem couro**, como a picareta.
 */
export const MACHADO_GRADE = Object.freeze([
    '................',
    '.........111....',
    '........1441....',
    '.......14341....',
    '......14333bc...',
    '......O44323a...',
    '.......OOb323O..',
    '........bca33O..',
    '.......bda.OOO..',
    '......bca.......',
    '.....bca........',
    '....bda.........',
    '...bca..........',
    '..bda...........',
    '..aa............',
    '................',
]);

/**
 * A **pá** — 16×16, mesmo alfabeto.
 *
 * Concha de topo largo e cantos arredondados (o dobro da largura do cabo), com
 * pescoço comprido até a virola. O cabo desce na diagonal com as faixas.
 */
export const PA_GRADE = Object.freeze([
    '................',
    '.....O4431O.....',
    '....O4443221O...',
    '....O4432211O...',
    '....O4322211O...',
    '.....O3221O.....',
    '......O21O......',
    '......O21O......',
    '......O21O......',
    '......bda.......',
    '.....bca........',
    '....bda.........',
    '...bca..........',
    '...gsg..........',
    '..ggg...........',
    '................',
]);

/**
 * O cabo de madeira — o mesmo nas três ferramentas.
 *
 * Os quatro tons são **os da tábua do jogo** (`TILE.PLANKS`, em
 * `world-textures.js`): o cabo é feito do mesmo material do chão. Decisão de
 * 07/11/2026 — até então o cabo era mais escuro e mais saturado que a tábua, e a
 * ferramenta na mão não combinava com o chão de madeira.
 */
export const CABO_PALETA = Object.freeze({
    a: Object.freeze([86, 62, 34]),
    b: Object.freeze([123, 91, 51]),
    c: Object.freeze([151, 116, 67]),
    d: Object.freeze([202, 166, 106]),
});

/** As faixas de couro: `g` o couro, `s` a costura clara. */
export const PUNHO_PALETA = Object.freeze({
    g: Object.freeze([74, 53, 36]),
    s: Object.freeze([190, 150, 96]),
});

/**
 * Paleta de cada material: contorno `O` + quatro tons `1`…`4` (escuro → claro).
 *
 * A paleta é **suave**: fica perto da clássica de propósito, para a ferramenta
 * manter a leitura, mas desloca o matiz o suficiente para a peça ser nossa — e
 * nos metais o desvio é o mais visível (ferro azulado, ouro mais quente,
 * diamante mais verde-azulado, cobre mais alaranjado). O contorno é **tingido**:
 * a sombra do material, nunca preto puro.
 */
export const PICARETA_PALETAS = Object.freeze({
    // A madeira imita as **tábuas do jogo** (TILE.PLANKS): o mesmo castanho
    // claro e quente da tábua, do veio escuro ao topo iluminado.
    wood: Object.freeze({
        O: Object.freeze([86, 62, 34]),
        1: Object.freeze([123, 91, 51]),
        2: Object.freeze([151, 116, 67]),
        3: Object.freeze([175, 140, 88]),
        4: Object.freeze([202, 166, 106]),
    }),
    stone: Object.freeze({
        O: Object.freeze([58, 56, 52]),
        1: Object.freeze([82, 81, 78]),
        2: Object.freeze([126, 124, 119]),
        3: Object.freeze([140, 138, 132]),
        4: Object.freeze([163, 160, 153]),
    }),
    copper: Object.freeze({
        O: Object.freeze([70, 38, 24]),
        1: Object.freeze([122, 62, 38]),
        2: Object.freeze([190, 112, 66]),
        3: Object.freeze([208, 146, 96]),
        4: Object.freeze([232, 178, 130]),
    }),
    iron: Object.freeze({
        O: Object.freeze([40, 45, 53]),
        1: Object.freeze([66, 72, 82]),
        2: Object.freeze([186, 194, 203]),
        3: Object.freeze([206, 214, 222]),
        4: Object.freeze([238, 243, 248]),
    }),
    gold: Object.freeze({
        O: Object.freeze([78, 50, 12]),
        1: Object.freeze([152, 98, 16]),
        2: Object.freeze([232, 166, 28]),
        3: Object.freeze([242, 198, 72]),
        4: Object.freeze([255, 238, 128]),
    }),
    diamond: Object.freeze({
        O: Object.freeze([12, 56, 56]),
        1: Object.freeze([16, 98, 96]),
        2: Object.freeze([34, 188, 174]),
        3: Object.freeze([48, 212, 196]),
        4: Object.freeze([92, 240, 220]),
    }),
});

/** O machado usa a mesma paleta de material da picareta. */
export const MACHADO_PALETAS = PICARETA_PALETAS;

/** A pá também: uma paleta de material para a família toda. */
export const PA_PALETAS = PICARETA_PALETAS;

/** A paleta completa de um material (material + cabo + couro + acento), ou `null`. */
function paletaCompleta(paletas, material) {
    const cores = paletas[material];
    if (!cores) return null;
    return { ...CABO_PALETA, ...PUNHO_PALETA, ...cores };
}

/** Pinta uma grade com a paleta; `.` vira transparente. */
function pintar(grade, paleta) {
    return grade.map((linha) => Array.from(linha, (c) => (c === '.' ? null : [...paleta[c]])));
}

/** Os materiais que já têm arte. */
export function pickaxeMateriais() {
    return Object.keys(PICARETA_PALETAS);
}

/** A grade da picareta, ou `null` se o material não tem arte. */
export function pickaxeGradeFor(material) {
    return PICARETA_PALETAS[material] ? PICARETA_GRADE : null;
}

/** A paleta da picareta de um material, ou `null`. */
export function pickaxePaletteFor(material) {
    return PICARETA_PALETAS[material] ?? null;
}

/** Pixels da picareta (16×16), ou `null` se o material não tem arte. */
export function createPickaxeSpritePixels(material) {
    const paleta = paletaCompleta(PICARETA_PALETAS, material);
    return paleta ? pintar(PICARETA_GRADE, paleta) : null;
}

/** A grade do machado, ou `null`. */
export function axeGradeFor(material) {
    return MACHADO_PALETAS[material] ? MACHADO_GRADE : null;
}

/** A paleta do machado de um material, ou `null`. */
export function axePaletteFor(material) {
    return MACHADO_PALETAS[material] ?? null;
}

/** Pixels do machado (16×16), ou `null` se o material não tem arte. */
export function createAxeSpritePixels(material) {
    const paleta = paletaCompleta(MACHADO_PALETAS, material);
    return paleta ? pintar(MACHADO_GRADE, paleta) : null;
}

/** A grade da pá, ou `null`. */
export function shovelGradeFor(material) {
    return PA_PALETAS[material] ? PA_GRADE : null;
}

/** A paleta da pá de um material, ou `null`. */
export function shovelPaletteFor(material) {
    return PA_PALETAS[material] ?? null;
}

/** Pixels da pá (16×16), ou `null` se o material não tem arte. */
export function createShovelSpritePixels(material) {
    const paleta = paletaCompleta(PA_PALETAS, material);
    return paleta ? pintar(PA_GRADE, paleta) : null;
}
