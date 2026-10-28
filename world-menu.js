import { openDatabase, storeRequest, STORE_NAME } from './world-storage.js';
import { createWorldSaveCodec } from './world-save-codec.js';
import { MAX_SAVE_COPY_BYTES } from './world-save-settings.js';
import {
    importedSaveKeyFor, parseSaveCopy, readSaveCopy, rejectedSaveKeyFor,
    restoreSaveCopy, saveBackupKeyFor, serializeSaveCopy, stageImportedSaveCopy,
} from './world-save-recovery.js';

import('./menu-background.js').catch(error => {
    console.warn('Panorama animado indisponível; usando o cenário estático.', error);
});

const META_PREFIX = 'world-meta:';
const LOCK_TTL = 30000;
const saveCodec = createWorldSaveCodec();

const titleScreen = document.getElementById('title-screen');
const menu = document.getElementById('world-menu');
const list = document.getElementById('world-list');
const worldListToolbar = document.getElementById('world-list-toolbar');
const worldSearch = document.getElementById('world-search');
const worldListCount = document.getElementById('world-list-count');
const errorBox = document.getElementById('world-menu-error');
const dialog = document.getElementById('world-dialog');
const worldOptionsDialog = document.getElementById('world-options-dialog');
const worldOptionsFeedback = document.getElementById('world-options-feedback');
const worldSaveActions = document.getElementById('world-save-actions');
const form = document.getElementById('world-form');
const nameInput = document.getElementById('world-name');
const seedInput = document.getElementById('world-seed');
let editingWorldId = null;
let worldsCache = [];

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
            const [save, backupKey, rejectedKey, importedKey] = await Promise.all([
                storeRequest('readonly', store => store.get(world.saveKey)),
                storeRequest('readonly', store => store.getKey(saveBackupKeyFor(world.saveKey))),
                storeRequest('readonly', store => store.getKey(rejectedSaveKeyFor(world.saveKey))),
                storeRequest('readonly', store => store.getKey(importedSaveKeyFor(world.saveKey))),
            ]);
            worlds.push({
                ...world,
                lastPlayed: Number.isFinite(save?.time) ? save.time : world.createdAt,
                hasSave: save !== undefined,
                hasBackup: backupKey !== undefined,
                hasRejectedSave: rejectedKey !== undefined,
                hasImportedSave: importedKey !== undefined,
            });
        }
    }
    return worlds.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
}

function formatDate(value) {
    if (!Number.isFinite(value)) return 'Ainda não iniciado';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

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

function makeAction(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `world-action ${className || ''}`.trim();
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

async function exportSaveCopy(world, kind, button) {
    const buttonLabel = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Preparando arquivo…';
    }
    if (worldOptionsDialog.open) showProgress('Preparando a cópia do save para download…');
    let objectUrl = null;
    try {
        const save = await readSaveCopy(storeRequest, world, kind);
        const safeName = world.name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() || 'mundo';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const blob = new Blob([serializeSaveCopy(world, kind, save)], { type: 'application/json' });
        if (blob.size > MAX_SAVE_COPY_BYTES) {
            throw new Error('Esta cópia ultrapassa 64 MB e não pode ser importada pelo jogo.');
        }
        const downloadUrl = URL.createObjectURL(blob);
        objectUrl = downloadUrl;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${safeName}-${kind}-${timestamp}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        objectUrl = null;
        if (worldOptionsDialog.open) showNotice('Download da cópia iniciado.');
    } catch (error) {
        showError(error.message || 'Não foi possível exportar esta cópia do save.');
    } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (button?.isConnected) {
            button.disabled = false;
            button.textContent = buttonLabel;
        }
    }
}

function makeExportAction(label, world, kind) {
    let button;
    button = makeAction(label, 'export', () => exportSaveCopy(world, kind, button));
    return button;
}

async function importSaveCopy(world, file) {
    const save = await parseSaveCopy(file, world.seed);
    if (!saveCodec.validate(save, world.seed)) {
        throw new Error('O arquivo tem o formato correto, mas os dados do mundo estão inválidos.');
    }
    await stageImportedSaveCopy(storeRequest, world, save, LOCK_TTL);
}

