import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Building2, Plus, Trash2, Hash, Calendar,
    ChevronRight, FolderOpen, Users, MapPin, ChevronDown, ChevronUp,
    Wand2, Check, X, GripVertical,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { staffRoles, roleGroups } from '@/lib/staffingData';
import { useToast } from '@/components/ui/use-toast';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';

// ── Default staff positions per arena ──

const DEFAULT_ARENA_STAFF = [
    { roleId: 'JUDGE', required: true, qty: 1 },
    { roleId: 'GATE_MANAGER', required: true, qty: 1 },
    { roleId: 'ANNOUNCER', required: true, qty: 1 },
    { roleId: 'SCRIBE_RING_STEWARD', required: true, qty: 1 },
    { roleId: 'SCORE_RUNNER', required: false, qty: 1 },
    { roleId: 'TIMER', required: false, qty: 0 },
    { roleId: 'ARENA_CREW', required: false, qty: 1 },
];

// ── Shared (show-level) staff positions ──

const SHARED_STAFF = [
    { roleId: 'SHOW_MANAGER', required: true, qty: 1 },
    { roleId: 'SHOW_SECRETARY', required: true, qty: 1 },
    { roleId: 'OFFICE_ASSISTANT', required: false, qty: 1 },
    { roleId: 'SHOW_STEWARD', required: false, qty: 1 },
    { roleId: 'PHOTOGRAPHER', required: false, qty: 1 },
    { roleId: 'AWARDS_COORDINATOR', required: false, qty: 1 },
];

// ── Show Picker ──

