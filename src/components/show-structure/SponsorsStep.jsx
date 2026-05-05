import { useMemo, useState } from 'react';
import { parseDivisionId } from '@/lib/showBillUtils';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PlusCircle, Trash2, HeartHandshake, Crown, Medal, Award, Pencil, Users, Link2, X, Ticket, Building, Sparkles } from 'lucide-react';
import { isBudgetFrozen } from '@/lib/contractUtils';
import { BudgetFrozenBanner } from '@/components/contract-management/BudgetFrozenBanner';
import { cn } from '@/lib/utils';

const LEVEL_ICONS = {
    platinum: Crown,
    gold: Medal,
    silver: Award,
};

const DEFAULT_LEVEL_COLORS = {
    platinum: 'bg-slate-100 text-slate-700 border-slate-300',
    gold: 'bg-amber-50 text-amber-700 border-amber-300',
    silver: 'bg-gray-50 text-gray-600 border-gray-300',
};

// ── Sponsor Level Card (for Level Sponsors tab) ──

const SponsorLevelCard = ({ level, onUpdate, onRemove, sponsorCount, locked }) => {
    const [isEditing, setIsEditing] = useState(false);
    const LevelIcon = LEVEL_ICONS[level.id] || Award;
    const colorClass = DEFAULT_LEVEL_COLORS[level.id] || 'bg-blue-50 text-blue-700 border-blue-300';

    return (
        <div className={cn('border rounded-lg p-4 transition-all', colorClass)}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <LevelIcon className="h-5 w-5" />
                    {isEditing ? (
                        <Input
                            value={level.name}
                            onChange={(e) => onUpdate(level.id, 'name', e.target.value)}
                            className="h-7 w-40 text-sm font-semibold"
                            autoFocus
                            onBlur={() => setIsEditing(false)}
                            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                        />
                    ) : (
                        <h4 className="font-semibold text-base">{level.name}</h4>
                    )}
                    <Badge variant="outline" className="text-xs">{sponsorCount} sponsor{sponsorCount !== 1 ? 's' : ''}</Badge>
                </div>
                <div className="flex items-center gap-1">
                    {!locked && (
                        <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditing(!isEditing)}>
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Remove {level.name} Level?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will remove the level and unassign {sponsorCount} sponsor{sponsorCount !== 1 ? 's' : ''} from it. Sponsors will not be deleted.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onRemove(level.id)} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                    <Label className="text-xs">Price</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">$</span>
                        <Input
                            type="number"
                            value={level.amount}
                            onChange={(e) => onUpdate(level.id, 'amount', parseFloat(e.target.value) || 0)}
                            className="pl-7 h-8 text-sm"
                            disabled={locked}
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Benefits</Label>
                    <Input
                        value={level.benefits || ''}
                        onChange={(e) => onUpdate(level.id, 'benefits', e.target.value)}
                        placeholder="Describe benefits..."
                        className="h-8 text-sm"
                        disabled={locked}
                    />
                </div>
            </div>
        </div>
    );
};

// ── Individual Sponsor Row (for Level Sponsors tab) ──

