// Count overlapping fetch/apply operations so one completion cannot stop another's indicator.
const activity = new WeakMap();

export function isBackgroundRefreshing(system) {
    return (activity.get(system)?.count || 0) > 0;
}

function emit(system, active) {
    window.dispatchEvent(new CustomEvent('background:refreshing', { detail: { system, active } }));
}

export function beginBackgroundRefresh(system) {
    let state = activity.get(system);
    if (!state) {
        state = { count: 0 };
        activity.set(system, state);
    }
    if (++state.count === 1) emit(system, true);
    let finished = false;
    return () => {
        if (finished || activity.get(system) !== state) return;
        finished = true;
        if (--state.count === 0) emit(system, false);
    };
}

export function clearBackgroundRefresh(system) {
    const active = isBackgroundRefreshing(system);
    activity.delete(system);
    if (active) emit(system, false);
}
