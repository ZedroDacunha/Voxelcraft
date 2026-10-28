function recipeSection(title, entries) {
    const section = document.createElement('section');
    section.className = 'recipe-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);
    for (const [main, result, detail] of entries) {
        const row = document.createElement('div');
        row.className = 'recipe-entry';
        const input = document.createElement('span');
        input.className = 'recipe-entry-main';
        input.textContent = main;
        const output = document.createElement('span');
        output.className = 'recipe-entry-result';
        output.textContent = result;
        const note = document.createElement('small');
        note.textContent = detail;
        row.append(input, output, note);
        section.appendChild(row);
    }
    return section;
}

export function createRecipeBook({ root, search, empty, recipes, smelting, fuels, items }) {
    const nameOf = id => items[id]?.name ?? '—';
    const crafting = recipes.map(recipe => {
        const ingredients = recipe.kind === 'shapeless'
            ? recipe.ingredients.map(nameOf).join(' + ')
            : recipe.shape.map(row => row.filter(Boolean).map(nameOf).join(' + ')).filter(Boolean).join(' / ');
        const needsBench = recipe.kind !== 'shapeless' && (recipe.shape.length > 2 || recipe.shape[0].length > 2);
        const detail = recipe.kind === 'shapeless' ? 'Sem formato fixo' : needsBench ? 'Bancada de criação' : 'Inventário 2×2';
        return [ingredients, `${recipe.count}× ${nameOf(recipe.result)}`, detail];
    });
    const cooking = Object.entries(smelting).map(([input, recipe]) => [
        nameOf(Number(input)), `1× ${nameOf(recipe.result)}`, `Fornalha · ${recipe.time}s`,
    ]);
    const fuel = Object.entries(fuels).map(([input, seconds]) => [
        nameOf(Number(input)), `${seconds}s`, 'Combustível para fornalha',
    ]);

    root.replaceChildren(
        recipeSection('Criação', crafting),
        recipeSection('Fundição', cooking),
        recipeSection('Combustíveis', fuel),
    );

    const sections = [...root.querySelectorAll('.recipe-section')];
    const filter = () => {
        const query = search.value.trim().toLocaleLowerCase('pt-BR');
        let anyVisible = false;
        for (const section of sections) {
            const entries = [...section.querySelectorAll('.recipe-entry')];
            let sectionVisible = false;
            for (const entry of entries) {
                const matches = entry.textContent.toLocaleLowerCase('pt-BR').includes(query);
                entry.hidden = !matches;
                sectionVisible ||= matches;
            }
            section.hidden = !sectionVisible;
            anyVisible ||= sectionVisible;
        }
        empty.hidden = anyVisible;
    };
    search.addEventListener('input', filter);
}
