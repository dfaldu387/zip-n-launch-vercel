import React, { useState, useMemo, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Pencil, Trash2, Trophy, ListChecks, Loader2, ListPlus } from 'lucide-react';

const LEVEL_OPTIONS = [
    { id: 'ALL', label: 'All Levels' },
    { id: 'L1', label: 'Level 1 (L1)' },
    { id: 'L2', label: 'Level 2 (L2)' },
    { id: 'L3', label: 'Level 3 (L3)' },
    { id: 'GR/NOV', label: 'Green / Novice' },
    { id: 'Championship', label: 'Championship' },
    { id: 'Skilled', label: 'Skilled' },
    { id: 'Intermediate', label: 'Intermediate' },
    { id: 'Beginner', label: 'Beginner' },
    { id: 'Walk-Trot', label: 'Walk-Trot' },
];

// ---------------------------------------------------------------------------
// Auto-class extraction: derive classes from existing disciplines/patternGroups
// ---------------------------------------------------------------------------
const extractAutoClasses = (projectData, affiliations) => {
    const disciplines = projectData.disciplines || [];
    const patternSelections = projectData.patternSelections || {};
    const autoClasses = [];

    for (const discipline of disciplines) {
        const groups = discipline.patternGroups || [];
        const associationId = discipline.association_id || '';

        const assocObj = affiliations.find(a =>
            a.id === associationId || a.abbreviation === associationId
        );
        const associationName = assocObj?.abbreviation || assocObj?.name || associationId;

        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            const group = groups[groupIndex];
            const groupId = group.id || `pattern-group-${groupIndex}`;
            const divisions = group.divisions || [];

            // Check pattern assignment
            const discSelections = patternSelections[discipline.id]
                || patternSelections[discipline.name]
                || patternSelections[groupIndex] || {};
            const patternSelection = discSelections[groupId]
                || discSelections[groupIndex] || null;
            const hasPattern = !!patternSelection;

            let patternLevel = 'ALL';
            if (patternSelection && typeof patternSelection === 'object') {
                patternLevel = patternSelection.version || 'ALL';
            }

            if (divisions.length === 0) {
                autoClasses.push({
                    id: `auto::${discipline.id}::${groupId}::no-division`,
                    name: `${discipline.name} - ${group.name || `Group ${groupIndex + 1}`}`,
                    division: 'Unassigned',
                    level: patternLevel,
                    associationId,
                    associationName,
                    disciplineName: discipline.name,
                    groupName: group.name || `Group ${groupIndex + 1}`,
                    source: 'pattern',
                    hasPattern,
                    competitionDate: group.competitionDate || null,
                    goNumber: null,
                    results: null,
                });
            } else {
                for (const div of divisions) {
                    const divName = typeof div === 'string'
                        ? div
                        : (div.division || div.name || div.divisionName || '');
                    const divAssocId = (typeof div === 'object') ? (div.assocId || '') : '';
                    const divId = (typeof div === 'object') ? (div.id || `${divAssocId}-${divName}`) : div;
                    const goNumber = (typeof div === 'object') ? div.goNumber : null;

                    const className = goNumber
                        ? `${discipline.name} - ${divName} (Go ${goNumber})`
                        : `${discipline.name} - ${divName}`;

                    autoClasses.push({
                        id: `auto::${discipline.id}::${groupId}::${divId}`,
                        name: className,
                        division: divName,
                        level: patternLevel,
                        associationId: divAssocId || associationId,
                        associationName,
                        disciplineName: discipline.name,
                        groupName: group.name || `Group ${groupIndex + 1}`,
                        source: 'pattern',
                        hasPattern,
                        goNumber: goNumber || null,
                        competitionDate: group.competitionDate || null,
                        results: null,
                    });
                }
            }
        }
    }

    return autoClasses;
};

