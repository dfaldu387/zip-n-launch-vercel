import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { STRIPE_PRICES, getCheckoutMode } from '@/lib/stripeConfig';

export function useSubscription() {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [planChanges, setPlanChanges] = useState([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Derived state from profile (kept in sync by webhook)
  const isSubscribed = profile?.subscription_status === 'active';
  const subscriptionTier = profile?.subscription_tier;
  // Support count-based free pattern books: founding_insider gets 3/year, others get 1/year
  const freePatternBooksUsed = profile?.free_pattern_books_used ?? (profile?.free_pattern_book_used ? 1 : 0);
  const freePatternBookLimit = subscriptionTier === 'founding_insider' ? 3 : 1;
  const hasUsedFreePatternBook = freePatternBooksUsed >= freePatternBookLimit;

  const fetchSubscriptionData = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setPurchases([]);
      setLoading(false);
      return;
    }

    try {
      const [subResult, purchaseResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('purchases')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      setSubscription(subResult.data);
      setPurchases(purchaseResult.data || []);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  const createCheckoutSession = useCallback(async (priceKey, additionalMetadata = {}) => {
    if (!user) throw new Error('Must be logged in');

    setCheckoutLoading(true);
    try {
      const priceConfig = STRIPE_PRICES[priceKey];
      if (!priceConfig) throw new Error(`Unknown price key: ${priceKey}`);

      const mode = getCheckoutMode(priceKey);

      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        body: {
          priceId: priceConfig.priceId,
          mode,
          successUrl: `${window.location.origin}/success`,
          cancelUrl: `${window.location.origin}/pricing`,
          metadata: {
            tier: priceConfig.tier || '',
            product_type: priceKey,
            ...additionalMetadata,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      setCheckoutLoading(false);
      throw error;
    }
  }, [user]);

  const fetchInvoices = useCallback(async () => {
    if (!user) return [];

    const { data, error } = await supabase.functions.invoke('stripe-fetch-invoices', {
      body: {},
    });

    if (error) {
      console.error('Error fetching invoices:', error);
      throw new Error(error.message || 'Failed to fetch invoices');
    }

    if (data?.error) {
      console.error('Stripe invoice error:', data.error);
      throw new Error(data.error);
    }

    setInvoices(data?.invoices || []);
    return data?.invoices || [];
  }, [user]);

  const fetchPlanChanges = useCallback(async () => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('plan_changes')
      .select('*')
      .eq('user_id', user.id)
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Error fetching plan changes:', error);
      return [];
    }

    setPlanChanges(data || []);
    return data || [];
  }, [user]);

  const fetchSubscriptionHistory = useCallback(async () => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching subscription history:', error);
      return [];
    }

    setSubscriptionHistory(data || []);
    return data || [];
  }, [user]);

  const openBillingPortal = useCallback(async () => {
    if (!user) throw new Error('Must be logged in');

    const { data, error } = await supabase.functions.invoke('stripe-billing-portal', {
      body: {
        returnUrl: `${window.location.origin}/profile`,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    window.location.href = data.url;
  }, [user]);

  return {
    subscription,
    purchases,
    invoices,
    planChanges,
    subscriptionHistory,
    loading,
    checkoutLoading,
    isSubscribed,
    subscriptionTier,
    hasUsedFreePatternBook,
    freePatternBooksUsed,
    freePatternBookLimit,
    createCheckoutSession,
    openBillingPortal,
    fetchInvoices,
    fetchPlanChanges,
    fetchSubscriptionHistory,
    refetch: fetchSubscriptionData,
  };
}
