export function configureTorchFlicker(material) {
    material.onBeforeCompile = shader => {
        shader.uniforms.uTorchTime = { value: 0 };
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            '#include <common>\nuniform float uTorchTime;\nattribute float torchInfluence;\nattribute float furnaceFlame;\nvarying float vTorchInfluence;\nvarying float vFurnaceFlame;'
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <color_vertex>',
            '#include <color_vertex>\nvTorchInfluence = torchInfluence;\nvFurnaceFlame = furnaceFlame;'
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            '#include <common>\nuniform float uTorchTime;\nvarying float vTorchInfluence;\nvarying float vFurnaceFlame;'
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            '#include <color_fragment>\nfloat torchFlicker = 1.0 + vTorchInfluence * (0.035 * sin(uTorchTime * 8.7) + 0.02 * sin(uTorchTime * 13.1 + 1.2));\ndiffuseColor.rgb *= torchFlicker;\nfloat fireMask = smoothstep(0.16, 0.48, diffuseColor.r - diffuseColor.b);\nfloat firePulse = 0.91 + 0.13 * sin(uTorchTime * 10.0 + vMapUv.y * 47.0 + vMapUv.x * 11.0);\ndiffuseColor.rgb *= 1.0 + vFurnaceFlame * fireMask * (firePulse - 1.0);'
        );
        material.userData.torchFlickerShader = shader;
    };
    material.customProgramCacheKey = () => 'voxel-torch-flicker-v3-map-uv';
}

export function configureTorchFlameAnimation(material) {
    material.onBeforeCompile = shader => {
        shader.uniforms.uFlameTime = { value: 0 };
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            '#include <common>\nuniform float uFlameTime;\nattribute float flamePhase;'
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nfloat flameTip = uv.y * uv.y;\ntransformed.x += flameTip * (0.018 * sin(uFlameTime * 7.0 + flamePhase + position.x * 9.0 + position.z * 6.0));\ntransformed.z += flameTip * (0.012 * sin(uFlameTime * 5.3 + flamePhase * 1.37 + position.x * 5.0 + position.z * 8.0));'
        );
        material.userData.flameAnimationShader = shader;
    };
    material.customProgramCacheKey = () => 'voxel-torch-flame-animation-v1';
}

export function updateWorldLightingEffects(flameMaterial, flickerMaterials, time) {
    const flamePulse = 0.95 + 0.05 * Math.sin(time * 9.4);
    flameMaterial.color.setRGB(flamePulse, flamePulse * 0.96, flamePulse * 0.9);
    const flameShader = flameMaterial.userData.flameAnimationShader;
    if (flameShader) flameShader.uniforms.uFlameTime.value = time;
    for (const material of flickerMaterials) {
        const shader = material.userData.torchFlickerShader;
        if (shader) shader.uniforms.uTorchTime.value = time;
    }
}
