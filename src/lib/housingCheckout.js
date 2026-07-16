import { supabase } from '@/lib/supabaseClient';

// Kick off Stripe checkout for a housing/stall booking and redirect the browser to
// the hosted payment page. Works for a guest (no login) — the edge function prices
// the booking server-side (outstanding balance) so the amount can't be tampered with.
//
// Used by the public booking page (pay at booking) and the admin "charge the
// difference" action. Returns nothing on success (it redirects); throws on error.
//
// @param {object} args
// @param {string} args.showId        projects.id of the show
// @param {string} args.bookingId     booking.id inside stallingService.bookings
// @param {string} [args.customerEmail] prefill the Stripe email field
// @param {string} [args.successUrl]  where Stripe returns on success (default: this page)
// @param {string} [args.cancelUrl]   where Stripe returns on cancel (default: this page)
export async function startStallCheckout({ showId, bookingId, customerEmail, successUrl, cancelUrl }) {
    if (!showId || !bookingId) throw new Error('Missing showId or bookingId');

    const here = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
    const { data, error } = await supabase.functions.invoke('stalls-create-checkout', {
        body: {
            showId,
            bookingId,
            customerEmail: customerEmail || undefined,
            successUrl: successUrl || here,
            cancelUrl: cancelUrl || here,
        },
    });

    if (error) throw new Error(error.message || 'Could not start checkout');
    if (data?.error) throw new Error(data.error);
    if (!data?.url) throw new Error('No checkout URL returned');

    window.location.href = data.url;
}

// Create + email a Stripe hosted invoice for a booking's outstanding balance
// (the "invoice after confirmation" flow). Admin action. Returns
// { hostedInvoiceUrl, amount, email }; throws on error. When the exhibitor pays
// the invoice, the stripe-webhook (invoice.paid) marks the booking paid.
export async function sendStallInvoice({ showId, bookingId }) {
    if (!showId || !bookingId) throw new Error('Missing showId or bookingId');

    const { data, error } = await supabase.functions.invoke('stalls-create-invoice', {
        body: { showId, bookingId },
    });

    if (error) throw new Error(error.message || 'Could not create invoice');
    if (data?.error) throw new Error(data.error);
    return data; // { invoiceId, hostedInvoiceUrl, amount, email }
}
