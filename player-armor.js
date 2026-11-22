import { ID } from './world-catalog.js';
import { previewCopperHelmet } from './player-armor-copper-helmet.js';
import { previewConnectedHemChest } from './player-armor-copper-chest.js';
import { previewCopperLeggings } from './player-armor-copper-leggings.js';
import { previewCopperBoots } from './player-armor-copper-boots.js';
import { previewIronHelmet } from './player-armor-iron-capacete.js';
import { previewIronChest } from './player-armor-iron-peitoral.js';
import { previewIronLeggings } from './player-armor-iron-calca.js';
import { previewIronBoots } from './player-armor-iron-botas.js';
import { addIronArmorDetails } from './player-armor-iron-details.js';

/** Peças visuais separadas e articuladas, inclusive conjuntos mistos. */
export function createPlayerArmor(THREE, model, unit) {
    const copper = [previewCopperHelmet(THREE, model, unit), previewConnectedHemChest(THREE, model, unit),
        previewCopperLeggings(THREE, model, unit), previewCopperBoots(THREE, model, unit, 2)];
    // Cada modelo guarda a visibilidade original da roupa. O cobre precisa ser
    // desativado antes de criar o ferro para que ambos capturem o mesmo estado.
    copper.forEach(piece => piece.setVisible(false));
    const iron = [previewIronHelmet(THREE, model, unit), previewIronChest(THREE, model, unit),
        previewIronLeggings(THREE, model, unit), previewIronBoots(THREE, model, unit, 2)];
    addIronArmorDetails(THREE, unit, { helmet: iron[0], chest: iron[1], leggings: iron[2], boots: iron[3] });
    iron.forEach(piece => piece.setVisible(false));
    const groups = [copper, iron];
    const ids = [
        [ID.COPPER_HELMET, ID.COPPER_CHESTPLATE, ID.COPPER_LEGGINGS, ID.COPPER_BOOTS],
        [ID.IRON_HELMET, ID.IRON_CHESTPLATE, ID.IRON_LEGGINGS, ID.IRON_BOOTS],
    ];
    const active = [null, null, null, null];
    function setEquipment(slots = []) {
        for (let i = 0; i < active.length; i++) {
            const next = ids.findIndex(row => row[i] === slots[i]?.id);
            const old = active[i];
            if (old === next) continue;
            // Restaura antes de ocultar de novo: evita roupa/cabelo visível ao
            // trocar diretamente de cobre para ferro, ou vice-versa.
            if (old !== null && old >= 0) groups[old][i].setVisible(false);
            if (next >= 0) groups[next][i].setVisible(true);
            active[i] = next;
        }
        if (active[1] !== null && active[1] >= 0) groups[active[1]][1].sync();
    }
    function dispose() {
        setEquipment([]);
        const geometries = new Set(), materials = new Set(), textures = new Set();
        for (const pieces of groups) {
            const [helmet, chest, leggings, boots] = pieces;
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
        }
        geometries.forEach(x => x.dispose()); materials.forEach(x => x.dispose()); textures.forEach(x => x.dispose());
    }
    return { setEquipment, sync() { if (active[1] !== null && active[1] >= 0) groups[active[1]][1].sync(); }, dispose };
}