const ShowPicker = ({ shows, onSelect }) => {
    const navigate = useNavigate();
    if (shows.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Shows Found</h3>
                    <p className="text-sm text-muted-foreground mb-6">Create a horse show first to set up venues and arenas.</p>
                    <Button onClick={() => navigate('/horse-show-manager/create')}>Create Horse Show</Button>
                </CardContent>
            </Card>
        );
    }
    return (
        <div className="space-y-3">
            {shows.map((show, i) => {
                const pd = show.project_data || {};
                return (
                    <motion.div key={show.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <button type="button" className="w-full text-left" onClick={() => onSelect(show)}>
                            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                                <CardContent className="py-4 px-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-base truncate">{show.project_name || 'Untitled'}</h3>
                                                {pd.showNumber && <Badge variant="secondary" className="text-xs"><Hash className="h-3 w-3 mr-0.5" />#{pd.showNumber}</Badge>}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                {pd.venueName && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{pd.venueName}</span>}
                                                <span>{(pd.arenas || []).length} arenas</span>
                                                {pd.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{pd.startDate}</span>}
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-muted-foreground ml-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        </button>
                    </motion.div>
                );
            })}
        </div>
    );
};

// ── Staff Position Row ──

const StaffPositionRow = ({ position, onUpdate, onRemove }) => {
    const role = staffRoles[position.roleId];
    const Icon = role?.icon || Users;
    return (
        <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-background border">
            <Icon className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium flex-1">{role?.name || position.roleId}</span>
            <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Qty:</Label>
                <Input
                    type="number"
                    min={0}
                    value={position.qty}
                    onChange={(e) => onUpdate('qty', parseInt(e.target.value) || 0)}
                    className="h-7 w-14 text-xs text-center"
                />
            </div>
            <div className="flex items-center gap-1.5">
                <Checkbox
                    checked={position.required}
                    onCheckedChange={(checked) => onUpdate('required', checked)}
                    id={`req-${position.id}`}
                />
                <Label htmlFor={`req-${position.id}`} className="text-xs text-muted-foreground cursor-pointer">Required</Label>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={onRemove}>
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
};

// ── Arena Card ──

const ArenaCard = ({ arena, onUpdate, onRemove, onUpdateStaff }) => {
    const [expanded, setExpanded] = useState(true);
    const staffPositions = arena.staffPositions || [];
    const totalStaff = staffPositions.reduce((sum, p) => sum + (p.qty || 0), 0);
    const requiredStaff = staffPositions.filter(p => p.required).reduce((sum, p) => sum + (p.qty || 0), 0);

    const addStaffPosition = (roleId) => {
        if (staffPositions.find(p => p.roleId === roleId)) return;
        const newPosition = { id: uuidv4(), roleId, qty: 1, required: false };
        onUpdateStaff([...staffPositions, newPosition]);
    };

    const updatePosition = (posId, field, value) => {
        onUpdateStaff(staffPositions.map(p => p.id === posId ? { ...p, [field]: value } : p));
    };

    const removePosition = (posId) => {
        onUpdateStaff(staffPositions.filter(p => p.id !== posId));
    };

    const availableRoles = Object.entries(staffRoles).filter(
        ([id]) => id !== 'CUSTOM' && !staffPositions.find(p => p.roleId === id)
    );

    return (
        <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <Input
                            value={arena.name}
                            onChange={(e) => onUpdate('name', e.target.value)}
                            className="h-8 text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 max-w-xs"
                            placeholder="Arena name..."
                        />
                        <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />{totalStaff} staff ({requiredStaff} required)
                        </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={onRemove}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                {arena.dates && arena.dates.length > 0 && (
                    <div className="flex gap-1 mt-1">
                        {arena.dates.map(d => (
                            <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
                        ))}
                    </div>
                )}
            </CardHeader>
            {expanded && (
                <CardContent className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Staff Positions</p>
                    </div>
                    <div className="space-y-1.5">
                        {staffPositions.map(pos => (
                            <StaffPositionRow
                                key={pos.id}
                                position={pos}
                                onUpdate={(field, value) => updatePosition(pos.id, field, value)}
                                onRemove={() => removePosition(pos.id)}
                            />
                        ))}
                    </div>
                    {availableRoles.length > 0 && (
                        <Select onValueChange={addStaffPosition}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="+ Add staff position..." />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(roleGroups).map(([groupId, group]) => {
                                    const rolesInGroup = availableRoles.filter(([, r]) => r.group === groupId);
                                    if (rolesInGroup.length === 0) return null;
                                    return (
                                        <React.Fragment key={groupId}>
                                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">{group.name}</div>
                                            {rolesInGroup.map(([id, role]) => (
                                                <SelectItem key={id} value={id} className="text-xs">{role.name}</SelectItem>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    )}
                </CardContent>
            )}
        </Card>
    );
};

// ── Venue & Arena Setup Dashboard ──

const VenueArenaSetup = ({ show, onSave, isSaving }) => {
    const pd = show.project_data || {};
    const { toast } = useToast();

    const [venueName, setVenueName] = useState(pd.venueName || '');
    const [venueAddress, setVenueAddress] = useState(pd.venueAddress || '');
    const [arenas, setArenas] = useState(() => {
        const existing = pd.arenas || [];
        return existing.map(a => ({
            ...a,
            staffPositions: a.staffPositions || DEFAULT_ARENA_STAFF.map(s => ({ ...s, id: uuidv4() })),
        }));
    });
    const [sharedStaff, setSharedStaff] = useState(() => {
        return pd.sharedStaff || SHARED_STAFF.map(s => ({ ...s, id: uuidv4() }));
    });

    const addArena = () => {
        const newArena = {
            id: uuidv4(),
            name: `Arena ${String.fromCharCode(65 + arenas.length)}`,
            dates: [],
            staffPositions: DEFAULT_ARENA_STAFF.map(s => ({ ...s, id: uuidv4() })),
        };
        setArenas(prev => [...prev, newArena]);
    };

    const updateArena = (arenaId, field, value) => {
        setArenas(prev => prev.map(a => a.id === arenaId ? { ...a, [field]: value } : a));
    };

    const removeArena = (arenaId) => {
        setArenas(prev => prev.filter(a => a.id !== arenaId));
    };

    const autoGenerateStaff = () => {
        setArenas(prev => prev.map(a => ({
            ...a,
            staffPositions: DEFAULT_ARENA_STAFF.map(s => ({ ...s, id: uuidv4() })),
        })));
        setSharedStaff(SHARED_STAFF.map(s => ({ ...s, id: uuidv4() })));
        toast({ title: 'Staff auto-generated', description: `Default positions applied to ${arenas.length} arena(s).` });
    };

    // Total staff summary
    const totalArenaStaff = arenas.reduce((sum, a) =>
        sum + (a.staffPositions || []).reduce((s, p) => s + (p.qty || 0), 0), 0
    );
    const totalSharedStaff = sharedStaff.reduce((sum, p) => sum + (p.qty || 0), 0);
    const totalStaff = totalArenaStaff + totalSharedStaff;

    // Staff summary table
    const staffSummary = useMemo(() => {
        const map = {};
        for (const arena of arenas) {
            for (const pos of (arena.staffPositions || [])) {
                if (!map[pos.roleId]) map[pos.roleId] = { role: staffRoles[pos.roleId]?.name || pos.roleId, arenas: {}, shared: 0, total: 0 };
                map[pos.roleId].arenas[arena.name] = (map[pos.roleId].arenas[arena.name] || 0) + (pos.qty || 0);
                map[pos.roleId].total += (pos.qty || 0);
            }
        }
        for (const pos of sharedStaff) {
            if (!map[pos.roleId]) map[pos.roleId] = { role: staffRoles[pos.roleId]?.name || pos.roleId, arenas: {}, shared: 0, total: 0 };
            map[pos.roleId].shared += (pos.qty || 0);
            map[pos.roleId].total += (pos.qty || 0);
        }
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [arenas, sharedStaff]);

    const handleSave = () => {
        onSave({ venueName, venueAddress, arenas, sharedStaff });
    };

    return (
        <div className="space-y-6">
            {/* Venue Info */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Venue Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Venue Name</Label>
                            <Input value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="e.g., State Fairgrounds" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Address</Label>
                            <Input value={venueAddress} onChange={e => setVenueAddress(e.target.value)} placeholder="e.g., 123 Main St, City, State" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Arenas</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{arenas.length}</p>
                </div>
                <div className="rounded-xl border p-4 bg-purple-50 dark:bg-purple-950/20 border-purple-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Arena Staff</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{totalArenaStaff}</p>
                </div>
                <div className="rounded-xl border p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Shared Staff</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalSharedStaff}</p>
                </div>
                <div className="rounded-xl border p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Total Staff</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{totalStaff}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
                <Button onClick={addArena} variant="outline">
                    <Plus className="h-4 w-4 mr-2" /> Add Arena
                </Button>
                <Button onClick={autoGenerateStaff} variant="outline">
                    <Wand2 className="h-4 w-4 mr-2" /> Auto-Generate Staff
                </Button>
                <div className="flex-1" />
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    {isSaving ? 'Saving...' : 'Save Setup'}
                </Button>
            </div>

            {/* Arena Cards */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5" /> Arenas ({arenas.length})
                </h3>
                {arenas.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No arenas yet. Click "Add Arena" to get started.</p>
                        </CardContent>
                    </Card>
                ) : (
                    arenas.map(arena => (
                        <ArenaCard
                            key={arena.id}
                            arena={arena}
                            onUpdate={(field, value) => updateArena(arena.id, field, value)}
                            onRemove={() => removeArena(arena.id)}
                            onUpdateStaff={(positions) => updateArena(arena.id, 'staffPositions', positions)}
                        />
                    ))
                )}
            </div>

            {/* Shared Staff */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600" /> Shared / Show-Level Staff</CardTitle>
                    <CardDescription className="text-xs">Staff not assigned to a specific arena (management, office, photography, etc.)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                    {sharedStaff.map(pos => (
                        <StaffPositionRow
                            key={pos.id}
                            position={pos}
                            onUpdate={(field, value) => setSharedStaff(prev => prev.map(p => p.id === pos.id ? { ...p, [field]: value } : p))}
                            onRemove={() => setSharedStaff(prev => prev.filter(p => p.id !== pos.id))}
                        />
                    ))}
                    <Select onValueChange={(roleId) => {
                        if (sharedStaff.find(p => p.roleId === roleId)) return;
                        setSharedStaff(prev => [...prev, { id: uuidv4(), roleId, qty: 1, required: false }]);
                    }}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="+ Add shared staff position..." />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(staffRoles)
                                .filter(([id]) => id !== 'CUSTOM' && !sharedStaff.find(p => p.roleId === id))
                                .map(([id, role]) => (
                                    <SelectItem key={id} value={id} className="text-xs">{role.name}</SelectItem>
                                ))
                            }
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Staff Summary Table */}
            {staffSummary.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Staff Requirements Summary</CardTitle>
                        <CardDescription className="text-xs">Overview of all staff needed across arenas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left px-3 py-2 font-medium">Position</th>
                                        {arenas.map(a => (
                                            <th key={a.id} className="text-center px-3 py-2 font-medium">{a.name}</th>
                                        ))}
                                        <th className="text-center px-3 py-2 font-medium">Shared</th>
                                        <th className="text-right px-3 py-2 font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffSummary.map(row => (
                                        <tr key={row.role} className="border-b last:border-0">
                                            <td className="px-3 py-2 font-medium">{row.role}</td>
                                            {arenas.map(a => (
                                                <td key={a.id} className="px-3 py-2 text-center text-muted-foreground">
                                                    {row.arenas[a.name] || '-'}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2 text-center text-muted-foreground">{row.shared || '-'}</td>
                                            <td className="px-3 py-2 text-right font-semibold">{row.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/30 font-semibold">
                                        <td className="px-3 py-2">Total</td>
                                        {arenas.map(a => {
                                            const arenaTotal = (a.staffPositions || []).reduce((s, p) => s + (p.qty || 0), 0);
                                            return <td key={a.id} className="px-3 py-2 text-center">{arenaTotal}</td>;
                                        })}
                                        <td className="px-3 py-2 text-center">{totalSharedStaff}</td>
                                        <td className="px-3 py-2 text-right">{totalStaff}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

// ── Main Page ──

const VenueArenaSetupPage = () => {
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

    const handleSave = async ({ venueName, venueAddress, arenas, sharedStaff }) => {
        if (!selectedShow) return;
        setIsSaving(true);
        try {
            const updatedData = {
                ...selectedShow.project_data,
                venueName,
                venueAddress,
                arenas,
                sharedStaff,
            };
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            setSelectedShow(prev => ({ ...prev, project_data: updatedData }));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: updatedData } : s));
            toast({ title: 'Venue & Arena Setup Saved', description: 'All changes have been saved successfully.' });
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
            <Helmet><title>Venue & Arena Setup</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex items-center gap-3 mb-8">
                        <Button variant="outline" size="icon" onClick={() => navigate('/horse-show-manager/employee-scheduling')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                <Building2 className="h-6 w-6 text-primary" />
                                Venue & Arena Setup
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Configure venues, arenas, and auto-generate staff positions.
                            </p>
                        </div>
                    </div>

                    {!showId && (
                        <LinkToExistingShow
                            existingProjects={shows}
                            linkedProjectId={selectedShow?.id || null}
                            onLink={(projectId) => {
                                if (projectId === 'none') {
                                    setSelectedShow(null);
                                } else {
                                    const show = shows.find(s => s.id === projectId);
                                    if (show) setSelectedShow(show);
                                }
                            }}
                            description="Link to a show to configure its venue and arena setup."
                        />
                    )}

                    {selectedShow && (
                        <div className="mt-6">
                            <VenueArenaSetup show={selectedShow} onSave={handleSave} isSaving={isSaving} />
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default VenueArenaSetupPage;
