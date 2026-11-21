import { ID } from './world-catalog.js';
import { previewCopperHelmet } from './player-armor-copper-helmet.js';
import { previewConnectedHemChest } from './player-armor-copper-chest.js';

/** Peças visuais separadas, ligadas ao modelo; sem defesa nesta etapa. */
export function createPlayerArmor(THREE, model, unit) {
    const helmet=previewCopperHelmet(THREE,model,unit);helmet.setVisible(false);
    const chest=previewConnectedHemChest(THREE,model,unit);chest.setVisible(false);
    let headOn=false,chestOn=false;
    function setEquipment(slots=[]) {
        const head=slots[0]?.id===ID.COPPER_HELMET, body=slots[1]?.id===ID.COPPER_CHESTPLATE;
        if(head!==headOn){helmet.setVisible(head);headOn=head;}
        if(body!==chestOn){chest.setVisible(body);chestOn=body;}
        if(body)chest.sync();
    }
    function dispose(){
        helmet.setVisible(false);chest.setVisible(false);
        const geometries=new Set(),materials=new Set(),textures=new Set();
        for(const root of [helmet.helmet,chest.root])root.traverse(o=>{
            if(!o.isMesh)return;geometries.add(o.geometry);
            for(const mat of Array.isArray(o.material)?o.material:[o.material]){materials.add(mat);if(mat.map)textures.add(mat.map);}
        });
        helmet.helmet.removeFromParent();chest.root.removeFromParent();
        geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());textures.forEach(x=>x.dispose());
    }
    return {setEquipment, sync(){if(chestOn)chest.sync();},dispose};
}
