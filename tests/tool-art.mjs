// Ajudantes dos testes de arte das ferramentas — não é arquivo de teste.

/** Linhas da grade que têm desenho: quantas células cada uma ocupa. */
export const silhueta = (grade) => grade.map((linha) => [...linha].filter((c) => c !== '.').length);

/** Total de células desenhadas. */
export const cheios = (grade) => grade.join('').split('').filter((c) => c !== '.').length;

/** A ferramenta é uma peça só? Devolve quantas células a busca alcança. */
export function pecaUnica(grade, partida = null) {
    const dentro = (x, y) => (grade[y]?.[x] ?? '.') !== '.';
    let inicio = partida;
    if (!inicio) {
        for (let y = 0; y < grade.length && !inicio; y++) {
            const x = [...grade[y]].findIndex((c) => c !== '.');
            if (x >= 0) inicio = [x, y];
        }
    }
    const vistos = new Set([inicio.join(',')]);
    const pilha = [inicio];
    let total = 0;
    while (pilha.length) {
        const [x, y] = pilha.pop();
        total++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dentro(nx, ny) || vistos.has(`${nx},${ny}`)) continue;
            vistos.add(`${nx},${ny}`);
            pilha.push([nx, ny]);
        }
    }
    return total;
}

/** Os símbolos que a grade usa, em ordem. */
export const simbolosDe = (grade) => [...new Set(grade.join('').split('').filter((c) => c !== '.'))].sort();

/** Luminância percebida. */
export const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/** Hex de uma cor [r,g,b]. */
export const hex = (c) => c.map((v) => v.toString(16).padStart(2, '0')).join('');

/**
 * As silhuetas do sprite clássico, só como NÚMEROS (quantas células por linha).
 * Servem para provar que a nossa arte não é a mesma peça.
 */
export const SILHUETA_CLASSICA = {
    picareta: [0, 0, 5, 9, 8, 4, 6, 6, 6, 6, 6, 4, 3, 3, 2, 0],
    machado: [0, 2, 4, 5, 7, 7, 7, 6, 5, 3, 3, 3, 3, 3, 2, 0],
    pa: [0, 0, 3, 5, 6, 7, 5, 5, 4, 3, 3, 3, 4, 3, 2, 0],
};

/** Quantas linhas da silhueta diferem das do clássico. */
export const linhasDiferentes = (nossa, classica) => nossa.filter((v, i) => v !== classica[i]).length;
