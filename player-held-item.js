/** Item visual da terceira pessoa. As malhas compartilham geometria e material
 * com a mão em primeira pessoa; só os objetos e transformações são independentes.
 */
export function createPlayerHeldItem(THREE, rightArm) {
    const anchor = new THREE.Group();
    anchor.name = 'heldItem';
    // Perto da mão, na frente do braço (+Z é a frente do personagem).
    anchor.position.set(0, -0.60, 0.18);
    rightArm.add(anchor);
    let lastId = null;

    function update(id, mesh, flame, isSprite) {
        if (id === lastId) return;
        lastId = id;
        anchor.clear();
        if (!id || !mesh) return;
        const copy = mesh.clone();
        // Posições de sprite alinham o cabo à mão. As posições de bloco/cama
        // pertencem ao enquadramento da primeira pessoa, então são zeradas.
        if (!isSprite) copy.position.set(0, 0, 0);
        copy.rotation.set(0, 0, 0);
        copy.scale.set(1, 1, 1);
        anchor.add(copy);
        if (flame) {
            const fire = flame.clone();
            anchor.add(fire);
        }
    }
    return { anchor, update };
}
