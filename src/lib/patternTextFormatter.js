import { v4 as uuidv4 } from 'uuid';

// ─── Template Constants ──────────────────────────────────────────────
// Based on Pattern Book Builder PDF layout: A4 (595pt), 40pt margins, 10-11pt font
// ~72–80 chars per line at those sizes. We use 75 as the standard.
const TEMPLATE_MAX_CHARS_PER_LINE = 75;

// Equestrian action verbs used for sentence-boundary splitting and verb-first enforcement
const PRIMARY_VERBS = [
    'Walk', 'Trot', 'Jog', 'Lope', 'Canter', 'Gallop', 'Back', 'Stop', 'Halt', 'Whoa',
];
const TRANSITION_VERBS = [
    'Turn', 'Pivot', 'Spin', 'Reverse', 'Rollback', 'Roll back', 'Side Pass', 'Side-pass', 'Sidepass',
];
const PATTERN_VERBS = [
    'Circle', 'Lead', 'Change', 'Extend', 'Collect', 'Square Up', 'Set Up', 'Pick Up',
    'Drop to', 'Settle', 'Continue', 'Proceed', 'Begin', 'Start', 'Finish', 'Complete',
    'Cross', 'Pass', 'Round', 'Ride', 'Execute', 'Perform',
];

const ALL_VERBS = [...PRIMARY_VERBS, ...TRANSITION_VERBS, ...PATTERN_VERBS];
const ALL_VERBS_LOWER = ALL_VERBS.map(v => v.toLowerCase());

// Build case-insensitive verb pattern for splitting
const verbPattern = ALL_VERBS
    .sort((a, b) => b.length - a.length)
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

// Noise patterns to strip from extracted text
const NOISE_PATTERNS = [
    /\b(AQHA|NSBA|APHA|ApHC|NRHA|NRCHA|PHBA|PtHA)\b/gi,
    /\bPattern\s*#?\s*\d+\b/gi,
    /\bPattern\s+Complete\b/gi,
    /\bPage\s+\d+\s*(of\s+\d+)?\b/gi,
    /\bCopyright\b.*$/gim,
    /\bAll\s+Rights\s+Reserved\b/gi,
    /^\s*www\..+$/gim,
    /^\s*\d+\s*$/gm,
    /\b(Effective|Revised)\s+\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi,
    /\bOfficial\s+Pattern\b/gi,
];

// Common abbreviation normalizations
const ABBREVIATIONS = {
    'rt': 'right',
    'lt': 'left',
    'ctr': 'center',
    'fwd': 'forward',
    'bk': 'back',
    'approx': 'approximately',
    'min': 'minimum',
    'max': 'maximum',
    'cont': 'continue',
    'dept': 'departure',
    'depart': 'departure',
    'appx': 'approximately',
    'betw': 'between',
    'thru': 'through',
};

// ─── Text Utilities ──────────────────────────────────────────────────

const normalizeAbbreviations = (text) => {
    let result = text;
    for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
        const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
        result = result.replace(regex, full);
    }
    return result;
};

const stripNoise = (text) => {
    let result = text;
    for (const pattern of NOISE_PATTERNS) {
        result = result.replace(pattern, '');
    }
    return result.replace(/\s+/g, ' ').trim();
};

const capitalizeFirst = (str) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Ensure instruction starts with a recognized action verb.
 * If the first word IS a verb, capitalize it properly.
 * Returns the cleaned instruction.
 */
const enforceVerbFirst = (instruction) => {
    if (!instruction) return instruction;

    const words = instruction.split(/\s+/);
    if (words.length === 0) return instruction;

    // Check if first word (or first two words) is a known verb
    const twoWordStart = words.slice(0, 2).join(' ');
    const matchedTwoWord = ALL_VERBS.find(v => v.toLowerCase() === twoWordStart.toLowerCase());
    if (matchedTwoWord) {
        return matchedTwoWord + ' ' + words.slice(2).join(' ');
    }

    const matchedOneWord = ALL_VERBS.find(v => v.toLowerCase() === words[0].toLowerCase());
    if (matchedOneWord) {
        return matchedOneWord + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
    }

    // Already capitalized — return as-is
    return capitalizeFirst(instruction);
};

