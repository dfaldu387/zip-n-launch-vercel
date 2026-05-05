import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Truck, Loader2, ArrowLeft, AlertTriangle, CheckCircle2, Package, MapPin, BookOpen, RefreshCw, Trash2, Printer } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useDistributionPlan } from '@/hooks/useDistributionPlan';
import { generateArenaKitListPdf } from '@/lib/arenaKitListPdfGenerator';

// ---- Debounced quantity input ----
const DebouncedQuantityInput = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef(null);
  useEffect(() => { setLocalValue(value); }, [value]);
  const handleChange = (e) => {
    const v = parseInt(e.target.value, 10) || 0;
    setLocalValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 500);
  };
  return <Input type="number" min={0} value={localValue} onChange={handleChange} className="w-20 h-8 text-center" />;
};

// ---- By Arena Tab ----
const ByArenaTab = ({ items, inventory, onUpdateQty, onDelete, showName }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Truck className="mx-auto h-12 w-12 mb-4 opacity-40" />
        <p>No distribution plan yet. Click "Generate Distribution Plan" above.</p>
      </div>
    );
  }

  const grouped = {};
  for (const item of items) {
    const arenaId = item.arena_id;
    const arenaName = item.arenas?.name || 'Unknown Arena';
    if (!grouped[arenaId]) grouped[arenaId] = { arenaName, items: [] };
    grouped[arenaId].items.push(item);
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([arenaId, data]) => (
        <Card key={arenaId}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                {data.arenaName}
                <span className="text-sm font-normal text-muted-foreground">{data.items.length} items</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const pdfItems = data.items.map(item => {
                    const eq = item.equipment_items || {};
                    const totalPlanned = items.filter(i => i.equipment_id === item.equipment_id).reduce((s, i) => s + (i.planned_qty || 0), 0);
                    return {
                      name: eq.name || 'Unknown',
                      category: eq.category || '',
                      unit_type: eq.unit_type || 'each',
                      planned_qty: item.planned_qty || 0,
                      owned: inventory[item.equipment_id]?.total_qty_owned ?? 0,
                    };
                  });
                  generateArenaKitListPdf({ showName: showName || 'Show', arenaName: data.arenaName, items: pdfItems });
                }}
              >
                <Printer className="h-3.5 w-3.5 mr-1" /> Print Kit List
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Planned Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map(item => {
                  const eq = item.equipment_items || {};
                  const owned = inventory[item.equipment_id]?.total_qty_owned ?? 0;
                  // Sum planned across all arenas for this equipment to check total shortage
                  const totalPlanned = items.filter(i => i.equipment_id === item.equipment_id).reduce((s, i) => s + (i.planned_qty || 0), 0);
                  const hasShortage = totalPlanned > owned;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{eq.name || 'Unknown'}</TableCell>
                      <TableCell>{eq.category || ''}</TableCell>
                      <TableCell className="text-center">
                        <DebouncedQuantityInput value={item.planned_qty} onChange={(v) => onUpdateQty(item.id, v)} />
                      </TableCell>
                      <TableCell>{eq.unit_type || 'each'}</TableCell>
                      <TableCell className="text-center">
                        {hasShortage ? (
                          <Badge variant="destructive">Short {totalPlanned - owned}</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove from plan?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {eq.name} from {data.arenaName}'s distribution.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(item.id)}>Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ---- By Discipline Tab ----
const ByDisciplineTab = ({ items }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-40" />
        <p>No distribution plan yet. Click "Generate Distribution Plan" above.</p>
      </div>
    );
  }

  const grouped = {};
  for (const item of items) {
    const discId = item.discipline_id || '__shared__';
    const discName = item.disciplines?.name || 'Shared / Multiple Disciplines';
    if (!grouped[discId]) grouped[discId] = { disciplineName: discName, items: [] };
    grouped[discId].items.push(item);
  }

  // Put "Shared" last
  const entries = Object.entries(grouped).sort(([a], [b]) => {
    if (a === '__shared__') return 1;
    if (b === '__shared__') return -1;
    return grouped[a].disciplineName.localeCompare(grouped[b].disciplineName);
  });

  return (
    <div className="space-y-6">
      {entries.map(([discId, data]) => (
        <Card key={discId}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {data.disciplineName}
              <span className="text-sm font-normal text-muted-foreground">{data.items.length} items</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Arena</TableHead>
                  <TableHead className="text-center">Planned Qty</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map(item => {
                  const eq = item.equipment_items || {};
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{eq.name || 'Unknown'}</TableCell>
                      <TableCell>{item.arenas?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-center font-bold">{item.planned_qty}</TableCell>
                      <TableCell>{eq.unit_type || 'each'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ---- Shortage View Tab ----
const ShortageViewTab = ({ items, inventory }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="mx-auto h-12 w-12 mb-4 opacity-40" />
        <p>No distribution plan yet. Click "Generate Distribution Plan" above.</p>
      </div>
    );
  }

  // Aggregate total planned per equipment across all arenas
  const eqTotals = {};
  for (const item of items) {
    const eqId = item.equipment_id;
    if (!eqTotals[eqId]) {
      const eq = item.equipment_items || {};
      eqTotals[eqId] = { name: eq.name, category: eq.category, unit_type: eq.unit_type, totalPlanned: 0, owned: inventory[eqId]?.total_qty_owned ?? 0, arenas: [] };
    }
    eqTotals[eqId].totalPlanned += item.planned_qty || 0;
    eqTotals[eqId].arenas.push({ arenaName: item.arenas?.name || 'Unknown', qty: item.planned_qty });
  }

  const shortages = Object.entries(eqTotals)
    .filter(([, data]) => data.totalPlanned > data.owned)
    .map(([eqId, data]) => ({ equipment_id: eqId, ...data, shortage: data.totalPlanned - data.owned }));

  if (shortages.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
        <CardContent className="flex items-center gap-4 py-6">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-semibold text-green-800 dark:text-green-200">No Shortages Detected</p>
            <p className="text-sm text-green-600 dark:text-green-400">Your inventory covers all planned distribution quantities.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
        <CardContent className="flex items-center gap-4 py-6">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-200">{shortages.length} Equipment Shortage{shortages.length > 1 ? 's' : ''}</p>
            <p className="text-sm text-red-600 dark:text-red-400">These items exceed your current inventory when distributed across arenas.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Total Planned</TableHead>
                <TableHead className="text-center">Owned</TableHead>
                <TableHead className="text-center">Shortage</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Arena Breakdown</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shortages.map(s => (
                <TableRow key={s.equipment_id} className="bg-red-50/50 dark:bg-red-950/30">
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.category}</TableCell>
                  <TableCell className="text-center font-bold">{s.totalPlanned}</TableCell>
                  <TableCell className="text-center">{s.owned}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="destructive">{s.shortage}</Badge>
                  </TableCell>
                  <TableCell>{s.unit_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.arenas.map((a, i) => (
                      <span key={i}>{a.arenaName}: {a.qty}{i < s.arenas.length - 1 ? ', ' : ''}</span>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// ---- Summary Tab ----
const SummaryTab = ({ items, inventory }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Truck className="mx-auto h-12 w-12 mb-4 opacity-40" />
        <p>No distribution plan yet. Click "Generate Distribution Plan" above.</p>
      </div>
    );
  }

  // Per-category breakdown
  const categoryMap = {};
  for (const item of items) {
    const cat = item.equipment_items?.category || 'Other';
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalQty: 0 };
    categoryMap[cat].count++;
    categoryMap[cat].totalQty += item.planned_qty || 0;
  }

  const totalQty = items.reduce((s, i) => s + (i.planned_qty || 0), 0);
  const eqIds = new Set(items.map(i => i.equipment_id));
  const arenaIds = new Set(items.map(i => i.arena_id));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Distribution Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{eqIds.size}</p>
              <p className="text-xs text-muted-foreground">Unique Equipment</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totalQty}</p>
              <p className="text-xs text-muted-foreground">Total Items Planned</p>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{arenaIds.size}</p>
              <p className="text-xs text-muted-foreground">Arenas Covered</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-xs text-muted-foreground">Distribution Lines</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">By Category</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-center">Total Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(categoryMap).sort(([a], [b]) => a.localeCompare(b)).map(([cat, data]) => (
                <TableRow key={cat}>
                  <TableCell className="font-medium">{cat}</TableCell>
                  <TableCell className="text-center">{data.count}</TableCell>
                  <TableCell className="text-center font-bold">{data.totalQty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// ---- Main Page ----
const DistributionPlanPage = () => {
  const navigate = useNavigate();
  const {
    shows, isShowsLoading, selectedShow, setSelectedShow, fetchUserShows,
    distributionItems, isLoading,
    isGenerating, lastGeneratedAt, missingDataMessage,
    inventory, summaryStats,
    fetchDistributionPlan, generateDistributionPlan,
    updatePlannedQty, deleteDistributionItem,
  } = useDistributionPlan();

  useEffect(() => { fetchUserShows(); }, [fetchUserShows]);

  const handleShowChange = (showId) => {
    const show = shows.find(s => s.id === showId);
    setSelectedShow(show || null);
    if (show) fetchDistributionPlan(showId);
  };

  const hasItems = distributionItems.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Helmet><title>Distribution Plan | Admin</title></Helmet>
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
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Distribution Plan</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Auto-generate and manage equipment distribution to arenas.
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
                <Select value={selectedShow?.id || ''} onValueChange={handleShowChange}>
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

        {selectedShow && (
          <>
            {/* Action Bar */}
            <Card className="mb-6">
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {hasItems ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button disabled={isGenerating}>
                          {isGenerating ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                          ) : (
                            <><RefreshCw className="h-4 w-4 mr-2" /> Regenerate Plan</>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Regenerate Distribution Plan?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will replace your current plan, including any manual adjustments. Continue?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => generateDistributionPlan(selectedShow.id)}>
                            Regenerate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button onClick={() => generateDistributionPlan(selectedShow.id)} disabled={isGenerating}>
                      {isGenerating ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                      ) : (
                        <><Truck className="h-4 w-4 mr-2" /> Generate Distribution Plan</>
                      )}
                    </Button>
                  )}
                  {lastGeneratedAt && (
                    <span className="text-sm text-muted-foreground">
                      Last generated: {new Date(lastGeneratedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Link to="/horse-show-manager/arena-sessions" className="text-sm text-primary hover:underline">Arena Sessions</Link>
                  <Link to="/horse-show-manager/equipment-requirements" className="text-sm text-primary hover:underline">Requirements</Link>
                </div>
              </CardContent>
            </Card>

            {/* Generating Spinner */}
            {isGenerating && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Generating distribution plan...</p>
              </div>
            )}

            {/* Missing Data */}
            {!isGenerating && missingDataMessage && (
              <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
                <CardContent className="flex items-center gap-4 py-6">
                  <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-200">Setup Required</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{missingDataMessage.text}</p>
                    <Link to="/horse-show-manager/arena-sessions" className="text-sm text-primary hover:underline mt-2 inline-block">
                      Go to Arena Sessions
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading existing plan */}
            {isLoading && !isGenerating && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Results */}
            {!isGenerating && !isLoading && hasItems && (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                          <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summaryStats.totalEquipmentTypes}</p>
                          <p className="text-xs text-muted-foreground">Equipment Types</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                          <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summaryStats.totalItemsDistributed}</p>
                          <p className="text-xs text-muted-foreground">Total Items</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                          <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summaryStats.arenasCount}</p>
                          <p className="text-xs text-muted-foreground">Arenas</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${summaryStats.shortageCount > 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-green-100 dark:bg-green-900'}`}>
                          {summaryStats.shortageCount > 0 ? (
                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summaryStats.shortageCount}</p>
                          <p className="text-xs text-muted-foreground">Shortages</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="by-arena">
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="by-arena">By Arena</TabsTrigger>
                    <TabsTrigger value="by-discipline">By Discipline</TabsTrigger>
                    <TabsTrigger value="shortages">
                      Shortages
                      {summaryStats.shortageCount > 0 && (
                        <Badge variant="destructive" className="ml-2 text-xs">{summaryStats.shortageCount}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                  </TabsList>

                  <TabsContent value="by-arena">
                    <ByArenaTab items={distributionItems} inventory={inventory} onUpdateQty={updatePlannedQty} onDelete={deleteDistributionItem} showName={selectedShow?.project_name} />
                  </TabsContent>
                  <TabsContent value="by-discipline">
                    <ByDisciplineTab items={distributionItems} />
                  </TabsContent>
                  <TabsContent value="shortages">
                    <ShortageViewTab items={distributionItems} inventory={inventory} />
                  </TabsContent>
                  <TabsContent value="summary">
                    <SummaryTab items={distributionItems} inventory={inventory} />
                  </TabsContent>
                </Tabs>
              </>
            )}

            {/* No plan prompt */}
            {!isGenerating && !isLoading && !hasItems && !missingDataMessage && (
              <div className="text-center py-16">
                <Truck className="mx-auto h-16 w-16 text-muted-foreground opacity-40 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Distribution Plan Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Click "Generate Distribution Plan" to auto-assign equipment to arenas.
                </p>
                <p className="text-sm text-muted-foreground">
                  Make sure you have{' '}
                  <Link to="/horse-show-manager/arena-sessions" className="text-primary underline">arena sessions with assigned classes</Link>{' '}
                  and{' '}
                  <Link to="/horse-show-manager/discipline-planner" className="text-primary underline">equipment profiles configured</Link>.
                </p>
              </div>
            )}
          </>
        )}

        {!selectedShow && !isShowsLoading && (
          <div className="text-center py-16">
            <Truck className="mx-auto h-16 w-16 text-muted-foreground opacity-40 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a Show</h3>
            <p className="text-muted-foreground">Choose a show above to generate or view a distribution plan.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default DistributionPlanPage;