async function restoreWorldCopy(world, kind) {
    const copyName = kind === 'backup' ? 'o backup rotativo'
        : kind === 'imported' ? 'a cópia importada' : 'o save rejeitado';
    const confirmed = confirm(
        `Restaurar ${copyName} de “${world.name}”? O save atual será preservado como backup ou arquivo rejeitado. Deseja continuar?`
    );
    if (!confirmed) return;
    try {
        await restoreSaveCopy(storeRequest, world, kind, saveCodec, LOCK_TTL);
        worldOptionsDialog.close();
        await renderWorlds();
        showNotice(`Cópia restaurada em “${world.name}”.`);
    } catch (error) {
        showError(error.message || 'Não foi possível restaurar esta cópia do save.');
    }
}

function addImportAction(actions, world) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    input.setAttribute('aria-label', `Selecionar cópia JSON para ${world.name}`);
    const button = makeAction(world.hasImportedSave ? 'Trocar cópia importada' : 'Importar cópia JSON', 'export', () => input.click());
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
            if (world.hasImportedSave && !confirm('Substituir a cópia importada que está aguardando recuperação?')) return;
            button.disabled = true;
            button.textContent = 'Validando arquivo…';
            showProgress('Lendo e validando a cópia do save…');
            await importSaveCopy(world, file);
            world.hasImportedSave = true;
            await renderWorlds();
            renderWorldOptions(world);
            showNotice(`Cópia importada para “${world.name}”.`);
        } catch (error) {
            showError(error.message || 'Não foi possível importar esta cópia do save.');
        } finally {
            button.disabled = false;
            button.textContent = world.hasImportedSave ? 'Trocar cópia importada' : 'Importar cópia JSON';
            input.value = '';
        }
    });
    actions.append(button, input);
}

function addSaveGroup(label, description) {
    const group = document.createElement('section');
    group.className = 'world-save-group';
    const heading = document.createElement('h3');
    heading.textContent = label;
    const detail = document.createElement('p');
    detail.textContent = description;
    const buttons = document.createElement('div');
    buttons.className = 'world-save-group-actions';
    group.append(heading, detail, buttons);
    worldSaveActions.append(group);
    return buttons;
}

async function refreshStorageProtection(status, button) {
    const storage = navigator.storage;
    if (!storage?.persisted || !storage?.persist) {
        status.textContent = 'Este navegador não oferece proteção persistente para o armazenamento local.';
        button.disabled = true;
        return false;
    }

    try {
        const isPersistent = await storage.persisted();
        status.textContent = isPersistent
            ? 'Proteção ativa: o navegador sinalizou que manterá os saves deste site durante limpezas automáticas.'
            : 'A proteção ainda não está ativa. O navegador decidirá se pode concedê-la.';
        button.textContent = isPersistent ? 'Proteção ativa' : 'Proteger saves neste navegador';
        button.disabled = isPersistent;
        return isPersistent;
    } catch {
        status.textContent = 'Não foi possível consultar a proteção de armazenamento neste momento.';
        button.disabled = false;
        return false;
    }
}

