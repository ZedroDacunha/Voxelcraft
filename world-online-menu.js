import { createOnlineRoom, readSignal } from './world-online.js';

export function bindOnlineMenu({ randomSeed, launch }) {
    const el = name => document.getElementById('online-' + name);
    const dialog = el('dialog'), status = el('status'), input = el('input'), output = el('output');
    let room, timeout, inGame = false, step;
    function reset() {
        clearTimeout(timeout);
        const previous = room;
        room = null;
        previous?.close();
        step = 'choose';
        input.value = output.value = '';
        el('choices').hidden = false;
        el('incoming').hidden = el('outgoing').hidden = el('next').hidden = true;
        el('next').disabled = false;
        status.textContent = 'Uma partida para dois. O mundo novo fica salvo no navegador de quem criar a sala.';
    }
    function watchConnection() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            reset();
            status.textContent = 'A conexão expirou. Criem outro convite ou tentem outra rede.';
        }, 120000);
    }
    function startRoom(host, seed) {
        const session = createOnlineRoom({
            host, seed,
            async onOpen() {
                if (room !== session) return;
                clearTimeout(timeout);
                inGame = true;
                window.addEventListener('pagehide', () => session.leave(), { once: true });
                dialog.close();
                try { await launch(session); }
                catch {
                    inGame = false;
                    reset();
                    dialog.showModal();
                    status.textContent = 'Falha ao abrir a partida. Confira o armazenamento do navegador e tente novamente.';
                }
            },
            onClose() {
                if (room !== session) return;
                if (inGame) { window.dispatchEvent(new Event('online-room-closed')); return; }
                reset();
                status.textContent = 'Não foi possível conectar. Criem outro convite ou tentem outra rede.';
            },
        });
        room = session;
        return session;
    }
    function askCode(join) {
        step = join ? 'join' : 'answer';
        el('choices').hidden = true;
        el('incoming').hidden = el('next').hidden = false;
        el('input-label').textContent = join ? 'Convite do anfitrião' : 'Resposta do colega';
        el('next').textContent = join ? 'Gerar resposta' : 'Conectar';
        input.focus();
    }
    function showOutput(code, host) {
        output.value = code;
        el('outgoing').hidden = false;
        el('output-label').textContent = host ? 'Seu convite' : 'Sua resposta';
        status.textContent = host ? 'Envie o convite ao colega e cole abaixo a resposta dele.'
            : 'Envie a resposta a quem criou a sala. Mantenha esta tela aberta.';
    }
    el('open').onclick = () => {
        reset();
        dialog.showModal();
        if (typeof RTCPeerConnection !== 'function') {
            el('choices').hidden = true;
            status.textContent = 'Este navegador não oferece WebRTC. Abra o jogo no Chrome, Edge ou Firefox atualizado.';
        }
    };
    el('cancel').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { if (!inGame) reset(); });
    el('host').onclick = async () => {
        el('choices').hidden = true;
        status.textContent = 'Preparando o convite…';
        let session;
        try {
            session = startRoom(true, randomSeed());
            const code = await session.makeCode();
            if (room !== session) return;
            showOutput(code, true);
            askCode(false);
        } catch (error) { if (room === session || !session) { reset(); status.textContent = error.message; } }
    };
    el('join').onclick = () => {
        status.textContent = 'Peça um convite ao colega que criou a sala.';
        askCode(true);
    };
    el('next').onclick = async () => {
        const join = step === 'join';
        let session = room;
        el('next').disabled = true;
        try {
            const signal = readSignal(input.value, join ? 'offer' : 'answer');
            if (join) session = startRoom(false, signal.seed);
            await session.applySignal(signal);
            if (room !== session) return;
            if (join) {
                status.textContent = 'Preparando a resposta…';
                const code = await session.makeCode();
                if (room !== session || inGame) return;
                showOutput(code, false);
            } else status.textContent = 'Conectando ao colega…';
            el('incoming').hidden = el('next').hidden = true;
            if (!inGame) watchConnection();
        } catch (error) {
            if (session !== room) return;
            if (join && session) { reset(); askCode(true); }
            status.textContent = error.message;
            el('next').disabled = false;
        }
    };
    el('copy').onclick = async () => {
        try { await navigator.clipboard.writeText(output.value); status.textContent = 'Código copiado. Envie ao colega.'; }
        catch { output.focus(); output.select(); status.textContent = 'Código selecionado. Use a opção Copiar do navegador.'; }
    };
}
