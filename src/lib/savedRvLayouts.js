import { supabase } from '@/lib/supabaseClient';
import { ensureRvSpots } from '@/lib/rvAssignment';
import { getCampingTypes, CAMPING_TYPE_COLORS } from '@/lib/rvCampingTypes';
import { layoutKey, searchWords } from '@/lib/savedBarnLayouts';

// Saved RV layouts — the RV twin of savedBarnLayouts.js. Only the SHAPE is shared:
// spots per row, roadways, which spots are Empty / Blocked / Roadway, typed numbers,
// and the camping types (with each painted spot pointing at its type). Never
// bookings, prices or dates.

export const RV_LAYOUT_VERSION = 1;
const SPOT_TYPES = new Set(['empty', 'blocked', 'roadway']);
const MAX_CELLS = 2000;

export function extractRvLayout(area) {
    const types = getCampingTypes(area);
    const idx = new Map(types.map((t, i) => [t.id, i]));
    const { spots } = ensureRvSpots(area);
    return {
        version: RV_LAYOUT_VERSION,
        perRow: Math.max(1, Number(area?.layoutPerRow) || 10),
        roadsAfter: [...(area?.layoutRoadsAfter || [])],
        campingTypes: types.map(t => ({
            label: t.label || '', count: Number(t.count) || 0, hookupType: t.hookupType || 'full',
            powerType: t.powerType || '50amp', notes: t.notes || '', color: t.color || CAMPING_TYPE_COLORS[0],
        })),
        cells: spots.map(s => ({
            ...(SPOT_TYPES.has(s.type) ? { type: s.type } : {}),
            ...(s.customNumber ? { customNumber: String(s.customNumber) } : {}),
            ...(idx.has(s.campingTypeId) && !s.type ? { typeIndex: idx.get(s.campingTypeId) } : {}),
            ...(s.amps ? { amps: String(s.amps) } : {}),
        })),
    };
}

export const countLayoutSpots = (layout) => (layout?.cells || []).filter(c => !c.type).length;

export function isValidRvLayout(layout) {
    if (!layout || typeof layout !== 'object') return false;
    const { cells, perRow, campingTypes } = layout;
    if (!Array.isArray(cells) || cells.length < 1 || cells.length > MAX_CELLS) return false;
    if (!Number.isInteger(perRow) || perRow < 1 || perRow > 40) return false;
    return Array.isArray(campingTypes) && campingTypes.length >= 1 && cells.every(c => c && typeof c === 'object');
}

// An area with exhibitors on its spots must not be replaced (spots get new content).
export const rvAreaHasAssignments = (area) => (area?.spots || []).some(s => s.bookingId);

// The patch that gives `area` the saved layout; keeps its name, dates, fees, locks.
export function applyRvLayout(area, layout, makeId) {
    if (!isValidRvLayout(layout)) return null;
    const types = layout.campingTypes.map((t, i) => ({
        id: makeId(i), label: String(t.label || ''), count: Math.max(0, Number(t.count) || 0),
        hookupType: t.hookupType || 'full', powerType: t.powerType || '50amp',
        notes: String(t.notes || ''), color: t.color || CAMPING_TYPE_COLORS[i % CAMPING_TYPE_COLORS.length],
    }));
    // Counts must add up to the spots that can be sold (not Road / Empty / Blocked); fix any drift on the last type.
    const sellable = layout.cells.filter(c => !SPOT_TYPES.has(c.type)).length;
    const drift = sellable - types.reduce((n, t) => n + t.count, 0);
    types[types.length - 1].count = Math.max(0, types[types.length - 1].count + drift);
    const spots = layout.cells.map((c, i) => ({
        id: `${area.id}::spot::${i + 1}`,
        bookingId: null,
        ...(SPOT_TYPES.has(c.type) ? { type: c.type } : {}),
        ...(c.customNumber ? { customNumber: String(c.customNumber) } : {}),
        ...(!c.type && types[c.typeIndex] ? { campingTypeId: types[c.typeIndex].id } : {}),
        ...(c.amps ? { amps: String(c.amps) } : {}),
    }));
    const patch = {
        campingTypes: types,
        spotCount: sellable,
        layoutCells: layout.cells.length,
        hookupType: types[0].hookupType,
        powerType: types[0].powerType,
        notes: types[0].notes,
        layoutPerRow: layout.perRow,
        layoutRoadsAfter: (layout.roadsAfter || []).filter(Number.isInteger),
    };
    return { ...patch, spots: ensureRvSpots({ ...area, ...patch, spots }).spots };
}

export async function saveRvLayout({ facility, areaName, showLabel, layout, userId, userName }) {
    const facilityName = String(facility ?? '').trim();
    const name = String(areaName ?? '').trim();
    const label = String(showLabel ?? '').trim();
    if (!facilityName) throw new Error('Facility name is required');
    if (!name) throw new Error('RV area name is required');
    if (!userId) throw new Error('You need to be signed in');
    const fields = {
        facility_name: facilityName, area_name: name, show_label: label || null, layout,
        spot_count: countLayoutSpots(layout), created_by_name: userName || null,
        updated_at: new Date().toISOString(),
    };
    const { data: existing, error: findError } = await supabase.from('rv_layouts').select('id')
        .eq('created_by', userId).eq('facility_key', layoutKey(facilityName))
        .eq('area_key', layoutKey(name)).eq('label_key', layoutKey(label)).maybeSingle();
    if (findError) throw findError;
    if (existing) {
        const { error } = await supabase.from('rv_layouts').update(fields).eq('id', existing.id);
        if (error) throw error;
        return { id: existing.id, updated: true };
    }
    const { data, error } = await supabase.from('rv_layouts').insert([{ ...fields, created_by: userId }]).select('id').single();
    if (error) throw error;
    return { id: data.id, updated: false };
}

export async function searchRvLayouts({ query = '', limit = 30 } = {}) {
    let q = supabase.from('rv_layouts')
        .select('id, created_by, created_by_name, facility_name, area_name, show_label, layout, spot_count, updated_at')
        .order('updated_at', { ascending: false }).limit(limit);
    for (const word of searchWords(query)) {
        q = q.or(`facility_name.ilike.%${word}%,area_name.ilike.%${word}%,show_label.ilike.%${word}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function deleteRvLayout(id) {
    const { error } = await supabase.from('rv_layouts').delete().eq('id', id);
    if (error) throw error;
}
