import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  ArrowRightLeft, DollarSign, Users, Wallet, Loader2, Search, Download,
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';

// EquiPatterns' cut of every online stall/RV payment — matches PLATFORM_COMMISSION_RATE
// in stalls-create-checkout / stalls-create-invoice and PLATFORM_FEE_RATE in
// MasterListPanel.jsx. Kept as its own constant here (same duplication pattern the
// edge functions already use) since there's no shared module these can all import from.
const PLATFORM_FEE_RATE = 0.05;

const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_BADGE = {
  paid: 'bg-emerald-600',
  partial: 'bg-amber-500',
  unpaid: 'bg-gray-400',
};

const PAGE_SIZE = 20;

// Flatten every show's bookings into one row per booking, tagged with its show
// and organizer. Mirrors the per-show math in MasterListPanel.jsx (money actually
// received only — never the price owed on a still-unpaid booking).
function buildRows(projects, profileMap) {
  const rows = [];
  for (const project of projects) {
    const bookings = project.project_data?.stallingService?.bookings || [];
    const organizer = profileMap[project.user_id] || null;
    for (const booking of bookings) {
      if (!booking) continue;
      const amount = Number(booking.totalAmount ?? booking.amount ?? 0);
      const paymentStatus = booking.paymentStatus || 'unpaid';
      const paidAmount = paymentStatus === 'paid' ? (Number(booking.paidAmount) || amount)
        : paymentStatus === 'partial' ? (Number(booking.paidAmount) || 0)
        : 0;
      const platformFee = paidAmount * PLATFORM_FEE_RATE;
      const organizerAmount = paidAmount - platformFee;
      rows.push({
        id: booking.id,
        showId: project.id,
        showName: project.project_name || 'Untitled Show',
        organizerId: project.user_id,
        organizerName: organizer?.full_name || 'Unknown organizer',
        connectEnabled: !!organizer?.stripe_connect_payouts_enabled,
        customerName: booking.exhibitorName || 'Unknown',
        email: booking.email || '',
        amount,
        paidAmount,
        paymentStatus,
        platformFee,
        organizerAmount,
        paidAt: booking.paidAt || null,
        createdAt: booking.createdAt || null,
      });
    }
  }
  return rows;
}

export default function AdminTransactionsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilter, setShowFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('paid');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: projects } = await supabase
        .from('projects')
        .select('id, project_name, user_id, project_data')
        .eq('project_type', 'show');

      const list = projects || [];
      const userIds = [...new Set(list.map(p => p.user_id).filter(Boolean))];

      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, stripe_connect_payouts_enabled')
          .in('id', userIds);
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
      }

      setRows(buildRows(list, profileMap));
      setLoading(false);
    }
    fetchData();
  }, []);

  const shows = useMemo(() => {
    const map = new Map();
    rows.forEach(r => map.set(r.showId, r.showName));
    return [...map.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q) {
        const hay = `${r.customerName} ${r.email} ${r.showName} ${r.organizerName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (showFilter !== 'all' && r.showId !== showFilter) return false;
      if (statusFilter !== 'all' && r.paymentStatus !== statusFilter) return false;
      return true;
    });
  }, [rows, search, showFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, showFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * PAGE_SIZE;
  const pagedRows = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const totals = useMemo(() => filtered.reduce((t, r) => ({
    amount: t.amount + r.amount,
    paidAmount: t.paidAmount + r.paidAmount,
    platformFee: t.platformFee + r.platformFee,
    organizerAmount: t.organizerAmount + r.organizerAmount,
  }), { amount: 0, paidAmount: 0, platformFee: 0, organizerAmount: 0 }), [filtered]);

  const exportExcel = () => {
    const rowsOut = filtered.map(r => ({
      Customer: r.customerName,
      Email: r.email,
      Show: r.showName,
      Organizer: r.organizerName,
      'Amount Owed': r.amount,
      'Amount Paid': r.paidAmount,
      'Payment Status': r.paymentStatus,
      'Organizer Gets (95%)': r.organizerAmount,
      'Platform Fee (5%)': r.platformFee,
      'Payouts Connected': r.connectEnabled ? 'Yes' : 'No',
      'Paid At': r.paidAt ? new Date(r.paidAt).toLocaleString() : '',
    }));
    rowsOut.push({
      Customer: 'TOTAL', Email: '', Show: '', Organizer: '',
      'Amount Owed': totals.amount, 'Amount Paid': totals.paidAmount, 'Payment Status': '',
      'Organizer Gets (95%)': totals.organizerAmount, 'Platform Fee (5%)': totals.platformFee,
      'Payouts Connected': '', 'Paid At': '',
    });
    const ws = XLSX.utils.json_to_sheet(rowsOut);
    ws['!cols'] = [
      { wch: 20 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 12 },
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `equipatterns_transactions_${stamp}.xlsx`);
  };

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
        <title>Transactions - Admin - EquiPatterns</title>
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
            <div className="flex items-start justify-between">
              <AdminBackButton />
              <div className="text-center flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">Transactions</h1>
                <p className="text-sm text-muted-foreground">
                  Every stall/RV payment across every show, in one place.
                </p>
              </div>
              <div className="w-[70px]" />
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2 rounded-lg">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{fmtMoney(totals.paidAmount)}</p>
                      <p className="text-sm text-muted-foreground">Collected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-lg">
                      <Wallet className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{fmtMoney(totals.organizerAmount)}</p>
                      <p className="text-sm text-muted-foreground">Organizers' Share (95%)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-500/10 p-2 rounded-lg">
                      <ArrowRightLeft className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{fmtMoney(totals.platformFee)}</p>
                      <p className="text-sm text-muted-foreground">Platform Fee (5%)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-500/10 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{filtered.length}</p>
                      <p className="text-sm text-muted-foreground">Transactions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search customer, email, show, organizer..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={showFilter} onValueChange={setShowFilter}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Show" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Shows</SelectItem>
                      {shows.map(([id, name]) => (
                        <SelectItem key={id} value={id}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={exportExcel} disabled={filtered.length === 0}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No transactions found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Show</TableHead>
                          <TableHead>Organizer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Organizer Gets</TableHead>
                          <TableHead>Platform Fee</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedRows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{r.customerName}</p>
                                <p className="text-xs text-muted-foreground">{r.email || '—'}</p>
                              </div>
                            </TableCell>
                            <TableCell>{r.showName}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {r.organizerName}
                                {!r.connectEnabled && (
                                  <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-600">no payout account</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{fmtMoney(r.amount)}</TableCell>
                            <TableCell className={r.paidAmount > 0 ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}>
                              {fmtMoney(r.paidAmount)}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${STATUS_BADGE[r.paymentStatus] || 'bg-gray-400'} capitalize`}>
                                {r.paymentStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>{fmtMoney(r.organizerAmount)}</TableCell>
                            <TableCell>{fmtMoney(r.platformFee)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filtered.length)} of {filtered.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {page} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    </>
  );
}
