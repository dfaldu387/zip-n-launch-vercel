/**
 * Module Status Service
 *
 * Centralized status lifecycle management for Horse Show Manager modules.
 * Each module follows: NOT_STARTED → IN_PROGRESS → DRAFT → LOCKED → PUBLISHED
 */

// ── Status Enum ──
export const MODULE_STATUS = Object.freeze({
  NOT_STARTED:  'not_started',
  IN_PROGRESS:  'in_progress',
  DRAFT:        'draft',
  LOCKED:       'locked',
  PUBLISHED:    'published',
});

// ── Status metadata (labels, ranks, colors, icons) ──
export const STATUS_META = Object.freeze({
  [MODULE_STATUS.NOT_STARTED]: {
    label: 'Not Started',
    rank: 0,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-800/40',
    borderColor: 'border-gray-200 dark:border-gray-700',
    badgeBg: 'bg-gray-50 text-gray-600 border-gray-300',
    icon: 'Circle',
  },
  [MODULE_STATUS.IN_PROGRESS]: {
    label: 'In Progress',
    rank: 1,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-950/40',
    borderColor: 'border-blue-200 dark:border-blue-800',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-300',
    icon: 'Loader2',
  },
  [MODULE_STATUS.DRAFT]: {
    label: 'Draft',
    rank: 2,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-950/40',
    borderColor: 'border-orange-200 dark:border-orange-800',
    badgeBg: 'bg-orange-50 text-orange-700 border-orange-300',
    icon: 'FileEdit',
  },
  [MODULE_STATUS.LOCKED]: {
    label: 'Locked',
    rank: 3,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-800',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-300',
    icon: 'Lock',
  },
  [MODULE_STATUS.PUBLISHED]: {
    label: 'Published',
    rank: 4,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    icon: 'Check',
  },
});

// ── Allowed Transitions (adjacency list) ──
const TRANSITION_MAP = Object.freeze({
  [MODULE_STATUS.NOT_STARTED]: [MODULE_STATUS.IN_PROGRESS],
  [MODULE_STATUS.IN_PROGRESS]: [MODULE_STATUS.DRAFT],
  [MODULE_STATUS.DRAFT]:       [MODULE_STATUS.IN_PROGRESS, MODULE_STATUS.LOCKED],
  [MODULE_STATUS.LOCKED]:      [MODULE_STATUS.DRAFT, MODULE_STATUS.PUBLISHED],
  [MODULE_STATUS.PUBLISHED]:   [],  // terminal state
});

// ── Module Keys (all modules in the system) ──
export const MODULE_KEYS = Object.freeze({
  EDIT_WIZARD:         'editWizard',
  SCHEDULE_BUILDER:    'scheduleBuilder',
  SHOW_STRUCTURE:      'showStructure',
  FEE_STRUCTURE:       'feeStructure',
  CONTRACTS:           'contracts',
  PATTERN_BOOK:        'patternBook',
  BUDGETING:           'budgeting',
  EMPLOYEE_SCHEDULING: 'employeeScheduling',
  EQUIPMENT:           'equipment',
  RESULTS:             'results',
  AWARDS:              'awards',
  FINANCIALS:          'financials',
  STALLING:            'stalling',
});

// ── Validation Results ──

/**
 * @typedef {Object} TransitionResult
 * @property {boolean} allowed
 * @property {string|null} error - Human-readable error if not allowed
 * @property {string} from
 * @property {string} to
 */

/**
 * Check whether a status transition is valid.
 * Does NOT check show-level lock — use validateTransitionWithShowLock for that.
 *
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {TransitionResult}
 */