/**
 * Break a long instruction into structured lines fitting within TEMPLATE_MAX_CHARS_PER_LINE.
 * Breaks at natural boundaries (commas, semicolons, "and", "then").
 */
const structureLineLength = (instruction) => {
    if (instruction.length <= TEMPLATE_MAX_CHARS_PER_LINE) return instruction;

    const breakPoints = [/,\s+/g, /;\s+/g, /\s+then\s+/gi, /\s+and\s+/gi];
    let best = instruction;

    for (const bp of breakPoints) {
        const parts = instruction.split(bp);
        if (parts.length >= 2) {
            const rebuilt = parts.map(p => p.trim()).filter(Boolean);
            if (rebuilt.every(p => p.length <= TEMPLATE_MAX_CHARS_PER_LINE)) {
                best = rebuilt.join('. ');
                break;
            }
        }
    }

    // Word-wrap fallback if still too long
    if (best.length > TEMPLATE_MAX_CHARS_PER_LINE) {
        const words = best.split(/\s+/);
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            const test = currentLine ? `${currentLine} ${word}` : word;
            if (test.length <= TEMPLATE_MAX_CHARS_PER_LINE) {
                currentLine = test;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);
        best = lines.join(' ');
    }

    return best;
};

/**
 * Apply full structural standardization to a single instruction:
 * 1. Normalize abbreviations
 * 2. Enforce verb-first
 * 3. Clean trailing punctuation
 * 4. Ensure consistent casing
 * 5. Structure line length
 */
const standardizeInstruction = (instruction) => {
    if (!instruction) return '';

    let result = instruction.trim();

    // Remove trailing periods (we don't use sentence-ending periods in maneuver lists)
    result = result.replace(/\.\s*$/, '');

    // Normalize abbreviations
    result = normalizeAbbreviations(result);

    // Enforce verb-first with proper capitalization
    result = enforceVerbFirst(result);

    // Clean up multiple spaces
    result = result.replace(/\s+/g, ' ').trim();

    // Structure line length for template fit
    result = structureLineLength(result);

    return result;
};

// ─── Splitting Strategies ────────────────────────────────────────────

const tryNumberedSplit = (text) => {
    const stepRegex = /(?:^|\s)(\d+)\s*[.\):\-]\s*/g;
    const matches = [...text.matchAll(stepRegex)];

    if (matches.length < 2) return null;

    const steps = [];
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const startIdx = match.index + match[0].length;
        const endIdx = i < matches.length - 1 ? matches[i + 1].index : text.length;
        const raw = text.substring(startIdx, endIdx).trim();
        if (raw) {
            steps.push({
                id: uuidv4(),
                stepNumber: steps.length + 1,
                instruction: standardizeInstruction(raw),
                isOptional: false,
            });
        }
    }

    return steps.length >= 2 ? steps : null;
};

const tryVerbSplit = (text) => {
    const splitPattern = new RegExp(`(?:^|[.\\n]\\s*)(?=${verbPattern})`, 'gi');
    const parts = text.split(splitPattern).map(s => s.trim()).filter(Boolean);

    if (parts.length < 2) return null;

    const steps = parts.map((raw, idx) => ({
        id: uuidv4(),
        stepNumber: idx + 1,
        instruction: standardizeInstruction(raw),
        isOptional: false,
    }));

    return steps;
};

const lineSplit = (lines) => {
    return lines
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map((raw, idx) => ({
            id: uuidv4(),
            stepNumber: idx + 1,
            instruction: standardizeInstruction(raw),
            isOptional: false,
        }));
};

// ─── Main Formatting Function ────────────────────────────────────────

/**
 * Format raw extracted pattern text into structured, template-ready maneuver steps.
 * Applies full standardization: verb alignment, abbreviation expansion, line structuring.
 *
 * @param {string} rawText - The raw text extracted from a PDF
 * @param {string[]} [lines] - Optional pre-split lines from extraction
 * @returns {{ steps: Array<{id, stepNumber, instruction, isOptional}>, warnings: string[] }}
 */
