import { pixelFabric } from './player-outfit-tecido-textura-preview.js';
// Gola em V com peça interior triangular e duas faixas elevadas contínuas.
export function previewVCollar(THREE, torso, unit) {
    const root=new THREE.Group();root.name='v-collar-preview';torso.add(root);
    const edge=pixelFabric(THREE,[61,89,55]);
    const lining=pixelFabric(THREE,[185,170,137]);
    // Triângulo fica logo acima da superfície da túnica; as bordas o emolduram.
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([
        -1.12*unit,11.91*unit,2.315*unit,
         0,10.35*unit,2.315*unit,
         1.12*unit,11.91*unit,2.315*unit
    ],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1, .5,0, 1,1],2));g.computeVertexNormals();
    const inset=new THREE.Mesh(g,lining);inset.name='collar-inset';root.add(inset);
    function edgeBetween(x1,y1,x2,y2) {
        const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(.25*unit,length*unit,.16*unit),edge);
        mesh.name='v-edge';mesh.position.set((x1+x2)/2*unit,(y1+y2)/2*unit,2.39*unit);
        mesh.rotation.z=-Math.atan2(dx,dy);root.add(mesh);
    }
    edgeBetween(-1.22,11.93,0,10.27);edgeBetween(1.22,11.93,0,10.27);
    // Relevos da gola ao redor do pescoço.
    function detail(name,mat,size,pos) {
        const m=new THREE.Mesh(new THREE.BoxGeometry(...size.map(v=>v*unit)),mat);
        m.name=name;m.position.set(...pos.map(v=>v*unit));root.add(m);
    }
    for(const side of [-1,1]) {
        // Camadas discretas no alto do ombro, com a gola acompanhando o pescoço.
        detail('collar-shoulder',edge,[.42,.10,.65],[side*1.44,12.02,1.90]);
    }
    detail('collar-back',edge,[2.9,.10,.36],[0,12.02,-1.98]);
    detail('collar-point',edge,[.30,.20,.18],[0,10.27,2.40]);
    return root;
}
