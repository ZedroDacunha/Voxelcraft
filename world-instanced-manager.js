/**
 * Manages groups of same-geometry objects using one InstancedMesh per type.
 * Instance IDs are stable handles; they are mapped to buffer slots internally,
 * so Swap-and-Pop does not invalidate the IDs of the instances that remain.
 */
export class InstancedBlockManager {
    constructor(THREE, scene, { maxCapacity = 2000 } = {}) {
        if (!THREE?.InstancedMesh || !THREE?.Matrix4 || !scene?.add) {
            throw new TypeError('Informe THREE e uma cena Three.js válida.');
        }
        if (!Number.isInteger(maxCapacity) || maxCapacity < 1) {
            throw new RangeError('maxCapacity precisa ser um inteiro maior que zero.');
        }
        this.THREE = THREE;
        this.scene = scene;
        this.defaultCapacity = maxCapacity;
        this.types = new Map();
    }

    registerType(type, geometry, material, { maxCapacity = this.defaultCapacity } = {}) {
        if (typeof type !== 'string' || !type) throw new TypeError('type precisa ser uma string não vazia.');
        if (this.types.has(type)) throw new Error(`O tipo "${type}" já foi registrado.`);
        if (!geometry?.isBufferGeometry || !material) {
            throw new TypeError('geometry precisa ser uma THREE.BufferGeometry e material deve ser informado.');
        }
        if (!Number.isInteger(maxCapacity) || maxCapacity < 1) {
            throw new RangeError('maxCapacity precisa ser um inteiro maior que zero.');
        }

        const mesh = this.#createMesh(geometry, material, maxCapacity);
        const state = {
            type,
            geometry,
            material,
            mesh,
            capacity: maxCapacity,
            count: 0,
            nextId: 1,
            slotInstanceIds: [],
            instanceSlots: new Map(),
        };
        mesh.name = `InstancedBlockManager:${type}`;
        mesh.count = 0;
        this.types.set(type, state);
        this.scene.add(mesh);
        return mesh;
    }

    addInstance(type, position, rotation = null, scale = 1) {
        const state = this.#getType(type);
        if (state.count === state.capacity) this.#grow(state);

        const id = state.nextId++;
        const slot = state.count;
        const matrix = this.#composeMatrix(position, rotation, scale);
        state.mesh.setMatrixAt(slot, matrix);
        state.slotInstanceIds[slot] = id;
        state.instanceSlots.set(id, slot);
        state.count++;
        state.mesh.count = state.count;
        state.mesh.instanceMatrix.needsUpdate = true;
        return id;
    }

    removeInstance(type, instanceId) {
        const state = this.#getType(type);
        const slot = state.instanceSlots.get(instanceId);
        if (slot === undefined) return false;

        const lastSlot = state.count - 1;
        if (slot !== lastSlot) {
            const movedId = state.slotInstanceIds[lastSlot];
            const movedMatrix = new this.THREE.Matrix4();
            state.mesh.getMatrixAt(lastSlot, movedMatrix);
            state.mesh.setMatrixAt(slot, movedMatrix);
            state.slotInstanceIds[slot] = movedId;
            state.instanceSlots.set(movedId, slot);
        }

        state.slotInstanceIds.pop();
        state.instanceSlots.delete(instanceId);
        state.count--;
        state.mesh.count = state.count;
        state.mesh.instanceMatrix.needsUpdate = true;
        return true;
    }

    updateInstanceTransform(type, instanceId, matrix) {
        const state = this.#getType(type);
        const slot = state.instanceSlots.get(instanceId);
        if (slot === undefined) return false;
        if (!matrix?.isMatrix4) throw new TypeError('matrix precisa ser uma THREE.Matrix4.');
        state.mesh.setMatrixAt(slot, matrix);
        state.mesh.instanceMatrix.needsUpdate = true;
        return true;
    }

    getInstanceIndex(type, instanceId) {
        return this.#getType(type).instanceSlots.get(instanceId) ?? -1;
    }

    getMesh(type) {
        return this.#getType(type).mesh;
    }

    getCount(type) {
        return this.#getType(type).count;
    }

    hasType(type) {
        return this.types.has(type);
    }

    computeBounds(type) {
        const state = this.#getType(type);
        state.mesh.computeBoundingSphere();
        state.mesh.frustumCulled = true;
    }

    unregisterType(type) {
        const state = this.#getType(type);
        if (state.count !== 0) return false;
        this.scene.remove(state.mesh);
        state.mesh.dispose?.();
        this.types.delete(type);
        return true;
    }

    dispose() {
        for (const state of this.types.values()) {
            this.scene.remove(state.mesh);
            state.mesh.dispose?.();
        }
        this.types.clear();
    }

