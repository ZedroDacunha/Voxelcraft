// Estudo visual de cinto: peça própria, com relevo e textura autoral pixelada.
export function previewBelt(THREE, torso, unit) {
    const root=new THREE.Group();root.name='belt-preview';torso.add(root);
    const pixels=new Uint8Array(32*8*4);
    for(let y=0;y<8;y++)for(let x=0;x<32;x++){
        const n=(x*37+y*19+x*y*11)%29;
        const d=n<3?-12:n<7?7:n===28?12:0;
        const i=(y*32+x)*4; pixels[i]=105+d;pixels[i+1]=70+d;pixels[i+2]=43+d;pixels[i+3]=255;
    }
    const map=new THREE.DataTexture(pixels,32,8);map.needsUpdate=true;map.flipY=true;map.colorSpace=THREE.SRGBColorSpace;
    map.magFilter=map.minFilter=THREE.NearestFilter;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=false;
    const leather=new THREE.MeshLambertMaterial({map});
    const dark=new THREE.MeshLambertMaterial({color:0x503522});
    const stitch=new THREE.MeshLambertMaterial({color:0xb39366});
    const gold=new THREE.MeshLambertMaterial({color:0xc6a75b});
    const goldLight=new THREE.MeshLambertMaterial({color:0xe2c681});
    function box(name,mat,size,pos){const m=new THREE.Mesh(new THREE.BoxGeometry(...size.map(v=>v*unit)),mat);m.name=name;m.position.set(...pos.map(v=>v*unit));root.add(m);return m}
    // Cinto contínuo envolve a túnica; faces laterais não se sobrepõem.
    box('leather-front',leather,[8.4,1.30,.22],[0,1.52,2.34]);
    box('leather-back',leather,[8.4,1.30,.22],[0,1.52,-2.34]);
    for(const x of [-4.19,4.19]) box('leather-side',leather,[.21,1.30,4.46],[x,1.52,0]);
    // Filetes acima e abaixo da tira dão profundidade sem superfície coincidente.
    for(const y of [.99,2.05]) {
        box('edge-front',dark,[8.35,.10,.07],[0,y,2.485]);
        box('edge-back',dark,[8.35,.10,.07],[0,y,-2.485]);
        for(const x of [-4.325,4.325])box('edge-side',dark,[.06,.10,4.45],[x,y,0]);
    }
    // Fivela aberta em quatro peças mais pino; aro, base e brilho são camadas distintas.
    box('buckle-backing',dark,[1.65,1.16,.07],[0,1.52,2.49]);
    for(const x of [-.73,.73])box('buckle-side',gold,[.18,1.18,.16],[x,1.52,2.60]);
    for(const y of [.99,2.05])box('buckle-edge',gold,[1.55,.18,.16],[0,y,2.60]);
    box('buckle-pin',goldLight,[.70,.12,.11],[.25,1.52,2.64]);
    // Passador e três pequenos furos escuros fora da fivela.
    box('keeper',dark,[.22,1.22,.12],[1.32,1.52,2.53]);
    box('keeper-highlight',stitch,[.06,1.05,.035],[1.30,1.52,2.61]);
    for(const x of [1.85,2.30,2.75]) box('hole',dark,[.12,.12,.045],[x,1.52,2.48]);
    return root;
}
