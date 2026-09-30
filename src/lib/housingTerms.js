// Bump the version when the text changes and everyone is asked to approve again.
export const HOUSING_TERMS_VERSION = 'placeholder-1';

// Placeholder copy — the final legal text will replace these sections.
export const HOUSING_TERMS_SECTIONS = [
    {
        title: 'How Housing & Grounds works',
        body: 'Housing & Grounds Manager lets you sell stalls, RV spots and supplies for your show and take bookings and payments online. [Final text to come.]',
    },
    {
        title: 'Fees and payments',
        body: 'EquiPatterns takes a platform fee on bookings made through the system, and payments are processed by Stripe. [Final text to come.]',
    },
    {
        title: 'Liability',
        body: 'You are responsible for the accuracy of your barn layouts, prices, dates and policies, and for honoring the bookings you accept. [Final text to come.]',
    },
];

// A user must approve when they never did, or approved an older version.
export function needsHousingTerms(profile) {
    return !profile?.housing_terms_accepted_at || profile.housing_terms_version !== HOUSING_TERMS_VERSION;
}
