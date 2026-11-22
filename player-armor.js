import { ID } from './world-catalog.js';
import { previewCopperHelmet } from './player-armor-copper-helmet.js';
import { previewConnectedHemChest } from './player-armor-copper-chest.js';
import { previewCopperLeggings } from './player-armor-copper-leggings.js';
import { previewCopperBoots } from './player-armor-copper-boots.js';

/** Peças visuais separadas, ligadas ao modelo; sem defesa nesta etapa. */
export function createPlayerArmor(THREE, model, unit) {
    const helmet = previewCopperHelmet(THREE, model, unit);
    const chest = previewConnectedHemChest(THREE, model, unit);
    const leggings = previewCopperLeggings(THREE, model, unit);
    const boots = previewCopperBoots(THREE, model, unit, 2);
    const pieces = [helmet, chest, leggings, boots];
    const ids = [ID.COPPER_HELMET, ID.COPPER_CHESTPLATE, ID.COPPER_LEGGINGS, ID.COPPER_BOOTS];
    const active = [false, false, false, false];
    pieces.forEach(piece => piece.setVisible(false));
    function setEquipment(slots = []) {
        for (let i = 0; i < pieces.length; i++) {
            const enabled = slots[i]?.id === ids[i];
            if (enabled !== active[i]) { pieces[i].setVisible(enabled); active[i] = enabled; }
        }
        if (active[1]) chest.sync();
    }
    function dispose() {
        pieces.forEach(piece => piece.setVisible(false));
        const geometries = new Set(), materials = new Set(), textures = new Set();
        for (const root of [helmet.helmet, chest.root, ...leggings.groups, ...boots.groups]) {
            root.traverse(o => {
                if (!o.isMesh) return;
                geometries.add(o.geometry);
                for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
                    materials.add(mat); if (mat.map) textures.add(mat.map);
                }
            });
            root.removeFromParent();
        }
        geometries.forEach(x => x.dispose()); materials.forEach(x => x.dispose()); textures.forEach(x => x.dispose());
    }
    return { setEquipment, sync() { if (active[1]) chest.sync(); }, dispose };
}
