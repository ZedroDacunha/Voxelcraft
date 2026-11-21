// Textura de tecido em escala consistente para cada face das peças da prévia.
// Paleta autoral em manchas agrupadas, escala pixelada e filtragem sem borrão.
export function pixelFabric(THREE, rgb) {
    const pixels=new Uint8Array(16*16*4);
    const patches=[
        [0,0,1,1,2,1,0,0,0,-1,-1,0,0,1,1,0],
        [0,1,1,2,2,1,0,0,-1,-1,-1,0,1,1,1,0],
        [0,1,1,1,1,0,0,-1,-1,0,0,0,0,1,0,0],
        [0,0,0,0,0,0,-1,-1,-1,0,0,1,1,1,0,-1],
        [1,1,0,-1,-1,-1,-1,0,0,0,1,1,1,0,-1,-1],
        [1,1,0,-1,-1,-1,0,0,0,1,1,1,0,0,-1,-1],
        [0,0,0,0,-1,0,0,1,1,1,0,0,0,0,0,0],
        [0,0,1,1,0,0,1,1,1,0,0,-1,-1,0,0,0],
    ];
    for(let y=0;y<16;y++) for(let x=0;x<16;x++) {
        const n=patches[y%8][x], fine=((x*11+y*17+x*y*3)%13===0?2:0);
        const d=n*4+fine;
        const i=(y*16+x)*4; pixels[i]=Math.max(0,Math.min(255,rgb[0]+d)); pixels[i+1]=Math.max(0,Math.min(255,rgb[1]+d)); pixels[i+2]=Math.max(0,Math.min(255,rgb[2]+d)); pixels[i+3]=255;
    }
    const map=new THREE.DataTexture(pixels,16,16);map.needsUpdate=true;map.flipY=true;map.colorSpace=THREE.SRGBColorSpace;
    map.magFilter=map.minFilter=THREE.NearestFilter;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=false;
    return new THREE.MeshLambertMaterial({map});
}
export function greenFabric(THREE, color=0x536b47) { return pixelFabric(THREE,[(color >> 16) & 255,(color >> 8) & 255,color & 255]); }
// Projeta cada face em coordenadas locais, com pixels de meio bloco do modelo.
export function fabricBox(THREE,size,unit) {
    const geometry=new THREE.BoxGeometry(...size.map(v=>v*unit));
    const p=geometry.attributes.position, n=geometry.attributes.normal, uv=geometry.attributes.uv;
    for(let i=0;i<p.count;i++) {
        let a,b;
        if(Math.abs(n.getX(i))>.5){a=p.getZ(i);b=p.getY(i)}
        else if(Math.abs(n.getY(i))>.5){a=p.getX(i);b=p.getZ(i)}
        else {a=p.getX(i);b=p.getY(i)}
        uv.setXY(i,a/(8*unit),b/(8*unit));
    }
    uv.needsUpdate=true; return geometry;
}
