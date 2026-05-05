import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, User, DollarSign, Calendar, Phone, Mail, Clock, Plane, BaggageClaim, Car, Hotel, Fuel, Users, Copy, PlusCircle, MapPin, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { staffRoles, associationStaffing, roleGroups } from '@/lib/staffingData';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { format, addDays, subDays, differenceInCalendarDays, isValid } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { isBudgetFrozen, isMemberFrozen } from '@/lib/contractUtils';
import { BudgetFrozenBanner } from '@/components/contract-management/BudgetFrozenBanner';

const RoleIcon = ({ roleId }) => {
    const role = staffRoles[roleId];
    if (!role || !role.icon) return <User className="h-5 w-5 text-muted-foreground" />;
    const IconComponent = role.icon;
    return <IconComponent className="h-5 w-5 text-muted-foreground" />;
};

const expenseTypes = [
    { id: 'airfare', label: 'Airfare', icon: Plane, hasDates: true, dateLabels: { start: 'Arrival Date', end: 'Departure Date' } },
    { id: 'baggage', label: 'Baggage', icon: BaggageClaim },
    { id: 'airportParking', label: 'Airport Parking', icon: Car, isPerDay: true, hasDates: true, dateLabels: { start: 'Start Date', end: 'End Date' } },
    { id: 'tolls', label: 'Tolls', icon: DollarSign },
    { id: 'fuel', label: 'Fuel to/from Airport', icon: Fuel },
    { id: 'rentalCar', label: 'Rental Car', icon: Car, isPerDay: true, hasDates: true, dateLabels: { start: 'Start Date', end: 'End Date' } },
    { id: 'perDiem', label: 'Per Diem', icon: DollarSign, isPerDay: true, hasDates: true, dateLabels: { start: 'Start Date', end: 'End Date' } },
    { id: 'hotel', label: 'Hotel', icon: Hotel, hasDates: true, isPerDay: true, dateLabels: { start: 'Check-in Date', end: 'Check-out Date' } },
    { id: 'mileage', label: 'Mileage', icon: MapPin, isMileage: true, hasDates: true, dateLabels: { start: 'Start Date', end: 'End Date' } },
];


