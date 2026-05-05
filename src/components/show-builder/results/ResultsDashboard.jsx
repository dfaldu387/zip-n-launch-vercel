import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, Save, Search, ClipboardList, Check, Clock, BarChart3 } from 'lucide-react';
import { ClassResultsCard } from './ClassResultsCard';
import { getScheduledClasses, initializeResults, getResultsStats } from '@/lib/resultsUtils';

export const ResultsDashboard = ({ show, onSave, isSaving }) => {
  const pd = show?.project_data || {};
  const [classResults, setClassResults] = useState(() => pd.results?.classResults || {});
  const [settings, setSettings] = useState(() => pd.results?.settings || { defaultPlacings: 6, defaultScoringType: 'placed' });
  const [searchTerm, setSearchTerm] = useState('');
  const [dirty, setDirty] = useState(false);

  const scheduledClasses = useMemo(() => getScheduledClasses(pd), [pd]);
  const stats = useMemo(() => getResultsStats(classResults), [classResults]);

  // Group by day and arena
  const byDay = useMemo(() => {
    const map = {};
    for (const sc of scheduledClasses) {
      if (!map[sc.dayId]) map[sc.dayId] = { label: sc.dayLabel, classes: [] };
      map[sc.dayId].classes.push(sc);
    }
    return Object.values(map);
  }, [scheduledClasses]);

  const byArena = useMemo(() => {
    const map = {};
    for (const sc of scheduledClasses) {
      const key = `${sc.dayId}::${sc.arenaId}`;
      if (!map[key]) map[key] = { label: `${sc.arenaName} — ${sc.dayLabel}`, classes: [] };
      map[key].classes.push(sc);
    }
    return Object.values(map);
  }, [scheduledClasses]);

  const handleChange = useCallback((classId, newResult) => {
    setClassResults(prev => ({ ...prev, [classId]: newResult }));
    setDirty(true);
  }, []);

  const handleAutoGenerate = () => {
    const initialized = initializeResults(pd, settings);
    // Merge: keep existing entries, add missing classes
    const merged = { ...initialized.classResults };
    for (const [key, existing] of Object.entries(classResults)) {
      if (existing.entries?.some(e => e.riderName?.trim())) {
        merged[key] = existing; // preserve user data
      }
    }
    setClassResults(merged);
    setDirty(true);
  };

  const handleSave = () => {
    onSave({
      ...pd,
      results: { classResults, settings },
    });
    setDirty(false);
  };

  const filterClasses = (classes) => {
    if (!searchTerm) return classes;
    const q = searchTerm.toLowerCase();
    return classes.filter(sc =>
      sc.className.toLowerCase().includes(q) ||
      String(sc.classNumber).includes(q) ||
      sc.arenaName?.toLowerCase().includes(q)
    );
  };

  const renderClassCards = (classes) => {
    const filtered = filterClasses(classes);
    if (filtered.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">No matching classes.</p>;
    return filtered.map(sc => (
      <ClassResultsCard
        key={sc.itemId}
        classId={sc.itemId}
        result={classResults[sc.itemId] || { classNumber: sc.classNumber, className: sc.className, status: 'pending', scoringType: 'placed', entries: [] }}
        onChange={handleChange}
        arenaName={sc.arenaName}
        dayLabel={sc.dayLabel}
      />
    ));
  };

  if (scheduledClasses.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg">
        <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">No scheduled classes found.</p>
        <p className="text-sm text-muted-foreground mt-1">Build your schedule in the Schedule Builder first, then come back to enter results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <ClipboardList className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Classes</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <Clock className="h-5 w-5 mx-auto text-blue-500 mb-1" />
          <div className="text-2xl font-bold">{stats.withData}</div>
          <div className="text-xs text-muted-foreground">Results Entered</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <Check className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
          <div className="text-2xl font-bold">{stats.finalized}</div>
          <div className="text-xs text-muted-foreground">Finalized</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <BarChart3 className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <div className="text-2xl font-bold">{stats.percentComplete}%</div>
          <div className="text-xs text-muted-foreground">Complete</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleAutoGenerate}>
          <Wand2 className="h-4 w-4 mr-1.5" /> Auto-Generate Entries
        </Button>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button onClick={handleSave} disabled={!dirty || isSaving} size="sm">
          <Save className="h-4 w-4 mr-1.5" /> {isSaving ? 'Saving...' : 'Save Results'}
          {dirty && <Badge variant="destructive" className="ml-2 text-[10px] px-1">unsaved</Badge>}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Classes</TabsTrigger>
          <TabsTrigger value="byDay">By Day</TabsTrigger>
          <TabsTrigger value="byArena">By Arena</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-2 mt-4">
          {renderClassCards(scheduledClasses)}
        </TabsContent>

        <TabsContent value="byDay" className="space-y-6 mt-4">
          {byDay.map((group, i) => (
            <div key={i}>
              <h3 className="font-semibold text-sm mb-2 text-muted-foreground">{group.label}</h3>
              <div className="space-y-2">
                {renderClassCards(group.classes)}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="byArena" className="space-y-6 mt-4">
          {byArena.map((group, i) => (
            <div key={i}>
              <h3 className="font-semibold text-sm mb-2 text-muted-foreground">{group.label}</h3>
              <div className="space-y-2">
                {renderClassCards(group.classes)}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};
