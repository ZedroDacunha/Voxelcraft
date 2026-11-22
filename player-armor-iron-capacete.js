import { pixelFabric, fabricBox } from './player-outfit-tecido-textura-preview.js';
// Interpretação tridimensional do ícone aprovado; apenas para a prévia.
export function previewIronHelmet(THREE, model, unit) {
    const helmet=new THREE.Group();helmet.name='iron-helmet-preview';model.head.add(helmet);
    const edge=pixelFabric(THREE,[65,72,77]);
    const shadow=pixelFabric(THREE,[96,106,111]);
    const copper=pixelFabric(THREE,[155,168,173]);
    const mid=pixelFabric(THREE,[184,195,199]);
    const light=pixelFabric(THREE,[239,244,244]);
    function box(name,mat,size,pos) {
        const mesh=new THREE.Mesh(fabricBox(THREE,size,unit),mat);mesh.name=name;
        mesh.position.set(...pos.map(v=>v*unit));helmet.add(mesh);
    }
    // Cúpula em degraus: faixa superior mais estreita, corpo mais largo.
    box('top-step',edge,[8.2,.32,8.15],[0,8.92,0]);
    box('top-plate',mid,[8.7,.75,8.7],[0,8.385,0]);
    // Laterais e nuca terminam nas bordas do painel frontal: sem coplanaridade.
    box('back-plate',copper,[8.7,6.15,.55],[0,4.935,-4.075]);
    for(const side of [-1,1]) {
        box('side-plate',copper,[.55,6.15,7.6],[side*4.075,4.935,0]);
        // As duas pernas da silhueta U descem pelas bordas do rosto.
        box('front-side',copper,[1.3,4.75,.55],[side*3.7,4.235,4.075]);
        box('side-dark-bottom',shadow,[.07,.85,6.7],[side*4.385,2.35,0]);
        box('front-bottom',shadow,[1.3,.72,.07],[side*3.7,2.25,4.385]);
        box('front-inner-border',edge,[.16,4.3,.07],[side*2.97,4.1,4.385]);
        box('front-glint',light,[.8,.55,.07],[side*2.5,7.25,4.385]);
    }
    box('front-brow',copper,[8.7,1.4,.55],[0,7.31,4.075]);
    // Bordas em degraus sugerem o arco do ícone, deixando olhos livres.
    box('brow-inner',edge,[5.8,.20,.07],[0,6.53,4.385]);
    for(const side of [-1,1]) box('brow-step',shadow,[.65,.30,.07],[side*2.65,6.35,4.385]);
    box('brow-shine',mid,[4.1,.50,.07],[0,7.55,4.385]);
    const hair=model.head.getObjectByName('player-hair'),originalHair=hair?.visible;
    function setVisible(value){helmet.visible=!!value;if(hair)hair.visible=value?false:originalHair;}
    setVisible(true);
    return {helmet,setVisible};
}
