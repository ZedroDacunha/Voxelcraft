// Decodificador de PNG para os testes — só o necessário para conferir os
// ícones que o próprio projeto gera (`tools/make-icons.mjs`).
//
// Os ícones são RGBA de 8 bits, sem entrelaçamento e com filtro 0 em todas as
// linhas, então decodificar é: ler os pedaços, inflar o IDAT e andar pelas
// linhas. Se alguém trocar o formato do arquivo, o teste avisa em vez de passar
// olhando para dados embaralhados.
import { inflateSync } from 'node:zlib';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PNG (RGBA 8 bits, filtro 0) → `{ width, height, pixels, pixel(x, y) }`. */
export function decodePng(buffer) {
    for (let i = 0; i < SIGNATURE.length; i++) {
        if (buffer[i] !== SIGNATURE[i]) throw new Error('não é um PNG');
    }

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
        throw new Error(`formato não suportado: profundidade ${header.bitDepth}, cor ${header.colorType}, entrelace ${header.interlace}`);
    }

    const { width, height } = header;
    const raw = inflateSync(Buffer.concat(data));
    const stride = width * 4;
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        if (filter !== 0) throw new Error(`filtro ${filter} na linha ${y}: o decodificador só entende filtro 0`);
        raw.copy(pixels, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    }

    return {
        width,
        height,
        pixels,
        pixel(x, y) {
            const at = (y * width + x) * 4;
            return [pixels[at], pixels[at + 1], pixels[at + 2], pixels[at + 3]];
        },
    };
}

/** Quantas cores RGBA diferentes a imagem tem (transparente conta como uma). */
export function distinctColors(image) {
    const seen = new Set();
    for (let i = 0; i < image.pixels.length; i += 4) {
        seen.add(image.pixels.readUInt32BE(i));
    }
    return seen.size;
}
