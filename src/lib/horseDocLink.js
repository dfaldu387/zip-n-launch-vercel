// The exhibitor's private upload link for horse health papers. The link itself is the
// credential: `${showId}:${bookingId}:${secret}` in base64url, where `secret` is
// project_data.horseDocSecrets[bookingId] (see
// supabase/migrations/20261119130000_horse_docs_public_upload.sql).

const toB64Url = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s) => {
    const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
};

export const newHorseDocSecret = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const buildHorseDocToken = (showId, bookingId, secret) => toB64Url(`${showId}:${bookingId}:${secret}`);

export const parseHorseDocToken = (token) => {
    try {
        const [showId, bookingId, secret] = fromB64Url(token).split(':');
        if (!showId || !bookingId || !secret) return null;
        return { showId, bookingId, secret };
    } catch {
        return null;
    }
};

export const buildHorseDocUrl = ({ origin, showId, bookingId, secret }) =>
    `${origin}/horse-docs/${buildHorseDocToken(showId, bookingId, secret)}`;
