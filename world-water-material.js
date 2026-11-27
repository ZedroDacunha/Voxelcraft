// A malha de água usa UV.x para espessura (blocos) e UV.y para luz do céu.
// A posição mundial mantém as cristas contínuas entre blocos e chunks.
export function createWaterSurfaceMaterial(THREE) {
    const uniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
    Object.assign(uniforms, {
        waterTime: { value: 0 },
        horizonColor: { value: new THREE.Color(0xadcbd7) },
        lightDirection: { value: new THREE.Vector3(0, 1, 0) },
        lightColor: { value: new THREE.Color(0xffffff) },
        daylight: { value: 1 },
    });
    return new THREE.ShaderMaterial({
        name: 'WaterSurface', uniforms, vertexColors: true, fog: true,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        forceSinglePass: true,
        vertexShader: `
            #include <fog_pars_vertex>
            attribute float torchInfluence;
            varying vec3 waterPosition, faceDirection, voxelLight;
            varying vec3 waterData;
            void main() {
                waterPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                faceDirection = normal;
                voxelLight = color;
                waterData = vec3(uv, torchInfluence);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }`,
        fragmentShader: `
            #include <common>
            #include <fog_pars_fragment>
            uniform float waterTime, daylight;
            uniform vec3 horizonColor, lightDirection, lightColor;
            varying vec3 waterPosition, faceDirection, voxelLight;
            varying vec3 waterData;
            void main() {
                vec3 eye = cameraPosition - waterPosition;
                float distanceToEye = length(eye);
                vec3 viewDir = eye / max(0.001, distanceToEye);
                float detail = 1.0 - smoothstep(7.0, 32.0, distanceToEye);
                float relief = 1.0 - smoothstep(28.0, 84.0, distanceToEye);
                vec2 p = waterPosition.xz;
                vec2 grain = mix(p, (floor(p * 32.0) + 0.5) / 32.0, detail * 0.60);
                float swell = sin(dot(p, vec2(2.4, 1.2)) - waterTime * 0.90);
                float crossWave = sin(dot(p, vec2(-1.3, 3.4)) + waterTime * 1.10 + swell * 0.75);
                float ripple = sin(dot(grain, vec2(5.3, -7.4)) + waterTime * 1.60 + 1.8 * crossWave);
                vec2 slope = relief * vec2(0.105 * swell + 0.055 * crossWave, 0.10 * crossWave - 0.045 * swell);
                slope += detail * ripple * vec2(0.052, -0.068);
                bool wall = abs(faceDirection.y) < 0.5;
                // Uma fase constante desta onda se desloca para baixo em Y.
                float stream = sin(waterPosition.y * 6.0 + waterTime * 2.40 + 0.8 * swell);
                vec3 n = normalize(faceDirection + (wall
                    ? vec3(0.0, 0.13 * stream * relief, 0.0) : vec3(slope.x, 0.0, slope.y)));
                if (!gl_FrontFacing) n = -n;
                float depth = smoothstep(0.2, 4.8, waterData.x);
                float sky = clamp(waterData.y, 0.0, 1.0);
                vec3 tint = mix(vec3(0.045, 0.32, 0.26), vec3(0.012, 0.13, 0.21), depth);
                float light = 0.20 + 0.80 * max(daylight, waterData.z);
                vec3 water = tint * voxelLight * light;
                water *= 1.0 + relief * (0.10 * crossWave + 0.055 * swell) + detail * 0.045 * ripple;
                float current = wall ? 1.0 : clamp(length(faceDirection.xz) * 2.0, 0.0, 1.0);
                water *= 1.0 + 0.18 * current * stream * relief;
                float grazing = 1.0 - clamp(dot(n, viewDir), 0.0, 1.0);
                float fresnel = grazing * grazing * grazing;
                float exposure = gl_FrontFacing && faceDirection.y >= 0.0 ? sky * sky : 0.0;
                water = mix(water, horizonColor, exposure * (0.045 + 0.55 * fresnel));
                vec3 halfRay = lightDirection + viewDir;
                vec3 halfway = halfRay * inversesqrt(max(dot(halfRay, halfRay), 0.0001));
                float glint = pow(max(0.0, dot(n, halfway)), mix(64.0, 150.0, detail));
                water += lightColor * exposure * glint * 0.86;
                float alpha = mix(0.36, 0.78, depth) + 0.17 * fresnel;
                gl_FragColor = vec4(water, alpha);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
                #include <fog_fragment>
            }`,
    });
}
