/**
 * Equipment Requirement Calculator — Pure functions, no external dependencies.
 *
 * Data flow:
 *   discipline_equipment + class_template_equipment → mergeClassEquipment
 *   merged equipment × session classes → calculateSessionRequirements (MAX or SUM)
 *   sessions grouped by date → calculateDayRequirements (MAX within arena, SUM across arenas)
 *   day results → calculateShowRequirements (MAX across days, shortage detection)
 */

/**
 * Merge discipline baseline equipment with class-template-specific equipment.
 * For shared equipment_ids, quantities are summed.
 *
 * @param {Array} disciplineRows - [{ equipment_id, quantity, is_optional, equipment_items: { id, name, category, unit_type } }]
 * @param {Array} templateRows  - [{ equipment_id, quantity, equipment_items: { id, name, category, unit_type } }]
 * @returns {Object} Map keyed by equipment_id → { qty, name, category, unit_type, source }
 */
export function mergeClassEquipment(disciplineRows = [], templateRows = []) {
  const merged = {};

  for (const row of disciplineRows) {
    const eqId = row.equipment_id;
    const eq = row.equipment_items || {};
    merged[eqId] = {
      qty: row.quantity || 1,
      name: eq.name || 'Unknown',
      category: eq.category || '',
      unit_type: eq.unit_type || 'each',
      source: 'discipline',
    };
  }

  for (const row of templateRows) {
    const eqId = row.equipment_id;
    const eq = row.equipment_items || {};
    if (merged[eqId]) {
      merged[eqId].qty += row.quantity || 1;
      merged[eqId].source = 'both';
    } else {
      merged[eqId] = {
        qty: row.quantity || 1,
        name: eq.name || 'Unknown',
        category: eq.category || '',
        unit_type: eq.unit_type || 'each',
        source: 'template',
      };
    }
  }

  return merged;
}

/**
 * Calculate per-equipment requirements for a single arena session.
 *
 * @param {Array} sessionClasses - [{
 *   class_template_id, class_template_name, discipline_name,
 *   quantity, equipment: { [eq_id]: { qty, name, category, unit_type } }
 * }]
 * @param {'MAX'|'SUM'} mode
 * @returns {{ requirements: Object, details: Array }}
 *   requirements: { [eq_id]: { qty, name, category, unit_type } }
 *   details: [{ class_template_name, discipline_name, equipment_id, per_instance_qty, instances, total_qty }]
 */
export function calculateSessionRequirements(sessionClasses = [], mode = 'MAX') {
  const requirements = {};
  const details = [];

  for (const sc of sessionClasses) {
    const equipment = sc.equipment || {};
    for (const [eqId, eqData] of Object.entries(equipment)) {
      const perInstance = eqData.qty || 0;
      const totalForClass = perInstance * (sc.quantity || 1);

      details.push({
        class_template_name: sc.class_template_name,
        discipline_name: sc.discipline_name,
        equipment_id: eqId,
        equipment_name: eqData.name,
        per_instance_qty: perInstance,
        instances: sc.quantity || 1,
        total_qty: totalForClass,
      });

      if (!requirements[eqId]) {
        requirements[eqId] = {
          qty: 0,
          name: eqData.name,
          category: eqData.category,
          unit_type: eqData.unit_type,
        };
      }

      if (mode === 'SUM') {
        requirements[eqId].qty += totalForClass;
      } else {
        // MAX: keep the highest requirement across classes
        requirements[eqId].qty = Math.max(requirements[eqId].qty, totalForClass);
      }
    }
  }

  return { requirements, details };
}

/**
 * Calculate day-level requirements from all sessions on a single date.
 * - Within an arena: MAX across sessions (sessions are sequential).
 * - Across arenas: SUM (arenas run simultaneously).
 *
 * @param {Array} sessionsForDate - [{
 *   arena_id, arena_name, requirements: { [eq_id]: { qty, name, category, unit_type } }
 * }]
 * @returns {{ requirements: Object, arenaBreakdown: Object }}
 *   requirements: { [eq_id]: { qty, name, category, unit_type } }
 *   arenaBreakdown: { [eq_id]: { [arena_id]: { arena_name, qty } } }
 */
