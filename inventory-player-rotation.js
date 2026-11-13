// Redesenha apenas ao interagir, coalescendo movimentos num único quadro.
export function createInventoryPlayerRotation({ canvas, render, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }) {
    let angle = -0.22, pointer = null, lastX = 0, frame = null, enabled = false;
    const queue = () => {
        if (frame !== null) return;
        frame = requestFrame(() => { frame = null; if (enabled) render(angle); });
    };
    const cancel = () => {
        const id = pointer;
        pointer = null;
        if (id !== null && canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
        if (frame !== null) cancelFrame(frame);
        frame = null;
    };
    canvas.addEventListener('pointerdown', event => {
        if (!enabled || pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
        pointer = event.pointerId; lastX = event.clientX;
        canvas.setPointerCapture?.(pointer);
        event.preventDefault();
        canvas.focus?.({ preventScroll: true });
    });
    canvas.addEventListener('pointermove', event => {
        if (event.pointerId !== pointer) return;
        angle = (angle + (event.clientX - lastX) * 0.02) % (Math.PI * 2);
        lastX = event.clientX;
        queue();
    });
    const finish = event => { if (event.pointerId === pointer) pointer = null; };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('lostpointercapture', finish);
    canvas.addEventListener('keydown', event => {
        if (!enabled || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        angle = (angle + (event.key === 'ArrowRight' ? 1 : -1) * Math.PI / 12) % (Math.PI * 2);
        queue();
    });
    return {
        open() { cancel(); angle = -0.22; enabled = true; render(angle); },
        close() { enabled = false; cancel(); },
        cancel,
    };
}
