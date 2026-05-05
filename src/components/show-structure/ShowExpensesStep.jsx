import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Download, ChevronDown, ChevronRight, Check, StickyNote, GripVertical } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { exportShowBudgetToExcel } from '@/lib/showBudgetExport';
import { cn } from '@/lib/utils';
import { isBudgetFrozen } from '@/lib/contractUtils';
import { BudgetFrozenBanner } from '@/components/contract-management/BudgetFrozenBanner';

const TIMING_OPTIONS = [
    { id: 'before_show', label: 'Before Show', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'during_show', label: 'During Show', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'after_show', label: 'After Show', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
];

const UNIT_OPTIONS = [
    { id: 'flat', label: 'Flat Fee' },
    { id: 'per_day', label: 'Per Day' },
    { id: 'per_head', label: 'Per Head' },
    { id: 'per_hour', label: 'Per Hour' },
    { id: 'per_unit', label: 'Per Unit' },
    { id: 'per_person', label: 'Per Person' },
];

const EXPENSE_FRAMEWORK = [
    {
        id: 'facilities',
        title: 'Facilities',
        icon: '🏟️',
        color: 'border-blue-500',
        bgColor: 'bg-blue-500/5',
        textColor: 'text-blue-700 dark:text-blue-400',
        subGroups: [
            {
                title: 'Arena Rentals',
                items: [
                    { name: 'Main competition arena rental', defaultTiming: 'during_show' },
                    { name: 'Secondary arena rental', defaultTiming: 'during_show' },
                    { name: 'Warm-up arena rental', defaultTiming: 'during_show' },
                    { name: 'Covered arena rental', defaultTiming: 'during_show' },
                    { name: 'Outdoor arena rental', defaultTiming: 'during_show' },
                    { name: 'Practice arena rental', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Arena Maintenance & Preparation',
                items: [
                    { name: 'Arena dragging services', defaultTiming: 'during_show' },
                    { name: 'Arena watering / dust control', defaultTiming: 'during_show' },
                    { name: 'Footing preparation or replacement', defaultTiming: 'before_show' },
                    { name: 'Footing testing or inspection', defaultTiming: 'before_show' },
                    { name: 'Arena grooming equipment', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Stall & Barn Rentals',
                items: [
                    { name: 'Horse stall rental (bulk facility fee)', defaultTiming: 'during_show' },
                    { name: 'Tack stall rental', defaultTiming: 'during_show' },
                    { name: 'Temporary stall rentals', defaultTiming: 'during_show' },
                    { name: 'Portable stall rental', defaultTiming: 'during_show' },
                    { name: 'Stall mats rental', defaultTiming: 'during_show' },
                    { name: 'Stall bedding packages', defaultTiming: 'during_show' },
                    { name: 'Stall cleaning services', defaultTiming: 'during_show' },
                    { name: 'Stall damage deposits', defaultTiming: 'before_show' },
                ],
            },
            {
                title: 'RV & Camping',
                items: [
                    { name: 'RV space rental', defaultTiming: 'during_show' },
                    { name: 'Electrical hook-ups', defaultTiming: 'during_show' },
                    { name: 'Water hook-ups', defaultTiming: 'during_show' },
                    { name: 'Sewer hook-ups', defaultTiming: 'during_show' },
                    { name: 'Dump station fees', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Facility Spaces',
                items: [
                    { name: 'Show office rental', defaultTiming: 'during_show' },
                    { name: 'Awards room rental', defaultTiming: 'during_show' },
                    { name: 'Judges room rental', defaultTiming: 'during_show' },
                    { name: 'Hospitality room rental', defaultTiming: 'during_show' },
                    { name: 'Announcer booth rental', defaultTiming: 'during_show' },
                    { name: 'Vendor / trade show areas', defaultTiming: 'during_show' },
                    { name: 'Media room rental', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Utilities',
                items: [
                    { name: 'Electrical usage fees', defaultTiming: 'during_show' },
                    { name: 'Temporary power drops', defaultTiming: 'during_show' },
                    { name: 'Water usage fees', defaultTiming: 'during_show' },
                    { name: 'Internet / Wi-Fi', defaultTiming: 'during_show' },
                    { name: 'PA system / sound system', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Grounds Services',
                items: [
                    { name: 'Security services', defaultTiming: 'during_show' },
                    { name: 'Overnight grounds security', defaultTiming: 'during_show' },
                    { name: 'Janitorial services', defaultTiming: 'during_show' },
                    { name: 'Portable restroom rentals', defaultTiming: 'during_show' },
                    { name: 'Waste disposal / dumpsters', defaultTiming: 'during_show' },
                    { name: 'Manure removal services', defaultTiming: 'after_show' },
                ],
            },
        ],
    },
    {
        id: 'associations',
        title: 'Associations & Compliance',
        icon: '📋',
        color: 'border-emerald-500',
        bgColor: 'bg-emerald-500/5',
        textColor: 'text-emerald-700 dark:text-emerald-400',
        subGroups: [
            {
                title: 'Association Sanctioning Fees',
                items: [
                    { name: 'AQHA approval fees', defaultTiming: 'before_show' },
                    { name: 'APHA approval fees', defaultTiming: 'before_show' },
                    { name: 'NSBA approval fees', defaultTiming: 'before_show' },
                    { name: 'NRHA approval fees', defaultTiming: 'before_show' },
                    { name: 'NRCHA approval fees', defaultTiming: 'before_show' },
                    { name: 'PHBA approval fees', defaultTiming: 'before_show' },
                    { name: 'IBHA approval fees', defaultTiming: 'before_show' },
                    { name: 'ABRA approval fees', defaultTiming: 'before_show' },
                    { name: 'AHA approval fees', defaultTiming: 'before_show' },
                    { name: 'POAC approval fees', defaultTiming: 'before_show' },
                    { name: '4-H or youth association fees', defaultTiming: 'before_show' },
                ],
            },
            {
                title: 'Association Required Costs',
                items: [
                    { name: 'Per-entry association fees', defaultTiming: 'during_show' },
                    { name: 'Association drug testing fees', defaultTiming: 'during_show' },
                    { name: 'Association recording fees', defaultTiming: 'after_show' },
                    { name: 'Association office processing fees', defaultTiming: 'after_show' },
                    { name: 'Association steward fees', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Compliance & Regulation',
                items: [
                    { name: 'Drug testing programs', defaultTiming: 'during_show' },
                    { name: 'Medication compliance', defaultTiming: 'during_show' },
                    { name: 'Show steward compliance', defaultTiming: 'during_show' },
                    { name: 'Association audits', defaultTiming: 'after_show' },
                ],
            },
            {
                title: 'Insurance',
                items: [
                    { name: 'General liability insurance', defaultTiming: 'before_show' },
                    { name: 'Equine liability insurance', defaultTiming: 'before_show' },
                    { name: 'Event insurance policies', defaultTiming: 'before_show' },
                    { name: 'Participant accident insurance', defaultTiming: 'before_show' },
                    { name: 'Vendor insurance riders', defaultTiming: 'before_show' },
                ],
            },
            {
                title: 'Permits',
                items: [
                    { name: 'Event permits', defaultTiming: 'before_show' },
                    { name: 'Local municipality permits', defaultTiming: 'before_show' },
                    { name: 'Fire marshal permits', defaultTiming: 'before_show' },
                    { name: 'Alcohol permits', defaultTiming: 'before_show' },
                ],
            },
        ],
    },
    {
        id: 'administrative',
        title: 'Administrative',
        icon: '📄',
        color: 'border-slate-500',
        bgColor: 'bg-slate-500/5',
        textColor: 'text-slate-700 dark:text-slate-400',
        subGroups: [
            {
                title: 'Show Office Administration',
                items: [
                    { name: 'Show secretary services', defaultTiming: 'during_show' },
                    { name: 'Assistant secretary payroll', defaultTiming: 'during_show' },
                    { name: 'Data entry staff', defaultTiming: 'during_show' },
                    { name: 'Office administrative staff', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Software & Technology',
                items: [
                    { name: 'Entry management software', defaultTiming: 'before_show' },
                    { name: 'Online entry platform fees', defaultTiming: 'before_show' },
                    { name: 'Payment processing fees', defaultTiming: 'after_show' },
                    { name: 'Website hosting costs', defaultTiming: 'before_show' },
                    { name: 'Online registration system', defaultTiming: 'before_show' },
                ],
            },
            {
                title: 'Accounting & Finance',
                items: [
                    { name: 'Accounting services', defaultTiming: 'after_show' },
                    { name: 'Financial reconciliation services', defaultTiming: 'after_show' },
                    { name: 'Bookkeeping services', defaultTiming: 'after_show' },
                ],
            },
            {
                title: 'Legal',
                items: [
                    { name: 'Liability waivers', defaultTiming: 'before_show' },
                    { name: 'Legal contract preparation', defaultTiming: 'before_show' },
                    { name: 'Vendor contracts', defaultTiming: 'before_show' },
                    { name: 'Sponsorship agreements', defaultTiming: 'before_show' },
                ],
            },
            {
                title: 'Documentation & Printing',
                items: [
                    { name: 'Entry forms', defaultTiming: 'before_show' },
                    { name: 'Show programs', defaultTiming: 'before_show' },
                    { name: 'Judges cards', defaultTiming: 'before_show' },
                    { name: 'Score sheets', defaultTiming: 'before_show' },
                    { name: 'Pattern sheets', defaultTiming: 'before_show' },
                ],
            },
        ],
    },
    {
        id: 'operations',
        title: 'Operations',
        icon: '⚙️',
        color: 'border-orange-500',
        bgColor: 'bg-orange-500/5',
        textColor: 'text-orange-700 dark:text-orange-400',
        subGroups: [
            {
                title: 'Office Supplies',
                items: [
                    { name: 'Printer paper', defaultTiming: 'before_show' },
                    { name: 'Ink / toner', defaultTiming: 'before_show' },
                    { name: 'Clipboards', defaultTiming: 'before_show' },
                    { name: 'Office supplies', defaultTiming: 'before_show' },
                    { name: 'Filing systems', defaultTiming: 'before_show' },
                    { name: 'Label printers', defaultTiming: 'before_show' },
                ],
            },
            {
                title: 'Communications',
                items: [
                    { name: 'Two-way radios', defaultTiming: 'during_show' },
                    { name: 'Radio headsets', defaultTiming: 'during_show' },
                    { name: 'Charging stations', defaultTiming: 'during_show' },
                    { name: 'Announcer communication systems', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Arena Operations',
                items: [
                    { name: 'Tractor operation', defaultTiming: 'during_show' },
                    { name: 'Arena dragging', defaultTiming: 'during_show' },
                    { name: 'Arena watering', defaultTiming: 'during_show' },
                    { name: 'Arena crew labor', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Utilities & Temporary Infrastructure',
                items: [
                    { name: 'Generators', defaultTiming: 'during_show' },
                    { name: 'Generator fuel', defaultTiming: 'during_show' },
                    { name: 'Temporary lighting', defaultTiming: 'during_show' },
                    { name: 'Electrical distribution', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Transportation',
                items: [
                    { name: 'Equipment transportation', defaultTiming: 'before_show' },
                    { name: 'Trailer hauling fuel', defaultTiming: 'before_show' },
                    { name: 'Equipment drivers', defaultTiming: 'during_show' },
                ],
            },
        ],
    },
    {
        id: 'marketing',
        title: 'Marketing',
        icon: '📢',
        color: 'border-pink-500',
        bgColor: 'bg-pink-500/5',
        textColor: 'text-pink-700 dark:text-pink-400',
        subGroups: [
            {
                title: 'Digital Marketing',
                items: [
                    { name: 'Social media advertising', defaultTiming: 'before_show' },
                    { name: 'Website promotion', defaultTiming: 'before_show' },
                    { name: 'Email marketing campaigns', defaultTiming: 'before_show' },
                    { name: 'Online event listings', defaultTiming: 'before_show' },
                ],
            },
            {
                title: 'Print Marketing',
                items: [
                    { name: 'Posters', defaultTiming: 'before_show' },
                    { name: 'Flyers', defaultTiming: 'before_show' },
                    { name: 'Mailers', defaultTiming: 'before_show' },
                    { name: 'Event programs', defaultTiming: 'before_show' },
                ],
            },
            {
                title: 'Sponsorship Materials',
                items: [
                    { name: 'Sponsor banners', defaultTiming: 'before_show' },
                    { name: 'Arena signage', defaultTiming: 'before_show' },
                    { name: 'Sponsor boards', defaultTiming: 'before_show' },
                    { name: 'Sponsor recognition displays', defaultTiming: 'before_show' },
                ],
            },
            {
                title: 'Media Coverage',
                items: [
                    { name: 'Photographer contracts', defaultTiming: 'during_show' },
                    { name: 'Videographer contracts', defaultTiming: 'during_show' },
                    { name: 'Live stream production', defaultTiming: 'during_show' },
                ],
            },
        ],
    },
    {
        id: 'equipment',
        title: 'Equipment',
        icon: '🔧',
        color: 'border-cyan-500',
        bgColor: 'bg-cyan-500/5',
        textColor: 'text-cyan-700 dark:text-cyan-400',
        subGroups: [
            {
                title: 'Arena Equipment',
                items: [
                    { name: 'Cones', defaultTiming: 'during_show' },
                    { name: 'Poles', defaultTiming: 'during_show' },
                    { name: 'Barrels', defaultTiming: 'during_show' },
                    { name: 'Trail obstacles', defaultTiming: 'during_show' },
                    { name: 'Ranch obstacles', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Hunter / Jumping Equipment',
                items: [
                    { name: 'Jump standards', defaultTiming: 'during_show' },
                    { name: 'Jump rails', defaultTiming: 'during_show' },
                    { name: 'Cavaletti', defaultTiming: 'during_show' },
                    { name: 'Flower boxes', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Show Infrastructure',
                items: [
                    { name: 'Timing equipment', defaultTiming: 'during_show' },
                    { name: 'Scoreboards', defaultTiming: 'during_show' },
                    { name: 'Video displays', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Maintenance Equipment',
                items: [
                    { name: 'Tractor rental', defaultTiming: 'during_show' },
                    { name: 'Arena drag equipment', defaultTiming: 'during_show' },
                    { name: 'Water trucks', defaultTiming: 'during_show' },
                ],
            },
        ],
    },
    {
        id: 'hospitality',
        title: 'Hospitality',
        icon: '🍽️',
        color: 'border-rose-500',
        bgColor: 'bg-rose-500/5',
        textColor: 'text-rose-700 dark:text-rose-400',
        subGroups: [
            {
                title: 'Judges Hospitality',
                items: [
                    { name: 'Judges meals', defaultTiming: 'during_show' },
                    { name: 'Judges snacks', defaultTiming: 'during_show' },
                    { name: 'Judges beverages', defaultTiming: 'during_show' },
                    { name: 'Judges lounge supplies', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Staff Hospitality',
                items: [
                    { name: 'Staff meals', defaultTiming: 'during_show' },
                    { name: 'Staff snacks', defaultTiming: 'during_show' },
                    { name: 'Staff drinks', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'Exhibitor Hospitality',
                items: [
                    { name: 'Exhibitor welcome reception', defaultTiming: 'during_show' },
                    { name: 'Exhibitor coffee stations', defaultTiming: 'during_show' },
                    { name: 'Exhibitor hospitality tent', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'VIP & Sponsor Hospitality',
                items: [
                    { name: 'Sponsor lounge', defaultTiming: 'during_show' },
                    { name: 'VIP seating areas', defaultTiming: 'during_show' },
                    { name: 'Sponsor catering', defaultTiming: 'during_show' },
                ],
            },
            {
                title: 'General Hospitality',
                items: [
                    { name: 'Coffee stations', defaultTiming: 'during_show' },
                    { name: 'Water stations', defaultTiming: 'during_show' },
                    { name: 'Ice for horses', defaultTiming: 'during_show' },
                    { name: 'Ice for coolers', defaultTiming: 'during_show' },
                ],
            },
        ],
    },
];

const feeTimingLabels = {
    pre_entry: 'Pre-Entry / Reservation',
    at_check_in: 'At Check-In',
    settlement: 'Post-Show / Settlement',
};

const ExpenseDetailRow = ({ expense, onUpdateExpense, onRemoveExpense, locked, isCustom }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: expense.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 py-1.5 px-2 border-b last:border-0 hover:bg-muted/30 bg-background">
            {/* Drag handle */}
            {!locked && (
                <button type="button" className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
                    <GripVertical className="h-3.5 w-3.5" />
                </button>
            )}
            {/* Name */}
            <div className="min-w-[160px] flex-shrink-0">
                {isCustom ? (
                    <Input
                        value={expense.name}
                        onChange={(e) => onUpdateExpense(expense.id, 'name', e.target.value)}
                        placeholder="Expense name"
                        className="h-7 text-xs font-medium"
                        disabled={locked}
                    />
                ) : (
                    <span className="text-xs font-medium truncate block" title={expense.name}>{expense.name}</span>
                )}
            </div>
            {/* Amount */}
            <Input
                type="number"
                value={expense.amount}
                onChange={(e) => onUpdateExpense(expense.id, 'amount', e.target.value)}
                placeholder="$0"
                className="h-7 text-xs w-20 flex-shrink-0"
                disabled={locked}
            />
            {/* Unit */}
            <Select value={expense.unit || 'flat'} onValueChange={(val) => onUpdateExpense(expense.id, 'unit', val)} disabled={locked}>
                <SelectTrigger className="h-7 text-xs w-24 flex-shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {UNIT_OPTIONS.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {/* Qty */}
            <Input
                type="number"
                min="1"
                value={expense.quantity || ''}
                onChange={(e) => onUpdateExpense(expense.id, 'quantity', e.target.value)}
                placeholder="1"
                className="h-7 text-xs w-14 flex-shrink-0"
                disabled={locked}
            />
            {/* Timing */}
            <Select value={expense.timing || ''} onValueChange={(val) => onUpdateExpense(expense.id, 'timing', val)} disabled={locked}>
                <SelectTrigger className="h-7 text-xs w-28 flex-shrink-0"><SelectValue placeholder="When..." /></SelectTrigger>
                <SelectContent>
                    {TIMING_OPTIONS.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {/* Due Date */}
            <Input
                type="date"
                value={expense.dueDate || ''}
                onChange={(e) => onUpdateExpense(expense.id, 'dueDate', e.target.value)}
                className="h-7 text-xs w-32 flex-shrink-0"
                disabled={locked}
            />
            {/* Notes popover */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-7 w-7 flex-shrink-0', expense.notes ? 'text-primary' : 'text-muted-foreground')}
                    >
                        <StickyNote className="h-3.5 w-3.5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3">
                    <p className="text-xs font-medium mb-1.5">Notes</p>
                    <Textarea
                        value={expense.notes || ''}
                        onChange={(e) => onUpdateExpense(expense.id, 'notes', e.target.value)}
                        placeholder="e.g., Paid by sponsor, discount applied..."
                        className="text-xs min-h-[80px] resize-none"
                        disabled={locked}
                    />
                </PopoverContent>
            </Popover>
            {/* Delete */}
            {!locked && (
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-destructive hover:bg-destructive/10" onClick={() => onRemoveExpense(expense.id)}>
                    <Trash2 className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
};

const CategorySection = ({ category, expenses, onToggleItem, onUpdateExpense, onRemoveExpense, onAddCustom, onReorderExpenses, locked }) => {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const [expanded, setExpanded] = useState(false);
    const categoryExpenses = expenses.filter(e => e.category === category.id);
    const categoryTotal = categoryExpenses.reduce((sum, e) => sum + ((parseFloat(e.amount) || 0) * (parseInt(e.quantity) || 1)), 0);
    const activeCount = categoryExpenses.length;

    const allPresetNames = new Set(category.subGroups.flatMap(sg => sg.items.map(i => i.name)));
    const customExpenses = categoryExpenses.filter(e => !allPresetNames.has(e.name));
    const activeNames = new Set(categoryExpenses.map(e => e.name));

    return (
        <Card className={cn('overflow-hidden border-l-4', category.color)}>
            <div
                className={cn('px-4 py-3 flex items-center justify-between cursor-pointer select-none', category.bgColor)}
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg">{category.icon}</span>
                    <h4 className={cn('font-semibold text-base', category.textColor)}>{category.title}</h4>
                    {activeCount > 0 && (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', category.bgColor, category.textColor)}>
                            {activeCount} item{activeCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {categoryTotal > 0 && (
                        <span className={cn('text-sm font-semibold', category.textColor)}>${categoryTotal.toFixed(2)}</span>
                    )}
                    {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
            </div>

            {expanded && (
                <CardContent className="pt-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        {/* Left panel (1/3) — item selector */}
                        <div className="lg:w-1/3 space-y-4 lg:border-r lg:pr-4">
                            {category.subGroups.map(subGroup => (
                                <div key={subGroup.title} className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{subGroup.title}</p>
                                    <div className="flex flex-wrap gap-1">
                                        {subGroup.items.map(item => {
                                            const isActive = activeNames.has(item.name);
                                            return (
                                                <button
                                                    key={item.name}
                                                    type="button"
                                                    disabled={locked}
                                                    onClick={() => onToggleItem(category.id, item)}
                                                    className={cn(
                                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all',
                                                        isActive
                                                            ? 'bg-primary text-primary-foreground border-primary'
                                                            : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
                                                        locked && 'opacity-50 cursor-not-allowed'
                                                    )}
                                                >
                                                    {isActive && <Check className="h-2.5 w-2.5" />}
                                                    {item.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => onAddCustom(category.id)} disabled={locked}>
                                <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Custom
                            </Button>
                        </div>

                        {/* Right panel (2/3) — compact detail rows */}
                        <div className="lg:w-2/3">
                            {categoryExpenses.length === 0 ? (
                                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground border border-dashed rounded-lg">
                                    Select items from the left to configure details
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    {/* Column header */}
                                    <div className="flex items-center gap-1.5 py-1 px-2 bg-muted/50 border-b text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                        {!locked && <div className="w-3.5 flex-shrink-0"></div>}
                                        <div className="min-w-[160px] flex-shrink-0">Item</div>
                                        <div className="w-20 flex-shrink-0">Amount</div>
                                        <div className="w-24 flex-shrink-0">Unit</div>
                                        <div className="w-14 flex-shrink-0">Qty</div>
                                        <div className="w-28 flex-shrink-0">Timing</div>
                                        <div className="w-32 flex-shrink-0">Due Date</div>
                                        <div className="w-7 flex-shrink-0"></div>
                                        <div className="w-7 flex-shrink-0"></div>
                                    </div>
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={(event) => {
                                            const { active, over } = event;
                                            if (over && active.id !== over.id) {
                                                onReorderExpenses(category.id, active.id, over.id);
                                            }
                                        }}
                                    >
                                        <SortableContext items={categoryExpenses.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                            {categoryExpenses.map(expense => (
                                                <ExpenseDetailRow
                                                    key={expense.id}
                                                    expense={expense}
                                                    onUpdateExpense={onUpdateExpense}
                                                    onRemoveExpense={onRemoveExpense}
                                                    locked={locked}
                                                    isCustom={!allPresetNames.has(expense.name)}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

export const ShowExpensesStep = ({ formData, setFormData }) => {
    const expenses = formData.showExpenses || [];
    const fees = formData.fees || [];
    const sponsorshipRevenue = formData.sponsorshipRevenue || [];
    const awardExpenses = formData.awardExpenses || [];
    const classAwards = formData.classAwards || {};

    const totalFeeRevenue = useMemo(() => fees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0), [fees]);
    const totalSponsorshipRevenue = useMemo(() => sponsorshipRevenue.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0), [sponsorshipRevenue]);
    const totalRevenue = totalFeeRevenue + totalSponsorshipRevenue;

    const totalShowExpenses = useMemo(() => expenses.reduce((sum, e) => sum + ((parseFloat(e.amount) || 0) * (parseInt(e.quantity) || 1)), 0), [expenses]);
    const totalAwardExpenses = useMemo(() => awardExpenses.reduce((sum, a) => sum + ((parseFloat(a.amount) || 0) * (parseInt(a.qty) || 1)), 0), [awardExpenses]);
    const totalClassAwards = useMemo(() => Object.values(classAwards).reduce((sum, ca) => {
        const items = ca.items || [];
        if (items.length === 0 && ca.budget) return sum + (parseFloat(ca.budget) || 0);
        return sum + items.reduce((s, i) => s + ((parseFloat(i.cost) || 0) * (parseInt(i.qty) || 1)), 0);
    }, 0), [classAwards]);
    const totalExpenses = totalShowExpenses + totalAwardExpenses + totalClassAwards;

    const netProfitLoss = totalRevenue - totalExpenses;
    const locked = isBudgetFrozen(formData);

    const toggleItem = (categoryId, item) => {
        setFormData(prev => {
            const existing = (prev.showExpenses || []).find(e => e.category === categoryId && e.name === item.name);
            if (existing) {
                return { ...prev, showExpenses: (prev.showExpenses || []).filter(e => e.id !== existing.id) };
            }
            const newExpense = { id: uuidv4(), name: item.name, amount: '', category: categoryId, timing: item.defaultTiming, unit: 'flat', quantity: '', dueDate: '', notes: '' };
            return { ...prev, showExpenses: [...(prev.showExpenses || []), newExpense] };
        });
    };

    const addCustomExpense = (categoryId) => {
        const newExpense = { id: uuidv4(), name: '', amount: '', category: categoryId, timing: 'before_show', unit: 'flat', quantity: '', dueDate: '', notes: '' };
        setFormData(prev => ({ ...prev, showExpenses: [...(prev.showExpenses || []), newExpense] }));
    };

    const updateExpense = (id, field, value) => {
        setFormData(prev => ({ ...prev, showExpenses: (prev.showExpenses || []).map(e => e.id === id ? { ...e, [field]: value } : e) }));
    };

    const removeExpense = (id) => {
        setFormData(prev => ({ ...prev, showExpenses: (prev.showExpenses || []).filter(e => e.id !== id) }));
    };

    const reorderExpenses = (categoryId, activeId, overId) => {
        setFormData(prev => {
            const all = prev.showExpenses || [];
            const catItems = all.filter(e => e.category === categoryId);
            const others = all.filter(e => e.category !== categoryId);
            const oldIndex = catItems.findIndex(e => e.id === activeId);
            const newIndex = catItems.findIndex(e => e.id === overId);
            if (oldIndex === -1 || newIndex === -1) return prev;
            const reordered = arrayMove(catItems, oldIndex, newIndex);
            return { ...prev, showExpenses: [...others, ...reordered] };
        });
    };

    const timingSummary = useMemo(() => {
        const counts = { before_show: 0, during_show: 0, after_show: 0 };
        const totals = { before_show: 0, during_show: 0, after_show: 0 };
        for (const e of expenses) {
            if (e.timing && counts[e.timing] !== undefined) {
                counts[e.timing]++;
                totals[e.timing] += parseFloat(e.amount) || 0;
            }
        }
        return { counts, totals };
    }, [expenses]);

    return (
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 4: Show Expenses</CardTitle>
                <CardDescription>Select expense items by category, set amounts, and assign timing buckets.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

                {locked && <BudgetFrozenBanner />}

                {/* Timing summary badges */}
                {totalShowExpenses > 0 && (
                    <div className="flex flex-wrap gap-3">
                        {TIMING_OPTIONS.map(t => (
                            <div key={t.id} className={cn('px-3 py-2 rounded-lg text-xs font-medium', t.bg, t.color)}>
                                <span className="font-semibold">{t.label}:</span> {timingSummary.counts[t.id]} items / ${timingSummary.totals[t.id].toFixed(2)}
                            </div>
                        ))}
                    </div>
                )}

                {/* Category sections */}
                {EXPENSE_FRAMEWORK.map(category => (
                    <CategorySection
                        key={category.id}
                        category={category}
                        expenses={expenses}
                        onToggleItem={toggleItem}
                        onUpdateExpense={updateExpense}
                        onRemoveExpense={removeExpense}
                        onAddCustom={addCustomExpense}
                        onReorderExpenses={reorderExpenses}
                        locked={locked}
                    />
                ))}

                {totalShowExpenses > 0 && (
                    <div className="text-right px-2">
                        <p className="text-sm font-semibold text-red-600">Total Show Expenses: ${totalShowExpenses.toFixed(2)}</p>
                    </div>
                )}

                {/* ========== BUDGET SUMMARY / P&L ========== */}
                {expenses.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-muted/50 border-b flex items-center justify-between">
                            <h4 className="font-semibold text-base">Expense Summary</h4>
                            <Button variant="outline" size="sm" onClick={() => exportShowBudgetToExcel(formData)}>
                                <Download className="h-4 w-4 mr-2" /> Export Spreadsheet
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-red-500/5">
                                        <th className="text-left px-4 py-2 font-medium text-red-700 dark:text-red-400" colSpan={2}>EXPENSES</th>
                                        <th className="text-right px-4 py-2 font-medium text-red-700 dark:text-red-400">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {EXPENSE_FRAMEWORK.map(cat => {
                                        const catExpenses = expenses.filter(e => e.category === cat.id && e.name && e.amount);
                                        if (catExpenses.length === 0) return null;
                                        const catTotal = catExpenses.reduce((sum, e) => sum + ((parseFloat(e.amount) || 0) * (parseInt(e.quantity) || 1)), 0);
                                        return (
                                            <React.Fragment key={cat.id}>
                                                <tr className={cat.bgColor}>
                                                    <td className={cn('px-4 py-1.5 font-semibold text-xs uppercase', cat.textColor)} colSpan={3}>
                                                        {cat.icon} {cat.title}
                                                    </td>
                                                </tr>
                                                {catExpenses.map(expense => {
                                                    const timingLabel = TIMING_OPTIONS.find(t => t.id === expense.timing)?.label || '';
                                                    const qty = parseInt(expense.quantity) || 1;
                                                    const lineTotal = (parseFloat(expense.amount) || 0) * qty;
                                                    const unitLabel = UNIT_OPTIONS.find(u => u.id === expense.unit)?.label;
                                                    const qtyInfo = qty > 1 && unitLabel ? ` (${qty} × ${unitLabel})` : '';
                                                    return (
                                                        <tr key={expense.id} className="border-b last:border-0">
                                                            <td className="px-4 py-2">{expense.name}{qtyInfo}</td>
                                                            <td className="px-4 py-2 text-muted-foreground">{timingLabel}</td>
                                                            <td className="px-4 py-2 text-right font-medium">${lineTotal.toFixed(2)}</td>
                                                        </tr>
                                                    );
                                                })}
                                                <tr className="bg-red-500/5">
                                                    <td className="px-4 py-1.5 font-semibold text-xs" colSpan={2}>Subtotal {cat.title}</td>
                                                    <td className="px-4 py-1.5 text-right font-semibold text-xs">${catTotal.toFixed(2)}</td>
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })}
                                    {expenses.filter(e => !e.category && e.name && e.amount).length > 0 && (
                                        <>
                                            {expenses.filter(e => !e.category && e.name && e.amount).map(expense => {
                                                const qty = parseInt(expense.quantity) || 1;
                                                const lineTotal = (parseFloat(expense.amount) || 0) * qty;
                                                return (
                                                    <tr key={expense.id} className="border-b last:border-0">
                                                        <td className="px-4 py-2">{expense.name}</td>
                                                        <td className="px-4 py-2 text-muted-foreground">{TIMING_OPTIONS.find(t => t.id === expense.timing)?.label || ''}</td>
                                                        <td className="px-4 py-2 text-right font-medium">${lineTotal.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </>
                                    )}
                                    {totalShowExpenses > 0 && (
                                        <tr className="bg-red-500/5">
                                            <td className="px-4 py-2 font-semibold" colSpan={2}>Subtotal Show Expenses</td>
                                            <td className="px-4 py-2 text-right font-semibold">${totalShowExpenses.toFixed(2)}</td>
                                        </tr>
                                    )}
                                    {awardExpenses.filter(a => a.name && a.amount).map(award => (
                                        <tr key={award.id} className="border-b last:border-0">
                                            <td className="px-4 py-2">{award.name}</td>
                                            <td className="px-4 py-2 text-muted-foreground">Awards (Step 6)</td>
                                            <td className="px-4 py-2 text-right font-medium">${((parseFloat(award.amount) || 0) * (parseInt(award.qty) || 1)).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {totalClassAwards > 0 && (
                                        <tr className="border-b last:border-0">
                                            <td className="px-4 py-2">Class Awards Budget</td>
                                            <td className="px-4 py-2 text-muted-foreground">Awards (Step 6)</td>
                                            <td className="px-4 py-2 text-right font-medium">${totalClassAwards.toFixed(2)}</td>
                                        </tr>
                                    )}
                                    {(totalAwardExpenses > 0 || totalClassAwards > 0) && (
                                        <tr className="bg-red-500/5">
                                            <td className="px-4 py-2 font-semibold" colSpan={2}>Subtotal Award Expenses</td>
                                            <td className="px-4 py-2 text-right font-semibold">${(totalAwardExpenses + totalClassAwards).toFixed(2)}</td>
                                        </tr>
                                    )}
                                    <tr className="bg-red-500/10 font-bold">
                                        <td className="px-4 py-3" colSpan={2}>TOTAL EXPENSES</td>
                                        <td className="px-4 py-3 text-right text-red-700 dark:text-red-400">${totalExpenses.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </CardContent>
        </motion.div>
    );
};
