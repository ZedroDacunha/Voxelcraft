import { greenFabric, fabricBox, pixelFabric } from './player-outfit-tecido-textura-preview.js';
// Protótipo visual independente: mangas presas aos pivôs de braço nesta prévia.
export function previewSleeves(THREE, model, unit, color) {
    const green=greenFabric(THREE,color);
    const fabric=pixelFabric(THREE,[201,185,148]);
    const cuff=pixelFabric(THREE,[170,156,125]);
    const parts=[], originals=[];
    function box(parent,name,material,size,pos){const mesh=new THREE.Mesh(fabricBox(THREE,size,unit),material);mesh.name=name;mesh.position.set(...pos.map(v=>v*unit));parent.add(mesh)}
    for(const [arm, side] of [[model.leftArm,-1],[model.rightArm,1]]){
        const group=new THREE.Group();group.name='sleeve-3d-preview';arm.add(group);parts.push(group);
        const original=arm.children.find(child=>child.name==='sleeve');
        if(original) originals.push(original);
        // A face interna fica fora da lateral volumosa do tronco. A largura e
        // posição na direção X não mudam quando o braço gira no eixo X.
        box(group,'shoulder',green,[3.82,5,4.24],[side*.21,-2.5,0]);
        // Detalhe em relevo no topo, contido nas bordas do ombro.
        box(group,'shoulder-cap',green,[3.3,.16,3.7],[side*.21,.04,0]);
        box(group,'sleeve',fabric,[4.16,4.8,4.16],[0,-7.4,0]);
        box(group,'cuff',cuff,[4.20,.2,4.20],[0,-9.9,0]);
    }
    return {setVisible(v){parts.forEach(part=>part.visible=v);originals.forEach(part=>part.visible=!v)}};
}
