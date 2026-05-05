import React, { useMemo, useState, useCallback } from 'react';
import { parseDivisionId } from '@/lib/showBillUtils';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { PlusCircle, Trash2, ChevronDown, ChevronRight, Trophy, Award, Medal, Gift, ShoppingCart, Calculator, Copy, CopyCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const AWARD_TYPES = ['Trophy', 'Buckle', 'Ribbon', 'Halter', 'Plaque', 'Prize Money', 'Cooler', 'Blanket', 'Gift Card', 'Jacket', 'Saddle', 'Scholarship', 'Other'];

const PRIZE_TYPES = ['Buckle', 'Trophy', 'Plaque', 'Ribbon', 'Halter', 'Prize Money', 'Cooler', 'Blanket', 'Jacket', 'Saddle', 'Gift Card', 'Scholarship', 'Custom'];

const PLACEMENT_PRESETS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', 'Champion', 'Reserve', 'Top 3', 'Top 5', 'All Entries'];

const AWARD_CATEGORIES = [
    { id: 'highPoint', title: 'High Point / All-Around Awards', icon: Trophy, color: 'border-amber-500', bgColor: 'bg-amber-500/5', textColor: 'text-amber-700 dark:text-amber-400', description: 'Champion and reserve champion awards across divisions' },
    { id: 'circuit', title: 'Circuit Awards', icon: Medal, color: 'border-blue-500', bgColor: 'bg-blue-500/5', textColor: 'text-blue-700 dark:text-blue-400', description: 'Awards that apply across multiple classes or shows' },
    { id: 'special', title: 'Special Awards', icon: Award, color: 'border-purple-500', bgColor: 'bg-purple-500/5', textColor: 'text-purple-700 dark:text-purple-400', description: 'Sponsor trophies, scholarships, sportsmanship awards' },
];

const AwardCategoryCard = ({ category, awards, onUpdate, onAddItem, onRemoveItem, onAddPrize, onRemovePrize, onUpdatePrize }) => {
    const [expanded, setExpanded] = useState(false);
    const items = awards[category.id] || [];
    const Icon = category.icon;
    const allPrizes = items.flatMap(item => item.prizes || []);
    const totalBudget = allPrizes.reduce((sum, p) => sum + ((parseFloat(p.value) || 0) * (parseInt(p.qty) || 1)), 0);
    const donatedTotal = allPrizes.filter(p => p.source === 'donated').reduce((sum, p) => sum + ((parseFloat(p.value) || 0) * (parseInt(p.qty) || 1)), 0);
    const purchasedTotal = totalBudget - donatedTotal;

    return (
        <div className={cn('border rounded-lg overflow-hidden border-l-4', category.color)}>
            <div
                className={cn('px-4 py-3 flex items-center justify-between cursor-pointer select-none', category.bgColor)}
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <Icon className={cn('h-5 w-5', category.textColor)} />
                    <div>
                        <h4 className={cn('font-semibold text-sm', category.textColor)}>{category.title}</h4>
                        <p className="text-[11px] text-muted-foreground">{category.description}</p>
                    </div>
                    {items.length > 0 && (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', category.bgColor, category.textColor)}>
                            {items.length} award{items.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {totalBudget > 0 && (
                        <div className="text-right">
                            <span className={cn('text-sm font-semibold', category.textColor)}>${totalBudget.toFixed(2)}</span>
                            {donatedTotal > 0 && (
                                <div className="flex gap-2 text-[10px]">
                                    {purchasedTotal > 0 && <span className="text-muted-foreground">${purchasedTotal.toFixed(2)} purchased</span>}
                                    <span className="text-emerald-600">${donatedTotal.toFixed(2)} donated</span>
                                </div>
                            )}
                        </div>
                    )}
                    {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
            </div>

            {expanded && (
                <div className="p-4 space-y-3">
                    {items.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed rounded-lg">
                            <p className="text-sm text-muted-foreground">No awards defined yet. Add one below.</p>
                        </div>
                    ) : (
                        items.map((item, idx) => (
                            <div key={item.id} className="border rounded-lg bg-background p-3 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={item.name}
                                        onChange={(e) => onUpdate(category.id, item.id, 'name', e.target.value)}
                                        placeholder={category.id === 'highPoint' ? 'e.g., Amateur High Point' : category.id === 'circuit' ? 'e.g., All-Around Circuit Award' : 'e.g., Sportsmanship Award'}
                                        className="flex-1 font-medium h-8 text-sm"
                                    />
                                    <Input
                                        value={item.criteria || ''}
                                        onChange={(e) => onUpdate(category.id, item.id, 'criteria', e.target.value)}
                                        placeholder="Criteria / eligibility..."
                                        className="flex-1 h-8 text-sm"
                                    />
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0" onClick={() => onRemoveItem(category.id, item.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                {/* Prize items */}
                                <div className="pl-4 border-l-2 border-muted space-y-1.5">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Prize Items</p>
                                    {(item.prizes || []).map((prize, pIdx) => (
                                        <div key={prize.id} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                            <Select value={prize.type || ''} onValueChange={(val) => onUpdatePrize(category.id, item.id, prize.id, 'type', val)}>
                                                <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Type..." /></SelectTrigger>
                                                <SelectContent>
                                                    {PRIZE_TYPES.map(t => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                value={prize.description || ''}
                                                onChange={(e) => onUpdatePrize(category.id, item.id, prize.id, 'description', e.target.value)}
                                                placeholder="Description..."
                                                className="h-7 text-xs flex-1 min-w-[100px]"
                                            />
                                            <Input
                                                type="number"
                                                value={prize.value || ''}
                                                onChange={(e) => onUpdatePrize(category.id, item.id, prize.id, 'value', e.target.value)}
                                                placeholder="$0"
                                                className="h-7 text-xs w-20 text-right"
                                            />
                                            <Input
                                                type="number"
                                                min="1"
                                                value={prize.qty || ''}
                                                onChange={(e) => onUpdatePrize(category.id, item.id, prize.id, 'qty', e.target.value)}
                                                placeholder="Qty"
                                                className="h-7 text-xs w-14 text-right"
                                            />
                                            <Select value={prize.source || 'purchased'} onValueChange={(val) => onUpdatePrize(category.id, item.id, prize.id, 'source', val)}>
                                                <SelectTrigger className={cn('h-7 text-xs w-28', prize.source === 'donated' ? 'text-emerald-600 border-emerald-300' : '')}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="purchased"><span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Purchased</span></SelectItem>
                                                    <SelectItem value="donated"><span className="flex items-center gap-1"><Gift className="h-3 w-3" /> Donated</span></SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => onRemovePrize(category.id, item.id, prize.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => onAddPrize(category.id, item.id)}>
                                        <PlusCircle className="h-3 w-3 mr-1" /> Add Prize Item
                                    </Button>
                                </div>

                                {/* Item notes */}
                                <Input
                                    value={item.notes || ''}
                                    onChange={(e) => onUpdate(category.id, item.id, 'notes', e.target.value)}
                                    placeholder="Notes (e.g., sponsored by..., eligibility rules...)"
                                    className="h-7 text-xs"
                                />
                            </div>
                        ))
                    )}
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => onAddItem(category.id)}>
                        <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Award
                    </Button>
                </div>
            )}
        </div>
    );
};

const CircuitAwardsCard = ({ divisions, awards, onUpdate, onAddItem, onRemoveItem, onAddPrize, onRemovePrize, onUpdatePrize }) => {
    const [expanded, setExpanded] = useState(false);
    const items = awards.circuit || [];
    const totalAllDivisions = divisions.reduce((sum, d) => sum + d.classCount, 0);

    // Auto-calculate totals per award based on division class count + costPerClass
    const getAwardAutoTotal = (item) => {
        const costPerClass = parseFloat(item.costPerClass) || 0;
        const prizeTotal = (item.prizes || []).reduce((sum, p) => sum + ((parseFloat(p.value) || 0) * (parseInt(p.qty) || 1)), 0);
        const perClassTotal = costPerClass + prizeTotal;
        if (perClassTotal === 0) return null;

        if (item.division === '__all__') {
            return { classCount: totalAllDivisions, perClass: perClassTotal, total: perClassTotal * totalAllDivisions };
        }
        if (!item.division) return null;
        const div = divisions.find(d => d.id === item.division);
        if (!div) return null;
        return { classCount: div.classCount, perClass: perClassTotal, total: perClassTotal * div.classCount };
    };

    const grandAutoTotal = items.reduce((sum, item) => {
        const calc = getAwardAutoTotal(item);
        return sum + (calc ? calc.total : 0);
    }, 0);

    return (
        <div className="border rounded-lg overflow-hidden border-l-4 border-blue-500">
            <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer select-none bg-blue-500/5"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <Medal className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                    <div>
                        <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-400">Circuit Awards</h4>
                        <p className="text-[11px] text-muted-foreground">Awards calculated per eligible class in each division</p>
                    </div>
                    {items.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/5 text-blue-700 dark:text-blue-400">
                            {items.length} award{items.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {grandAutoTotal > 0 && (
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">${grandAutoTotal.toFixed(2)}</span>
                    )}
                    {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
            </div>

            {expanded && (
                <div className="p-4 space-y-4">
                    {/* Division class counts summary */}
                    {divisions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {divisions.map(div => (
                                <Badge key={div.id} variant="outline" className="text-xs gap-1.5 py-1">
                                    <span className="font-semibold">{div.name}</span>
                                    <span className="text-muted-foreground">{div.classCount} class{div.classCount !== 1 ? 'es' : ''}</span>
                                </Badge>
                            ))}
                            <Badge variant="outline" className="text-xs gap-1.5 py-1 border-blue-300">
                                <span className="font-semibold text-blue-700 dark:text-blue-400">All Divisions</span>
                                <span className="text-muted-foreground">{totalAllDivisions} classes</span>
                            </Badge>
                        </div>
                    )}

                    {/* Awards grouped by division */}
                    {divisions.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed rounded-lg">
                            <p className="text-sm text-muted-foreground">No divisions found. Add disciplines and classes in earlier steps.</p>
                        </div>
                    ) : (
                        <>
                            {[...divisions, { id: '__all__', name: 'All Divisions', classCount: totalAllDivisions }].map(div => {
                                const divAwards = items.filter(item => item.division === div.id);
                                const isAll = div.id === '__all__';
                                return (
                                    <div key={div.id} className={cn('space-y-2', isAll && 'pt-2 border-t')}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h5 className={cn('text-sm font-semibold', isAll && 'text-blue-700 dark:text-blue-400')}>{div.name}</h5>
                                                <span className="text-xs text-muted-foreground">({div.classCount} classes)</span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => onAddItem('circuit', div.id)}
                                            >
                                                <PlusCircle className="h-3 w-3 mr-1" /> Add Circuit Award
                                            </Button>
                                        </div>
                                        {divAwards.length === 0 ? (
                                            <p className="text-xs text-muted-foreground pl-2 italic">No circuit awards for this division</p>
                                        ) : (
                                            divAwards.map(item => {
                                                const calc = getAwardAutoTotal(item);
                                                return (
                                                    <div key={item.id} className="border rounded-lg bg-background p-3 space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                value={item.name}
                                                                onChange={(e) => onUpdate('circuit', item.id, 'name', e.target.value)}
                                                                placeholder="e.g., All-Around Circuit Award"
                                                                className="flex-1 font-medium h-8 text-sm"
                                                            />
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0" onClick={() => onRemoveItem('circuit', item.id)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>

                                                        {/* Criteria */}
                                                        <Input
                                                            value={item.criteria || ''}
                                                            onChange={(e) => onUpdate('circuit', item.id, 'criteria', e.target.value)}
                                                            placeholder="Award criteria (e.g., horse must show in at least 2 classes, highest combined score...)"
                                                            className="h-8 text-sm"
                                                        />

                                                        {/* Cost per class + auto-calc */}
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-2">
                                                                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Cost per class</label>
                                                                <Input
                                                                    type="number"
                                                                    value={item.costPerClass || ''}
                                                                    onChange={(e) => onUpdate('circuit', item.id, 'costPerClass', e.target.value)}
                                                                    placeholder="$0"
                                                                    className="h-8 text-sm w-24"
                                                                />
                                                            </div>
                                                            {calc && (
                                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/5 text-xs flex-1">
                                                                    <Calculator className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                                                                    <span className="text-blue-700 dark:text-blue-400 font-medium">
                                                                        ${calc.perClass.toFixed(2)} per class x {calc.classCount} classes = <span className="font-bold">${calc.total.toFixed(2)}</span>
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Prize items */}
                                                        <div className="pl-4 border-l-2 border-muted space-y-1.5">
                                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Prize Items (per class)</p>
                                                            {(item.prizes || []).map(prize => (
                                                                <div key={prize.id} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                                                    <Select value={prize.type || ''} onValueChange={(val) => onUpdatePrize('circuit', item.id, prize.id, 'type', val)}>
                                                                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Type..." /></SelectTrigger>
                                                                        <SelectContent>
                                                                            {PRIZE_TYPES.map(t => (
                                                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Input
                                                                        value={prize.description || ''}
                                                                        onChange={(e) => onUpdatePrize('circuit', item.id, prize.id, 'description', e.target.value)}
                                                                        placeholder="Description..."
                                                                        className="h-7 text-xs flex-1 min-w-[100px]"
                                                                    />
                                                                    <Input
                                                                        type="number"
                                                                        value={prize.value || ''}
                                                                        onChange={(e) => onUpdatePrize('circuit', item.id, prize.id, 'value', e.target.value)}
                                                                        placeholder="$0"
                                                                        className="h-7 text-xs w-20 text-right"
                                                                    />
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        value={prize.qty || ''}
                                                                        onChange={(e) => onUpdatePrize('circuit', item.id, prize.id, 'qty', e.target.value)}
                                                                        placeholder="Qty"
                                                                        className="h-7 text-xs w-14 text-right"
                                                                    />
                                                                    <Select value={prize.source || 'purchased'} onValueChange={(val) => onUpdatePrize('circuit', item.id, prize.id, 'source', val)}>
                                                                        <SelectTrigger className={cn('h-7 text-xs w-28', prize.source === 'donated' ? 'text-emerald-600 border-emerald-300' : '')}>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="purchased"><span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Purchased</span></SelectItem>
                                                                            <SelectItem value="donated"><span className="flex items-center gap-1"><Gift className="h-3 w-3" /> Donated</span></SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => onRemovePrize('circuit', item.id, prize.id)}>
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => onAddPrize('circuit', item.id)}>
                                                                <PlusCircle className="h-3 w-3 mr-1" /> Add Prize Item
                                                            </Button>
                                                        </div>

                                                        {/* Notes */}
                                                        <Input
                                                            value={item.notes || ''}
                                                            onChange={(e) => onUpdate('circuit', item.id, 'notes', e.target.value)}
                                                            placeholder="Notes (e.g., sponsored by..., eligibility rules...)"
                                                            className="h-7 text-xs"
                                                        />
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                );
                            })}

                            {/* Awards not assigned to a division (legacy / unassigned) */}
                            {items.filter(i => !i.division).length > 0 && (
                                <div className="space-y-2">
                                    <h5 className="text-sm font-semibold text-muted-foreground">Unassigned</h5>
                                    {items.filter(i => !i.division).map(item => (
                                        <div key={item.id} className="border rounded-lg bg-background p-3 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={item.name}
                                                    onChange={(e) => onUpdate('circuit', item.id, 'name', e.target.value)}
                                                    placeholder="e.g., All-Around Circuit Award"
                                                    className="flex-1 font-medium h-8 text-sm"
                                                />
                                                <Select value={item.division || ''} onValueChange={(val) => onUpdate('circuit', item.id, 'division', val)}>
                                                    <SelectTrigger className="h-8 text-sm w-40"><SelectValue placeholder="Assign division..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {divisions.map(d => (
                                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                        ))}
                                                        <SelectItem value="__all__">All Divisions</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0" onClick={() => onRemoveItem('circuit', item.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export const AwardsSponsorshipStep = ({ formData, setFormData }) => {
    const structuredAwards = formData.structuredAwards || {};

    const updateAwardItem = (categoryId, itemId, field, value) => {
        setFormData(prev => {
            const catItems = [...(prev.structuredAwards?.[categoryId] || [])];
            const idx = catItems.findIndex(i => i.id === itemId);
            if (idx >= 0) catItems[idx] = { ...catItems[idx], [field]: value };
            return { ...prev, structuredAwards: { ...prev.structuredAwards, [categoryId]: catItems } };
        });
    };

    const addAwardItem = (categoryId, divisionId) => {
        const newItem = { id: uuidv4(), name: '', criteria: '', notes: '', prizes: [], ...(divisionId ? { division: divisionId } : {}) };
        setFormData(prev => ({
            ...prev,
            structuredAwards: {
                ...prev.structuredAwards,
                [categoryId]: [...(prev.structuredAwards?.[categoryId] || []), newItem],
            },
        }));
    };

    const removeAwardItem = (categoryId, itemId) => {
        setFormData(prev => ({
            ...prev,
            structuredAwards: {
                ...prev.structuredAwards,
                [categoryId]: (prev.structuredAwards?.[categoryId] || []).filter(i => i.id !== itemId),
            },
        }));
    };

    const addPrize = (categoryId, itemId) => {
        const newPrize = { id: uuidv4(), type: '', description: '', value: '', qty: 1, source: 'purchased' };
        setFormData(prev => {
            const catItems = [...(prev.structuredAwards?.[categoryId] || [])];
            const idx = catItems.findIndex(i => i.id === itemId);
            if (idx >= 0) {
                catItems[idx] = { ...catItems[idx], prizes: [...(catItems[idx].prizes || []), newPrize] };
            }
            return { ...prev, structuredAwards: { ...prev.structuredAwards, [categoryId]: catItems } };
        });
    };

    const removePrize = (categoryId, itemId, prizeId) => {
        setFormData(prev => {
            const catItems = [...(prev.structuredAwards?.[categoryId] || [])];
            const idx = catItems.findIndex(i => i.id === itemId);
            if (idx >= 0) {
                catItems[idx] = { ...catItems[idx], prizes: (catItems[idx].prizes || []).filter(p => p.id !== prizeId) };
            }
            return { ...prev, structuredAwards: { ...prev.structuredAwards, [categoryId]: catItems } };
        });
    };

    const updatePrize = (categoryId, itemId, prizeId, field, value) => {
        setFormData(prev => {
            const catItems = [...(prev.structuredAwards?.[categoryId] || [])];
            const itemIdx = catItems.findIndex(i => i.id === itemId);
            if (itemIdx >= 0) {
                const prizes = [...(catItems[itemIdx].prizes || [])];
                const prizeIdx = prizes.findIndex(p => p.id === prizeId);
                if (prizeIdx >= 0) {
                    prizes[prizeIdx] = { ...prizes[prizeIdx], [field]: value };
                    catItems[itemIdx] = { ...catItems[itemIdx], prizes };
                }
            }
            return { ...prev, structuredAwards: { ...prev.structuredAwards, [categoryId]: catItems } };
        });
    };

    // --- Award Expenses (general) ---
    const awardExpenses = formData.awardExpenses || [];
    const totalAwardExpenses = useMemo(() => awardExpenses.reduce((sum, a) => sum + ((parseFloat(a.amount) || 0) * (parseInt(a.qty) || 1)), 0), [awardExpenses]);

    const updateAwardExpense = (id, field, value) => {
        setFormData(prev => ({ ...prev, awardExpenses: (prev.awardExpenses || []).map(a => a.id === id ? { ...a, [field]: value } : a) }));
    };

    // --- Divisions with class counts (for circuit awards) ---
    const divisions = useMemo(() => {
        const disciplines = formData.disciplines || [];
        const divMap = {};
        for (const disc of disciplines) {
            for (const divId of (disc.divisionOrder || [])) {
                const name = disc.divisionPrintTitles?.[divId] || parseDivisionId(divId).divisionName;
                if (!divMap[name]) {
                    divMap[name] = { id: name, name, classCount: 0 };
                }
                divMap[name].classCount++;
            }
        }
        return Object.values(divMap);
    }, [formData.disciplines]);

    // --- Class Awards Budget ---
    const classes = useMemo(() => {
        const disciplines = formData.disciplines || [];
        const items = [];
        for (const disc of disciplines) {
            for (const divId of (disc.divisionOrder || [])) {
                const name = disc.divisionPrintTitles?.[divId] || parseDivisionId(divId).divisionName;
                items.push({ id: `${disc.name}::${divId}`, name, disciplineName: disc.name });
            }
        }
        return items;
    }, [formData.disciplines]);

    const classAwards = formData.classAwards || {};

    // Each classAwards[classId] = { items: [{ id, placement, type, description, cost, qty }] }
    const addClassAwardItem = (classId) => {
        setFormData(prev => {
            const existing = prev.classAwards?.[classId] || { items: [] };
            const newItem = { id: uuidv4(), placement: '', type: '', description: '', cost: '', qty: 1 };
            return {
                ...prev,
                classAwards: {
                    ...(prev.classAwards || {}),
                    [classId]: { ...existing, items: [...(existing.items || []), newItem] },
                },
            };
        });
    };

    const updateClassAwardItem = (classId, itemId, field, value) => {
        setFormData(prev => {
            const existing = prev.classAwards?.[classId] || { items: [] };
            return {
                ...prev,
                classAwards: {
                    ...(prev.classAwards || {}),
                    [classId]: {
                        ...existing,
                        items: (existing.items || []).map(i => i.id === itemId ? { ...i, [field]: value } : i),
                    },
                },
            };
        });
    };

    const removeClassAwardItem = (classId, itemId) => {
        setFormData(prev => {
            const existing = prev.classAwards?.[classId] || { items: [] };
            return {
                ...prev,
                classAwards: {
                    ...(prev.classAwards || {}),
                    [classId]: {
                        ...existing,
                        items: (existing.items || []).filter(i => i.id !== itemId),
                    },
                },
            };
        });
    };

    const duplicateClassAwards = useCallback((sourceClassId, targetScope) => {
        setFormData(prev => {
            const sourceItems = prev.classAwards?.[sourceClassId]?.items || [];
            if (sourceItems.length === 0) return prev;

            const updated = { ...(prev.classAwards || {}) };

            // targetScope is either '__all__' or a division name (div.id which equals div.name)
            const targetIds = targetScope === '__all__'
                ? classes.map(c => c.id).filter(id => id !== sourceClassId)
                : classes.filter(c => c.name === targetScope && c.id !== sourceClassId).map(c => c.id);

            for (const targetId of targetIds) {
                const cloned = sourceItems.map(item => ({ ...item, id: uuidv4() }));
                updated[targetId] = { items: cloned };
            }
            return { ...prev, classAwards: updated };
        });
    }, [classes]);

    const classAwardsTotal = useMemo(() => {
        return Object.values(classAwards).reduce((sum, ca) => {
            const items = ca.items || [];
            // Support legacy format (budget field) and new format (items array)
            if (items.length === 0 && ca.budget) return sum + (parseFloat(ca.budget) || 0);
            return sum + items.reduce((s, i) => s + ((parseFloat(i.cost) || 0) * (parseInt(i.qty) || 1)), 0);
        }, 0);
    }, [classAwards]);

    // Grand total (circuit awards use auto-calculated totals based on class count)
    const totalAllDivisions = divisions.reduce((sum, d) => sum + d.classCount, 0);

    const { structuredTotal, structuredDonated, circuitAutoTotal } = useMemo(() => {
        let total = 0;
        let donated = 0;
        let circuitAuto = 0;

        for (const [catId, items] of Object.entries(structuredAwards)) {
            for (const item of items) {
                const prizes = item.prizes || [];
                const prizeTotal = prizes.reduce((sum, p) => sum + ((parseFloat(p.value) || 0) * (parseInt(p.qty) || 1)), 0);
                const prizeDonated = prizes.filter(p => p.source === 'donated').reduce((sum, p) => sum + ((parseFloat(p.value) || 0) * (parseInt(p.qty) || 1)), 0);

                if (catId === 'circuit' && item.division) {
                    const costPerClass = parseFloat(item.costPerClass) || 0;
                    const perClass = costPerClass + prizeTotal;
                    let classCount = 0;
                    if (item.division === '__all__') {
                        classCount = totalAllDivisions;
                    } else {
                        const div = divisions.find(d => d.id === item.division);
                        classCount = div ? div.classCount : 0;
                    }
                    const autoTotal = perClass * classCount;
                    circuitAuto += autoTotal;
                    total += autoTotal;
                    donated += prizeDonated * classCount;
                } else {
                    total += prizeTotal;
                    donated += prizeDonated;
                }
            }
        }
        return { structuredTotal: total, structuredDonated: donated, circuitAutoTotal: circuitAuto };
    }, [structuredAwards, divisions, totalAllDivisions]);

    const grandTotal = structuredTotal + totalAwardExpenses + classAwardsTotal;

    // Group classes by division name for the class awards section
    const classesByDivision = useMemo(() => {
        const grouped = {};
        for (const cls of classes) {
            if (!grouped[cls.name]) grouped[cls.name] = [];
            grouped[cls.name].push(cls);
        }
        return grouped;
    }, [classes]);

    return (
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 5: Awards</CardTitle>
                <CardDescription>Define awards, budgets, and recognition for your show.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* ========== SUMMARY AT TOP ========== */}
                {grandTotal > 0 && (
                    <div className="p-4 border rounded-lg bg-amber-500/5 border-amber-500/30">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-amber-700 dark:text-amber-400">Award Budget Summary</span>
                            <span className="text-lg font-bold text-amber-700 dark:text-amber-400">${grandTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-xs text-muted-foreground">
                            {circuitAutoTotal > 0 && <span className="text-blue-600">Circuit Awards: ${circuitAutoTotal.toFixed(2)}</span>}
                            {structuredTotal - circuitAutoTotal > 0 && <span>Recognition: ${(structuredTotal - circuitAutoTotal).toFixed(2)}</span>}
                            {totalAwardExpenses > 0 && <span>Expenses: ${totalAwardExpenses.toFixed(2)}</span>}
                            {classAwardsTotal > 0 && <span>Class Awards: ${classAwardsTotal.toFixed(2)}</span>}
                            {structuredDonated > 0 && <span className="text-emerald-600">Donated: ${structuredDonated.toFixed(2)}</span>}
                        </div>
                    </div>
                )}

                {/* ========== STRUCTURED AWARD CATEGORIES ========== */}
                <div className="space-y-3">
                    <h4 className="font-semibold text-lg">Awards & Recognition</h4>
                    {AWARD_CATEGORIES.filter(cat => cat.id !== 'circuit').map(cat => (
                        <AwardCategoryCard
                            key={cat.id}
                            category={cat}
                            awards={structuredAwards}
                            onUpdate={updateAwardItem}
                            onAddItem={addAwardItem}
                            onRemoveItem={removeAwardItem}
                            onAddPrize={addPrize}
                            onRemovePrize={removePrize}
                            onUpdatePrize={updatePrize}
                        />
                    ))}
                    <CircuitAwardsCard
                        divisions={divisions}
                        awards={structuredAwards}
                        onUpdate={updateAwardItem}
                        onAddItem={addAwardItem}
                        onRemoveItem={removeAwardItem}
                        onAddPrize={addPrize}
                        onRemovePrize={removePrize}
                        onUpdatePrize={updatePrize}
                    />
                </div>

                {/* ========== CLASS AWARDS ========== */}
                <div className="p-4 border rounded-lg bg-background/50">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-lg">Class Awards</h4>
                        {classAwardsTotal > 0 && (
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">${classAwardsTotal.toFixed(2)}</span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">Define awards per class — multiple items per placement. Classes are pulled from your schedule.</p>

                    {classes.length > 0 ? (
                        <div className="space-y-3">
                            {Object.entries(classesByDivision).map(([divName, divClasses]) => (
                                <div key={divName} className="space-y-2">
                                    <div className="flex items-center gap-2 px-1">
                                        <h5 className="text-sm font-semibold">{divName}</h5>
                                        <span className="text-xs text-muted-foreground">({divClasses.length} class{divClasses.length !== 1 ? 'es' : ''})</span>
                                    </div>
                                    {divClasses.map(cls => {
                                        const ca = classAwards[cls.id] || {};
                                        const items = ca.items || [];
                                        const classTotal = items.reduce((s, i) => s + ((parseFloat(i.cost) || 0) * (parseInt(i.qty) || 1)), 0);

                                        return (
                                            <div key={cls.id} className="border rounded-lg bg-background overflow-hidden">
                                                <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium">{cls.disciplineName}</span>
                                                        <span className="text-xs text-muted-foreground">— {cls.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {classTotal > 0 && <span className="text-xs font-semibold">${classTotal.toFixed(2)}</span>}
                                                        {items.length > 0 && (
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Duplicate awards">
                                                                        <Copy className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent align="end" className="w-48 p-2">
                                                                    <p className="text-xs font-medium mb-2">Copy awards to:</p>
                                                                    <div className="space-y-1">
                                                                        {divisions.map(d => (
                                                                            <Button key={d.id} variant="ghost" size="sm" className="w-full justify-start h-7 text-xs"
                                                                                onClick={() => duplicateClassAwards(cls.id, d.id)}>
                                                                                All {d.name} classes
                                                                            </Button>
                                                                        ))}
                                                                        <Button variant="ghost" size="sm" className="w-full justify-start h-7 text-xs font-semibold"
                                                                            onClick={() => duplicateClassAwards(cls.id, '__all__')}>
                                                                            Entire schedule
                                                                        </Button>
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        )}
                                                    </div>
                                                </div>

                                                {items.length > 0 && (
                                                    <div className="divide-y">
                                                        {items.map(item => (
                                                            <div key={item.id} className="flex items-center gap-1.5 px-3 py-1.5">
                                                                <Select value={item.placement || ''} onValueChange={(val) => updateClassAwardItem(cls.id, item.id, 'placement', val)}>
                                                                    <SelectTrigger className="h-7 text-xs w-24 flex-shrink-0"><SelectValue placeholder="Place..." /></SelectTrigger>
                                                                    <SelectContent>
                                                                        {PLACEMENT_PRESETS.map(p => (
                                                                            <SelectItem key={p} value={p}>{p}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <Select value={item.type || ''} onValueChange={(val) => updateClassAwardItem(cls.id, item.id, 'type', val)}>
                                                                    <SelectTrigger className="h-7 text-xs w-28 flex-shrink-0"><SelectValue placeholder="Type..." /></SelectTrigger>
                                                                    <SelectContent>
                                                                        {AWARD_TYPES.map(t => (
                                                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <Input
                                                                    value={item.description || ''}
                                                                    onChange={(e) => updateClassAwardItem(cls.id, item.id, 'description', e.target.value)}
                                                                    placeholder="Description..."
                                                                    className="h-7 text-xs flex-1 min-w-[80px]"
                                                                />
                                                                <Input
                                                                    type="number"
                                                                    value={item.cost || ''}
                                                                    onChange={(e) => updateClassAwardItem(cls.id, item.id, 'cost', e.target.value)}
                                                                    placeholder="$0"
                                                                    className="h-7 text-xs w-20 text-right flex-shrink-0"
                                                                />
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.qty || ''}
                                                                    onChange={(e) => updateClassAwardItem(cls.id, item.id, 'qty', e.target.value)}
                                                                    placeholder="Qty"
                                                                    className="h-7 text-xs w-14 text-right flex-shrink-0"
                                                                />
                                                                {(parseFloat(item.cost) || 0) * (parseInt(item.qty) || 1) > 0 && (
                                                                    <span className="text-[11px] font-medium text-muted-foreground w-16 text-right flex-shrink-0">
                                                                        ${((parseFloat(item.cost) || 0) * (parseInt(item.qty) || 1)).toFixed(2)}
                                                                    </span>
                                                                )}
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 flex-shrink-0"
                                                                    onClick={() => removeClassAwardItem(cls.id, item.id)}>
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="px-3 py-1.5 border-t flex items-center gap-1">
                                                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => addClassAwardItem(cls.id)}>
                                                        <PlusCircle className="h-3 w-3 mr-1" /> Add Award
                                                    </Button>
                                                    {(() => {
                                                        const flatIdx = classes.findIndex(c => c.id === cls.id);
                                                        const prevClass = flatIdx > 0 ? classes[flatIdx - 1] : null;
                                                        const prevHasAwards = prevClass && (classAwards[prevClass.id]?.items?.length > 0);
                                                        if (!prevHasAwards) return null;
                                                        return (
                                                            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground"
                                                                onClick={() => {
                                                                    const sourceItems = classAwards[prevClass.id]?.items || [];
                                                                    const cloned = sourceItems.map(item => ({ ...item, id: uuidv4() }));
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        classAwards: {
                                                                            ...(prev.classAwards || {}),
                                                                            [cls.id]: { items: [...(prev.classAwards?.[cls.id]?.items || []), ...cloned] },
                                                                        },
                                                                    }));
                                                                }}>
                                                                <CopyCheck className="h-3 w-3 mr-1" /> Duplicate From Above
                                                            </Button>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 border-2 border-dashed rounded-lg">
                            <p className="text-muted-foreground">No classes found. Add disciplines and classes in earlier steps.</p>
                        </div>
                    )}
                </div>

                {/* ========== AWARD EXPENSES ========== */}
                <div className="p-4 border rounded-lg bg-background/50">
                    <h4 className="font-semibold text-lg mb-1">Award Expenses</h4>
                    <p className="text-sm text-muted-foreground mb-3">Track bulk costs for trophies, ribbons, buckles, prize money, etc.</p>
                    <div className="space-y-2">
                        {awardExpenses.map(item => (
                            <div key={item.id} className="flex items-center gap-2 p-2 border rounded-md bg-background">
                                <Input
                                    value={item.name}
                                    onChange={(e) => updateAwardExpense(item.id, 'name', e.target.value)}
                                    placeholder="e.g., Champion Buckles"
                                    className="flex-1 h-8 text-sm"
                                />
                                <Input
                                    type="number"
                                    value={item.amount}
                                    onChange={(e) => updateAwardExpense(item.id, 'amount', e.target.value)}
                                    placeholder="Cost ($)"
                                    className="w-28 h-8 text-sm"
                                />
                                <Input
                                    type="number"
                                    value={item.qty}
                                    onChange={(e) => updateAwardExpense(item.id, 'qty', e.target.value)}
                                    placeholder="Qty"
                                    className="w-16 h-8 text-sm"
                                />
                                <span className="text-sm font-medium w-24 text-right">${((parseFloat(item.amount) || 0) * (parseInt(item.qty) || 1)).toFixed(2)}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setFormData(prev => ({ ...prev, awardExpenses: prev.awardExpenses.filter(a => a.id !== item.id) }))}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setFormData(prev => ({ ...prev, awardExpenses: [...(prev.awardExpenses || []), { id: uuidv4(), name: '', amount: '', qty: 1 }] }))}>
                        <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Award Expense
                    </Button>
                    {totalAwardExpenses > 0 && (
                        <div className="mt-3 text-right">
                            <p className="text-sm font-semibold">Total Award Expenses: ${totalAwardExpenses.toFixed(2)}</p>
                        </div>
                    )}
                </div>

            </CardContent>
        </motion.div>
    );
};
