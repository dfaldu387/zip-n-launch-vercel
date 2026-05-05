import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Calendar, Layers, Banknote, GripVertical, BadgeCent, Building2, Shield, ClipboardList, Settings, Trophy, Users, Megaphone, Wrench, UtensilsCrossed, Download, TrendingUp, TrendingDown, HeartHandshake, ArrowRightLeft } from 'lucide-react';
import { exportShowBudgetToExcel } from '@/lib/showBudgetExport';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { isBudgetFrozen } from '@/lib/contractUtils';
import { BudgetFrozenBanner } from '@/components/contract-management/BudgetFrozenBanner';
import { Lock } from 'lucide-react';

const standardFees = [
    { standard_id: 'stall_fee', name: 'Stall Fee', type: 'ancillary', unit_type: 'flat', amount: 295, payment_timing: 'pre_entry', tier: 1, is_standard: true, notes: 'Non-refundable, paid up front' },
    { standard_id: 'class_entry_fee', name: 'Class Entry Fee', type: 'per_class', unit_type: 'per_class', amount: 20, payment_timing: 'settlement', tier: 1, is_standard: true, notes: 'Pay-to-play cost, multiplied by judges' },
    { standard_id: 'office_fee', name: 'Office / Processing Fee', type: 'per_horse', unit_type: 'per_horse', amount: 50, payment_timing: 'at_check_in', tier: 1, is_standard: true, notes: 'Per horse, non-refundable' },
    { standard_id: 'aqha_admin_fee', name: 'AQHA Admin Fee', type: 'per_horse', unit_type: 'per_horse', amount: 10, association_specific: 'AQHA', payment_timing: 'at_check_in', tier: 1, is_standard: true },
    { standard_id: 'apha_admin_fee', name: 'APHA Admin Fee', type: 'per_class', unit_type: 'per_class', amount: 3, association_specific: 'APHA', payment_timing: 'at_check_in', tier: 1, is_standard: true },
    { standard_id: 'nsba_admin_fee', name: 'NSBA Admin Fee', type: 'per_class', unit_type: 'per_class', amount: 5, association_specific: 'NSBA', payment_timing: 'at_check_in', tier: 1, is_standard: true, notes: 'Per class entry' },
    { standard_id: 'haul_in_fee', name: 'Grounds / Haul-In Fee', type: 'per_horse', unit_type: 'per_horse', amount: 25, payment_timing: 'at_check_in', tier: 2, is_standard: true, notes: 'Per day, if not stalling' },
    { standard_id: 'rv_fee', name: 'RV / Camping Fee', type: 'ancillary', unit_type: 'per_night', amount: 45, payment_timing: 'pre_entry', tier: 2, is_standard: true, notes: 'Per night' },
    { standard_id: 'shavings_fee', name: 'Shavings / Bedding', type: 'ancillary', unit_type: 'per_bag', amount: 12, payment_timing: 'pre_entry', tier: 2, is_standard: true, notes: 'Per bag' },
    { standard_id: 'trail_equip_fee', name: 'Trail Equipment Fee', type: 'ancillary', unit_type: 'per_horse', amount: 25, payment_timing: 'settlement', tier: 3, is_standard: true, notes: 'Per horse, for Trail/Ranch Trail' },
    { standard_id: 'cattle_fee', name: 'Cattle Fee', type: 'per_class', unit_type: 'per_class', amount: 100, payment_timing: 'settlement', tier: 3, is_standard: true, notes: 'Per run, non-refundable' },
    { standard_id: 'late_entry_fee', name: 'Post-Entry / Late Fee', type: 'flat', unit_type: 'flat', amount: 25, payment_timing: 'at_check_in', tier: 4, is_standard: true, notes: 'If after pre-entry deadline' },
    { standard_id: 'scratch_fee', name: 'Change / Scratch Fee', type: 'flat', unit_type: 'flat', amount: 10, payment_timing: 'settlement', tier: 4, is_standard: true, notes: 'Applied after cutoff' },
    { standard_id: 'nsf_fee', name: 'Returned Check / NSF Fee', type: 'flat', unit_type: 'flat', amount: 50, payment_timing: 'settlement', tier: 4, is_standard: true },
];

