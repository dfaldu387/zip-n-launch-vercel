import { supabase } from '@/lib/supabaseClient';
import { gridCols, gridRows, numberingMode, renumberStalls, NUMBERING_CONTINUOUS } from '@/lib/barnGrid';

export const LAYOUT_VERSION = 1;
const CELL_TYPES = new Set(['stall', 'aisle', 'empty', 'blocked', 'office', 'feed', 'wash', 'tack']);
const MAX_CELLS = 3000;
const MAX_COLS = 100;

// Same "trim + lower-case" the database uses for its facility_key / barn_key /
// label_key columns, so a client-side lookup finds the same row.
export const layoutKey = (s) => String(s ?? '').trim().toLowerCase();

// Only the SHAPE of a barn, ready to share: no ids, bookings, prices or dates.
export function extractBarnLayout(barn) {
    const stalls = barn?.stalls || [];
    return {
        version: LAYOUT_VERSION,
        layoutRows: gridRows(barn),
        layoutCols: gridCols(barn),
        numberingMode: numberingMode(barn),
        rowLabels: (barn?.rowLabels || []).map(v => v ?? ''),
        colLabels: (barn?.colLabels || []).map(v => v ?? ''),
        aisleRows: [...(barn?.aisleRows || [])],
        aisleCols: [...(barn?.aisleCols || [])],
        showAisles: !!barn?.showAisles,
        centerAisle: !!barn?.centerAisle,
        cells: stalls.map(s => ({
            type: s.type || 'stall',
            ...(s.customNumber ? { customNumber: String(s.customNumber) } : {}),
        })),
    };
}

export const countLayoutStalls = (layout) =>
    (layout?.cells || []).filter(c => (c.type || 'stall') === 'stall').length;

// Save (or replace your earlier copy of) a layout under Facility + Barn + optional
// label. Resolves { id, updated } where `updated` is true when it replaced one.
export async function saveBarnLayout({ facility, barnName, showLabel, layout, userId, userName }) {
    const facilityName = String(facility ?? '').trim();
    const barn = String(barnName ?? '').trim();
    const label = String(showLabel ?? '').trim();
    if (!facilityName) throw new Error('Facility name is required');
    if (!barn) throw new Error('Barn name is required');
    if (!userId) throw new Error('You need to be signed in');

    const fields = {
        facility_name: facilityName,
        barn_name: barn,
        show_label: label || null,
        layout,
        stall_count: countLayoutStalls(layout),
        created_by_name: userName || null,
        updated_at: new Date().toISOString(),
    };

    const { data: existing, error: findError } = await supabase
        .from('barn_layouts')
        .select('id')
        .eq('created_by', userId)
        .eq('facility_key', layoutKey(facilityName))
        .eq('barn_key', layoutKey(barn))
        .eq('label_key', layoutKey(label))
        .maybeSingle();
    if (findError) throw findError;

    if (existing) {
        const { error } = await supabase.from('barn_layouts').update(fields).eq('id', existing.id);
        if (error) throw error;
        return { id: existing.id, updated: true };
    }
    const { data, error } = await supabase
        .from('barn_layouts')
        .insert([{ ...fields, created_by: userId }])
        .select('id')
        .single();
    if (error) throw error;
    return { id: data.id, updated: false };
}

// ── Loading a saved layout ──

// A saved layout comes from a shared table, so check its shape before trusting it.
export function isValidLayout(layout) {
    if (!layout || typeof layout !== 'object') return false;
    const { cells, layoutCols } = layout;
    if (!Array.isArray(cells) || cells.length < 1 || cells.length > MAX_CELLS) return false;
    if (!Number.isInteger(layoutCols) || layoutCols < 1 || layoutCols > MAX_COLS) return false;
    return cells.every(c => c && typeof c === 'object');
}

// A barn that already has exhibitors on its stalls must not be replaced — the
// new boxes would have new ids and those assignments would be lost.
export const barnHasAssignments = (barn) => (barn?.stalls || []).some(s => s.bookingId);

// The barn patch that gives `barn` the saved layout. Keeps everything about the barn
// itself (name, prices, dates, fees); replaces only its shape. Every box gets a fresh
// id and no booking. Returns null when the layout is not usable.
export function applyBarnLayout(barn, layout, makeId) {
    if (!isValidLayout(layout)) return null;
    const cols = layout.layoutCols;
    const mode = layout.numberingMode || NUMBERING_CONTINUOUS;
    const rowLabels = Array.isArray(layout.rowLabels) ? layout.rowLabels.map(v => String(v ?? '')) : [];
    const colLabels = Array.isArray(layout.colLabels) ? layout.colLabels.map(v => String(v ?? '')) : [];
    const cells = layout.cells.map(c => ({
        id: makeId(),
        bookingId: null,
        type: CELL_TYPES.has(c.type) ? c.type : 'stall',
        ...(c.customNumber ? { customNumber: String(c.customNumber) } : {}),
    }));
    const nextBarn = { ...barn, layoutCols: cols, numberingMode: mode, rowLabels, colLabels };
    const stalls = renumberStalls(cells, nextBarn, cols);
    return {
        layoutRows: Math.ceil(cells.length / cols),
        layoutCols: cols,
        numberingMode: mode,
        rowLabels,
        colLabels,
        aisleRows: Array.isArray(layout.aisleRows) ? layout.aisleRows.filter(Number.isInteger) : [],
        aisleCols: Array.isArray(layout.aisleCols) ? layout.aisleCols.filter(Number.isInteger) : [],
        showAisles: !!layout.showAisles,
        centerAisle: !!layout.centerAisle,
        stalls,
        stallCount: stalls.filter(s => (s.type || 'stall') === 'stall').length,
    };
}

// ── Searching ──

// "larimer west quarter" → ['larimer', 'west', 'quarter']. Characters that mean
// something in a PostgREST filter are dropped so a search can't break the query.
export const searchWords = (query) =>
    String(query ?? '')
        .replace(/[%,()*\\"'`]/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(Boolean)
        .slice(0, 6);

// Every word must appear in the facility, the barn or the show label (any of the
// three), so "larimer west" finds Larimer County Fairgrounds · West Barn.
export async function searchBarnLayouts({ query = '', limit = 30 } = {}) {
    let q = supabase
        .from('barn_layouts')
        .select('id, created_by, created_by_name, facility_name, barn_name, show_label, layout, stall_count, updated_at')
        .order('updated_at', { ascending: false })
        .limit(limit);
    for (const word of searchWords(query)) {
        q = q.or(`facility_name.ilike.%${word}%,barn_name.ilike.%${word}%,show_label.ilike.%${word}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

// Only the owner can delete (the database enforces it too).
export async function deleteBarnLayout(id) {
    const { error } = await supabase.from('barn_layouts').delete().eq('id', id);
    if (error) throw error;
}