const SponsorRow = ({ sponsor, levels, classes, onUpdate, onRemove, onLinkClass, onUnlinkClass, locked }) => {
    const level = levels.find(l => l.id === sponsor.levelId);

    return (
        <div className="border rounded-lg p-4 bg-background space-y-3">
            <div className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                        value={sponsor.name}
                        onChange={(e) => onUpdate(sponsor.id, 'name', e.target.value)}
                        placeholder="Sponsor name"
                        disabled={locked}
                    />
                    <Input
                        value={sponsor.contactEmail || ''}
                        onChange={(e) => onUpdate(sponsor.id, 'contactEmail', e.target.value)}
                        placeholder="Contact email"
                        disabled={locked}
                    />
                    <Select
                        value={sponsor.levelId || ''}
                        onValueChange={(val) => onUpdate(sponsor.id, 'levelId', val)}
                        disabled={locked}
                    >
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select level..." />
                        </SelectTrigger>
                        <SelectContent>
                            {levels.map(l => (
                                <SelectItem key={l.id} value={l.id}>
                                    {l.name} — ${l.amount.toLocaleString()}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {!locked && (
                    <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive hover:bg-destructive/10" onClick={() => onRemove(sponsor.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                    value={sponsor.amount || ''}
                    onChange={(e) => onUpdate(sponsor.id, 'amount', e.target.value)}
                    placeholder={level ? `Amount ($${level.amount} suggested)` : 'Amount ($)'}
                    type="number"
                    disabled={locked}
                />
                <Input
                    value={sponsor.notes || ''}
                    onChange={(e) => onUpdate(sponsor.id, 'notes', e.target.value)}
                    placeholder="Notes"
                    disabled={locked}
                />
            </div>

            {/* Class linking */}
            {classes.length > 0 && (
                <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 mb-2">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Linked Classes</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {(sponsor.linkedClassIds || []).map(classId => {
                            const cls = classes.find(c => c.id === classId);
                            return cls ? (
                                <Badge key={classId} variant="secondary" className="text-xs gap-1">
                                    {cls.name}
                                    {!locked && (
                                        <button type="button" onClick={() => onUnlinkClass(sponsor.id, classId)} className="ml-0.5 hover:text-destructive">
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </Badge>
                            ) : null;
                        })}
                        {!locked && (
                            <Select onValueChange={(val) => onLinkClass(sponsor.id, val)}>
                                <SelectTrigger className="h-6 w-36 text-xs">
                                    <SelectValue placeholder="+ Link class" />
                                </SelectTrigger>
                                <SelectContent>
                                    {classes
                                        .filter(c => !(sponsor.linkedClassIds || []).includes(c.id))
                                        .map(cls => (
                                            <SelectItem key={cls.id} value={cls.id} className="text-xs">
                                                {cls.name}
                                            </SelectItem>
                                        ))
                                    }
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Class Sponsor Row ──

const ClassSponsorRow = ({ classSponsor, onUpdate, onRemove, locked }) => (
    <div className="grid grid-cols-12 gap-2 items-center p-3 border rounded-lg bg-background">
        <div className="col-span-12 sm:col-span-4">
            <p className="text-sm font-medium">{classSponsor.className}</p>
            <p className="text-xs text-muted-foreground">{classSponsor.disciplineName}</p>
        </div>
        <div className="col-span-6 sm:col-span-3">
            <Input
                value={classSponsor.sponsorName || ''}
                onChange={(e) => onUpdate(classSponsor.id, 'sponsorName', e.target.value)}
                placeholder="Sponsor name"
                className="h-8 text-sm"
                disabled={locked}
            />
        </div>
        <div className="col-span-4 sm:col-span-2">
            <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                    type="number"
                    value={classSponsor.amount || ''}
                    onChange={(e) => onUpdate(classSponsor.id, 'amount', e.target.value)}
                    placeholder="0"
                    className="pl-5 h-8 text-sm"
                    disabled={locked}
                />
            </div>
        </div>
        <div className="col-span-6 sm:col-span-2">
            <Input
                value={classSponsor.contactEmail || ''}
                onChange={(e) => onUpdate(classSponsor.id, 'contactEmail', e.target.value)}
                placeholder="Email"
                className="h-8 text-sm"
                disabled={locked}
            />
        </div>
        <div className="col-span-2 sm:col-span-1 flex justify-end">
            {!locked && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => onRemove(classSponsor.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>
    </div>
);

// ── Arena Sponsor Row ──

const ArenaSponsorRow = ({ arenaSponsor, onUpdate, onRemove, locked }) => (
    <div className="grid grid-cols-12 gap-2 items-center p-3 border rounded-lg bg-background">
        <div className="col-span-12 sm:col-span-3">
            <p className="text-sm font-medium">{arenaSponsor.arenaName}</p>
        </div>
        <div className="col-span-6 sm:col-span-3">
            <Input
                value={arenaSponsor.sponsorName || ''}
                onChange={(e) => onUpdate(arenaSponsor.id, 'sponsorName', e.target.value)}
                placeholder="Sponsor name"
                className="h-8 text-sm"
                disabled={locked}
            />
        </div>
        <div className="col-span-4 sm:col-span-2">
            <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                    type="number"
                    value={arenaSponsor.amount || ''}
                    onChange={(e) => onUpdate(arenaSponsor.id, 'amount', e.target.value)}
                    placeholder="0"
                    className="pl-5 h-8 text-sm"
                    disabled={locked}
                />
            </div>
        </div>
        <div className="col-span-6 sm:col-span-3">
            <Input
                value={arenaSponsor.contactEmail || ''}
                onChange={(e) => onUpdate(arenaSponsor.id, 'contactEmail', e.target.value)}
                placeholder="Email"
                className="h-8 text-sm"
                disabled={locked}
            />
        </div>
        <div className="col-span-2 sm:col-span-1 flex justify-end">
            {!locked && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => onRemove(arenaSponsor.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>
    </div>
);

// ── Custom Sponsor Row ──

const CustomSponsorRow = ({ sponsor, onUpdate, onRemove, locked }) => (
    <div className="border rounded-lg p-4 bg-background space-y-3">
        <div className="flex items-center gap-2">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                    value={sponsor.name || ''}
                    onChange={(e) => onUpdate(sponsor.id, 'name', e.target.value)}
                    placeholder="Sponsor name"
                    disabled={locked}
                />
                <Input
                    value={sponsor.contactEmail || ''}
                    onChange={(e) => onUpdate(sponsor.id, 'contactEmail', e.target.value)}
                    placeholder="Contact email"
                    disabled={locked}
                />
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                        type="number"
                        value={sponsor.amount || ''}
                        onChange={(e) => onUpdate(sponsor.id, 'amount', e.target.value)}
                        placeholder="Amount"
                        className="pl-7"
                        disabled={locked}
                    />
                </div>
            </div>
            {!locked && (
                <Button variant="ghost" size="icon" className="flex-shrink-0 text-destructive hover:bg-destructive/10" onClick={() => onRemove(sponsor.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
                value={sponsor.description || ''}
                onChange={(e) => onUpdate(sponsor.id, 'description', e.target.value)}
                placeholder="Sponsorship description (e.g., Banner sponsorship, Program ad)"
                disabled={locked}
            />
            <Input
                value={sponsor.notes || ''}
                onChange={(e) => onUpdate(sponsor.id, 'notes', e.target.value)}
                placeholder="Notes"
                disabled={locked}
            />
        </div>
    </div>
);

// ── Main Component ──

export const SponsorsStep = ({ formData, setFormData }) => {
    const sponsorLevels = formData.sponsorLevels || [];
    const sponsors = formData.sponsors || [];
    const classSponsors = formData.classSponsors || [];
    const arenaSponsors = formData.arenaSponsors || [];
    const customSponsors = formData.customSponsors || [];
    const locked = isBudgetFrozen(formData);

    // Derive classes from disciplines
    const classes = useMemo(() => {
        const disciplines = formData.disciplines || [];
        const items = [];
        for (const disc of disciplines) {
            for (const divId of (disc.divisionOrder || [])) {
                const name = disc.divisionPrintTitles?.[divId] || parseDivisionId(divId).divisionName;
                items.push({ id: divId, name, disciplineName: disc.name });
            }
        }
        return items;
    }, [formData.disciplines]);

    // Derive arenas
    const arenas = useMemo(() => formData.arenas || [], [formData.arenas]);

    // ══════════════════════════════
    // Level Sponsor CRUD
    // ══════════════════════════════

    const updateLevel = (levelId, field, value) => {
        setFormData(prev => ({
            ...prev,
            sponsorLevels: (prev.sponsorLevels || []).map(l => l.id === levelId ? { ...l, [field]: value } : l),
        }));
    };

    const removeLevel = (levelId) => {
        setFormData(prev => ({
            ...prev,
            sponsorLevels: (prev.sponsorLevels || []).filter(l => l.id !== levelId),
            sponsors: (prev.sponsors || []).map(s => s.levelId === levelId ? { ...s, levelId: '' } : s),
        }));
    };

    const addLevel = () => {
        const newLevel = {
            id: uuidv4(),
            name: 'New Level',
            amount: 0,
            color: '#60a5fa',
            benefits: '',
        };
        setFormData(prev => ({
            ...prev,
            sponsorLevels: [...(prev.sponsorLevels || []), newLevel],
        }));
    };

    const addSponsor = (levelId) => {
        const level = sponsorLevels.find(l => l.id === levelId);
        const newSponsor = {
            id: uuidv4(),
            name: '',
            contactEmail: '',
            levelId: levelId || '',
            amount: level ? level.amount : '',
            notes: '',
            linkedClassIds: [],
        };
        setFormData(prev => ({
            ...prev,
            sponsors: [...(prev.sponsors || []), newSponsor],
        }));
    };

    const updateSponsor = (sponsorId, field, value) => {
        setFormData(prev => {
            let updatedSponsors = (prev.sponsors || []).map(s => {
                if (s.id !== sponsorId) return s;
                const updated = { ...s, [field]: value };
                if (field === 'levelId') {
                    const newLevel = (prev.sponsorLevels || []).find(l => l.id === value);
                    const oldLevel = (prev.sponsorLevels || []).find(l => l.id === s.levelId);
                    const currentAmount = parseFloat(s.amount) || 0;
                    if (newLevel && (currentAmount === 0 || (oldLevel && currentAmount === oldLevel.amount))) {
                        updated.amount = newLevel.amount;
                    }
                }
                return updated;
            });
            return { ...prev, sponsors: updatedSponsors };
        });
    };

    const removeSponsor = (sponsorId) => {
        setFormData(prev => ({
            ...prev,
            sponsors: (prev.sponsors || []).filter(s => s.id !== sponsorId),
        }));
    };

    const linkClass = (sponsorId, classId) => {
        setFormData(prev => ({
            ...prev,
            sponsors: (prev.sponsors || []).map(s =>
                s.id === sponsorId
                    ? { ...s, linkedClassIds: [...(s.linkedClassIds || []), classId] }
                    : s
            ),
        }));
    };

    const unlinkClass = (sponsorId, classId) => {
        setFormData(prev => ({
            ...prev,
            sponsors: (prev.sponsors || []).map(s =>
                s.id === sponsorId
                    ? { ...s, linkedClassIds: (s.linkedClassIds || []).filter(id => id !== classId) }
                    : s
            ),
        }));
    };

    // ══════════════════════════════
    // Class Sponsor CRUD
    // ══════════════════════════════

    const addClassSponsor = (cls) => {
        const newEntry = {
            id: uuidv4(),
            classId: cls.id,
            className: cls.name,
            disciplineName: cls.disciplineName,
            sponsorName: '',
            amount: '',
            contactEmail: '',
            notes: '',
        };
        setFormData(prev => ({
            ...prev,
            classSponsors: [...(prev.classSponsors || []), newEntry],
        }));
    };

    const addAllClassSponsors = () => {
        const existingClassIds = new Set(classSponsors.map(cs => cs.classId));
        const newEntries = classes
            .filter(cls => !existingClassIds.has(cls.id))
            .map(cls => ({
                id: uuidv4(),
                classId: cls.id,
                className: cls.name,
                disciplineName: cls.disciplineName,
                sponsorName: '',
                amount: '',
                contactEmail: '',
                notes: '',
            }));
        if (newEntries.length > 0) {
            setFormData(prev => ({
                ...prev,
                classSponsors: [...(prev.classSponsors || []), ...newEntries],
            }));
        }
    };

    const updateClassSponsor = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            classSponsors: (prev.classSponsors || []).map(cs => cs.id === id ? { ...cs, [field]: value } : cs),
        }));
    };

    const removeClassSponsor = (id) => {
        setFormData(prev => ({
            ...prev,
            classSponsors: (prev.classSponsors || []).filter(cs => cs.id !== id),
        }));
    };

    // ══════════════════════════════
    // Arena Sponsor CRUD
    // ══════════════════════════════

    const addArenaSponsor = (arena) => {
        const newEntry = {
            id: uuidv4(),
            arenaId: arena.id,
            arenaName: arena.name,
            sponsorName: '',
            amount: '',
            contactEmail: '',
            notes: '',
        };
        setFormData(prev => ({
            ...prev,
            arenaSponsors: [...(prev.arenaSponsors || []), newEntry],
        }));
    };

    const addAllArenaSponsors = () => {
        const existingArenaIds = new Set(arenaSponsors.map(as => as.arenaId));
        const newEntries = arenas
            .filter(a => !existingArenaIds.has(a.id))
            .map(arena => ({
                id: uuidv4(),
                arenaId: arena.id,
                arenaName: arena.name,
                sponsorName: '',
                amount: '',
                contactEmail: '',
                notes: '',
            }));
        if (newEntries.length > 0) {
            setFormData(prev => ({
                ...prev,
                arenaSponsors: [...(prev.arenaSponsors || []), ...newEntries],
            }));
        }
    };

    const updateArenaSponsor = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            arenaSponsors: (prev.arenaSponsors || []).map(as => as.id === id ? { ...as, [field]: value } : as),
        }));
    };

    const removeArenaSponsor = (id) => {
        setFormData(prev => ({
            ...prev,
            arenaSponsors: (prev.arenaSponsors || []).filter(as => as.id !== id),
        }));
    };

    // ══════════════════════════════
    // Custom Sponsor CRUD
    // ══════════════════════════════

    const addCustomSponsor = () => {
        const newSponsor = {
            id: uuidv4(),
            name: '',
            description: '',
            amount: '',
            contactEmail: '',
            notes: '',
        };
        setFormData(prev => ({
            ...prev,
            customSponsors: [...(prev.customSponsors || []), newSponsor],
        }));
    };

    const updateCustomSponsor = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            customSponsors: (prev.customSponsors || []).map(cs => cs.id === id ? { ...cs, [field]: value } : cs),
        }));
    };

    const removeCustomSponsor = (id) => {
        setFormData(prev => ({
            ...prev,
            customSponsors: (prev.customSponsors || []).filter(cs => cs.id !== id),
        }));
    };

    // ── Sponsorship program details ──
    const handleDetailChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            showDetails: {
                ...prev.showDetails,
                [section]: {
                    ...(prev.showDetails?.[section] || {}),
                    [field]: value
                }
            }
        }));
    };

    // ══════════════════════════════
    // Stats
    // ══════════════════════════════

    const levelSponsorRevenue = useMemo(() =>
        sponsors.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0),
    [sponsors]);

    const classSponsorRevenue = useMemo(() =>
        classSponsors.reduce((sum, cs) => sum + (parseFloat(cs.amount) || 0), 0),
    [classSponsors]);

    const arenaSponsorRevenue = useMemo(() =>
        arenaSponsors.reduce((sum, as) => sum + (parseFloat(as.amount) || 0), 0),
    [arenaSponsors]);

    const customSponsorRevenue = useMemo(() =>
        customSponsors.reduce((sum, cs) => sum + (parseFloat(cs.amount) || 0), 0),
    [customSponsors]);

    const totalSponsorshipRevenue = levelSponsorRevenue + classSponsorRevenue + arenaSponsorRevenue + customSponsorRevenue;

    const sponsorsByLevel = useMemo(() => {
        const map = {};
        for (const level of sponsorLevels) {
            map[level.id] = sponsors.filter(s => s.levelId === level.id);
        }
        map['unassigned'] = sponsors.filter(s => !s.levelId || !sponsorLevels.find(l => l.id === s.levelId));
        return map;
    }, [sponsors, sponsorLevels]);

    // Count badges for tabs
    const classSponsorCount = classSponsors.filter(cs => cs.sponsorName).length;
    const arenaSponsorCount = arenaSponsors.filter(as => as.sponsorName).length;
    const customSponsorCount = customSponsors.filter(cs => cs.name).length;

    // Classes not yet added as class sponsors
    const availableClassesForSponsors = useMemo(() => {
        const usedClassIds = new Set(classSponsors.map(cs => cs.classId));
        return classes.filter(cls => !usedClassIds.has(cls.id));
    }, [classes, classSponsors]);

    // Arenas not yet added as arena sponsors
    const availableArenasForSponsors = useMemo(() => {
        const usedArenaIds = new Set(arenaSponsors.map(as => as.arenaId));
        return arenas.filter(a => !usedArenaIds.has(a.id));
    }, [arenas, arenaSponsors]);

    return (
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <HeartHandshake className="h-6 w-6 text-emerald-600" />
                    Sponsor Management
                </CardTitle>
                <CardDescription>
                    Define sponsorship levels, add sponsors, and link them to show classes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">

                {locked && <BudgetFrozenBanner />}

                {/* Revenue Summary */}
                {totalSponsorshipRevenue > 0 && (
                    <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                        <div>
                            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Total Sponsorship Revenue</p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                {sponsors.length + classSponsorCount + arenaSponsorCount + customSponsorCount} sponsor{(sponsors.length + classSponsorCount + arenaSponsorCount + customSponsorCount) !== 1 ? 's' : ''} across {
                                    [
                                        sponsorLevels.length > 0 && 'levels',
                                        classSponsorCount > 0 && 'classes',
                                        arenaSponsorCount > 0 && 'arenas',
                                        customSponsorCount > 0 && 'custom',
                                    ].filter(Boolean).join(', ')
                                }
                            </p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">${totalSponsorshipRevenue.toLocaleString()}</p>
                    </div>
                )}

                {/* ── Sponsor Type Tabs ── */}
                <Tabs defaultValue="level" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="level" className="text-xs sm:text-sm gap-1">
                            <Crown className="h-3.5 w-3.5 hidden sm:inline" />
                            Level
                            {sponsors.length > 0 && <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{sponsors.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="class" className="text-xs sm:text-sm gap-1">
                            <Ticket className="h-3.5 w-3.5 hidden sm:inline" />
                            Class
                            {classSponsorCount > 0 && <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{classSponsorCount}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="arena" className="text-xs sm:text-sm gap-1">
                            <Building className="h-3.5 w-3.5 hidden sm:inline" />
                            Arena
                            {arenaSponsorCount > 0 && <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{arenaSponsorCount}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="custom" className="text-xs sm:text-sm gap-1">
                            <Sparkles className="h-3.5 w-3.5 hidden sm:inline" />
                            Custom
                            {customSponsorCount > 0 && <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{customSponsorCount}</Badge>}
                        </TabsTrigger>
                    </TabsList>

                    {/* ════════════════════════════════════════════ */}
                    {/* TAB 1: Level Sponsors                       */}
                    {/* ════════════════════════════════════════════ */}
                    <TabsContent value="level" className="space-y-6 mt-4">
                        {/* Sponsor Levels */}
                        <Card className="bg-background/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Sponsor Levels</CardTitle>
                                <CardDescription>Define pricing tiers and benefits for each sponsorship level.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {sponsorLevels.map(level => (
                                    <SponsorLevelCard
                                        key={level.id}
                                        level={level}
                                        onUpdate={updateLevel}
                                        onRemove={removeLevel}
                                        sponsorCount={(sponsorsByLevel[level.id] || []).length}
                                        locked={locked}
                                    />
                                ))}
                                {!locked && (
                                    <Button variant="outline" size="sm" className="w-full" onClick={addLevel}>
                                        <PlusCircle className="h-4 w-4 mr-2" /> Add Sponsor Level
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        {/* Sponsors by Level */}
                        <Card className="bg-background/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Sponsors
                                </CardTitle>
                                <CardDescription>Add sponsors and assign them to levels. Link sponsors to specific classes.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Accordion type="multiple" defaultValue={sponsorLevels.map(l => l.id)} className="w-full">
                                    {sponsorLevels.map(level => {
                                        const levelSponsors = sponsorsByLevel[level.id] || [];
                                        const LevelIcon = LEVEL_ICONS[level.id] || Award;
                                        return (
                                            <AccordionItem key={level.id} value={level.id}>
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="flex items-center gap-2">
                                                        <LevelIcon className="h-4 w-4" />
                                                        <span className="font-semibold">{level.name}</span>
                                                        <Badge variant="outline" className="text-xs ml-1">
                                                            {levelSponsors.length} sponsor{levelSponsors.length !== 1 ? 's' : ''}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            ${level.amount.toLocaleString()}/ea
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="space-y-3 pt-2">
                                                    {levelSponsors.map(sponsor => (
                                                        <SponsorRow
                                                            key={sponsor.id}
                                                            sponsor={sponsor}
                                                            levels={sponsorLevels}
                                                            classes={classes}
                                                            onUpdate={updateSponsor}
                                                            onRemove={removeSponsor}
                                                            onLinkClass={linkClass}
                                                            onUnlinkClass={unlinkClass}
                                                            locked={locked}
                                                        />
                                                    ))}
                                                    {levelSponsors.length === 0 && (
                                                        <p className="text-sm text-muted-foreground text-center py-4">No sponsors at this level yet.</p>
                                                    )}
                                                    {!locked && (
                                                        <Button variant="outline" size="sm" className="w-full" onClick={() => addSponsor(level.id)}>
                                                            <PlusCircle className="h-4 w-4 mr-2" /> Add {level.name} Sponsor
                                                        </Button>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}

                                    {/* Unassigned sponsors */}
                                    {(sponsorsByLevel['unassigned'] || []).length > 0 && (
                                        <AccordionItem value="unassigned">
                                            <AccordionTrigger className="hover:no-underline">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-muted-foreground">Unassigned</span>
                                                    <Badge variant="outline" className="text-xs">
                                                        {sponsorsByLevel['unassigned'].length}
                                                    </Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="space-y-3 pt-2">
                                                {sponsorsByLevel['unassigned'].map(sponsor => (
                                                    <SponsorRow
                                                        key={sponsor.id}
                                                        sponsor={sponsor}
                                                        levels={sponsorLevels}
                                                        classes={classes}
                                                        onUpdate={updateSponsor}
                                                        onRemove={removeSponsor}
                                                        onLinkClass={linkClass}
                                                        onUnlinkClass={unlinkClass}
                                                        locked={locked}
                                                    />
                                                ))}
                                            </AccordionContent>
                                        </AccordionItem>
                                    )}
                                </Accordion>

                                {!locked && (
                                    <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => addSponsor('')}>
                                        <PlusCircle className="h-4 w-4 mr-2" /> Add Sponsor (Unassigned)
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        {levelSponsorRevenue > 0 && (
                            <div className="text-right text-sm font-semibold text-emerald-600">
                                Level Sponsor Revenue: ${levelSponsorRevenue.toLocaleString()}
                            </div>
                        )}
                    </TabsContent>

                    {/* ════════════════════════════════════════════ */}
                    {/* TAB 2: Class Sponsors                       */}
                    {/* ════════════════════════════════════════════ */}
                    <TabsContent value="class" className="space-y-6 mt-4">
                        <Card className="bg-background/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Ticket className="h-5 w-5 text-blue-600" />
                                    Class Sponsors
                                </CardTitle>
                                <CardDescription>
                                    Assign sponsors to individual classes. Each class can have its own sponsor and sponsorship amount.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {classes.length === 0 ? (
                                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                                        <Ticket className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-muted-foreground font-medium">No classes available</p>
                                        <p className="text-sm text-muted-foreground mt-1">Add disciplines and divisions first to assign class sponsors.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Header row */}
                                        <div className="grid grid-cols-12 gap-2 px-3 text-xs font-medium text-muted-foreground">
                                            <div className="col-span-4">Class</div>
                                            <div className="col-span-3">Sponsor Name</div>
                                            <div className="col-span-2">Amount</div>
                                            <div className="col-span-2">Email</div>
                                            <div className="col-span-1"></div>
                                        </div>

                                        {/* Class sponsor rows */}
                                        {classSponsors.map(cs => (
                                            <ClassSponsorRow
                                                key={cs.id}
                                                classSponsor={cs}
                                                onUpdate={updateClassSponsor}
                                                onRemove={removeClassSponsor}
                                                locked={locked}
                                            />
                                        ))}

                                        {classSponsors.length === 0 && (
                                            <div className="text-center py-6 border-2 border-dashed rounded-lg">
                                                <p className="text-sm text-muted-foreground">No class sponsors added yet. Add classes below to assign sponsors.</p>
                                            </div>
                                        )}

                                        {/* Add buttons */}
                                        {!locked && availableClassesForSponsors.length > 0 && (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <Select onValueChange={(val) => {
                                                    const cls = classes.find(c => c.id === val);
                                                    if (cls) addClassSponsor(cls);
                                                }}>
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Add a class for sponsorship..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableClassesForSponsors.map(cls => (
                                                            <SelectItem key={cls.id} value={cls.id}>
                                                                {cls.disciplineName} — {cls.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="outline" size="sm" onClick={addAllClassSponsors} className="whitespace-nowrap">
                                                    <PlusCircle className="h-4 w-4 mr-2" /> Add All Classes
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {classSponsorRevenue > 0 && (
                                    <div className="text-right text-sm font-semibold text-emerald-600 pt-2 border-t">
                                        Class Sponsor Revenue: ${classSponsorRevenue.toLocaleString()}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ════════════════════════════════════════════ */}
                    {/* TAB 3: Arena Sponsors                       */}
                    {/* ════════════════════════════════════════════ */}
                    <TabsContent value="arena" className="space-y-6 mt-4">
                        <Card className="bg-background/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Building className="h-5 w-5 text-purple-600" />
                                    Arena Sponsors
                                </CardTitle>
                                <CardDescription>
                                    Assign sponsors to arenas. Great for arena naming rights and arena-specific banner placements.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {arenas.length === 0 ? (
                                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                                        <Building className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-muted-foreground font-medium">No arenas available</p>
                                        <p className="text-sm text-muted-foreground mt-1">Add arenas in the venue setup step first.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Header row */}
                                        <div className="grid grid-cols-12 gap-2 px-3 text-xs font-medium text-muted-foreground">
                                            <div className="col-span-3">Arena</div>
                                            <div className="col-span-3">Sponsor Name</div>
                                            <div className="col-span-2">Amount</div>
                                            <div className="col-span-3">Email</div>
                                            <div className="col-span-1"></div>
                                        </div>

                                        {/* Arena sponsor rows */}
                                        {arenaSponsors.map(as => (
                                            <ArenaSponsorRow
                                                key={as.id}
                                                arenaSponsor={as}
                                                onUpdate={updateArenaSponsor}
                                                onRemove={removeArenaSponsor}
                                                locked={locked}
                                            />
                                        ))}

                                        {arenaSponsors.length === 0 && (
                                            <div className="text-center py-6 border-2 border-dashed rounded-lg">
                                                <p className="text-sm text-muted-foreground">No arena sponsors added yet. Add arenas below to assign sponsors.</p>
                                            </div>
                                        )}

                                        {/* Add buttons */}
                                        {!locked && availableArenasForSponsors.length > 0 && (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <Select onValueChange={(val) => {
                                                    const arena = arenas.find(a => a.id === val);
                                                    if (arena) addArenaSponsor(arena);
                                                }}>
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Add an arena for sponsorship..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableArenasForSponsors.map(arena => (
                                                            <SelectItem key={arena.id} value={arena.id}>
                                                                {arena.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="outline" size="sm" onClick={addAllArenaSponsors} className="whitespace-nowrap">
                                                    <PlusCircle className="h-4 w-4 mr-2" /> Add All Arenas
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {arenaSponsorRevenue > 0 && (
                                    <div className="text-right text-sm font-semibold text-emerald-600 pt-2 border-t">
                                        Arena Sponsor Revenue: ${arenaSponsorRevenue.toLocaleString()}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ════════════════════════════════════════════ */}
                    {/* TAB 4: Custom Sponsors                      */}
                    {/* ════════════════════════════════════════════ */}
                    <TabsContent value="custom" className="space-y-6 mt-4">
                        <Card className="bg-background/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-orange-600" />
                                    Custom Sponsors
                                </CardTitle>
                                <CardDescription>
                                    Add any other sponsorship arrangements that don't fit into levels, classes, or arenas (e.g., program ads, banner sponsors, media sponsors).
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {customSponsors.map(sponsor => (
                                    <CustomSponsorRow
                                        key={sponsor.id}
                                        sponsor={sponsor}
                                        onUpdate={updateCustomSponsor}
                                        onRemove={removeCustomSponsor}
                                        locked={locked}
                                    />
                                ))}

                                {customSponsors.length === 0 && (
                                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                                        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-muted-foreground font-medium">No custom sponsors yet</p>
                                        <p className="text-sm text-muted-foreground mt-1">Add sponsors for program ads, banners, media partnerships, and more.</p>
                                    </div>
                                )}

                                {!locked && (
                                    <Button variant="outline" size="sm" className="w-full" onClick={addCustomSponsor}>
                                        <PlusCircle className="h-4 w-4 mr-2" /> Add Custom Sponsor
                                    </Button>
                                )}

                                {customSponsorRevenue > 0 && (
                                    <div className="text-right text-sm font-semibold text-emerald-600 pt-2 border-t">
                                        Custom Sponsor Revenue: ${customSponsorRevenue.toLocaleString()}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* ── Section: Sponsorship Program Details ── */}
                <Card className="bg-background/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Sponsorship Program Details</CardTitle>
                        <CardDescription>Additional details for the show bill / program.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="sponsorship-presentingSponsors">Presenting Sponsors</Label>
                                <Textarea id="sponsorship-presentingSponsors" value={formData.showDetails?.sponsorship?.presentingSponsors || ''} onChange={e => handleDetailChange('sponsorship', 'presentingSponsors', e.target.value)} placeholder="Top-tier logo placement details..." disabled={locked} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sponsorship-classSponsors">Class Sponsors</Label>
                                <Textarea id="sponsorship-classSponsors" value={formData.showDetails?.sponsorship?.classSponsors || ''} onChange={e => handleDetailChange('sponsorship', 'classSponsors', e.target.value)} placeholder="Specific awards/class announcements..." disabled={locked} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sponsorship-vendors">Commercial Exhibitors / Vendors</Label>
                                <Textarea id="sponsorship-vendors" value={formData.showDetails?.sponsorship?.vendors || ''} onChange={e => handleDetailChange('sponsorship', 'vendors', e.target.value)} placeholder="Booth listings, locations..." disabled={locked} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sponsorship-qrLinks">QR Codes / Links</Label>
                                <Textarea id="sponsorship-qrLinks" value={formData.showDetails?.sponsorship?.qrLinks || ''} onChange={e => handleDetailChange('sponsorship', 'qrLinks', e.target.value)} placeholder="Sponsor offers, raffle entries, vendor coupons..." disabled={locked} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Comprehensive Summary Table ── */}
                {totalSponsorshipRevenue > 0 && (
                    <Card className="bg-background/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Sponsorship Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left px-3 py-2 font-medium">Type</th>
                                            <th className="text-left px-3 py-2 font-medium">Details</th>
                                            <th className="text-center px-3 py-2 font-medium">Count</th>
                                            <th className="text-right px-3 py-2 font-medium">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Level sponsors */}
                                        {sponsorLevels.map(level => {
                                            const lvlSponsors = sponsorsByLevel[level.id] || [];
                                            const lvlRevenue = lvlSponsors.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
                                            if (lvlSponsors.length === 0) return null;
                                            return (
                                                <tr key={level.id} className="border-b">
                                                    <td className="px-3 py-2">
                                                        <Badge variant="outline" className="text-xs">Level</Badge>
                                                    </td>
                                                    <td className="px-3 py-2 font-medium">{level.name} — ${level.amount.toLocaleString()}/ea</td>
                                                    <td className="px-3 py-2 text-center">{lvlSponsors.length}</td>
                                                    <td className="px-3 py-2 text-right font-medium">${lvlRevenue.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}

                                        {/* Class sponsors */}
                                        {classSponsorCount > 0 && (
                                            <tr className="border-b">
                                                <td className="px-3 py-2">
                                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Class</Badge>
                                                </td>
                                                <td className="px-3 py-2 font-medium">
                                                    {classSponsors.filter(cs => cs.sponsorName).map(cs => cs.className).join(', ')}
                                                </td>
                                                <td className="px-3 py-2 text-center">{classSponsorCount}</td>
                                                <td className="px-3 py-2 text-right font-medium">${classSponsorRevenue.toLocaleString()}</td>
                                            </tr>
                                        )}

                                        {/* Arena sponsors */}
                                        {arenaSponsorCount > 0 && (
                                            <tr className="border-b">
                                                <td className="px-3 py-2">
                                                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">Arena</Badge>
                                                </td>
                                                <td className="px-3 py-2 font-medium">
                                                    {arenaSponsors.filter(as => as.sponsorName).map(as => as.arenaName).join(', ')}
                                                </td>
                                                <td className="px-3 py-2 text-center">{arenaSponsorCount}</td>
                                                <td className="px-3 py-2 text-right font-medium">${arenaSponsorRevenue.toLocaleString()}</td>
                                            </tr>
                                        )}

                                        {/* Custom sponsors */}
                                        {customSponsorCount > 0 && (
                                            <tr className="border-b">
                                                <td className="px-3 py-2">
                                                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">Custom</Badge>
                                                </td>
                                                <td className="px-3 py-2 font-medium">
                                                    {customSponsors.filter(cs => cs.name).map(cs => cs.name).join(', ')}
                                                </td>
                                                <td className="px-3 py-2 text-center">{customSponsorCount}</td>
                                                <td className="px-3 py-2 text-right font-medium">${customSponsorRevenue.toLocaleString()}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-muted/30 font-semibold">
                                            <td className="px-3 py-2" colSpan={2}>Total</td>
                                            <td className="px-3 py-2 text-center">
                                                {sponsors.length + classSponsorCount + arenaSponsorCount + customSponsorCount}
                                            </td>
                                            <td className="px-3 py-2 text-right">${totalSponsorshipRevenue.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

            </CardContent>
        </motion.div>
    );
};
