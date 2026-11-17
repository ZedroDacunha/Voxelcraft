// Recria as cores anteriores apenas para comparação na prévia.
export function hairBeforeColors(geometry) {
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    const result = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i += 6) {
        let cx=0, cy=0, cz=0;
        for (let j=0; j<6; j++) { cx+=positions.getX(i+j); cy+=positions.getY(i+j); cz+=positions.getZ(i+j); }
        const x=Math.floor(cx/6 - normals.getX(i)*.01), y=Math.floor(cy/6 - normals.getY(i)*.01), z=Math.floor(cz/6 - normals.getZ(i)*.01);
        const seed = ((x*17 + y*31 + z*13) % 7 + 7) % 7;
        const shade = [0.77, 0.82, 0.88, 0.93, 0.97, 1.02, 1.06][seed];
        for(let j=0;j<6;j++){const off=(i+j)*3;result[off]=.09*shade;result[off+1]=.045*shade;result[off+2]=.025*shade;}
    }
    return result;
}
