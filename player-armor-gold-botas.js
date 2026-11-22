import {pixelFabric, fabricBox} from './player-outfit-tecido-textura-preview.js';

// Quatro estudos independentes. Cada bota acompanha o pivô da sua perna.
export function previewGoldBoots(THREE, model, unit, option=0) {
    const copper=pixelFabric(THREE,[192,132,27]), shade=pixelFabric(THREE,[125,82,19]);
    const dark=pixelFabric(THREE,[88,57,15]), light=pixelFabric(THREE,[218,163,39]);
    const bright=pixelFabric(THREE,[255,226,112]);
    const groups=[], originals=[];
    function box(parent,name,mat,size,pos){const mesh=new THREE.Mesh(fabricBox(THREE,size,unit),mat);mesh.name=name;mesh.position.set(...pos.map(n=>n*unit));parent.add(mesh)}
    for(const [leg,side] of [[model.leftLeg,-1],[model.rightLeg,1]]){
        const group=new THREE.Group();group.name='gold-boot-preview';leg.add(group);groups.push(group);
        for(const name of ['boot-preview','boot']) {const o=leg.getObjectByName(name);if(o)originals.push({o,visible:o.visible});}
        // Volume fechado, com fresta entre as faces internas e sola na mesma altura.
        box(group,'shaft',copper,[3.94,3.55,4.45],[0,-10.18,0]);
        // A ponteira começa exatamente na frente do cano: não sobrepõe as faces laterais.
        box(group,'toe',copper,[3.94,1.46,.70],[0,-11.12,2.575]);
        // A sola envolve o cano e a ponteira sem faces coincidentes na borda inferior.
        box(group,'sole',dark,[4.04,.22,5.23],[0,-11.91,.34]);
        // Luzes em pequenos blocos e faixa superior em volta do cano.
        for(const z of [-1,1]){
            box(group,'upper-rim',option===1?dark:shade,[3.94,.22,.08],[0,-8.45,z*2.27]);
            box(group,'front-reflection',light,[.65,.60,.07],[side*.86,-9.4,z*2.27]);
            box(group,'front-glint',bright,[.25,.24,.05],[side*.86,-9.28,z*2.33]);
        }
        box(group,'side-rim',option===1?dark:shade,[.08,.22,4.5],[side*2.01,-8.45,0]);
        if(option===0){
            // A: pequena faixa clara nas ponteiras e superfícies limpas.
            box(group,'toe-light',light,[2.6,.28,.07],[0,-10.82,2.94]);
            box(group,'outer-light',light,[.06,.55,.6],[side*2.02,-9.45,.6]);
        } else if(option===1){
            // B: aro escuro conectado nas quatro faces e reflexo da ponteira.
            for(const z of [-1,1]) box(group,'ankle-band',shade,[3.94,.3,.08],[0,-10.15,z*2.27]);
            box(group,'ankle-outer',shade,[.08,.3,4.5],[side*2.01,-10.15,0]);
            box(group,'toe-light',light,[3.0,.28,.07],[0,-10.82,2.94]);
            box(group,'toe-glint',bright,[.8,.15,.05],[side*.6,-10.73,2.99]);
        } else if(option===2){
            // C: cano e ponteira iluminados como no ícone brilhante.
            for(const z of [-1,1]) box(group,'upper-bright',light,[3.94,.25,.08],[0,-8.72,z*2.27]);
            box(group,'upper-bright-outer',light,[.08,.25,4.5],[side*2.01,-8.72,0]);
            box(group,'toe-light',light,[3.30,.35,.07],[0,-10.85,2.94]);
            box(group,'toe-glint',bright,[1.4,.20,.05],[side*.55,-10.78,2.99]);
            box(group,'outer-glint',bright,[.05,.3,.4],[side*2.04,-9.1,.6]);
        } else {
            // D: barra inferior escura e blocos de luz mais discretos.
            for(const z of [-1,1])box(group,'lower-rim',shade,[3.94,.32,.08],[0,-11.55,z*2.27]);
            box(group,'lower-outer',shade,[.08,.32,4.5],[side*2.01,-11.55,0]);
            box(group,'toe-dark',shade,[3.94,.25,.07],[0,-11.55,2.94]);
            box(group,'toe-light',light,[2.2,.22,.07],[0,-10.84,2.94]);
        }
    }
    function setVisible(v){groups.forEach(g=>g.visible=!!v);for(const {o,visible} of originals)o.visible=v?false:visible;}
    setVisible(true);return {groups,setVisible};
}
