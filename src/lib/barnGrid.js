// Shared barn-grid helpers.
//
// One home for everything that reads or reshapes a barn's rows × columns grid, so
// the Grounds Manager editor, the Assign Stalls board and the printed chart all
// agree on numbering, labels and geometry.
//
// The golden rule for every reshape below: an existing box keeps its id, its
// bookingId and its painted type. Boxes only appear or disappear at the row /
// column the organizer explicitly touched. Nothing else moves.

import { v4 as uuidv4 } from 'uuid';
import { sequenceFrom } from '@/lib/numberSequence';

// ── Numbering ──

// Stall-number prefix from a barn name: "Barn A" → "A", "West Barn" → "W".
export const stallPrefix = (name) => {
    const m = (name || '').match(/^barn\s+(\w)/i);
    if (m) return m[1].toUpperCase();
    return (name || 'S').charAt(0).toUpperCase();
};

// How a barn names its stalls.
//   continuous → W1, W2, W3 … counted straight through the barn (the original scheme)
//   row        → B1, B2, B3 … the row label joined to the column label, so the stall
//                name matches what's printed on the chart and stays put when the
//                grid is reshaped.
//   custom     → the organizer types each stall's number (1001, 1002… or whatever the
//                facility already uses). The typed number lives on the stall itself
//                (`customNumber`), so it follows that stall through every reshape. A
//                stall with nothing typed yet falls back to its continuous name.
export const NUMBERING_CONTINUOUS = 'continuous';
export const NUMBERING_ROW = 'row';
export const NUMBERING_CUSTOM = 'custom';
export const numberingMode = (barn) => barn?.numberingMode || NUMBERING_CONTINUOUS;

const isPhysical = (s) => {
    const t = s?.type || 'stall';
    return t === 'stall' || t === 'blocked';
};

// Number the physical boxes (stall + blocked) continuously — A1, A2, A3… —
// skipping rooms/aisles/empty so stall numbers have no gaps.
const numberContinuous = (arr, prefix) => {
    let n = 0;
    return arr.map(s => {
        if (!isPhysical(s)) return { ...s, number: '' };
        n += 1;
        return { ...s, number: `${prefix}${n}` };
    });
};

// Name each box after its own row and column label — "B" + "3" → "B3". A row or
// column the organizer left unlabeled falls back to the barn prefix / its 1-based
// index, so a box always has a name.
const numberByRowCol = (arr, barn, cols) => {
    const c = Math.max(1, cols);
    const prefix = stallPrefix(barn?.name);
    const { rowLabels: defRows, colLabels: defCols } = computeGridLabels(arr, c);

    return arr.map((s, i) => {
        if (!isPhysical(s)) return { ...s, number: '' };
        const r = Math.floor(i / c);
        const col = i % c;
        const rowName = labelValue(barn?.rowLabels, defRows, r) || prefix;
        const colName = labelValue(barn?.colLabels, defCols, col) || String(col + 1);
        return { ...s, number: `${rowName}${colName}` };
    });
};

// Typed number wins; otherwise the continuous name, so a stall added later (new row,
// painted back to a stall) is never left unnamed.
const numberCustom = (arr, prefix) => {
    let n = 0;
    return arr.map(s => {
        if (!isPhysical(s)) return { ...s, number: '' };
        n += 1;
        const typed = String(s.customNumber ?? '').trim();
        return { ...s, number: typed || `${prefix}${n}` };
    });
};

// `cols` is passed explicitly because a reshape numbers the NEW matrix while the
// barn still carries its old layoutCols.
export const renumberStalls = (arr, barn, cols) => {
    const barnObj = typeof barn === 'string' ? { name: barn } : (barn || {});
    if (numberingMode(barnObj) === NUMBERING_ROW) {
        return numberByRowCol(arr, barnObj, cols ?? gridCols(barnObj));
    }
    if (numberingMode(barnObj) === NUMBERING_CUSTOM) {
        return numberCustom(arr, stallPrefix(barnObj.name));
    }
    return numberContinuous(arr, stallPrefix(barnObj.name));
};

// ── Custom numbering helpers ──

// Switching TO custom starts from the numbers the barn already shows, so nothing
// jumps; the organizer then edits only the ones that differ. Never overwrites a
// number typed earlier.
export const seedCustomNumbers = (stalls = []) =>
    stalls.map(s => (isPhysical(s) && (s.customNumber == null || s.customNumber === '') && s.number)
        ? { ...s, customNumber: s.number }
        : s);