export const formatPatternVerbiage = (rawText, lines = []) => {
    const warnings = [];

    const cleanedText = stripNoise(rawText);

    if (!cleanedText || cleanedText.length < 5) {
        return { steps: [], warnings: ['No meaningful text found in extraction.'] };
    }

    // Strategy 1: Try numbered format
    const numberedSteps = tryNumberedSplit(cleanedText);
    if (numberedSteps && numberedSteps.length >= 2) {
        return { steps: numberedSteps, warnings };
    }

    // Strategy 2: Try action-verb splitting
    const verbSteps = tryVerbSplit(cleanedText);
    if (verbSteps && verbSteps.length >= 2) {
        warnings.push('No numbered format detected — split by action verbs.');
        return { steps: verbSteps, warnings };
    }

    // Strategy 3: Fallback to line-based splitting
    const sourceLines = lines.length > 0 ? lines : cleanedText.split('\n');
    const lineSteps = lineSplit(sourceLines);
    if (lineSteps.length > 0) {
        warnings.push('No numbered or verb-based format detected — used line-based splitting.');
        return { steps: lineSteps, warnings };
    }

    return { steps: [], warnings: ['Could not parse any maneuver steps from the extracted text.'] };
};

// ─── Template Validation ─────────────────────────────────────────────

/**
 * Validate formatted maneuver steps against standard template expectations.
 * @param {Array<{stepNumber, instruction, isOptional}>} steps
 * @returns {{ isValid: boolean, issues: string[] }}
 */
export const validatePatternTemplate = (steps) => {
    const issues = [];

    if (!steps || steps.length === 0) {
        return { isValid: false, issues: ['No maneuver steps present.'] };
    }

    const emptySteps = steps.filter(s => !s.instruction?.trim());
    if (emptySteps.length > 0) {
        issues.push(`${emptySteps.length} step${emptySteps.length > 1 ? 's have' : ' has'} empty instructions.`);
    }

    // Check first step starts with a recognized action verb
    const firstInstruction = steps[0]?.instruction || '';
    const firstWord = firstInstruction.split(/\s+/)[0].toLowerCase();
    if (firstWord && !ALL_VERBS_LOWER.includes(firstWord)) {
        issues.push(`First step doesn't start with a recognized action verb ("${firstWord}").`);
    }

    // Check for duplicate step numbers
    const stepNums = steps.map(s => s.stepNumber);
    const uniqueNums = new Set(stepNums);
    if (uniqueNums.size !== stepNums.length) {
        issues.push('Duplicate step numbers detected.');
    }

    // Check ascending order
    for (let i = 1; i < steps.length; i++) {
        if (steps[i].stepNumber <= steps[i - 1].stepNumber) {
            issues.push('Steps are not in ascending order.');
            break;
        }
    }

    // Check line length compliance
    const longSteps = steps.filter(s => (s.instruction || '').length > TEMPLATE_MAX_CHARS_PER_LINE);
    if (longSteps.length > 0) {
        issues.push(`${longSteps.length} step${longSteps.length > 1 ? 's exceed' : ' exceeds'} the ${TEMPLATE_MAX_CHARS_PER_LINE}-character line limit.`);
    }

    return {
        isValid: issues.length === 0,
        issues,
    };
};

// ─── Pattern Book Template Output ────────────────────────────────────

/**
 * Convert formatted steps into the exact data shape the Pattern Book Builder consumes.
 * This is the template-ready format — when pulled into a Pattern Book, it needs no reformatting.
 *
 * @param {Array<{id, stepNumber, instruction, isOptional}>} steps
 * @param {{ disciplineName?: string, levelTitle?: string }} [metadata]
 * @returns {{ maneuvers: Array<{step_no, instruction}>, metadata: object, templateVersion: string }}
 */
export const toPatternBookFormat = (steps, metadata = {}) => {
    return {
        maneuvers: steps.map(s => ({
            step_no: s.stepNumber,
            instruction: s.instruction,
        })),
        metadata: {
            disciplineName: metadata.disciplineName || '',
            levelTitle: metadata.levelTitle || '',
            stepCount: steps.length,
            formattedAt: new Date().toISOString(),
        },
        templateVersion: '1.0',
    };
};
