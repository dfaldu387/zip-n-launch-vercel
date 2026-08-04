import { describe, it, expect } from 'vitest';
import { normalizeRole, isRole, isAnyRole, escapeLikePattern, ROLE } from './roles';

// Every role_code currently in the roles table. Used to prove that ignoring
// capitalisation and separators never makes two different roles look equal.
const ROLE_CODES = [
  'SHOW_MANAGER', 'JUDGE', 'ANNOUNCER', 'RING_STEWARD', 'GATE_ATTENDANT',
  'TRAIL_CREW', 'CATTLE_CREW', 'SCRIBE', 'TABULATOR', 'VOLUNTEER_COORDINATOR',
  'AWARDS_COORDINATOR', 'CLASS_COMMISSIONER', 'HORSE_HANDLER', 'TACK_MANAGER',
  'WARMUP_SUPERVISOR', 'COURSE_DESIGNER', 'GROUNDS_CREW', 'OFFICE_ASSISTANT',
  'TECHNICAL_DELEGATE', 'JUMP_CREW', 'TIMER_OPERATOR', 'HorseManager',
  'PatternBookCoordinator', 'ShowSecretary', 'RingStewardScribe', 'Contributor',
  'Customer', 'ASSISTANT_SHOW_MANAGER', 'SHOW_STEWARD', 'GATE_MANAGER',
  'JUMP_COURSE_DESIGNER', 'EQUIPMENT_PROVIDER', 'ARENA_CREW', 'EXHIBITOR', 'Admin',
];

describe('normalizeRole', () => {
  it('ignores capitalisation, spaces and underscores', () => {
    expect(normalizeRole('SHOW_MANAGER')).toBe('showmanager');
    expect(normalizeRole('ShowManager')).toBe('showmanager');
    expect(normalizeRole('  show manager ')).toBe('showmanager');
    expect(normalizeRole('show-manager')).toBe('showmanager');
  });

  it('treats missing values as empty', () => {
    expect(normalizeRole(null)).toBe('');
    expect(normalizeRole(undefined)).toBe('');
    expect(normalizeRole('')).toBe('');
  });
});

describe('isRole', () => {
  it('matches the same role written either way', () => {
    expect(isRole('SHOW_MANAGER', ROLE.SHOW_MANAGER)).toBe(true);
    expect(isRole('ShowManager', ROLE.SHOW_MANAGER)).toBe(true);
    expect(isRole('admin', ROLE.ADMIN)).toBe(true);
    expect(isRole('Admin', ROLE.ADMIN)).toBe(true);
  });

  it('does not match a different role', () => {
    expect(isRole('ASSISTANT_SHOW_MANAGER', ROLE.SHOW_MANAGER)).toBe(false);
    expect(isRole('Customer', ROLE.ADMIN)).toBe(false);
  });

  // An empty role must never be treated as a match, or a profile with no role
  // set would satisfy every check.
  it('never matches when the role is missing', () => {
    expect(isRole(null, ROLE.ADMIN)).toBe(false);
    expect(isRole('', '')).toBe(false);
  });
});

describe('isAnyRole', () => {
  it('matches when one of the roles fits', () => {
    expect(isAnyRole('ShowSecretary', [ROLE.ADMIN, ROLE.SHOW_SECRETARY])).toBe(true);
    expect(isAnyRole('JUDGE', [ROLE.ADMIN, ROLE.SHOW_SECRETARY])).toBe(false);
    expect(isAnyRole('Admin', [])).toBe(false);
  });
});

describe('escapeLikePattern', () => {
  it('escapes the SQL wildcards so a role code matches only itself', () => {
    expect(escapeLikePattern('SHOW_MANAGER')).toBe('SHOW\\_MANAGER');
    expect(escapeLikePattern('Customer')).toBe('Customer');
    expect(escapeLikePattern('a%b')).toBe('a\\%b');
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });

  it('handles missing values', () => {
    expect(escapeLikePattern(null)).toBe('');
    expect(escapeLikePattern(undefined)).toBe('');
  });
});

describe('the live roles table', () => {
  it('has no two codes that normalise to the same value', () => {
    const seen = new Map();
    const collisions = [];
    for (const code of ROLE_CODES) {
      const key = normalizeRole(code);
      if (seen.has(key)) collisions.push([seen.get(key), code]);
      else seen.set(key, code);
    }
    expect(collisions).toEqual([]);
  });

  it('contains every role the app looks for', () => {
    for (const expected of Object.values(ROLE)) {
      const found = ROLE_CODES.some((code) => isRole(code, expected));
      expect(found, `no role_code matches "${expected}"`).toBe(true);
    }
  });
});
