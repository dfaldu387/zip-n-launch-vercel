// Breed-aware re-keying for patternSelections.
//
// Shape (new):  patternSelections[disciplineKey][groupKey][assocAbbrev] = value
// Shape (old):  patternSelections[disciplineKey][groupKey]              = value
//
// The helpers below treat the old shape as a wildcard (applies to every
// association) so legacy saved projects still render.

const ASSOC_ABBREV_RE = /^[A-Z]{2,6}$/;

const looksLikePatternInfo = (v) => {
  if (v == null) return false;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return true;
  if (typeof v === 'object') {
    return (
      'patternId' in v ||
      'pattern_id' in v ||
      'id' in v ||
      'patternName' in v ||
      'scoresheetData' in v ||
      'maneuversRange' in v ||
      'setNumber' in v ||
      'version' in v
    );
  }
  return false;
};

// Returns true if `entry` is an assoc-keyed map (new shape).
export const isAssocKeyedEntry = (entry) => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  const keys = Object.keys(entry);
  if (keys.length === 0) return false;
  // If any top-level key looks like pattern-info field, treat as legacy scalar/object.
  if (
    'patternId' in entry ||
    'pattern_id' in entry ||
    'id' in entry ||
    'patternName' in entry ||
    'scoresheetData' in entry ||
    'maneuversRange' in entry ||
    'setNumber' in entry
  ) {
    return false;
  }
  // All keys must match association abbreviation pattern.
  return keys.every((k) => ASSOC_ABBREV_RE.test(k)) &&
         keys.some((k) => looksLikePatternInfo(entry[k]));
};

// Read a pattern selection for a given association.
// - New shape: returns disciplineSelections[groupKey][assocAbbrev] (or null).
// - Old shape: returns disciplineSelections[groupKey] as-is (wildcard fallback).
export const getPatternSelectionForAssoc = (disciplineSelections, groupKey, assocAbbrev) => {
  if (!disciplineSelections || typeof disciplineSelections !== 'object') return null;
  const entry = disciplineSelections[groupKey];
  if (entry == null) return null;
  if (isAssocKeyedEntry(entry)) {
    const abbrev = assocAbbrev ? String(assocAbbrev).toUpperCase() : null;
    if (abbrev && entry[abbrev] != null) return entry[abbrev];
    // No match for this association under new shape — return null so callers
    // don't leak another association's selection.
    return null;
  }
  // Legacy shape — applies to every association.
  return entry;
};

// Write a pattern selection for a given association, preserving other
// associations' selections. If `assocAbbrev` is falsy, falls back to legacy
// (non-assoc-scoped) shape so single-association projects behave unchanged.
export const writePatternSelectionForAssoc = (disciplineSelections, groupKey, assocAbbrev, value) => {
  const next = { ...(disciplineSelections || {}) };
  const abbrev = assocAbbrev ? String(assocAbbrev).toUpperCase() : null;
  if (!abbrev) {
    next[groupKey] = value;
    return next;
  }
  const existing = next[groupKey];
  let bucket;
  if (isAssocKeyedEntry(existing)) {
    bucket = { ...existing };
  } else {
    bucket = {};
  }
  bucket[abbrev] = value;
  next[groupKey] = bucket;
  return next;
};

// Resolve a forced association for a division/level name. Certain divisions
// are always AQHA-governed regardless of how the class was tagged upstream:
//   - "Level 1" (any casing)
//   - "Open All Ages" / "Open All Aged"
//   - "Amateur" divisions (Amateur belongs to AQHA, not APHA)
// Returns the forced abbreviation (uppercase) or null when no rule matches.
export const getForcedAssocForDivision = (divisionName) => {
  if (!divisionName) return null;
  const s = String(divisionName).toLowerCase();
  if (/\b(level\s*1|level\s*one|l1)\b/.test(s)) return 'AQHA';
  if (/\bopen\s+(all\s+)?(age[sd]?|l1)\b/.test(s)) return 'AQHA';
  // Amateur divisions belong to AQHA in dual-affiliated shows.
  // Excludes APHA-specific divisions like "Novice Amateur" and "Green Horse".
  if (/\bamateur\b/i.test(s) && !/\bnovice\b/i.test(s) && !/\bgreen\b/i.test(s)) return 'AQHA';
  return null;
};

// Derive the unique set of association abbreviations a show actually uses.
// Scans three sources so the caller doesn't need to re-implement them:
//   1) projectData.associations  — object keyed by abbrev with truthy values
//   2) each discipline's association_id / selectedAssociations / associations
//   3) every division name through getForcedAssocForDivision
// Returns a sorted array of uppercase abbrevs (possibly empty).
export const detectShowAssociations = (projectData) => {
  const out = new Set();
  if (!projectData || typeof projectData !== 'object') return [];

  const assocs = projectData.associations || {};
  Object.keys(assocs).forEach((k) => {
    if (assocs[k]) out.add(String(k).toUpperCase());
  });

  const disciplines = Array.isArray(projectData.disciplines) ? projectData.disciplines : [];
  disciplines.forEach((d) => {
    if (!d) return;
    const raw = d.association_id
      || (d.selectedAssociations ? Object.keys(d.selectedAssociations).find((k) => d.selectedAssociations[k]) : null)
      || (d.associations ? Object.keys(d.associations).find((k) => d.associations[k]) : null);
    if (raw) out.add(String(raw).toUpperCase());

    const groups = Array.isArray(d.patternGroups) ? d.patternGroups : [];
    groups.forEach((g) => {
      const divs = Array.isArray(g?.divisions) ? g.divisions : [];
      divs.forEach((div) => {
        const name = typeof div === 'string'
          ? div
          : (div?.name || div?.divisionName || div?.division || div?.title || '');
        const forced = getForcedAssocForDivision(name);
        if (forced) out.add(forced);
      });
    });
  });

  return [...out].sort();
};

// Iterate every (groupKey, assocAbbrev, value) tuple in a discipline's
// selections, flattening both old and new shapes. `assocAbbrev` is null for
// legacy entries (treat as wildcard).
export const forEachPatternSelection = (disciplineSelections, fn) => {
  if (!disciplineSelections || typeof disciplineSelections !== 'object') return;
  Object.keys(disciplineSelections).forEach((groupKey) => {
    const entry = disciplineSelections[groupKey];
    if (entry == null) return;
    if (isAssocKeyedEntry(entry)) {
      Object.keys(entry).forEach((abbrev) => {
        fn(groupKey, abbrev, entry[abbrev]);
      });
    } else {
      fn(groupKey, null, entry);
    }
  });
};