const UNIT_TYPE_OPTIONS = [
    { value: 'flat', label: 'Flat Fee' },
    { value: 'per_horse', label: 'Per Horse' },
    { value: 'per_night', label: 'Per Night' },
    { value: 'per_bag', label: 'Per Bag' },
    { value: 'per_class', label: 'Per Class' },
    { value: 'custom', label: 'Custom Unit' },
];

const UNIT_TYPE_LABELS = {
    flat: 'Flat Fee',
    per_horse: 'Per Horse',
    per_night: 'Per Night',
    per_bag: 'Per Bag',
    per_class: 'Per Class',
    custom: 'Custom',
};

const timingCategories = [
    { id: 'pre_entry', title: 'Pre-Entry / Reservation', description: 'Fees due before the show (e.g., stalls, RVs).' },
    { id: 'at_check_in', title: 'At Check-In', description: 'Fees paid upon arrival (e.g., office, haul-in).' },
    { id: 'settlement', title: 'Post-Show / Settlement', description: 'Fees on the final bill (e.g., class entries).' },
    { id: 'custom_timing', title: 'Custom Timing', description: 'Fees with custom payment timing.' },
];

const getUnitLabel = (fee) => {
    if (fee.unit_type === 'custom' && fee.custom_unit_label) return fee.custom_unit_label;
    return UNIT_TYPE_LABELS[fee.unit_type] || UNIT_TYPE_LABELS[fee.type] || 'Flat Fee';
};

