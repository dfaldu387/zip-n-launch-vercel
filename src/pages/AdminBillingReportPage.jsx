import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  Receipt, Users, DollarSign, CreditCard, Crown,
  Loader2, Search, ShoppingCart, ArrowRightLeft
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';

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

const productDisplayName = (type) => {
  const names = {
    pattern_book_basic: 'Pattern Book — Basic',
    pattern_book_full: 'Pattern Book — Full',
    membership_founding_insider: 'Founding Insider',
    membership_founding_member: 'Founding Member',
    membership_standard: 'Standard Member',
  };
  return names[type] || type || 'Other';
};

export default function AdminBillingReportPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('all');
  const [subTierFilter, setSubTierFilter] = useState('all');
  const [purchSearch, setPurchSearch] = useState('');
  const [purchTypeFilter, setPurchTypeFilter] = useState('all');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // Fetch subscriptions and purchases (no FK to profiles, so fetch separately)
      const [subResult, purchResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('purchases')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      const subs = subResult.data || [];
      const purchs = purchResult.data || [];

      // Collect unique user_ids to fetch profiles
      const userIds = [...new Set([
        ...subs.map(s => s.user_id),
        ...purchs.map(p => p.user_id),
      ].filter(Boolean))];

      // Fetch profiles for those users (email is in auth.users, not profiles)
      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, role, subscription_status, subscription_tier')
          .in('id', userIds);

        (profiles || []).forEach(p => {
          profileMap[p.id] = p;
        });
      }

      // Attach profile info to each record
      setSubscriptions(subs.map(s => ({ ...s, profile: profileMap[s.user_id] || null })));
      setPurchases(purchs.map(p => ({ ...p, profile: profileMap[p.user_id] || null })));
      setLoading(false);
    }
    fetchData();
  }, []);

  // Summary stats
  const stats = useMemo(() => {
    const activeSubs = subscriptions.filter(s => s.status === 'active');
    const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentPurchases = purchases.filter(p =>
      new Date(p.created_at) >= thirtyDaysAgo
    );
    const tierCounts = {
      founding_insider: activeSubs.filter(s => s.tier === 'founding_insider').length,
      founding_member: activeSubs.filter(s => s.tier === 'founding_member').length,
      standard: activeSubs.filter(s => s.tier === 'standard').length,
    };

    return {
      activeCount: activeSubs.length,
      totalRevenue,
      recentCount: recentPurchases.length,
      tierCounts,
    };
  }, [subscriptions, purchases]);

  // Filtered subscriptions
  const filteredSubs = useMemo(() => {
    return subscriptions.filter(sub => {
      const name = sub.profile?.full_name || '';
      const role = sub.profile?.role || '';
      const matchesSearch = !subSearch ||
        name.toLowerCase().includes(subSearch.toLowerCase()) ||
        role.toLowerCase().includes(subSearch.toLowerCase());
      const matchesStatus = subStatusFilter === 'all' || sub.status === subStatusFilter;
      const matchesTier = subTierFilter === 'all' || sub.tier === subTierFilter;
      return matchesSearch && matchesStatus && matchesTier;
    });
  }, [subscriptions, subSearch, subStatusFilter, subTierFilter]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const name = p.profile?.full_name || '';
      const role = p.profile?.role || '';
      const matchesSearch = !purchSearch ||
        name.toLowerCase().includes(purchSearch.toLowerCase()) ||
        role.toLowerCase().includes(purchSearch.toLowerCase());
      const matchesType = purchTypeFilter === 'all' || p.product_type === purchTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [purchases, purchSearch, purchTypeFilter]);

  // Unique product types for filter
  const productTypes = useMemo(() => {
    return [...new Set(purchases.map(p => p.product_type).filter(Boolean))];
  }, [purchases]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Billing & Revenue Report - Admin - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Page Header */}
            <div className="flex items-start justify-between">
              <AdminBackButton />
              <div className="text-center flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">Billing & Revenue Report</h1>
                <p className="text-sm text-muted-foreground">
                  View all subscriptions, purchases, and revenue across the platform.
                </p>
              </div>
              <div className="w-[70px]" />
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500/10 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.activeCount}</p>
                      <p className="text-sm text-muted-foreground">Active Subscribers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2 rounded-lg">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                      <p className="text-sm text-muted-foreground">Total Purchases</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-500/10 p-2 rounded-lg">
                      <Crown className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <div className="flex gap-2 text-sm">
                        <span title="Founding Insider">{stats.tierCounts.founding_insider} FI</span>
                        <span className="text-muted-foreground">|</span>
                        <span title="Founding Member">{stats.tierCounts.founding_member} FM</span>
                        <span className="text-muted-foreground">|</span>
                        <span title="Standard">{stats.tierCounts.standard} ST</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Active by Tier</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-500/10 p-2 rounded-lg">
                      <ShoppingCart className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.recentCount}</p>
                      <p className="text-sm text-muted-foreground">Purchases (30 days)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="subscriptions" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                <TabsTrigger value="subscriptions" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Subscriptions ({subscriptions.length})
                </TabsTrigger>
                <TabsTrigger value="purchases" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Purchases ({purchases.length})
                </TabsTrigger>
              </TabsList>

              {/* Subscriptions Tab */}
              <TabsContent value="subscriptions">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or role..."
                          value={subSearch}
                          onChange={(e) => setSubSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select value={subStatusFilter} onValueChange={setSubStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="trialing">Trialing</SelectItem>
                          <SelectItem value="canceled">Canceled</SelectItem>
                          <SelectItem value="past_due">Past Due</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={subTierFilter} onValueChange={setSubTierFilter}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Tier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tiers</SelectItem>
                          <SelectItem value="founding_insider">Founding Insider</SelectItem>
                          <SelectItem value="founding_member">Founding Member</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredSubs.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        No subscriptions found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Plan</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Period Start</TableHead>
                              <TableHead>Period End</TableHead>
                              <TableHead>Cancel</TableHead>
                              <TableHead>Updated</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredSubs.map((sub) => (
                              <TableRow key={sub.id || sub.stripe_subscription_id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{sub.profile?.full_name || 'Unknown'}</p>
                                    <p className="text-xs text-muted-foreground">{sub.profile?.role || '—'}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {tierDisplayName(sub.tier)}
                                </TableCell>
                                <TableCell>
                                  <Badge className={subStatusBadge(sub.status)}>
                                    {sub.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {sub.current_period_start
                                    ? new Date(sub.current_period_start).toLocaleDateString()
                                    : '—'}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {sub.current_period_end
                                    ? new Date(sub.current_period_end).toLocaleDateString()
                                    : '—'}
                                </TableCell>
                                <TableCell>
                                  {sub.cancel_at_period_end ? (
                                    <Badge variant="outline" className="text-red-500 border-red-500">Yes</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">No</span>
                                  )}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                  {sub.updated_at
                                    ? new Date(sub.updated_at).toLocaleDateString()
                                    : '—'}
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

              {/* Purchases Tab */}
              <TabsContent value="purchases">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or role..."
                          value={purchSearch}
                          onChange={(e) => setPurchSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select value={purchTypeFilter} onValueChange={setPurchTypeFilter}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Products</SelectItem>
                          {productTypes.map(type => (
                            <SelectItem key={type} value={type}>
                              {productDisplayName(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredPurchases.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        No purchases found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPurchases.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{p.profile?.full_name || 'Unknown'}</p>
                                    <p className="text-xs text-muted-foreground">{p.profile?.role || '—'}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {productDisplayName(p.product_type)}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatCurrency(p.amount_cents, p.currency)}
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-600">{p.status}</Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {new Date(p.created_at).toLocaleDateString()}
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
            </Tabs>
          </motion.div>
        </main>
      </div>
    </>
  );
}