// Type one stall's number. Empty text clears it (falls back to the continuous name).
// Returns the barn patch, or null if the stall isn't found.
export const setCustomNumber = (barn, stallId, value) => {
    const stalls = barn.stalls || [];
    if (!stalls.some(s => s.id === stallId)) return null;
    const typed = String(value ?? '').trim();
    const next = stalls.map(s => {
        if (s.id !== stallId) return s;
        const { customNumber, ...rest } = s;
        return typed ? { ...rest, customNumber: typed } : rest;
    });
    return { stalls: renumberStalls(next, { ...barn, numberingMode: NUMBERING_CUSTOM }, gridCols(barn)) };
};

// "1001" → 1001, 1002, 1003…   "A101" → A101, A102…   "007" → 007, 008…
// Runs in grid order (left→right, top→bottom) over stalls and blocked boxes.
// Returns the barn patch, or null if the start has no number at the end.
// direction 'rtl' runs each row right→left instead (rows still go top→bottom).
export const FILL_LTR = 'ltr';
export const FILL_RTL = 'rtl';
export const FILL_ZIGZAG = 'zigzag';
export const fillCustomSequence = (barn, start, direction = FILL_LTR) => {
    const labelAt = sequenceFrom(start);
    if (!labelAt) return null;
    const stalls = barn.stalls || [];
    const cols = Math.max(1, gridCols(barn));
    // Visit order: grid order, or each row reversed for right→left.
    const order = stalls.map((_, i) => i);
    if (direction === FILL_RTL || direction === FILL_ZIGZAG) {
        order.sort((a, b) => {
            const rowA = Math.floor(a / cols);
            const rowDiff = rowA - Math.floor(b / cols);
            if (rowDiff !== 0) return rowDiff;
            // Zigzag: row 1 runs left→right, row 2 right→left, and so on.
            const reversed = direction === FILL_RTL || rowA % 2 === 1;
            return reversed ? (b % cols) - (a % cols) : (a % cols) - (b % cols);
        });
    }
    const labels = new Map();
    let k = 0;
    order.forEach(i => { if (isPhysical(stalls[i])) labels.set(i, labelAt(k++)); });
    const next = stalls.map((s, i) => (labels.has(i) ? { ...s, customNumber: labels.get(i) } : s));
    return { stalls: renumberStalls(next, { ...barn, numberingMode: NUMBERING_CUSTOM }, gridCols(barn)) };
};

// Forget every typed number; stalls fall back to the continuous names.
export const clearCustomNumbers = (barn) => {
    const next = (barn.stalls || []).map(({ customNumber, ...rest }) => rest);
    return { stalls: renumberStalls(next, barn, gridCols(barn)) };
};

// Numbers used by more than one stall (ignoring case) — two stalls with the same
// name would be indistinguishable on the chart, so the editor warns about them.
export const duplicateStallNumbers = (stalls = []) => {
    const seen = new Map();
    for (const s of stalls) {
        if (!isPhysical(s) || !s.number) continue;
        const key = String(s.number).toLowerCase();
        seen.set(key, (seen.get(key) || 0) + 1);
    }
    return new Set([...seen].filter(([, count]) => count > 1).map(([key]) => key));
};

// ── Geometry ──

export const gridCols = (barn) =>
    Math.max(1, barn.layoutCols ?? (barn.stallCount ? Math.min(barn.stallCount, 10) : 10));

// Rows are derived from the boxes that actually exist — the stored layoutRows is
// only a fallback for a barn that has no boxes yet.
export const gridRows = (barn) => {
    const n = (barn.stalls || []).length;
    if (n) return Math.ceil(n / gridCols(barn));
    return Math.max(1, barn.layoutRows ?? 1);
};

const isStall = (u) => u && (u.type || 'stall') === 'stall';
// A colour-coded or labelled Empty box is a drawn area (Arena, Restroom…), not a walkway,
// so a row made only of them must not collapse into a thin aisle strip.
export const isWalkway = (u) => {
    const t = (u?.type || 'stall');
    if (t === 'aisle') return true;
    if (t !== 'empty') return false;
    return !u.color && !String(u.label ?? '').trim();
};

