#!/usr/bin/env node
// Gera os ícones do PWA (bloco de grama em perspectiva) em PNG, sem dependência:
// zlib da biblioteca padrão escreve o arquivo.
//
//   node tools/make-icons.mjs
//
// Os PNGs ficam versionados junto do resto do site — o jogo não roda este script,
// ele só existe para que os ícones sejam reproduzíveis (e para trocar tamanho,
// fundo ou margem sem editor de imagem).
//
// A arte mora em `tools/grass-block.png`: um bloco de grama isométrico em pixel
// art, 128×128, com fundo transparente. O gerador só reamostra essa imagem (área
// média, que preserva o pixel art) e compõe os fundos — nenhuma cor de bloco é
// desenhada em código.
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
//
// O favicon (32) sai **chapado** de propósito: a textura do bloco em 16 px vira
// sujeira, então as cores são reduzidas a uma paleta de cinco tons.
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT_DIR = path.join(ROOT, 'icons');
const ART_FILE = new URL('./grass-block.png', import.meta.url);

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

/**
 * PNG RGBA de 8 bits → `{ width, height, pixels }`.
 * A arte do bloco é gravada com filtro 0 em todas as linhas (igual ao que este
 * script escreve); qualquer outro filtro daria ícone errado em silêncio, então
 * o erro é explícito.
 */
export function decodePng(buffer) {
    let offset = 8;
    let header = null;
    const data = [];
    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const body = buffer.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            header = {
                width: body.readUInt32BE(0),
                height: body.readUInt32BE(4),
                bitDepth: body[8],
                colorType: body[9],
                interlace: body[12],
            };
        } else if (type === 'IDAT') {
            data.push(body);
        } else if (type === 'IEND') {
            break;
        }
        offset += 12 + length;
    }
    if (!header) throw new Error('PNG sem IHDR');
    if (header.bitDepth !== 8 || header.colorType !== 6 || header.interlace !== 0) {
        throw new Error(`arte do ícone em formato não suportado: profundidade ${header.bitDepth}, cor ${header.colorType}`);
    }
    const { width, height } = header;
    const raw = inflateSync(Buffer.concat(data));
    const stride = width * 4;
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        if (filter !== 0) throw new Error(`arte do ícone com filtro ${filter} na linha ${y}: regrave com filtro 0`);
        raw.copy(pixels, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    }
    return { width, height, pixels };
}

// --- arte ------------------------------------------------------------------

const hex = (value) => [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
];

/** Paleta do favicon: cinco tons, o suficiente para ler o bloco em 16 px. */
const FLAT_PALETTE = ['#6ba338', '#4a7825', '#8a6140', '#5b4029', '#241f1a'].map(hex);

function shade(rgb, factor) {
    return [
        Math.max(0, Math.min(255, Math.round(rgb[0] * factor))),
        Math.max(0, Math.min(255, Math.round(rgb[1] * factor))),
        Math.max(0, Math.min(255, Math.round(rgb[2] * factor))),
    ];
}

const art = decodePng(readFileSync(ART_FILE));

/**
 * Cor média da arte numa área normalizada (0..1), já sem pré-multiplicar o alfa.
 * Área média (e não o pixel mais próximo) é o que deixa o bloco legível nos
 * ícones pequenos — em 32 px cada pixel do ícone cobre vários da arte.
 */
function sampleArt(u0, v0, u1, v1) {
    const { width, height, pixels } = art;
    const x0 = Math.max(0, Math.floor(u0 * width));
    const x1 = Math.min(width, Math.ceil(u1 * width));
    const y0 = Math.max(0, Math.floor(v0 * height));
    const y1 = Math.min(height, Math.ceil(v1 * height));
    if (x1 <= x0 || y1 <= y0) return null;

    let r = 0, g = 0, b = 0, a = 0, peso = 0;
    for (let y = y0; y < y1; y++) {
        const wy = Math.min(y + 1, v1 * height) - Math.max(y, v0 * height);
        if (wy <= 0) continue;
        for (let x = x0; x < x1; x++) {
            const wx = Math.min(x + 1, u1 * width) - Math.max(x, u0 * width);
            if (wx <= 0) continue;
            const w = wx * wy;
            const at = (y * width + x) * 4;
            const alpha = pixels[at + 3] / 255;
            r += pixels[at] * alpha * w;
            g += pixels[at + 1] * alpha * w;
            b += pixels[at + 2] * alpha * w;
            a += alpha * w;
            peso += w;
        }
    }
    if (peso === 0 || a === 0) return null;
    return { rgb: [r / a, g / a, b / a], alpha: a / peso };
}

