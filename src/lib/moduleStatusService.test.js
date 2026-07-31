import { describe, it, expect } from 'vitest';
import {
  MODULE_STATUS,
  getAvailableTransitions,
  validateTransition,
  isWizardReadOnly,
} from './moduleStatusService';

describe('status transitions', () => {
  it('lets a locked module go back to draft — that is the unlock', () => {
    expect(getAvailableTransitions(MODULE_STATUS.LOCKED)).toContain(MODULE_STATUS.DRAFT);
    expect(validateTransition(MODULE_STATUS.LOCKED, MODULE_STATUS.DRAFT).allowed).toBe(true);
  });

  it('lets a published module go back to draft — publishing must be reversible', () => {
    expect(getAvailableTransitions(MODULE_STATUS.PUBLISHED)).toContain(MODULE_STATUS.DRAFT);
    expect(validateTransition(MODULE_STATUS.PUBLISHED, MODULE_STATUS.DRAFT).allowed).toBe(true);
  });

  it('still requires going through locked before publishing', () => {
    expect(validateTransition(MODULE_STATUS.DRAFT, MODULE_STATUS.PUBLISHED).allowed).toBe(false);
    expect(validateTransition(MODULE_STATUS.LOCKED, MODULE_STATUS.PUBLISHED).allowed).toBe(true);
  });

  it('offers nothing while the whole show is locked', () => {
    expect(getAvailableTransitions(MODULE_STATUS.DRAFT, true)).toEqual([]);
  });
});

describe('isWizardReadOnly', () => {
  it('locks every module when the show itself is locked', () => {
    expect(isWizardReadOnly({ isShowLocked: true }, 'feeStructure')).toBe(true);
  });

  it('locks a module that is locked or published', () => {
    expect(isWizardReadOnly({ moduleStatuses: { feeStructure: 'locked' } }, 'feeStructure')).toBe(true);
    expect(isWizardReadOnly({ moduleStatuses: { feeStructure: 'published' } }, 'feeStructure')).toBe(true);
  });

  it('accepts the legacy status spellings still in the database', () => {
    expect(isWizardReadOnly({ moduleStatuses: { patternBook: 'Lock & Approve Mode' } }, 'patternBook')).toBe(true);
    expect(isWizardReadOnly({ moduleStatuses: { patternBook: 'Publication' } }, 'patternBook')).toBe(true);
  });

  it('leaves a draft or in-progress module editable', () => {
    expect(isWizardReadOnly({ moduleStatuses: { feeStructure: 'draft' } }, 'feeStructure')).toBe(false);
    expect(isWizardReadOnly({ moduleStatuses: { feeStructure: 'in_progress' } }, 'feeStructure')).toBe(false);
  });

  it('ignores showStatus — it is derived from other modules, not a lock signal', () => {
    // Regression: a show whose OTHER modules were locked reported showStatus
    // 'locked', which used to force this module read-only with no way out.
    expect(isWizardReadOnly(
      { showStatus: 'locked', moduleStatuses: { feeStructure: 'draft' } },
      'feeStructure',
    )).toBe(false);
  });

  it('treats missing data as editable, not locked', () => {
    expect(isWizardReadOnly(undefined, 'feeStructure')).toBe(false);
    expect(isWizardReadOnly({}, 'feeStructure')).toBe(false);
  });
});
