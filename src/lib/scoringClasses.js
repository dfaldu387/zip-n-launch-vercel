// Scoring Portal, Step 2: one row per class + judge for a show.
//
// Every row later becomes one score sheet on a judge's iPad:
//   discipline + association + division (+ go) + judge + date
//
// This follows the same rules as the Score Sheets tab (generateScoresheets in
// PatternBookDialogContent.jsx) but has no screen filters and no PDF lookups, so the
// portal gets a stable list. If a rule changes in one place, change it in both.
import { resolveDivisionDates } from '@/lib/divisionDates';
import { parseDivisionId } from '@/lib/showBillUtils';
import { forEachPatternSelection, getForcedAssocForDivision } from '@/lib/patternSelectionHelpers';

// "Amateur - Amateur (19 & Over)" -> "Amateur (19 & Over)"
const simplifyDivisionName = (name) => {
    if (!name) return '';
    const idx = name.indexOf(' - ');
    if (idx === -1) return name;
    return name.slice(idx + 3).trim() || name;
};

export const extractDivisionName = (div) => {
    if (typeof div === 'string') return simplifyDivisionName(div);
    const name = div?.name || div?.divisionName || div?.division || div?.title || '';
    if (typeof name === 'string' && name.trim()) return simplifyDivisionName(name.trim());
    if (typeof div?.id === 'string') {
        const cleaned = div.id.replace(/^custom-/i, '').trim();
        if (cleaned) return simplifyDivisionName(cleaned);
    }
    return '';
};

const isValidAssocKey = (k) => {
    const s = String(k || '').trim();
    return !!s && !/^\d+$/.test(s);
};

const upper = (v) => String(v).toUpperCase();

/** Every association a discipline belongs to (a dual-affiliated show expands to all). */
export const getDisciplineAssocIds = (discipline, projectData) => {
    const projectAssocIds = Object.keys(projectData?.associations || {})
        .filter((k) => projectData.associations[k])
        .map(upper);
    const ids = new Set();
    if (isValidAssocKey(discipline.association_id)) ids.add(upper(discipline.association_id));
    [discipline.selectedAssociations, Array.isArray(discipline.associations) ? null : discipline.associations]
        .forEach((obj) => {
            if (obj && typeof obj === 'object') {
                Object.keys(obj).forEach((k) => { if (obj[k] && isValidAssocKey(k)) ids.add(upper(k)); });
            }
        });
    if (ids.size <= 1 && projectAssocIds.length > 1) projectAssocIds.forEach((a) => ids.add(a));
    return [...ids];
};

/** { ASSOC: Set<judge name> } plus the list of every judge in the show. */
export const collectJudges = (projectData) => {
    const all = new Set();
    const byAssoc = {};
    const add = (name, assoc) => {
        const n = typeof name === 'string' ? name.trim() : '';
        if (!n) return;
        all.add(n);
        if (assoc) {
            const key = upper(assoc);
            if (!byAssoc[key]) byAssoc[key] = new Set();
            byAssoc[key].add(n);
        }
    };

    Object.entries(projectData?.associationJudges || {}).forEach(([assoc, data]) => {
        (data?.judges || []).forEach((j) => add(j?.name, assoc));
    });
    Object.entries(projectData?.showDetails?.judges || {}).forEach(([assoc, list]) => {
        (list || []).forEach((j) => add(j?.name, assoc));
    });
    (projectData?.officials || []).forEach((o) => { if (o?.role === 'judge') add(o?.name); });
    Object.values(projectData?.groupJudges || {}).forEach((groups) => {
        if (Array.isArray(groups)) groups.forEach((j) => add(j));
        else if (groups && typeof groups === 'object') {
            Object.values(groups).forEach((val) => {
                if (Array.isArray(val)) val.forEach((j) => add(j));
                else add(val);
            });
        }
    });
    Object.values(projectData?.patternSelections || {}).forEach((sels) => {
        forEachPatternSelection(sels, (_g, _a, sel) => {
            if (sel?.type === 'judgeAssigned') add(sel?.judgeName);
        });
    });

    return { all: [...all], byAssoc };
};

/**
 * @param {object} projectData  the pattern book / show project_data
 * @returns {Array<{ key, disciplineId, disciplineName, associationId, divisionName,
 *                   goNumber, judgeName, date }>}
 */
