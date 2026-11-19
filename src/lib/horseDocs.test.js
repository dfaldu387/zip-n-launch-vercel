import { describe, it, expect } from 'vitest';
import { getHorseSlots, healthStatus, withHorseDoc, withHorseName, horseDocPath } from './horseDocs';

const doc = (p) => ({ path: p, name: `${p}.pdf`, uploadedAt: '2026-11-19T00:00:00Z' });

describe('getHorseSlots', () => {
  it('makes one empty slot per horse even with no names', () => {
    const slots = getHorseSlots({}, 2, []);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ index: 0, name: '', certificate: null, coggins: null });
  });
  it('uses booking names, then names typed later', () => {
    const slots = getHorseSlots({ horseDocs: [{}, { name: 'Late Name' }] }, 2, ['Winner']);
    expect(slots.map((s) => s.name)).toEqual(['Winner', 'Late Name']);
  });
});

describe('healthStatus', () => {
  it('none when there are no horses', () => expect(healthStatus([]).state).toBe('none'));
  it('missing when nothing is uploaded', () => expect(healthStatus(getHorseSlots({}, 2, [])).state).toBe('missing'));
  it('partial when one paper is in', () => {
    const s = getHorseSlots({ horseDocs: [{ certificate: doc('a') }] }, 1, []);
    expect(healthStatus(s)).toMatchObject({ state: 'partial', done: 0, total: 1 });
  });
  it('confirmed when every horse has both papers', () => {
    const s = getHorseSlots({ horseDocs: [{ certificate: doc('a'), coggins: doc('b') }] }, 1, []);
    expect(healthStatus(s).state).toBe('confirmed');
  });
  it('partial when only one of two horses is complete', () => {
    const s = getHorseSlots({ horseDocs: [{ certificate: doc('a'), coggins: doc('b') }] }, 2, []);
    expect(healthStatus(s)).toMatchObject({ state: 'partial', done: 1, total: 2 });
  });
});

describe('withHorseDoc / withHorseName', () => {
  it('sets and removes a document without mutating', () => {
    const before = [{}];
    const after = withHorseDoc(before, 0, 'coggins', doc('x'), 1);
    expect(before[0].coggins).toBeUndefined();
    expect(after[0].coggins.path).toBe('x');
    expect(withHorseDoc(after, 0, 'coggins', null, 1)[0].coggins).toBeUndefined();
  });
  it('pads the list up to the slot', () => {
    expect(withHorseDoc(undefined, 2, 'certificate', doc('y'), 3)).toHaveLength(3);
  });
  it('stores a trimmed name', () => {
    expect(withHorseName([], 0, '  Smart Cash ', 1)[0].name).toBe('Smart Cash');
  });
});

describe('horseDocPath', () => {
  it('builds a safe path', () => expect(horseDocPath('s1', 'b1', 'Vet Paper.PDF', 'u')).toBe('s1/b1/u.pdf'));
  it('refuses other file types', () => expect(horseDocPath('s1', 'b1', 'virus.exe', 'u')).toBeNull());
});