export function calculateDayRequirements(sessionsForDate = []) {
  // Group by arena
  const arenaMap = {};
  for (const session of sessionsForDate) {
    const aid = session.arena_id;
    if (!arenaMap[aid]) {
      arenaMap[aid] = { arena_name: session.arena_name, sessions: [] };
    }
    arenaMap[aid].sessions.push(session);
  }

  // Per arena: MAX across sessions for each equipment_id
  const arenaMaxes = {};
  for (const [arenaId, arenaData] of Object.entries(arenaMap)) {
    arenaMaxes[arenaId] = { arena_name: arenaData.arena_name, equipment: {} };
    for (const session of arenaData.sessions) {
      for (const [eqId, eqData] of Object.entries(session.requirements || {})) {
        if (!arenaMaxes[arenaId].equipment[eqId]) {
          arenaMaxes[arenaId].equipment[eqId] = { ...eqData, qty: 0 };
        }
        arenaMaxes[arenaId].equipment[eqId].qty = Math.max(
          arenaMaxes[arenaId].equipment[eqId].qty,
          eqData.qty
        );
      }
    }
  }

  // Across arenas: SUM for each equipment_id
  const requirements = {};
  const arenaBreakdown = {};

  for (const [arenaId, arenaData] of Object.entries(arenaMaxes)) {
    for (const [eqId, eqData] of Object.entries(arenaData.equipment)) {
      if (!requirements[eqId]) {
        requirements[eqId] = { qty: 0, name: eqData.name, category: eqData.category, unit_type: eqData.unit_type };
        arenaBreakdown[eqId] = {};
      }
      requirements[eqId].qty += eqData.qty;
      arenaBreakdown[eqId][arenaId] = { arena_name: arenaData.arena_name, qty: eqData.qty };
    }
  }

  return { requirements, arenaBreakdown };
}

/**
 * Calculate show-level peak requirements and detect shortages.
 * - For the whole show: MAX across all days (equipment reused day-to-day).
 * - Shortage = peak_daily_required − total_qty_owned (if positive).
 *
 * @param {Object} dayRequirements - { [date]: { requirements: { [eq_id]: { qty, name, ... } } } }
 * @param {Object} inventory - { [eq_id]: { total_qty_owned, name, category, unit_type } }
 * @returns {{ peakRequirements: Object, shortages: Array }}
 */
export function calculateShowRequirements(dayRequirements = {}, inventory = {}) {
  const peakRequirements = {};

  for (const [date, dayData] of Object.entries(dayRequirements)) {
    for (const [eqId, eqData] of Object.entries(dayData.requirements || {})) {
      if (!peakRequirements[eqId]) {
        peakRequirements[eqId] = { qty: 0, name: eqData.name, category: eqData.category, unit_type: eqData.unit_type, peak_day: date };
      }
      if (eqData.qty > peakRequirements[eqId].qty) {
        peakRequirements[eqId].qty = eqData.qty;
        peakRequirements[eqId].peak_day = date;
      }
    }
  }

  const shortages = [];
  for (const [eqId, peak] of Object.entries(peakRequirements)) {
    const owned = inventory[eqId]?.total_qty_owned ?? 0;
    const shortage = peak.qty - owned;
    if (shortage > 0) {
      shortages.push({
        equipment_id: eqId,
        name: peak.name,
        category: peak.category,
        unit_type: peak.unit_type,
        required: peak.qty,
        owned,
        shortage,
        peak_day: peak.peak_day,
      });
    }
  }

  return { peakRequirements, shortages };
}

/**
 * Orchestrator: build full calculation results from assembled session data.
 *
 * @param {Array} sessions - [{
 *   id, session_name, arena_id, arena_name, date, calculation_mode,
 *   classes: [{ class_template_id, class_template_name, discipline_name, quantity, equipment }]
 * }]
 * @param {Object} inventory - { [eq_id]: { total_qty_owned, name, category, unit_type } }
 * @returns {{ sessionResults: Array, dayResults: Array, showResults: Object }}
 */
export function calculateFullShowRequirements(sessions = [], inventory = {}) {
  // 1. Calculate per-session requirements
  const sessionResults = sessions.map(session => {
    const { requirements, details } = calculateSessionRequirements(session.classes, session.calculation_mode);
    return {
      sessionId: session.id,
      sessionName: session.session_name,
      arenaId: session.arena_id,
      arenaName: session.arena_name,
      date: session.date,
      mode: session.calculation_mode,
      requirements,
      details,
    };
  });

  // 2. Group sessions by date, calculate day requirements
  const dateMap = {};
  for (const sr of sessionResults) {
    if (!dateMap[sr.date]) dateMap[sr.date] = [];
    dateMap[sr.date].push({
      arena_id: sr.arenaId,
      arena_name: sr.arenaName,
      requirements: sr.requirements,
    });
  }

  const dayResultsMap = {};
  const dayResults = [];
  for (const [date, sessionsForDate] of Object.entries(dateMap)) {
    const dayCalc = calculateDayRequirements(sessionsForDate);
    dayResultsMap[date] = dayCalc;
    dayResults.push({ date, ...dayCalc });
  }

  // 3. Calculate show-level peak + shortages
  const showResults = calculateShowRequirements(dayResultsMap, inventory);

  return { sessionResults, dayResults, showResults };
}