export function buildScoringClasses(projectData) {
    const disciplines = projectData?.disciplines || [];
    const patternSelections = projectData?.patternSelections || {};
    const { all: allJudges, byAssoc } = collectJudges(projectData);
    const rows = [];

    disciplines.forEach((discipline, dIdx) => {
        // Same rule as the Score Sheets tab: needs a score sheet or a chosen pattern.
        const hasExplicitScoresheet = discipline.scoresheet || discipline.pattern_type === 'scoresheet_only';
        const hasPatternSelections = !!(patternSelections[discipline.id] || patternSelections[dIdx]);
        if (!hasExplicitScoresheet && !hasPatternSelections) return;

        const disciplineName = (discipline.name || 'Unknown Discipline').trim();
        let assocIds = getDisciplineAssocIds(discipline, projectData);
        if (assocIds.length === 0) assocIds = [null];

        assocIds.forEach((associationId) => {
            const assocNorm = associationId ? upper(associationId) : null;

            // Divisions for THIS association, keyed by name + go (a two-go class is scored twice).
            const entries = new Map();
            (discipline.patternGroups || []).forEach((group) => {
                (group.divisions || []).forEach((div) => {
                    const name = extractDivisionName(div).trim();
                    if (!name) return;
                    const divAssoc = typeof div === 'object' && div
                        ? (div.assocId || div.association_id || div.association || '') : '';
                    if (assocNorm && divAssoc && upper(divAssoc) !== assocNorm) return;

                    const goNumber = (typeof div === 'object' && (div.goNumber === 1 || div.goNumber === 2))
                        ? div.goNumber : null;
                    const key = `${name}|${goNumber || 0}`;
                    if (!entries.has(key)) entries.set(key, { name, goNumber, dates: [] });
                    const entry = entries.get(key);
                    resolveDivisionDates(discipline, div).forEach((d) => {
                        if (!entry.dates.includes(d)) entry.dates.push(d);
                    });
                });
            });

            // Score-sheet-only classes (no patterns) cannot be grouped in Group Patterns, so they
            // have no patternGroups. Fall back to the divisions picked and dated in tabs 1-2.
            (discipline.divisionOrder || []).forEach((divId) => {
                const parsed = parseDivisionId(divId);
                const name = extractDivisionName(String(parsed.divisionName || divId).replace(/^custom-/i, '')).trim();
                if (!name) return;
                if (assocNorm && parsed.assocId && isValidAssocKey(parsed.assocId) && upper(parsed.assocId) !== assocNorm) return;
                if ([...entries.values()].some((e) => e.name === name)) return;
                const entry = { name, goNumber: null, dates: [] };
                resolveDivisionDates(discipline, { id: divId }).forEach((d) => { if (!entry.dates.includes(d)) entry.dates.push(d); });
                entries.set(`${name}|0`, entry);
            });

            // A class split into Go 1 / Go 2 must not also appear as a go-less third sheet.
            const goNames = new Set([...entries.values()].filter((e) => e.goNumber).map((e) => e.name));
            [...entries].forEach(([key, e]) => { if (!e.goNumber && goNames.has(e.name)) entries.delete(key); });

            // Judges for this association; fall back to every judge when none are mapped.
            let judges = allJudges;
            if (assocNorm && byAssoc[assocNorm]?.size > 0) judges = [...byAssoc[assocNorm]];
            const judgesList = judges.length > 0 ? judges : [''];

            entries.forEach((entry) => {
                const forced = getForcedAssocForDivision(entry.name);
                if (forced && assocNorm && forced !== assocNorm) return;
                const goSuffix = entry.goNumber ? `-go${entry.goNumber}` : '';
                judgesList.forEach((judgeName) => {
                    rows.push({
                        key: `${assocNorm || ''}-${disciplineName}-${entry.name}${goSuffix}-${judgeName}`,
                        disciplineId: discipline.id ?? null,
                        disciplineName,
                        associationId: assocNorm,
                        divisionName: entry.name,
                        goNumber: entry.goNumber,
                        judgeName,
                        date: entry.dates[0] || projectData?.startDate || null,
                    });
                });
            });
        });
    });

    return rows;
}

// Timed classes and Additional Performance classes have no pattern or score sheet, so the
// pattern book never lists them. They live in the SHOW (Schedule & Arena Setup), so read
// them from there: discipline_group 'timed' / 'additional', one row per division + judge.
export const EXTRA_CLASS_GROUPS = ['timed', 'additional'];

export function buildShowExtraScoringClasses(showData) {
    const disciplines = (showData?.disciplines || []).filter((d) => EXTRA_CLASS_GROUPS.includes(d.discipline_group));
    if (disciplines.length === 0) return [];
    const { all: allJudges, byAssoc } = collectJudges(showData);

    // Day each division was scheduled on (Schedule Layout), if it has been placed yet.
    const dayOf = {};
    (showData?.showBill?.days || []).forEach((day) => (day.arenas || []).forEach((arena) => (arena.items || []).forEach((item) => {
        if (item.type === 'classBox') (item.classes || []).forEach((id) => { if (!dayOf[id]) dayOf[id] = day.date; });
    })));

    const rows = [];
    disciplines.forEach((discipline) => {
        const disciplineName = (discipline.name || 'Unknown Discipline').trim();
        (discipline.divisionOrder || []).forEach((divisionId) => {
            const { assocId, divisionName } = parseDivisionId(divisionId);
            const name = extractDivisionName(String(divisionName || '').replace(/^custom-/i, '')) || disciplineName;
            const assocNorm = isValidAssocKey(assocId) ? upper(assocId) : (getDisciplineAssocIds(discipline, showData)[0] || null);
            let judges = allJudges;
            if (assocNorm && byAssoc[assocNorm]?.size > 0) judges = [...byAssoc[assocNorm]];
            (judges.length > 0 ? judges : ['']).forEach((judgeName) => {
                rows.push({
                    key: `${assocNorm || ''}-${disciplineName}-${name}-${judgeName}`,
                    disciplineId: discipline.id ?? null,
                    disciplineName,
                    associationId: assocNorm,
                    divisionName: name,
                    goNumber: null,
                    judgeName,
                    date: resolveDivisionDates(discipline, { id: divisionId })[0] || dayOf[divisionId] || showData?.startDate || null,
                    classGroup: discipline.discipline_group,
                });
            });
        });
    });
    return rows;
}
