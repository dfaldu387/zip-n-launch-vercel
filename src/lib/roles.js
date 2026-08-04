// One place that decides what a role name means.
//
// The app used to compare roles three different ways: the auth context lowercased
// before comparing, ShowDashboardPage compared exactly, and the database policies
// compare exactly against 'Admin'. A profile saved as 'admin' therefore looked like
// an admin in part of the app while every database write was refused — the admin
// pages opened, but nothing they did took effect.
//
// Comparisons here are case- and whitespace-insensitive. The database still expects
// the exact spelling, so roles must be *stored* consistently; this only stops the
// front end from disagreeing with itself.

// The roles table mixes two naming styles — SCREAMING_SNAKE ('SHOW_MANAGER',
// 'RING_STEWARD') and PascalCase ('ShowSecretary', 'Customer', 'Admin') — so the
// separators are dropped as well as the capitalisation. 'SHOW_MANAGER',
// 'ShowManager' and 'show manager' all mean the same role. No two codes in the
// table collapse onto each other under this rule.
export const normalizeRole = (role) =>
  (role ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');

/** True when a stored role value means the given role, whatever its capitalisation. */
export const isRole = (role, expected) => {
  const value = normalizeRole(role);
  return value !== '' && value === normalizeRole(expected);
};

/**
 * Escapes a value so it can be used as a literal in a SQL LIKE/ILIKE comparison.
 * Role codes contain underscores ('SHOW_MANAGER'), and an unescaped '_' in a LIKE
 * pattern matches any single character — so the raw value would also match
 * 'SHOWXMANAGER'. Backslash is Postgres' default LIKE escape character.
 */
export const escapeLikePattern = (value) =>
  (value ?? '').toString().replace(/[\\%_]/g, '\\$&');

/** True when the stored role matches any of the given roles. */
export const isAnyRole = (role, expectedList) =>
  (expectedList || []).some((expected) => isRole(role, expected));

// Spelled the way the roles table stores them. Comparisons go through isRole, so
// capitalisation and underscores do not have to match exactly — but keeping these
// identical to the table makes the two easy to check against each other.
export const ROLE = {
  ADMIN: 'Admin',
  SHOW_MANAGER: 'SHOW_MANAGER',
  ASSISTANT_SHOW_MANAGER: 'ASSISTANT_SHOW_MANAGER',
  SHOW_SECRETARY: 'ShowSecretary',
  JUDGE: 'JUDGE',
  CONTRIBUTOR: 'Contributor',
  CUSTOMER: 'Customer',
};
