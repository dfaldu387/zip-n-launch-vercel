// Saved filter views and CSV export for the Housing calendars (Robert 2026-11-16).
// Views are a per-person convenience, kept in this browser only (no database), one
// list per show and per calendar. Every storage call is wrapped, so a blocked or
// private browser simply shows no saved views instead of breaking the page.

const keyFor = (showId, calendar) => `housing-calendar-views:${showId || 'show'}:${calendar}`;

export function loadViews(showId, calendar, storage = globalThis.localStorage) {
    try {
        const list = JSON.parse(storage.getItem(keyFor(showId, calendar)) || '[]');
        return Array.isArray(list) ? list.filter((v) => v && v.id && v.name && v.state) : [];
    } catch { return []; }
}

function persist(showId, calendar, list, storage) {
    try { storage.setItem(keyFor(showId, calendar), JSON.stringify(list)); return true; } catch { return false; }
}

// Saving a name that already exists replaces that view.
export function saveView(showId, calendar, name, state, storage = globalThis.localStorage) {
    const clean = String(name || '').trim().slice(0, 60);
    if (!clean) return loadViews(showId, calendar, storage);
    const list = loadViews(showId, calendar, storage);
    const i = list.findIndex((v) => v.name.toLowerCase() === clean.toLowerCase());
    const entry = { id: i >= 0 ? list[i].id : `v-${Date.now().toString(36)}`, name: clean, state };
    if (i >= 0) list[i] = entry; else list.push(entry);
    persist(showId, calendar, list, storage);
    return list;
}

export function deleteView(showId, calendar, id, storage = globalThis.localStorage) {
    const list = loadViews(showId, calendar, storage).filter((v) => v.id !== id);
    persist(showId, calendar, list, storage);
    return list;
}

// One CSV cell: quote when it holds a comma, quote or line break.
const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers, rows) {
    return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function downloadCsv(filename, csv) {
    // The leading BOM lets Excel read the file as UTF-8.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
