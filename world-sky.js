export function createWorldSkySystem({
    THREE,
    clamp01,
    smoothstep,
    mulberry32,
    clouds,
    skyColor,
    skyDistance = 250,
    renderDistance,
    chunkSize,
}) {
    const dayColor = new THREE.Color(skyColor);
    const nightColor = new THREE.Color(0x070b1c);
    const duskColor = new THREE.Color(0xf08a4b);
    const warmLight = new THREE.Color(0xffb070);
    const whiteLight = new THREE.Color(0xffffff);
    const moonLight = new THREE.Color(0x8fa6ff);
    const skyColorScratch = new THREE.Color();
    const sunDirection = new THREE.Vector3();
    const state = { elevation: 1, day: 1 };
    let sunMesh = null;
    let moonMesh = null;
    let starPoints = null;

    function makeSquareMesh(size, color) {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false, side: THREE.DoubleSide }),
        );
        mesh.renderOrder = -1;
        mesh.frustumCulled = false;
        return mesh;
    }

    function create(scene) {
        sunMesh = makeSquareMesh(36, 0xfff2a8);
        moonMesh = makeSquareMesh(26, 0xdfe6f5);
        scene.add(sunMesh, moonMesh);

        const random = mulberry32(4242);
        const positions = new Float32Array(400 * 3);
        for (let i = 0; i < 400; i++) {
            const u = random() * 2 - 1;
            const angle = random() * Math.PI * 2;
            const radius = Math.sqrt(1 - u * u);
            positions[i * 3] = Math.cos(angle) * radius * skyDistance;
            positions[i * 3 + 1] = u * skyDistance;
            positions[i * 3 + 2] = Math.sin(angle) * radius * skyDistance;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starPoints = new THREE.Points(geometry, new THREE.PointsMaterial({
            color: 0xffffff, size: 2, sizeAttenuation: false, fog: false,
            transparent: true, opacity: 0, depthWrite: false,
        }));
        starPoints.frustumCulled = false;
        scene.add(starPoints);
    }

    function update({ scene, camera, hemiLight, sunLight, handAmbient, worldTime }) {
        if (!sunMesh || !moonMesh || !starPoints) return;
        const angle = worldTime * Math.PI * 2;
        sunDirection.set(Math.cos(angle), Math.sin(angle), 0.3).normalize();
        const elevation = sunDirection.y;
        const day = smoothstep(-0.12, 0.28, elevation);
        const warm = clamp01(1 - Math.abs(elevation) / 0.3) * 0.9;
        state.elevation = elevation;
        state.day = day;

        skyColorScratch.copy(nightColor).lerp(dayColor, day)
            .lerp(duskColor, warm * (1 - Math.abs(day - 0.5) * 0.6));
        scene.background.copy(skyColorScratch);
        scene.fog.color.copy(skyColorScratch);
        const viewDistance = renderDistance * chunkSize;
        scene.fog.near = viewDistance * 0.55;
        scene.fog.far = viewDistance * 0.95;

        hemiLight.intensity = 0.22 + 0.58 * day;
        if (elevation >= -0.05) {
            sunLight.position.copy(sunDirection).multiplyScalar(50);
            sunLight.color.copy(whiteLight).lerp(warmLight, warm);
            sunLight.intensity = 0.62 * smoothstep(-0.05, 0.2, elevation);
        } else {
            sunLight.position.set(-sunDirection.x * 50, -sunDirection.y * 50, -sunDirection.z * 50);
            sunLight.color.copy(moonLight);
            sunLight.intensity = 0.14 * smoothstep(-0.05, -0.25, elevation);
        }
        handAmbient.intensity = 0.38 + 0.37 * day;

        const cameraPosition = camera.position;
        sunMesh.position.copy(cameraPosition).addScaledVector(sunDirection, skyDistance);
        sunMesh.lookAt(cameraPosition);
        moonMesh.position.copy(cameraPosition).addScaledVector(sunDirection, -skyDistance);
        moonMesh.lookAt(cameraPosition);
        sunMesh.visible = elevation > -0.2;
        moonMesh.visible = elevation < 0.2;
        starPoints.position.copy(cameraPosition);
        starPoints.rotation.z = angle;
        starPoints.material.opacity = clamp01((0.35 - day) / 0.35) * 0.9;
        starPoints.visible = starPoints.material.opacity > 0.01;
        clouds.updateTint(day, warm);
    }

    return {
        create,
        update,
        get elevation() { return state.elevation; },
        get day() { return state.day; },
    };
}
