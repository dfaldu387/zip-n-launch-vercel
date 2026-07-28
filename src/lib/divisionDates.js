/**
 * Two-go-aware division date resolution.
 *
 * `discipline.divisionDates` is keyed by the BASE division id and only ever holds
 * the Go 1 date (useShowBuilder auto-heals it from `divisionGos[baseId].go1Date`).
 * Divisions inside a grouped two-go class carry ids like `${baseId}-go1` /
 * `${baseId}-go2`, which are NOT keys in that map — so a naive
 * `divisionDates[div.id]` lookup returns undefined for Go 2 and silently falls
 * back to the show start date. That is why Go 2 classes showed the wrong day and
 * why filtering by date returned nothing.
 *
 * Every consumer (portal cards, score sheets, pattern book, print tag) must go
 * through these helpers so the date on screen is the date in the filter and the
 * date on the printed sheet.
 */

/** Division entries can be plain id strings or objects. */
export const getDivisionId = (div) =>
    typeof div === 'string' ? div : (div?.id ?? div?.division ?? null);

/**
 * The competition date for one division, honouring its Go number.
 * Returns null when the division has no scheduled date.
 */
export const resolveDivisionDate = (discipline, div) => {
    const divId = getDivisionId(div);
    const baseId = (typeof div === 'object' && div?.baseId) || divId;
    const goInfo = discipline?.divisionGos?.[baseId];
    if (goInfo) {
        if (div?.goNumber === 2) return goInfo.go2Date || null;
        if (div?.goNumber === 1) return goInfo.go1Date || null;
        return goInfo.go1Date || discipline?.divisionDates?.[divId] || null;
    }
    return discipline?.divisionDates?.[divId] || null;
};

/**
 * Every distinct date a division runs on. A division that is not split into
 * grouped Go 1 / Go 2 entries still carries both dates on `divisionGos`, so a
 * date filter must match either one.
 */
export const resolveDivisionDates = (discipline, div) => {
    const divId = getDivisionId(div);
    const baseId = (typeof div === 'object' && div?.baseId) || divId;
    const goInfo = discipline?.divisionGos?.[baseId];
    const dates = [];
    const add = (d) => { if (d && !dates.includes(d)) dates.push(d); };

    if (goInfo && typeof div === 'object' && (div?.goNumber === 1 || div?.goNumber === 2)) {
        // Grouped entry — it represents exactly one go.
        add(div.goNumber === 2 ? goInfo.go2Date : goInfo.go1Date);
        return dates;
    }
    if (goInfo) {
        add(goInfo.go1Date);
        add(goInfo.go2Date);
    }
    add(discipline?.divisionDates?.[divId]);
    return dates;
};

/** First non-empty division date in a pattern group. */
export const resolveGroupDate = (discipline, group) => {
    for (const div of (group?.divisions || [])) {
        const date = resolveDivisionDate(discipline, div);
        if (date) return date;
    }
    return null;
};

/**
 * Dates that actually have something scheduled, across the whole show.
 *
 * Used to build the Dates filter. Listing every day between start and end
 * padded the dropdown with days that hold no classes, so picking one returned
 * an empty list — the "dates don't pull up" complaint. `startDate` is included
 * only when some division or group has no date of its own and will therefore
 * fall back to it.
 */
export const collectScheduledDates = (projectData) => {
    const dates = new Set();
    let needsStartDateFallback = false;

    (projectData?.disciplines || []).forEach((discipline) => {
        Object.values(discipline?.divisionDates || {}).forEach((d) => { if (d) dates.add(d); });
        Object.values(discipline?.divisionGos || {}).forEach((go) => {
            if (go?.go1Date) dates.add(go.go1Date);
            if (go?.go2Date) dates.add(go.go2Date);
        });
        (discipline?.patternGroups || []).forEach((group) => {
            const hasDate = (group?.divisions || []).some((div) => resolveDivisionDate(discipline, div));
            if (!hasDate) needsStartDateFallback = true;
        });
    });

    Object.values(projectData?.groupDueDates || {}).forEach((byGroup) => {
        Object.values(byGroup || {}).forEach((d) => { if (d) dates.add(d); });
    });

    if (needsStartDateFallback && projectData?.startDate) dates.add(projectData.startDate);

    return [...dates].sort();
};
