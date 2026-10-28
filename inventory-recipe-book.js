import { stackHtml } from './inventory-view.js';

function recipeSection(title, entries) {
    const section = document.createElement('section');
    section.className = 'recipe-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);
    section.append(...entries);
    return section;
}

function recipePreview(recipe) {
    const cells = Array.from({ length: 9 }, () => null);
    if (recipe.kind === 'shapeless') {
        recipe.ingredients.slice(0, 9).forEach((id, index) => { cells[index] = id; });
    } else {
        const height = recipe.shape.length;
        const width = recipe.shape[0]?.length ?? 0;
        const rowOffset = Math.floor((3 - height) / 2);
        const columnOffset = Math.floor((3 - width) / 2);
        recipe.shape.forEach((row, r) => row.forEach((id, c) => {
            if (id) cells[(r + rowOffset) * 3 + c + columnOffset] = id;
        }));
    }

    const grid = document.createElement('span');
    grid.className = 'recipe-mini-grid';
    grid.style.gridTemplateColumns = 'repeat(3, 18px)';
    grid.style.gridTemplateRows = 'repeat(3, 18px)';
    grid.setAttribute('aria-hidden', 'true');
    for (const id of cells) {
        const slot = document.createElement('span');
        slot.className = 'recipe-mini-slot';
        if (id) slot.innerHTML = stackHtml({ id, count: 1 });
        grid.appendChild(slot);
    }

    const arrow = document.createElement('span');
    arrow.className = 'recipe-mini-arrow';
    arrow.textContent = '➜';
    arrow.setAttribute('aria-hidden', 'true');

    const output = document.createElement('span');
    output.className = 'recipe-mini-output';
    output.innerHTML = stackHtml({ id: recipe.result, count: recipe.count });
    output.setAttribute('aria-hidden', 'true');

    return { grid, arrow, output };
}

function craftingEntry(recipe, items, recipeIndex) {
    const resultName = items[recipe.result]?.name ?? 'item';
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.className = 'recipe-entry recipe-entry-craft';
    entry.dataset.recipeIndex = String(recipeIndex);
    entry.setAttribute('aria-label', `Colocar ingredientes de ${resultName} na bancada`);

    const preview = document.createElement('span');
    preview.className = 'recipe-entry-preview';
    const icons = recipePreview(recipe);
    preview.append(icons.grid, icons.arrow, icons.output);

    const content = document.createElement('span');
    content.className = 'recipe-entry-content';
    const name = document.createElement('strong');
    name.textContent = `${recipe.count}× ${resultName}`;
    const ingredientIds = recipe.kind === 'shapeless'
        ? recipe.ingredients
        : recipe.shape.flat().filter(Boolean);
    const ingredientCounts = new Map();
    for (const id of ingredientIds) ingredientCounts.set(id, (ingredientCounts.get(id) ?? 0) + 1);
    const ingredients = [...ingredientCounts]
        .map(([id, count]) => `${count}× ${items[id]?.name ?? '—'}`)
        .join(', ');
    const detail = document.createElement('small');
    const needsBench = recipe.kind !== 'shapeless' && (recipe.shape.length > 2 || recipe.shape[0].length > 2);
    detail.textContent = `${ingredients} · ${recipe.kind === 'shapeless' ? 'Qualquer posição' : needsBench ? 'Bancada 3×3' : 'Grade 2×2 ou bancada'}`;
    content.append(name, detail);
    entry.append(preview, content);
    return entry;
}

function textEntry(main, result, detail) {
    const row = document.createElement('div');
    row.className = 'recipe-entry recipe-entry-static';
    const input = document.createElement('span');
    input.className = 'recipe-entry-main';
    input.textContent = main;
    const output = document.createElement('span');
    output.className = 'recipe-entry-result';
    output.textContent = result;
    const note = document.createElement('small');
    note.textContent = detail;
    row.append(input, output, note);
    return row;
}

export function createRecipeBook({ root, search, empty, recipes, smelting, fuels, items, onSelectCrafting }) {
    const nameOf = id => items[id]?.name ?? '—';
    const crafting = recipes.map((recipe, index) => craftingEntry(recipe, items, index));
    const cooking = Object.entries(smelting).map(([input, recipe]) => textEntry(
        nameOf(Number(input)), `1× ${nameOf(recipe.result)}`, `Fornalha · ${recipe.time}s`,
    ));
    const fuel = Object.entries(fuels).map(([input, seconds]) => textEntry(
        nameOf(Number(input)), `${seconds}s`, 'Combustível para fornalha',
    ));

    const feedback = document.createElement('p');
    feedback.className = 'recipe-feedback';
    feedback.hidden = true;
    root.replaceChildren(
        feedback,
        recipeSection('Criação · clique para preparar', crafting),
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

    root.addEventListener('click', event => {
        const entry = event.target.closest('.recipe-entry-craft');
        if (!entry) return;
        const recipe = recipes[Number(entry.dataset.recipeIndex)];
        if (!recipe) return;
        const result = onSelectCrafting(recipe);
        feedback.textContent = result?.message ?? '';
        feedback.dataset.state = result?.ok ? 'success' : 'error';
        feedback.hidden = !feedback.textContent;
    });
    search.addEventListener('input', filter);
}
