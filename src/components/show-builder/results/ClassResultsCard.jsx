import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, Plus, Trash2, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

const SCORING_TYPES = [
  { value: 'placed', label: 'Placed' },
  { value: 'scored', label: 'Scored' },
  { value: 'timed', label: 'Timed' },
];

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700' },
  'in-progress': { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  final: { label: 'Final', color: 'bg-emerald-100 text-emerald-700' },
};

export const ClassResultsCard = ({ classId, result, onChange, arenaName, dayLabel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const statusConfig = STATUS_CONFIG[result.status] || STATUS_CONFIG.pending;

  const hasData = result.entries?.some(e => e.riderName?.trim() || e.horseName?.trim());
  const isFinal = result.status === 'final';

  const updateEntry = (entryIdx, field, value) => {
    if (isFinal) return;
    const newEntries = [...result.entries];
    newEntries[entryIdx] = { ...newEntries[entryIdx], [field]: value };
    const newStatus = result.status === 'pending' && newEntries.some(e => e.riderName?.trim()) ? 'in-progress' : result.status;
    onChange(classId, { ...result, entries: newEntries, status: newStatus, updatedAt: new Date().toISOString() });
  };

  const addEntry = () => {
    if (isFinal) return;
    const nextPlacing = (result.entries?.length || 0) + 1;
    const newEntries = [...(result.entries || []), { id: uuidv4(), placing: nextPlacing, riderName: '', horseName: '', score: null, time: null, backNumber: '', notes: '' }];
    onChange(classId, { ...result, entries: newEntries, updatedAt: new Date().toISOString() });
  };

  const removeEntry = (entryIdx) => {
    if (isFinal) return;
    const newEntries = result.entries.filter((_, i) => i !== entryIdx);
    onChange(classId, { ...result, entries: newEntries, updatedAt: new Date().toISOString() });
  };

  const setScoringType = (type) => {
    if (isFinal) return;
    onChange(classId, { ...result, scoringType: type, updatedAt: new Date().toISOString() });
  };

  const markFinal = () => {
    onChange(classId, { ...result, status: 'final', updatedAt: new Date().toISOString() });
  };

  const reopen = () => {
    onChange(classId, { ...result, status: 'in-progress', updatedAt: new Date().toISOString() });
  };

  const entryCount = result.entries?.filter(e => e.riderName?.trim()).length || 0;

  return (
    <Card className={cn('transition-all', isFinal && 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20')}>
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 rounded-t-lg transition-colors"
      >
        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="font-mono text-sm font-bold text-muted-foreground w-10">#{result.classNumber}</span>
        <span className="font-medium text-sm flex-1 truncate">{result.className}</span>
        {entryCount > 0 && <Badge variant="secondary" className="text-xs">{entryCount} entries</Badge>}
        <Badge className={cn('text-[10px]', statusConfig.color)}>{statusConfig.label}</Badge>
      </button>

      {isOpen && (
        <CardContent className="pt-0 pb-4 px-4 space-y-3">
          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {dayLabel && <span>{dayLabel}</span>}
            {arenaName && <span>{arenaName}</span>}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Select value={result.scoringType || 'placed'} onValueChange={setScoringType} disabled={isFinal}>
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCORING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            {isFinal ? (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={reopen}>
                Reopen
              </Button>
            ) : (
              <Button variant="default" size="sm" className="h-7 text-xs" onClick={markFinal} disabled={!hasData}>
                <Lock className="h-3 w-3 mr-1" /> Mark Final
              </Button>
            )}
          </div>

          {/* Entries table */}
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium w-14">Place</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium">Rider Name</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium">Horse Name</th>
                  {result.scoringType === 'scored' && <th className="px-2 py-1.5 text-left text-xs font-medium w-20">Score</th>}
                  {result.scoringType === 'timed' && <th className="px-2 py-1.5 text-left text-xs font-medium w-20">Time</th>}
                  <th className="px-2 py-1.5 text-left text-xs font-medium w-16">Back #</th>
                  {!isFinal && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {(result.entries || []).map((entry, idx) => (
                  <tr key={entry.id} className="border-t">
                    <td className="px-2 py-1">
                      <span className="text-xs font-mono font-bold text-muted-foreground">{entry.placing}</span>
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={entry.riderName || ''}
                        onChange={(e) => updateEntry(idx, 'riderName', e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Rider name"
                        disabled={isFinal}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={entry.horseName || ''}
                        onChange={(e) => updateEntry(idx, 'horseName', e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Horse name"
                        disabled={isFinal}
                      />
                    </td>
                    {result.scoringType === 'scored' && (
                      <td className="px-2 py-1">
                        <Input
                          value={entry.score ?? ''}
                          onChange={(e) => updateEntry(idx, 'score', e.target.value)}
                          className="h-7 text-xs"
                          placeholder="0.0"
                          disabled={isFinal}
                        />
                      </td>
                    )}
                    {result.scoringType === 'timed' && (
                      <td className="px-2 py-1">
                        <Input
                          value={entry.time ?? ''}
                          onChange={(e) => updateEntry(idx, 'time', e.target.value)}
                          className="h-7 text-xs"
                          placeholder="0.000"
                          disabled={isFinal}
                        />
                      </td>
                    )}
                    <td className="px-2 py-1">
                      <Input
                        value={entry.backNumber || ''}
                        onChange={(e) => updateEntry(idx, 'backNumber', e.target.value)}
                        className="h-7 text-xs w-14"
                        placeholder="#"
                        disabled={isFinal}
                      />
                    </td>
                    {!isFinal && (
                      <td className="px-1 py-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeEntry(idx)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isFinal && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addEntry}>
              <Plus className="h-3 w-3 mr-1" /> Add Entry
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
};
