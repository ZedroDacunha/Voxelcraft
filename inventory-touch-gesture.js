// Gestos de inventário independentes do DOM e do relógio, para que rolagem,
// cancelamento e fechamento nunca executem um clique atrasado.
export const INVENTORY_HOLD_MS = 500;
export const INVENTORY_TOUCH_SLOP = 12;

export function createInventoryTouchGesture({ activate, setTimer = setTimeout, clearTimer = clearTimeout, now = () => performance.now() }) {
    let active = null;
    function cancel() {
        if (!active) return;
        clearTimer(active.timer);
        active = null;
    }
    function start({ pointerId, x, y, slot }) {
        if (active || slot == null) return false;
        const gesture = { pointerId, x, y, slot, startedAt: now(), timer: null, moved: false, held: false };
        active = gesture;
        gesture.timer = setTimer(() => {
            if (active !== gesture || gesture.moved) return;
            gesture.held = true;
            activate(gesture.slot, 2);
        }, INVENTORY_HOLD_MS);
        return true;
    }
    function move({ pointerId, x, y }) {
        if (!active || active.pointerId !== pointerId || active.held) return;
        if (Math.hypot(x - active.x, y - active.y) >= INVENTORY_TOUCH_SLOP) {
            active.moved = true;
            clearTimer(active.timer);
        }
    }
    function end({ pointerId, slot }) {
        if (!active || active.pointerId !== pointerId) return;
        const gesture = active;
        clearTimer(gesture.timer);
        active = null;
        if (!gesture.held && !gesture.moved && slot === gesture.slot) {
            activate(gesture.slot, now() - gesture.startedAt >= INVENTORY_HOLD_MS ? 2 : 0);
        }
    }
    function pointerCancel(pointerId) {
        if (active?.pointerId === pointerId) cancel();
    }
    return { start, move, end, pointerCancel, cancel };
}
