export function createWorldClock({ dayLength, initialTime }) {
    let time = normalizeTime(initialTime);

    function normalizeTime(value) {
        if (!Number.isFinite(value)) return 0;
        return ((value % 1) + 1) % 1;
    }

    function advance(deltaSeconds) {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || !Number.isFinite(dayLength) || dayLength <= 0) return time;
        time = normalizeTime(time + deltaSeconds / dayLength);
        return time;
    }

    function format() {
        const hourValue = (time * 24 + 6) % 24;
        const hours = Math.floor(hourValue);
        const minutes = Math.floor((hourValue - hours) * 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    return {
        advance,
        format,
        get time() { return time; },
        set time(value) { time = normalizeTime(value); },
    };
}
