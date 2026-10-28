const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

function formatDate(value) {
    return Number.isFinite(value) ? dateFormatter.format(value) : 'Ainda não iniciado';
}

export function formatWorldActivity(world) {

    if (world.hasSave) {
        return Number.isFinite(world.lastSavedAt)
            ? `Último save: ${formatDate(world.lastSavedAt)}`
            : 'Save atual sem data válida · confira as opções';
    }
    if (world.hasBackup || world.hasImportedSave || world.hasRejectedSave) {
        return 'Save atual indisponível · há uma cópia de recuperação';
    }
    return `Ainda não iniciado · criado em ${formatDate(world.createdAt)}`;
}

export function createWorldListView({ list, toolbar, search, count, getWorlds, onPlay, onOptions }) {
    let worldsCache = [];

    function normalizeSearchText(value) {
        return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    }

    function makeAction(label, className, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `world-action ${className || ''}`.trim();
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    }

    function renderFiltered() {
        list.replaceChildren();
        const query = normalizeSearchText(search.value.trim());
        const worlds = worldsCache.filter(world => normalizeSearchText(`${world.name} ${world.seed}`).includes(query));
        count.textContent = query
            ? `${worlds.length} de ${worldsCache.length} mundos`
            : `${worldsCache.length} ${worldsCache.length === 1 ? 'mundo' : 'mundos'}`;

        if (!worldsCache.length || !worlds.length) {
            const empty = document.createElement('div');
            empty.className = 'world-empty';
            empty.textContent = worldsCache.length
                ? 'Nenhum mundo corresponde à busca. Tente outro nome ou seed.'
                : 'Você ainda não tem mundos. Crie um para começar sua aventura.';
            list.append(empty);
            return;
        }

        for (const world of worlds) {
            const card = document.createElement('article');
            card.className = 'world-card';
            const info = document.createElement('div');
            const title = document.createElement('h2');
            title.textContent = world.name;
            const details = document.createElement('p');
            details.textContent = `Seed ${world.seed} · ${formatWorldActivity(world)}`;
            info.append(title, details);
            const actions = document.createElement('div');
            actions.className = 'world-card-actions';
            actions.append(makeAction('Jogar', 'play', () => onPlay(world)));
            actions.append(makeAction('Opções do mundo', '', () => onOptions(world)));
            card.append(info, actions);
            list.append(card);
        }
    }

    async function refresh() {
        worldsCache = await getWorlds();
        toolbar.hidden = worldsCache.length === 0;
        renderFiltered();
    }

    function clearSearch() {
        search.value = '';
    }

    function focusSearch() {
        if (!toolbar.hidden) search.focus();
    }

    search.addEventListener('input', renderFiltered);

    return {
        element: list,
        refresh,
        clearSearch,
        focusSearch,
        renderFiltered,
    };
}
