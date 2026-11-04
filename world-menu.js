import { storeRequest } from './world-storage.js';
import { createWorldRecord, deleteWorldRecord, getWorlds, markWorldSaved, renameWorldRecord } from './world-list-store.js';
import { createWorldSaveOptions } from './world-save-options.js';
import { createWorldListView, formatWorldActivity } from './world-list-view.js';
import { createOptionsView } from './world-options-view.js';
import { bindUiSounds, getSharedAudio } from './world-audio.js';
import { loadGameSettings } from './world-game-settings.js';
import { registerServiceWorker } from './world-pwa.js';

// Registra o service worker cedo (não bloqueia o menu): é o que permite instalar
// o jogo e abrir sem rede depois da primeira visita.
registerServiceWorker().catch(() => {});

import('./menu-background.js').catch(error => {
    console.warn('Panorama animado indisponível; usando o cenário estático.', error);
});

const titleScreen = document.getElementById('title-screen');
const menu = document.getElementById('world-menu');
const errorBox = document.getElementById('world-menu-error');
const dialog = document.getElementById('world-dialog');
const worldOptionsDialog = document.getElementById('world-options-dialog');
const worldOptionsFeedback = document.getElementById('world-options-feedback');
const worldSaveActions = document.getElementById('world-save-actions');
const form = document.getElementById('world-form');
const nameInput = document.getElementById('world-name');
const seedInput = document.getElementById('world-seed');
let editingWorldId = null;

function showError(message = '') {
    errorBox.classList.remove('is-success');
    errorBox.textContent = message;
    errorBox.hidden = !message;
    worldOptionsFeedback.classList.remove('is-success');
    worldOptionsFeedback.textContent = message;
    worldOptionsFeedback.hidden = !message;
}

function showNotice(message) {
    errorBox.classList.add('is-success');
    errorBox.textContent = message;
    errorBox.hidden = false;
    worldOptionsFeedback.classList.add('is-success');
    worldOptionsFeedback.textContent = message;
    worldOptionsFeedback.hidden = false;
}

function showProgress(message) {
    errorBox.hidden = true;
    worldOptionsFeedback.classList.remove('is-success');
    worldOptionsFeedback.textContent = message;
    worldOptionsFeedback.hidden = false;
}

const worldListView = createWorldListView({
    list: document.getElementById('world-list'),
    toolbar: document.getElementById('world-list-toolbar'),
    search: document.getElementById('world-search'),
    count: document.getElementById('world-list-count'),
    getWorlds,
    onPlay: world => launchWorld(world),
    onOptions: world => openWorldOptions(world),
});

const worldSaveOptions = createWorldSaveOptions({
    storeRequest,
    worldOptionsDialog,
    worldSaveActions,
    onError: showError,
    onNotice: showNotice,
    onProgress: showProgress,
    onRefreshWorlds: renderWorlds,
    onRenameWorld: world => {
        worldOptionsDialog.close();
        openWorldDialog(world);
    },
    onDeleteWorld: world => deleteWorld(world),
    onWorldSaved: (worldId, savedAt) => markWorldSaved(worldId, savedAt),
});

function renderWorldOptions(world) {
    document.getElementById('world-options-title').textContent = world.name;
    document.getElementById('world-options-summary').textContent = `Seed ${world.seed} · ${formatWorldActivity(world)}`;
    worldSaveOptions.render(world);
}

function openWorldOptions(world) {
    showError();
    renderWorldOptions(world);
    worldOptionsDialog.showModal();
}

async function renderWorlds() {
    showError();
    await worldListView.refresh();
}

async function launchWorld(world) {
    showError();
    document.getElementById('btn-create-world').disabled = true;
    for (const button of worldListView.element.querySelectorAll('button')) button.disabled = true;
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
            await renameWorldRecord(editingWorldId, name);
        } else {
            const typedSeed = seedInput.value.trim();
            const seed = typedSeed === '' ? randomSeed() : Number(typedSeed);
            if (!Number.isSafeInteger(seed) || seed < -2147483648 || seed > 2147483647) {
                throw new Error('Use uma seed inteira entre -2147483648 e 2147483647.');
            }
            const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const world = { id, name, seed, saveKey: `world-${id}`, createdAt: Date.now() };
            await createWorldRecord(world);
        }
        dialog.close();
        worldListView.clearSearch();
        await renderWorlds();
        worldListView.focusSearch();
    } catch (error) {
        showError(error.message || 'Não foi possível salvar os dados do mundo.');
    }
});

async function deleteWorld(world) {
    if (!confirm(`Excluir “${world.name}” e todo o progresso desse mundo? Esta ação não pode ser desfeita.`)) return;
    try {
        const deleted = await deleteWorldRecord(world);
        if (!deleted) {
            showError('Este mundo está aberto em outra aba. Feche essa sessão antes de excluir.');
            return;
        }
        worldOptionsDialog.close();
        await renderWorlds();
        document.getElementById('btn-create-world').focus();
        showNotice(`Mundo “${world.name}” excluído.`);
    } catch (error) {
        showError(error.message || 'Não foi possível excluir o mundo.');
    }
}

document.getElementById('btn-create-world').addEventListener('click', () => openWorldDialog());
document.getElementById('btn-world-cancel').addEventListener('click', () => dialog.close());
document.getElementById('btn-world-options-close').addEventListener('click', () => worldOptionsDialog.close());
document.getElementById('btn-world-options-done').addEventListener('click', () => worldOptionsDialog.close());
document.getElementById('btn-open-worlds').addEventListener('click', () => {
    titleScreen.hidden = true;
    menu.hidden = false;
    document.getElementById('btn-create-world').focus();
});
document.getElementById('btn-back-title').addEventListener('click', () => {
    menu.hidden = true;
    titleScreen.hidden = false;
    document.getElementById('btn-open-worlds').focus();
});
// Sons da interface: síntese em WebAudio (sem arquivos), cobrindo menu,
// diálogos e inventário por delegação no documento.
const uiAudio = getSharedAudio({ volume: loadGameSettings().volume });
bindUiSounds(uiAudio, document);

createOptionsView(document.getElementById('options-dialog'), {
    onChange: settings => uiAudio.setVolume(settings.volume),
});
document.getElementById('btn-open-options').addEventListener('click', () => {
    document.getElementById('options-dialog').showModal();
});
document.getElementById('btn-quit-game').addEventListener('click', () => {
    document.getElementById('quit-hint').hidden = false;
});
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
worldOptionsDialog.addEventListener('click', event => { if (event.target === worldOptionsDialog) worldOptionsDialog.close(); });

renderWorlds().catch(error => {
    console.error('Falha ao carregar a lista de mundos:', error);
    showError('Não foi possível ler os mundos salvos neste navegador.');
});
