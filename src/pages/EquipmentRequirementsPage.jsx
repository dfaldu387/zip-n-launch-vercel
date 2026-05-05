import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Calculator, Loader2, ArrowLeft, AlertTriangle, CheckCircle2, Package, CalendarDays, BarChart3, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEquipmentRequirements } from '@/hooks/useEquipmentRequirements';

// ---- Arena Summary Tab ----
const ArenaSessionSummary = ({ sessionResults }) => {
  const [expanded, setExpanded] = useState({});

  // Group by arena
  const grouped = {};
  for (const sr of sessionResults) {
    if (!grouped[sr.arenaId]) grouped[sr.arenaId] = { arenaName: sr.arenaName, sessions: [] };
    grouped[sr.arenaId].sessions.push(sr);
  }

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (sessionResults.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calculator className="mx-auto h-12 w-12 mb-4 opacity-40" />
        <p>No results yet. Click "Calculate Requirements" above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([arenaId, arenaData]) => (
        <Card key={arenaId}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{arenaData.arenaName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {arenaData.sessions.map(sr => {
              const eqEntries = Object.entries(sr.requirements);
              const isOpen = expanded[sr.sessionId];
              return (
                <div key={sr.sessionId} className="border rounded-lg">
                  <button
                    onClick={() => toggle(sr.sessionId)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{sr.sessionName}</span>
                      <Badge variant="outline">{sr.date}</Badge>
                      <Badge className={sr.mode === 'SUM' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : ''}>
                        {sr.mode}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{eqEntries.length} items</span>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      {eqEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No equipment required for this session.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Equipment</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-center">Required Qty</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead>Class Breakdown</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {eqEntries.map(([eqId, data]) => {
                              const breakdown = sr.details.filter(d => d.equipment_id === eqId);
                              return (
                                <TableRow key={eqId}>
                                  <TableCell className="font-medium">{data.name}</TableCell>
                                  <TableCell>{data.category}</TableCell>
                                  <TableCell className="text-center font-bold">{data.qty}</TableCell>
                                  <TableCell>{data.unit_type}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {breakdown.map((b, i) => (
                                      <span key={i}>
                                        {b.class_template_name}: {b.per_instance_qty}×{b.instances}={b.total_qty}
                                        {i < breakdown.length - 1 ? ', ' : ''}
                                      </span>
                                    ))}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ---- Day Master List Tab ----
const DayMasterList = ({ dayResults }) => {
  if (dayResults.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CalendarDays className="mx-auto h-12 w-12 mb-4 opacity-40" />
        <p>No results yet. Click "Calculate Requirements" above.</p>
      </div>
    );
  }

  const sorted = [...dayResults].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      {sorted.map(dr => {
        const eqEntries = Object.entries(dr.requirements);
        return (
          <Card key={dr.date}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-primary" />
                {new Date(dr.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                <span className="text-sm font-normal text-muted-foreground">{eqEntries.length} equipment types</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eqEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No equipment required this day.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Total Required</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Arena Breakdown</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eqEntries.map(([eqId, data]) => {
                      const arenaInfo = dr.arenaBreakdown?.[eqId] || {};
                      return (
                        <TableRow key={eqId}>
                          <TableCell className="font-medium">{data.name}</TableCell>
                          <TableCell>{data.category}</TableCell>
                          <TableCell className="text-center font-bold">{data.qty}</TableCell>
                          <TableCell>{data.unit_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {Object.entries(arenaInfo).map(([aId, a], i) => (
                              <span key={aId}>
                                {a.arena_name}: {a.qty}{i < Object.entries(arenaInfo).length - 1 ? ' + ' : ''}
                              </span>
                            ))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// ---- Shortages Tab ----
const ShortageDetection = ({ showResults }) => {
  if (!showResults) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="mx-auto h-12 w-12 mb-4 opacity-40" />
        <p>No results yet. Click "Calculate Requirements" above.</p>
      </div>
    );
  }

  const { peakRequirements, shortages } = showResults;
  const allEquip = Object.entries(peakRequirements);

  return (
    <div className="space-y-6">
      {/* Shortage Alert or Success */}
      {shortages.length === 0 ? (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
          <CardContent className="flex items-center gap-4 py-6">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">No Shortages Detected</p>
              <p className="text-sm text-green-600 dark:text-green-400">Your inventory covers all equipment needs for this show.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
            <CardContent className="flex items-center gap-4 py-6">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-200">{shortages.length} Equipment Shortage{shortages.length > 1 ? 's' : ''} Detected</p>
                <p className="text-sm text-red-600 dark:text-red-400">The items below exceed your current inventory.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-red-600 dark:text-red-400">Shortage Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Required</TableHead>
                    <TableHead className="text-center">Owned</TableHead>
                    <TableHead className="text-center">Shortage</TableHead>
                    <TableHead>Peak Day</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shortages.map(s => (
                    <TableRow key={s.equipment_id} className="bg-red-50/50 dark:bg-red-950/30">
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.category}</TableCell>
                      <TableCell className="text-center font-bold">{s.required}</TableCell>
                      <TableCell className="text-center">{s.owned}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive">{s.shortage}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.peak_day}</Badge>
                      </TableCell>
                      <TableCell>{s.unit_type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Full Show Requirements */}
      {allEquip.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Full Show Equipment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Peak Required</TableHead>
                  <TableHead>Peak Day</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allEquip.map(([eqId, data]) => {
                  const hasShortage = shortages.some(s => s.equipment_id === eqId);
                  return (
                    <TableRow key={eqId} className={hasShortage ? 'bg-red-50/50 dark:bg-red-950/30' : ''}>
                      <TableCell className="font-medium">{data.name}</TableCell>
                      <TableCell>{data.category}</TableCell>
                      <TableCell className={`text-center font-bold ${hasShortage ? 'text-red-600 dark:text-red-400' : ''}`}>
                        {data.qty}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{data.peak_day}</Badge>
                      </TableCell>
                      <TableCell>{data.unit_type}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ---- Main Page ----
const EquipmentRequirementsPage = () => {
  const navigate = useNavigate();
  const {
    shows, isShowsLoading, selectedShow, setSelectedShow, fetchUserShows,
    isCalculating, lastCalculatedAt, missingDataMessage,
    sessionResults, dayResults, showResults, summaryStats,
    calculateRequirements,
  } = useEquipmentRequirements();

  useEffect(() => { fetchUserShows(); }, [fetchUserShows]);

  const handleShowChange = (showId) => {
    const show = shows.find(s => s.id === showId);
    setSelectedShow(show || null);
  };

  const hasResults = sessionResults.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Helmet><title>Equipment Requirements | Admin</title></Helmet>
      <Navigation />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8"
      >
        {/* Back Link */}
        <Button variant="outline" className="mb-6" onClick={() => navigate('/horse-show-manager/equipment-planning')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Equipment Planning
        </Button>

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Equipment Requirements</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Calculate and view equipment requirements, daily totals, and shortages.
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
                  <Button onClick={() => calculateRequirements(selectedShow.id)} disabled={isCalculating}>
                    {isCalculating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculating...</>
                    ) : (
                      <><RefreshCw className="h-4 w-4 mr-2" /> Calculate Requirements</>
                    )}
                  </Button>
                  {lastCalculatedAt && (
                    <span className="text-sm text-muted-foreground">
                      Last calculated: {new Date(lastCalculatedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                {hasResults && (
                  <Link to="/horse-show-manager/arena-sessions" className="text-sm text-primary hover:underline">
                    Edit Arena Sessions
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Calculating Spinner */}
            {isCalculating && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Calculating equipment requirements...</p>
              </div>
            )}

            {/* Missing Data Message */}
            {!isCalculating && missingDataMessage && (
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

            {/* Results */}
            {!isCalculating && hasResults && (
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
                          <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summaryStats.totalSessionsCalculated}</p>
                          <p className="text-xs text-muted-foreground">Sessions Calculated</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                          <CalendarDays className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summaryStats.totalShowDays}</p>
                          <p className="text-xs text-muted-foreground">Show Days</p>
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
                <Tabs defaultValue="arena-summary">
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="arena-summary">Arena Summary</TabsTrigger>
                    <TabsTrigger value="day-master">Day Master List</TabsTrigger>
                    <TabsTrigger value="shortages">
                      Shortages
                      {summaryStats.shortageCount > 0 && (
                        <Badge variant="destructive" className="ml-2 text-xs">{summaryStats.shortageCount}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="arena-summary">
                    <ArenaSessionSummary sessionResults={sessionResults} />
                  </TabsContent>

                  <TabsContent value="day-master">
                    <DayMasterList dayResults={dayResults} />
                  </TabsContent>

                  <TabsContent value="shortages">
                    <ShortageDetection showResults={showResults} />
                  </TabsContent>
                </Tabs>
              </>
            )}

            {/* No results yet prompt */}
            {!isCalculating && !hasResults && (
              <div className="text-center py-16">
                <Calculator className="mx-auto h-16 w-16 text-muted-foreground opacity-40 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Calculations Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Click "Calculate Requirements" to analyze equipment needs for this show.
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

        {/* No show selected */}
        {!selectedShow && !isShowsLoading && (
          <div className="text-center py-16">
            <Calculator className="mx-auto h-16 w-16 text-muted-foreground opacity-40 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a Show</h3>
            <p className="text-muted-foreground">Choose a show above to calculate equipment requirements.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default EquipmentRequirementsPage;
