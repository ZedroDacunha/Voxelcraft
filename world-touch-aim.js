import { ndcFromPoint } from './world-touch-controls.js';

// Desenha o raio pela câmera visual, mas devolve sempre uma direção a partir
// dos olhos: a validação final de alcance/oclusão continua no raio do mundo.
export function fingerAimDirection({ x, y, rect, viewCamera, eye, raycaster, ndc, direction, third = false, reach, cameraDistance, raycast }) {
    const point = ndcFromPoint(x - rect.left, y - rect.top, rect.width, rect.height);
    ndc.set(point.x, point.y);
    viewCamera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, viewCamera);
    const ray = raycaster.ray;
    if (!third) return direction.copy(ray.direction);
    const maxDistance = reach + cameraDistance;
    const hit = raycast(ray.origin, ray.direction, maxDistance);
    const distance = hit ? hit.dist + 0.01 : maxDistance;
    return direction.copy(ray.direction).multiplyScalar(distance).add(ray.origin).sub(eye).normalize();
}
