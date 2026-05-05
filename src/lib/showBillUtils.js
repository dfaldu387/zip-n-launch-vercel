import { v4 as uuidv4 } from 'uuid';

// Known association IDs that contain hyphens
const HYPHENATED_ASSOC_IDS = ['4-H'];

/**
 * Parse a divisionId into { assocId, divisionName }.
 * Handles association IDs that contain hyphens (e.g., "4-H").
 * Format: "${assocId}-${divisionName}"
 */
export function parseDivisionId(divisionId) {
  if (!divisionId) return { assocId: '', divisionName: '' };
  // Check hyphenated association IDs first
  for (const id of HYPHENATED_ASSOC_IDS) {
    if (divisionId.startsWith(id + '-')) {
      return { assocId: id, divisionName: divisionId.slice(id.length + 1) };
    }
  }
  // Default: split on first hyphen
  const idx = divisionId.indexOf('-');
  if (idx === -1) return { assocId: divisionId, divisionName: '' };
  return { assocId: divisionId.slice(0, idx), divisionName: divisionId.slice(idx + 1) };
}

// Format a Date as yyyy-MM-dd in local time (avoids UTC timezone shifts from toISOString)
export function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Extract judge names from formData.associationJudges
function extractJudgeNames(formData) {
  const names = new Set();
  const assocJudges = formData.associationJudges || {};
  for (const assocId of Object.keys(assocJudges)) {
    const info = assocJudges[assocId];
    if (info?.judges) {
      info.judges.forEach(j => {
        if (j?.name?.trim()) names.add(j.name.trim());
      });
    }
  }
  return Array.from(names);
}

// Extract all class items from formData disciplines
// Each item gets a unique `id` (discipline::division) for UI selection/keying,
// and keeps `divisionId` for matching against showBill item.classes.
export function getAllClassItems(formData) {
  return (formData.disciplines || []).flatMap(discipline =>
    (discipline.divisionOrder || []).map(divisionId => {
      const { assocId, divisionName } = parseDivisionId(divisionId);
      const customTitle = discipline.divisionPrintTitles?.[divisionId];
      const rawDivision = divisionName.startsWith('custom-') ? divisionName.substring(7) : divisionName;
      const name = customTitle || (discipline.name ? `${discipline.name} ${rawDivision}` : rawDivision);
      return {
        id: `${discipline.id}::${divisionId}`,
        divisionId,
        name,
        disciplineId: discipline.id,
        disciplineName: discipline.name,
        assocId,
        discipline,
      };
    })
  );
}

// Get classes not yet placed in any showBill classBox
export function getUnplacedClasses(formData) {
  const allClasses = getAllClassItems(formData);
  if (!formData.showBill) return allClasses;

  const placedIds = new Set();
  for (const day of formData.showBill.days || []) {
    for (const arena of day.arenas || []) {
      for (const item of arena.items || []) {
        if (item.type === 'classBox' && item.classes) {
          item.classes.forEach(id => placedIds.add(id));
        }
      }
    }
  }
  return allClasses.filter(c => !placedIds.has(c.id) && !placedIds.has(c.divisionId));
}

