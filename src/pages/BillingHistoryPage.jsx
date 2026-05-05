import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  Receipt, FileText, ArrowRightLeft, Download, ExternalLink,
  CreditCard, Crown, Loader2, AlertCircle, History
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/components/ui/use-toast';

const tierDisplayName = (tier) => {
  const names = {
    founding_insider: 'Founding Insider',
    founding_member: 'Founding Member',
    standard: 'Standard Member',
  };
  return names[tier] || tier || 'Unknown';
};

const formatCurrency = (amountCents, currency = 'usd') => {
  return (amountCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
};

const statusBadgeVariant = (status) => {
  switch (status) {
    case 'paid': return 'bg-green-600';
    case 'open': return 'bg-yellow-600';
    case 'draft': return 'bg-gray-500';
    case 'uncollectible': return 'bg-red-600';
    case 'void': return 'bg-gray-400';
    default: return 'bg-gray-500';
  }
};

const subStatusBadge = (status) => {
  switch (status) {
    case 'active': return 'bg-green-600';
    case 'trialing': return 'bg-blue-600';
    case 'canceled': return 'bg-red-600';
    case 'past_due': return 'bg-yellow-600';
    case 'incomplete': return 'bg-orange-500';
    default: return 'bg-gray-500';
  }
};

export default function BillingHistoryPage() {
  const { user, loading: authLoading, isSubscribed, subscriptionTier } = useAuth();
  const {
    subscription, invoices, planChanges, subscriptionHistory,
    openBillingPortal, fetchInvoices, fetchPlanChanges, fetchSubscriptionHistory
  } = useSubscription();
  const { toast } = useToast();

  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setInvoicesLoading(true);
      setInvoicesError(null);
      fetchInvoices()
        .catch((err) => setInvoicesError(err.message || 'Failed to load invoices'))
        .finally(() => setInvoicesLoading(false));

      setHistoryLoading(true);
      Promise.all([fetchPlanChanges(), fetchSubscriptionHistory()])
        .finally(() => setHistoryLoading(false));
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in Required</h2>
          <p className="text-muted-foreground">Please sign in to view your billing history.</p>
        </div>
      </div>
    );
  }

  const handleOpenBillingPortal = async () => {
    setBillingLoading(true);
    try {
      await openBillingPortal();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setBillingLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Billing & History - EquiPatterns</title>
        <meta name="description" content="View your invoices, download receipts, and track plan changes." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Page Header */}
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Receipt className="h-8 w-8" />
                Billing & History
              </h1>
              <p className="text-muted-foreground mt-1">
                View invoices, download receipts, and track plan changes.
              </p>
            </div>

            {/* Current Plan Card */}
            {isSubscribed ? (
              <Card className="bg-green-500/10 border-green-500/30">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Crown className="h-5 w-5 text-yellow-500" />
                        <p className="font-semibold text-lg">{tierDisplayName(subscriptionTier)}</p>
                        <Badge className="bg-green-600">Active</Badge>
                      </div>
                      {subscription?.current_period_end && (
                        <p className="text-sm text-muted-foreground">
                          Renews: {new Date(subscription.current_period_end).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={billingLoading}
                      onClick={handleOpenBillingPortal}
                    >
                      {billingLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                      )}
                      Manage Billing
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-muted/30">
                <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-medium">No active membership</p>
                    <p className="text-sm text-muted-foreground">Subscribe to unlock all features</p>
                  </div>
                  <Button variant="default" size="sm" asChild>
                    <Link to="/pricing">View Plans</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Tabs */}
            <Tabs defaultValue="invoices" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                <TabsTrigger value="invoices" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Invoices
                </TabsTrigger>
                <TabsTrigger value="plan-history" className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Plan History
                </TabsTrigger>
              </TabsList>

              {/* Invoices Tab */}
              <TabsContent value="invoices">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Invoice History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {invoicesLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading invoices...</span>
                      </div>
                    ) : invoicesError ? (
                      <div className="text-center py-10">
                        <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
                        <p className="text-destructive font-medium">Failed to load invoices</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Make sure the stripe-fetch-invoices edge function is deployed.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setInvoicesLoading(true);
                            setInvoicesError(null);
                            fetchInvoices()
                              .catch((err) => setInvoicesError(err.message))
                              .finally(() => setInvoicesLoading(false));
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : invoices.length === 0 ? (
                      <div className="text-center py-10">
                        <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No invoices found.</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Invoices will appear here after your first payment.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Invoice #</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoices.map((inv) => (
                              <TableRow key={inv.id}>
                                <TableCell className="whitespace-nowrap">
                                  {new Date(inv.created * 1000).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {inv.number || '—'}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatCurrency(inv.amount_paid, inv.currency)}
                                </TableCell>
                                <TableCell>
                                  <Badge className={statusBadgeVariant(inv.status)}>
                                    {inv.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {inv.invoice_pdf && (
                                      <Button variant="outline" size="sm" asChild>
                                        <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                          <Download className="mr-1 h-3 w-3" />
                                          PDF
                                        </a>
                                      </Button>
                                    )}
                                    {inv.hosted_invoice_url && (
                                      <Button variant="ghost" size="sm" asChild>
                                        <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="mr-1 h-3 w-3" />
                                          View
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Plan History Tab */}
              <TabsContent value="plan-history" className="space-y-6">
                {/* Subscription History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Subscription History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {historyLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading history...</span>
                      </div>
                    ) : subscriptionHistory.length === 0 ? (
                      <div className="text-center py-10">
                        <History className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No subscriptions found.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Plan</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Period Start</TableHead>
                              <TableHead>Period End</TableHead>
                              <TableHead>Cancel at End</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {subscriptionHistory.map((sub) => (
                              <TableRow key={sub.id || sub.stripe_subscription_id}>
                                <TableCell className="font-medium">
                                  {tierDisplayName(sub.tier)}
                                </TableCell>
                                <TableCell>
                                  <Badge className={subStatusBadge(sub.status)}>
                                    {sub.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {sub.current_period_start
                                    ? new Date(sub.current_period_start).toLocaleDateString()
                                    : '—'}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {sub.current_period_end
                                    ? new Date(sub.current_period_end).toLocaleDateString()
                                    : '—'}
                                </TableCell>
                                <TableCell>
                                  {sub.cancel_at_period_end ? (
                                    <Badge variant="outline" className="text-red-500 border-red-500">Yes</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">No</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Plan Changes */}
                {planChanges.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5" />
                        Plan Upgrades / Downgrades
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Previous Plan</TableHead>
                              <TableHead></TableHead>
                              <TableHead>New Plan</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {planChanges.map((change) => (
                              <TableRow key={change.id}>
                                <TableCell className="whitespace-nowrap">
                                  {new Date(change.changed_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{tierDisplayName(change.old_tier)}</Badge>
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground">→</TableCell>
                                <TableCell>
                                  <Badge className="bg-primary">{tierDisplayName(change.new_tier)}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </main>
      </div>
    </>
  );
}