export function validateTransition(currentStatus, newStatus) {
  const from = currentStatus || MODULE_STATUS.NOT_STARTED;
  const to = newStatus;
  const base = { from, to };

  // Same status — no-op
  if (from === to) {
    return { ...base, allowed: true, error: null };
  }

  // Cannot return to NOT_STARTED
  if (to === MODULE_STATUS.NOT_STARTED) {
    return { ...base, allowed: false, error: 'Cannot revert a module to "Not Started" once work has begun.' };
  }

  // Must go through DRAFT before LOCKED
  if (from === MODULE_STATUS.IN_PROGRESS && to === MODULE_STATUS.LOCKED) {
    return { ...base, allowed: false, error: 'Module must be marked as "Draft" before it can be locked. Save as Draft first.' };
  }

  // Must go through LOCKED before PUBLISHED
  if (from !== MODULE_STATUS.LOCKED && to === MODULE_STATUS.PUBLISHED) {
    return { ...base, allowed: false, error: 'Module must be "Locked" before it can be published.' };
  }

  // Check adjacency map
  const allowedTargets = TRANSITION_MAP[from] || [];
  if (!allowedTargets.includes(to)) {
    const fromLabel = STATUS_META[from]?.label || from;
    const toLabel = STATUS_META[to]?.label || to;
    return { ...base, allowed: false, error: `Cannot transition from "${fromLabel}" to "${toLabel}".` };
  }

  return { ...base, allowed: true, error: null };
}

/**
 * Full validation including show-level lock check.
 *
 * @param {string} currentStatus
 * @param {string} newStatus
 * @param {boolean} isShowLocked
 * @returns {TransitionResult}
 */
export function validateTransitionWithShowLock(currentStatus, newStatus, isShowLocked) {
  if (isShowLocked) {
    return {
      from: currentStatus || MODULE_STATUS.NOT_STARTED,
      to: newStatus,
      allowed: false,
      error: 'This show is locked. Unlock the show to make changes.',
    };
  }
  return validateTransition(currentStatus, newStatus);
}

/**
 * Get all statuses a module CAN transition to from current status.
 * Respects show-level lock.
 *
 * @param {string} currentStatus
 * @param {boolean} isShowLocked
 * @returns {string[]}
 */
export function getAvailableTransitions(currentStatus, isShowLocked = false) {
  if (isShowLocked) return [];
  const from = currentStatus || MODULE_STATUS.NOT_STARTED;
  return TRANSITION_MAP[from] || [];
}

/**
 * Whether editing content is allowed in the current state.
 * Editing is blocked when module is LOCKED or PUBLISHED, or when show is globally locked.
 *
 * @param {string} moduleStatus
 * @param {boolean} isShowLocked
 * @returns {{ editable: boolean, reason: string|null }}
 */
export function isModuleEditable(moduleStatus, isShowLocked = false) {
  if (isShowLocked) {
    return { editable: false, reason: 'This show is locked. Unlock the show to make changes.' };
  }
  const status = moduleStatus || MODULE_STATUS.NOT_STARTED;
  if (status === MODULE_STATUS.LOCKED) {
    return { editable: false, reason: 'This module is locked. Unlock it to make edits.' };
  }
  if (status === MODULE_STATUS.PUBLISHED) {
    return { editable: false, reason: 'This module is published. Unlock it to make edits.' };
  }
  return { editable: true, reason: null };
}

/**
 * Whether a PDF can be generated for this module.
 *
 * @param {string} moduleStatus
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canGeneratePdf(moduleStatus) {
  const status = moduleStatus || MODULE_STATUS.NOT_STARTED;
  if (status === MODULE_STATUS.LOCKED || status === MODULE_STATUS.PUBLISHED) {
    return { allowed: true, reason: null };
  }
  return {
    allowed: false,
    reason: 'PDF can only be generated when the module is locked. Lock the module first.',
  };
}

/**
 * Auto-advance status when a user starts interacting with a module.
 * NOT_STARTED → IN_PROGRESS (silently).
 *
 * @param {string} currentStatus
 * @returns {string|null} New status if auto-advanced, null otherwise
 */