// Create initial showBill from formData
export function initializeShowBill(formData) {
  const days = [];
  if (formData.startDate) {
    let current = new Date(formData.startDate + 'T00:00:00');
    const end = formData.endDate ? new Date(formData.endDate + 'T00:00:00') : current;
    while (current <= end) {
      const dateStr = toLocalDateStr(current);
      days.push({
        id: `day-${uuidv4()}`,
        date: dateStr,
        label: current.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        arenas: (formData.arenas || [])
          .filter(a => a.name.trim() !== '' && (!a.dates || a.dates.length === 0 || a.dates.includes(dateStr)))
          .map(arena => ({ id: arena.id, name: arena.name, items: [] })),
      });
      current.setDate(current.getDate() + 1);
    }
  }

  // If no days generated, create one default day
  if (days.length === 0) {
    const today = toLocalDateStr(new Date());
    days.push({
      id: `day-${uuidv4()}`,
      date: today,
      label: new Date(today + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      arenas: (formData.arenas || [])
        .filter(a => a.name.trim() !== '' && (!a.dates || a.dates.length === 0 || a.dates.includes(today)))
        .map(arena => ({ id: arena.id, name: arena.name, items: [] })),
    });
  }

  // If no arenas, add a default one
  if (days[0].arenas.length === 0) {
    const defaultArena = { id: `arena-${uuidv4()}`, name: 'Main Arena', items: [] };
    days.forEach(day => { day.arenas = [{ ...defaultArena, items: [] }]; });
  }

  // Classes start unplaced — users drag them from the palette into arenas

  const result = {
    header: {
      showName: formData.showName || '',
      dates: formData.startDate && formData.endDate
        ? `${new Date(formData.startDate + 'T00:00:00').toLocaleDateString()} - ${new Date(formData.endDate + 'T00:00:00').toLocaleDateString()}`
        : '',
      venue: formData.venueAddress || '',
      judges: extractJudgeNames(formData),
      customText: '',
    },
    days,
    nextClassNumber: 10001,
    settings: {
      showNumbers: true,
      showAssociations: true,
      numberingMode: 'global',
    },
    closedArenas: {},
  };

  return renumberShowBill(result);
}

// Create a new show bill item
export function createShowBillItem(type, overrides = {}) {
  const defaults = {
    classBox: { type: 'classBox', id: uuidv4(), number: 0, title: '', classes: [] },
    break: { type: 'break', id: uuidv4(), title: 'Break', duration: '15 min' },
    drag: { type: 'drag', id: uuidv4(), title: 'Arena Drag' },
    sectionHeader: { type: 'sectionHeader', id: uuidv4(), title: 'Section Header' },
    custom: { type: 'custom', id: uuidv4(), title: 'Custom Event', content: '' },
  };
  return { ...(defaults[type] || defaults.custom), ...overrides };
}

// Renumber all classBox items sequentially (skips closed arenas)
export function renumberShowBill(showBill) {
  if (!showBill) return showBill;
  const mode = showBill.settings?.numberingMode || 'global';
  const startNumber = showBill.settings?.startClassNumber || 1;
  const closed = showBill.closedArenas || {};
  const newShowBill = JSON.parse(JSON.stringify(showBill));
  let globalCounter = startNumber;

  for (const day of newShowBill.days) {
    let dayCounter = startNumber;
    for (const arena of day.arenas) {
      if (closed[`${day.id}::${arena.id}`]) continue;
      let arenaCounter = startNumber;
      for (const item of arena.items) {
        if (item.type === 'classBox') {
          // Second Go items get parent number + 'A' suffix, skip normal numbering
          if (item.isSecondGo && item.parentNumber) {
            item.number = `${item.parentNumber}A`;
            continue;
          }
          const currentNumber = mode === 'global' ? globalCounter++
            : mode === 'per-day' ? dayCounter++
            : arenaCounter++;
          item.number = currentNumber;
          // Update any Second Go items that follow this parent
          // (handled in a second pass below)
        }
      }
    }
  }

  // Second pass: assign Second Go numbers based on their parent's actual number
  for (const day of newShowBill.days) {
    for (const arena of day.arenas) {
      if (closed[`${day.id}::${arena.id}`]) continue;
      for (const item of arena.items) {
        if (item.type === 'classBox' && item.isSecondGo && item.parentItemId) {
          // Find parent item's number
          const parentNum = findItemNumber(newShowBill, item.parentItemId);
          if (parentNum !== null) {
            item.number = `${parentNum}A`;
          }
        }
      }
    }
  }

  newShowBill.nextClassNumber = globalCounter;
  return newShowBill;
}

// Helper: find an item's number by its id
function findItemNumber(showBill, itemId) {
  for (const day of showBill.days) {
    for (const arena of day.arenas) {
      const item = arena.items.find(i => i.id === itemId);
      if (item) return item.number;
    }
  }
  return null;
}

// Find the arena containing an item
export function findItemLocation(showBill, itemId) {
  for (const day of showBill.days) {
    for (const arena of day.arenas) {
      const idx = arena.items.findIndex(i => i.id === itemId);
      if (idx !== -1) return { dayId: day.id, arenaId: arena.id, index: idx, item: arena.items[idx] };
    }
  }
  return null;
}

// Get the arena object by dayId and arenaId
function getArena(showBill, dayId, arenaId) {
  const day = showBill.days.find(d => d.id === dayId);
  if (!day) return null;
  return day.arenas.find(a => a.id === arenaId);
}

// Insert item at index
export function insertItemAtIndex(showBill, dayId, arenaId, index, newItem) {
  const sb = JSON.parse(JSON.stringify(showBill));
  const arena = getArena(sb, dayId, arenaId);
  if (!arena) return showBill;
  arena.items.splice(index, 0, newItem);
  return renumberShowBill(sb);
}

// Append item at end of arena
export function appendItem(showBill, dayId, arenaId, newItem) {
  const sb = JSON.parse(JSON.stringify(showBill));
  const arena = getArena(sb, dayId, arenaId);
  if (!arena) return showBill;
  arena.items.push(newItem);
  return renumberShowBill(sb);
}

// Remove an item
export function removeItem(showBill, dayId, arenaId, itemId) {
  const sb = JSON.parse(JSON.stringify(showBill));
  const arena = getArena(sb, dayId, arenaId);
  if (!arena) return showBill;
  arena.items = arena.items.filter(i => i.id !== itemId);
  return renumberShowBill(sb);
}

// Move item within same arena (reorder)
export function reorderItem(showBill, dayId, arenaId, oldIndex, newIndex) {
  const sb = JSON.parse(JSON.stringify(showBill));
  const arena = getArena(sb, dayId, arenaId);
  if (!arena) return showBill;
  const [moved] = arena.items.splice(oldIndex, 1);
  arena.items.splice(newIndex, 0, moved);
  return renumberShowBill(sb);
}

// Move item between arenas
export function moveItemBetweenArenas(showBill, srcDayId, srcArenaId, srcIndex, destDayId, destArenaId, destIndex) {
  const sb = JSON.parse(JSON.stringify(showBill));
  const srcArena = getArena(sb, srcDayId, srcArenaId);
  const destArena = getArena(sb, destDayId, destArenaId);
  if (!srcArena || !destArena) return showBill;
  const [moved] = srcArena.items.splice(srcIndex, 1);
  destArena.items.splice(destIndex, 0, moved);
  return renumberShowBill(sb);
}

// Add a class to an existing classBox
export function addClassToBox(showBill, dayId, arenaId, itemId, classId) {
  const sb = JSON.parse(JSON.stringify(showBill));
  const arena = getArena(sb, dayId, arenaId);
  if (!arena) return showBill;
  const item = arena.items.find(i => i.id === itemId);
  if (!item || item.type !== 'classBox') return showBill;
  if (!item.classes.includes(classId)) item.classes.push(classId);
  return sb;
}

// Remove a class from a classBox
export function removeClassFromBox(showBill, dayId, arenaId, itemId, classId) {
  const sb = JSON.parse(JSON.stringify(showBill));
  const arena = getArena(sb, dayId, arenaId);
  if (!arena) return showBill;
  const item = arena.items.find(i => i.id === itemId);
  if (!item || item.type !== 'classBox') return showBill;
  item.classes = item.classes.filter(id => id !== classId);
  return sb;
}

// Update a field on an item
export function updateItemField(showBill, dayId, arenaId, itemId, field, value) {
  const sb = JSON.parse(JSON.stringify(showBill));
  const arena = getArena(sb, dayId, arenaId);
  if (!arena) return showBill;
  const item = arena.items.find(i => i.id === itemId);
  if (!item) return showBill;
  item[field] = value;
  return sb;
}

// Update the show bill header
export function updateHeader(showBill, field, value) {
  const sb = JSON.parse(JSON.stringify(showBill));
  sb.header[field] = value;
  return sb;
}
