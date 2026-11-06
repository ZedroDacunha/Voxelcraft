// Arte das FERRAMENTAS: picareta, machado e pá.
//
// Módulo puro (sem DOM, sem THREE): devolve os pixels do ícone para o
// `world-textures.js` montar no atlas. Assim a arte pode ser testada no Node.
//
// Esta arte é **nossa**. Não é transcrição de sprite nenhum: as formas, as
// paletas, o contorno e os detalhes foram desenhados para o Voxelcraft, seguindo
// as regras do `GUIA-DE-ARTE.md`:
//
// - **silhueta própria** — nenhuma ferramenta repete as proporções clássicas;
// - **contorno tingido** (`O`) — a sombra do material, nunca preto puro;
// - **quatro tons** (`1`…`4`, do escuro ao claro) mais **um acento** (`5`), um
//   amarelo-cítrico que só o nosso jogo tem;
// - **cabo de madeira** (`a`…`d`) com **faixas de couro costuradas** (`g`
//   couro, `s` costura) — uma logo abaixo do encaixe e outra no punho.
//
// Um desenho por ferramenta, para todos os materiais: o que muda é a paleta.

/**
 * A **picareta** — 16×16. `O` contorno · `1`…`4` cabeça · `5` acento ·
 * `a`…`d` cabo · `g`/`s` couro e costura.
 *
 * Duas pontas: a barra sobe da ponta esquerda (embaixo) até a direita (em cima),
 * com o punho no meio e o cabo descendo na diagonal.
 */
export const PICARETA_GRADE = Object.freeze([
    '................',
    '................',
    '.......O53O.....',
    '....O4433221O...',
    '..O33221111O....',
    '.......O2O......',
    '......O21O......',
    '......gsg.......',
    '.....bda........',
    '....bca.........',
    '...bda..........',
    '..bca...........',
    '..gsg...........',
    '.ggg............',
    '................',
    '................',
]);

/**
 * O **machado** — 16×16, mesmo alfabeto da picareta.
 *
 * Lâmina de topo reto, gume alto e convexo à esquerda, afinando para o olho à
 * direita; barba curta embaixo. O cabo sai do olho e desce.
 */
export const MACHADO_GRADE = Object.freeze([
    '................',
    '..O443322O......',
    '.O54433221O.....',
    '.O54432211O.....',
    '..O443221O......',
    '...O3321O.......',
    '....O21O........',
    '.......bda......',
    '......bca.......',
    '.....bda........',
    '....bca.........',
    '....gsg.........',
    '...ggg..........',
    '................',
    '................',
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
    '....O5443221O...',
    '....O5432211O...',
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

/** O cabo de madeira — o mesmo nas três ferramentas. */
export const CABO_PALETA = Object.freeze({
    a: Object.freeze([58, 42, 18]),
    b: Object.freeze([107, 76, 30]),
    c: Object.freeze([154, 113, 48]),
    d: Object.freeze([195, 145, 72]),
});

/** As faixas de couro: `g` o couro, `s` a costura clara. */
export const PUNHO_PALETA = Object.freeze({
    g: Object.freeze([74, 53, 36]),
    s: Object.freeze([190, 150, 96]),
});

/** O acento: um amarelo-cítrico que é a assinatura da casa. */
export const ACENTO = Object.freeze([253, 240, 168]);

/**
 * Paleta de cada material: contorno `O` + quatro tons `1`…`4` (escuro → claro).
 *
 * O contorno é **tingido**: puxa a cor do material (pedra azulada, ouro
 * esverdeado, diamante ciano-escuro) em vez de preto puro.
 */
export const PICARETA_PALETAS = Object.freeze({
    wood: Object.freeze({
        O: Object.freeze([52, 40, 26]),
        1: Object.freeze([107, 74, 44]),
        2: Object.freeze([148, 104, 58]),
        3: Object.freeze([187, 138, 77]),
        4: Object.freeze([216, 176, 117]),
    }),
    stone: Object.freeze({
        O: Object.freeze([42, 45, 52]),
        1: Object.freeze([86, 93, 104]),
        2: Object.freeze([125, 133, 146]),
        3: Object.freeze([163, 171, 184]),
        4: Object.freeze([201, 208, 218]),
    }),
    copper: Object.freeze({
        O: Object.freeze([63, 42, 28]),
        1: Object.freeze([140, 79, 46]),
        2: Object.freeze([192, 125, 76]),
        3: Object.freeze([221, 159, 104]),
        4: Object.freeze([241, 192, 142]),
    }),
    iron: Object.freeze({
        O: Object.freeze([38, 44, 52]),
        1: Object.freeze([85, 96, 111]),
        2: Object.freeze([139, 149, 163]),
        3: Object.freeze([179, 188, 200]),
        4: Object.freeze([213, 220, 229]),
    }),
    gold: Object.freeze({
        O: Object.freeze([64, 50, 15]),
        1: Object.freeze([143, 106, 18]),
        2: Object.freeze([216, 165, 33]),
        3: Object.freeze([242, 204, 78]),
        4: Object.freeze([255, 228, 134]),
    }),
    diamond: Object.freeze({
        O: Object.freeze([16, 51, 47]),
        1: Object.freeze([24, 122, 108]),
        2: Object.freeze([43, 184, 165]),
        3: Object.freeze([95, 224, 203]),
        4: Object.freeze([180, 245, 231]),
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
    return { ...CABO_PALETA, ...PUNHO_PALETA, ...cores, 5: ACENTO };
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
