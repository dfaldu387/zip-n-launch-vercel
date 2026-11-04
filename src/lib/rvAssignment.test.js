import { describe, it, expect } from 'vitest';
import {
    ensureRvSpots, setRvCustomNumber, fillRvSequence, clearRvCustomNumbers, duplicateRvNumbers,
    assignRvSpotToBooking,
    setRvSpotType, setRvSpotAmps, copyRvLayout,
} from './rvAssignment';
import { sequenceFrom } from './numberSequence';

const area = (extra = {}) => ({ id: 'a1', name: 'RV Area 1', spotCount: 4, ...extra });
const nums = (spots) => spots.map(s => s.number);

describe('sequenceFrom', () => {
    it('counts up from a number, a prefixed number, and keeps leading zeros', () => {
        expect([0, 1, 2].map(sequenceFrom('1001'))).toEqual(['1001', '1002', '1003']);
        expect([0, 1].map(sequenceFrom('A101'))).toEqual(['A101', 'A102']);
        expect([0, 1, 2].map(sequenceFrom('007'))).toEqual(['007', '008', '009']);
    });
    it('is null without a trailing number', () => {
        expect(sequenceFrom('abc')).toBeNull();
        expect(sequenceFrom('')).toBeNull();
    });
});

describe('ensureRvSpots', () => {
    it('names spots R1, R2… by default with stable ids', () => {
        const { spots } = ensureRvSpots(area());
        expect(nums(spots)).toEqual(['R1', 'R2', 'R3', 'R4']);
        expect(spots[0].id).toBe('a1::spot::1');
    });

    it('keeps bookings when the area is re-materialized', () => {
        let a = ensureRvSpots(area());
        a = { ...a, spots: assignRvSpotToBooking([a], 'a1::spot::2', 'b1')[0].spots };
        expect(ensureRvSpots(a).spots[1].bookingId).toBe('b1');
    });
});

describe('custom RV numbers', () => {
    it('sets one number and keeps the booking and id', () => {
        let a = ensureRvSpots(area());
        a = { ...a, spots: assignRvSpotToBooking([a], 'a1::spot::2', 'b1')[0].spots };
        const spots = setRvCustomNumber(a, 'a1::spot::2', ' 1002 ');
        expect(spots[1]).toMatchObject({ id: 'a1::spot::2', number: '1002', customNumber: '1002', bookingId: 'b1' });
        expect(spots[0].number).toBe('R1');
    });

    it('a typed number survives re-materializing and a spot-count change', () => {
        const spots = setRvCustomNumber(area(), 'a1::spot::1', '1001');
        const grown = ensureRvSpots({ ...area({ spotCount: 6 }), spots });
        expect(nums(grown.spots)).toEqual(['1001', 'R2', 'R3', 'R4', 'R5', 'R6']);
        const shrunk = ensureRvSpots({ ...area({ spotCount: 2 }), spots });
        expect(nums(shrunk.spots)).toEqual(['1001', 'R2']);
    });

    it('clearing one number goes back to its R name', () => {
        const typed = setRvCustomNumber(area(), 'a1::spot::3', '1003');
        const cleared = setRvCustomNumber({ ...area(), spots: typed }, 'a1::spot::3', '');
        expect(cleared[2].number).toBe('R3');
        expect(cleared[2].customNumber).toBeUndefined();
    });

    it('returns null for an unknown spot', () => {
        expect(setRvCustomNumber(area(), 'nope', '5')).toBeNull();
    });

    it('fills a sequence and rejects a start with no number', () => {
        expect(nums(fillRvSequence(area(), '1001'))).toEqual(['1001', '1002', '1003', '1004']);
        expect(nums(fillRvSequence(area(), 'C7')).slice(0, 2)).toEqual(['C7', 'C8']);
        expect(fillRvSequence(area(), 'abc')).toBeNull();
    });

    it('fill skips road / empty / blocked spots so real spots have no gaps', () => {
        const spots = ensureRvSpots(area()).spots.map((s, i) => (i === 1 ? { ...s, type: 'roadway' } : s));
        const out = fillRvSequence({ ...area(), spots }, '1001');
        expect(out).toHaveLength(4);
        expect([out[0].number, out[2].number, out[3].number]).toEqual(['1001', '1002', '1003']);
        expect(out[1].customNumber).toBeUndefined();
    });

    it('reset drops every typed number', () => {
        const filled = fillRvSequence(area(), '1001');
        expect(nums(clearRvCustomNumbers({ ...area(), spots: filled }))).toEqual(['R1', 'R2', 'R3', 'R4']);
    });

    it('finds duplicates ignoring case', () => {
        expect([...duplicateRvNumbers([{ number: 'A1' }, { number: 'a1' }, { number: 'B2' }])]).toEqual(['a1']);
    });
});


describe('setRvSpotType', () => {
    const area = { id: 'a1', spotCount: 3, spots: [] };
    it('blocks a free spot and clears it again', () => {
        const blocked = setRvSpotType(area, 'a1::spot::2', 'blocked');
        expect(blocked.find(s => s.id === 'a1::spot::2').type).toBe('blocked');
        const back = setRvSpotType({ ...area, spots: blocked }, 'a1::spot::2', null);
        expect(back.find(s => s.id === 'a1::spot::2').type).toBeUndefined();
    });
    it('refuses a booked spot', () => {
        const booked = { ...area, spots: assignRvSpotToBooking([ensureRvSpots(area)], 'a1::spot::1', 'b1')[0].spots };
        expect(setRvSpotType(booked, 'a1::spot::1', 'blocked')).toBeNull();
    });
});

describe('setRvSpotAmps', () => {
    it('sets and clears amps on a spot', () => {
        const area = { id: 'a', spotCount: 3 };
        const id = ensureRvSpots(area).spots[0].id;
        const on = setRvSpotAmps(area, id, '50');
        expect(on[0].amps).toBe('50');
        const off = setRvSpotAmps({ ...area, spots: on }, id, null);
        expect(off[0].amps).toBeUndefined();
    });
});

describe('copyRvLayout', () => {
    it('copies row width, roadways, blocked spots and amps by position', () => {
        let src = { id: 'a', spotCount: 4, layoutPerRow: 2, layoutRoadsAfter: [0] };
        const ids = ensureRvSpots(src).spots.map(s => s.id);
        src = { ...src, spots: setRvSpotType(src, ids[1], 'blocked') };
        src = { ...src, spots: setRvSpotAmps(src, ids[2], '50') };
        const out = copyRvLayout(src, { id: 'b', spotCount: 4 });
        expect(out.layoutPerRow).toBe(2);
        expect(out.layoutRoadsAfter).toEqual([0]);
        expect(out.spots[1].type).toBe('blocked');
        expect(out.spots[2].amps).toBe('50');
        expect(out.spots[0].type).toBeUndefined();
    });
    it('never blocks a booked spot', () => {
        const src = { id: 'a', spotCount: 2 };
        const blocked = setRvSpotType(src, ensureRvSpots(src).spots[0].id, 'blocked');
        const tgtSpots = ensureRvSpots({ id: 'b', spotCount: 2 }).spots.map((s, i) => i === 0 ? { ...s, bookingId: 'bk' } : s);
        const out = copyRvLayout({ ...src, spots: blocked }, { id: 'b', spotCount: 2, spots: tgtSpots });
        expect(out.spots[0].type).toBeUndefined();
        expect(out.spots[0].bookingId).toBe('bk');
    });
});