// ---------------------------------------------------------------------------
// Grouping: Division → Level → Classes (sorted)
// ---------------------------------------------------------------------------
const groupClasses = (autoClasses, manualClasses) => {
    const levelOrder = LEVEL_OPTIONS.map(l => l.id);
    const allClasses = [
        ...autoClasses,
        ...(manualClasses || []).map(c => ({ ...c, source: 'manual' })),
    ];

    const grouped = {};
    for (const cls of allClasses) {
        const divKey = cls.division || 'Unassigned';
        const levelKey = cls.level || 'ALL';
        if (!grouped[divKey]) grouped[divKey] = {};
        if (!grouped[divKey][levelKey]) grouped[divKey][levelKey] = [];
        grouped[divKey][levelKey].push(cls);
    }

    const sortedDivisions = Object.keys(grouped).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return a.localeCompare(b);
    });

    return sortedDivisions.map(divKey => ({
        division: divKey,
        levels: Object.keys(grouped[divKey])
            .sort((a, b) => {
                const aIdx = levelOrder.indexOf(a);
                const bIdx = levelOrder.indexOf(b);
                return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
            })
            .map(levelKey => ({
                level: levelKey,
                classes: grouped[divKey][levelKey].sort((a, b) => a.name.localeCompare(b.name)),
            })),
    }));
};

