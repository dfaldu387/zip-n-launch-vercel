import { describe, it, expect } from 'vitest';
import {
    ensureRvSpots, setRvCustomNumber, fillRvSequence, clearRvCustomNumbers, duplicateRvNumbers,
    assignRvSpotToBooking,
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

    it('reset drops every typed number', () => {
        const filled = fillRvSequence(area(), '1001');
        expect(nums(clearRvCustomNumbers({ ...area(), spots: filled }))).toEqual(['R1', 'R2', 'R3', 'R4']);
    });

    it('finds duplicates ignoring case', () => {
        expect([...duplicateRvNumbers([{ number: 'A1' }, { number: 'a1' }, { number: 'B2' }])]).toEqual(['a1']);
    });
});
