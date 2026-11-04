#!/usr/bin/env node
// Gera os ícones do PWA (bloco de grama em perspectiva) em PNG, sem dependência:
// zlib da biblioteca padrão escreve o arquivo.
//
//   node tools/make-icons.mjs
//
// Os PNGs ficam versionados junto do resto do site — o jogo não roda este script,
// ele só existe para que os ícones sejam reproduzíveis (e para trocar cor/formato
// sem editor de imagem).
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

// Ruído determinístico por célula de 8 px: dá a textura de "pixel" do bloco sem
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

/**
 * Bloco de grama isométrico.
 * @param {number} size lado do PNG
 * @param {{ background?: string|null, blockRatio?: number }} options
 */
export function renderIcon(size, { background = null, blockRatio = 0.86 } = {}) {
    const rgba = Buffer.alloc(size * size * 4);
    const cx = size / 2;
    const cy = size / 2;
    const half = (size * blockRatio) / 2;
    const w = half * 0.92;
    const h = half * 0.52;

    const top = [[cx, cy - h * 1.15], [cx + w, cy - h * 0.35], [cx, cy + h * 0.45], [cx - w, cy - h * 0.35]];
    const left = [[cx - w, cy - h * 0.35], [cx, cy + h * 0.45], [cx, cy + h * 1.55], [cx - w, cy + h * 0.75]];
    const right = [[cx + w, cy - h * 0.35], [cx, cy + h * 0.45], [cx, cy + h * 1.55], [cx + w, cy + h * 0.75]];

    const grassTop = hex('#7cb342');
    const grassSide = hex('#5e9134');
    const dirt = hex('#8d6748');
    const dirtDark = hex('#6f4f36');
    const sky = hex('#87ceeb');

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = (y * size + x) * 4;
            let color = null;

            if (background) {
                // fundo de céu levemente degradê, para o ícone maskable não ficar chapado
                const t = (y / size) * 0.18;
                color = shade(hex(background), 1 - t);
            }

            const noise = speckle(x, y, size);
            const grain = 0.9 + noise * 0.2;

            if (inPolygon(x, y, top)) {
                color = shade(grassTop, grain * (0.96 + noise * 0.08));
            } else if (inPolygon(x, y, left) || inPolygon(x, y, right)) {
                const face = inPolygon(x, y, left) ? 1 : 0.86;
                // faixa de grama no topo das laterais, como no bloco do jogo
                const surface = y < cy + h * 0.45 + h * 0.22;
                const base = surface ? grassSide : (face === 1 ? dirt : dirtDark);
                color = shade(base, grain * face);
            }

            if (!color) {
                rgba[index + 3] = 0;
                continue;
            }
            rgba[index] = color[0];
            rgba[index + 1] = color[1];
            rgba[index + 2] = color[2];
            rgba[index + 3] = background ? 255 : (background === null && color === sky ? 0 : 255);
        }
    }
    return encodePng(size, size, rgba);
}

const targets = [
    { file: 'icon-192.png', size: 192, options: { blockRatio: 0.92 } },
    { file: 'icon-512.png', size: 512, options: { blockRatio: 0.92 } },
    // maskable: fundo cheio e bloco menor, para o recorte circular do Android
    { file: 'icon-maskable-512.png', size: 512, options: { background: '#87ceeb', blockRatio: 0.62 } },
    { file: 'favicon-32.png', size: 32, options: { blockRatio: 0.98 } },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size, options } of targets) {
    const png = renderIcon(size, options);
    writeFileSync(path.join(OUT_DIR, file), png);
    console.log(`${file}: ${size}x${size}, ${png.length} bytes`);
}
