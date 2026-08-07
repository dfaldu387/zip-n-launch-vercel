import { describe, it, expect } from 'vitest';
import { resolveDivisionDate, resolveDivisionDates, resolveGroupDate } from './divisionDates';

// The shape "Duplicate groups from another discipline" has to produce. Copied
// groups used to arrive as { id, assocId, division } only: the Go 2 entries were
// dropped outright (their id carries a -go2 suffix that the base-id mapping never
// matched), and anything that survived lost baseId and goNumber — so no Go record
// was found, no date resolved, and those patterns printed on the show's first day.
const copyDivision = (sourceDiv, currentBaseId, targetDiscipline) => {
  const targetGo = targetDiscipline.divisionGos?.[currentBaseId] || {};
  const goNumber = sourceDiv.goNumber ?? null;
  if (goNumber === 2 && !targetGo.hasGo2) return null;
  return {
    id: goNumber ? `${currentBaseId}-go${goNumber}` : currentBaseId,
    baseId: currentBaseId,
    assocId: sourceDiv.assocId,
    division: sourceDiv.division,
    goNumber,
    hasGo2: !!targetGo.hasGo2,
  };
};

const twoGoDiscipline = {
  divisionGos: {
    'AQHA-Novice': { hasGo2: true, go1Date: '2026-07-01', go2Date: '2026-07-03' },
  },
  divisionDates: { 'AQHA-Novice': '2026-07-01' },
};

const singleGoDiscipline = {
  divisionGos: {
    'AQHA-Novice': { hasGo2: false, go1Date: '2026-08-10', go2Date: null },
  },
  divisionDates: { 'AQHA-Novice': '2026-08-10' },
};

const sourceGo1 = { id: 'X-Novice-go1', baseId: 'X-Novice', assocId: 'AQHA', division: 'Novice', goNumber: 1, hasGo2: true };
const sourceGo2 = { id: 'X-Novice-go2', baseId: 'X-Novice', assocId: 'AQHA', division: 'Novice', goNumber: 2, hasGo2: true };

describe('copying a pattern group into another discipline', () => {
  it('keeps Go 1 on its own day', () => {
    const copied = copyDivision(sourceGo1, 'AQHA-Novice', twoGoDiscipline);
    expect(copied.goNumber).toBe(1);
    expect(resolveDivisionDate(twoGoDiscipline, copied)).toBe('2026-07-01');
  });

  // The bug: Go 2 printed on the show's first day instead of its own.
  it('keeps Go 2 on its own day, not Go 1s', () => {
    const copied = copyDivision(sourceGo2, 'AQHA-Novice', twoGoDiscipline);
    expect(copied.id).toBe('AQHA-Novice-go2');
    expect(copied.baseId).toBe('AQHA-Novice');
    expect(resolveDivisionDate(twoGoDiscipline, copied)).toBe('2026-07-03');
  });

  it('drops a Go 2 entry when this discipline has no second go', () => {
    expect(copyDivision(sourceGo2, 'AQHA-Novice', singleGoDiscipline)).toBeNull();
  });

  it('copies a single-go division without inventing a go number', () => {
    const source = { id: 'X-Novice', baseId: 'X-Novice', assocId: 'AQHA', division: 'Novice', goNumber: null };
    const copied = copyDivision(source, 'AQHA-Novice', singleGoDiscipline);
    expect(copied.id).toBe('AQHA-Novice');
    expect(copied.goNumber).toBeNull();
    expect(resolveDivisionDate(singleGoDiscipline, copied)).toBe('2026-08-10');
  });

  it('takes hasGo2 from the target discipline, not the source', () => {
    const copied = copyDivision(sourceGo1, 'AQHA-Novice', singleGoDiscipline);
    expect(copied.hasGo2).toBe(false);
  });

  it('gives a copied group the date of its own go', () => {
    const group = { divisions: [copyDivision(sourceGo2, 'AQHA-Novice', twoGoDiscipline)] };
    expect(resolveGroupDate(twoGoDiscipline, group)).toBe('2026-07-03');
  });

  // What went wrong before: no baseId and no goNumber means no Go record is found.
  it('shows why the old shape lost the date', () => {
    const oldShape = { id: 'AQHA-Novice-go2', assocId: 'AQHA', division: 'Novice' };
    expect(resolveDivisionDate(twoGoDiscipline, oldShape)).toBeNull();
    expect(resolveDivisionDates(twoGoDiscipline, oldShape)).toEqual([]);
  });
});