// ---------------------------------------------------------------------------
// ResultsClassCard
// ---------------------------------------------------------------------------
const ResultsClassCard = ({ cls, affiliations, onEdit, onDelete }) => {
    const assocObj = affiliations.find(a =>
        a.id === cls.associationId || a.abbreviation === cls.associationId
    );
    const isManual = cls.source === 'manual';

    return (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
            <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium text-sm truncate">{cls.name}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                    {assocObj && (
                        <Badge variant="secondary" className="text-xs">
                            {assocObj.abbreviation || assocObj.name}
                        </Badge>
                    )}
                    <Badge variant={isManual ? 'default' : 'outline'} className="text-xs">
                        {isManual ? 'Manual' : 'Pattern'}
                    </Badge>
                    {cls.groupName && !isManual && (
                        <span className="text-xs text-muted-foreground">{cls.groupName}</span>
                    )}
                    {cls.notes && (
                        <span className="text-xs text-muted-foreground italic ml-1">— {cls.notes}</span>
                    )}
                </div>
            </div>
            {isManual && (
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// AddClassDialog
// ---------------------------------------------------------------------------
const AddClassDialog = ({ open, onOpenChange, editingClass, availableDivisions, affiliations, onSave, isSaving }) => {
    const isEdit = !!editingClass;
    const [name, setName] = useState('');
    const [division, setDivision] = useState('');
    const [customDivision, setCustomDivision] = useState('');
    const [level, setLevel] = useState('ALL');
    const [associationId, setAssociationId] = useState('');
    const [notes, setNotes] = useState('');

    // Reset form when dialog opens
    React.useEffect(() => {
        if (open) {
            if (editingClass) {
                setName(editingClass.name || '');
                const isExistingDiv = availableDivisions.includes(editingClass.division);
                setDivision(isExistingDiv ? editingClass.division : '__custom__');
                setCustomDivision(isExistingDiv ? '' : (editingClass.division || ''));
                setLevel(editingClass.level || 'ALL');
                setAssociationId(editingClass.associationId || '');
                setNotes(editingClass.notes || '');
            } else {
                setName('');
                setDivision('');
                setCustomDivision('');
                setLevel('ALL');
                setAssociationId('');
                setNotes('');
            }
        }
    }, [open, editingClass, availableDivisions]);

    const resolvedDivision = division === '__custom__' ? customDivision.trim() : division;
    const isValid = name.trim() && resolvedDivision;

    const handleSubmit = () => {
        if (!isValid) return;
        onSave({
            id: editingClass?.id || `mc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim(),
            division: resolvedDivision,
            level,
            associationId: associationId || null,
            notes: notes.trim(),
            createdAt: editingClass?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            results: editingClass?.results || null,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Edit Class' : 'Add Class (No Pattern)'}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Update the class details below.'
                            : 'Add a class that does not have a pattern or score sheet.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="className">Class Name *</Label>
                        <Input
                            id="className"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Ranch Riding"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="division">Division *</Label>
                        <Select value={division} onValueChange={setDivision}>
                            <SelectTrigger id="division">
                                <SelectValue placeholder="Select division" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableDivisions.map(d => (
                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                                <SelectItem value="__custom__">Custom...</SelectItem>
                            </SelectContent>
                        </Select>
                        {division === '__custom__' && (
                            <Input
                                value={customDivision}
                                onChange={e => setCustomDivision(e.target.value)}
                                placeholder="Enter custom division name"
                                className="mt-1"
                            />
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="level">Level</Label>
                        <Select value={level} onValueChange={setLevel}>
                            <SelectTrigger id="level">
                                <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                            <SelectContent>
                                {LEVEL_OPTIONS.map(opt => (
                                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="association">Association (optional)</Label>
                        <Select value={associationId || '__none__'} onValueChange={v => setAssociationId(v === '__none__' ? '' : v)}>
                            <SelectTrigger id="association">
                                <SelectValue placeholder="Select association" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {affiliations.map(a => (
                                    <SelectItem key={a.id} value={a.abbreviation || a.id}>
                                        {a.abbreviation || a.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Any additional notes..."
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                        {isEdit ? 'Save Changes' : 'Add Class'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ---------------------------------------------------------------------------
// BulkAddClassesDialog
// ---------------------------------------------------------------------------
const BulkAddClassesDialog = ({ open, onOpenChange, availableDivisions, affiliations, onBulkSave, isSaving }) => {
    const [text, setText] = React.useState('');
    const [division, setDivision] = React.useState('');
    const [customDivision, setCustomDivision] = React.useState('');
    const [level, setLevel] = React.useState('ALL');
    const [associationId, setAssociationId] = React.useState('');
    const [noPattern, setNoPattern] = React.useState(true);

    React.useEffect(() => {
        if (open) {
            setText('');
            setDivision('');
            setCustomDivision('');
            setLevel('ALL');
            setAssociationId('');
            setNoPattern(true);
        }
    }, [open]);

    const parsedLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const resolvedDivision = division === '__custom__' ? customDivision.trim() : division;
    const isValid = parsedLines.length > 0 && resolvedDivision;

    const handleSubmit = () => {
        if (!isValid) return;
        const classes = parsedLines.map(name => ({
            id: `mc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            division: resolvedDivision,
            level,
            associationId: associationId || null,
            notes: noPattern ? 'No pattern required' : '',
            noPattern,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            results: null,
        }));
        onBulkSave(classes);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ListPlus className="h-5 w-5" />
                        Bulk Add Classes
                    </DialogTitle>
                    <DialogDescription>
                        Paste or type class names, one per line. All will share the division and level you select below.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div>
                        <Label htmlFor="bulk-class-names" className="text-sm font-medium">Class Names (one per line)</Label>
                        <Textarea
                            id="bulk-class-names"
                            placeholder={`Ranch Riding Junior\nRanch Riding Senior\nShow Hack\nPleasure Driving`}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={6}
                            className="mt-1.5 font-mono text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm">Division *</Label>
                            <Select value={division} onValueChange={setDivision}>
                                <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                                <SelectContent>
                                    {availableDivisions.map(d => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                    <SelectItem value="__custom__">Custom...</SelectItem>
                                </SelectContent>
                            </Select>
                            {division === '__custom__' && (
                                <Input value={customDivision} onChange={e => setCustomDivision(e.target.value)} placeholder="Custom division" className="mt-1" />
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Level</Label>
                            <Select value={level} onValueChange={setLevel}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {LEVEL_OPTIONS.map(opt => (
                                        <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-sm">Association (optional)</Label>
                        <Select value={associationId || '__none__'} onValueChange={v => setAssociationId(v === '__none__' ? '' : v)}>
                            <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {affiliations.map(a => (
                                    <SelectItem key={a.id} value={a.abbreviation || a.id}>
                                        {a.abbreviation || a.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox id="bulk-no-pattern" checked={noPattern} onCheckedChange={setNoPattern} />
                        <Label htmlFor="bulk-no-pattern" className="font-normal text-sm">
                            Non-pattern classes (no pattern configuration required)
                        </Label>
                    </div>

                    {parsedLines.length > 0 && (
                        <div className="p-3 bg-muted/50 rounded-md border">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Preview</span>
                                <Badge variant="secondary">{parsedLines.length} classes</Badge>
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-0.5">
                                {parsedLines.map((line, i) => (
                                    <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <span className="font-bold text-primary w-5 text-right">{i + 1}.</span>
                                        <span>{line}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                        Add {parsedLines.length} {parsedLines.length === 1 ? 'Class' : 'Classes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ---------------------------------------------------------------------------
// ResultsTab — Main Component
// ---------------------------------------------------------------------------
const ResultsTab = ({ projectData, projectId, onSave, toast, associationsData, affiliations }) => {
    const [resultsEnabled, setResultsEnabled] = useState(projectData.resultsEnabled || false);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [bulkAddOpen, setBulkAddOpen] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const autoClasses = useMemo(
        () => extractAutoClasses(projectData, affiliations),
        [projectData.disciplines, projectData.patternSelections, affiliations]
    );

    const manualClasses = projectData.manualClasses || [];

    const groupedClasses = useMemo(
        () => groupClasses(autoClasses, manualClasses),
        [autoClasses, manualClasses]
    );

    const totalClassCount = autoClasses.length + manualClasses.length;

    // Unique divisions for Add dialog dropdown
    const availableDivisions = useMemo(() => {
        const divs = new Set();
        autoClasses.forEach(c => { if (c.division && c.division !== 'Unassigned') divs.add(c.division); });
        manualClasses.forEach(c => { if (c.division) divs.add(c.division); });
        return [...divs].sort();
    }, [autoClasses, manualClasses]);

    const persistData = useCallback(async (updatedProjectData) => {
        setIsSaving(true);
        try {
            await onSave(updatedProjectData);
        } finally {
            setIsSaving(false);
        }
    }, [onSave]);

    const handleToggleResults = useCallback(async (enabled) => {
        setResultsEnabled(enabled);
        await persistData({ ...projectData, resultsEnabled: enabled });
        toast({
            title: enabled ? 'Results enabled' : 'Results disabled',
            description: enabled ? 'Results management is now active.' : 'Results have been hidden.',
        });
    }, [projectData, persistData, toast]);

    const handleSaveClass = useCallback(async (classData) => {
        const existing = manualClasses.find(c => c.id === classData.id);
        let updated;
        if (existing) {
            updated = manualClasses.map(c => c.id === classData.id ? classData : c);
        } else {
            updated = [...manualClasses, classData];
        }
        await persistData({ ...projectData, manualClasses: updated });
        setAddDialogOpen(false);
        setEditingClass(null);
        toast({
            title: existing ? 'Class updated' : 'Class added',
            description: `"${classData.name}" has been ${existing ? 'updated' : 'added'}.`,
        });
    }, [manualClasses, projectData, persistData, toast]);

    const handleDeleteClass = useCallback(async (classId) => {
        const cls = manualClasses.find(c => c.id === classId);
        if (!cls) return;
        const updated = manualClasses.filter(c => c.id !== classId);
        await persistData({ ...projectData, manualClasses: updated });
        toast({ title: 'Class removed', description: `"${cls.name}" has been removed.` });
    }, [manualClasses, projectData, persistData, toast]);

    const handleBulkSave = useCallback(async (classes) => {
        const updated = [...manualClasses, ...classes];
        await persistData({ ...projectData, manualClasses: updated });
        setBulkAddOpen(false);
        toast({
            title: `${classes.length} classes added`,
            description: `Bulk added ${classes.length} manual class${classes.length === 1 ? '' : 'es'}.`,
        });
    }, [manualClasses, projectData, persistData, toast]);

    return (
        <div className="p-6 space-y-6">
            {/* Toggle */}
            <div className="flex items-center justify-between">
                <div>
                    <Label className="text-base font-semibold">Enable Results</Label>
                    <p className="text-sm text-muted-foreground">
                        Show results management for this pattern book
                    </p>
                </div>
                <Switch checked={resultsEnabled} onCheckedChange={handleToggleResults} disabled={isSaving} />
            </div>

            {!resultsEnabled ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg">
                    <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Results are disabled for this show.</p>
                    <p className="text-sm mt-1">Enable the toggle above to manage results.</p>
                </div>
            ) : (
                <>
                    {/* Summary bar */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <ListChecks className="h-5 w-5" />
                            <span className="font-medium">{totalClassCount} Classes</span>
                            <Badge variant="secondary">{autoClasses.length} from patterns</Badge>
                            <Badge variant="outline">{manualClasses.length} manual</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setEditingClass(null); setAddDialogOpen(true); }}
                            >
                                <PlusCircle className="h-4 w-4 mr-1" /> Add Class
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBulkAddOpen(true)}
                                className="border-primary/30 text-primary hover:bg-primary/5"
                            >
                                <ListPlus className="h-4 w-4 mr-1" /> Bulk Add
                            </Button>
                        </div>
                    </div>

                    {/* Class list */}
                    {totalClassCount === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg">
                            <p className="font-medium">No classes added yet.</p>
                            <p className="text-sm mt-1">Pattern-based classes will appear automatically. You can also add classes manually.</p>
                        </div>
                    ) : (
                        <ScrollArea className="max-h-[60vh]">
                            <Accordion type="multiple" defaultValue={groupedClasses.map(g => g.division)}>
                                {groupedClasses.map(divGroup => (
                                    <AccordionItem key={divGroup.division} value={divGroup.division}>
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold">Division: {divGroup.division}</span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {divGroup.levels.reduce((sum, l) => sum + l.classes.length, 0)}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            {divGroup.levels.map(levelGroup => (
                                                <div key={levelGroup.level} className="mb-4">
                                                    <div className="flex items-center gap-2 mb-2 pl-2">
                                                        <Badge variant="outline" className="text-xs">
                                                            {LEVEL_OPTIONS.find(l => l.id === levelGroup.level)?.label || levelGroup.level}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            ({levelGroup.classes.length} {levelGroup.classes.length === 1 ? 'class' : 'classes'})
                                                        </span>
                                                    </div>
                                                    <div className="space-y-2 pl-4">
                                                        {levelGroup.classes.map(cls => (
                                                            <ResultsClassCard
                                                                key={cls.id}
                                                                cls={cls}
                                                                affiliations={affiliations}
                                                                onEdit={() => {
                                                                    setEditingClass(cls);
                                                                    setAddDialogOpen(true);
                                                                }}
                                                                onDelete={() => handleDeleteClass(cls.id)}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </ScrollArea>
                    )}
                </>
            )}

            {/* Add / Edit Dialog */}
            <AddClassDialog
                open={addDialogOpen}
                onOpenChange={(open) => {
                    setAddDialogOpen(open);
                    if (!open) setEditingClass(null);
                }}
                editingClass={editingClass}
                availableDivisions={availableDivisions}
                affiliations={affiliations}
                onSave={handleSaveClass}
                isSaving={isSaving}
            />

            {/* Bulk Add Dialog */}
            <BulkAddClassesDialog
                open={bulkAddOpen}
                onOpenChange={setBulkAddOpen}
                availableDivisions={availableDivisions}
                affiliations={affiliations}
                onBulkSave={handleBulkSave}
                isSaving={isSaving}
            />
        </div>
    );
};

export default ResultsTab;