export function autoAdvanceOnInteraction(currentStatus) {
  if (!currentStatus || currentStatus === MODULE_STATUS.NOT_STARTED) {
    return MODULE_STATUS.IN_PROGRESS;
  }
  return null;
}

/**
 * Compute the effective show-level status from all module statuses.
 * The show's overall status = the LOWEST-rank status across all modules.
 *
 * @param {Object} moduleStatuses - { [moduleKey]: statusString }
 * @returns {string}
 */
export function computeShowStatus(moduleStatuses) {
  if (!moduleStatuses || Object.keys(moduleStatuses).length === 0) {
    return MODULE_STATUS.NOT_STARTED;
  }

  let minRank = Infinity;
  let minStatus = MODULE_STATUS.PUBLISHED;

  Object.values(moduleStatuses).forEach(status => {
    const meta = STATUS_META[status];
    if (meta && meta.rank < minRank) {
      minRank = meta.rank;
      minStatus = status;
    }
  });

  return minStatus;
}

/**
 * Migrate legacy status values ('draft', 'locked', 'published')
 * to the new 5-status system. Safe to call multiple times.
 *
 * @param {string} legacyStatus
 * @returns {string}
 */
export function migrateLegacyStatus(legacyStatus) {
  const mapping = {
    'draft':     MODULE_STATUS.DRAFT,
    'Draft':     MODULE_STATUS.DRAFT,
    'locked':    MODULE_STATUS.LOCKED,
    'Locked':    MODULE_STATUS.LOCKED,
    'published': MODULE_STATUS.PUBLISHED,
    'Published': MODULE_STATUS.PUBLISHED,
    'Final':     MODULE_STATUS.PUBLISHED,
    'final':     MODULE_STATUS.PUBLISHED,
    'In progress': MODULE_STATUS.IN_PROGRESS,
    'in progress': MODULE_STATUS.IN_PROGRESS,
  };

  // Already new-format
  if (Object.values(MODULE_STATUS).includes(legacyStatus)) {
    return legacyStatus;
  }

  return mapping[legacyStatus] || MODULE_STATUS.NOT_STARTED;
}

/**
 * Migrate an entire moduleStatuses object from legacy to new format.
 *
 * @param {Object} moduleStatuses
 * @returns {Object}
 */
export function migrateAllModuleStatuses(moduleStatuses) {
  if (!moduleStatuses) return {};
  const migrated = {};
  Object.entries(moduleStatuses).forEach(([key, status]) => {
    migrated[key] = migrateLegacyStatus(status);
  });
  return migrated;
}

/**
 * Stamp a module's status into project_data before saving.
 * Used by pages that do direct Supabase updates (bypassing useShowBuilder).
 *
 * - If status is NOT_STARTED → advances to IN_PROGRESS
 * - If status is IN_PROGRESS → advances to DRAFT
 * - If already DRAFT / LOCKED / PUBLISHED → leaves as-is
 *
 * Returns a new project_data object (does not mutate the input).
 *
 * @param {Object} projectData - The current project_data
 * @param {string} moduleKey   - e.g. 'results', 'employeeScheduling'
 * @returns {Object} Updated project_data with moduleStatuses stamped
 */
export function stampModuleStatusOnSave(projectData, moduleKey) {
  const current = migrateLegacyStatus(
    (projectData?.moduleStatuses || {})[moduleKey] || MODULE_STATUS.NOT_STARTED
  );

  let next = current;
  if (current === MODULE_STATUS.NOT_STARTED) {
    next = MODULE_STATUS.IN_PROGRESS;
  } else if (current === MODULE_STATUS.IN_PROGRESS) {
    next = MODULE_STATUS.DRAFT;
  }
  // DRAFT, LOCKED, PUBLISHED stay as-is on regular saves

  return {
    ...projectData,
    moduleStatuses: {
      ...(projectData?.moduleStatuses || {}),
      [moduleKey]: next,
    },
  };
}
