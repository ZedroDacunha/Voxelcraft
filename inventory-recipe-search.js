/** Normaliza texto de receitas para busca tolerante a caixa, acentos e espaços. */
export function normalizeRecipeSearchText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLocaleLowerCase('pt-BR')
        .trim()
        .replace(/\s+/g, ' ');
}

/**
 * Cria um índice pesquisável sem depender do DOM.
 * Cada entrada recebe uma referência opaca (`entry`), a seção à qual pertence
 * (`section`) e o texto visível que deve participar da busca (`text`).
 */
export function createRecipeSearchIndex(entries) {
    return entries.map(({ entry, section, text }) => ({
        entry,
        section,
        text: normalizeRecipeSearchText(text),
    }));
}

/**
 * Filtra o índice por todos os termos digitados, em qualquer ordem.
 * Retorna conjuntos de referências visíveis para a camada de interface aplicar.
 */
export function filterRecipeSearch(index, query) {
    const terms = normalizeRecipeSearchText(query).split(' ').filter(Boolean);
    const visibleEntries = new Set();
    const visibleSections = new Set();

    for (const record of index) {
        const matches = terms.every(term => record.text.includes(term));
        if (!matches) continue;
        visibleEntries.add(record.entry);
        visibleSections.add(record.section);
    }

    return {
        visibleEntries,
        visibleSections,
        hasResults: visibleEntries.size > 0,
    };
}
