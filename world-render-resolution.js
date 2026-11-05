// Resolução de renderização.
//
// O navegador não deixa a página mudar a resolução da janela ou do sistema —
// isso é do sistema operacional. O que dá para escolher é outra coisa, e é o que
// esta opção faz: **quantos pixels o jogo desenha** antes de a imagem ser
// esticada para a tela.
//
//   1280×720 num monitor 1920×1080  → desenha 0,9 M de pixels em vez de 2,1 M:
//                                     mais rápido, mais macio (upscale)
//   3840×2160 numa tela 1080p       → desenha o dobro: imagem mais definida,
//                                     mais caro (supersampling)
//
// A imagem é sempre **esticada** para ocupar a tela inteira (decisão do
// jogador): sem faixas pretas, mesmo quando a proporção escolhida difere da
// tela. Ficam registradas as resoluções comuns de monitor, de 360p a 4K, e a
// "Janela", que devolve o canvas ao tamanho da tela com a escala automática de
// qualidade — o comportamento de antes desta opção existir.

export const RESOLUTION_AUTO = 'auto';

// Ordenadas por número de pixels: a barra das opções anda da mais leve para a
// mais pesada, do jeito que se lê uma escada de resolução.
export const RESOLUTION_MODES = Object.freeze([
    Object.freeze({ id: RESOLUTION_AUTO, width: 0, height: 0, label: 'Janela (nativa)' }),
    Object.freeze({ id: '640x360', width: 640, height: 360 }),
    Object.freeze({ id: '854x480', width: 854, height: 480 }),
    Object.freeze({ id: '960x540', width: 960, height: 540 }),
    Object.freeze({ id: '1024x576', width: 1024, height: 576 }),
    Object.freeze({ id: '1024x768', width: 1024, height: 768 }),
    Object.freeze({ id: '1280x720', width: 1280, height: 720 }),
    Object.freeze({ id: '1366x768', width: 1366, height: 768 }),
    Object.freeze({ id: '1440x900', width: 1440, height: 900 }),
    Object.freeze({ id: '1600x900', width: 1600, height: 900 }),
    Object.freeze({ id: '1680x1050', width: 1680, height: 1050 }),
    Object.freeze({ id: '1600x1200', width: 1600, height: 1200 }),
    Object.freeze({ id: '1920x1080', width: 1920, height: 1080 }),
    Object.freeze({ id: '1920x1200', width: 1920, height: 1200 }),
    Object.freeze({ id: '2048x1152', width: 2048, height: 1152 }),
    Object.freeze({ id: '2560x1440', width: 2560, height: 1440 }),
    Object.freeze({ id: '2560x1600', width: 2560, height: 1600 }),
    Object.freeze({ id: '2880x1620', width: 2880, height: 1620 }),
    Object.freeze({ id: '3440x1440', width: 3440, height: 1440 }),
    Object.freeze({ id: '3840x2160', width: 3840, height: 2160 }),
]);

export const RESOLUTION_IDS = Object.freeze(RESOLUTION_MODES.map(mode => mode.id));

export function resolutionMode(id) {
    return RESOLUTION_MODES.find(mode => mode.id === id) ?? RESOLUTION_MODES[0];
}

/** Texto da resolução na tela: "1280×720" ou "Janela (nativa)". */
export function resolutionLabel(id) {
    const mode = resolutionMode(id);
    return mode.label ?? `${mode.width}×${mode.height}`;
}

/** Tamanho em pixels da resolução escolhida; `null` em "Janela (nativa)". */
export function resolutionSize(id) {
    const mode = resolutionMode(id);
    return mode.id === RESOLUTION_AUTO ? null : { width: mode.width, height: mode.height };
}

/**
 * O que entregar ao `renderer`: em "Janela" o tamanho da tela com a escala de
 * qualidade (`pixelRatio`); numa resolução fixa, exatamente o tamanho escolhido
 * com `pixelRatio` 1 — senão a escala automática multiplicaria por cima e a
 * resolução escolhida deixaria de ser a escolhida.
 */
export function renderTarget(resolution, { width, height, scale = 1 } = {}) {
    const size = resolutionSize(resolution);
    const w = Number(width) > 0 ? Math.round(Number(width)) : 1;
    const h = Number(height) > 0 ? Math.round(Number(height)) : 1;
    const autoScale = Number(scale) > 0 ? Number(scale) : 1;
    if (!size) return { auto: true, width: w, height: h, pixelRatio: autoScale };
    return { auto: false, width: size.width, height: size.height, pixelRatio: 1 };
}

/**
 * Proporção que a câmera deve usar: a do alvo, não a da janela. Numa resolução
 * fixa 4:3 numa janela 16:9, a câmera enxerga 4:3 e o esticamento para a tela
 * acontece depois — é o que o jogador escolheu ao pedir para esticar.
 */
export function renderAspect(target) {
    const w = Number(target?.width);
    const h = Number(target?.height);
    if (!(w > 0) || !(h > 0)) return 1;
    return w / h;
}
