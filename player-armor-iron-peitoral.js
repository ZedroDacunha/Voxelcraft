import { pixelFabric, fabricBox } from './player-outfit-tecido-textura-preview.js';
// Estudo autoral inspirado no princípio de armadura em camadas articuladas.
export function previewIronChest(THREE,model,unit){
    const root=new THREE.Group();root.name='block-chest-preview';model.root.add(root);
    const torso=new THREE.Group(),left=new THREE.Group(),right=new THREE.Group();
    torso.name='chest-torso-pivot';left.name='chest-left-pivot';right.name='chest-right-pivot';root.add(torso,left,right);
    const copper=pixelFabric(THREE,[155,168,173]);
    const rim=pixelFabric(THREE,[65,72,77]);
    const shade=pixelFabric(THREE,[96,106,111]);
    const highlight=pixelFabric(THREE,[184,195,199]);
    const glint=pixelFabric(THREE,[239,244,244]);
    function box(parent,name,material,size,pos){const m=new THREE.Mesh(fabricBox(THREE,size,unit),material);m.name=name;m.position.set(...pos.map(n=>n*unit));parent.add(m);}
    // Duas placas simples e laterais envolvendo a roupa. O centro superior é
    // aberto em V por blocos, conforme a preferência já expressa pelo usuário.
    // A faixa inferior é dividida nos cantos para conectar as três faces
    // sem criar duas superfícies coplanares na mesma posição.
    box(torso,'front',copper,[8.76,10.92,.22],[0,4.14,2.715]);
    box(torso,'front-bottom-base',copper,[8.28,.18,.22],[0,-1.41,2.715]);
    const steps=[[9.6,10.2,.9],[10.2,10.8,1.9],[10.8,11.4,2.9],[11.4,12.1,3.9]];
    for(const [lo,hi,opening] of steps){
        const width=(8.76-opening)/2, x=(opening+width)/2;
        for(const side of [-1,1]) {
            box(torso,'front-neck',copper,[width,hi-lo,.22],[side*x,(lo+hi)/2,2.715]);
            // Borda curta na abertura, no mesmo tom sombreado do capacete.
            box(torso,'neck-rim',rim,[.12,hi-lo,.06],[side*(opening/2+.06),(lo+hi)/2,2.855]);
        }
    }
    box(torso,'neck-tip',rim,[.9,.12,.06],[0,9.54,2.855]);
    box(torso,'back',copper,[8.76,13.42,.22],[0,5.39,-2.715]);
    box(torso,'back-bottom-base',copper,[8.28,.18,.22],[0,-1.41,-2.715]);
    for(const side of [-1,1]) {
        box(torso,'side',copper,[.24,13.42,5.21],[side*4.26,5.39,0]);
        box(torso,'side-bottom-rim',rim,[.24,.18,5.65],[side*4.26,-1.41,0]);
    }
    // Borda curta nas extremidades da placa, tom próximo ao metal.
    box(torso,'front-bottom',rim,[8.76,.18,.08],[0,-1.41,2.865]);
    box(torso,'back-bottom',rim,[8.76,.18,.08],[0,-1.41,-2.865]);
    // Pequenos blocos de luz mantêm a leitura pixelada sem molduras fechadas.
    for(const side of [-1,1]){
        box(torso,'front-reflection',highlight,[.7,.55,.06],[side*2.9,8.9,2.855]);
        box(torso,'front-glint',glint,[.28,.25,.05],[side*2.9,9.0,2.91]);
        box(torso,'back-reflection',highlight,[.7,.55,.06],[side*2.9,8.9,-2.855]);
        box(torso,'back-glint',glint,[.28,.25,.05],[side*2.9,9.0,-2.91]);
        // Pequenas áreas de luz fazem a placa ler como cobre, também atrás.
        box(torso,'front-lower-light',highlight,[.36,.72,.06],[side*2.9,4.0,2.855]);
        box(torso,'back-lower-light',highlight,[.36,.72,.06],[side*2.9,4.0,-2.855]);
        box(torso,'front-dark-pixel',shade,[.32,.28,.06],[side*3.2,1.25,2.855]);
        box(torso,'back-dark-pixel',shade,[.32,.28,.06],[side*3.2,1.25,-2.855]);
    }
    for(const [arm,side] of [[left,-1],[right,1]]){
        // Face interna mais próxima do torso e barra abaixo da manga: não
        // deixar superfícies coplanares no torso ou na junção do braço.
        box(arm,'sleeve-armor',copper,[3.95,5.28,5.0],[side*.315,-2.42,0]);
        box(arm,'front-cuff',rim,[3.95,.18,.08],[side*.315,-4.97,2.54]);
        box(arm,'back-cuff',rim,[3.95,.18,.08],[side*.315,-4.97,-2.54]);
        box(arm,'outer-cuff',rim,[.08,.18,5],[side*2.33,-4.97,0]);
        box(arm,'front-reflection',highlight,[.65,.6,.06],[side*.9,-1.25,2.53]);
        box(arm,'front-glint',glint,[.25,.25,.05],[side*.9,-1.1,2.585]);
        box(arm,'back-reflection',highlight,[.65,.6,.06],[side*.9,-1.25,-2.53]);
        box(arm,'back-glint',glint,[.25,.25,.05],[side*.9,-1.1,-2.585]);
        // Detalhes sobre as faces expostas, sem mudar a face interna da manga.
        box(arm,'front-lower-light',highlight,[.45,.48,.06],[side*1.10,-3.35,2.53]);
        box(arm,'back-lower-light',highlight,[.45,.48,.06],[side*1.10,-3.35,-2.53]);
        box(arm,'shoulder-top-light',highlight,[.9,.06,.8],[side*.9,.25,0]);
        box(arm,'front-dark-pixel',shade,[.38,.26,.06],[side*1.1,-4.3,2.53]);
        box(arm,'back-dark-pixel',shade,[.38,.26,.06],[side*1.1,-4.3,-2.53]);
    }
    // As ombreiras pertencem ao peitoral e seguem o tronco, nunca a rotação
    // dos braços. As posições de repouso são as já aprovadas para os ombros.
    const offsets=[model.leftArm.position.clone().sub(model.torso.position),
                   model.rightArm.position.clone().sub(model.torso.position)];
    const scratch=new THREE.Vector3();
    function sync(){
        torso.position.copy(model.torso.position);
        torso.quaternion.copy(model.torso.quaternion);
        torso.scale.copy(model.torso.scale);
        for(const [i,shoulder] of [left,right].entries()){
            scratch.copy(offsets[i]).multiply(model.torso.scale).applyQuaternion(model.torso.quaternion);
            shoulder.position.copy(model.torso.position).add(scratch);
            shoulder.quaternion.copy(model.torso.quaternion);
            shoulder.scale.copy(model.torso.scale);
        }
    }
    // A manga verde está totalmente encoberta pela armadura. Suas faces
    // internas coincidiam exatamente com as da ombreira. Apenas sua exibição
    // é suspensa quando equipada; a geometria/material da roupa é preservada.
    const covered=[];
    for(const arm of [model.leftArm,model.rightArm]) arm.traverse(object=>{
        if(['shoulder','shoulder-cap','shoulder-hem','shoulder-back-hem'].includes(object.name))
            covered.push({object,original:object.visible});
    });
    function setVisible(value){
        root.visible=!!value;
        for(const {object,original} of covered) object.visible=value?false:original;
    }
    sync();setVisible(true);return {root,sync,setVisible};
}