const StaffMemberInput = ({ member, onUpdate, onRemove, role, associationId, memberFrozen }) => {
    
    const calculateDays = (startDate, endDate, isHotel = false) => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (!isValid(start) || !isValid(end) || start > end) return 0;
        
        const diff = differenceInCalendarDays(end, start);
        return isHotel ? diff : diff + 1;
    };
    
    const handleExpenseChange = (expenseId, field, value) => {
        const newExpenses = { ...(member.reimbursable_expenses || {}) };
        if (!newExpenses[expenseId]) {
            newExpenses[expenseId] = { reimbursed: false, max_value: '', cost_per_day: '', days: 0 };
        }
        
        const expenseType = expenseTypes.find(e => e.id === expenseId);
        
        if (field === 'reimbursed') {
            newExpenses[expenseId].reimbursed = value;
            if (!value) {
                delete newExpenses[expenseId];
            } else {
                if (expenseType?.hasDates || expenseType?.isPerDay) {
                    if (member.employment_start_date) {
                        const startDate = subDays(new Date(member.employment_start_date), 1);
                        newExpenses[expenseId].start_date = startDate.toISOString();
                    }
                    if (member.employment_end_date) {
                        const endDate = addDays(new Date(member.employment_end_date), 1);
                        newExpenses[expenseId].end_date = endDate.toISOString();
                    }
                }
            }
        } else {
            newExpenses[expenseId][field] = value;
        }

        if(expenseType.isPerDay) {
            const days = calculateDays(newExpenses[expenseId].start_date, newExpenses[expenseId].end_date, expenseId === 'hotel');
            newExpenses[expenseId].days = days;
            const cost = parseFloat(newExpenses[expenseId].cost_per_day) || 0;
            newExpenses[expenseId].total = days * cost;
        }

        if(expenseType.isMileage) {
            const miles = parseFloat(newExpenses[expenseId].miles) || 0;
            const rate = parseFloat(newExpenses[expenseId].rate_per_mile) || 0;
            newExpenses[expenseId].total = miles * rate;
        }

        onUpdate(member.id, 'reimbursable_expenses', newExpenses);
    };

    const handleExpenseDateChange = (expenseId, dateField, date) => {
        const newExpenses = { ...(member.reimbursable_expenses || {}) };
        if (!newExpenses[expenseId]) return;

        newExpenses[expenseId][dateField] = date ? date.toISOString() : null;
        
        const expenseType = expenseTypes.find(e => e.id === expenseId);
        if(expenseType.isPerDay) {
            const days = calculateDays(newExpenses[expenseId].start_date, newExpenses[expenseId].end_date, expenseId === 'hotel');
            newExpenses[expenseId].days = days;
            const cost = parseFloat(newExpenses[expenseId].cost_per_day) || 0;
            newExpenses[expenseId].total = days * cost;
        }

        onUpdate(member.id, 'reimbursable_expenses', newExpenses);
    };

    const autoDays = useMemo(() => calculateDays(member.employment_start_date, member.employment_end_date), [member.employment_start_date, member.employment_end_date]);
    const employmentDays = member.days_worked != null && member.days_worked !== '' ? parseFloat(member.days_worked) || 0 : autoDays;
    const totalDayFee = useMemo(() => (employmentDays * (parseFloat(member.day_fee) || 0)), [employmentDays, member.day_fee]);
    const totalHourlyFee = useMemo(() => (parseFloat(member.hours_worked) || 0) * (parseFloat(member.hourly_rate) || 0), [member.hours_worked, member.hourly_rate]);
    const totalOvertimeFee = useMemo(() => (parseFloat(member.overtime_hours) || 0) * (parseFloat(member.overtime_rate_per_hour) || 0), [member.overtime_hours, member.overtime_rate_per_hour]);

    const totalCost = useMemo(() => {
        let expensesTotal = 0;
        if (member.reimbursable_expenses) {
            for (const key in member.reimbursable_expenses) {
                const expense = member.reimbursable_expenses[key];
                if (expense.reimbursed) {
                    const expenseType = expenseTypes.find(e => e.id === key);
                    if (expenseType?.isPerDay || expenseType?.isMileage) {
                        expensesTotal += parseFloat(expense.total) || 0;
                    } else {
                        expensesTotal += parseFloat(expense.max_value) || 0;
                    }
                }
            }
        }
        return totalDayFee + totalHourlyFee + totalOvertimeFee + expensesTotal;
    }, [totalDayFee, totalHourlyFee, totalOvertimeFee, member.reimbursable_expenses]);

    return (
        <Accordion type="single" collapsible className="w-full border rounded-md bg-background">
            <AccordionItem value={member.id}>
                <AccordionTrigger className="p-3 hover:no-underline">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <span className="font-medium text-sm">{member.name || 'New Staff Member'}</span>
                            {totalCost > 0 && (
                                <span className="text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/50 dark:text-green-400 px-2 py-0.5 rounded-full">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCost)}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {memberFrozen && (
                                <span title="Contract sent — fields locked" className="text-amber-500">
                                    <Lock className="h-3.5 w-3.5" />
                                </span>
                            )}
                            <Button variant="ghost" size="icon" disabled={memberFrozen} onClick={(e) => { e.stopPropagation(); onRemove(member.id, associationId, role.id); }} className="text-destructive h-8 w-8">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0 space-y-4">
                    {role.id === 'CUSTOM' && (
                        <div className="space-y-1">
                            <Label htmlFor={`custom-role-name-${member.id}`}>Role Name</Label>
                            <Input id={`custom-role-name-${member.id}`} disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} value={member.custom_role_name || ''} onChange={(e) => onUpdate(member.id, 'custom_role_name', e.target.value)} placeholder="e.g., Parking Attendant" />
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor={`name-${member.id}`}>Name</Label>
                            <Input id={`name-${member.id}`} disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} value={member.name || ''} onChange={(e) => onUpdate(member.id, 'name', e.target.value)} placeholder="e.g., John Doe" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor={`email-${member.id}`}>Email</Label>
                            <Input id={`email-${member.id}`} disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} type="email" value={member.email || ''} onChange={(e) => onUpdate(member.id, 'email', e.target.value)} placeholder="e.g., john.doe@email.com" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor={`phone-${member.id}`}>Phone</Label>
                            <Input id={`phone-${member.id}`} disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} type="tel" value={member.phone || ''} onChange={(e) => onUpdate(member.id, 'phone', e.target.value)} placeholder="e.g., (123) 456-7890" />
                        </div>
                        {role.hasCards && (
                            <div className="space-y-1">
                                <Label htmlFor={`cards-${member.id}`}>Cards/License Held</Label>
                                <Input id={`cards-${member.id}`} disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} value={member.cards_held || ''} onChange={(e) => onUpdate(member.id, 'cards_held', e.target.value)} placeholder="e.g., AQHA, USEF 'R'" />
                            </div>
                        )}
                        <div className="space-y-1">
                            <Label>Employment Start Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} disabled={memberFrozen} className={cn("w-full justify-start text-left font-normal", !member.employment_start_date && "text-muted-foreground", memberFrozen && "bg-muted")}>
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {member.employment_start_date ? format(new Date(member.employment_start_date), "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <CalendarComponent mode="single" selected={member.employment_start_date ? new Date(member.employment_start_date) : null} onSelect={(date) => onUpdate(member.id, 'employment_start_date', date)} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-1">
                            <Label>Employment End Date</Label>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} disabled={memberFrozen} className={cn("w-full justify-start text-left font-normal", !member.employment_end_date && "text-muted-foreground", memberFrozen && "bg-muted")}>
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {member.employment_end_date ? format(new Date(member.employment_end_date), "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <CalendarComponent mode="single" selected={member.employment_end_date ? new Date(member.employment_end_date) : null} onSelect={(date) => onUpdate(member.id, 'employment_end_date', date)} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    
                    <>
                        <div className="border-t pt-4 mt-4">
                            <h5 className="font-semibold text-md mb-2">Compensation</h5>
                            {/* Daily Rate */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor={`days-${member.id}`}>Days Worked</Label>
                                    <Input id={`days-${member.id}`} type="number" step="0.5" disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} value={member.days_worked != null && member.days_worked !== '' ? member.days_worked : autoDays} onChange={(e) => onUpdate(member.id, 'days_worked', e.target.value)} placeholder="e.g., 2.5" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`dayfee-${member.id}`}>Daily Rate</Label>
                                    <Input id={`dayfee-${member.id}`} type="number" disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} value={member.day_fee || ''} onChange={(e) => onUpdate(member.id, 'day_fee', e.target.value)} placeholder="e.g., 500" />
                                </div>
                                <div className="space-y-1">
                                    <Label>Day Total</Label>
                                    <Input type="number" value={totalDayFee.toFixed(2)} readOnly disabled className="bg-muted"/>
                                </div>
                            </div>
                            {/* Hourly Rate */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <div className="space-y-1">
                                    <Label htmlFor={`hours-${member.id}`}>Hours</Label>
                                    <Input id={`hours-${member.id}`} type="number" step="0.5" disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} value={member.hours_worked || ''} onChange={(e) => onUpdate(member.id, 'hours_worked', e.target.value)} placeholder="e.g., 8" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`hourlyrate-${member.id}`}>Hourly Rate</Label>
                                    <Input id={`hourlyrate-${member.id}`} type="number" disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} value={member.hourly_rate || ''} onChange={(e) => onUpdate(member.id, 'hourly_rate', e.target.value)} placeholder="e.g., 25" />
                                </div>
                                <div className="space-y-1">
                                    <Label>Hourly Total</Label>
                                    <Input type="number" value={totalHourlyFee.toFixed(2)} readOnly disabled className="bg-muted"/>
                                </div>
                            </div>
                            {/* Overtime */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <div className="space-y-1">
                                    <Label htmlFor={`overtime-hours-${member.id}`}>Overtime Hours</Label>
                                    <Input id={`overtime-hours-${member.id}`} type="number" step="0.5" disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} value={member.overtime_hours || ''} onChange={(e) => onUpdate(member.id, 'overtime_hours', e.target.value)} placeholder="e.g., 4" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`overtime-rate-${member.id}`}>Overtime Rate</Label>
                                    <Input id={`overtime-rate-${member.id}`} type="number" disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} value={member.overtime_rate_per_hour || ''} onChange={(e) => onUpdate(member.id, 'overtime_rate_per_hour', e.target.value)} placeholder="e.g., 75" />
                                </div>
                                <div className="space-y-1">
                                    <Label>Overtime Total</Label>
                                    <Input type="number" value={totalOvertimeFee.toFixed(2)} readOnly disabled className="bg-muted"/>
                                </div>
                            </div>
                            {/* Grand Total */}
                            <div className="mt-4 flex items-center justify-end gap-2">
                                <Label className="font-semibold">Total Compensation:</Label>
                                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCost)}
                                </span>
                            </div>
                        </div>

                        <div className="border-t pt-4 mt-4">
                                <h5 className="font-semibold text-md mb-2">Reimbursable Expenses</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {expenseTypes.map(expense => {
                                    const currentExpense = member.reimbursable_expenses?.[expense.id];
                                    return (
                                    <div key={expense.id} className="p-3 border rounded-lg bg-background/50 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <expense.icon className="h-4 w-4 text-muted-foreground" />
                                                <Label htmlFor={`reimburse-${member.id}-${expense.id}`} className="text-sm font-medium">{expense.label}</Label>
                                            </div>
                                            <Switch id={`reimburse-${member.id}-${expense.id}`} disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} checked={currentExpense?.reimbursed || false} onCheckedChange={(checked) => handleExpenseChange(expense.id, 'reimbursed', checked)} />
                                        </div>
                                        {currentExpense?.reimbursed && (
                                            <div className="pt-2 space-y-2">
                                                {expense.isMileage ? (
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Miles</Label>
                                                            <Input type="number" disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} placeholder="e.g., 200" value={currentExpense.miles || ''} onChange={(e) => handleExpenseChange(expense.id, 'miles', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Rate/Mile</Label>
                                                            <Input type="number" step="0.01" disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} placeholder="e.g., 0.67" value={currentExpense.rate_per_mile || ''} onChange={(e) => handleExpenseChange(expense.id, 'rate_per_mile', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Total</Label>
                                                            <Input type="number" value={currentExpense.total?.toFixed(2) || '0.00'} readOnly disabled className="bg-muted"/>
                                                        </div>
                                                    </div>
                                                ) : expense.isPerDay ? (
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Days</Label>
                                                            <Input type="number" value={currentExpense.days || 0} readOnly disabled className="bg-muted"/>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Cost/Day</Label>
                                                            <Input type="number" disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} placeholder="e.g., 150" value={currentExpense.cost_per_day || ''} onChange={(e) => handleExpenseChange(expense.id, 'cost_per_day', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Total</Label>
                                                            <Input type="number" value={currentExpense.total?.toFixed(2) || '0.00'} readOnly disabled className="bg-muted"/>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`max-${member.id}-${expense.id}`} className="text-xs">Max Value ($)</Label>
                                                        <Input id={`max-${member.id}-${expense.id}`} type="number" disabled={memberFrozen} className={cn(memberFrozen && "bg-muted")} placeholder="Optional Max" value={currentExpense.max_value || ''} onChange={(e) => handleExpenseChange(expense.id, 'max_value', e.target.value)} />
                                                    </div>
                                                )}

                                                {expense.hasDates && (
                                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">{expense.dateLabels.start}</Label>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button variant={"outline"} disabled={memberFrozen} className={cn("w-full justify-start text-left font-normal", !currentExpense?.start_date && "text-muted-foreground", memberFrozen && "bg-muted")}>
                                                                        <Calendar className="mr-2 h-4 w-4" />
                                                                        {currentExpense?.start_date ? format(new Date(currentExpense.start_date), "PPP") : <span>Pick a date</span>}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0">
                                                                    <CalendarComponent mode="single" selected={currentExpense?.start_date ? new Date(currentExpense.start_date) : null} onSelect={(date) => handleExpenseDateChange(expense.id, 'start_date', date)} initialFocus />
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">{expense.dateLabels.end}</Label>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button variant={"outline"} disabled={memberFrozen} className={cn("w-full justify-start text-left font-normal", !currentExpense?.end_date && "text-muted-foreground", memberFrozen && "bg-muted")}>
                                                                        <Calendar className="mr-2 h-4 w-4" />
                                                                        {currentExpense?.end_date ? format(new Date(currentExpense.end_date), "PPP") : <span>Pick a date</span>}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0">
                                                                    <CalendarComponent mode="single" selected={currentExpense?.end_date ? new Date(currentExpense.end_date) : null} onSelect={(date) => handleExpenseDateChange(expense.id, 'end_date', date)} initialFocus />
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )})}
                                </div>
                        </div>
                    </>

                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};


const StaffRoleSection = ({ roleId, staff, onAdd, onUpdate, onRemove, associationId, employeeFolders }) => {
    const role = staffRoles[roleId];
    if (!role) return null;

    const roleName = role.id === 'CUSTOM' ? 'Custom Role' : role.name;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <RoleIcon roleId={roleId} />
                    <h4 className="font-medium">{roleName}</h4>
                </div>
                <Button size="sm" variant="outline" onClick={() => onAdd(associationId, roleId)}>
                    <Plus className="h-4 w-4 mr-2" /> Add {roleName}
                </Button>
            </div>
            <div className="pl-7 space-y-2">
                {staff.map(member => (
                    <StaffMemberInput key={member.id} member={member} onUpdate={onUpdate} onRemove={onRemove} role={role} associationId={associationId} memberFrozen={isMemberFrozen(member.id, { employeeFolders })} />
                ))}
            </div>
        </div>
    );
};

export const OfficialsStaffStep = ({ formData, setFormData }) => {
    const { associations = {}, showDetails = {}, customAssociations = [], primaryAffiliates = [] } = formData;
    const { officials = {} } = showDetails;
    const selectedAssociations = Object.keys(associations).filter(id => associations[id]);
    const { toast } = useToast();
    const budgetFrozen = isBudgetFrozen(formData);
    const [associationsData, setAssociationsData] = useState([]);

    useEffect(() => {
        const fetchAssociations = async () => {
            const { data, error } = await supabase.from('associations').select('*');
            if (error) {
                toast({ title: 'Error fetching associations', description: error.message, variant: 'destructive' });
            } else {
                setAssociationsData(data);
            }
        };
        fetchAssociations();
    }, [toast]);

    const getAssociationName = (id) => {
        if (id === 'custom' && customAssociations.length > 0) return customAssociations[0]?.name || 'Custom Association';
        const assocData = associationsData.find(a => a.id === id);
        return assocData?.name || id;
    };
    
    const handleStaffUpdate = (memberId, field, value) => {
        setFormData(prev => {
            const currentDetails = prev.showDetails || {};
            const newOfficials = JSON.parse(JSON.stringify(currentDetails.officials || {}));
            for (const assocId in newOfficials) {
                for (const roleId in newOfficials[assocId]) {
                    const staffList = newOfficials[assocId][roleId];
                    const memberIndex = staffList.findIndex(m => m.id === memberId);
                    if (memberIndex > -1) {
                        const member = staffList[memberIndex];
                        
                        staffList[memberIndex][field] = value;

                        if (field === 'employment_start_date' || field === 'employment_end_date') {
                                const expenses = member.reimbursable_expenses || {};
                                for(const expenseId in expenses) {
                                if (expenses[expenseId].reimbursed) {
                                    const expenseType = expenseTypes.find(e => e.id === expenseId);
                                    if (expenseType?.hasDates || expenseType?.isPerDay) {
                                        if (staffList[memberIndex].employment_start_date) {
                                            expenses[expenseId].start_date = subDays(new Date(staffList[memberIndex].employment_start_date), 1).toISOString();
                                        }
                                        if(staffList[memberIndex].employment_end_date) {
                                            expenses[expenseId].end_date = addDays(new Date(staffList[memberIndex].employment_end_date), 1).toISOString();
                                        }
                                    }
                                }
                                }
                                staffList[memberIndex].reimbursable_expenses = expenses;
                        }

                        return { ...prev, showDetails: { ...currentDetails, officials: newOfficials } };
                    }
                }
            }
            return prev;
        });
    };
    
    const handleAddStaff = (assocId, roleId) => {
        setFormData(prev => {
            const currentDetails = prev.showDetails || {};
            const newOfficials = JSON.parse(JSON.stringify(currentDetails.officials || {}));
            if (!newOfficials[assocId]) newOfficials[assocId] = {};
            if (!newOfficials[assocId][roleId]) newOfficials[assocId][roleId] = [];
            
            const newMember = {
                id: uuidv4(),
                association_id: assocId,
                role_id: roleId,
                name: '',
                email: '',
                phone: '',
                cards_held: '',
                employment_start_date: null,
                employment_end_date: null,
                days_worked: null,
                day_fee: null,
                hours_worked: null,
                hourly_rate: null,
                overtime_hours: null,
                overtime_rate_per_hour: null,
                reimbursable_expenses: {},
            };

            if (roleId === 'CUSTOM') {
                newMember.custom_role_name = '';
            }

            newOfficials[assocId][roleId].push(newMember);

            return { ...prev, showDetails: { ...currentDetails, officials: newOfficials } };
        });
    };

    const handleRemoveStaff = (memberId, assocId, roleId) => {
        setFormData(prev => {
            const currentDetails = prev.showDetails || {};
            const newOfficials = JSON.parse(JSON.stringify(currentDetails.officials || {}));
            if(newOfficials[assocId] && newOfficials[assocId][roleId]) {
                    newOfficials[assocId][roleId] = newOfficials[assocId][roleId].filter(m => m.id !== memberId);
            }
            return { ...prev, showDetails: { ...currentDetails, officials: newOfficials } };
        });
    };

    const associationRoles = useMemo(() => {
        const roles = {};
        const assocList = selectedAssociations.length > 0 ? selectedAssociations : ['default'];
        
        assocList.forEach(assocId => {
            const staffingConfig = associationStaffing[assocId] || associationStaffing['default'];
            roles[assocId] = [...new Set([...(staffingConfig.core || []), ...(staffingConfig.specialized || [])])];
        });
        return roles;
    }, [selectedAssociations]);

    const groupedRoles = useMemo(() => {
        const groups = {};
        Object.entries(roleGroups)
            .sort(([, a], [, b]) => a.order - b.order)
            .forEach(([key, value]) => {
                if (key !== 'custom') {
                    groups[key] = { ...value, roles: [] };
                }
            });

        Object.keys(staffRoles).forEach(roleId => {
            const role = staffRoles[roleId];
            if (role.group && groups[role.group]) {
                groups[role.group].roles.push(roleId);
            }
        });
        return groups;
    }, []);

    const calculateTotalCostForMember = (member) => {
        const calculateDays = (startDate, endDate, isHotel = false) => {
            if (!startDate || !endDate) return 0;
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (!isValid(start) || !isValid(end) || start > end) return 0;
            const diff = differenceInCalendarDays(end, start);
            return isHotel ? diff : diff + 1;
        };

        const autoDays = calculateDays(member.employment_start_date, member.employment_end_date);
        const days = member.days_worked != null && member.days_worked !== '' ? parseFloat(member.days_worked) || 0 : autoDays;
        const totalDayFee = days * (parseFloat(member.day_fee) || 0);
        const totalHourlyFee = (parseFloat(member.hours_worked) || 0) * (parseFloat(member.hourly_rate) || 0);
        const totalOvertimeFee = (parseFloat(member.overtime_hours) || 0) * (parseFloat(member.overtime_rate_per_hour) || 0);

        let expensesTotal = 0;
        if (member.reimbursable_expenses) {
            for (const key in member.reimbursable_expenses) {
                const expense = member.reimbursable_expenses[key];
                if (expense.reimbursed) {
                    const expenseType = expenseTypes.find(e => e.id === key);
                    if (expenseType?.isPerDay || expenseType?.isMileage) {
                        expensesTotal += parseFloat(expense.total) || 0;
                    } else {
                        expensesTotal += parseFloat(expense.max_value) || 0;
                    }
                }
            }
        }
        return totalDayFee + totalHourlyFee + totalOvertimeFee + expensesTotal;
    };

    const calculateAssociationTotalCost = (assocId) => {
        const associationStaff = officials[assocId];
        if (!associationStaff) return 0;

        let totalCost = 0;
        for (const roleId in associationStaff) {
            for (const member of associationStaff[roleId]) {
                totalCost += calculateTotalCostForMember(member);
            }
        }
        return totalCost;
    };
    
    const handleSyncStaff = (targetAssocId) => {
        const primaryAssocId = primaryAffiliates[0];
        if (!primaryAssocId || primaryAssocId === targetAssocId) return;

        const primaryStaff = officials[primaryAssocId];
        if (!primaryStaff) return;
        
        setFormData(prev => {
            const currentDetails = prev.showDetails || {};
            const newOfficials = JSON.parse(JSON.stringify(currentDetails.officials || {}));
            
            newOfficials[targetAssocId] = JSON.parse(JSON.stringify(newOfficials[targetAssocId] || {}));
            
            for (const roleId in primaryStaff) {
                if (!newOfficials[targetAssocId][roleId]) {
                    newOfficials[targetAssocId][roleId] = [];
                }

                const syncedMembers = primaryStaff[roleId].map(member => ({
                    id: uuidv4(),
                    association_id: targetAssocId,
                    role_id: roleId,
                    name: member.name || '',
                    email: member.email || '',
                    phone: member.phone || '',
                    employment_start_date: member.employment_start_date || null,
                    employment_end_date: member.employment_end_date || null,
                    cards_held: '',
                    days_worked: null,
                    day_fee: null,
                    hours_worked: null,
                    hourly_rate: null,
                    overtime_hours: null,
                    overtime_rate_per_hour: null,
                    reimbursable_expenses: {},
                    ...(roleId === 'CUSTOM' && { custom_role_name: member.custom_role_name || '' })
                }));
                newOfficials[targetAssocId][roleId].push(...syncedMembers);
            }
            
            return { ...prev, showDetails: { ...currentDetails, officials: newOfficials } };
        });
    };

    const sortedSelectedAssociations = useMemo(() => {
        return selectedAssociations.sort((a, b) => {
            const aIsPrimary = primaryAffiliates.includes(a);
            const bIsPrimary = primaryAffiliates.includes(b);
            if (aIsPrimary && !bIsPrimary) return -1;
            if (!aIsPrimary && bIsPrimary) return 1;
            return 0;
        });
    }, [selectedAssociations, primaryAffiliates]);

    const hasPrimary = primaryAffiliates.length > 0;
    const primaryAssocId = hasPrimary ? primaryAffiliates[0] : null;

    return (
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 3: Officials & Staff</CardTitle>
                <CardDescription>Assign key personnel and manage their details. Roles are suggested based on your selected associations.</CardDescription>
                {budgetFrozen && <BudgetFrozenBanner />}
            </CardHeader>
            <CardContent className="space-y-6">
                <Accordion type="multiple" defaultValue={Object.keys(associationRoles)} className="w-full space-y-4">
                    {Object.keys(associationRoles).length === 0 && (
                        <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                            <Users className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-200">No Staff Roles</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select an association in Step 1 to see suggested staff roles.</p>
                        </div>
                    )}
                    {sortedSelectedAssociations.map((assocId) => {
                        const rolesForAssoc = associationRoles[assocId];
                        if (!rolesForAssoc) return null;
                        const isPrimary = primaryAffiliates.includes(assocId);
                        const totalAssocCost = calculateAssociationTotalCost(assocId);

                        return (
                            <AccordionItem key={assocId} value={assocId} className="border rounded-lg bg-background/50">
                                <AccordionTrigger className="px-4 py-3 text-lg font-semibold hover:no-underline">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            {getAssociationName(assocId)} Staff
                                            {isPrimary && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md">Primary</span>}
                                        </div>
                                        {totalAssocCost > 0 && (
                                             <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalAssocCost)}
                                            </span>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-0 space-y-6">
                                    {!isPrimary && hasPrimary && (
                                        <div className="flex justify-end -mt-4 mb-4">
                                            <Button variant="outline" size="sm" disabled={budgetFrozen} onClick={() => handleSyncStaff(assocId)}>
                                                <Copy className="h-4 w-4 mr-2" />
                                                Sync Staff from {getAssociationName(primaryAssocId)}
                                            </Button>
                                        </div>
                                    )}
                                    {Object.values(groupedRoles).map(group => {
                                        const relevantRoles = group.roles.filter(roleId => rolesForAssoc.includes(roleId));
                                        if (relevantRoles.length === 0) return null;

                                        return (
                                            <div key={group.name} className="pt-4">
                                                <h3 className="text-md font-semibold mb-3 border-b pb-2">{group.name}</h3>
                                                <div className="space-y-4">
                                                {relevantRoles.map(roleId => (
                                                    <StaffRoleSection
                                                        key={roleId}
                                                        roleId={roleId}
                                                        staff={(officials[assocId] && officials[assocId][roleId]) || []}
                                                        onAdd={handleAddStaff}
                                                        onUpdate={handleStaffUpdate}
                                                        onRemove={handleRemoveStaff}
                                                        associationId={assocId}
                                                        employeeFolders={formData.employeeFolders || {}}
                                                    />
                                                ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="pt-6 text-center">
                                        <Button variant="outline" onClick={() => handleAddStaff(assocId, 'CUSTOM')}>
                                            <PlusCircle className="h-4 w-4 mr-2" />
                                            Add Custom Role
                                        </Button>
                                    </div>
                                    <div className="space-y-4 pt-4">
                                        {officials[assocId]?.['CUSTOM'] && officials[assocId]['CUSTOM'].length > 0 && (
                                            <div className="pt-4">
                                                <h3 className="text-md font-semibold mb-3 border-b pb-2">{roleGroups.custom.name}</h3>
                                                <div className="space-y-2">
                                                    {officials[assocId]['CUSTOM'].map(member => (
                                                        <StaffMemberInput
                                                            key={member.id}
                                                            member={member}
                                                            onUpdate={handleStaffUpdate}
                                                            onRemove={handleRemoveStaff}
                                                            role={staffRoles.CUSTOM}
                                                            associationId={assocId}
                                                            memberFrozen={isMemberFrozen(member.id, formData)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </CardContent>
        </motion.div>
    );
};