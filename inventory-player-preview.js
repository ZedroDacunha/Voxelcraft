import { createPlayerModel } from './player-model.js';

/** Renderiza uma vez no contexto do jogo, sem criar um segundo WebGLRenderer. */
export function renderInventoryPlayer({ THREE, renderer, canvas }) {
    const width = 144, height = 192;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível para o personagem');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x243026);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6c6c60, 2));
    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(3, 5, 4);
    scene.add(light);
    const model = createPlayerModel(THREE);
    scene.add(model.root);
    model.root.rotation.y = -0.22;
    const camera = new THREE.OrthographicCamera(-0.78, 0.78, 1.04, -1.04, 0.1, 10);
    camera.position.set(0, 1.15, 5);
    camera.lookAt(0, 0.9, 0);
    const target = new THREE.WebGLRenderTarget(width, height);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const previous = renderer.getRenderTarget();
    try {
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, camera);
        const pixels = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
        canvas.width = width;
        canvas.height = height;
        const image = context.createImageData(width, height);
        // WebGL lê de baixo para cima; canvas escreve de cima para baixo.
        for (let y = 0; y < height; y++) {
            const start = (height - 1 - y) * width * 4;
            image.data.set(pixels.subarray(start, start + width * 4), y * width * 4);
        }
        context.putImageData(image, 0, 0);
    } finally {
        renderer.setRenderTarget(previous);
        target.dispose();
        model.dispose();
    }
}
