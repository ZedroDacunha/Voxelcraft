import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnlineRoom, readSignal, validPacket } from '../world-online.js';
import { ID } from '../world-catalog.js';

test('os códigos distinguem versão, convite, resposta e seed', () => {
    const code = btoa(JSON.stringify(['Voxelcraft/1', 7, 'offer', 'v=0\r\n']));
    assert.equal(readSignal(code, 'offer').seed, 7);
    assert.throws(() => readSignal(code, 'answer'));
    assert.throws(() => readSignal('abc', 'offer'));
    assert.throws(() => readSignal(btoa(JSON.stringify(['outro', 7, 'offer', 'v=0'])), 'offer'));
});

test('valida o conteúdo dos blocos, das poses e do chat antes de aplicá-los', () => {
    const block = { kind: 'block', x: -17, y: 63, z: 5, type: ID.CHEST, facing: 'west' };
    assert.ok(validPacket(block));
    assert.ok(validPacket({ ...block, type: 0 }));
    for (const patch of [{ y: 64 }, { x: 0.5 }, { facing: 'up' }, { type: ID.APPLE }]) {
        assert.equal(validPacket({ ...block, ...patch }), false);
    }
    assert.equal(validPacket({ kind: 'pose', x: Infinity, y: 0, z: 0, clock: 0, yaw: 0 }), false);
    assert.equal(validPacket({ kind: 'chat', text: 'a'.repeat(201) }), false);
});

test('guarda edições recebidas durante o carregamento e encerra a dupla uma vez', t => {
    const channel = { label: 'voxelcraft/1', readyState: 'open', bufferedAmount: 0, send() {} };
    class Peer {
        createDataChannel() { return channel; }
        close() {}
    }
    const original = globalThis.RTCPeerConnection;
    globalThis.RTCPeerConnection = Peer;
    t.after(() => {
        if (original) globalThis.RTCPeerConnection = original;
        else delete globalThis.RTCPeerConnection;
    });
    let closed = 0;
    const room = createOnlineRoom({ host: true, seed: 7, onOpen() {}, onClose() { closed++; } });
    const edit = { kind: 'block', x: 25, y: 34, z: -9, type: 0, facing: 'south' };
    const deliver = packet => channel.onmessage({ data: JSON.stringify(packet) });
    deliver(edit);
    deliver({ ...edit, x: 'inválido' });
    const received = [];
    room.receive(packet => received.push(packet));
    deliver({ ...edit, type: ID.STONE });
    assert.deepEqual(received, [edit, { ...edit, type: ID.STONE }]);
    deliver({ kind: 'leave' });
    room.close();
    assert.equal(closed, 1);
    assert.equal(room.connected, false);
});
