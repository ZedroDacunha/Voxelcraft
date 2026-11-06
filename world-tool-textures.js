// Arte das FERRAMENTAS (começando pela picareta).
//
// Módulo puro (sem DOM, sem THREE): devolve os pixels do ícone para o
// `world-textures.js` montar no atlas. Assim a arte pode ser testada no Node.
//
// A forma é **transcrita pixel a pixel** do desenho clássico da picareta (sprite
// 16×16). Um desenho só para todos os materiais — o que muda é a paleta, que tem
// nove tons: o contorno (`O`), quatro da cabeça (`1`…`4`, do escuro ao reflexo) e
// quatro do cabo (`a`…`d`, do escuro ao claro).
//
// Conferido contra os sprites originais: esta grade + as paletas abaixo
// reproduzem cada um deles **pixel a pixel** (nenhum símbolo com duas cores).

/**
 * 16×16. `.` vazio · `O` contorno · `1`…`4` cabeça (escuro → reflexo) ·
 * `a`…`d` cabo (escuro → claro).
 *
 * A cabeça é a barra horizontal de cima com a haste que desce pela direita; o
 * cabo é a diagonal que vai do canto de cima (atrás da cabeça) até a quina de
 * baixo à esquerda.
 */
export const PICARETA_GRADE = Object.freeze([
    '................',
    '................',
    '......11111.....',
    '.....1432231bc..',
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

/** O cabo é o mesmo em todas as ferramentas: madeira (tons do desenho clássico). */
export const CABO_PALETA = Object.freeze({
    a: Object.freeze([40, 30, 11]),
    b: Object.freeze([73, 54, 21]),
    c: Object.freeze([104, 78, 30]),
    d: Object.freeze([137, 103, 39]),
});

/**
 * Paleta por material: contorno + quatro tons de cabeça + o cabo de madeira.
 *
 * De `wood` a `diamond` são os tons do desenho clássico, um a um — inclusive o
 * cabo, que na picareta de madeira é um pouco mais quente. O `copper` não existe
 * lá (o jogo clássico não tem picareta de cobre) e foi derivado com a cor do cobre
 * fundido dos lingotes.
 */
export const PICARETA_PALETAS = Object.freeze({
    wood: Object.freeze({
        O: Object.freeze([32, 24, 10]),
        1: Object.freeze([55, 41, 16]),
        2: Object.freeze([106, 80, 30]),
        3: Object.freeze([117, 88, 33]),
        4: Object.freeze([136, 102, 38]),
        // Na picareta de madeira o cabo usa dois tons um pouco mais quentes que o
        // das outras — é assim no desenho clássico, e é o que a deixa fiel.
        c: Object.freeze([106, 80, 30]),
        d: Object.freeze([136, 102, 38]),
    }),
    stone: Object.freeze({
        O: Object.freeze([24, 24, 24]),
        1: Object.freeze([73, 73, 73]),
        2: Object.freeze([127, 127, 127]),
        3: Object.freeze([137, 137, 137]),
        4: Object.freeze([154, 154, 154]),
    }),
    copper: Object.freeze({
        O: Object.freeze([58, 28, 20]),
        1: Object.freeze([86, 42, 28]),
        2: Object.freeze([168, 88, 54]),
        3: Object.freeze([198, 118, 76]),
        4: Object.freeze([232, 164, 116]),
    }),
    iron: Object.freeze({
        O: Object.freeze([24, 24, 24]),
        1: Object.freeze([68, 68, 68]),
        2: Object.freeze([193, 193, 193]),
        3: Object.freeze([216, 216, 216]),
        4: Object.freeze([255, 255, 255]),
    }),
    gold: Object.freeze({
        O: Object.freeze([63, 46, 14]),
        1: Object.freeze([130, 93, 22]),
        2: Object.freeze([233, 177, 21]),
        3: Object.freeze([234, 238, 87]),
        4: Object.freeze([253, 255, 118]),
    }),
    diamond: Object.freeze({
        O: Object.freeze([8, 37, 32]),
        1: Object.freeze([14, 63, 54]),
        2: Object.freeze([39, 178, 154]),
        3: Object.freeze([43, 199, 172]),
        4: Object.freeze([51, 235, 203]),
    }),
});

/** Os materiais que já têm picareta desenhada à mão. */
export function pickaxeMateriais() {
    return Object.keys(PICARETA_PALETAS);
}

/** A grade da picareta (para o teste conferir), ou `null` se o material não tem arte. */
export function pickaxeGradeFor(material) {
    return PICARETA_PALETAS[material] ? PICARETA_GRADE : null;
}

/** A paleta da picareta de um material, ou `null`. */
export function pickaxePaletteFor(material) {
    return PICARETA_PALETAS[material] ?? null;
}

/**
 * Pixels do ícone (16×16, cada célula `[r,g,b]` ou `null`), ou `null` se o
 * material não tem arte — aí quem chama usa a arte antiga.
 */
export function createPickaxeSpritePixels(material) {
    const cores = PICARETA_PALETAS[material];
    if (!cores) return null;
    // O cabo base vem primeiro: se o material traz os seus tons de cabo (a
    // madeira traz), eles vencem.
    const paleta = { ...CABO_PALETA, ...cores };
    return PICARETA_GRADE.map((linha) => Array.from(linha, (c) => (c === '.' ? null : [...paleta[c]])));
}