function formatStorageSize(bytes) {
    const units = ['bytes', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

async function refreshStorageUsage(status) {
    status.classList.remove('is-warning');
    try {
        const estimate = await navigator.storage?.estimate?.();
        if (!estimate || !Number.isFinite(estimate.usage)) {
            status.textContent = 'Estimativa do espaço de armazenamento indisponível.';
            return;
        }
        const usage = estimate.usage;
        const quota = Number.isFinite(estimate.quota) ? estimate.quota : 0;
        status.textContent = quota > 0
            ? `Este site usa aproximadamente ${formatStorageSize(usage)} de ${formatStorageSize(quota)} disponíveis.`
            : `Este site usa aproximadamente ${formatStorageSize(usage)}.`;
        if (quota > 0 && usage / quota >= 0.85) {
            status.textContent += ' O espaço está perto do limite; exporte uma cópia do mundo.';
            status.classList.add('is-warning');
        }
    } catch {
        status.textContent = 'Não foi possível consultar o espaço de armazenamento agora.';
    }
}

function addStorageProtectionOption() {
    const actions = addSaveGroup(
        'Proteção dos saves',
        'Solicite ao navegador que preserve os dados locais deste jogo contra limpeza automática.',
    );
    const group = actions.parentElement;
    const status = document.createElement('p');
    status.className = 'world-storage-status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Verificando suporte do navegador…';
    group.insertBefore(status, actions);
    const usageStatus = document.createElement('p');
    usageStatus.className = 'world-storage-usage';
    usageStatus.setAttribute('aria-live', 'polite');
    usageStatus.textContent = 'Consultando espaço usado…';
    group.insertBefore(usageStatus, actions);

    const button = makeAction('Proteger saves neste navegador', 'export', async () => {
        button.disabled = true;
        button.textContent = 'Solicitando…';
        try {
            const granted = await navigator.storage.persist();
            const isPersistent = await refreshStorageProtection(status, button);
            await refreshStorageUsage(usageStatus);
            if (granted && isPersistent) showNotice('O navegador ativou a proteção do armazenamento local.');
            else if (!granted) status.textContent = 'O navegador não concedeu a proteção desta vez. Os saves continuam disponíveis normalmente.';
            else showError('A solicitação foi aceita, mas o navegador ainda não confirmou a proteção.');
        } catch {
            button.disabled = false;
            button.textContent = 'Tentar novamente';
            status.textContent = 'O navegador não conseguiu concluir a solicitação. Você pode tentar novamente.';
            showError('Não foi possível solicitar a proteção dos saves ao navegador.');
        }
    });
    button.disabled = true;
    actions.append(button);
    void refreshStorageProtection(status, button);
    void refreshStorageUsage(usageStatus);
}

function renderWorldOptions(world) {
    document.getElementById('world-options-title').textContent = world.name;
    document.getElementById('world-options-summary').textContent = `Seed ${world.seed} · Última sessão: ${formatDate(world.lastPlayed)}`;
    worldSaveActions.replaceChildren();

    if (world.hasSave) {
        const actions = addSaveGroup('Save atual', 'Faça uma cópia do progresso salvo neste mundo.');
        actions.append(makeExportAction('Baixar save atual', world, 'current'));
    }
    if (world.hasBackup) {
        const actions = addSaveGroup('Backup automático', 'O backup anterior pode recuperar um progresso mais antigo.');
        actions.append(
            makeAction('Restaurar backup', 'export', () => restoreWorldCopy(world, 'backup')),
            makeExportAction('Baixar backup', world, 'backup'),
        );
    }
    if (world.hasImportedSave) {
        const actions = addSaveGroup('Cópia importada', 'Uma cópia JSON está guardada e pode substituir o save atual.');
        actions.append(makeAction('Usar cópia importada', 'export', () => restoreWorldCopy(world, 'imported')));
    }
    if (world.hasRejectedSave) {
        const actions = addSaveGroup('Save recuperável', 'Um save inválido foi preservado para tentativa de recuperação.');
        actions.append(
            makeAction('Restaurar save rejeitado', 'export', () => restoreWorldCopy(world, 'rejected')),
            makeExportAction('Baixar save rejeitado', world, 'rejected'),
        );
    }
    const importActions = addSaveGroup('Importar save', 'Selecione um arquivo JSON exportado anteriormente para este mundo.');
    addImportAction(importActions, world);
    addStorageProtectionOption();

    const worldActions = addSaveGroup('Mundo', 'Ajustes básicos deste mundo.');
    worldActions.append(makeAction('Renomear mundo', '', () => {
        worldOptionsDialog.close();
        openWorldDialog(world);
    }));

    const dangerActions = addSaveGroup('Área de risco', 'Excluir remove o mundo e todos os seus saves deste navegador.', []);
    dangerActions.parentElement.classList.add('is-danger');
    dangerActions.append(makeAction('Excluir mundo', 'delete', () => deleteWorld(world)));
}

function openWorldOptions(world) {
    showError();
    renderWorldOptions(world);
    worldOptionsDialog.showModal();
}

function normalizeSearchText(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function renderWorldList() {
    list.replaceChildren();
    const query = normalizeSearchText(worldSearch.value.trim());
    const worlds = worldsCache.filter(world => {
        const searchable = normalizeSearchText(`${world.name} ${world.seed}`);
        return searchable.includes(query);
    });
    worldListCount.textContent = query
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
        details.textContent = `Seed ${world.seed} · Última sessão: ${formatDate(world.lastPlayed)}`;
        info.append(title, details);
        const actions = document.createElement('div');
        actions.className = 'world-card-actions';
        actions.append(makeAction('Jogar', 'play', () => launchWorld(world)));
        actions.append(makeAction('Opções do mundo', '', () => openWorldOptions(world)));
        card.append(info, actions);
        list.append(card);
    }
}

async function renderWorlds() {
    showError();
    worldsCache = await getWorlds();
    worldListToolbar.hidden = worldsCache.length === 0;
    renderWorldList();
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
        worldSearch.value = '';
        await renderWorlds();
        worldSearch.focus();
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
                store.delete(saveBackupKeyFor(world.saveKey));
                store.delete(rejectedSaveKeyFor(world.saveKey));
                store.delete(importedSaveKeyFor(world.saveKey));
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
worldSearch.addEventListener('input', renderWorldList);
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
