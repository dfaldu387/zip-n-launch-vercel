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
export const NUMBERING_CONTINUOUS = 'continuous';
export const NUMBERING_ROW = 'row';
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

// `cols` is passed explicitly because a reshape numbers the NEW matrix while the
// barn still carries its old layoutCols.
export const renumberStalls = (arr, barn, cols) => {
    const barnObj = typeof barn === 'string' ? { name: barn } : (barn || {});
    if (numberingMode(barnObj) === NUMBERING_ROW) {
        return numberByRowCol(arr, barnObj, cols ?? gridCols(barnObj));
    }
    return numberContinuous(arr, stallPrefix(barnObj.name));
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
const isWalkway = (u) => { const t = (u?.type || 'stall'); return t === 'aisle' || t === 'empty'; };

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

// ── Reshaping ──

const newCell = (type = 'stall') => ({ id: uuidv4(), bookingId: null, type });

// Flat box array → array of rows, padding a ragged final row so every row is `cols` wide.
const toMatrix = (stalls, cols) => {
    const m = [];
    for (let i = 0; i < stalls.length; i += cols) m.push(stalls.slice(i, i + cols));
    if (m.length) {
        const last = m[m.length - 1];
        while (last.length < cols) last.push(newCell(last[last.length - 1]?.type || 'stall'));
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
    const row = Array.from({ length: cols }, (_, i) => newCell(src[i]?.type || 'stall'));
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
        next.splice(Math.min(at, next.length), 0, newCell(src?.type || 'stall'));
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
            if (prev) {
                type = prev.type || 'stall';
            } else if (existing.length && oldRows > 0 && oldCols > 0) {
                const srcRow = Math.min(row, oldRows - 1);
                const srcCol = Math.min(col, oldCols - 1);
                type = existing[srcRow * oldCols + srcCol]?.type || 'stall';
            }
            line.push(prev ? { id: prev.id, bookingId: prev.bookingId || null, type } : newCell(type));
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
