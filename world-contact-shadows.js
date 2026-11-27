// Sombras de contato: blobs escuros no chão sob as criaturas terrestres e
// sob o jogador em terceira pessoa.
//
// Não é uma sombra de verdade (sem ray tracing, sem shadow map): é um
// **plano escuro semitransparente** que acompanha a posição no chão. É o
// truque mais barato que existe para dar peso e "chão" a uma entidade —
// um quadrado de luz faltando no chão é suficiente para o olho ler que
// a criatura está apoiada nele, sem pagar um render extra por luz.
//
// O pool é fixo: os blobs nascem com o jogo e só mudam de posição a cada
// quadro. Mudar a quantidade de blobs depois faria o Three remontá-los —
// o mesmo princípio do pool de PointLights das tochas.

/** Levantamento do blob acima do chão: evita z-fighting com a face do bloco. */
export const CONTACT_SHADOW_OFFSET = 0.02;

/**
 * Textura radial do blob: opaca no centro, suave até sumir na borda.
 * Um círculo de canvas (o jogo já faz o mesmo com a chama da tocha); o
 * material fica com `transparent: true` e a própria textura define o
 * formato do blob.
 */
function createShadowTexture(THREE) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const cx = 32, cy = 32, r = 30;
    const gradient = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

/**
 * Cria o pool de blobs. Cada alvo é `{ x, y, z, radius, opacity }`, onde
 * `y` é a altura do **chão** sob a entidade (a sombra fica em `y + offset`,
 * não acompanha o salto — o blob continua no chão enquanto a criatura
 * pula sobre ele). Alvos que não chegarem ao pool são simplesmente
 * ignorados; blobs livres somem.
 */
export function createContactShadowSystem({ THREE, scene, max = 16 }) {
    const texture = createShadowTexture(THREE);
    const geometry = new THREE.PlaneGeometry(1, 1);
    const blobs = [];
    for (let i = 0; i < max; i++) {
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            color: 0x000000,
            opacity: 0,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.visible = false;
        mesh.renderOrder = 0;
        scene.add(mesh);
        blobs.push({ mesh, material });
    }

    function update(targets) {
        const count = Math.min(targets.length, blobs.length);
        for (let i = 0; i < blobs.length; i++) {
            const { mesh, material } = blobs[i];
            if (i < count) {
                const target = targets[i];
                mesh.position.set(target.x, target.y + CONTACT_SHADOW_OFFSET, target.z);
                mesh.scale.setScalar(Math.max(0.05, target.radius) * 2);
                material.opacity = Math.max(0, Math.min(1, target.opacity));
                mesh.visible = material.opacity > 0.001;
            } else {
                mesh.visible = false;
            }
        }
    }

    return { update };
}
