import { BLOCKS, ITEMS, TILE_PX } from './world-catalog.js';

export function createInventoryAssets(THREE) {
    const blockColors = {};

    function initialize(atlas) {
        let iconCss = '';
        for (const [id, item] of Object.entries(ITEMS)) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = TILE_PX;
            canvas.getContext('2d').drawImage(
                atlas, item.iconTile * TILE_PX, 0, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX,
            );
            iconCss += `.ico-${id}{background-image:url('${canvas.toDataURL()}')}\n`;
        }
        const style = document.createElement('style');
        style.textContent = iconCss;
        document.head.appendChild(style);

        const context = atlas.getContext('2d');
        for (const [id, block] of Object.entries(BLOCKS)) {
            const pixels = context.getImageData(block.tiles.side * TILE_PX, 0, TILE_PX, TILE_PX).data;
            let red = 0, green = 0, blue = 0, count = 0;
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] < 128) continue;
                red += pixels[i];
                green += pixels[i + 1];
                blue += pixels[i + 2];
                count++;
            }
            blockColors[id] = new THREE.Color().setRGB(
                red / count / 255,
                green / count / 255,
                blue / count / 255,
                THREE.SRGBColorSpace,
            );
        }
    }

    return { blockColors, initialize };
}