const EditableFeeItem = ({ fee, onUpdate, onRemove, associations, allAssociationsData }) => {
    const getAssociationName = (id) => allAssociationsData.find(a => a.id === id)?.name || id;

    return (
        <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-background/50 rounded-b-lg">
            <div className="space-y-1.5 md:col-span-3">
                <Label>Fee Name</Label>
                <Input value={fee.name} onChange={(e) => onUpdate(fee.id, 'name', e.target.value)} placeholder="e.g., Office Fee" disabled={fee.is_standard}/>
            </div>
            <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input type="number" value={fee.amount} onChange={(e) => onUpdate(fee.id, 'amount', e.target.value)} placeholder="e.g., 50.00" />
            </div>
            <div className="space-y-1.5">
                <Label>Unit Type</Label>
                <Select value={fee.unit_type || 'flat'} onValueChange={(value) => onUpdate(fee.id, 'unit_type', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {UNIT_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {fee.unit_type === 'custom' && (
                <div className="space-y-1.5">
                    <Label>Custom Unit Label</Label>
                    <Input
                        value={fee.custom_unit_label || ''}
                        onChange={(e) => onUpdate(fee.id, 'custom_unit_label', e.target.value)}
                        placeholder='e.g., "Per Stall", "Per Run"'
                    />
                </div>
            )}
            <div className="space-y-1.5">
                <Label>Payment Timing</Label>
                <Select value={fee.payment_timing} onValueChange={(value) => onUpdate(fee.id, 'payment_timing', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {timingCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.title}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label>Association</Label>
                <Select value={fee.association_specific || 'all'} onValueChange={(value) => onUpdate(fee.id, 'association_specific', value === 'all' ? null : value)}>
                    <SelectTrigger><SelectValue placeholder="Applies to..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Associations</SelectItem>
                        {associations.map(assocId => (
                            <SelectItem key={assocId} value={assocId}>{getAssociationName(assocId)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !fee.due_date && "text-muted-foreground")}
                        >
                            <Calendar className="mr-2 h-4 w-4" />
                            {fee.due_date ? format(new Date(fee.due_date), "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <CalendarComponent mode="single" selected={fee.due_date ? new Date(fee.due_date) : null} onSelect={(date) => onUpdate(fee.id, 'due_date', date?.toISOString().split('T')[0])} initialFocus />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-1.5">
                <Label>Late Fee ($)</Label>
                <Input type="number" value={fee.late_fee_amount || ''} onChange={(e) => onUpdate(fee.id, 'late_fee_amount', e.target.value)} placeholder="e.g., 25.00" />
            </div>
             <div className="space-y-1.5 flex items-center pt-6">
                <Checkbox id={`per-judge-${fee.id}`} checked={fee.apply_per_judge} onCheckedChange={(checked) => onUpdate(fee.id, 'apply_per_judge', checked)} />
                <Label htmlFor={`per-judge-${fee.id}`} className="text-sm font-normal cursor-pointer ml-2">Apply per judge?</Label>
            </div>
            <div className="md:col-span-3 space-y-1.5">
                <Label>Notes</Label>
                <Input value={fee.notes || ''} onChange={(e) => onUpdate(fee.id, 'notes', e.target.value)} placeholder="Optional notes (e.g., per day, includes 2 bags shavings)" />
            </div>
        </div>
    );
};

const SortableFeeItem = ({ fee, onUpdate, onRemove, associations, allAssociationsData }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: fee.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const unitLabel = getUnitLabel(fee);

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <Accordion type="single" collapsible className="w-full bg-card border rounded-lg shadow-sm overflow-hidden">
                <AccordionItem value={fee.id} className="border-none">
                    <div className="flex items-center px-4 py-2">
                         <div {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground p-2">
                            <GripVertical className="h-5 w-5" />
                        </div>
                        <AccordionTrigger className="flex-grow text-left hover:no-underline py-0">
                            <div className="flex items-center justify-between w-full">
                                <span className="font-semibold">{fee.name}</span>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{unitLabel}</span>
                                    <span className="font-medium">${fee.amount || '0.00'}</span>
                                    {fee.apply_per_judge && <BadgeCent className="h-4 w-4 text-primary" />}
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="ml-2 flex-shrink-0 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {fee.is_standard 
                                            ? `This will remove the "${fee.name}" fee and return it to the Fee Catalog.`
                                            : `This will permanently delete the custom fee "${fee.name}". This action cannot be undone.`
                                        }
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onRemove(fee.id)} className={cn(!fee.is_standard && "bg-destructive hover:bg-destructive/90 text-destructive-foreground")}>Yes, Remove</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <AccordionContent className="p-0">
                         <EditableFeeItem fee={fee} onUpdate={onUpdate} onRemove={onRemove} associations={associations} allAssociationsData={allAssociationsData} />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

const expenseCategories = [
    { id: 'facilities', title: 'Facilities', icon: Building2, examples: 'Arena rental, stall rental, RV hookups, grounds security' },
    { id: 'associations', title: 'Associations & Compliance', icon: Shield, examples: 'Sanction fees, insurance, permits, drug testing' },
    { id: 'administrative', title: 'Administrative', icon: ClipboardList, examples: 'Office supplies, printing, software, postage' },
    { id: 'operations', title: 'Operations', icon: Settings, examples: 'Sound system, timing equipment, cattle, course setup' },
    { id: 'awards', title: 'Awards', icon: Trophy, examples: 'Trophies, buckles, ribbons, prize money' },
    { id: 'officials_staff', title: 'Officials & Staff', icon: Users, examples: 'Judge fees, steward fees, ring crew, announcer' },
    { id: 'marketing', title: 'Marketing', icon: Megaphone, examples: 'Advertising, signage, photography, social media' },
    { id: 'equipment', title: 'Equipment', icon: Wrench, examples: 'Trail obstacles, cones, poles, arena footing' },
    { id: 'hospitality', title: 'Hospitality', icon: UtensilsCrossed, examples: 'Catering, judges meals, water, exhibitor reception' },
];

export const FeeStructureStep = ({ formData, setFormData }) => {
    const { fees = [], associations = {} } = formData;
    const selectedAssociations = Object.keys(associations).filter(id => associations[id]);
    const { toast } = useToast();
    const [allAssociationsData, setAllAssociationsData] = useState([]);
    const budgetLocked = isBudgetFrozen(formData);

    useEffect(() => {
        const fetchAssociations = async () => {
            const { data, error } = await supabase.from('associations').select('*');
            if (error) {
                toast({ title: 'Error fetching associations', description: error.message, variant: 'destructive' });
            } else {
                setAllAssociationsData(data);
            }
        };
        fetchAssociations();
    }, [toast]);

    useEffect(() => {
        setFormData(prev => {
            const currentFees = prev.fees || [];
            const currentStandardIds = new Set(currentFees.map(f => f.standard_id).filter(Boolean));
            const assocFees = standardFees.filter(sf =>
                sf.association_specific &&
                selectedAssociations.includes(sf.association_specific) &&
                !currentStandardIds.has(sf.standard_id)
            );
            if (assocFees.length === 0) return prev;
            return {
                ...prev,
                fees: [...currentFees, ...assocFees.map(f => ({ ...f, id: uuidv4() }))],
            };
        });
    }, [selectedAssociations]); // eslint-disable-line react-hooks/exhaustive-deps

    const activeFeeIds = useMemo(() => new Set(fees.map(f => f.standard_id)), [fees]);
    
    const availableStandardFees = useMemo(() => {
        return standardFees.filter(sf => {
            if (activeFeeIds.has(sf.standard_id)) {
                return false;
            }
            if (sf.association_specific) {
                return selectedAssociations.includes(sf.association_specific);
            }
            return true;
        });
    }, [activeFeeIds, selectedAssociations]);

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const updateFee = (id, field, value) => {
        setFormData(prev => ({ ...prev, fees: prev.fees.map(f => f.id === id ? { ...f, [field]: value } : f) }));
    };

    const removeFee = (id) => {
        setFormData(prev => ({ ...prev, fees: prev.fees.filter(f => f.id !== id) }));
    };

    const addFee = (feeData, isCustom = false) => {
        const newFee = { ...feeData, id: uuidv4(), is_standard: !isCustom };
        setFormData(prev => ({ ...prev, fees: [...(prev.fees || []), newFee] }));
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over) return;

        const activeFee = fees.find(f => f.id === active.id);
        const overContainerId = over.id.startsWith('droppable-') ? over.id.replace('droppable-', '') : null;

        if (overContainerId && activeFee.payment_timing !== overContainerId) {
            setFormData(prev => ({
                ...prev,
                fees: prev.fees.map(f => f.id === active.id ? { ...f, payment_timing: overContainerId } : f),
            }));
        } else if (active.id !== over.id) {
            setFormData(prev => {
                const oldIndex = prev.fees.findIndex(f => f.id === active.id);
                const newIndex = prev.fees.findIndex(f => f.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return prev;
                return { ...prev, fees: arrayMove(prev.fees, oldIndex, newIndex) };
            });
        }
    };

    const sponsors = formData.sponsors || [];
    const sponsorLevels = formData.sponsorLevels || [];
    const classSponsors = formData.classSponsors || [];
    const arenaSponsors = formData.arenaSponsors || [];
    const customSponsors = formData.customSponsors || [];

    const totalFeeRevenue = useMemo(() => fees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0), [fees]);
    const levelSponsorRevenue = useMemo(() => sponsors.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0), [sponsors]);
    const classSponsorRevenue = useMemo(() => classSponsors.reduce((sum, cs) => sum + (parseFloat(cs.amount) || 0), 0), [classSponsors]);
    const arenaSponsorRevenue = useMemo(() => arenaSponsors.reduce((sum, as) => sum + (parseFloat(as.amount) || 0), 0), [arenaSponsors]);
    const customSponsorRevenue = useMemo(() => customSponsors.reduce((sum, cs) => sum + (parseFloat(cs.amount) || 0), 0), [customSponsors]);
    const totalSponsorshipRevenue = levelSponsorRevenue + classSponsorRevenue + arenaSponsorRevenue + customSponsorRevenue;
    const totalRevenue = totalFeeRevenue + totalSponsorshipRevenue;

    return (
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Fees & Sponsors (Revenue)</CardTitle>
                <CardDescription>Define your show's income sources — entry fees, stall fees, association fees, and sponsorship revenue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {budgetLocked && <BudgetFrozenBanner />}

                {/* ========== SECTION A: REVENUE ========== */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 p-4 rounded-lg border-l-4 border-emerald-500 bg-emerald-500/5">
                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                        <div>
                            <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">A. Revenue (Money Coming In)</h3>
                            <p className="text-sm text-muted-foreground">Entry fees, stall fees, association fees, and sponsorship income.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT COLUMN — Fee Catalog (4 cols) */}
                        <Card className="lg:col-span-4 bg-background/30 self-start lg:sticky lg:top-4">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2"><Layers className="h-6 w-6 text-emerald-600"/> Fee Catalog</CardTitle>
                                <CardDescription>Add standard industry fees or create a custom fee.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                                    {availableStandardFees.length > 0 ? (
                                        availableStandardFees.map(fee => (
                                            <div key={fee.standard_id} className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-secondary/20 transition-colors">
                                                <div className="min-w-0 mr-3">
                                                    <p className="font-semibold text-sm">{fee.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{getUnitLabel(fee)}</span>
                                                        <span className="text-xs text-muted-foreground">${fee.amount}</span>
                                                    </div>
                                                    {fee.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{fee.notes}</p>}
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => addFee(fee)} disabled={budgetLocked} className="flex-shrink-0">
                                                    <PlusCircle className="h-4 w-4 mr-1.5" /> Add
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-muted-foreground py-6 text-sm">All relevant standard fees have been added.</p>
                                    )}
                                </div>
                                <Button onClick={() => addFee({ name: 'Custom Fee', type: 'flat', unit_type: 'flat', amount: '', payment_timing: 'settlement' }, true)} variant="secondary" className="w-full" disabled={budgetLocked}>
                                    {budgetLocked ? <Lock className="h-4 w-4 mr-1.5" /> : <PlusCircle className="h-4 w-4 mr-1.5" />} Add Custom Fee
                                </Button>
                            </CardContent>
                        </Card>

                        {/* RIGHT COLUMN — Assigned Fees by Category (8 cols) */}
                        <div className="lg:col-span-8 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-lg">Assigned Fees</h3>
                                {totalFeeRevenue > 0 && (
                                    <span className="text-sm font-semibold text-emerald-600">Total: ${totalFeeRevenue.toFixed(2)}</span>
                                )}
                            </div>

                            {fees.length === 0 ? (
                                <Card className="bg-background/30">
                                    <CardContent className="py-16 text-center">
                                        <Banknote className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                                        <p className="text-muted-foreground font-medium">No fees added yet.</p>
                                        <p className="text-sm text-muted-foreground mt-1">Click "Add" on fees from the catalog to assign them.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <div className="space-y-4">
                                        {timingCategories.filter(cat => cat.id !== 'custom_timing' || fees.some(f => f.payment_timing === 'custom_timing')).map(category => {
                                            const categoryFees = fees.filter(f => f.payment_timing === category.id);
                                            return (
                                                <FeeCategory
                                                    key={category.id}
                                                    id={category.id}
                                                    title={category.title}
                                                    description={category.description}
                                                    fees={categoryFees}
                                                    onUpdate={updateFee}
                                                    onRemove={removeFee}
                                                    associations={selectedAssociations}
                                                    allAssociationsData={allAssociationsData}
                                                />
                                            );
                                        })}
                                    </div>
                                </DndContext>
                            )}
                        </div>
                    </div>

                    <Card className="bg-background/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><HeartHandshake className="h-6 w-6 text-emerald-600"/> Sponsorship Revenue</CardTitle>
                            <CardDescription>Sponsors are managed in the Sponsors step of the Create Show wizard. Below is a summary.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {totalSponsorshipRevenue > 0 ? (
                                <div className="space-y-3">
                                    {/* Level sponsors */}
                                    {sponsorLevels.map(level => {
                                        const levelSponsors = sponsors.filter(s => s.levelId === level.id);
                                        if (levelSponsors.length === 0) return null;
                                        const levelTotal = levelSponsors.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
                                        return (
                                            <div key={level.id} className="flex items-center justify-between p-3 border rounded-md bg-background">
                                                <div>
                                                    <p className="font-semibold">{level.name} <span className="text-xs text-muted-foreground ml-1">({levelSponsors.length} sponsor{levelSponsors.length !== 1 ? 's' : ''})</span></p>
                                                    <p className="text-xs text-muted-foreground">{levelSponsors.map(s => s.name).filter(Boolean).join(', ') || 'No names entered'}</p>
                                                </div>
                                                <p className="font-semibold text-emerald-600">${levelTotal.toLocaleString()}</p>
                                            </div>
                                        );
                                    })}
                                    {(() => {
                                        const unassigned = sponsors.filter(s => !s.levelId || !sponsorLevels.find(l => l.id === s.levelId));
                                        if (unassigned.length === 0) return null;
                                        const unassignedTotal = unassigned.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
                                        return (
                                            <div className="flex items-center justify-between p-3 border rounded-md bg-background">
                                                <div>
                                                    <p className="font-semibold text-muted-foreground">Unassigned <span className="text-xs ml-1">({unassigned.length})</span></p>
                                                    <p className="text-xs text-muted-foreground">{unassigned.map(s => s.name).filter(Boolean).join(', ') || 'No names entered'}</p>
                                                </div>
                                                <p className="font-semibold text-emerald-600">${unassignedTotal.toLocaleString()}</p>
                                            </div>
                                        );
                                    })()}

                                    {/* Class sponsors */}
                                    {classSponsorRevenue > 0 && (
                                        <div className="flex items-center justify-between p-3 border rounded-md bg-background">
                                            <div>
                                                <p className="font-semibold">Class Sponsors <span className="text-xs text-muted-foreground ml-1">({classSponsors.filter(cs => cs.sponsorName).length} class{classSponsors.filter(cs => cs.sponsorName).length !== 1 ? 'es' : ''})</span></p>
                                                <p className="text-xs text-muted-foreground">{classSponsors.filter(cs => cs.sponsorName).map(cs => `${cs.className}: ${cs.sponsorName}`).join(', ') || 'No names entered'}</p>
                                            </div>
                                            <p className="font-semibold text-emerald-600">${classSponsorRevenue.toLocaleString()}</p>
                                        </div>
                                    )}

                                    {/* Arena sponsors */}
                                    {arenaSponsorRevenue > 0 && (
                                        <div className="flex items-center justify-between p-3 border rounded-md bg-background">
                                            <div>
                                                <p className="font-semibold">Arena Sponsors <span className="text-xs text-muted-foreground ml-1">({arenaSponsors.filter(as => as.sponsorName).length} arena{arenaSponsors.filter(as => as.sponsorName).length !== 1 ? 's' : ''})</span></p>
                                                <p className="text-xs text-muted-foreground">{arenaSponsors.filter(as => as.sponsorName).map(as => `${as.arenaName}: ${as.sponsorName}`).join(', ') || 'No names entered'}</p>
                                            </div>
                                            <p className="font-semibold text-emerald-600">${arenaSponsorRevenue.toLocaleString()}</p>
                                        </div>
                                    )}

                                    {/* Custom sponsors */}
                                    {customSponsorRevenue > 0 && (
                                        <div className="flex items-center justify-between p-3 border rounded-md bg-background">
                                            <div>
                                                <p className="font-semibold">Custom Sponsors <span className="text-xs text-muted-foreground ml-1">({customSponsors.filter(cs => cs.name).length})</span></p>
                                                <p className="text-xs text-muted-foreground">{customSponsors.filter(cs => cs.name).map(cs => cs.name).join(', ') || 'No names entered'}</p>
                                            </div>
                                            <p className="font-semibold text-emerald-600">${customSponsorRevenue.toLocaleString()}</p>
                                        </div>
                                    )}

                                    <div className="text-right pt-2">
                                        <p className="text-sm font-semibold text-emerald-600">Total Sponsorship Revenue: ${totalSponsorshipRevenue.toLocaleString()}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                                    <HeartHandshake className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-muted-foreground">No sponsors added yet.</p>
                                    <p className="text-sm text-muted-foreground">Add sponsors in the Create Show wizard (Sponsors step).</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {totalFeeRevenue > 0 && (
                        <div className="text-right px-2">
                            <p className="text-sm font-semibold text-emerald-600">Total Revenue: ${totalRevenue.toFixed(2)}</p>
                        </div>
                    )}
                </div>

            </CardContent>
        </motion.div>
    );
};

const FeeCategory = ({ id, title, description, fees, onUpdate, onRemove, associations, allAssociationsData }) => {
    const { setNodeRef } = useSortable({ id: `droppable-${id}` });

    return (
        <Card ref={setNodeRef} className="flex flex-col bg-background/30">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base">{title}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
                    </div>
                    {fees.length > 0 && (
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            {fees.length} fee{fees.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 pt-0">
                <SortableContext items={fees.map(f => f.id)}>
                     <div className="space-y-3">
                    {fees.length > 0 ? (
                        fees.map(fee => (
                            <SortableFeeItem key={fee.id} fee={fee} onUpdate={onUpdate} onRemove={onRemove} associations={associations} allAssociationsData={allAssociationsData} />
                        ))
                    ) : (
                        <div className="text-center py-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center">
                            <ArrowRightLeft className="h-5 w-5 text-muted-foreground mb-1.5" />
                            <p className="text-xs text-muted-foreground">Drag fees here or change timing in fee details.</p>
                        </div>
                    )}
                    </div>
                </SortableContext>
            </CardContent>
        </Card>
    );
};