    #getType(type) {
        const state = this.types.get(type);
        if (!state) throw new Error(`Tipo de instância não registrado: "${type}".`);
        return state;
    }

    #createMesh(geometry, material, capacity) {
        const mesh = new this.THREE.InstancedMesh(geometry, material, capacity);
        mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);
        // Call computeBounds after a batch of instance changes to refresh culling bounds.
        mesh.frustumCulled = false;
        return mesh;
    }

    #grow(state) {
        const oldMesh = state.mesh;
        const nextCapacity = state.capacity * 2;
        const nextMesh = this.#createMesh(state.geometry, state.material, nextCapacity);
        nextMesh.name = oldMesh.name;
        nextMesh.count = state.count;
        nextMesh.castShadow = oldMesh.castShadow;
        nextMesh.receiveShadow = oldMesh.receiveShadow;
        nextMesh.renderOrder = oldMesh.renderOrder;
        nextMesh.layers.mask = oldMesh.layers.mask;

        const matrix = new this.THREE.Matrix4();
        for (let slot = 0; slot < state.count; slot++) {
            oldMesh.getMatrixAt(slot, matrix);
            nextMesh.setMatrixAt(slot, matrix);
        }
        nextMesh.instanceMatrix.needsUpdate = true;

        this.scene.remove(oldMesh);
        this.scene.add(nextMesh);
        oldMesh.dispose?.();
        state.mesh = nextMesh;
        state.capacity = nextCapacity;
    }

    #composeMatrix(position, rotation, scale) {
        const THREE = this.THREE;
        const positionVector = this.#toVector3(position, [0, 0, 0]);
        const scaleVector = typeof scale === 'number'
            ? new THREE.Vector3(scale, scale, scale)
            : this.#toVector3(scale, [1, 1, 1]);
        let quaternion;
        if (rotation?.isQuaternion) quaternion = rotation.clone();
        else if (rotation?.isEuler) quaternion = new THREE.Quaternion().setFromEuler(rotation);
        else {
            const [x, y, z] = Array.isArray(rotation)
                ? rotation
                : [rotation?.x ?? 0, rotation?.y ?? 0, rotation?.z ?? 0];
            quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, rotation?.order ?? 'XYZ'));
        }
        return new THREE.Matrix4().compose(positionVector, quaternion, scaleVector);
    }

    #toVector3(value, fallback) {
        if (value?.isVector3) return value.clone();
        if (Array.isArray(value)) return new this.THREE.Vector3(value[0], value[1], value[2]);
        return new this.THREE.Vector3(
            value?.x ?? fallback[0],
            value?.y ?? fallback[1],
            value?.z ?? fallback[2],
        );
    }
}

/**
 * Browser test. Pass the application's THREE module and renderer:
 *   testInstancedMesh(THREE, renderer)
 */
export function testInstancedMesh(THREE, renderer = null) {
    if (!THREE?.InstancedMesh || !THREE?.WebGLRenderer) {
        throw new TypeError('Use testInstancedMesh(THREE, renderer) no console do navegador.');
    }

    const ownsRenderer = !renderer;
    const testRenderer = renderer ?? new THREE.WebGLRenderer({
        canvas: document.createElement('canvas'),
        antialias: false,
    });
    const testScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 24);
    camera.lookAt(0, 0, 0);

    const geometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const material = new THREE.MeshBasicMaterial({ color: 0x68c982 });
    const manager = new InstancedBlockManager(THREE, testScene, { maxCapacity: 2000 });
    manager.registerType('test-decoration', geometry, material, { maxCapacity: 2000 });

    let renderTarget = null;
    const previousTarget = testRenderer.getRenderTarget();
    const previousAutoReset = testRenderer.info.autoReset;
    try {
        const ids = [];
        for (let i = 0; i < 2000; i++) {
            const x = (i % 50 - 24.5) * 0.11;
            const y = (Math.floor(i / 50) - 19.5) * 0.11;
            ids.push(manager.addInstance('test-decoration', [x, y, 0], null, 0.08));
        }

        const mesh = manager.getMesh('test-decoration');
        const removedId = ids[1000];
        const movedId = ids[ids.length - 1];
        const removedSlot = manager.getInstanceIndex('test-decoration', removedId);
        const movedSlotBefore = manager.getInstanceIndex('test-decoration', movedId);
        const expectedMovedMatrix = new THREE.Matrix4();
        mesh.getMatrixAt(movedSlotBefore, expectedMovedMatrix);

        testRenderer.info.autoReset = false;
        testRenderer.info.reset();
        renderTarget = new THREE.WebGLRenderTarget(64, 64);
        testRenderer.setRenderTarget(renderTarget);
        testRenderer.clear();
        testRenderer.render(testScene, camera);
        const drawCalls = testRenderer.info.render.calls;

        const removed = manager.removeInstance('test-decoration', removedId);
        const movedSlotAfter = manager.getInstanceIndex('test-decoration', movedId);
        const actualMovedMatrix = new THREE.Matrix4();
        manager.getMesh('test-decoration').getMatrixAt(movedSlotAfter, actualMovedMatrix);
        const matrixPreserved = expectedMovedMatrix.elements.every((value, index) =>
            Math.abs(value - actualMovedMatrix.elements[index]) < 1e-6);
        const swapAndPopPassed = removed && manager.getCount('test-decoration') === 1999 &&
            movedSlotAfter === removedSlot && matrixPreserved;
        const result = {
            passed: drawCalls === 1 && swapAndPopPassed,
            instanceCount: 2000,
            drawCalls,
            expectedDrawCalls: 1,
            removedCount: manager.getCount('test-decoration'),
            swapAndPopPassed,
            movedInstanceSlot: movedSlotAfter,
        };
        if (!result.passed) throw new Error(`Falha em testInstancedMesh: ${JSON.stringify(result)}`);
        return result;
    } finally {
        testRenderer.setRenderTarget(previousTarget);
        testRenderer.info.reset();
        testRenderer.info.autoReset = previousAutoReset;
        renderTarget?.dispose();
        manager.dispose();
        geometry.dispose();
        material.dispose();
        if (ownsRenderer) {
            testRenderer.dispose();
            testRenderer.forceContextLoss?.();
        }
    }
}

if (typeof window !== 'undefined') window.testInstancedMesh = testInstancedMesh;
