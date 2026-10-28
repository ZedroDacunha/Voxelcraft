import { openDatabase, storeRequest, STORE_NAME } from './world-storage.js';

const META_PREFIX = 'world-meta:';
const LOCK_TTL = 30000;

const menu = document.getElementById('world-menu');
const list = document.getElementById('world-list');
const errorBox = document.getElementById('world-menu-error');
const dialog = document.getElementById('world-dialog');
const form = document.getElementById('world-form');
const nameInput = document.getElementById('world-name');
const seedInput = document.getElementById('world-seed');
let editingWorldId = null;

async function migrateLegacyWorlds() {
    const keys = await storeRequest('readonly', store => store.getAllKeys());
    for (const key of keys) {
        if (typeof key !== 'string' || !/^world--?\d+$/.test(key)) continue;
        const save = await storeRequest('readonly', store => store.get(key));
        if (!save || !Number.isFinite(save.seed) || key !== `world-${save.seed}`) continue;
        const id = `legacy-${save.seed}`;
        const metaKey = META_PREFIX + id;
        const existing = await storeRequest('readonly', store => store.get(metaKey));
        if (existing) continue;
        await storeRequest('readwrite', store => store.put({
            id,
            name: `Mundo antigo · ${save.seed}`,
            seed: save.seed,
            saveKey: key,
            createdAt: Number.isFinite(save.time) ? save.time : Date.now(),
            legacy: true,
        }, metaKey));
    }
}

async function getWorlds() {
    await migrateLegacyWorlds();
    const keys = await storeRequest('readonly', store => store.getAllKeys());
    const worlds = [];
    for (const key of keys) {
        if (typeof key !== 'string' || !key.startsWith(META_PREFIX)) continue;
        const world = await storeRequest('readonly', store => store.get(key));
        if (world && typeof world.id === 'string' && Number.isFinite(world.seed) && typeof world.saveKey === 'string') {
            const save = await storeRequest('readonly', store => store.get(world.saveKey));
            worlds.push({ ...world, lastPlayed: Number.isFinite(save?.time) ? save.time : world.createdAt });
        }
    }
    return worlds.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
}

function formatDate(value) {
    if (!Number.isFinite(value)) return 'Ainda não iniciado';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

function showError(message = '') {
    errorBox.textContent = message;
    errorBox.hidden = !message;
}

function makeAction(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `world-action ${className || ''}`.trim();
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

async function renderWorlds() {
    showError();
    list.replaceChildren();
    const worlds = await getWorlds();
    if (!worlds.length) {
        const empty = document.createElement('div');
        empty.className = 'world-empty';
        empty.textContent = 'Você ainda não tem mundos. Crie um para começar sua aventura.';
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
        details.textContent = `Seed ${world.seed} · Última sessão: ${formatDate(world.lastPlayed)}`;
        info.append(title, details);

        const actions = document.createElement('div');
        actions.className = 'world-card-actions';
        actions.append(makeAction('Jogar', 'play', () => launchWorld(world)));
        actions.append(makeAction('Renomear', '', () => openWorldDialog(world)));
        actions.append(makeAction('Excluir', 'delete', () => deleteWorld(world)));
        card.append(info, actions);
        list.append(card);
    }
}

async function launchWorld(world) {
    showError();
    document.getElementById('btn-create-world').disabled = true;
    for (const button of list.querySelectorAll('button')) button.disabled = true;
    window.ACTIVE_WORLD = { id: world.id, name: world.name, seed: world.seed, saveKey: world.saveKey };
    menu.hidden = true;
    document.body.classList.add('game-started');
    const loading = document.getElementById('world-loading');
    loading.hidden = false;
    try {
        await import('./game.js');
    } catch (error) {
        console.error('Não foi possível iniciar o jogo:', error);
        menu.hidden = false;
        document.body.classList.remove('game-started');
        loading.hidden = true;
        document.getElementById('btn-create-world').disabled = false;
        showError('Não foi possível abrir este mundo. Confira a conexão e tente novamente.');
        await renderWorlds();
    }
}

function openWorldDialog(world = null) {
    editingWorldId = world?.id || null;
    document.getElementById('world-dialog-title').textContent = world ? 'Renomear mundo' : 'Criar mundo';
    document.getElementById('btn-world-confirm').textContent = world ? 'Salvar nome' : 'Criar mundo';
    nameInput.value = world?.name || `Meu mundo ${new Date().toLocaleDateString('pt-BR')}`;
    seedInput.value = world ? String(world.seed) : '';
    seedInput.disabled = Boolean(world);
    dialog.showModal();
    nameInput.focus();
    nameInput.select();
}

function randomSeed() {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return (bytes[0] % 2147483646) + 1;
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = nameInput.value.trim().slice(0, 32);
    if (!name) { nameInput.focus(); return; }
    try {
        if (editingWorldId) {
            const metaKey = META_PREFIX + editingWorldId;
            const world = await storeRequest('readonly', store => store.get(metaKey));
            if (!world) throw new Error('Esse mundo não está mais disponível.');
            world.name = name;
            await storeRequest('readwrite', store => store.put(world, metaKey));
        } else {
            const typedSeed = seedInput.value.trim();
            const seed = typedSeed === '' ? randomSeed() : Number(typedSeed);
            if (!Number.isSafeInteger(seed) || seed < -2147483648 || seed > 2147483647) {
                throw new Error('Use uma seed inteira entre -2147483648 e 2147483647.');
            }
            const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const world = { id, name, seed, saveKey: `world-${id}`, createdAt: Date.now() };
            await storeRequest('readwrite', store => store.put(world, META_PREFIX + id));
        }
        dialog.close();
        await renderWorlds();
    } catch (error) {
        showError(error.message || 'Não foi possível salvar os dados do mundo.');
    }
});

async function deleteWorld(world) {
    if (!confirm(`Excluir “${world.name}” e todo o progresso desse mundo? Esta ação não pode ser desfeita.`)) return;
    try {
        const lockKey = `${world.saveKey}-writer-lock`;
        const db = await openDatabase();
        const deleted = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            let removed = false;
            const request = store.get(lockKey);
            request.onsuccess = () => {
                const lock = request.result;
                if (lock && Number.isFinite(lock.heartbeat) && Date.now() - lock.heartbeat <= LOCK_TTL) return;
                store.delete(world.saveKey);
                store.delete(`${world.saveKey}-backup`);
                store.delete(lockKey);
                store.delete(META_PREFIX + world.id);
                removed = true;
            };
            tx.oncomplete = () => { db.close(); resolve(removed); };
            tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Não foi possível excluir o mundo.')); };
        });
        if (!deleted) {
            showError('Este mundo está aberto em outra aba. Feche essa sessão antes de excluir.');
            return;
        }
        await renderWorlds();
    } catch (error) {
        showError(error.message || 'Não foi possível excluir o mundo.');
    }
}

document.getElementById('btn-create-world').addEventListener('click', () => openWorldDialog());
document.getElementById('btn-world-cancel').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

renderWorlds().catch(error => {
    console.error('Falha ao carregar a lista de mundos:', error);
    showError('Não foi possível ler os mundos salvos neste navegador.');
});
