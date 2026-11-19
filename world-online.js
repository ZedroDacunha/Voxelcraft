// A sinalização via convite e resposta mantém o jogo compatível com o Pages.
// O canal confiável e ordenado leva tanto as edições quanto a confirmação do anfitrião.
import { BLOCKS } from './world-catalog.js';
import { WORLD_HEIGHT } from './world-save-settings.js';
import { isHorizontalFacing } from './world-block-orientation.js';
import { CHAT_INPUT_LIMIT } from './world-chat.js';

export function readSignal(code, type) {
    try {
        if (typeof code !== 'string' || code.length > 65536) throw new Error();
        const [version, seed, kind, sdp] = JSON.parse(atob(code.trim()));
        if (version !== 'Voxelcraft/1' || kind !== type || !Number.isInteger(seed) ||
            seed < 1 || seed > 2147483647 || typeof sdp !== 'string' || !sdp.startsWith('v=0')) throw new Error();
        return { seed, description: { type, sdp } };
    } catch {
        throw new Error(type === 'offer' ? 'Cole o convite completo do anfitrião.' : 'Cole a resposta completa do colega.');
    }
}

export function validPacket(p) {
    if (!p || typeof p !== 'object') return false;
    const coordinate = n => Number.isFinite(n) && Math.abs(n) <= 30000000;
    if (p.kind === 'pose') return [p.x, p.y, p.z].every(coordinate) && Number.isFinite(p.yaw)
        && Number.isFinite(p.clock) && p.clock >= 0 && p.clock < 1;
    if (p.kind === 'chat') return typeof p.text === 'string' && p.text.length > 0 && p.text.length <= CHAT_INPUT_LIMIT;
    return p.kind === 'block' && [p.x, p.z].every(n => Number.isInteger(n) && coordinate(n))
        && Number.isInteger(p.y) && p.y >= 0 && p.y < WORLD_HEIGHT
        && Number.isInteger(p.type) && (p.type === 0 || Object.hasOwn(BLOCKS, p.type))
        && isHorizontalFacing(p.facing);
}

export function createOnlineRoom({ host, seed, onOpen, onClose }) {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    let channel, receiver, closed = false, pending = [];
    function close() {
        if (closed) return;
        closed = true;
        pending = [];
        peer.close();
        onClose();
    }
    function attach(dataChannel) {
        if (channel || dataChannel.label !== 'voxelcraft/1') { dataChannel.close(); return; }
        channel = dataChannel;
        channel.onopen = () => { if (!closed) onOpen(); };
        channel.onclose = channel.onerror = close;
        channel.onmessage = ({ data }) => {
            if (closed || typeof data !== 'string' || data.length > 2048) return;
            let packet;
            try { packet = JSON.parse(data); } catch { return; }
            if (packet?.kind === 'leave') { close(); return; }
            if (!validPacket(packet)) return;
            if (receiver) receiver(packet);
            else if (pending.length < 8192) pending.push(packet);
            else close();
        };
    }
    peer.onconnectionstatechange = () => { if (peer.connectionState === 'failed') close(); };
    if (host) attach(peer.createDataChannel('voxelcraft/1'));
    else peer.ondatachannel = event => attach(event.channel);
    async function makeCode() {
        await peer.setLocalDescription(host ? await peer.createOffer() : await peer.createAnswer());
        // Sinalização em duas mensagens: incluir os candidatos de rede no próprio código.
        if (peer.iceGatheringState !== 'complete') await new Promise(resolve => {
            const finish = () => {
                clearTimeout(timer);
                peer.removeEventListener('icegatheringstatechange', check);
                resolve();
            };
            const check = () => { if (peer.iceGatheringState === 'complete') finish(); };
            const timer = setTimeout(finish, 6000);
            peer.addEventListener('icegatheringstatechange', check);
            check();
        });
        const description = peer.localDescription;
        if (closed || !description?.sdp.includes('a=candidate:')) throw new Error('Sem conexão disponível. Confira a rede e crie outro convite.');
        return btoa(JSON.stringify(['Voxelcraft/1', seed, description.type, description.sdp]));
    }
    return {
        host, seed, makeCode, close,
        leave() {
            this.send({ kind: 'leave' });
            close();
        },
        get connected() { return !closed && channel?.readyState === 'open'; },
        applySignal(signal) {
            if (signal.seed !== seed) throw new Error('Essa resposta pertence a outra partida.');
            return peer.setRemoteDescription(signal.description);
        },
        receive(callback) {
            receiver = callback;
            for (const packet of pending) receiver(packet);
            pending = [];
        },
        send(packet) {
            if (!this.connected) return;
            if (packet.kind === 'pose' && channel.bufferedAmount > 65536) return;
            if (channel.bufferedAmount > 4 * 1024 * 1024) { close(); return; }
            try { channel.send(JSON.stringify(packet)); } catch { close(); }
        },
    };
}
