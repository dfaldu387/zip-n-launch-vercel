import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { RefreshCcw, Loader2, ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useReconciliation } from '@/hooks/useReconciliation';

const statusConfig = {
  accounted: { label: 'Accounted', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
  ok: { label: 'OK', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
  missing: { label: 'Missing', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
  damaged: { label: 'Damaged', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: Wrench },
};

const ReconciliationPage = () => {
  const navigate = useNavigate();
  const {
    shows, isShowsLoading, selectedShow,
    items, isLoading, summaryStats,
    fetchUserShows, selectShow,
    markDamaged, resetShowTransactions,
  } = useReconciliation();

  useEffect(() => { fetchUserShows(); }, [fetchUserShows]);

  const handleShowChange = (showId) => {
    const show = shows.find(s => s.id === showId);
    selectShow(show || null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Helmet><title>Reconciliation - EquiPatterns</title></Helmet>
      <Navigation />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate('/horse-show-manager/equipment-planning')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Equipment Planning
          </Button>
        </div>

        <header className="mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <RefreshCcw className="h-9 w-9 text-primary" /> Reconciliation / Clean-Up
          </h1>
          <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
            Compare planned vs actual equipment usage. Identify missing and damaged items.
          </p>
        </header>

        {/* Show Selector */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Select Show</label>
                <Select
                  value={selectedShow?.id || ''}
                  onValueChange={handleShowChange}
                  disabled={isShowsLoading}
                >
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder={isShowsLoading ? 'Loading shows...' : 'Choose a show'} />
                  </SelectTrigger>
                  <SelectContent>
                    {shows.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedShow && items.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <RefreshCcw className="mr-2 h-4 w-4" /> Reset for Next Show
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset all transactions?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete ALL check-in, check-out, and transfer records for "{selectedShow.name}".
                        This action cannot be undone. Equipment conditions will not be changed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={resetShowTransactions} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Reset Transactions
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>

        {!selectedShow ? (
          <div className="text-center py-16 text-muted-foreground">
            <RefreshCcw className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Select a show to begin reconciliation.</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No distribution plan or transactions found for this show.</p>
            <p className="text-sm mt-1">Create a distribution plan and check in equipment first.</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-primary">{summaryStats.totalPlanned}</p>
                  <p className="text-sm text-muted-foreground">Total Planned</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">{summaryStats.totalAccountedFor}</p>
                  <p className="text-sm text-muted-foreground">Accounted For</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-red-600">{summaryStats.totalMissing}</p>
                  <p className="text-sm text-muted-foreground">Missing</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-orange-600">{summaryStats.totalDamaged}</p>
                  <p className="text-sm text-muted-foreground">Damaged Items</p>
                </CardContent>
              </Card>
            </div>

            {/* Reconciliation Table */}
            <Card>
              <CardHeader>
                <CardTitle>Equipment Reconciliation</CardTitle>
                <CardDescription>{items.length} equipment item{items.length !== 1 ? 's' : ''} tracked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-center">Planned</TableHead>
                        <TableHead className="text-center">Checked In</TableHead>
                        <TableHead className="text-center">Checked Out</TableHead>
                        <TableHead className="text-center">On Hand</TableHead>
                        <TableHead className="text-center">Missing</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => {
                        const cfg = statusConfig[item.status] || statusConfig.ok;
                        const StatusIcon = cfg.icon;
                        return (
                          <motion.tr
                            key={item.equipmentId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.02 }}
                            className="border-b border-border"
                          >
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-muted-foreground">{item.category}</TableCell>
                            <TableCell className="text-center">{item.plannedQty}</TableCell>
                            <TableCell className="text-center">{item.checkedIn}</TableCell>
                            <TableCell className="text-center">{item.checkedOut}</TableCell>
                            <TableCell className="text-center font-medium">{item.onHand}</TableCell>
                            <TableCell className="text-center">
                              {item.missing > 0 ? (
                                <span className="text-red-600 font-bold">{item.missing}</span>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`${cfg.color} gap-1`} variant="outline">
                                <StatusIcon className="h-3 w-3" />
                                {cfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.condition !== 'needs_repair' && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700">
                                      <Wrench className="mr-1 h-3 w-3" /> Mark Damaged
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Mark as damaged?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will set "{item.name}" condition to "Needs Repair" in your equipment inventory.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => markDamaged(item.equipmentId)}>
                                        Mark Damaged
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {item.condition === 'needs_repair' && (
                                <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                  <Wrench className="mr-1 h-3 w-3" /> Needs Repair
                                </Badge>
                              )}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default ReconciliationPage;
