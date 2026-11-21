import { greenFabric, fabricBox } from './player-outfit-tecido-textura-preview.js';
// Protótipo visual: uma roupa separada em painéis 3D sobre o torso.
export function previewTunic(THREE, model, unit, color) {
    const torso=model.torso, material=greenFabric(THREE,color);
    const cloth=new THREE.Group();cloth.name='tunic-3d-preview';torso.add(cloth);
    function panel(size,pos){const mesh=new THREE.Mesh(fabricBox(THREE,size,unit),material);mesh.position.set(...pos.map(n=>n*unit));cloth.add(mesh)}
    // Volume extra sobre frente/costas/laterais, sem cobrir gola nem cinto.
    panel([8,9.85,.24],[0,7.075,2.18]);
    panel([8,9.85,.24],[0,7.075,-2.18]);
    for(const x of [-4.17,4.17]) panel([.24,9.85,4.14],[x,7.075,0]);
    // Barra volumosa curta abaixo do cinto; gira com o tronco.
    for(const z of [-2.18,2.18]) panel([8,2.25,.24],[0,-.325,z]);
    for(const x of [-4.17,4.17]) panel([.24,2.25,4.14],[x,-.325,0]);
    return {setVisible(v){cloth.visible=v;}};
}
