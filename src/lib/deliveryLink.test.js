import { describe, it, expect } from 'vitest';
import { buildDeliveryToken, parseDeliveryToken, buildDeliveryUrl, parseItemsParam, newDeliverySecret } from './deliveryLink';

describe('delivery QR link', () => {
    const showId = '21bb29b5-9e3c-4c0f-8508-0e0db7b015a6';
    const bookingId = '8ec7729e-1111-4222-8333-444455556666';

    it('round-trips show, booking and secret through the token', () => {
        const secret = newDeliverySecret();
        expect(secret).toMatch(/^[0-9a-f]{32}$/);
        expect(parseDeliveryToken(buildDeliveryToken(showId, bookingId, secret))).toEqual({ showId, bookingId, secret });
    });

    it('rejects garbage and half-built tokens', () => {
        expect(parseDeliveryToken('not a token!!')).toBeNull();
        expect(parseDeliveryToken(buildDeliveryToken(showId, bookingId, ''))).toBeNull();
    });

    it('puts the supply lines on the URL and reads them back', () => {
        const url = buildDeliveryUrl({ origin: 'https://x.test', showId, bookingId, secret: 'abc', itemRefIds: ['hay-alfalfa', 'shav'] });
        expect(url.startsWith('https://x.test/delivery/')).toBe(true);
        expect(parseItemsParam(new URL(url).searchParams.get('items'))).toEqual(['hay-alfalfa', 'shav']);
    });
});
