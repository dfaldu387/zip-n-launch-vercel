import { describe, it, expect } from 'vitest';
import { loadViews, saveView, deleteView, toCsv } from './calendarViews';

const fakeStorage = () => {
    const data = {};
    return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
};

describe('saved views', () => {
    it('saves, lists and deletes a view', () => {
        const s = fakeStorage();
        saveView('show1', 'ops', 'Barn 1-3', { barnIds: ['a'] }, s);
        expect(loadViews('show1', 'ops', s)).toHaveLength(1);
        const id = loadViews('show1', 'ops', s)[0].id;
        deleteView('show1', 'ops', id, s);
        expect(loadViews('show1', 'ops', s)).toHaveLength(0);
    });
    it('the same name replaces the old view', () => {
        const s = fakeStorage();
        saveView('show1', 'ops', 'Mine', { x: 1 }, s);
        saveView('show1', 'ops', 'mine', { x: 2 }, s);
        const list = loadViews('show1', 'ops', s);
        expect(list).toHaveLength(1);
        expect(list[0].state.x).toBe(2);
    });
    it('keeps shows and calendars apart', () => {
        const s = fakeStorage();
        saveView('show1', 'ops', 'A', {}, s);
        expect(loadViews('show2', 'ops', s)).toHaveLength(0);
        expect(loadViews('show1', 'fin', s)).toHaveLength(0);
    });
    it('ignores an empty name and survives broken storage', () => {
        const s = fakeStorage();
        expect(saveView('show1', 'ops', '   ', {}, s)).toEqual([]);
        const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
        expect(loadViews('show1', 'ops', broken)).toEqual([]);
    });
});

describe('toCsv', () => {
    it('quotes commas, quotes and line breaks', () => {
        expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['line\nbreak', 3]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",3');
    });
});
