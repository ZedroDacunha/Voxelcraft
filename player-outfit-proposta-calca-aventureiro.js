import { pixelFabric, fabricBox } from './player-outfit-tecido-textura-preview.js';
// Proposta isolada: cada perna acompanha o seu próprio pivô de animação.
export function previewTrousers(THREE, model, unit) {
    const cloth=pixelFabric(THREE,[81,75,67]);
    const fold=pixelFabric(THREE,[75,69,61]);
    const highlight=pixelFabric(THREE,[88,81,71]);
    const groups=[], originals=[];
    function box(parent,name,material,size,pos) {
        const m=new THREE.Mesh(fabricBox(THREE,size,unit),material);
        m.name=name;m.position.set(...pos.map(v=>v*unit));parent.add(m);
    }
    for(const [leg,side] of [[model.leftLeg,-1],[model.rightLeg,1]]) {
        const group=new THREE.Group();group.name='trousers-preview';leg.add(group);groups.push(group);
        originals.push(leg.getObjectByName('trousers'));
        // Largura interna levemente menor para evitar faces coplanares entre pernas.
        box(group,'trouser-leg',cloth,[3.94,9,4.12],[0,-4.5,0]);
        // Painel baixo e blocos de dobra, todos acima da superfície do tecido.
        box(group,'knee-panel',highlight,[2.75,1.35,.09],[0,-5.35,2.105]);
        box(group,'fold-front',fold,[1.35,.22,.06],[side*.62,-3.0,2.09]);
        box(group,'fold-lower',fold,[1.05,.20,.06],[-side*.72,-7.55,2.09]);
        box(group,'fold-back',fold,[1.6,.22,.06],[side*.45,-6.7,-2.09]);
        // Relevo exterior, sem costura clara.
        box(group,'outer-panel',fold,[.08,3.1,2.3],[side*2.01,-4.5,-.12]);
    }
    return {setVisible(value){groups.forEach(g=>g.visible=value);originals.forEach(g=>{if(g)g.visible=!value})}};
}
