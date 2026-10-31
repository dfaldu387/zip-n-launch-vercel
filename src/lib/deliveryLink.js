// Delivery QR links — see supabase/migrations/20261031120000_delivery_qr_rpcs.sql.
// The link itself is the credential: `${showId}:${bookingId}:${secret}` in
// base64url, where `secret` is booking.deliverySecret, created the first time an
// order is printed on a Load Sheet. The QR also names the supply lines it covers
// (?items=a,b) so a scan only touches what is on that printed line.

export const newDeliverySecret = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};

const toB64Url = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s) => {
    const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
};

export const buildDeliveryToken = (showId, bookingId, secret) =>
    toB64Url(`${showId}:${bookingId}:${secret}`);

export const parseDeliveryToken = (token) => {
    try {
        const [showId, bookingId, secret] = fromB64Url(token).split(':');
        if (!showId || !bookingId || !secret) return null;
        return { showId, bookingId, secret };
    } catch {
        return null;
    }
};

export const buildDeliveryUrl = ({ origin, showId, bookingId, secret, itemRefIds = [] }) => {
    const items = itemRefIds.length ? `?items=${encodeURIComponent(itemRefIds.join(','))}` : '';
    return `${origin}/delivery/${buildDeliveryToken(showId, bookingId, secret)}${items}`;
};

export const parseItemsParam = (value) =>
    String(value || '').split(',').map(s => s.trim()).filter(Boolean);
