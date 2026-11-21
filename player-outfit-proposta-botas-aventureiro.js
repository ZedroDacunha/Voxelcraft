import { pixelFabric, fabricBox } from './player-outfit-tecido-textura-preview.js';
// Peças independentes nos pivôs das pernas, só para demonstração.
export function previewBoots(THREE, model, unit) {
    const leather=pixelFabric(THREE,[53,43,37]);
    const toe=pixelFabric(THREE,[58,46,38]);
    const cuff=pixelFabric(THREE,[66,52,42]);
    const sole=pixelFabric(THREE,[41,34,29]);
    const groups=[], originals=[];
    function box(parent,name,material,size,pos) {
        const m=new THREE.Mesh(fabricBox(THREE,size,unit),material);
        m.name=name;m.position.set(...pos.map(v=>v*unit));parent.add(m);
    }
    for(const [leg,side] of [[model.leftLeg,-1],[model.rightLeg,1]]) {
        const group=new THREE.Group();group.name='boot-preview';leg.add(group);groups.push(group);
        originals.push(leg.getObjectByName('boot'));
        // Pé levemente saliente, sola separada e cano em blocos.
        box(group,'boot-shaft',leather,[3.94,2.7,4.12],[0,-10.35,0]);
        box(group,'boot-toe',toe,[3.94,1.6,1.04],[0,-10.9,2.58]);
        box(group,'boot-sole',sole,[3.94,.3,5.16],[0,-11.85,.52]);
        // Aba envolve a calça sem superfície interna coplanar entre as pernas.
        box(group,'boot-cuff-front',cuff,[3.94,.9,.15],[0,-8.65,2.135]);
        box(group,'boot-cuff-back',cuff,[3.94,.9,.15],[0,-8.65,-2.135]);
        box(group,'boot-cuff-outer',cuff,[.15,.9,4.12],[side*2.045,-8.65,0]);
    }
    return {setVisible(value){groups.forEach(g=>g.visible=value);originals.forEach(g=>{if(g)g.visible=!value})}};
}
