// Structured pattern ID formatter implementing the client's naming scheme:
//   (DISCIPLINE)NNNN.DIFFICULTY.IDENTIFIER
// Example: Horsemanship0001.L1.P
//
// DISCIPLINE comes from patterns.class_name (PascalCased, spaces stripped).
// NNNN comes from patterns.pattern_number (already zero-padded on approval).
// DIFFICULTY is derived from patterns.level via the LEVEL_TO_CODE map.
// IDENTIFIER is derived from pattern_files.file_type + patterns.use_as_original.
// (Association suffix was intentionally dropped — the client wants the ID to
// stay association-agnostic since one pattern can serve multiple associations.)

// Client's canonical difficulty codes, ordered from most general to most specific.
export const DIFFICULTY_CODES = ['ALL', 'L1', 'GR_NOV', 'C', 'S', 'I', 'B', 'WT'];

// Human-readable level string → short code.
// Accepts variations to stay robust to casing/spacing.
const LEVEL_TO_CODE = {
  'all': 'ALL',
  'everyone': 'ALL',
  'l1': 'L1',
  'l1 / novice': 'L1',
  'level 1': 'L1',
  'green': 'GR_NOV',
  'novice': 'GR_NOV',
  'green / novice': 'GR_NOV',
  'championship': 'C',
  'skilled': 'S',
  'advanced': 'S', // legacy: "Advanced" maps to Skilled
  'intermediate': 'I',
  'beginner': 'B',
  'walk trot': 'WT',
  'walk-trot': 'WT',
  'wt': 'WT',
};

// Client's canonical identifier codes.
export const IDENTIFIER_CODES = ['SS', 'P', 'OP', 'CAPO', 'BS', 'EL', 'AD'];

// pattern_files.file_type → short code. When use_as_original is true and the
// file is the main pattern, we emit OP instead of P.
const FILE_TYPE_TO_CODE = {
  'pattern': 'P',
  'score_sheet': 'SS',
  'build_sheet': 'BS',
  'equipment': 'EL',
  'accessory': 'AD',
};

/**
 * Map a human-readable level string to its short difficulty code.
 * Returns "ALL" when level is empty/unknown — every pattern has a code.
 */
export function levelToDifficultyCode(level) {
  if (!level) return 'ALL';
  const key = String(level).trim().toLowerCase();
  return LEVEL_TO_CODE[key] || 'ALL';
}

/**
 * Map a pattern_files.file_type (plus the parent's OP/CAPO flags) to
 * the short identifier code. The OP/CAPO upgrade only applies to the main
 * pattern file; score sheets / build sheets / etc. keep their own codes
 * regardless. CAPO wins over OP when both are set (CAPO is more specific).
 */
export function fileTypeToIdentifierCode(fileType, useAsOriginal = false, isCapo = false) {
  const code = FILE_TYPE_TO_CODE[fileType] || 'P';
  if (code === 'P') {
    if (isCapo) return 'CAPO';
    if (useAsOriginal) return 'OP';
  }
  return code;
}

/**
 * Normalize a discipline name for the ID prefix: strip spaces, PascalCase.
 * "Hunter Hack" → "HunterHack", "horsemanship" → "Horsemanship".
 */
export function disciplineToPrefix(discipline) {
  if (!discipline) return 'Unknown';
  return String(discipline)
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

/**
 * Build the full structured pattern ID string.
 * Inputs are raw DB-style values; this function handles all mapping.
 *
 * @param {Object} opts
 * @param {string} opts.discipline      - patterns.class_name
 * @param {string|number} opts.number   - patterns.pattern_number (zero-padded 4-digit or int)
 * @param {string} [opts.level]         - patterns.level (optional — defaults to "ALL")
 * @param {string} [opts.fileType]      - pattern_files.file_type (defaults to "pattern")
 * @param {boolean} [opts.useAsOriginal] - patterns.use_as_original
 * @param {boolean} [opts.isCapo]       - true when the pattern is Choose A Pattern Only
 * @returns {string} e.g. "Horsemanship0001.L1.P", "Horsemanship0001.ALL.OP", "Horsemanship0001.ALL.CAPO"
 */
export function buildPatternId({
  discipline,
  number,
  level,
  fileType = 'pattern',
  useAsOriginal = false,
  isCapo = false,
} = {}) {
  const prefix = disciplineToPrefix(discipline);
  const numStr = formatPatternNumber4(number);
  const diff = levelToDifficultyCode(level);
  const ident = fileTypeToIdentifierCode(fileType, useAsOriginal, isCapo);
  return `${prefix}${numStr}.${diff}.${ident}`;
}

/**
 * Zero-pad a pattern number to 4 digits. Accepts strings or numbers; returns
 * "XXXX" as string. Unassigned → "XXXX" placeholder so the ID is still readable.
 */
export function formatPatternNumber4(number) {
  if (number === null || number === undefined || number === '') return 'XXXX';
  const parsed = typeof number === 'string' ? parseInt(number, 10) : number;
  if (Number.isNaN(parsed)) return String(number).slice(0, 4).padStart(4, '0');
  return String(parsed).padStart(4, '0');
}
