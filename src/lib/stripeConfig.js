// Maps internal tier names to Stripe Price IDs
// Toggle between live and test IDs by commenting/uncommenting the appropriate block

// --- TEST MODE IDs ---
const USE_TEST_MODE = false; // Set to true for test mode, false for live

const TEST_IDS = {
  founding_insider:          { priceId: 'price_1TB7Cu1uq10j2UsKdRtkz6aL', productId: 'prod_U9Q3Z3cu4TgPga' },
  standard:                  { priceId: 'price_1TB7Cx1uq10j2UsKXxEQdueR', productId: 'prod_U9Q3xxhP1GGGlQ' },
  pattern_book_basic:        { priceId: 'price_1TB7Cy1uq10j2UsKlt7BfiIb', productId: 'prod_U9Q31YxRsp7FjG' },
  pattern_book_full:         { priceId: 'price_1TB7Cy1uq10j2UsKlt7BfiIb', productId: 'prod_U9Q31YxRsp7FjG' }, // TODO: create separate test product
  horse_show_basic:          { priceId: 'price_1TB7Cy1uq10j2UsKs8b4vz2T', productId: 'prod_U9Q3Xv8LbcoPOT' }, // TODO: create separate test product
  horse_show_association:    { priceId: 'price_1TB7Cy1uq10j2UsKs8b4vz2T', productId: 'prod_U9Q3Xv8LbcoPOT' }, // TODO: create separate test product
};

const LIVE_IDS = {
  founding_insider:          { priceId: 'price_1TB8U31uq10j2UsKFMe9qF8q' },
  standard:                  { priceId: 'price_1TAm111uq10j2UsKkNUE2QLy' },
  pattern_book_basic:        { priceId: 'price_1TB8XG1uq10j2UsKyT6gKr8R' },
  pattern_book_full:         { priceId: 'price_1TB8Xx1uq10j2UsKNMvrqWQ2' },
  horse_show_basic:          { priceId: 'price_1TB8ZL1uq10j2UsKQTG4RqeN' },
  horse_show_association:    { priceId: 'price_1TB8a91uq10j2UsKAfkMHjV0' },
};

const IDS = USE_TEST_MODE ? TEST_IDS : LIVE_IDS;

export const STRIPE_PRICES = {
  // Memberships (yearly recurring)
  membership_founding_insider: {
    priceId: IDS.founding_insider.priceId,
    name: 'Founding Insider',
    description: 'Limited to first 50 members — $59 first year, then $79/year',
    amount: 5900,
    interval: 'year',
    tier: 'founding_insider',
    limit: 50,
  },
  membership_standard: {
    priceId: IDS.standard.priceId,
    name: 'Standard Member',
    description: '$99.99/year — Unlimited access to patterns and Horse Show tools',
    amount: 9999,
    interval: 'year',
    tier: 'standard',
    limit: null,
  },

  // Pattern Books (one-time per show)
  pattern_book_basic: {
    priceId: IDS.pattern_book_basic.priceId,
    name: 'Pattern Book — 4-H/Open',
    description: 'Essential pattern book creation tools — $39 per show',
    amount: 3900,
    interval: null,
  },
  pattern_book_full: {
    priceId: IDS.pattern_book_full.priceId,
    name: 'Pattern Book — Association Based',
    description: 'Complete pattern book with all features — $79 per show',
    amount: 7900,
    interval: null,
  },

  // Horse Show Manager (one-time per show)
  horse_show_manager_basic: {
    priceId: IDS.horse_show_basic.priceId,
    name: 'Horse Show Manager — 4-H/Open',
    description: '4-H/Open / Single Judge — $99 per show',
    amount: 9900,
    interval: null,
  },
  horse_show_manager_full: {
    priceId: IDS.horse_show_association.priceId,
    name: 'Horse Show Manager — Association Based',
    description: 'Association Based Patterns and Score Sheets — $149 per show',
    amount: 14900,
    interval: null,
  },

  // Pattern Upload Submission
  pattern_upload_submission: {
    priceId: 'price_PLACEHOLDER_pattern_upload', // TODO: Replace with real Stripe Price ID
    name: 'Pattern Upload — Submission Fee',
    description: 'One-time fee for submitting a custom pattern set',
    amount: 1999,
    interval: null,
  },
};

// Returns the checkout mode for Stripe ('payment' for one-time, 'subscription' for recurring)
export function getCheckoutMode(priceKey) {
  const config = STRIPE_PRICES[priceKey];
  if (!config) return null;
  return config.interval ? 'subscription' : 'payment';
}
