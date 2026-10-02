// One real show is often stored as two or three project rows — one built in Horse Show
// Manager (project_type 'show') and one or more from the Pattern Book Builder
// ('pattern_book'). Lists that read the projects table directly drew every row, so the
// same show showed up 2–3 times. This groups the rows that belong to the same show so a
// list can draw one line per show. Display only — nothing is merged in the database.
//
// Same rules as the Events page: (1) same name + dates is the same show; (2) an explicit
// link (pattern book -> its show) merges only when the dates match, so "duplicate for
// next year" (a link to a DIFFERENT year) never merges.

const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

const nameOf = (row) => row.project_name || row.project_data?.showName || '';

const identityKey = (row) => {
    const pd = row.project_data || {};
    return [norm(nameOf(row)), pd.startDate || '', pd.endDate || ''].join('|');
};

// Returns [{ primary, members }] in the same order as the input (first appearance of each
// group). `primary` is the Housing ('show') record when there is one, since that record
// drives the housing and booking pages; otherwise the first row.
// `preferType` picks which record stands for the group: 'show' for housing pages,
// 'pattern_book' where the pattern data is what matters. Among equals, the record
// holding the most data wins, so the fullest copy is the one used.
export function groupShowRecords(rows = [], { preferType = 'show' } = {}) {
    const parent = {};
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const union = (a, b) => { if (parent[a] !== undefined && parent[b] !== undefined) parent[find(a)] = find(b); };
    rows.forEach(r => { parent[r.id] = r.id; });

    const seen = {};
    rows.forEach(r => {
        const k = identityKey(r);
        if (seen[k]) union(r.id, seen[k]);
        else seen[k] = r.id;
    });

    // A record with no dates yet (a half-made leftover) joins the same-named show that has
    // dates — but only when exactly one dated show has that name, so two real dated shows
    // with one name (e.g. a fair held twice) never absorb it by guesswork.
    const hasDates = (r) => !!(r.project_data?.startDate || r.project_data?.endDate);
    const datedRootsByName = {};
    rows.filter(hasDates).forEach(r => {
        const n = norm(nameOf(r));
        (datedRootsByName[n] ||= new Set()).add(find(r.id));
    });
    rows.filter(r => !hasDates(r)).forEach(r => {
        const roots = datedRootsByName[norm(nameOf(r))];
        if (roots && roots.size === 1) union(r.id, [...roots][0]);
    });

    const byId = Object.fromEntries(rows.map(r => [r.id, r]));
    rows.forEach(r => {
        const pd = r.project_data || {};
        const target = pd.linkedProjectId && byId[pd.linkedProjectId];
        if (!target) return;
        const tpd = target.project_data || {};
        if ((pd.startDate || null) === (tpd.startDate || null) && (pd.endDate || null) === (tpd.endDate || null)) {
            union(r.id, target.id);
        }
    });

    const groups = new Map();
    rows.forEach(r => {
        const root = find(r.id);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(r);
    });

    const size = (r) => JSON.stringify(r.project_data || {}).length;
    const fullest = (list) => list.reduce((best, r) => (!best || size(r) > size(best) ? r : best), null);
    return [...groups.values()].map(members => {
        const typed = members.filter(m => m.project_type === preferType);
        return {
            primary: fullest(typed.filter(hasDates))
                || fullest(members.filter(hasDates))
                || fullest(typed)
                || members[0],
            members,
        };
    });
}
