import { supabase } from '@/lib/supabaseClient';

// Discipline prefix map for pattern numbering
const DISCIPLINE_PREFIXES = {
  'reining': 'RN',
  'trail': 'TR',
  'horsemanship': 'HM',
  'western riding': 'WR',
  'ranch riding': 'RR',
  'hunter under saddle': 'HUS',
  'western pleasure': 'WP',
  'showmanship': 'SM',
  'halter': 'HL',
  'barrel racing': 'BR',
  'pole bending': 'PB',
  'cutting': 'CT',
  'working cow horse': 'WCH',
  'ranch trail': 'RT',
  'ranch reining': 'RRN',
  'versatility ranch horse': 'VRH',
  'ranch versatility': 'RV',
  'hunt seat equitation': 'HSE',
  'hunter hack': 'HH',
  'hunt seat': 'HS',
};

// Valid pattern levels. Order matches difficulty progression for UI dropdowns.
// Each level has a canonical short code used in the structured pattern ID
// (see patternIdFormatter.js): B, I, S, GR_NOV, L1, WT, C, ALL.
// "Advanced" is kept for backward compatibility with existing rows; new patterns
// should use "Skilled" instead (S code).
export const PATTERN_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Skilled',
  'Green / Novice',
  'L1 / Novice',
  'Walk Trot',
  'Championship',
];

/**
 * Get the discipline prefix for a given discipline name.
 * Falls back to first 2-3 characters of the discipline name.
 */
export function getDisciplinePrefix(discipline) {
  if (!discipline) return 'UN'; // Unknown
  const lower = discipline.toLowerCase().trim();
  if (DISCIPLINE_PREFIXES[lower]) return DISCIPLINE_PREFIXES[lower];
  // Fallback: use first 2-3 uppercase letters
  const words = discipline.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return discipline.substring(0, 2).toUpperCase();
}

/**
 * Get the next discipline sequence number by querying existing patterns.
 * Returns the next available number for the given discipline.
 */
export async function getNextDisciplineSequenceNumber(discipline) {
  if (!discipline) return 1;
  const normalizedDiscipline = discipline.trim();

  const { data, error } = await supabase
    .from('patterns')
    .select('discipline_sequence_number')
    .ilike('class_name', `%${normalizedDiscipline}%`)
    .not('discipline_sequence_number', 'is', null)
    .order('discipline_sequence_number', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching sequence number:', error);
    return 1;
  }
  if (!data || data.length === 0) return 1;
  return (data[0].discipline_sequence_number || 0) + 1;
}

/**
 * Generate the auto display name for a pattern.
 * Format: "[Discipline] Pattern [Number]"
 * e.g., "Trail Pattern 1", "Hunter Hack Pattern 2"
 */
export function generateDisplayName(discipline, sequenceNumber) {
  if (!discipline) return `Pattern ${sequenceNumber || 1}`;
  // Title-case the discipline name
  const titleCased = discipline
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return `${titleCased} Pattern ${sequenceNumber || 1}`;
}

/**
 * Generate the internal pattern identifier.
 * Format: "Discipline-Level-Number" (e.g., "Trail-Intermediate-3")
 * If no level, format: "Discipline-Number" (e.g., "Trail-3")
 */
export function generatePatternIdentifier(discipline, level, sequenceNumber) {
  if (!discipline) return `Unknown-${sequenceNumber || 1}`;
  const slug = discipline
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  if (level) {
    const levelSlug = level.replace(/[\s\/]+/g, '');
    return `${slug}-${levelSlug}-${sequenceNumber || 1}`;
  }
  return `${slug}-${sequenceNumber || 1}`;
}

/**
 * Assign display name and sequence number to a pattern during submission.
 * This fetches the next sequence number, generates the display name and identifier,
 * and updates the pattern record in the database.
 * Once assigned, the sequence number should NEVER change.
 */
export async function assignPatternDisplayName(patternId, discipline, level) {
  const seqNum = await getNextDisciplineSequenceNumber(discipline);
  const displayName = generateDisplayName(discipline, seqNum);
  const identifier = generatePatternIdentifier(discipline, level, seqNum);

  const { error } = await supabase
    .from('patterns')
    .update({
      display_name: displayName,
      discipline_sequence_number: seqNum,
      pattern_identifier: identifier,
    })
    .eq('id', patternId);

  return { error, displayName, sequenceNumber: seqNum, identifier };
}

/**
 * Update the pattern identifier when level or discipline changes.
 * Does NOT change the sequence number (it's persistent).
 */
export async function updatePatternIdentifier(patternId, discipline, level, existingSequenceNumber) {
  const identifier = generatePatternIdentifier(discipline, level, existingSequenceNumber);
  const displayName = generateDisplayName(discipline, existingSequenceNumber);

  const { error } = await supabase
    .from('patterns')
    .update({
      display_name: displayName,
      pattern_identifier: identifier,
    })
    .eq('id', patternId);

  return { error, displayName, identifier };
}

/**
 * Generate the next pattern number for a given discipline.
 * Format: {PREFIX}-{YEAR}-{SEQ} (e.g., RN-2026-001)
 */
export async function generateNextPatternNumber(discipline) {
  const prefix = getDisciplinePrefix(discipline);
  const year = new Date().getFullYear();
  const numberPrefix = `${prefix}-${year}-`;

  // Query existing patterns with this prefix to find the max sequence
  const { data, error } = await supabase
    .from('patterns')
    .select('pattern_set_number')
    .like('pattern_set_number', `${numberPrefix}%`)
    .order('pattern_set_number', { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (!error && data && data.length > 0) {
    const lastNumber = data[0].pattern_set_number;
    const seqPart = lastNumber.split('-').pop();
    const parsed = parseInt(seqPart, 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }

  return `${numberPrefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Format a pattern number for display.
 * Returns the number as-is, or "Unassigned" if empty.
 */
export function formatPatternNumber(patternNumber) {
  if (!patternNumber) return 'Unassigned';
  return patternNumber;
}

/**
 * Assign a pattern number to a pattern in the database.
 */
export async function assignPatternNumber(patternId, patternNumber) {
  const { error } = await supabase
    .from('patterns')
    .update({ pattern_set_number: patternNumber })
    .eq('id', patternId);

  return { error };
}

/**
 * Generate the next global sequential pattern_number (e.g., "0014").
 * Counts only numeric 4-digit pattern_numbers already assigned.
 * Not transactionally safe — concurrent admins approving simultaneously
 * could produce duplicates. For current scale that's acceptable.
 */
export async function generateNextSharedPatternNumber() {
  const { data, error } = await supabase
    .from('patterns')
    .select('pattern_number')
    .not('pattern_number', 'is', null);

  if (error) {
    throw new Error(`Failed to read existing pattern_numbers: ${error.message}`);
  }

  let max = 0;
  for (const row of data || []) {
    const n = parseInt(row.pattern_number, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1).padStart(4, '0');
}

/**
 * Assign the shared pattern_number (used across all linked pattern_files).
 */
export async function assignSharedPatternNumber(patternId, number) {
  const { error } = await supabase
    .from('patterns')
    .update({ pattern_number: number })
    .eq('id', patternId);
  return { error };
}

/**
 * Get the public-facing name for a pattern.
 * Prefers display_name, falls back to name.
 */
export function getPatternPublicName(pattern) {
  return pattern?.display_name || pattern?.name || 'Unnamed Pattern';
}

export { DISCIPLINE_PREFIXES };
