import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ClipboardCheck, Loader2, ArrowLeft, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Package, MapPin, History, Trash2, Printer } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useEquipmentCheckInOut } from '@/hooks/useEquipmentCheckInOut';
import { generateArenaKitListPdf } from '@/lib/arenaKitListPdfGenerator';

// ---- Check In Tab ----
const CheckInTab = ({ distributionPlan, arenaState, globalState, inventory, onCheckIn, isSaving }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  const openDialog = (planItem) => {
    const eqId = planItem.equipment_id;
    const remaining = (planItem.planned_qty || 0) - (arenaState[eqId]?.checkedIn || 0);
    setSelectedItem(planItem);
    setQty(Math.max(1, remaining));
    setNotes('');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedItem) return;
    await onCheckIn({ equipmentId: selectedItem.equipment_id, quantity: qty, notes });
    setDialogOpen(false);
  };

  if (distributionPlan.length === 0) {
    return (
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
        <CardContent className="flex items-center gap-4 py-6">
          <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200">No Distribution Plan</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">Generate a distribution plan first to see what equipment is expected at this arena.</p>
            <Link to="/horse-show-manager/distribution-plan" className="text-sm text-primary hover:underline mt-2 inline-block">
              Go to Distribution Plan
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-blue-600" />
            Equipment Check-In
            <span className="text-sm font-normal text-muted-foreground">{distributionPlan.length} items expected</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Planned</TableHead>
                <TableHead className="text-center">Checked In</TableHead>
                <TableHead className="text-center">Remaining</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Available</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributionPlan.map(item => {
                const eq = item.equipment_items || inventory[item.equipment_id] || {};
                const eqId = item.equipment_id;
                const planned = item.planned_qty || 0;
                const checkedIn = arenaState[eqId]?.checkedIn || 0;
                const remaining = planned - checkedIn;
                const available = globalState[eqId]?.available ?? 0;

                let statusBadge;
                if (checkedIn === 0) {
                  statusBadge = <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>;
                } else if (checkedIn < planned) {
                  statusBadge = <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Partial</Badge>;
                } else if (checkedIn === planned) {
                  statusBadge = <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Complete</Badge>;
                } else {
                  statusBadge = <Badge variant="destructive">Over +{checkedIn - planned}</Badge>;
                }

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{eq.name || 'Unknown'}</TableCell>
                    <TableCell>{eq.category || ''}</TableCell>
                    <TableCell className="text-center font-bold">{planned}</TableCell>
                    <TableCell className="text-center">{checkedIn}</TableCell>
                    <TableCell className="text-center">{Math.max(0, remaining)}</TableCell>
                    <TableCell className="text-center">{statusBadge}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{available}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline" onClick={() => openDialog(item)} disabled={available <= 0 && remaining > 0}>
                        <ArrowDownToLine className="h-3 w-3 mr-1" /> Check In
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In Equipment</DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <>Check in <strong>{selectedItem.equipment_items?.name || 'equipment'}</strong> to this arena.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <Label>Quantity</Label>
                <Input type="number" min={1} max={globalState[selectedItem.equipment_id]?.available ?? 999} value={qty} onChange={e => setQty(parseInt(e.target.value, 10) || 0)} />
                <p className="text-xs text-muted-foreground mt-1">
                  Available in warehouse: {globalState[selectedItem.equipment_id]?.available ?? 0}
                </p>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Condition, batch info, etc." rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving || qty <= 0}>
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Check In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ---- Check Out Tab ----
const CheckOutTab = ({ arenaState, inventory, transactions, selectedArena, onCheckOut, isSaving }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEqId, setSelectedEqId] = useState(null);
  const [qty, setQty] = useState(1);
  const [assignedTo, setAssignedTo] = useState('');
  const [crewName, setCrewName] = useState('');
  const [notes, setNotes] = useState('');

  const onHandItems = Object.entries(arenaState)
    .filter(([, s]) => s.onHand > 0)
    .map(([eqId, s]) => ({ eqId, ...s, ...inventory[eqId] }));

  const openDialog = (eqId) => {
    setSelectedEqId(eqId);
    setQty(1);
    setAssignedTo('');
    setCrewName('');
    setNotes('');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedEqId) return;
    await onCheckOut({ equipmentId: selectedEqId, quantity: qty, assignedTo, crewName, notes });
    setDialogOpen(false);
  };

  // Current check-outs at this arena
  const checkOuts = transactions.filter(tx => tx.transaction_type === 'check_out' && tx.arena_id === selectedArena);

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-orange-600" />
            On-Hand Equipment
            <span className="text-sm font-normal text-muted-foreground">{onHandItems.length} items available</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {onHandItems.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No equipment on hand at this arena. Check in equipment first.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">On Hand</TableHead>
                  <TableHead className="text-center">Checked Out</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onHandItems.map(item => (
                  <TableRow key={item.eqId}>
                    <TableCell className="font-medium">{item.name || 'Unknown'}</TableCell>
                    <TableCell>{item.category || ''}</TableCell>
                    <TableCell className="text-center font-bold">{item.onHand}</TableCell>
                    <TableCell className="text-center">{item.checkedOut}</TableCell>
                    <TableCell>{item.unit_type || 'each'}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline" onClick={() => openDialog(item.eqId)}>
                        <ArrowUpFromLine className="h-3 w-3 mr-1" /> Check Out
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {checkOuts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Current Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Crew</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkOuts.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium">{tx.equipment_items?.name || 'Unknown'}</TableCell>
                    <TableCell>{tx.assigned_to || '-'}</TableCell>
                    <TableCell>{tx.crew_name || '-'}</TableCell>
                    <TableCell className="text-center">{tx.quantity}</TableCell>
                    <TableCell className="text-sm">{new Date(tx.transaction_date).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out Equipment</DialogTitle>
            <DialogDescription>
              {selectedEqId && (
                <>Assign <strong>{inventory[selectedEqId]?.name || 'equipment'}</strong> to a person or crew.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedEqId && (
            <div className="space-y-4">
              <div>
                <Label>Quantity</Label>
                <Input type="number" min={1} max={arenaState[selectedEqId]?.onHand ?? 0} value={qty} onChange={e => setQty(parseInt(e.target.value, 10) || 0)} />
                <p className="text-xs text-muted-foreground mt-1">
                  On hand: {arenaState[selectedEqId]?.onHand ?? 0}
                </p>
              </div>
              <div>
                <Label>Assigned To (person)</Label>
                <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="e.g., John Smith" />
              </div>
              <div>
                <Label>Crew / Team (optional)</Label>
                <Input value={crewName} onChange={e => setCrewName(e.target.value)} placeholder="e.g., Setup Crew A" />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Purpose, return time, etc." rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving || qty <= 0 || (!assignedTo && !crewName)}>
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Check Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ---- Transfers Tab ----
const TransfersTab = ({ arenaState, inventory, arenas, selectedArena, transactions, onTransfer, isSaving }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEqId, setSelectedEqId] = useState('');
  const [toArenaId, setToArenaId] = useState('');
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  const onHandItems = Object.entries(arenaState)
    .filter(([, s]) => s.onHand > 0)
    .map(([eqId, s]) => ({ eqId, ...s, ...inventory[eqId] }));

  const otherArenas = arenas.filter(a => a.id !== selectedArena);
  const transfers = transactions.filter(tx => tx.transaction_type === 'transfer' && (tx.from_arena_id === selectedArena || tx.to_arena_id === selectedArena));

  const openDialog = () => {
    setSelectedEqId(onHandItems.length > 0 ? onHandItems[0].eqId : '');
    setToArenaId(otherArenas.length > 0 ? otherArenas[0].id : '');
    setQty(1);
    setNotes('');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedEqId || !toArenaId) return;
    await onTransfer({ equipmentId: selectedEqId, quantity: qty, toArenaId, notes });
    setDialogOpen(false);
  };

  // Build arena name lookup
  const arenaNames = {};
  arenas.forEach(a => { arenaNames[a.id] = a.name; });

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-purple-600" />
          Transfers
        </h3>
        <Button onClick={openDialog} disabled={onHandItems.length === 0 || otherArenas.length === 0}>
          <ArrowLeftRight className="h-4 w-4 mr-2" /> New Transfer
        </Button>
      </div>

      {transfers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <ArrowLeftRight className="mx-auto h-12 w-12 mb-4 opacity-40" />
            <p>No transfers recorded for this arena yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">{new Date(tx.transaction_date).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">{tx.equipment_items?.name || 'Unknown'}</TableCell>
                    <TableCell>{arenaNames[tx.from_arena_id] || 'Unknown'}</TableCell>
                    <TableCell>{arenaNames[tx.to_arena_id] || 'Unknown'}</TableCell>
                    <TableCell className="text-center font-bold">{tx.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Equipment</DialogTitle>
            <DialogDescription>Move equipment from this arena to another.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Equipment</Label>
              <Select value={selectedEqId} onValueChange={setSelectedEqId}>
                <SelectTrigger><SelectValue placeholder="Select equipment..." /></SelectTrigger>
                <SelectContent>
                  {onHandItems.map(item => (
                    <SelectItem key={item.eqId} value={item.eqId}>
                      {item.name} (on hand: {item.onHand})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Destination Arena</Label>
              <Select value={toArenaId} onValueChange={setToArenaId}>
                <SelectTrigger><SelectValue placeholder="Select arena..." /></SelectTrigger>
                <SelectContent>
                  {otherArenas.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={1} max={selectedEqId ? (arenaState[selectedEqId]?.onHand ?? 0) : 999} value={qty} onChange={e => setQty(parseInt(e.target.value, 10) || 0)} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for transfer..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving || qty <= 0 || !selectedEqId || !toArenaId}>
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ---- History Tab ----
const HistoryTab = ({ transactions, arenas, selectedArena, onVoid, isSaving }) => {
  const [typeFilter, setTypeFilter] = useState('all');

  const arenaNames = {};
  arenas.forEach(a => { arenaNames[a.id] = a.name; });

  // Show all transactions that involve this arena
  const relevantTxns = transactions.filter(tx => {
    if (tx.arena_id === selectedArena || tx.from_arena_id === selectedArena || tx.to_arena_id === selectedArena) {
      if (typeFilter === 'all') return true;
      return tx.transaction_type === typeFilter;
    }
    return false;
  });

  const typeBadge = (type) => {
    switch (type) {
      case 'check_in': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Check In</Badge>;
      case 'check_out': return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Check Out</Badge>;
      case 'transfer': return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Transfer</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getArenaInfo = (tx) => {
    if (tx.transaction_type === 'transfer') {
      return `${arenaNames[tx.from_arena_id] || '?'} → ${arenaNames[tx.to_arena_id] || '?'}`;
    }
    return arenaNames[tx.arena_id] || '-';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5 text-gray-600" />
          Transaction History
        </h3>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="check_in">Check In</SelectItem>
            <SelectItem value="check_out">Check Out</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {relevantTxns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <History className="mx-auto h-12 w-12 mb-4 opacity-40" />
            <p>No transactions recorded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Arena</TableHead>
                  <TableHead>Person / Crew</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relevantTxns.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm whitespace-nowrap">{new Date(tx.transaction_date).toLocaleString()}</TableCell>
                    <TableCell>{typeBadge(tx.transaction_type)}</TableCell>
                    <TableCell className="font-medium">{tx.equipment_items?.name || 'Unknown'}</TableCell>
                    <TableCell className="text-center font-bold">{tx.quantity}</TableCell>
                    <TableCell className="text-sm">{getArenaInfo(tx)}</TableCell>
                    <TableCell className="text-sm">{[tx.assigned_to, tx.crew_name].filter(Boolean).join(' / ') || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.notes || '-'}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Void this transaction?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this {tx.transaction_type.replace('_', ' ')} record. All computed totals will update.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onVoid(tx.id)} disabled={isSaving}>Void</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ---- Main Page ----
const EquipmentCheckInOutPage = () => {
  const navigate = useNavigate();
  const {
    shows, isShowsLoading, selectedShow, setSelectedShow, fetchUserShows,
    arenas, isArenasLoading, selectedArena, setSelectedArena, fetchArenas,
    transactions, isLoading, inventory, distributionPlan,
    arenaState, globalState, summaryStats,
    checkIn, checkOut, transfer, voidTransaction,
    fetchTransactions,
    isSaving,
  } = useEquipmentCheckInOut();

  useEffect(() => { fetchUserShows(); }, [fetchUserShows]);

  const handleShowChange = (showId) => {
    const show = shows.find(s => s.id === showId);
    setSelectedShow(show ? showId : null);
    if (show) fetchArenas(showId);
  };

  const handleArenaChange = (arenaId) => {
    setSelectedArena(arenaId);
    if (selectedShow && arenaId) fetchTransactions(selectedShow, arenaId);
  };

  const selectedShowObj = shows.find(s => s.id === selectedShow);
  const selectedArenaObj = arenas.find(a => a.id === selectedArena);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Helmet><title>Equipment Check-In/Out | Admin</title></Helmet>
      <Navigation />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8"
      >
        <Button variant="outline" className="mb-6" onClick={() => navigate('/horse-show-manager/equipment-planning')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Equipment Planning
        </Button>

        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <ClipboardCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Equipment Check-In/Out</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Track equipment check-ins, check-outs, and transfers between arenas.
          </p>
        </div>

        {/* Show Selector */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label className="font-semibold whitespace-nowrap">Select Show:</Label>
              {isShowsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Select value={selectedShow || ''} onValueChange={handleShowChange}>
                  <SelectTrigger className="w-80">
                    <SelectValue placeholder="Choose a show..." />
                  </SelectTrigger>
                  <SelectContent>
                    {shows.map(show => (
                      <SelectItem key={show.id} value={show.id}>
                        {show.project_name} ({show.status || 'draft'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Arena Selector */}
        {selectedShow && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Label className="font-semibold whitespace-nowrap">Select Arena:</Label>
                {isArenasLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : arenas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No arenas found.{' '}
                    <Link to="/horse-show-manager/arena-sessions" className="text-primary hover:underline">Create arenas first</Link>.
                  </p>
                ) : (
                  <Select value={selectedArena || ''} onValueChange={handleArenaChange}>
                    <SelectTrigger className="w-80">
                      <SelectValue placeholder="Choose an arena..." />
                    </SelectTrigger>
                    <SelectContent>
                      {arenas.map(arena => (
                        <SelectItem key={arena.id} value={arena.id}>
                          {arena.name} {arena.arena_type ? `(${arena.arena_type})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Main content when arena selected */}
        {selectedShow && selectedArena && !isLoading && (
          <>
            {/* Action Bar */}
            <Card className="mb-6">
              <CardContent className="py-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    const pdfItems = distributionPlan.map(item => {
                      const eq = item.equipment_items || inventory[item.equipment_id] || {};
                      const eqId = item.equipment_id;
                      return {
                        name: eq.name || 'Unknown',
                        category: eq.category || '',
                        unit_type: eq.unit_type || 'each',
                        planned_qty: item.planned_qty || 0,
                        owned: inventory[eqId]?.total_qty_owned ?? 0,
                        checkedIn: arenaState[eqId]?.checkedIn || 0,
                      };
                    });
                    generateArenaKitListPdf({
                      showName: selectedShowObj?.project_name || 'Show',
                      arenaName: selectedArenaObj?.name || 'Arena',
                      arenaType: selectedArenaObj?.arena_type,
                      items: pdfItems,
                    });
                  }}
                  disabled={distributionPlan.length === 0}
                >
                  <Printer className="h-4 w-4 mr-2" /> Print Arena Kit List
                </Button>
                <div className="flex items-center gap-3">
                  <Link to="/horse-show-manager/distribution-plan" className="text-sm text-primary hover:underline">Distribution Plan</Link>
                  <Link to="/horse-show-manager/equipment-requirements" className="text-sm text-primary hover:underline">Requirements</Link>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                      <ArrowDownToLine className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summaryStats.totalCheckedIn}</p>
                      <p className="text-xs text-muted-foreground">Checked In</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-lg">
                      <ArrowUpFromLine className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summaryStats.totalCheckedOut}</p>
                      <p className="text-xs text-muted-foreground">Checked Out</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                      <ArrowLeftRight className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summaryStats.totalTransfers}</p>
                      <p className="text-xs text-muted-foreground">Transfers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                      <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summaryStats.arenaOnHand}</p>
                      <p className="text-xs text-muted-foreground">On Hand</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="check-in">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="check-in">Check In</TabsTrigger>
                <TabsTrigger value="check-out">Check Out</TabsTrigger>
                <TabsTrigger value="transfers">Transfers</TabsTrigger>
                <TabsTrigger value="history">
                  History
                  {transactions.length > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">{transactions.filter(tx => tx.arena_id === selectedArena || tx.from_arena_id === selectedArena || tx.to_arena_id === selectedArena).length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="check-in">
                <CheckInTab
                  distributionPlan={distributionPlan}
                  arenaState={arenaState}
                  globalState={globalState}
                  inventory={inventory}
                  onCheckIn={checkIn}
                  isSaving={isSaving}
                />
              </TabsContent>
              <TabsContent value="check-out">
                <CheckOutTab
                  arenaState={arenaState}
                  inventory={inventory}
                  transactions={transactions}
                  selectedArena={selectedArena}
                  onCheckOut={checkOut}
                  isSaving={isSaving}
                />
              </TabsContent>
              <TabsContent value="transfers">
                <TransfersTab
                  arenaState={arenaState}
                  inventory={inventory}
                  arenas={arenas}
                  selectedArena={selectedArena}
                  transactions={transactions}
                  onTransfer={transfer}
                  isSaving={isSaving}
                />
              </TabsContent>
              <TabsContent value="history">
                <HistoryTab
                  transactions={transactions}
                  arenas={arenas}
                  selectedArena={selectedArena}
                  onVoid={voidTransaction}
                  isSaving={isSaving}
                />
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* No show selected */}
        {!selectedShow && !isShowsLoading && (
          <div className="text-center py-16">
            <ClipboardCheck className="mx-auto h-16 w-16 text-muted-foreground opacity-40 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a Show</h3>
            <p className="text-muted-foreground">Choose a show above to manage equipment check-in and check-out.</p>
          </div>
        )}

        {/* Show selected but no arena */}
        {selectedShow && !selectedArena && !isArenasLoading && arenas.length > 0 && (
          <div className="text-center py-16">
            <MapPin className="mx-auto h-16 w-16 text-muted-foreground opacity-40 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select an Arena</h3>
            <p className="text-muted-foreground">Choose an arena above to start checking equipment in and out.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default EquipmentCheckInOutPage;