function nearestFlat(rgb) {
    let best = FLAT_PALETTE[0];
    let dist = Infinity;
    for (const color of FLAT_PALETTE) {
        const d = (color[0] - rgb[0]) ** 2 + (color[1] - rgb[1]) ** 2 + (color[2] - rgb[2]) ** 2;
        if (d < dist) { dist = d; best = color; }
    }
    return best;
}

/**
 * Ícone do jogo: o bloco de grama de `tools/grass-block.png` reamostrado.
 * @param {number} size lado do PNG
 * @param {{ background?: string|null, blockRatio?: number, texture?: boolean }} options
 *   `background`: cor de fundo (ou `null` para transparente);
 *   `blockRatio`: quanto do quadro o bloco ocupa;
 *   `texture`: mantém as cores da arte; desligado, reduz a uma paleta de cinco
 *   tons (é o que salva o favicon em 16 px).
 */
export function renderIcon(size, { background = null, blockRatio = 0.86, texture = true } = {}) {
    const rgba = Buffer.alloc(size * size * 4);
    const side = Math.max(1, Math.round(size * blockRatio));
    const off = (size - side) / 2;
    const skyColor = background ? hex(background) : null;

    for (let y = 0; y < size; y++) {
        const sky = skyColor ? shade(skyColor, 1 - (y / size) * 0.18) : null;
        for (let x = 0; x < size; x++) {
            const index = (y * size + x) * 4;
            const u0 = (x - off) / side;
            const u1 = (x + 1 - off) / side;
            const v0 = (y - off) / side;
            const v1 = (y + 1 - off) / side;
            const bloco = u1 > 0 && u0 < 1 && v1 > 0 && v0 < 1
                ? sampleArt(Math.max(0, u0), Math.max(0, v0), Math.min(1, u1), Math.min(1, v1))
                : null;

            let color;
            if (!bloco) {
                color = sky;
            } else if (sky) {
                // compõe o bloco sobre o céu
                color = [0, 1, 2].map((i) => bloco.rgb[i] * bloco.alpha + sky[i] * (1 - bloco.alpha));
            } else {
                color = bloco.rgb;
            }
            if (!color) continue; // transparente

            if (!texture) {
                if ((bloco ? bloco.alpha : 1) < 0.5) continue;
                color = nearestFlat(color);
            }

            rgba[index] = Math.round(color[0]);
            rgba[index + 1] = Math.round(color[1]);
            rgba[index + 2] = Math.round(color[2]);
            rgba[index + 3] = 255;
        }
    }
    return encodePng(size, size, rgba);
}

export const ICON_TARGETS = [
    // Desktop: fundo transparente, bloco grande.
    { file: 'icon-192.png', size: 192, options: { blockRatio: 0.92 } },
    { file: 'icon-512.png', size: 512, options: { blockRatio: 0.92 } },
    // Android: fundo cheio, bloco dentro do círculo seguro de 80%
    // (o conteúdo da arte alcança 0,544 do lado, então 0,68 × 0,544 = 0,37 do quadro).
    { file: 'icon-maskable-512.png', size: 512, options: { background: '#87ceeb', blockRatio: 0.68 } },
    // iOS: sem transparência (alpha 0 viraria preto na tela de início).
    { file: 'apple-touch-icon-180.png', size: 180, options: { background: '#87ceeb', blockRatio: 0.72 } },
    // Aba do navegador: chapado, sem textura, que em 16 px vira sujeira.
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
