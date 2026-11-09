// Camping types — one RV area can hold several kinds of site (30 partial/30A,
// 20 full/50A, 25 electric-only/25A …). Each type is a "box": label, count,
// hookup, power, notes. Pure helpers, non-mutating.
//
// Old areas only have spotCount + hookupType + powerType + notes. They are read as
// ONE default type, so nothing changes until someone adds a second type. The area
// keeps spotCount / hookupType / powerType filled from the types (first type wins
// for hookup/power) so fees, reports and booking code that read them keep working.

export const CAMPING_TYPE_COLORS = ['sky', 'orange', 'emerald', 'violet', 'rose', 'amber', 'teal', 'fuchsia'];

export const newCampingType = (areaId, index = 0, overrides = {}) => ({
    id: `${areaId}::type::${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: '',
    count: 10,
    hookupType: 'full',
    powerType: '50amp',
    notes: '',
    color: CAMPING_TYPE_COLORS[index % CAMPING_TYPE_COLORS.length],
    ...overrides,
});

// The area's types. A saved list wins; otherwise one default type is derived from
// the old single fields (stable id, so it survives reloads before it is saved).
export function getCampingTypes(area) {
    if (Array.isArray(area?.campingTypes) && area.campingTypes.length > 0) return area.campingTypes;
    return [{
        id: `${area?.id}::type::default`,
        label: '',
        count: Math.max(0, Number(area?.spotCount) || 0),
        hookupType: area?.hookupType || 'full',
        powerType: area?.powerType || '50amp',
        notes: area?.notes || '',
        color: CAMPING_TYPE_COLORS[0],
    }];
}

export const campingTypeTotal = (types) =>
    (types || []).reduce((sum, t) => sum + Math.max(0, Number(t.count) || 0), 0);

// Fields to write back onto the area after the types change.
export function areaFieldsFromTypes(types) {
    const first = types[0] || {};
    return {
        campingTypes: types,
        spotCount: campingTypeTotal(types),
        hookupType: first.hookupType || 'full',
        powerType: first.powerType || '50amp',
        notes: first.notes || '',
    };
}

export const updateCampingType = (types, typeId, patch) =>
    types.map(t => (t.id === typeId ? { ...t, ...patch } : t));

export const duplicateCampingType = (areaId, types, typeId) => {
    const src = types.find(t => t.id === typeId);
    if (!src) return types;
    const copy = newCampingType(areaId, types.length, {
        ...src,
        id: newCampingType(areaId).id,
        label: src.label ? `${src.label} (copy)` : '',
        color: CAMPING_TYPE_COLORS[types.length % CAMPING_TYPE_COLORS.length],
    });
    const at = types.findIndex(t => t.id === typeId);
    return [...types.slice(0, at + 1), copy, ...types.slice(at + 1)];
};

// Never remove the last type — an area needs at least one.
export const removeCampingType = (types, typeId) =>
    types.length <= 1 ? types : types.filter(t => t.id !== typeId);

// How many grid spots are painted with each type (Task 3 fills spot.campingTypeId).
export function assignedCountByType(spots = []) {
    const out = {};
    for (const s of spots) if (s.campingTypeId && !s.type) out[s.campingTypeId] = (out[s.campingTypeId] || 0) + 1;
    return out;
}

// Paint one grid spot with a camping type (click the same type again to clear it).
// The spot's amps follow the type's power so the stalling board / printed chart,
// which read spot.amps, keep showing 30A / 50A.
const AMPS_BY_POWER = { '30amp': '30', '50amp': '50', '30_50amp': '30/50' };
export function paintCampingType(spots, spotId, type) {
    return spots.map(s => {
        if (s.id !== spotId) return s;
        const { campingTypeId: _c, amps: _a, ...rest } = s;
        if (!type || s.campingTypeId === type.id) return rest;
        const amps = AMPS_BY_POWER[type.powerType];
        return { ...rest, campingTypeId: type.id, ...(amps ? { amps } : {}) };
    });
}

export const campingTypeLabel = (t, index = 0) => (t?.label || '').trim() || `Type ${index + 1}`;

// Quantity booked (live bookings only) against each of these camping types, by type id.
export function bookedQtyByType(types, bookings = []) {
    const ids = new Set((types || []).map(t => t.id));
    const out = {};
    for (const b of bookings || []) {
        if (!b || b.status === 'cancelled') continue;
        for (const it of b.items || []) {
            if (it.type === 'rv' && ids.has(it.refId)) out[it.refId] = (out[it.refId] || 0) + (Number(it.qty) || 0);
        }
    }
    return out;
}

// Can this camping type be deleted? Not while a live booking points at it. When the area
// would be left with ONE type it is sold as a plain area again, so a booking for ANY of
// its types would lose its link — those are checked too.
export function campingTypeDeleteBlock(types, typeId, bookings = []) {
    if ((types || []).length <= 1) return { blocked: true, qty: 0, reason: 'An RV area needs at least one camping type.' };
    const booked = bookedQtyByType(types, bookings);
    const becomesSingle = types.length - 1 < 2;
    const checked = becomesSingle ? types : types.filter(t => t.id === typeId);
    const qty = checked.reduce((n, t) => n + (booked[t.id] || 0), 0);
    if (qty === 0) return { blocked: false, qty: 0, reason: '' };
    return {
        blocked: true, qty,
        reason: becomesSingle
            ? `${qty} spot${qty === 1 ? ' is' : 's are'} booked on this area's camping types. With one type left this area is sold as a whole, so cancel or move those bookings first.`
            : `${qty} spot${qty === 1 ? ' is' : 's are'} booked on this camping type. Cancel or move those bookings first.`,
    };
}
