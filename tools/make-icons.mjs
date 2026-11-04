#!/usr/bin/env node
// Gera os ícones do PWA (bloco de grama em perspectiva) em PNG, sem dependência:
// zlib da biblioteca padrão escreve o arquivo.
//
//   node tools/make-icons.mjs
//
// Os PNGs ficam versionados junto do resto do site — o jogo não roda este script,
// ele só existe para que os ícones sejam reproduzíveis (e para trocar cor/formato
// sem editor de imagem).
//
// Três formatos, porque cada tela recorta de um jeito:
//
// - **`any`** (192 e 512): fundo transparente, bloco grande. É o que aparece em
//   janela, dock e lista de apps do desktop;
// - **`maskable`** (512): fundo cheio e bloco menor, dentro do círculo seguro de
//   80% — o Android recorta em círculo, quadrado arredondado, gota… e o que
//   estiver fora do círculo some. O teste confere o círculo de verdade, pixel a
//   pixel;
// - **`apple-touch-icon`** (180): o iOS **não** respeita transparência — alpha 0
//   vira preto na tela de início. Por isso ele tem fundo de céu e é opaco, e o
//   teste confere que todo pixel tem alpha 255.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT_DIR = path.join(ROOT, 'icons');

// --- PNG -----------------------------------------------------------------

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

/** RGBA cru (8 bits por canal) → PNG. */
export function encodePng(width, height, rgba) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;   // profundidade
    header[9] = 6;   // RGBA
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0; // filtro "none": ícone é pequeno
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// --- desenho -------------------------------------------------------------

const hex = (value) => [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
];

/** Fração determinística 0..1 por coluna: dá a borda irregular da grama. */
function jitter(value) {
    const raw = Math.sin(value * 12.9898) * 43758.5453;
    return raw - Math.floor(raw);
}

// Ruído determinístico por célula: dá a textura de "pixel" do bloco sem
// depender de Math.random (o ícone precisa sair igual toda vez).
function speckle(x, y, size) {
    const cell = Math.max(2, Math.round(size / 24));
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    let h = (cx * 73856093) ^ (cy * 19349663) ^ 0x9e3779b9;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

function shade(rgb, factor) {
    return [
        Math.max(0, Math.min(255, Math.round(rgb[0] * factor))),
        Math.max(0, Math.min(255, Math.round(rgb[1] * factor))),
        Math.max(0, Math.min(255, Math.round(rgb[2] * factor))),
    ];
}

function inPolygon(px, py, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

const GRASS_TOP = hex('#7cb342');
const GRASS_SIDE = hex('#5e9134');
const DIRT = hex('#8d6748');
/** Quanto da lateral é grama (o resto é terra), como na textura do jogo. */
const GRASS_BAND = 0.3;

/**
 * Bloco de grama isométrico.
 * @param {number} size lado do PNG
 * @param {{ background?: string|null, blockRatio?: number, texture?: boolean }} options
 *   `background`: cor de fundo (ou `null` para transparente);
 *   `blockRatio`: quanto do quadro o bloco ocupa;
 *   `texture`: ruído de pixel na superfície (desligado, o ícone fica chapado e
 *   mais legível em tamanho pequeno).
 */
export function renderIcon(size, { background = null, blockRatio = 0.86, texture = true } = {}) {
    const rgba = Buffer.alloc(size * size * 4);
    const cx = size / 2;
    const cy = size / 2;
    const half = (size * blockRatio) / 2;
    const w = half * 0.92;
    const h = half * 0.52;
    const faceHeight = h * 1.1;

    const top = [[cx, cy - h * 1.15], [cx + w, cy - h * 0.35], [cx, cy + h * 0.45], [cx - w, cy - h * 0.35]];
    const left = [[cx - w, cy - h * 0.35], [cx, cy + h * 0.45], [cx, cy + h * 1.55], [cx - w, cy + h * 0.75]];
    const right = [[cx + w, cy - h * 0.35], [cx, cy + h * 0.45], [cx, cy + h * 1.55], [cx + w, cy + h * 0.75]];

    // Borda de cima de cada lateral: as duas arestas que saem do canto da frente.
    const leftTop = (x) => cy - h * 0.35 + ((x - (cx - w)) / w) * h * 0.8;
    const rightTop = (x) => cy + h * 0.45 - ((x - cx) / w) * h * 0.8;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = (y * size + x) * 4;
            let color = background ? shade(hex(background), 1 - (y / size) * 0.18) : null;

            const grain = texture ? 0.9 + speckle(x, y, size) * 0.2 : 1;
            const band = GRASS_BAND + (texture ? jitter(x) * 0.1 - 0.05 : 0);

            if (inPolygon(x, y, top)) {
                color = shade(GRASS_TOP, grain * (texture ? 0.96 + speckle(x, y, size) * 0.08 : 1));
            } else if (inPolygon(x, y, left) || inPolygon(x, y, right)) {
                const isLeft = inPolygon(x, y, left);
                const t = (y - (isLeft ? leftTop(x) : rightTop(x))) / faceHeight;
                // Face da esquerda pega mais luz; a da direita é a sombra do bloco.
                const light = isLeft ? 1 : 0.82;
                color = shade(t < band ? GRASS_SIDE : DIRT, grain * light);
            }

            if (!color) {
                rgba[index + 3] = 0;
                continue;
            }
            rgba[index] = color[0];
            rgba[index + 1] = color[1];
            rgba[index + 2] = color[2];
            rgba[index + 3] = 255;
        }
    }
    return encodePng(size, size, rgba);
}

export const ICON_TARGETS = [
    // Desktop: fundo transparente, bloco grande.
    { file: 'icon-192.png', size: 192, options: { blockRatio: 0.92 } },
    { file: 'icon-512.png', size: 512, options: { blockRatio: 0.92 } },
    // Android: fundo cheio, bloco dentro do círculo seguro de 80%.
    { file: 'icon-maskable-512.png', size: 512, options: { background: '#87ceeb', blockRatio: 0.78 } },
    // iOS: sem transparência (alpha 0 viraria preto na tela de início).
    { file: 'apple-touch-icon-180.png', size: 180, options: { background: '#87ceeb', blockRatio: 0.78 } },
    // Aba do navegador: chapado, sem ruído, que em 16 px vira sujeira.
    { file: 'favicon-32.png', size: 32, options: { blockRatio: 0.98, texture: false } },
];

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
    mkdirSync(OUT_DIR, { recursive: true });
    for (const { file, size, options } of ICON_TARGETS) {
        const png = renderIcon(size, options);
        writeFileSync(path.join(OUT_DIR, file), png);
        console.log(`${file}: ${size}x${size}, ${png.length} bytes`);
    }
}
