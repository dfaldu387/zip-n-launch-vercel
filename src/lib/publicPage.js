// Public event page settings (Robert's "Event Branding & Public Links").
//
// Saved as project_data.publicPage = { hidden: { venue: true, ... }, text: { showName: '...', ... } }
// The Housing editor writes it; the public Event page reads it. Nothing here
// changes the real show data — a hidden or edited item only affects what the
// public sees.

// Order = order shown in the editor.
export const PUBLIC_FIELDS = [
    { key: 'showName', label: 'Show name', editable: true },
    // Dates use two date pickers (publicPage.dates) instead of a text box — see DatesRow in the editor.
    { key: 'showDates', label: 'Show dates', editable: false },
    { key: 'showType', label: 'Show type', editable: true },
    { key: 'venueName', label: 'Venue name', editable: true },
    { key: 'venueAddress', label: 'Venue address', editable: true },
    { key: 'associations', label: 'Associations', editable: false },
    { key: 'disciplines', label: 'Disciplines', editable: false },
    { key: 'officials', label: 'Officials', editable: false },
    { key: 'judges', label: 'Judges', editable: false },
];

const asList = (v) => (Array.isArray(v) ? v : []);

// "Aug 14, 2026" from a date string; empty if it is not a real date.
export const formatShowDate = (value) => {
    if (!value) return '';
    // A plain "2026-09-17" must be read as that local day (not midnight UTC, which can show the day before).
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// "Aug 14, 2026 - Aug 15, 2026" for a show's start and end.
export const formatShowDateRange = (start, end) => {
    const s = formatShowDate(start);
    const e = formatShowDate(end);
    return s && e ? `${s} - ${e}` : (s || e);
};

// A Google Maps link for a venue (opens a search for the name + address).
export const mapsUrl = (...parts) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.filter(Boolean).join(', '))}`;

// The associations / disciplines the show really has.
export const realAssociations = (pd = {}) => (
    pd.associations && typeof pd.associations === 'object' && !Array.isArray(pd.associations)
        ? Object.keys(pd.associations).filter(k => pd.associations[k])
        : asList(pd.associations)
);
export const realDisciplines = (pd = {}) => asList(pd.disciplines).map(d => (typeof d === 'string' ? d : d?.name)).filter(Boolean);

// The list the public sees for associations / disciplines: the organizer's edited list
// if there is one, otherwise the real one.
export const publicList = (pd, key, real) => {
    const edited = pd?.publicPage?.lists?.[key];
    return Array.isArray(edited) ? edited : real;
};

// What the show details say today (the "auto" value for each field), as text.
export function getAutoValues(pd = {}) {
    const associations = realAssociations(pd);
    const disciplines = realDisciplines(pd);
    const officials = Array.isArray(pd.officials)
        ? pd.officials.map(o => (typeof o === 'string' ? o : `${o?.role || o?.roleId || 'Official'}${o?.name ? ': ' + o.name : ''}`))
        : [];
    const judges = [];
    Object.values(pd.associationJudges || {}).forEach(data => {
        asList(data?.judges).forEach(j => { if (j?.name?.trim()) judges.push(j.name.trim()); });
    });
    return {
        showName: pd.showName || '',
        showDates: formatShowDateRange(pd.startDate || pd.showDetails?.general?.startDate, pd.endDate || pd.showDetails?.general?.endDate),
        showType: pd.showType || '',
        venueName: pd.venueName || '',
        venueAddress: pd.venueAddress || '',
        associations: associations.join(', '),
        disciplines: disciplines.length ? `${disciplines.length} selected` : '',
        officials: officials.join(', '),
        judges: [...new Set(judges)].join(', '),
    };
}

// ── Contacts and sponsor hotel (typed in by the organizer, shown on the public pages) ──
export const CONTACT_ROLES = [
    { key: 'housing', label: 'Stalling & Housing contact' },
    { key: 'manager', label: 'Show Manager' },
    { key: 'secretary', label: 'Show Secretary' },
];
export const CONTACT_FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
];
export const HOTEL_FIELDS = [
    { key: 'name', label: 'Hotel name' },
    { key: 'address', label: 'Address' },
    { key: 'phone', label: 'Phone' },
    { key: 'website', label: 'Website link' },
];

// Manager / secretary fall back to what was typed in Show Details.
const autoContact = (role, general = {}) => {
    if (role === 'manager') return { name: general.managerName, email: general.managerContactEmail, phone: general.managerPhone };
    if (role === 'secretary') return { name: general.secretaryName, email: general.secretaryContactEmail, phone: general.secretaryPhone };
    return {};
};

export function resolveContacts(pp, general = {}) {
    return CONTACT_ROLES.map(r => {
        const own = pp?.contacts?.[r.key] || {};
        const auto = autoContact(r.key, general);
        const values = {
            name: own.name || auto.name || '',
            phone: own.phone || auto.phone || '',
            email: own.email || auto.email || '',
        };
        return {
            ...r,
            ...values,
            auto,
            hidden: !!pp?.hidden?.[`contact_${r.key}`],
            hasData: !!(values.name || values.phone || values.email),
        };
    });
}

export const publicContacts = (pp, general) => resolveContacts(pp, general).filter(c => c.hasData && !c.hidden);

export const publicHotel = (pp) => {
    const h = pp?.hotel || {};
    if (pp?.hidden?.hotel) return null;
    return (h.name || h.address || h.phone || h.website) ? h : null;
};

// Event logo and welcome message shown at the top of the public pages.
export const WELCOME_MAX = 600;
export const publicLogo = (pp) => (pp?.hidden?.logo ? '' : (pp?.logoUrl || ''));
export const publicWelcome = (pp) => (pp?.hidden?.welcome ? '' : (typeof pp?.welcome === 'string' ? pp.welcome.trim() : ''));

// Show documents (show bill, schedule…) the organizer uploaded for the public.
export const publicDocuments = (pp) => {
    if (pp?.hidden?.documents) return [];
    return (Array.isArray(pp?.documents) ? pp.documents : []).filter(d => d?.url);
};

// Make a typed website usable as a link.
export const websiteHref = (url = '') => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

export const isHiddenOnPublicPage =(pd, key) => !!pd?.publicPage?.hidden?.[key];

// The text the public should see for a single-value field: the edited text if
// there is one, otherwise the real value.
export const publicText = (pd, key, fallback) => {
    const edited = pd?.publicPage?.text?.[key];
    return typeof edited === 'string' && edited.trim() ? edited : fallback;
};
