import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { parseDivisionId } from '@/lib/showBillUtils';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Loader2, Trophy, Calendar, FolderOpen,
    Hash, MapPin, Wand2, Save, Check, X, Plus, Trash2, Star,
    Award, Gift, Medal, AlertCircle, Search, Edit2, Users, Copy, CopyCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { stampModuleStatusOnSave } from '@/lib/moduleStatusService';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/components/ui/use-toast';

// ── Constants ──

const AWARD_TYPES = ['Ribbon', 'Trophy', 'Buckle', 'Plaque', 'Prize Money', 'Cooler', 'Blanket', 'Gift Card', 'Medal', 'Other'];
const PLACEMENT_OPTIONS = ['Champion', 'Reserve Champion', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

const DEFAULT_CLASS_AWARDS = [
    { placement: '1st', awardType: 'Ribbon', description: 'Blue Ribbon', cost: 2 },
    { placement: '2nd', awardType: 'Ribbon', description: 'Red Ribbon', cost: 2 },
    { placement: '3rd', awardType: 'Ribbon', description: 'Yellow Ribbon', cost: 2 },
    { placement: '4th', awardType: 'Ribbon', description: 'White Ribbon', cost: 2 },
    { placement: '5th', awardType: 'Ribbon', description: 'Pink Ribbon', cost: 2 },
    { placement: '6th', awardType: 'Ribbon', description: 'Green Ribbon', cost: 2 },
];

const DEFAULT_HIGH_POINT = [
    { name: 'All-Around Champion', awardType: 'Trophy', description: 'High Point All-Around', cost: 50 },
    { name: 'All-Around Reserve Champion', awardType: 'Trophy', description: 'Reserve High Point All-Around', cost: 35 },
];

// ── Show Picker removed — using LinkToExistingShow ──

// ── Extract classes from show data ──

function getClassesFromShow(pd) {
    const classes = [];

    // 1. From disciplines (show structure)
    for (const disc of (pd.disciplines || [])) {
        for (const divId of (disc.divisionOrder || [])) {
            const name = disc.divisionPrintTitles?.[divId] || parseDivisionId(divId).divisionName;
            classes.push({
                id: divId,
                name,
                discipline: disc.name,
                source: 'structure',
            });
        }
    }

    // 2. From show bill (if structure has none, use classBox items)
    if (classes.length === 0 && pd.showBill?.days) {
        for (const day of pd.showBill.days) {
            for (const arena of (day.arenas || [])) {
                for (const item of (arena.items || [])) {
                    if (item.type === 'classBox') {
                        const title = item.title || (item.classes || []).map(c => c.name).join(', ');
                        classes.push({
                            id: item.id,
                            name: title || `Class #${item.number}`,
                            classNumber: item.number,
                            discipline: arena.name,
                            source: 'showBill',
                        });
                    }
                }
            }
        }
    }

    return classes;
}

// ── Award Row Editor ──

const AwardRow = ({ award, onChange, onRemove }) => (
    <div className="flex items-center gap-2 p-2 rounded-md bg-background border text-sm">
        <Input
            value={award.placement || award.name || ''}
            onChange={(e) => onChange(award.placement ? 'placement' : 'name', e.target.value)}
            className="h-7 text-xs flex-1 max-w-[140px]"
            placeholder="Placement/Name"
        />
        <Select value={award.awardType || ''} onValueChange={(val) => onChange('awardType', val)}>
            <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue placeholder="Type..." />
            </SelectTrigger>
            <SelectContent>
                {AWARD_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
            </SelectContent>
        </Select>
        <Input
            value={award.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            className="h-7 text-xs flex-1"
            placeholder="Description"
        />
        <Input
            type="number"
            value={award.cost || ''}
            onChange={(e) => onChange('cost', parseFloat(e.target.value) || 0)}
            className="h-7 text-xs w-20 text-right"
            placeholder="$0"
        />
        <Input
            value={award.winner || ''}
            onChange={(e) => onChange('winner', e.target.value)}
            className="h-7 text-xs flex-1 max-w-[160px]"
            placeholder="Winner..."
        />
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={onRemove}>
            <X className="h-3 w-3" />
        </Button>
    </div>
);

// ── Class Awards Card ──

const ClassAwardsCard = ({ cls, awards, onChange, onCopyToAll, onClearAwards }) => {
    const classAwards = awards || [];
    const totalCost = classAwards.reduce((sum, a) => sum + (a.cost || 0), 0);
    const filledWinners = classAwards.filter(a => a.winner).length;

    const updateAward = (idx, field, value) => {
        const updated = classAwards.map((a, i) => i === idx ? { ...a, [field]: value } : a);
        onChange(updated);
    };

    const removeAward = (idx) => {
        onChange(classAwards.filter((_, i) => i !== idx));
    };

    const addAward = () => {
        onChange([...classAwards, { id: uuidv4(), placement: '', awardType: 'Ribbon', description: '', cost: 0, winner: '' }]);
    };

    return (
        <div className="border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Trophy className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-sm">{cls.name}</span>
                    {cls.discipline && <Badge variant="outline" className="text-[10px]">{cls.discipline}</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {filledWinners > 0 && (
                        <span className="text-emerald-600">{filledWinners}/{classAwards.length} winners</span>
                    )}
                    <span>${totalCost.toFixed(2)}</span>
                </div>
            </div>
            <div className="space-y-1">
                {classAwards.map((award, idx) => (
                    <AwardRow
                        key={award.id || idx}
                        award={award}
                        onChange={(field, value) => updateAward(idx, field, value)}
                        onRemove={() => removeAward(idx)}
                    />
                ))}
            </div>
            <div className="flex items-center gap-1 mt-1">
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={addAward}>
                    <Plus className="h-3 w-3 mr-1" /> Add Award
                </Button>
                {classAwards.length > 0 && (
                    <>
                        <Button variant="ghost" size="sm" className="text-xs h-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => onCopyToAll(cls.id)}>
                            <Copy className="h-3 w-3 mr-1" /> Copy to All Empty
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs h-6 text-destructive hover:bg-destructive/10" onClick={() => onClearAwards(cls.id)}>
                            <Trash2 className="h-3 w-3 mr-1" /> Clear All
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

// ── Special Awards Section ──

const SpecialAwardsSection = ({ awards, onChange }) => {
    const addAward = () => {
        onChange([...awards, { id: uuidv4(), name: '', awardType: 'Trophy', description: '', cost: 0, winner: '', criteria: '' }]);
    };

    const updateAward = (idx, field, value) => {
        onChange(awards.map((a, i) => i === idx ? { ...a, [field]: value } : a));
    };

    const removeAward = (idx) => {
        onChange(awards.filter((_, i) => i !== idx));
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" /> Special Awards
                </CardTitle>
                <CardDescription className="text-xs">High Point, All-Around, Sponsor Trophies, Scholarships</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                {awards.map((award, idx) => (
                    <div key={award.id || idx} className="flex items-start gap-2 p-2 rounded-md bg-background border text-sm">
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Input
                                value={award.name || ''}
                                onChange={(e) => updateAward(idx, 'name', e.target.value)}
                                className="h-7 text-xs"
                                placeholder="Award name"
                            />
                            <Select value={award.awardType || ''} onValueChange={(val) => updateAward(idx, 'awardType', val)}>
                                <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {AWARD_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Input
                                value={award.criteria || ''}
                                onChange={(e) => updateAward(idx, 'criteria', e.target.value)}
                                className="h-7 text-xs"
                                placeholder="Criteria / Notes"
                            />
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={award.cost || ''}
                                    onChange={(e) => updateAward(idx, 'cost', parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs w-20 text-right"
                                    placeholder="$0"
                                />
                                <Input
                                    value={award.winner || ''}
                                    onChange={(e) => updateAward(idx, 'winner', e.target.value)}
                                    className="h-7 text-xs flex-1"
                                    placeholder="Winner"
                                />
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 mt-0.5" onClick={() => removeAward(idx)}>
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={addAward}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Special Award
                </Button>
            </CardContent>
        </Card>
    );
};

// ── High Point Awards Section ──

const HighPointSection = ({ awards, onChange }) => {
    const addAward = () => {
        onChange([...awards, { id: uuidv4(), name: '', awardType: 'Trophy', description: '', cost: 0, winner: '', division: '' }]);
    };

    const updateAward = (idx, field, value) => {
        onChange(awards.map((a, i) => i === idx ? { ...a, [field]: value } : a));
    };

    const removeAward = (idx) => {
        onChange(awards.filter((_, i) => i !== idx));
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Medal className="h-4 w-4 text-purple-500" /> High Point Awards
                </CardTitle>
                <CardDescription className="text-xs">Division champions, all-around awards, and point-based recognition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                {awards.map((award, idx) => (
                    <div key={award.id || idx} className="flex items-start gap-2 p-2 rounded-md bg-background border text-sm">
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Input
                                value={award.name || ''}
                                onChange={(e) => updateAward(idx, 'name', e.target.value)}
                                className="h-7 text-xs"
                                placeholder="Award name"
                            />
                            <Input
                                value={award.division || ''}
                                onChange={(e) => updateAward(idx, 'division', e.target.value)}
                                className="h-7 text-xs"
                                placeholder="Division"
                            />
                            <Select value={award.awardType || ''} onValueChange={(val) => updateAward(idx, 'awardType', val)}>
                                <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {AWARD_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={award.cost || ''}
                                    onChange={(e) => updateAward(idx, 'cost', parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs w-20 text-right"
                                    placeholder="$0"
                                />
                                <Input
                                    value={award.winner || ''}
                                    onChange={(e) => updateAward(idx, 'winner', e.target.value)}
                                    className="h-7 text-xs flex-1"
                                    placeholder="Winner"
                                />
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 mt-0.5" onClick={() => removeAward(idx)}>
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={addAward}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add High Point Award
                </Button>
            </CardContent>
        </Card>
    );
};

// ── Main Awards Dashboard ──

const AwardsDashboard = ({ show, onSave, isSaving }) => {
    const pd = show.project_data || {};
    const classes = useMemo(() => getClassesFromShow(pd), [pd]);
    const { toast } = useToast();

    // Load existing awards data or initialize empty
    const [classAwardsMap, setClassAwardsMap] = useState(() => pd.awardsManagement?.classAwards || {});
    const [specialAwards, setSpecialAwards] = useState(() => pd.awardsManagement?.specialAwards || []);
    const [highPointAwards, setHighPointAwards] = useState(() => pd.awardsManagement?.highPointAwards || []);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredClasses = useMemo(() => {
        if (!searchTerm.trim()) return classes;
        const q = searchTerm.toLowerCase();
        return classes.filter(c => c.name.toLowerCase().includes(q) || c.discipline?.toLowerCase().includes(q));
    }, [classes, searchTerm]);

    // Copy awards from one class to all classes that have no awards
    const copyAwardsToAll = useCallback((sourceClassId) => {
        const sourceAwards = classAwardsMap[sourceClassId];
        if (!sourceAwards || sourceAwards.length === 0) return;
        let copiedCount = 0;
        const newMap = { ...classAwardsMap };
        for (const cls of classes) {
            if (cls.id === sourceClassId) continue;
            if (newMap[cls.id]?.length > 0) continue; // skip classes that already have awards
            newMap[cls.id] = sourceAwards.map(a => ({ ...a, id: uuidv4(), winner: '' }));
            copiedCount++;
        }
        setClassAwardsMap(newMap);
        toast({ title: 'Awards Copied', description: `Copied awards to ${copiedCount} class${copiedCount !== 1 ? 'es' : ''} without existing awards.` });
    }, [classes, classAwardsMap, toast]);

    // Clear all awards for a specific class
    const clearClassAwards = useCallback((classId) => {
        setClassAwardsMap(prev => ({ ...prev, [classId]: [] }));
    }, []);

    // Auto-generate awards for all classes
    const autoGenerate = useCallback(() => {
        const newMap = {};
        for (const cls of classes) {
            if (classAwardsMap[cls.id]?.length > 0) {
                newMap[cls.id] = classAwardsMap[cls.id]; // keep existing
            } else {
                newMap[cls.id] = DEFAULT_CLASS_AWARDS.map(a => ({ ...a, id: uuidv4(), winner: '' }));
            }
        }
        setClassAwardsMap(newMap);

        if (highPointAwards.length === 0) {
            setHighPointAwards(DEFAULT_HIGH_POINT.map(a => ({ ...a, id: uuidv4(), winner: '' })));
        }

        toast({ title: 'Awards Generated', description: `Awards created for ${classes.length} classes with default ribbons (1st-6th).` });
    }, [classes, classAwardsMap, highPointAwards, toast]);

    const handleSave = () => {
        onSave({ classAwards: classAwardsMap, specialAwards, highPointAwards });
    };

    // Populate winner fields from finalized results
    const populateFromResults = useCallback(() => {
        const results = pd.results?.classResults;
        if (!results) {
            toast({ title: 'No Results', description: 'No results data found. Enter results in the Results Entry module first.', variant: 'destructive' });
            return;
        }

        let populated = 0;
        const newMap = { ...classAwardsMap };

        // Results are keyed by showBill classBox item.id
        // Awards are keyed by divisionId — we need to match via class name/number
        for (const [resultId, result] of Object.entries(results)) {
            if (result.status !== 'final') continue;

            // Try to find matching award entries by class name or number
            for (const cls of classes) {
                const matchByName = cls.name === result.className;
                const matchById = cls.id === resultId;
                if (!matchByName && !matchById) continue;

                const awards = newMap[cls.id];
                if (!awards || awards.length === 0) continue;

                for (const award of awards) {
                    if (award.winner) continue; // don't overwrite existing winners
                    const placementNum = parseInt(award.placement);
                    if (isNaN(placementNum)) continue;
                    const entry = result.entries?.find(e => e.placing === placementNum && e.riderName?.trim());
                    if (entry) {
                        award.winner = entry.horseName ? `${entry.riderName} / ${entry.horseName}` : entry.riderName;
                        populated++;
                    }
                }
            }
        }

        setClassAwardsMap(newMap);
        toast({ title: 'Winners Populated', description: `Filled in ${populated} winner${populated !== 1 ? 's' : ''} from finalized results.` });
    }, [pd.results, classAwardsMap, classes, toast]);

    // Stats
    const totalClassAwards = Object.values(classAwardsMap).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    const totalCost = useMemo(() => {
        let cost = 0;
        for (const arr of Object.values(classAwardsMap)) {
            for (const a of (arr || [])) cost += (a.cost || 0);
        }
        for (const a of specialAwards) cost += (a.cost || 0);
        for (const a of highPointAwards) cost += (a.cost || 0);
        return cost;
    }, [classAwardsMap, specialAwards, highPointAwards]);

    const totalWinners = useMemo(() => {
        let count = 0;
        for (const arr of Object.values(classAwardsMap)) {
            for (const a of (arr || [])) if (a.winner) count++;
        }
        for (const a of specialAwards) if (a.winner) count++;
        for (const a of highPointAwards) if (a.winner) count++;
        return count;
    }, [classAwardsMap, specialAwards, highPointAwards]);

    const classesWithAwards = Object.keys(classAwardsMap).filter(k => classAwardsMap[k]?.length > 0).length;

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="rounded-xl border p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Classes</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{classes.length}</p>
                </div>
                <div className="rounded-xl border p-4 bg-purple-50 dark:bg-purple-950/20 border-purple-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Classes w/ Awards</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{classesWithAwards}</p>
                </div>
                <div className="rounded-xl border p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Total Awards</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{totalClassAwards + specialAwards.length + highPointAwards.length}</p>
                </div>
                <div className="rounded-xl border p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Winners Tracked</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalWinners}</p>
                </div>
                <div className="rounded-xl border p-4 bg-rose-50 dark:bg-rose-950/20 border-rose-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Est. Cost</p>
                    <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">${totalCost.toFixed(0)}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={autoGenerate} variant="outline">
                    <Wand2 className="h-4 w-4 mr-2" /> Auto-Generate Awards
                </Button>
                {pd.results?.classResults && (
                    <Button onClick={populateFromResults} variant="outline">
                        <Users className="h-4 w-4 mr-2" /> Populate Winners from Results
                    </Button>
                )}
                <div className="flex-1" />
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    {isSaving ? 'Saving...' : 'Save Awards'}
                </Button>
            </div>

            {classes.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Classes Found</h3>
                        <p className="text-sm text-muted-foreground mb-4">Add disciplines and classes in the Show Structure or Create Show wizard first.</p>
                        <p className="text-xs text-muted-foreground">You can still add Special Awards and High Point Awards below.</p>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="classes">
                    <TabsList>
                        <TabsTrigger value="classes">Class Awards ({classesWithAwards}/{classes.length})</TabsTrigger>
                        <TabsTrigger value="highpoint">High Point ({highPointAwards.length})</TabsTrigger>
                        <TabsTrigger value="special">Special ({specialAwards.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="classes" className="space-y-4 mt-4">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search classes..."
                                    className="h-8 pl-8 text-sm"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Showing {filteredClasses.length} of {classes.length} classes
                            </p>
                        </div>
                        <div className="space-y-3">
                            {filteredClasses.map(cls => (
                                <ClassAwardsCard
                                    key={cls.id}
                                    cls={cls}
                                    awards={classAwardsMap[cls.id]}
                                    onChange={(newAwards) => setClassAwardsMap(prev => ({ ...prev, [cls.id]: newAwards }))}
                                    onCopyToAll={copyAwardsToAll}
                                    onClearAwards={clearClassAwards}
                                />
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="highpoint" className="mt-4">
                        <HighPointSection awards={highPointAwards} onChange={setHighPointAwards} />
                    </TabsContent>

                    <TabsContent value="special" className="mt-4">
                        <SpecialAwardsSection awards={specialAwards} onChange={setSpecialAwards} />
                    </TabsContent>
                </Tabs>
            )}

            {/* Always show high point + special if no classes */}
            {classes.length === 0 && (
                <div className="space-y-4">
                    <HighPointSection awards={highPointAwards} onChange={setHighPointAwards} />
                    <SpecialAwardsSection awards={specialAwards} onChange={setSpecialAwards} />
                </div>
            )}
        </div>
    );
};

// ── Main Page ──

const AwardsManagementPage = () => {
    const navigate = useNavigate();
    const { showId } = useParams();
    const { user } = useAuth();
    const { toast } = useToast();
    const [shows, setShows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedShow, setSelectedShow] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchShows = async () => {
            if (!user) { setIsLoading(false); return; }
            const { data, error } = await supabase
                .from('projects')
                .select('id, project_name, project_type, project_data, status, created_at')
                .not('project_type', 'in', '("pattern_folder","pattern_hub","pattern_upload","contract")')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (!error && data) {
                setShows(data);
                if (showId) {
                    const match = data.find(s => s.id === showId);
                    if (match) setSelectedShow(match);
                }
            }
            setIsLoading(false);
        };
        fetchShows();
    }, [user, showId]);

    const handleSave = async ({ classAwards, specialAwards, highPointAwards }) => {
        if (!selectedShow) return;
        setIsSaving(true);
        try {
            const updatedData = stampModuleStatusOnSave({
                ...selectedShow.project_data,
                awardsManagement: { classAwards, specialAwards, highPointAwards },
            }, 'awards');
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            setSelectedShow(prev => ({ ...prev, project_data: updatedData }));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: updatedData } : s));
            toast({ title: 'Awards Saved', description: 'All awards data has been saved successfully.' });
        } catch (error) {
            toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Helmet><title>Awards Management - Horse Show Manager</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <PageHeader
                        title="Awards Management"
                        backTo={showId ? `/horse-show-manager/show/${showId}` : '/horse-show-manager'}
                    />

                    {!showId && (
                        <div className="mb-6">
                            <LinkToExistingShow
                                existingProjects={shows}
                                linkedProjectId={selectedShow?.id || null}
                                onLink={(projectId) => {
                                    if (projectId === 'none') { setSelectedShow(null); return; }
                                    const show = shows.find(s => s.id === projectId);
                                    if (show) setSelectedShow(show);
                                }}
                                description="Link to an existing show to manage its awards."
                            />
                        </div>
                    )}

                    {selectedShow && (
                        <AwardsDashboard show={selectedShow} onSave={handleSave} isSaving={isSaving} />
                    )}
                </main>
            </div>
        </>
    );
};

export default AwardsManagementPage;
