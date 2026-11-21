import { pixelFabric } from './player-outfit-tecido-textura-preview.js';
// Detalhes autorais discretos adicionados ao conjunto articulado da prévia.
export function addGarmentDetails(THREE, parts, unit) {
    const hem=pixelFabric(THREE,[67,93,57]);
    const seam=pixelFabric(THREE,[100,125,84]);
    function box(parent,name,mat,size,pos){
        const m=new THREE.Mesh(new THREE.BoxGeometry(...size.map(v=>v*unit)),mat);
        m.name=name;m.position.set(...pos.map(v=>v*unit));parent.add(m);
    }
    const t=parts.torso;
    // Costuras verticais e uma bainha 3D na parte inferior da túnica.
    for(const z of [-2.34,2.34]) {
        box(t,'bottom-hem',hem,[8.04,.22,.10],[0,-1.28,z]);
        for(const x of [-2.65,2.65]) {
            box(t,'panel-seam',seam,[.11,6.6,.07],[x,6.20,z]);
        }
    }
    for(const x of [-4.32,4.32])box(t,'hem-side',hem,[.09,.22,4.30],[x,-1.28,0]);
    for(const [arm,side] of [[parts.leftArm,-1],[parts.rightArm,1]]) {
        // Relevo e costura acompanham o pivô de cada manga.
        box(arm,'shoulder-hem',hem,[3.82,.22,.09],[side*.21,-4.88,2.18]);
        box(arm,'shoulder-back-hem',hem,[3.82,.22,.09],[side*.21,-4.88,-2.18]);
    }
}
