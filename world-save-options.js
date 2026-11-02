import { createWorldSaveCodec } from './world-save-codec.js';
import { MAX_SAVE_COPY_BYTES } from './world-save-settings.js';
import {
    importedSaveKeyFor, parseSaveCopy, readSaveCopy, rejectedSaveKeyFor,
    restoreSaveCopy, saveBackupKeyFor, serializeSaveCopy, stageImportedSaveCopy,
} from './world-save-recovery.js';

const LOCK_TTL = 30000;

export function createWorldSaveOptions({
    storeRequest,
    worldOptionsDialog,
    worldSaveActions,
    onError,
    onNotice,
    onProgress,
    onRefreshWorlds,
    onRenameWorld,
    onDeleteWorld,
    onWorldSaved = () => {},
}) {
    const saveCodec = createWorldSaveCodec();

    function makeAction(label, className, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `world-action ${className || ''}`.trim();
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
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

    async function exportSaveCopy(world, kind, button) {
        const buttonLabel = button?.textContent;
        if (button) {
            button.disabled = true;
            button.textContent = 'Preparando arquivo…';
        }
        if (worldOptionsDialog.open) onProgress('Preparando a cópia do save para download…');
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
            if (worldOptionsDialog.open) onNotice('Download da cópia iniciado.');
        } catch (error) {
            onError(error.message || 'Não foi possível exportar esta cópia do save.');
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
            const restoredSave = await restoreSaveCopy(storeRequest, world, kind, saveCodec, LOCK_TTL);
            // O save principal mudou: a data do último save nos metadados precisa
            // acompanhar, senão a lista mostraria a data antiga.
            await onWorldSaved(world.id, restoredSave?.time);
            worldOptionsDialog.close();
            await onRefreshWorlds();
            onNotice(`Cópia restaurada em “${world.name}”.`);
        } catch (error) {
            onError(error.message || 'Não foi possível restaurar esta cópia do save.');
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
                onProgress('Lendo e validando a cópia do save…');
                await importSaveCopy(world, file);
                world.hasImportedSave = true;
                await onRefreshWorlds();
                render(world);
                onNotice(`Cópia importada para “${world.name}”.`);
            } catch (error) {
                onError(error.message || 'Não foi possível importar esta cópia do save.');
            } finally {
                button.disabled = false;
                button.textContent = world.hasImportedSave ? 'Trocar cópia importada' : 'Importar cópia JSON';
                input.value = '';
            }
        });
        actions.append(button, input);
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
                if (granted && isPersistent) onNotice('O navegador ativou a proteção do armazenamento local.');
                else if (!granted) status.textContent = 'O navegador não concedeu a proteção desta vez. Os saves continuam disponíveis normalmente.';
                else onError('A solicitação foi aceita, mas o navegador ainda não confirmou a proteção.');
            } catch {
                button.disabled = false;
                button.textContent = 'Tentar novamente';
                status.textContent = 'O navegador não conseguiu concluir a solicitação. Você pode tentar novamente.';
                onError('Não foi possível solicitar a proteção dos saves ao navegador.');
            }
        });
        button.disabled = true;
        actions.append(button);
        void refreshStorageProtection(status, button);
        void refreshStorageUsage(usageStatus);
    }

    function render(world) {
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
        worldActions.append(makeAction('Renomear mundo', '', () => onRenameWorld(world)));
        const dangerActions = addSaveGroup('Área de risco', 'Excluir remove o mundo e todos os seus saves deste navegador.');
        dangerActions.parentElement.classList.add('is-danger');
        dangerActions.append(makeAction('Excluir mundo', 'delete', () => onDeleteWorld(world)));
    }

    return { render };
}
