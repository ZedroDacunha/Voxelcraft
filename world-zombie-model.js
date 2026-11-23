import { createPlayerModel } from './player-model.js';
import { hairSurface } from './player-hair.js';

// Modelo experimental extraído das prévias aprovadas; independente do jogador.
export function createZombieModel(THREE) {
const model=createPlayerModel(THREE,{tunic:0x394f3b,trim:0x2d4031,belt:0x564b3b,buckle:0x9b8e72,skin:0x9eaaa5,sleeve:0x879488,trousers:0x384c39,boots:0x554334},{outfit:false});model.head.visible=false;const u=1.8/32;
const colors={coat:new THREE.MeshLambertMaterial({color:0xb3a58a}),light:new THREE.MeshLambertMaterial({color:0xc1b498}),shade:new THREE.MeshLambertMaterial({color:0x857d6a}),dark:new THREE.MeshLambertMaterial({color:0x655e50}),stain:new THREE.MeshLambertMaterial({color:0x92927a})};const coat=new THREE.Group();coat.name='estudo-casaco';model.torso.add(coat);
function box(mat,size,pos){const m=new THREE.Mesh(new THREE.BoxGeometry(...size.map(n=>n*u)),colors[mat]);m.position.set(...pos.map(n=>n*u));coat.add(m);return m}
// Frente aberta deixa a túnica verde visível; peças laterais e traseiras são conectadas.
for(const side of [-1,1]){box('coat',[2.55,10.2,.3],[side*2.82,6.7,2.15]);box('coat',[.3,10.2,4.45],[side*4.14,6.7,0]);box('light',[.38,5.8,.1],[side*1.68,8.0,2.36]);box('shade',[.7,1.5,.1],[side*3.65,3.0,2.36]);}
box('coat',[8.55,10.2,.3],[0,6.7,-2.15]);
// Barras em degraus mantêm os rasgos ligados ao tecido, sem peças flutuantes.
for(const [x,w,h] of [[-3.65,.8,1.05],[-2.65,.9,.62],[2.2,.8,.85],[3.4,1.1,1.2]])box('coat',[w,h,.3],[x,1.6-h/2,2.15]);
for(const [x,w,h] of [[-3.5,1.3,.8],[-1.75,1.2,1.05],[.1,1.1,.6],[2,1.3,1.1],[3.55,.8,.75]])box('coat',[w,h,.3],[x,1.6-h/2,-2.15]);
// Manchas e desgaste em tecido, posicionados ligeiramente fora das superfícies.
for(const [x,y,w,h] of [[-3.3,6.7,.7,.7],[-2.6,6.3,.5,.35],[3.35,4.6,.5,.9],[2.9,10,.55,.4]])box('stain',[w,h,.035],[x,y,2.316]);
for(const [x,y,w,h] of [[-2.7,8,.75,.6],[1.2,4.1,.8,.55],[2.7,4.5,.45,.4]])box('stain',[w,h,.035],[x,y,-2.316]);
for(const [x,y] of [[-1.48,8.3],[-1.48,6.5],[-1.48,4.7]])box('dark',[.27,.27,.04],[x,y,2.37]);
// Detalhes mantidos dentro da abertura do casaco; pequenas camadas ligadas ao tronco.
const detail=new THREE.Group();detail.name='detalhe-tronco-zumbi';model.torso.add(detail);
const palette={shadow:new THREE.MeshLambertMaterial({color:0x283b30}),weave:new THREE.MeshLambertMaterial({color:0x52644c}),wear:new THREE.MeshLambertMaterial({color:0x6f7b60}),skin:new THREE.MeshLambertMaterial({color:0x89998b}),rot:new THREE.MeshLambertMaterial({color:0x708176})};
function detailBox(kind,w,h,x,y,z=2.035,depth=.025){const m=new THREE.Mesh(new THREE.BoxGeometry(w*u,h*u,depth*u),palette[kind]);m.position.set(x*u,y*u,z*u);detail.add(m)}
// Sombra assimétrica e trama em blocos que preservam leitura de tecido verde.
for(const [x,y,w,h] of [[-1.05,9.1,.3,1.05],[.9,7.9,.35,1.4],[-.85,4.3,.35,1.1],[.85,3.2,.3,.75]])detailBox('shadow',w,h,x,y);
for(const [x,y,w,h] of [[-.55,10.35,.45,.28],[.48,9.65,.52,.3],[-.2,8.35,.42,.2],[-.85,7.65,.25,.65],[.85,5.1,.28,.7],[-.4,3.55,.46,.25]])detailBox('weave',w,h,x,y,2.038,.03);
// Rasgo anterior: conservado para comparação.
const oldTearStart=detail.children.length;
detailBox('shadow',1.05,1.42,-.25,6.05,2.04,.035);detailBox('shadow',.55,.165,-.25,6.8425,2.04,.035);detailBox('shadow',.55,.165,-.25,5.2575,2.04,.035);
detailBox('skin',.7,1.08,-.25,6.05,2.065,.025);detailBox('skin',.32,.16,-.25,6.67,2.065,.025);detailBox('skin',.32,.16,-.25,5.43,2.065,.025);
detailBox('rot',.25,.33,-.34,6.0,2.082,.012);detailBox('wear',.38,.16,.18,6.65,2.083,.012);detailBox('wear',.32,.17,-.75,5.45,2.083,.012);
// Estudo separado para comparar o novo cinto sem alterar o tronco aprovado.
const beltDetail=new THREE.Group();beltDetail.name='cinto-detalhado-zumbi';model.torso.add(beltDetail);
const beltMat={leather:new THREE.MeshLambertMaterial({color:0x514435}),shadow:new THREE.MeshLambertMaterial({color:0x382f28}),wear:new THREE.MeshLambertMaterial({color:0x80694e}),metal:new THREE.MeshLambertMaterial({color:0x9d9175}),light:new THREE.MeshLambertMaterial({color:0xbdb092}),metalDark:new THREE.MeshLambertMaterial({color:0x6a604c})};
function beltBox(kind,size,pos){const m=new THREE.Mesh(new THREE.BoxGeometry(...size.map(n=>n*u)),beltMat[kind]);m.position.set(...pos.map(n=>n*u));beltDetail.add(m)}
// Fundo em couro e borda inferior projetados à frente do cinto original.
beltBox('leather',[3.0,1.14,.10],[0,1.5,2.12]);beltBox('shadow',[3.0,.15,.025],[0,1.04,2.185]);
// Fivela envelhecida: base metálica, centro escuro e pino de relevo.
beltBox('metal',[1.03,.96,.08],[0,1.54,2.21]);beltBox('metalDark',[.68,.60,.025],[0,1.54,2.262]);beltBox('leather',[.43,.34,.025],[0,1.54,2.28]);beltBox('light',[.13,.45,.03],[0,1.54,2.31]);beltBox('light',[.7,.09,.02],[0,1.96,2.26]);
// Presilhas e pequenas marcas de desgaste no couro, fora da fivela.
for(const x of [-1.12,1.12])beltBox('wear',[.13,.87,.035],[x,1.56,2.188]);
for(const [x,y] of [[-.78,1.34],[-.85,1.7],[.76,1.3],[.85,1.72]])beltBox('wear',[.2,.1,.025],[x,y,2.19]);
// Texturas de baixa resolução com blocos de trama e desgaste, aplicadas às
// superfícies em vez de placas sobrepostas, evitando costuras flutuantes.
const oldShirtTear=detail.children.slice(oldTearStart);
function fabricTexture(kind){
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f5f5';ctx.fillRect(0,0,64,64);
 let seed=kind==='coat'?19237:7421;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 // Padrão discreto com manchas maiores e tramas curtas em pixel art.
 for(let n=0;n<50;n++){const x=Math.floor(rand()*16)*4,y=Math.floor(rand()*16)*4,w=(1+Math.floor(rand()*2))*4,h=(1+Math.floor(rand()*3))*4;const shade=Math.floor(211+rand()*37);ctx.fillStyle=`rgb(${shade},${shade},${shade})`;ctx.fillRect(x,y,w,h)}
 for(let n=0;n<28;n++){const x=Math.floor(rand()*16)*4,y=Math.floor(rand()*16)*4;const shade=Math.floor(226+rand()*25);ctx.fillStyle=`rgb(${shade},${shade},${shade})`;ctx.fillRect(x,y,4,2)}
 const texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
const coatTexture=fabricTexture('coat'),tunicTexture=fabricTexture('tunic');const tunic=model.torso.getObjectByName('tunic');
// Mantém as texturas aprovadas e acrescenta mangas como peças filhas do pivô de cada braço.
for(const key of ['coat','light','shade']){colors[key].map=coatTexture;colors[key].needsUpdate=true}tunic.material.map=tunicTexture;tunic.material.needsUpdate=true;beltDetail.visible=true;
const armDetails=[];const skinMark=new THREE.MeshLambertMaterial({color:0x788d80});const skinShade=new THREE.MeshLambertMaterial({color:0x899b8b});
function armBox(parent,material,size,pos){const m=new THREE.Mesh(new THREE.BoxGeometry(...size.map(n=>n*u)),material);m.position.set(...pos.map(n=>n*u));parent.add(m)}
for(const [idx,arm] of [model.leftArm,model.rightArm].entries()){
 const detail=new THREE.Group();detail.name='estudo-manga-zumbi';arm.add(detail);armDetails.push(detail);
 const side=idx===0?-1:1;const sleeveDetail=new THREE.Group();sleeveDetail.position.x=side*.20*u;detail.add(sleeveDetail);
 // As peças originais ficam ocultas na proposta: a manga não compartilha a
 // face superior com a manga base, e a pele começa abaixo da manga.
 const originalSleeve=arm.getObjectByName('sleeve'),originalHand=arm.getObjectByName('hand');
 const hand=new THREE.Mesh(new THREE.BoxGeometry(4*u,6.16*u,4*u),originalHand.material);hand.position.set(0,-8.92*u,0);detail.add(hand);
 detail.userData.originalSleeve=originalSleeve;detail.userData.originalHand=originalHand;detail.userData.hand=hand;
 // Cobertura até o antebraço, articulada junto ao braço, com bordas em degraus.
 armBox(sleeveDetail,colors.coat,[3.76,5.8,4.18],[0,-2.9,0]);
 // A bainha é uma continuação volumétrica da manga, envolvendo as quatro
 // faces do braço. Trechos contíguos têm alturas diferentes para sugerir
 // rasgos, mantendo o topo de cada trecho ligado ao tecido principal.
 const minX=-2.10-side*.20,maxX=2.10-side*.20;
 const step=(maxX-minX)/4,frontHeights=idx===0?[1.35,.70,1.05,.62]:[.82,1.35,.75,1.10];
 const backHeights=idx===0?[.78,1.10,.68,1.18]:[1.12,.74,1.05,.80];
 function hemSegment(x,w,h,z){armBox(sleeveDetail,colors.coat,[w,h+.035,.26],[x,-5.8-h/2+.017,z])}
 for(let n=0;n<4;n++){const x=minX+(n+.5)*step;hemSegment(x,step+.002,frontHeights[n],2.02);hemSegment(x,step+.002,backHeights[n],-2.02)}
 // Laterais fecham a espessura e conectam os cantos às faces dianteira e traseira.
 for(const [x,front,back] of [[minX+.13,frontHeights[0],backHeights[0]],[maxX-.13,frontHeights[3],backHeights[3]]]){
  const heights=[back,Math.min(back,front)*.82,front];const dz=3.78/3;
  for(let n=0;n<3;n++){const h=heights[n];armBox(sleeveDetail,colors.coat,[.26,h+.035,dz],[x,-5.8-h/2+.017,-1.89+(n+.5)*dz])}
 }
 // Manchas de tecido nas quatro faces e pele descolorida abaixo das mangas.
 for(const [x,y,w,h] of (idx===0?[[-.9,-3.1,.75,.55],[.65,-4.4,.55,.8]]:[[.75,-2.4,.65,.7],[-.8,-4.2,.7,.45]]))armBox(sleeveDetail,colors.stain,[w,h,.035],[x,y,2.108]);
 armBox(sleeveDetail,colors.stain,[.8,.55,.035],[idx===0?.7:-.7,-3.6,-2.108]);
 for(const [x,y,w,h] of (idx===0?[[-.7,-9.3,.8,.8],[.15,-10.2,.5,.5]]:[[.7,-8.8,.7,.65],[-.55,-10.1,.75,.7]]))armBox(detail,skinMark,[w,h,.035],[x,y,2.02]);
 armBox(detail,skinShade,[.6,.55,.035],[idx===0?.75:-.75,-8.0,-2.02]);
}
// Textura sutil para a pele, independente dos materiais da roupa.
const skinCanvas=document.createElement('canvas');skinCanvas.width=64;skinCanvas.height=64;const skinCtx=skinCanvas.getContext('2d');skinCtx.fillStyle='#f4f4f4';skinCtx.fillRect(0,0,64,64);let seed=42521;
for(let n=0;n<55;n++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=(seed%16)*4;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=(seed%16)*4;const c=214+(seed%30);skinCtx.fillStyle=`rgb(${c},${c},${c})`;skinCtx.fillRect(x,y,8,4)}
const skinTex=new THREE.CanvasTexture(skinCanvas);skinTex.colorSpace=THREE.SRGBColorSpace;skinTex.magFilter=THREE.NearestFilter;skinTex.minFilter=THREE.NearestFilter;
const skinNew=new THREE.MeshLambertMaterial({color:0x9eaaa5,map:skinTex});
const rotDark=new THREE.MeshLambertMaterial({color:0x60776a}),rotMid=new THREE.MeshLambertMaterial({color:0x778b7b}),bone=new THREE.MeshLambertMaterial({color:0xc8c2a7}),boneLight=new THREE.MeshLambertMaterial({color:0xe0d9bc}),boneShade=new THREE.MeshLambertMaterial({color:0xa49f89});
const improvements=[];
for(const [idx,detail] of armDetails.entries()){
 const hand=detail.userData.hand,oldGeometry=hand.geometry;detail.userData.oldGeometry=oldGeometry;
 const improved=new THREE.Group();detail.add(improved);improvements.push(improved);
 if(idx===0){
  // Retira a face frontal e recompõe células de pele fora da abertura.
  const trimmed=oldGeometry.clone(),arr=oldGeometry.index.array,front=oldGeometry.groups[4],keep=[];
  for(let k=0;k<arr.length;k++)if(k<front.start||k>=front.start+front.count)keep.push(arr[k]);trimmed.clearGroups();trimmed.setIndex(keep);detail.userData.cutGeometry=trimmed;
  // Grade sobre a superfície frontal; algumas células omitidas formam a abertura irregular.
  const hole=new Set(['1,3','2,3','1,4','2,4','1,5','2,5']);
  for(let y=0;y<8;y++)for(let x=0;x<4;x++){
   const xx=-1.5+x,yy=-11.8+(y+.5)*.74;
   if(!hole.has(`${x},${y}`))armBox(improved,skinNew,[1,.74,.018],[xx,yy,2.004]);
  }
  // A versão anterior e a nova compartilham a mesma abertura na pele.
  const oldWound=new THREE.Group(),deepWound=new THREE.Group();improved.add(oldWound,deepWound);detail.userData.oldWound=oldWound;detail.userData.deepWound=deepWound;
  armBox(oldWound,rotDark,[1.95,2.22,.06],[0,-8.47,1.965]);
  armBox(oldWound,rotMid,[1.65,2.02,.04],[0,-8.47,2.005]);
  armBox(oldWound,boneShade,[.68,1.85,.09],[.12,-8.42,2.055]);armBox(oldWound,bone,[.52,1.60,.055],[.12,-8.42,2.118]);armBox(oldWound,boneLight,[.14,1.05,.025],[-.01,-8.35,2.16]);
  // Fundo recuado e paredes perpendiculares realmente fecham a cavidade;
  // o osso inteiro fica atrás do plano da pele (z=2).
  const innerShadow=new THREE.MeshLambertMaterial({color:0x52685b}),innerWall=new THREE.MeshLambertMaterial({color:0x718477});
  armBox(deepWound,innerShadow,[2,2.22,.06],[0,-8.47,1.07]);
  for(const x of [-.98,.98])armBox(deepWound,innerWall,[.04,2.22,.94],[x,-8.47,1.53]);
  for(const y of [-9.56,-7.38])armBox(deepWound,innerWall,[1.96,.04,.94],[0,y,1.53]);
  // Duas versões do osso utilizam a mesma cavidade, para comparação.
  const oldBone=new THREE.Group(),newBone=new THREE.Group();deepWound.add(oldBone,newBone);detail.userData.oldBone=oldBone;detail.userData.newBone=newBone;
  armBox(oldBone,boneShade,[.76,1.90,.34],[.05,-8.46,1.32]);armBox(oldBone,bone,[.58,1.68,.20],[.05,-8.46,1.58]);armBox(oldBone,boneLight,[.13,1.15,.025],[-.08,-8.42,1.692]);
  // Segmentos unidos formam um osso parcialmente exposto: extremidades mais
  // largas e haste mais estreita, sem bordas arredondadas ou faces coplanares.
  const segments=[[-9.285,.76,.30],[-8.985,.62,.30],[-8.665,.46,.34],[-8.325,.50,.34],[-7.995,.62,.32],[-7.685,.78,.30]];
  for(const [y,w,h] of segments){
   armBox(newBone,boneShade,[w,h,.34],[.05,y,1.31]);
   armBox(newBone,bone,[w-.10,h-.02,.12],[.05,y,1.54]);
   armBox(newBone,boneLight,[.10,h-.08,.018],[.05-(w-.10)/2+.075,y,1.61]);
  }
  // Pequenas irregularidades e manchas sutis, fixas à superfície do osso.
  const weathered=new THREE.MeshLambertMaterial({color:0xb0a88e});
  for(const [x,y,w,h] of [[.15,-9.27,.16,.09],[.12,-8.66,.12,.10],[.13,-8.02,.15,.10],[.25,-7.68,.16,.09]])armBox(newBone,weathered,[w,h,.018],[x,y,1.61]);

  // Bordas irregulares aderidas à pele e às paredes, sem cobrir o osso.
  const woundDetail=new THREE.Group();improved.add(woundDetail);detail.userData.woundDetail=woundDetail;
  const woundDark=new THREE.MeshLambertMaterial({color:0x543933}),woundEdge=new THREE.MeshLambertMaterial({color:0x775048}),blood=new THREE.MeshLambertMaterial({color:0x8e2728}),bloodLight=new THREE.MeshLambertMaterial({color:0xac3c36});
  // Fragmentos retangulares sobre a pele ao redor da abertura; não são decalques soltos.
  for(const [x,y,w,h] of [[-1.08,-7.52,.22,.35],[-.85,-7.29,.4,.16],[-.25,-7.29,.35,.16],[.65,-7.29,.42,.16],[1.08,-7.65,.2,.45],[-1.08,-8.35,.2,.4],[1.08,-8.55,.2,.38],[-1.08,-9.42,.22,.3],[-.65,-9.64,.45,.14],[.4,-9.64,.5,.14],[1.08,-9.28,.2,.4]])armBox(woundDetail,woundEdge,[w,h,.024],[x,y,2.025]);
  // Paredes internas, com blocos escuros e sangue recuados abaixo da pele.
  for(const [x,y,w,h,z] of [[-.72,-7.57,.42,.20,1.82],[.68,-7.56,.35,.18,1.82],[-.86,-8.12,.18,.45,1.80],[.85,-8.86,.18,.5,1.80],[-.55,-9.4,.5,.17,1.80],[.65,-9.4,.42,.17,1.80]])armBox(woundDetail,woundDark,[w,h,.12],[x,y,z]);
  for(const [x,y,w,h,z] of [[-.78,-7.58,.25,.12,1.91],[.82,-8.5,.13,.30,1.90],[-.85,-9.08,.13,.24,1.90],[.58,-9.42,.25,.10,1.90]])armBox(woundDetail,blood,[w,h,.035],[x,y,z]);
  // Fios de sangue conectados à borda inferior, curtos e pixelados.
  armBox(woundDetail,blood,[.18,.55,.025],[-.67,-9.92,2.028]);armBox(woundDetail,blood,[.15,.28,.025],[-.55,-10.22,2.028]);
  armBox(woundDetail,blood,[.16,.36,.025],[.67,-9.83,2.028]);armBox(woundDetail,bloodLight,[.07,.15,.028],[-.69,-9.8,2.045]);
  for(const [x,y] of [[-1.15,-7.0],[1.15,-10.45],[-1.1,-10.8]])armBox(improved,skinShade,[.4,.38,.02],[x,y,2.023]);
 }else{
  armBox(improved,skinMark,[.42,.38,.025],[1.3,-9.65,2.025]);
  armBox(improved,skinShade,[.4,.4,.025],[-1.15,-8.15,-2.025]);
 }
}
// Mantém o estado refinado aprovado dos braços.
armDetails.forEach((d,idx)=>{d.visible=true;d.userData.originalSleeve.visible=false;d.userData.originalHand.visible=false;const h=d.userData.hand;h.material=skinNew;h.geometry=idx===0?d.userData.cutGeometry:d.userData.oldGeometry;improvements[idx].visible=true;for(const child of d.children)if(child.isMesh&&(child.material===skinMark||child.material===skinShade))child.visible=idx!==0;if(idx===0){d.userData.oldWound.visible=false;d.userData.deepWound.visible=true;d.userData.oldBone.visible=false;d.userData.newBone.visible=true;d.userData.woundDetail.visible=true}});
// Detalhes próprios de cada perna, conectados aos pivôs de movimento.
const legDetails=[];const pantsWear=new THREE.MeshLambertMaterial({color:0x5c6a52}),pantsDark=new THREE.MeshLambertMaterial({color:0x2b3b2e}),pantsSkin=new THREE.MeshLambertMaterial({color:0x8a9a88}),bootEdge=new THREE.MeshLambertMaterial({color:0x3b3028}),bootLight=new THREE.MeshLambertMaterial({color:0x80684e});
for(const [idx,leg] of [model.leftLeg,model.rightLeg].entries()){
 const d=new THREE.Group();leg.add(d);legDetails.push(d);const pants=leg.getObjectByName('trousers');d.userData.pants=pants;
 // Marcas no tecido e um rasgo escalonado por cima da superfície frontal.
 const spots=idx===0?[[-1.0,-2.0,.65,.65],[.7,-6.5,.6,.7],[-.5,-7.3,.45,.35]]:[[.8,-2.7,.65,.75],[-.8,-6.3,.5,.65],[.5,-7.4,.45,.4]];
 for(const [x,y,w,h] of spots)armBox(d,pantsWear,[w,h,.026],[x,y,2.02]);
 const oldTear=new THREE.Group();d.add(oldTear);d.userData.oldTear=oldTear;
 const x=idx===0?.45:-.5,y=idx===0?-5.0:-4.4;
 armBox(oldTear,pantsDark,[1.0,1.05,.03],[x,y,2.025]);armBox(oldTear,pantsSkin,[.62,.68,.025],[x,y,2.058]);
 armBox(oldTear,pantsWear,[.25,.16,.02],[x-.43,y+.38,2.047]);
 // Sola, biqueira e desgaste, ligados ao calçado original.
 armBox(d,bootEdge,[4.05,.35,.08],[0,-11.75,2.04]);
 armBox(d,bootEdge,[.08,.35,4.05],[2.04,-11.75,0]);armBox(d,bootEdge,[.08,.35,4.05],[-2.04,-11.75,0]);
 armBox(d,bootLight,[1.25,.18,.035],[0,-10.75,2.025]);armBox(d,bootLight,[.45,.25,.035],[idx===0?-1:1,-11.2,2.025]);
}
// Cada perna recebe frente contínua com aberturas reais; UVs seguem a peça
// inteira, evitando repetir a textura em cada pixel ou criar placas soltas.
const tears=[];const tearSkin=new THREE.MeshLambertMaterial({color:0x899b89,map:skinTex});const edgeMat=new THREE.MeshLambertMaterial({color:0x6a775b});const shadowMat=new THREE.MeshLambertMaterial({color:0x26392d});
for(const [idx,d] of legDetails.entries()){
 const pants=d.userData.pants,old=pants.geometry;d.userData.oldGeometry=old;
 const trimmed=old.clone(),arr=old.index.array,front=old.groups[4],keep=[];for(let k=0;k<arr.length;k++)if(k<front.start||k>=front.start+front.count)keep.push(arr[k]);trimmed.clearGroups();trimmed.setIndex(keep);d.userData.cutGeometry=trimmed;
 const cuffGeometry=trimmed.clone(),position=cuffGeometry.getAttribute('position');
 // Encurta a geometria da calça preservando o topo; a barra é reconstruída abaixo.
 for(let p=0;p<position.count;p++)if(position.getY(p)<0)position.setY(p,position.getY(p)+.5*u);position.needsUpdate=true;cuffGeometry.computeVertexNormals();cuffGeometry.computeBoundingSphere();d.userData.cuffGeometry=cuffGeometry;
 const holes=new Set(idx===0?['4,8','5,8','6,8','4,9','5,9','6,9','5,10','6,10','2,3','2,4']:['2,8','3,8','4,8','2,9','3,9','4,9','2,10','3,10','5,4','5,5']);
 const g=new THREE.Group();d.parent.add(g);tears.push(g);
 function frontMesh(ragged){
  const positions=[],normals=[],uv=[];
  for(let y=0;y<18;y++)for(let x=0;x<8;x++){
   if(holes.has(`${x},${y}`))continue;
   // Alguns quadrados da última fileira ficam faltando na barra.
   if(ragged&&y===0&&(idx===0?[2,3,5,7]:[0,2,4,5]).includes(x))continue;
   const x0=-2+x*.5,x1=x0+.5,y0=-9+y*.5,y1=y0+.5,z=2.001;
   for(const [xx,yy] of [[x0,y0],[x1,y0],[x1,y1],[x0,y0],[x1,y1],[x0,y1]]){positions.push(xx*u,yy*u,z*u);normals.push(0,0,1);uv.push((xx+2)/4,(yy+9)/9)}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const m=new THREE.Mesh(geo,pants.material);g.add(m);return m;
 }
 const oldFront=frontMesh(false),raggedFront=frontMesh(true);d.userData.oldFront=oldFront;d.userData.raggedFront=raggedFront;
 // Pele recuada dos rasgos já existentes, sem tocar as laterais externas.
 armBox(g,tearSkin,[3.88,8.38,.10],[0,-4.25,1.84]);
 const cuff=new THREE.Group();g.add(cuff);d.userData.cuff=cuff;
 // Pele debaixo da barra, separada do topo do sapato e das faces da calça.
 armBox(cuff,tearSkin,[3.8,.48,3.8],[0,-8.75,0]);
 // Trechos de tecido conectados à borda inferior na traseira e nas laterais.
 const lengths=idx===0?[.30,.48,.17,.38]:[.42,.20,.46,.26];
 for(let x=0;x<4;x++){const h=lengths[x];armBox(cuff,pants.material,[1,h,.10],[-1.5+x,-8.5-h/2,-1.95]);}
 for(const side of [-1,1])for(let z=0;z<4;z++){const h=lengths[side<0?z:3-z];armBox(cuff,pants.material,[.10,h,.95],[side*1.95,-8.5-h/2,-1.425+z*.95]);}
 // Sombras e fios curtos se prendem nas bordas sem avançar como placas isoladas.
 for(const cell of holes){const [x,y]=cell.split(',').map(Number),xx=-1.75+x*.5,yy=-8.75+y*.5;
  if(!holes.has(`${x-1},${y}`))armBox(g,pantsDark,[.035,.5,.11],[xx-.24,yy,1.945]);
  if(!holes.has(`${x+1},${y}`))armBox(g,pantsDark,[.035,.5,.11],[xx+.24,yy,1.945]);
  if(!holes.has(`${x},${y+1}`))armBox(g,pantsDark,[.5,.035,.11],[xx,yy+.24,1.945]);
  if(!holes.has(`${x},${y-1}`))armBox(g,pantsDark,[.5,.035,.11],[xx,yy-.24,1.945]);
  if(!holes.has(`${x},${y+1}`))armBox(g,edgeMat,[.38,.10,.035],[xx,yy+.22,2.025]);
  if(!holes.has(`${x},${y-1}`))armBox(g,shadowMat,[.38,.085,.035],[xx,yy-.22,2.025]);
 }
}
// Mantém a calça com a barra rasgada; o comparador troca apenas os sapatos.
legDetails.forEach((d,idx)=>{d.visible=true;d.userData.oldTear.visible=false;d.userData.pants.geometry=d.userData.cuffGeometry;d.userData.pants.material.map=tunicTexture;d.userData.pants.material.needsUpdate=true;tears[idx].visible=true;d.userData.oldFront.visible=false;d.userData.raggedFront.visible=true;d.userData.cuff.visible=true});
const shoeGroups=[];const shoeLeather=new THREE.MeshLambertMaterial({color:0x594635,map:coatTexture}),shoeToe=new THREE.MeshLambertMaterial({color:0x67503d,map:coatTexture}),shoeSole=new THREE.MeshLambertMaterial({color:0x302a25}),shoeWear=new THREE.MeshLambertMaterial({color:0x927b5d}),shoeDark=new THREE.MeshLambertMaterial({color:0x3d322c});
for(const [idx,leg] of [model.leftLeg,model.rightLeg].entries()){
 const shoe=new THREE.Group();leg.add(shoe);shoeGroups.push(shoe);const boot=leg.getObjectByName('boot');shoe.userData.original=boot;
 // Sola e biqueira volumétrica ligadas ao corpo; medidas próximas ao calçado 3D do jogador.
 armBox(shoe,shoeSole,[3.94,.38,5.02],[0,-11.81,.51]);
 armBox(shoe,shoeToe,[3.94,1.66,1.04],[0,-10.79,2.52]);
 // Corpo com abertura verdadeira na face frontal superior.
 const shaft=new THREE.BoxGeometry(3.94*u,2.64*u,4*u),topFront=shaft.groups[4],oldIdx=shaft.index.array,kept=[];
 for(let k=0;k<oldIdx.length;k++)if(k<topFront.start||k>=topFront.start+topFront.count)kept.push(oldIdx[k]);shaft.clearGroups();shaft.setIndex(kept);
 const body=new THREE.Mesh(shaft,shoeLeather);body.position.set(0,-10.32*u,0);shoe.add(body);
 const holes=new Set(idx===0?['4,4','5,4','4,5','5,5','6,5']:['1,4','2,4','1,5','2,5','3,5']);
 const pos=[],norm=[],uv=[];const w=3.94/8,h=2.64/6;
 for(let y=0;y<6;y++)for(let x=0;x<8;x++){
  if(holes.has(`${x},${y}`))continue;
  const x0=-1.97+x*w,x1=x0+w,y0=-11.64+y*h,y1=y0+h;
  for(const [xx,yy] of [[x0,y0],[x1,y0],[x1,y1],[x0,y0],[x1,y1],[x0,y1]]){pos.push(xx*u,yy*u,2.001*u);norm.push(0,0,1);uv.push((xx+1.97)/3.94,(yy+11.64)/2.64)}
 }
 const mesh=new THREE.BufferGeometry();mesh.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));mesh.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));mesh.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));shoe.add(new THREE.Mesh(mesh,shoeLeather));
 armBox(shoe,tearSkin,[3.82,2.54,.12],[0,-10.32,1.83]);
 // Bordas e fibras em degraus conectadas ao couro, não placas flutuantes.
 for(const cell of holes){const [x,y]=cell.split(',').map(Number),xx=-1.97+(x+.5)*w,yy=-11.64+(y+.5)*h;
  if(!holes.has(`${x},${y-1}`))armBox(shoe,shoeDark,[w*.9,.09,.05],[xx,yy-h*.42,2.025]);
  if(!holes.has(`${x},${y+1}`))armBox(shoe,shoeWear,[w*.8,.08,.045],[xx,yy+h*.42,2.025]);
 }
 // Desgaste discreto nas laterais e na biqueira.
 for(const side of [-1,1]){armBox(shoe,shoeWear,[.035,.22,1.1],[side*1.988,-10.35,-.4]);armBox(shoe,shoeDark,[.035,.19,.7],[side*1.988,-11.15,.4])}
 armBox(shoe,shoeWear,[1.0,.15,.03],[idx===0?-.6:.6,-10.9,3.055]);armBox(shoe,shoeDark,[.5,.12,.03],[idx===0?.5:-.5,-11.25,3.055]);
}
// Mantém os sapatos 3D na prévia; o comparador troca somente o rasgo da camiseta.
shoeGroups.forEach((g,idx)=>{g.visible=true;g.userData.original.visible=false;for(const child of legDetails[idx].children)if(child.isMesh&&(child.material===bootEdge||child.material===bootLight))child.visible=false});
const shirtOldGeometry=tunic.geometry,shirtCut=shirtOldGeometry.clone(),shirtIdx=shirtOldGeometry.index.array,shirtFront=shirtOldGeometry.groups[4],shirtKeep=[];for(let k=0;k<shirtIdx.length;k++)if(k<shirtFront.start||k>=shirtFront.start+shirtFront.count)shirtKeep.push(shirtIdx[k]);shirtCut.clearGroups();shirtCut.setIndex(shirtKeep);
const shirtTear=new THREE.Group();model.torso.add(shirtTear);
const holes=new Set(['7,10','8,10','7,11','8,11','9,11','7,12','8,12','9,12','8,13']);const p=[],n=[],uv=[];
for(let y=0;y<24;y++)for(let x=0;x<16;x++){
 if(holes.has(`${x},${y}`))continue;const x0=-4+x*.5,x1=x0+.5,y0=y*.5,y1=y0+.5;
 for(const [xx,yy] of [[x0,y0],[x1,y0],[x1,y1],[x0,y0],[x1,y1],[x0,y1]]){p.push(xx*u,yy*u,2.001*u);n.push(0,0,1);uv.push((xx+4)/8,yy/12)}
}
const shirtGeo=new THREE.BufferGeometry();shirtGeo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));shirtGeo.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));shirtGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));shirtTear.add(new THREE.Mesh(shirtGeo,tunic.material));
const exposed=new THREE.MeshLambertMaterial({color:0x8d9d8e,map:skinTex}),wornEdge=new THREE.MeshLambertMaterial({color:0x79866a}),insideEdge=new THREE.MeshLambertMaterial({color:0x283b30}),skinDull=new THREE.MeshLambertMaterial({color:0x738879});
armBox(shirtTear,exposed,[7.88,11.88,.1],[0,6,1.84]);
for(const cell of holes){const [x,y]=cell.split(',').map(Number),xx=-3.75+x*.5,yy=.25+y*.5;
 if(!holes.has(`${x-1},${y}`))armBox(shirtTear,insideEdge,[.035,.5,.11],[xx-.24,yy,1.945]);
 if(!holes.has(`${x+1},${y}`))armBox(shirtTear,insideEdge,[.035,.5,.11],[xx+.24,yy,1.945]);
 if(!holes.has(`${x},${y+1}`)){armBox(shirtTear,insideEdge,[.5,.035,.11],[xx,yy+.24,1.945]);armBox(shirtTear,wornEdge,[.32,.085,.03],[xx,yy+.21,2.025])}
 if(!holes.has(`${x},${y-1}`)){armBox(shirtTear,insideEdge,[.5,.035,.11],[xx,yy-.24,1.945]);armBox(shirtTear,insideEdge,[.32,.075,.03],[xx,yy-.21,2.025])}
}
// Marcas na pele recuada, restritas à abertura.
armBox(shirtTear,skinDull,[.20,.24,.025],[-.22,6.15,1.91]);armBox(shirtTear,skinDull,[.15,.18,.025],[.22,5.76,1.91]);
// Preserva o rasgo detalhado; a comparação controla apenas a mochila.
tunic.geometry=shirtCut;oldShirtTear.forEach(m=>m.visible=false);shirtTear.visible=true;
const backpack=new THREE.Group();backpack.name='estudo-mochila-zumbi';model.torso.add(backpack);
const bagCloth=new THREE.MeshLambertMaterial({color:0x70553c,map:coatTexture}),bagFlap=new THREE.MeshLambertMaterial({color:0x806047,map:coatTexture}),bagDark=new THREE.MeshLambertMaterial({color:0x4a392d}),bagLight=new THREE.MeshLambertMaterial({color:0xa0835c}),bagMetal=new THREE.MeshLambertMaterial({color:0xa99a7a});
// Corpo principal encostado no casaco, com profundidade própria em blocos.
armBox(backpack,bagCloth,[5.2,7.2,1.8],[0,7.15,-3.23]);
// Aba e bolso externos: volumes ligados à face traseira do corpo.
armBox(backpack,bagFlap,[5.3,1.65,.18],[0,9.85,-4.22]);
armBox(backpack,bagCloth,[3.65,2.3,.34],[0,5.8,-4.29]);
armBox(backpack,bagFlap,[3.72,.54,.12],[0,7.0,-4.50]);
// Tiras e fechos no exterior da mochila.
for(const x of [-1.35,1.35]){armBox(backpack,bagDark,[.34,3.0,.08],[x,8.9,-4.34]);armBox(backpack,bagMetal,[.38,.34,.045],[x,7.82,-4.405]);}
armBox(backpack,bagDark,[.40,1.9,.07],[0,5.78,-4.50]);armBox(backpack,bagMetal,[.44,.36,.045],[0,5.35,-4.558]);
// Alças sobre a parte superior dos ombros; sem bloquear a abertura do casaco.
const upperStraps=new THREE.Group();backpack.add(upperStraps);
for(const x of [-2.72,2.72]){
 armBox(upperStraps,bagDark,[.52,4.9,.12],[x,9.55,2.38]);
 armBox(upperStraps,bagDark,[.52,.16,4.75],[x,12.06,.04]);
 armBox(upperStraps,bagDark,[.52,1.5,.12],[x,11.25,-2.38]);
 armBox(upperStraps,bagLight,[.3,.34,.035],[x,8.0,2.46]);
}
// Marcas de desgaste discretas sobre as superfícies do bolso e da aba.
for(const [x,y,w,h] of [[-1.7,10.0,.65,.18],[1.5,9.5,.5,.25],[-1.0,5.2,.6,.16],[.85,6.15,.42,.2]])armBox(backpack,bagLight,[w,h,.025],[x,y,y>8?-4.325:-4.475]);
// Extensões presas à parte inferior das alças existentes. Elas acompanham o
// casaco, passam pelas laterais e chegam ao ponto inferior do corpo da mochila.
const lowerStraps=new THREE.Group();lowerStraps.name='alcas-inferiores';backpack.add(lowerStraps);
for(const side of [-1,1]){
 const x=side*2.72;
 // Prolongamento da alça frontal, conectado à peça existente em y=7.1.
 armBox(lowerStraps,bagDark,[.52,2.6,.12],[x,5.8,2.38]);
 // Parte frontal até a lateral, com pequena interseção nas junções.
 armBox(lowerStraps,bagDark,[1.28,.42,.12],[side*3.62,4.71,2.38]);
 // Lateral por baixo do braço; a alça pertence ao tronco, não ao pivô do braço.
 armBox(lowerStraps,bagDark,[.08,.42,4.64],[side*4.30,4.71,0]);
 // Volta para dentro das costas e encosta no corpo inferior da mochila.
 armBox(lowerStraps,bagDark,[1.66,.42,.12],[side*3.43,4.71,-2.38]);
 // Marca de ajuste sobre a parte frontal da alça.
 armBox(lowerStraps,bagMetal,[.22,.25,.035],[x,5.05,2.46]);
}
// Faixas espessas compostas por segmentos com volume e curvas suaves;
// cada sequência é contínua até o corpo inferior da mochila.
// A orientação transversal acompanha a face do corpo: largura deitada na
// frente e largura vertical nas laterais, mantendo a espessura em 3D.
const curvedStraps=new THREE.Group(),fixedStraps=new THREE.Group();backpack.add(curvedStraps,fixedStraps);
function band(group,a,b,width=.78,depth=.20,outward=null){
 const start=new THREE.Vector3(...a).multiplyScalar(u),end=new THREE.Vector3(...b).multiplyScalar(u),delta=end.clone().sub(start);const axis=delta.clone().normalize();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(width*u,delta.length()+.045*u,depth*u),bagDark);
 mesh.position.copy(start.add(end).multiplyScalar(.5));
 if(!outward)mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
 else{const normal=new THREE.Vector3(...outward);normal.addScaledVector(axis,-normal.dot(axis)).normalize();const cross=new THREE.Vector3().crossVectors(axis,normal).normalize();normal.crossVectors(cross,axis).normalize();mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(cross,axis,normal))}
 group.add(mesh);
}
for(const side of [-1,1]){
 const path=[[2.55,12.05,2.39],[2.66,11.0,2.39],[2.92,9.85,2.39],[3.22,8.65,2.39],[3.44,7.45,2.39],[3.55,6.32,2.39],[3.58,5.3,2.39],[3.83,4.85,2.24],[4.13,4.68,1.85],[4.15,4.55,.8],[4.15,4.5,-.55],[4.08,4.50,-1.68],[3.75,4.52,-2.34],[3.05,4.52,-2.38],[2.25,4.52,-2.43]].map(([x,y,z])=>[side*x,y,z]);
 // Na versão ajustada a faixa lateral fica fora da face do casaco,
 // que termina em x=4.29; sua face interna começa além dessa superfície.
 const shifted=path.map((point,index)=>index>=8&&index<=12?[side*4.46,point[1],index===12?-2.25:point[2]]:point);
 for(let n=1;n<path.length;n++){
  const normal=n<=7?[0,0,1]:n<=12?[side,0,0]:[0,0,-1];
  band(curvedStraps,path[n-1],path[n],.78,.20,normal);
  band(fixedStraps,shifted[n-1],shifted[n],.78,.20,normal);
 }
 for(const g of [curvedStraps,fixedStraps]){
  const fixed=true;
  band(g,[side*2.55,12.05,2.39],[side*2.55,12.10,-2.38],.78,.22,fixed?[0,1,0]:null);
  band(g,[side*2.55,12.10,-2.38],[side*2.45,10.48,-2.43],.78,.22,fixed?[0,0,-1]:null);
  armBox(g,bagMetal,[.48,.25,.04],[side*3.35,7.95,2.52]);
 }
}
// Detalhes adicionais na mochila, sem alterar o corpo ou as alças aprovadas.
const bagDetails=new THREE.Group();backpack.add(bagDetails);
const stitch=new THREE.MeshLambertMaterial({color:0xaa8d68}),bagShade=new THREE.MeshLambertMaterial({color:0x513d2f}),bagDirt=new THREE.MeshLambertMaterial({color:0x5f5945}),metalDark=new THREE.MeshLambertMaterial({color:0x6b5c49}),metalLight=new THREE.MeshLambertMaterial({color:0xc3b395});
// Costuras discretas nas bordas traseiras, em pontos separados e ligados à superfície.
for(const x of [-2.38,2.38])for(const y of [4.15,4.65,5.15,5.65,6.15,6.65,7.15,7.65,8.15,8.65])armBox(bagDetails,stitch,[.11,.18,.025],[x,y,-4.145]);
for(const x of [-1.9,-1.4,-.9,-.4,.4,.9,1.4,1.9])armBox(bagDetails,stitch,[.19,.10,.025],[x,3.72,-4.145]);
// Bolsos laterais compactos, realmente conectados ao corpo da bolsa.
for(const side of [-1,1]){
 armBox(bagDetails,bagCloth,[.58,2.15,1.22],[side*2.89,5.3,-3.2]);
 armBox(bagDetails,bagFlap,[.62,.38,1.26],[side*2.91,6.55,-3.2]);
 armBox(bagDetails,bagShade,[.065,.34,.58],[side*3.215,5.35,-3.2]);
 armBox(bagDetails,bagMetal,[.035,.30,.30],[side*3.253,5.35,-3.2]);
 for(const z of [-3.65,-3.25,-2.85])armBox(bagDetails,stitch,[.025,.15,.11],[side*3.19,4.52,z]);
}
// Contorno e pino das duas fivelas existentes e do bolso central.
for(const x of [-1.35,1.35]){armBox(bagDetails,metalDark,[.22,.18,.025],[x,7.82,-4.44]);armBox(bagDetails,metalLight,[.055,.14,.018],[x,7.82,-4.463]);}
armBox(bagDetails,metalDark,[.25,.19,.025],[0,5.35,-4.59]);armBox(bagDetails,metalLight,[.06,.15,.018],[0,5.35,-4.613]);
// Marcas e vincos agrupados, apoiados nas superfícies e sem peças soltas.
for(const [x,y,w,h,mat] of [[-2.0,8.3,.26,.45,bagDirt],[-1.8,8.0,.36,.18,bagDirt],[2.05,7.1,.24,.48,bagShade],[1.9,6.8,.32,.16,bagShade]])armBox(bagDetails,mat,[w,h,.025],[x,y,-4.145]);
for(const [x,y,w,h] of [[-.65,10.28,.48,.12],[.25,9.65,.32,.18],[1.98,10.22,.18,.30]])armBox(bagDetails,bagDirt,[w,h,.025],[x,y,-4.325]);
for(const [x,y,w,h] of [[-1.15,5.8,.30,.16],[1.15,5.5,.25,.22]])armBox(bagDetails,bagDirt,[w,h,.025],[x,y,-4.475]);
// Textura determinística de tecido envelhecido, aplicada às superfícies da bolsa.
const bagCanvas=document.createElement('canvas');bagCanvas.width=64;bagCanvas.height=64;const bc=bagCanvas.getContext('2d');bc.fillStyle='#f5f5f5';bc.fillRect(0,0,64,64);let bseed=932761;
for(let i=0;i<85;i++){bseed=(Math.imul(bseed,1664525)+1013904223)>>>0;const x=((bseed>>>8)%16)*4;bseed=(Math.imul(bseed,1664525)+1013904223)>>>0;const y=((bseed>>>8)%16)*4;const v=210+((bseed>>>16)%38);bc.fillStyle=`rgb(${v},${v},${v})`;bc.fillRect(x,y,4+((bseed>>>20)%2)*4,4)}
const bagTexture=new THREE.CanvasTexture(bagCanvas);bagTexture.colorSpace=THREE.SRGBColorSpace;bagTexture.magFilter=THREE.NearestFilter;bagTexture.minFilter=THREE.NearestFilter;
// Pontos de ancoragem penetram no corpo da mochila e nas pontas das faixas.
const anchors=new THREE.Group();backpack.add(anchors);
for(const side of [-1,1]){
 armBox(anchors,bagDark,[.75,.58,.25],[side*2.42,10.48,-2.36]);
 armBox(anchors,bagDark,[.75,.58,.25],[side*2.42,4.52,-2.36]);
}
backpack.visible=true;upperStraps.visible=false;lowerStraps.visible=false;curvedStraps.visible=true;bagDetails.visible=true;anchors.visible=true;bagCloth.color.setHex(0x70553c);bagFlap.color.setHex(0x806047);for(const mat of [bagCloth,bagFlap]){mat.map=bagTexture;mat.needsUpdate=true}