// Plain-language summary of the grid, for the "10 stall rows · 3 aisle rows" line.
export const describeGrid = (stalls = [], cols = 1) => {
    const c = Math.max(1, cols);
    const rows = Math.ceil(stalls.length / c);
    let stallRows = 0, aisleRows = 0;
    for (let r = 0; r < rows; r++) {
        const row = stalls.slice(r * c, r * c + c);
        if (row.some(isStall)) stallRows++;
        else if (row.length && row.every(isWalkway)) aisleRows++;
    }
    return {
        rows,
        cols: c,
        stallRows,
        aisleRows,
        stalls: stalls.filter(isStall).length,
        boxes: stalls.length,
    };
};

// ── Labels ──

// Spreadsheet-style defaults: rows → A, B, … Z, AA…; columns → 1, 2, 3…
export const defaultRowLabel = (i) => {
    let n = i, s = '';
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
};

// Smart defaults: letter only the ROWS that hold stalls and number only the
// COLUMNS that hold stalls, the way a paper barn chart letters each aisle.
// Aisle-only rows/columns get a blank default (still editable).
export const computeGridLabels = (units, cols) => {
    const c = Math.max(1, cols);
    const rowCount = Math.ceil(units.length / c);
    let rc = 0;
    const rowLabels = Array.from({ length: rowCount }, (_, r) =>
        units.slice(r * c, r * c + c).some(isStall) ? defaultRowLabel(rc++) : '');
    let cc = 0;
    const colLabels = Array.from({ length: c }, (_, col) => {
        for (let r = 0; r < rowCount; r++) if (isStall(units[r * c + col])) return String(++cc);
        return '';
    });
    return { rowLabels, colLabels };
};

// A custom label (if the user typed one) wins; otherwise the smart default.
export const labelValue = (custom, defaults, i) =>
    (custom && custom[i] != null && custom[i] !== '') ? custom[i] : (defaults[i] ?? '');

// ── Colour-coded Empty boxes (Robert 11-09) ──
// An Empty box can be given a colour and a word ("Arena", "Restroom", "Vet Clinic") so
// the organizer can draw the buildings and lots around the barn without special box
// types. It is only a picture: an Empty box never holds a stall, never gets a number and
// never changes any count. The colour and label live on the box as `color` / `label`.
export const EMPTY_COLORS = [
    { id: 'gray', name: 'Light gray', hex: '#e5e7eb', ink: '#374151' },
    { id: 'green', name: 'Light green', hex: '#bbf7d0', ink: '#14532d' },
    { id: 'blue', name: 'Light blue', hex: '#bfdbfe', ink: '#1e3a8a' },
    { id: 'yellow', name: 'Light yellow', hex: '#fef08a', ink: '#713f12' },
    { id: 'orange', name: 'Light orange', hex: '#fed7aa', ink: '#7c2d12' },
    { id: 'red', name: 'Light red', hex: '#fecaca', ink: '#7f1d1d' },
    { id: 'purple', name: 'Light purple', hex: '#e9d5ff', ink: '#581c87' },
    { id: 'pink', name: 'Light pink', hex: '#fbcfe8', ink: '#831843' },
    { id: 'teal', name: 'Light teal', hex: '#99f6e4', ink: '#134e4a' },
    { id: 'brown', name: 'Tan', hex: '#e7d3b7', ink: '#44331a' },
    { id: 'white', name: 'White', hex: '#ffffff', ink: '#374151' },
    { id: 'darkgray', name: 'Dark gray', hex: '#6b7280', ink: '#ffffff' },
    { id: 'black', name: 'Black', hex: '#111827', ink: '#ffffff' },
];
const EMPTY_COLOR_MAP = Object.fromEntries(EMPTY_COLORS.map(c => [c.id, c]));

// Boxes from the old Office / Feed / Wash / Tack types keep working: they draw as a
// coloured, labelled box exactly like a painted Empty box.
const LEGACY_ROOMS = {
    office: { label: 'Office', color: 'yellow' },
    feed: { label: 'Feed', color: 'green' },
    wash: { label: 'Wash', color: 'blue' },
    tack: { label: 'Tack', color: 'purple' },
};

// How a non-stall box should look: { fill, ink, label } or null for a plain box
// (stall, aisle, blocked, or an Empty box with no colour). One answer for the editor,
// the Assign board, the public chart and the printed chart.
export const cellAppearance = (cell) => {
    const type = cell?.type || 'stall';
    if (type === 'empty') {
        const c = EMPTY_COLOR_MAP[cell?.color];
        const label = String(cell?.label ?? '').trim();
        if (!c && !label) return null;
        return { fill: c?.hex || null, ink: c?.ink || null, label };
    }
    const room = LEGACY_ROOMS[type];
    if (room) {
        const c = EMPTY_COLOR_MAP[room.color];
        return { fill: c.hex, ink: c.ink, label: room.label };
    }
    return null;
};

