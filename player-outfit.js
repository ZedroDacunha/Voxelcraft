import { previewTunic } from './player-outfit-proposta-tunica-textura.js';
import { previewSleeves } from './player-outfit-proposta-manga-textura.js';
import { previewVCollar } from './player-outfit-proposta-gola-textura.js';
import { previewBelt } from './player-outfit-proposta-cinto-ajustado.js';
import { addGarmentDetails } from './player-outfit-proposta-detalhes-textura.js';
import { previewTrousers } from './player-outfit-proposta-calca-aventureiro.js';
import { previewBoots } from './player-outfit-proposta-botas-aventureiro.js';

/** Conjunto de roupa independente, preso aos pivôs reais para acompanhar todas as animações. */
export function createPlayerOutfit(THREE, model, unit, palette) {
    const {torso,leftArm,rightArm}=model;
    const before=new Set();model.root.traverse(o=>before.add(o));
    previewTunic(THREE,model,unit,palette.tunic);
    previewVCollar(THREE,torso,unit);
    previewBelt(THREE,torso,unit);
    const sleeves=previewSleeves(THREE,model,unit,palette.tunic);sleeves.setVisible(true);
    addGarmentDetails(THREE,model,unit);
    const pants=previewTrousers(THREE,model,unit);pants.setVisible(true);
    const boots=previewBoots(THREE,model,unit);boots.setVisible(true);
    for (const name of ['collar','belt','buckle']) torso.getObjectByName(name).visible=false;
    leftArm.position.x=-6.08*unit; rightArm.position.x=6.08*unit;
    // Limita o lado interno das mangas e mãos sem deslocar suas bordas externas.
    function trimInner(mesh,side) {
        const g=mesh.geometry.clone();g.computeBoundingBox();
        const min=g.boundingBox.min.x+mesh.position.x,max=g.boundingBox.max.x+mesh.position.x;
        const limit=side*1.69*unit;
        const lo=side>0?Math.max(min,-limit):min,hi=side<0?Math.min(max,-limit):max;
        if(hi>lo && (lo!==min || hi!==max)) {g.scale((hi-lo)/(max-min),1,1);mesh.position.x+=(lo+hi-min-max)/2;}
        return g;
    }
    const adjustedHands=[];
    for(const [arm,side] of [[leftArm,-1],[rightArm,1]]) {
        arm.traverse(mesh=>{if(mesh.isMesh && !before.has(mesh)) {const old=mesh.geometry;mesh.geometry=trimInner(mesh,side);old.dispose();}});
        const hand=arm.getObjectByName('hand'), original=hand.geometry;
        const adjusted=trimInner(hand,side);adjusted.scale(1,2/7,1);
        hand.geometry=adjusted;hand.position.y=-11*unit;adjustedHands.push({hand,original,adjusted});
    }
    // Os recursos são locais ao modelo e devem ser liberados com ele.
    const geometries=new Set(),materials=new Set(),textures=new Set();
    model.root.traverse(o=>{if(o.isMesh && !before.has(o)) {geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m.map)textures.add(m.map);}}});
    return {dispose(){
        for(const {hand,original,adjusted} of adjustedHands){hand.geometry=original;adjusted.dispose();}
        geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
    }};
}
