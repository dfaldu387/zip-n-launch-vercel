// Saving stall / RV-spot assignments without overwriting a second staff tab.
//
// The Assign board used to send the whole barns (or rvAreas) array on every
// click, so the last tab to save replaced everything the other tab had done —
// and two people could end up holding the same stall. These helpers let the
// page send only what THIS tab changed ("stall 12: nobody -> Smith") and apply
// it on top of the newest saved copy, refusing if someone else got there first.
//
// Works for both shapes: barns -> stalls, and rvAreas -> spots (`unitsKey`).
// All functions are non-mutating.

const holder = (unit) => unit?.bookingId || null;

// Everything about a unit / group except who holds it. If this differs between
// the before and after copies, the change is structural (rename, add, delete)
// and is not safe to replay as a per-unit patch.
const withoutAssignment = (unit) => {
    const { bookingId, assignedAt, ...rest } = unit || {};
    return rest;
};
const withoutUnits = (group, unitsKey) => {
    const { [unitsKey]: units, ...rest } = group || {};
    return rest;
};

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Compare the tab's copy before and after a click.
//   assignmentOnly: true  -> only stall/spot holders changed; `changes` lists them.
//   assignmentOnly: false -> something structural changed; caller saves the whole array.
export function diffUnitAssignments(prevGroups, nextGroups, unitsKey) {
    const prev = prevGroups || [];
    const next = nextGroups || [];
    if (prev.length !== next.length) return { assignmentOnly: false, changes: [] };

    const changes = [];
    for (let i = 0; i < prev.length; i++) {
        const a = prev[i];
        const b = next[i];
        if (!sameJson(withoutUnits(a, unitsKey), withoutUnits(b, unitsKey))) {
            return { assignmentOnly: false, changes: [] };
        }
        const aUnits = a[unitsKey] || [];
        const bUnits = b[unitsKey] || [];
        if (aUnits.length !== bUnits.length) return { assignmentOnly: false, changes: [] };

        for (let j = 0; j < aUnits.length; j++) {
            const u = aUnits[j];
            const v = bUnits[j];
            if (!sameJson(withoutAssignment(u), withoutAssignment(v))) {
                return { assignmentOnly: false, changes: [] };
            }
            if (holder(u) !== holder(v)) {
                changes.push({
                    id: v.id,
                    from: holder(u),
                    to: holder(v),
                    hasAssignedAt: 'assignedAt' in v,
                    assignedAt: v.assignedAt ?? null,
                });
            }
        }
    }
    return { assignmentOnly: true, changes };
}

// Replay a tab's changes on top of the newest saved copy.
// All-or-nothing: if any single stall/spot no longer matches what this tab
// thought it was (someone else assigned or cleared it, or it was deleted),
// nothing is applied and the conflicts are returned.
export function applyUnitChanges(latestGroups, changes, unitsKey) {
    const latest = latestGroups || [];
    const byId = new Map();
    for (const group of latest) {
        for (const unit of group[unitsKey] || []) byId.set(unit.id, unit);
    }

    const conflicts = [];
    const toApply = new Map();
    for (const change of changes || []) {
        const current = byId.get(change.id);
        if (!current) {
            conflicts.push({ id: change.id, reason: 'missing' });
            continue;
        }
        const now = holder(current);
        if (now === change.to) continue;                 // already in the wanted state
        if (now !== change.from) {
            conflicts.push({ id: change.id, reason: 'changed', current: now });
            continue;
        }
        toApply.set(change.id, change);
    }
    if (conflicts.length) return { groups: latest, conflicts };

    const groups = latest.map(group => ({
        ...group,
        [unitsKey]: (group[unitsKey] || []).map(unit => {
            const change = toApply.get(unit.id);
            if (!change) return unit;
            const next = { ...unit, bookingId: change.to };
            if (change.hasAssignedAt) next.assignedAt = change.assignedAt;
            return next;
        }),
    }));
    return { groups, conflicts: [] };
}

// Keep THIS tab's own layout (including edits it has not saved yet, like a
// renamed barn) but take who-holds-what from the merged saved copy, so the
// screen shows what the other tab did too.
export function overlayAssignments(localGroups, mergedGroups, unitsKey) {
    const held = new Map();
    for (const group of mergedGroups || []) {
        for (const unit of group[unitsKey] || []) held.set(unit.id, unit);
    }
    return (localGroups || []).map(group => ({
        ...group,
        [unitsKey]: (group[unitsKey] || []).map(unit => {
            const saved = held.get(unit.id);
            if (!saved) return unit;
            const next = { ...unit, bookingId: saved.bookingId ?? null };
            if ('assignedAt' in saved || 'assignedAt' in unit) next.assignedAt = saved.assignedAt ?? null;
            return next;
        }),
    }));
}
