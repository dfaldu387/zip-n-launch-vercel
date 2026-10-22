import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { checkLatestForSave } from './latestShowGuard';

describe('checkLatestForSave', () => {
  it('stops when the re-read failed', () => {
    const r = checkLatestForSave({ data: null, error: { message: 'boom' } }, 'employeeScheduling');
    expect(r).toMatchObject({ ok: false, reason: 'read-failed' });
  });

  it('stops when the show row is missing', () => {
    expect(checkLatestForSave({ data: null, error: null }, 'employeeScheduling')).toMatchObject({ ok: false, reason: 'not-found' });
  });

  it('stops when the whole show is locked', () => {
    const read = { data: { project_data: { isShowLocked: true } }, error: null };
    expect(checkLatestForSave(read, 'employeeScheduling')).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('stops when only this module is locked', () => {
    const read = { data: { project_data: { moduleStatuses: { employeeScheduling: 'locked' } } }, error: null };
    expect(checkLatestForSave(read, 'employeeScheduling')).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('allows a save when another module is the locked one', () => {
    const read = { data: { project_data: { moduleStatuses: { budgeting: 'locked' } } }, error: null };
    expect(checkLatestForSave(read, 'employeeScheduling').ok).toBe(true);
  });

  it('returns the newest data when safe', () => {
    const read = { data: { project_data: { a: 1 } }, error: null };
    expect(checkLatestForSave(read, 'employeeScheduling')).toEqual({ ok: true, latest: { a: 1 } });
  });
});