// Paint box `id` as Empty with a colour (null = plain empty). Its label is kept. A
// booked stall is left alone. Returns a NEW stalls[].
export const paintEmptyCell = (stalls, id, color) =>
    stalls.map(s => {
        if (s.id !== id) return s;
        const { color: _c, customNumber: _n, ...rest } = s;
        return { ...rest, type: 'empty', bookingId: null, ...(color ? { color } : {}) };
    });

// Set or clear the word on an Empty box. Only Empty boxes carry a label.
export const setCellLabel = (stalls, id, text) => {
    const label = String(text ?? '').trim().slice(0, 40);
    return stalls.map(s => {
        if (s.id !== id || (s.type || 'stall') !== 'empty') return s;
        const { label: _l, ...rest } = s;
        return label ? { ...rest, label } : rest;
    });
};

// When a box stops being Empty it forgets its colour and label.
export const clearEmptyLook = (cell) => {
    const { color: _c, label: _l, ...rest } = cell;
    return rest;
};

// ── Reshaping ──

// A new box next to an Empty box inherits its colour (not its label), so adding a row or
// column beside a coloured area keeps the area looking like one block.
const newCell = (type = 'stall', color = null) => ({
    id: uuidv4(), bookingId: null, type,
    ...(type === 'empty' && color ? { color } : {}),
});

// Flat box array → array of rows, padding a ragged final row so every row is `cols` wide.
const toMatrix = (stalls, cols) => {
    const m = [];
    for (let i = 0; i < stalls.length; i += cols) m.push(stalls.slice(i, i + cols));
    if (m.length) {
        const last = m[m.length - 1];
        while (last.length < cols) last.push(newCell(last[last.length - 1]?.type || 'stall', last[last.length - 1]?.color));
    }
    return m;
};

// Aisle gap indices live BETWEEN rows/columns (1 … n-1). Shift them so the
// walkways the organizer drew stay against the same boxes after a reshape.
const shiftGaps = (gaps = [], at, delta, limit) => {
    const moved = gaps
        .map(i => (delta > 0 ? (i >= at ? i + delta : i) : (i > at ? i + delta : i)))
        .filter(i => i >= 1 && i < limit);
    return [...new Set(moved)].sort((a, b) => a - b);
};

// Sparse label arrays follow their row/column.
const spliceLabels = (labels = [], at, deleteCount, insertCount) => {
    const arr = [...labels];
    if (deleteCount) arr.splice(at, deleteCount);
    if (insertCount) arr.splice(at, 0, ...Array(insertCount).fill(''));
    return arr;
};

// Build the barn patch from a finished matrix.
const finish = (barn, matrix, cols, extra = {}) => {
    const flat = matrix.flat();
    // Number against the barn as it will be AFTER this reshape — `extra` carries the
    // spliced row/column labels, and row-mode names are built from them.
    const nextBarn = { ...barn, ...extra, layoutCols: cols };
    const stalls = renumberStalls(flat, nextBarn, cols);
    return {
        layoutRows: matrix.length,
        layoutCols: cols,
        stalls,
        stallCount: stalls.filter(isStall).length,
        ...extra,
    };
};

// Insert a blank row AT index `at` (0 = very top, rows = very bottom). The new row
// copies the types of the row above it (or below, at the top edge) so inserting
// under an aisle row extends the aisle, and under a stall row adds stalls.
export const insertRowAt = (barn, at) => {
    const cols = gridCols(barn);
    const m = toMatrix(barn.stalls || [], cols);
    const srcIdx = Math.min(Math.max(at - 1, 0), Math.max(m.length - 1, 0));
    const src = m[srcIdx] || [];
    const row = Array.from({ length: cols }, (_, i) => newCell(src[i]?.type || 'stall', src[i]?.color));
    m.splice(Math.min(at, m.length), 0, row);
    return finish(barn, m, cols, {
        rowLabels: spliceLabels(barn.rowLabels, at, 0, 1),
        aisleRows: shiftGaps(barn.aisleRows, at, 1, m.length),
    });
};