// Recria somente para a prévia a cabeça aprovada, sem modificar o jogador.
function createApprovedHead(){const unit=u,i=1;const palette={skin:0x9eaaa5,nose:0x87988f,eyes:0x9ca99a,eyeWhite:0xd2d9c8,hair:0x5a6254,belt:0x514e49};const model=createPlayerModel(THREE,palette,{outfit:false});
const hair=model.head.getObjectByName('player-hair');const colors=hair.geometry.getAttribute('color');for(let k=0;k<colors.count;k++){const t=colors.getX(k)/.09;colors.setXYZ(k,.19*t,.22*t,.17*t)}colors.needsUpdate=true;
const eyes=model.head.children.filter(n=>n.name==='pupil');const whites=model.head.children.filter(n=>n.name==='eye-white');const mouth=model.head.getObjectByName('mouth');eyes.forEach(o=>{o.scale.set(.54,.42,1);o.position.y-=.12*unit});mouth.scale.set(.8,1.65,1)
const material=new THREE.MeshLambertMaterial({color:0x7e9185});function mark(x,y,w,h){const m=new THREE.Mesh(new THREE.BoxGeometry(w*unit,h*unit,.035*unit),material);m.position.set(x*unit,y*unit,4.055*unit);model.head.add(m)}mark(-3.15,3,.48,.8);mark(-2.8,2.65,.38,.38);mark(2.9,6.05,.48,.4);mark(2.9,2.95,.4,.55);const shade=new THREE.MeshLambertMaterial({color:0x89998c});for(const x of [-2,2]){const m=new THREE.Mesh(new THREE.BoxGeometry(1.55*unit,.25*unit,.035*unit),shade);m.position.set(x*unit,2.95*unit,4.06*unit);model.head.add(m)}
{
 const cells=new Map();
 {
 const add=(x,y,z)=>cells.set(`${x},${y},${z}`,{x,y,z});
 // Cabelo próprio: camada baixa e falhas grandes que revelam a pele.
 for(let x=-4;x<=3;x++)for(let z=-4;z<=3;z++)if(!(x>=0&&z>=0)&&!(x===0&&z>=3)&&!(x<=-2&&z<=-2))add(x,8,z);
 for(let x=-4;x<=3;x++)for(let y=4;y<=7;y++)if(!(x>=2&&y>=6))add(x,y,-5);
 for(let y=5;y<=7;y++)for(let z=-4;z<=0;z++)if(!(y===5&&z===0))add(-5,y,z);
 for(let y=5;y<=6;y++)for(let z=-4;z<=-2;z++)add(4,y,z);
 for(const [x,y] of [[-4,7],[-3,7],[-2,7],[-3,6],[-1,7],[0,7],[0,6]])if(!(i===1&&x>=0))add(x,y,4);
 }
 const data=hairSurface(cells),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));const col=geo.getAttribute('color');for(let k=0;k<col.count;k++){const t=col.getX(k)/.09;col.setXYZ(k,.19*t,.22*t,.17*t)}geo.computeBoundingSphere();hair.geometry=geo;
 const rot=new THREE.MeshLambertMaterial({color:0x708477}),mid=new THREE.MeshLambertMaterial({color:0x869587});
 function patch(pos,size,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(...size.map(n=>n*unit)),mat);m.position.set(...pos.map(n=>n*unit));model.head.add(m)}
 if(i===0){patch([2.45,7.2,4.035],[1.3,.48,.025],mid);patch([3.05,6.8,4.035],[.65,.4,.025],rot);}patch([4.025,6.5,2.1],[.025,.8,1.1],mid);patch([4.025,6,2.55],[.025,.4,.45],rot);
 {
 const brain=new THREE.MeshLambertMaterial({color:0xb98983}),lightBrain=new THREE.MeshLambertMaterial({color:0xcba29a}),groove=new THREE.MeshLambertMaterial({color:0x8b6563});
 // Retira o topo original e reconstrói a pele em torno da abertura.
 const face=model.head.getObjectByName('face'),base=face.geometry,idx=base.index.array;
 const top=base.groups[2],front=base.groups[4];const kept=[];for(let n=0;n<idx.length;n++)if((n<top.start||n>=top.start+top.count)&&(i===0||n<front.start||n>=front.start+front.count))kept.push(idx[n]);
 const carved=base.clone();carved.clearGroups();carved.setIndex(kept);face.geometry=carved;
 for(let x=-4;x<4;x++)for(let z=-4;z<4;z++){if(x>=0&&z>=0)continue;patch([x+.5,8.005,z+.5],[1,.01,1],face.material)}
 if(i===1)for(let x=-4;x<4;x++)for(let y=0;y<8;y++){if(x>=0&&y>=6)continue;patch([x+.5,y+.5,4.005],[1,1,.01],face.material)}
 const rim=new THREE.MeshLambertMaterial({color:0x778a79}),cavity=new THREE.MeshLambertMaterial({color:0x534b48});
 patch([2,7.91,2],[4,.06,4],cavity);
 // Bordas irregulares de pele, conectadas ao topo restante.
 patch([.15,7.99,2],[.3,.16,3.9],rim);patch([2,7.99,.15],[3.9,.16,.3],rim);
 {
 // Base anterior de tecido exposto, comum às duas versões.
 // Um único trecho de tecido preenche a abertura e continua sob as bordas.
 // Nenhum contorno externo completo ou divisão simétrica de hemisférios.
 const tissue=new THREE.MeshLambertMaterial({color:0xb68680}),dark=new THREE.MeshLambertMaterial({color:0x916b68}),pink=new THREE.MeshLambertMaterial({color:0xc79a92});
 const rows=['PPPPPPPP','PPPPPPPP','PPPPPPPP','PPPPPPPP','PPPPPPPP','PPPPPPPP','PPPPPPPP','PPPPPPPP'];const step=.46;
 for(let z=0;z<8;z++)for(let x=0;x<8;x++){
  const xx=.16+(x+.5)*step,zz=.16+(z+.5)*step;
  // Sulcos sinuosos, fragmentados e conectados entre si.
  const fold=(z===1&&x>=2&&x<=5)||(z===2&&(x===2||x===5))||(z===3&&(x===2||x===5||x===6))||(z===4&&(x===1||x===2||x===6))||(z===5&&(x===1||x===4||x===5||x===6))||(z===6&&x>=3&&x<=4);
  const height=fold?.13:.26;patch([xx,7.96+height/2,zz],[step+.002,height,step+.002],fold?dark:tissue);
 }
 // Relevos curtos continuam até a margem e parecem pregas de uma superfície maior.
 for(const [x,z,w,d] of [[.55,.78,.65,.12],[1.9,.55,.95,.12],[3.2,1.3,.12,.72],[.64,2.55,.13,.68],[2.15,2.8,.8,.12],[3.5,3.45,.42,.12]])patch([x,8.235,z],[w,.025,d],pink);
 if(i===1){
  // A abertura desce pela testa: superfície segmentada com sulcos e alturas variadas.
  const rim2=new THREE.MeshLambertMaterial({color:0x788a7b});
  patch([.12,6.98,4.025],[.24,1.98,.16],rim2);patch([1.95,6.05,4.025],[3.9,.14,.16],rim2);
  const step=.46;
  for(let y=0;y<4;y++)for(let x=0;x<8;x++){
   const px=.16+(x+.5)*step,py=6.12+(y+.5)*step;
   const trench=(x===2&&y<=2)||(x===5&&y>=1)||(y===1&&x>=5)||(y===2&&x>=1&&x<=2);
   const depth=trench?.09:.22;
   patch([px,py,3.94+depth/2],[step+.002,step+.002,depth],trench?dark:tissue);
  }
  // Relevos sobre a superfície frontal e topo, conectados ao tecido.
  for(const [x,y,w,h] of [[.7,7.0,.12,.6],[1.65,7.55,.55,.12],[2.7,7.1,.12,.58],[3.3,6.5,.5,.12]])patch([x,y,4.175],[w,h,.025],pink);
  for(const [x,z,w,d] of [[.85,1.1,.25,.8],[1.7,1.8,.65,.18],[2.9,2.1,.24,.75],[3.1,3.25,.6,.18]])patch([x,8.24,z],[w,.055,d],pink);
 }

 }

 }
}
return model;}
const approvedHead=createApprovedHead();model.root.add(approvedHead.head);
// Nova textura autoral de pele: tons discretos em blocos agrupados, sem modificar
// o modelo do jogador nem cobrir o cérebro ou a ferida do braço.
const skinCanvas2=document.createElement('canvas');skinCanvas2.width=64;skinCanvas2.height=64;const sc=skinCanvas2.getContext('2d');sc.fillStyle='#f3f3f0';sc.fillRect(0,0,64,64);let sr=71923;const tones=['#d6e0d2','#cad8c7','#e1e3da','#bbcbbd','#d5d2c9','#c9c9bb'];
for(let k=0;k<50;k++){sr=(Math.imul(sr,1664525)+1013904223)>>>0;const x=((sr>>>8)%16)*4;sr=(Math.imul(sr,1664525)+1013904223)>>>0;const y=((sr>>>8)%16)*4;sc.fillStyle=tones[(sr>>>16)%tones.length];sc.fillRect(x,y,4+4*((sr>>>20)%2),4+4*((sr>>>22)%2))}
const skinTexture2=new THREE.CanvasTexture(skinCanvas2);skinTexture2.colorSpace=THREE.SRGBColorSpace;skinTexture2.magFilter=THREE.NearestFilter;skinTexture2.minFilter=THREE.NearestFilter;
const faceDetail=new THREE.Group();approvedHead.head.add(faceDetail);
const greenRot=new THREE.MeshLambertMaterial({color:0x728678}),deepRot=new THREE.MeshLambertMaterial({color:0x5f7167}),bruise=new THREE.MeshLambertMaterial({color:0x837c79}),scar=new THREE.MeshLambertMaterial({color:0x765c57}),bloodDried=new THREE.MeshLambertMaterial({color:0x783a37});
// Marcas pixeladas agrupadas na pele, evitando olhos, nariz e a abertura do cérebro.
for(const [x,y,w,h,mat] of [[-3.05,4.4,.50,.48,greenRot],[-3.32,3.95,.34,.38,deepRot],[-2.9,3.54,.34,.25,bruise],[3.05,4.75,.52,.30,greenRot],[3.30,4.35,.28,.38,bruise],[2.95,3.35,.30,.45,scar],[-2.65,1.75,.6,.28,bruise],[-3.05,1.55,.30,.24,greenRot]])armBox(faceDetail,mat,[w,h,.025],[x,y,4.09]);
for(const side of [-1,1])for(const [y,z,h,d,mat] of [[3.1,2.5,.6,.55,greenRot],[2.65,2.05,.3,.4,deepRot],[1.5,-1.0,.45,.55,bruise],[4.3,-2.1,.30,.65,greenRot]])armBox(faceDetail,mat,[.025,h,d],[side*4.04,y,z]);
armBox(faceDetail,bloodDried,[.22,.3,.025],[3.05,3.15,4.11]);
// Áreas expostas dos braços, fora da cavidade do osso e das mangas.
const armSkinDetails=[];
for(const [idx,arm] of [model.leftArm,model.rightArm].entries()){
 const d=new THREE.Group();arm.add(d);armSkinDetails.push(d);
 for(const [x,y,w,h,mat] of (idx===0?[[-1.35,-10.65,.42,.45,greenRot],[1.35,-10.45,.35,.55,bruise],[-1.3,-11.4,.3,.25,deepRot]]:[[-1.25,-8.4,.38,.55,greenRot],[1.30,-10.2,.40,.45,bruise],[.15,-11.2,.42,.30,greenRot]]))armBox(d,mat,[w,h,.022],[x,y,2.045]);
 for(const side of [-1,1])for(const [y,z,h,w,mat] of [[-8.3,.75,.5,.45,greenRot],[-9.4,-.8,.45,.5,bruise],[-10.8,.4,.35,.3,deepRot]])armBox(d,mat,[.025,h,w],[side*2.025,y,z]);
 if(idx===1){armBox(d,scar,[.45,.20,.03],[.15,-9.35,2.055]);armBox(d,bloodDried,[.16,.35,.025],[.2,-9.54,2.075]);}
}
for (const mat of [skinNew, tearSkin, exposed]) { mat.map = skinTexture2; mat.needsUpdate = true; }
// Marcas colocadas sobre as pregas e junto à borda da abertura, sem trocar
// a geometria do cérebro; cada fragmento acompanha o pivô da cabeça.
const brainBlood=new THREE.Group();approvedHead.head.add(brainBlood);
const dried=new THREE.MeshLambertMaterial({color:0x793d3b}),fresh=new THREE.MeshLambertMaterial({color:0x9f3836}),glint=new THREE.MeshLambertMaterial({color:0xb4564c});
// Pontos no topo, ligeiramente acima do tecido visível.
for(const [x,z,w,d,mat] of [[.85,.39,.28,.25,dried],[1.08,.39,.18,.16,fresh],[3.15,3.15,.35,.22,dried],[3.15,2.93,.16,.18,fresh],[.42,2.70,.22,.32,dried]])armBox(brainBlood,mat,[w,.025,d],[x,8.237,z]);
// Marcas na porção exposta da testa; repousam sobre as células mais altas.
for(const [x,y,w,h,mat] of [[.39,7.27,.19,.30,dried],[.85,7.73,.28,.14,fresh],[3.15,6.35,.22,.17,dried],[3.61,7.27,.18,.26,fresh]])armBox(brainBlood,mat,[w,h,.025],[x,y,4.174]);
// Vestígios conectados às bordas da abertura, sem cobrir o olhar.
armBox(brainBlood,dried,[.22,.34,.025],[.15,6.12,4.115]);armBox(brainBlood,fresh,[.12,.25,.025],[.15,5.84,4.09]);
armBox(brainBlood,glint,[.09,.08,.018],[3.61,7.31,4.195]);
brainBlood.visible=true;
backpack.visible=true; curvedStraps.visible=false; fixedStraps.visible=true;

 const container = new THREE.Group(); container.add(model.root);
 function animate(time, walking = true, attention = 0, headTurn = 0, attackTime = -1, chaseTime = time) {
  const phase = time * 3.15, cycle = Math.sin(phase), drag = Math.sin(phase - .28);
  const jerk = walking ? Math.pow(Math.max(0, Math.sin(time * 1.22 - .9)), 18) : 0;
  model.leftLeg.rotation.x = walking ? cycle * .26 : 0;
  model.rightLeg.rotation.x = walking ? -drag * .22 : 0;
  model.leftArm.rotation.x = -.42 + (walking ? cycle * .09 : 0);
  model.rightArm.rotation.x = -.57 - (walking ? drag * .075 : 0);
  model.leftArm.rotation.z = .045; model.rightArm.rotation.z = -.035;
  approvedHead.head.rotation.z = -.055 + (walking ? .018 * Math.sin(phase * .5) + .026 * jerk : 0);
  approvedHead.head.rotation.x = .055 + (walking ? .018 * Math.sin(phase) : 0);
  const a = Math.max(0, Math.min(1, attention));
  if (walking && a > 0) {
   const smooth = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
   const step = (p, duty) => { p = ((p % 1) + 1) % 1; return p < duty ? 1 - 2*smooth(p/duty) : -1 + 2*smooth((p-duty)/(1-duty)); };
   const chasePhase = chaseTime * 4.05, p = chasePhase / (Math.PI * 2);
   model.leftLeg.rotation.x += (.34*step(p,.60) - model.leftLeg.rotation.x)*a;
   model.rightLeg.rotation.x += (.26*step(p+.5,.76) - model.rightLeg.rotation.x)*a;
  }
  model.leftArm.rotation.x += (-.86 - model.leftArm.rotation.x) * a;
  model.rightArm.rotation.x += (-1.02 - model.rightArm.rotation.x) * a;
  if (walking && a > 0) {
   const cp = chaseTime * 4.05, fade = Math.min(1, chaseTime / .55) * a;
   model.leftArm.rotation.x += (.09 * Math.sin(cp - .28) + .025 * Math.sin(chaseTime * 1.27)) * fade;
   model.rightArm.rotation.x += (-.08 * Math.sin(cp - .62) + .022 * Math.sin(chaseTime * 1.63 + .8)) * fade;
   model.leftArm.rotation.z += (.03 + .012 * Math.sin(chaseTime * 1.1)) * fade;
   model.rightArm.rotation.z += (-.025 + .009 * Math.sin(chaseTime * 1.4 + .5)) * fade;
  }
  approvedHead.head.rotation.y = headTurn;
  approvedHead.head.rotation.x += (.015 - approvedHead.head.rotation.x) * a;
  model.root.rotation.x = .075 * a;
  if (attackTime >= 0) {
   const smooth = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
   const mix = (x, y, f) => x + (y-x)*f;
   const wind = smooth(attackTime/.24), reachL = smooth((attackTime-.24)/.16), reachR = smooth((attackTime-.27)/.18), recover = smooth((attackTime-.44)/.46);
   model.leftArm.rotation.x = mix(mix(mix(-.86,-.62,wind),-1.56,reachL),-.86,recover);
   model.rightArm.rotation.x = mix(mix(mix(-1.02,-.78,wind),-1.39,reachR),-1.02,recover);
   model.root.rotation.x = mix(mix(.075,.19,reachL),.075,recover);
  }
  const cp = chaseTime * 4.05, balanceFade = Math.min(1, chaseTime / .8) * a;
  const normalSway = walking ? .018 * Math.sin(phase * .5) : 0;
  const chaseSway = walking ? .029 * Math.sin(cp * .5) + .007 * Math.sin(cp * .5 + .8) : 0;
  model.root.rotation.z = normalSway * (1 - balanceFade) + chaseSway * balanceFade;
  const normalBob = walking ? .004 * (1 - Math.cos(phase * 2)) : 0;
  const chaseBob = walking ? .004 * (1 - Math.cos(cp * 2)) + .0015 * (1 - Math.cos(cp)) : 0;
  model.root.position.y = normalBob * (1 - balanceFade) + chaseBob * balanceFade;
  if (walking && attackTime < 0) model.root.rotation.x += .008 * Math.sin(cp + .4) * balanceFade;
 }
 const materials = new Set();
 container.traverse(object => {
  if (!object.isMesh) return;
  for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
   if (mat && mat.emissive) materials.add(mat);
  }
 });
 const originalEmissive = new Map([...materials].map(mat => [mat, mat.emissive.clone()]));
 const hurtColor = new THREE.Color(0x5b1010);
 function setHurt(hurt) { for (const mat of materials) mat.emissive.copy(hurt ? hurtColor : originalEmissive.get(mat)); }
 // Queda provisória segue a mesma curva dos outros mobs; o pivô do corpo
 // continua dentro do grupo de posição e a mochila acompanha o tronco.
 function animateDeath(pose) {
  model.root.rotation.set(0, 0, pose.roll);
  model.root.position.set(0, .30 * Math.sin(Math.abs(pose.roll)) * pose.scale, 0);
  model.root.scale.setScalar(pose.scale);
 }
 function dispose() {
  const geometries = new Set(), allMaterials = new Set(), textures = new Set();
  container.traverse(object => {
   if (object.geometry) geometries.add(object.geometry);
   for (const mat of (Array.isArray(object.material) ? object.material : [object.material])) if (mat) allMaterials.add(mat);
  });
  for (const mat of allMaterials) { if (mat.map) textures.add(mat.map); mat.dispose(); }
  for (const texture of textures) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
 }
 animate(0, false);
 return { root: container, animate, animateDeath, setHurt, dispose };
}
