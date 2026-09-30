import { MODULE_STATUS } from '@/lib/moduleStatusService';

// One past the organizer's highest plain-number show number (free-text numbers
// like "2024-001" are ignored). Same rule the Schedule Builder uses.
export function nextShowNumber(rows) {
    const highest = (rows || []).reduce((max, row) => {
        const raw = String(row?.project_data?.showNumber ?? '').trim();
        if (!/^\d+$/.test(raw)) return max;
        return Math.max(max, parseInt(raw, 10));
    }, 0);
    return highest + 1;
}

// What must be filled before a show can be created from the Housing page.
export function validateShowDetails(d) {
    const errors = {};
    if (!String(d?.showName || '').trim()) errors.showName = 'Show name is required';
    if (!d?.startDate) errors.startDate = 'Start date is required';
    if (!d?.endDate) errors.endDate = 'End date is required';
    if (d?.startDate && d?.endDate && d.endDate < d.startDate) errors.endDate = 'End date is before start date';
    return errors;
}

// The projects row for a show started from Housing & Grounds. Same shape the
// Schedule Builder writes, so the show can be opened there later.
export function buildNewShowRow({ details, userId, showNumber, id }) {
    const showName = String(details.showName).trim();
    return {
        id,
        project_name: showName,
        project_type: 'show',
        status: MODULE_STATUS.DRAFT,
        user_id: userId,
        project_data: {
            showName,
            showNumber,
            startDate: details.startDate,
            endDate: details.endDate,
            venueName: String(details.venueName || '').trim(),
            venueAddress: String(details.venueAddress || '').trim(),
            showStatus: MODULE_STATUS.DRAFT,
            createdFrom: 'housing',
        },
    };
}