// Remove row `at` entirely. Refuses to empty the barn.
export const deleteRowAt = (barn, at) => {
    const cols = gridCols(barn);
    const m = toMatrix(barn.stalls || [], cols);
    if (m.length <= 1 || at < 0 || at >= m.length) return null;
    m.splice(at, 1);
    return finish(barn, m, cols, {
        rowLabels: spliceLabels(barn.rowLabels, at, 1, 0),
        aisleRows: shiftGaps(barn.aisleRows, at, -1, m.length),
    });
};

// Insert a blank column AT index `at` (0 = far left, cols = far right). Each new
// box copies the type of its left neighbour (or right neighbour at the left edge),
// so an aisle row stays an aisle row instead of gaining a stray stall.
export const insertColAt = (barn, at) => {
    const cols = gridCols(barn);
    const m = toMatrix(barn.stalls || [], cols).map(row => {
        const src = row[at - 1] || row[at] || row[row.length - 1];
        const next = [...row];
        next.splice(Math.min(at, next.length), 0, newCell(src?.type || 'stall', src?.color));
        return next;
    });
    const nextCols = cols + 1;
    return finish(barn, m, nextCols, {
        colLabels: spliceLabels(barn.colLabels, at, 0, 1),
        aisleCols: shiftGaps(barn.aisleCols, at, 1, nextCols),
    });
};

// Remove column `at` from every row. Refuses to empty the barn.
export const deleteColAt = (barn, at) => {
    const cols = gridCols(barn);
    if (cols <= 1 || at < 0 || at >= cols) return null;
    const m = toMatrix(barn.stalls || [], cols).map(row => {
        const next = [...row];
        next.splice(at, 1);
        return next;
    });
    const nextCols = cols - 1;
    return finish(barn, m, nextCols, {
        colLabels: spliceLabels(barn.colLabels, at, 1, 0),
        aisleCols: shiftGaps(barn.aisleCols, at, -1, nextCols),
    });
};

// Set the grid to an exact rows × columns (the number inputs). Every box keeps its
// (row, column) coordinate, so painted types and bookings never scramble; boxes are
// only added at the bottom / right edge, and trimmed from the bottom / right edge.
// New edge boxes inherit their nearest existing neighbour's type.
export const resizeGrid = (barn, nextRows, nextCols) => {
    const r = Math.max(1, parseInt(nextRows, 10) || 0);
    const c = Math.max(1, parseInt(nextCols, 10) || 0);
    const existing = barn.stalls || [];
    const oldCols = gridCols(barn);
    const oldRows = gridRows(barn);
    const built = [];
    for (let row = 0; row < r; row++) {
        const line = [];
        for (let col = 0; col < c; col++) {
            const prev = (row < oldRows && col < oldCols) ? existing[row * oldCols + col] : null;
            let type = 'stall';
            let color = null;
            if (prev) {
                type = prev.type || 'stall';
            } else if (existing.length && oldRows > 0 && oldCols > 0) {
                const srcRow = Math.min(row, oldRows - 1);
                const srcCol = Math.min(col, oldCols - 1);
                const src = existing[srcRow * oldCols + srcCol];
                type = src?.type || 'stall';
                color = src?.color || null;
            }
            line.push(prev
                ? {
                    id: prev.id, bookingId: prev.bookingId || null, type,
                    // A typed stall number belongs to the stall, not its position.
                    ...(prev.customNumber ? { customNumber: prev.customNumber } : {}),
                    // An Empty box keeps its colour and label through a resize.
                    ...(prev.color ? { color: prev.color } : {}),
                    ...(prev.label ? { label: prev.label } : {}),
                }
                : newCell(type, color));
        }
        built.push(line);
    }
    return finish(barn, built, c, {
        rowLabels: (barn.rowLabels || []).slice(0, r),
        colLabels: (barn.colLabels || []).slice(0, c),
        aisleRows: (barn.aisleRows || []).filter(i => i >= 1 && i < r),
        aisleCols: (barn.aisleCols || []).filter(i => i >= 1 && i < c),
    });
};

// Do any boxes in this row / column carry a booking? The editor warns before a
// delete that would drop an assigned stall.
export const bookedInRow = (barn, at) => {
    const cols = gridCols(barn);
    return (barn.stalls || []).slice(at * cols, at * cols + cols).filter(s => s.bookingId).length;
};
export const bookedInCol = (barn, at) => {
    const cols = gridCols(barn);
    return (barn.stalls || []).filter((s, i) => i % cols === at && s.bookingId).length;
};
