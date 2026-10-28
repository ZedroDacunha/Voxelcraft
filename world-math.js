// Funções determinísticas compartilhadas pelo gerador, pelo mundo e pelos recursos visuais.
export function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hash2(x, z, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

export class Noise2D {
    constructor(seed) {
        const rnd = mulberry32(seed);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) {
            const k = Math.floor(rnd() * (i + 1));
            [p[i], p[k]] = [p[k], p[i]];
        }
        this.perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }
    static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    static lerp(t, a, b) { return a + t * (b - a); }
    static grad(h, x, y) {
        switch (h & 7) {
            case 0: return x + y;
            case 1: return -x + y;
            case 2: return x - y;
            case 3: return -x - y;
            case 4: return x * Math.SQRT2;
            case 5: return -x * Math.SQRT2;
            case 6: return y * Math.SQRT2;
            default: return -y * Math.SQRT2;
        }
    }
    noise(x, y) {
        const p = this.perm;
        const fx = Math.floor(x), fy = Math.floor(y);
        const X = fx & 255, Y = fy & 255;
        x -= fx; y -= fy;
        const u = Noise2D.fade(x), v = Noise2D.fade(y);
        const aa = p[p[X] + Y], ab = p[p[X] + Y + 1];
        const ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
        return Noise2D.lerp(v,
            Noise2D.lerp(u, Noise2D.grad(aa, x, y), Noise2D.grad(ba, x - 1, y)),
            Noise2D.lerp(u, Noise2D.grad(ab, x, y - 1), Noise2D.grad(bb, x - 1, y - 1)));
    }
    fbm(x, y, octaves = 4) {
        let sum = 0, amp = 1, freq = 1, norm = 0;
        for (let i = 0; i < octaves; i++) {
            sum += this.noise(x * freq, y * freq) * amp;
            norm += amp; amp *= 0.5; freq *= 2;
        }
        return sum / norm;
    }
}
