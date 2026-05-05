import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Pencil, Save, Loader2, Lock, Download,
    CheckCircle2, Info, Globe, Facebook, Crown, UserCog, Mail, Phone,
    LayoutDashboard, Trophy, DollarSign, Users, ClipboardList, FileSpreadsheet
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { exportShowBudgetToExcel } from '@/lib/showBudgetExport';

const STATUS_CONFIG = {
    draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-800 border-gray-300',          dotColor: 'bg-gray-500' },
    locked:    { label: 'Locked',    color: 'bg-amber-100 text-amber-800 border-amber-300',       dotColor: 'bg-amber-600' },
    published: { label: 'Published', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotColor: 'bg-emerald-600' },
};

// --- Admin & Owner Assignment ---
const AdminOwnerSection = ({ formData, setFormData, user, profile, isLocked: isLockedProp }) => {
    const loggedInUserName = profile?.full_name || user?.user_metadata?.full_name || '';
    const loggedInUserEmail = user?.email || '';
    const loggedInUserPhone = user?.user_metadata?.phone || user?.user_metadata?.mobile || profile?.phone || profile?.mobile || '';

    const defaultAdminOwner = {
        adminName: loggedInUserName, adminEmail: loggedInUserEmail, adminPhone: loggedInUserPhone,
        ownerName: loggedInUserName, ownerEmail: loggedInUserEmail, ownerPhone: loggedInUserPhone,
    };
    const adminOwner = { ...defaultAdminOwner, ...(formData.adminOwner || {}) };

    const handleUpdate = (field, value) => {
        setFormData(prev => ({ ...prev, adminOwner: { ...(prev.adminOwner || {}), [field]: value } }));
    };

    const isLocked = isLockedProp;

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Crown className="h-5 w-5 text-red-600" />
                    Admin & Owner Assignment
                </h3>
            </div>
            <p className="text-sm text-muted-foreground">Must assign Admin and Owner (EquiPatterns members). Both default to creator but can be delegated.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 p-3 bg-background rounded-md border">
                    <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4 text-primary" />
                        <Label className="font-semibold">Admin (Required)</Label>
                    </div>
                    <Input placeholder="Admin Name" value={adminOwner.adminName || ''} onChange={(e) => handleUpdate('adminName', e.target.value)} disabled={isLocked} />
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Email" className="pl-9" value={adminOwner.adminEmail || ''} onChange={(e) => handleUpdate('adminEmail', e.target.value)} disabled={isLocked} />
                        </div>
                        <div className="flex-1 relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Phone" className="pl-9" value={adminOwner.adminPhone || ''} onChange={(e) => handleUpdate('adminPhone', e.target.value)} disabled={isLocked} />
                        </div>
                    </div>
                </div>

                <div className="space-y-3 p-3 bg-background rounded-md border">
                    <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        <Label className="font-semibold">Owner (Required)</Label>
                    </div>
                    <Input placeholder="Owner Name" value={adminOwner.ownerName || ''} onChange={(e) => handleUpdate('ownerName', e.target.value)} disabled={isLocked} />
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Email" className="pl-9" value={adminOwner.ownerEmail || ''} onChange={(e) => handleUpdate('ownerEmail', e.target.value)} disabled={isLocked} />
                        </div>
                        <div className="flex-1 relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Phone" className="pl-9" value={adminOwner.ownerPhone || ''} onChange={(e) => handleUpdate('ownerPhone', e.target.value)} disabled={isLocked} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3 p-3 bg-background rounded-md border">
                <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-medium text-muted-foreground">Second Admin (Optional)</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input placeholder="Name" value={adminOwner.secondAdminName || ''} onChange={(e) => handleUpdate('secondAdminName', e.target.value)} disabled={isLocked} />
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Email" className="pl-9" value={adminOwner.secondAdminEmail || ''} onChange={(e) => handleUpdate('secondAdminEmail', e.target.value)} disabled={isLocked} />
                    </div>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Phone" className="pl-9" value={adminOwner.secondAdminPhone || ''} onChange={(e) => handleUpdate('secondAdminPhone', e.target.value)} disabled={isLocked} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Left Panel: Project Info ---
const ProjectInfoCard = ({ formData, user, setFormData, totalAllExpenses, isFull, moduleStatus }) => {
    const status = moduleStatus || 'draft';
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const details = formData.showDetails || {};
    const isLocked = status === 'locked' || status === 'published';

    return (
        <div className="border rounded-lg bg-card p-5 space-y-4">
            <h3 className="text-base font-semibold">Project Info</h3>
            <div className="space-y-3">
                <div>
                    <p className="text-xs text-muted-foreground">Show Name</p>
                    <p className="text-sm font-medium">{formData.showName || 'Untitled Show'}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Owner</p>
                    <p className="text-sm font-medium">{user?.user_metadata?.full_name || user?.email || 'Unknown'}</p>
                </div>
                {details.venue?.facilityName && (
                    <div>
                        <p className="text-xs text-muted-foreground">Venue</p>
                        <p className="text-sm">{details.venue.facilityName}</p>
                    </div>
                )}
                <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-full border ${cfg.color}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor}`} />
                        {cfg.label}
                    </span>
                </div>
            </div>

            {/* Quick stats */}
            <div className="pt-3 border-t space-y-1.5">
                {isFull ? (
                    <>
                        <p className="text-xs text-muted-foreground">
                            {(formData.showExpenses || []).filter(e => e.name).length} expense(s) configured
                        </p>
                        {totalAllExpenses > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Total expenses: ${totalAllExpenses.toFixed(2)}
                            </p>
                        )}
                    </>
                ) : (
                    <>
                        <p className="text-xs text-muted-foreground">
                            {(formData.fees || []).filter(f => f.name).length} fee(s) configured
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {(formData.sponsors || []).filter(s => s.name).length + (formData.classSponsors || []).filter(cs => cs.sponsorName).length + (formData.arenaSponsors || []).filter(as => as.sponsorName).length + (formData.customSponsors || []).filter(cs => cs.name).length} sponsor(s) added
                        </p>
                    </>
                )}
            </div>

            {/* Publish Info */}
            <div className="pt-3 border-t space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Publish Info (shown on Events page)</p>
                <div className="space-y-1.5">
                    <Label htmlFor="showWebsite" className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Website URL</Label>
                    <Input
                        id="showWebsite"
                        placeholder="https://yourshow.com"
                        value={formData.showWebsite || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, showWebsite: e.target.value }))}
                        className="h-8 text-xs"
                        disabled={isLocked}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="showFacebook" className="text-xs flex items-center gap-1"><Facebook className="h-3 w-3" /> Facebook Event URL</Label>
                    <Input
                        id="showFacebook"
                        placeholder="https://facebook.com/events/..."
                        value={formData.showFacebook || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, showFacebook: e.target.value }))}
                        className="h-8 text-xs"
                        disabled={isLocked}
                    />
                </div>
            </div>
        </div>
    );
};

// --- Center Panel: Action Buttons (grouped) ---
const ActionPanel = ({ formData, currentStatus, onStatusChange, onExportBudget, isSaving, isFull }) => {
    const isPublished = currentStatus === 'published';
    const isLocked = currentStatus === 'locked';

    return (
        <div className="space-y-5">
            {/* Section 1: Manage Status */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-semibold">Manage Status</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                    {isFull
                        ? 'Save, lock, and publish your show structure & expenses.'
                        : 'Save, lock, and publish your fee structure & sponsors.'}
                </p>

                <Button variant="outline" size="lg" className="w-full justify-start text-sm h-12" onClick={() => onStatusChange('draft')} disabled={isSaving || isLocked || isPublished}>
                    {isSaving ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />}
                    <div className="text-left">
                        <span className="font-semibold">Draft</span>
                        <span className="block text-xs text-muted-foreground">Save to My Projects as draft</span>
                    </div>
                </Button>

                <Button variant="outline" size="lg" className="w-full justify-start text-sm h-12 border-amber-200 hover:bg-amber-50 hover:border-amber-300" onClick={() => onStatusChange('locked')} disabled={isSaving || isPublished}>
                    {isSaving ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Lock className="mr-3 h-5 w-5 text-amber-600" />}
                    <div className="text-left">
                        <span className="font-semibold text-amber-700">Locked</span>
                        <span className="block text-xs text-muted-foreground">Lock all editing — export & view only</span>
                    </div>
                </Button>

                <Button size="lg" className="w-full justify-start text-sm h-12 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onStatusChange('published')} disabled={isSaving || isPublished}>
                    {isSaving ? <Loader2 className="mr-3 h-5 w-5 animate-spin text-white" /> : <CheckCircle2 className="mr-3 h-5 w-5" />}
                    <div className="text-left">
                        <span className="font-semibold">Published</span>
                        <span className="block text-xs text-emerald-200">Publish your schedule — visible to exhibitors</span>
                    </div>
                </Button>
            </div>

            {/* Section 2: Exports */}
            {onExportBudget && (
                <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        <h3 className="text-base font-semibold">Exports</h3>
                    </div>
                    <Button size="lg" className="w-full text-sm font-semibold h-12" onClick={onExportBudget} disabled={isSaving}>
                        <Download className="mr-2 h-5 w-5" /> Export Show Budget Spreadsheet
                    </Button>
                </div>
            )}
        </div>
    );
};

// --- Right Panel: Licensing ---
const LicensingCard = () => (
    <div className="border rounded-lg bg-card p-5 space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Project Ownership & Licensing
        </h3>
        <div className="space-y-2.5">
            <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm">Ownership retained by creator</p>
            </div>
            <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm">Stored in your My Projects folder</p>
            </div>
            <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm">Admin access assigned</p>
            </div>
            <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm">Can be edited until locked</p>
            </div>
        </div>
        <hr className="border-border" />
        <div className="bg-muted/50 rounded-md p-3">
            <p className="text-sm font-medium">Pricing Notice</p>
            <p className="text-xs text-muted-foreground mt-1">
                Building a show is free for members. Licensing applies only when publishing or exporting.
            </p>
        </div>
    </div>
);

// --- Review Accordion Helpers ---
const ReviewSection = ({ title, onEditClick, children }) => (
    <AccordionItem value={title}>
        <AccordionTrigger className="text-lg font-semibold">
            <div className="flex justify-between items-center w-full pr-4">
                <span>{title}</span>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEditClick(); }}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit
                </Button>
            </div>
        </AccordionTrigger>
        <AccordionContent>
            <div className="space-y-2 text-sm text-muted-foreground">
                {children}
            </div>
        </AccordionContent>
    </AccordionItem>
);

const ReviewField = ({ label, value }) => {
    if (!value) return null;
    return <p><span className="font-semibold text-foreground">{label}:</span> {value}</p>;
};

// --- Show Summary Panel ---
const ShowSummaryPanel = ({ formData, totalExpenses, totalAllAwards, totalStaffCosts, totalAllExpenses, totalFeeIncome, totalSponsorship }) => {
    const disciplines = formData.disciplines || [];
    const totalClasses = disciplines.reduce((sum, d) => sum + (d.divisionOrder?.length || 0), 0);

    // Count judges from all data sources
    let judgeCount = 0;
    const officials = formData.showDetails?.officials || {};
    Object.values(officials).forEach(assocRoles => {
        judgeCount += (assocRoles?.JUDGE || []).filter(j => j?.name).length;
    });
    const judgeEntries = formData.showDetails?.judges || {};
    Object.values(judgeEntries).forEach(judges => {
        judgeCount += (judges || []).filter(j => j?.name).length;
    });

    const totalIncome = totalFeeIncome + totalSponsorship;
    const projectedProfit = totalIncome - totalAllExpenses;

    const stats = [
        { label: 'Classes', value: totalClasses, icon: LayoutDashboard, color: 'text-blue-600' },
        { label: 'Judges', value: judgeCount, icon: Users, color: 'text-indigo-600' },
        { label: 'Awards Budget', value: `$${totalAllAwards.toFixed(0)}`, icon: Trophy, color: 'text-amber-600' },
        { label: 'Expenses Total', value: `$${totalAllExpenses.toFixed(0)}`, icon: DollarSign, color: 'text-red-600' },
        { label: 'Projected Profit', value: `$${projectedProfit.toFixed(0)}`, icon: DollarSign, color: projectedProfit >= 0 ? 'text-green-600' : 'text-red-600' },
    ];

    return (
        <div className="border rounded-lg overflow-hidden bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="px-4 py-3 border-b bg-primary/10">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Show Summary
                </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-border">
                {stats.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                            <Icon className={`h-3.5 w-3.5 ${color}`} />
                            <span className="text-xs text-muted-foreground">{label}</span>
                        </div>
                        <p className={`text-lg font-bold ${color}`}>{value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Success Confirmation Dialog ---
const SuccessDialog = ({ open, onClose, onGoToDashboard, statusLabel }) => (
    <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Show Saved Successfully
                </DialogTitle>
                <DialogDescription className="pt-2">
                    Your show has been saved successfully with status: <span className="font-semibold">{statusLabel}</span>.
                    <br /><br />
                    Would you like to return to the dashboard?
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:gap-0">
                <Button variant="outline" onClick={onClose}>Stay on Page</Button>
                <Button onClick={onGoToDashboard}>Go to Dashboard</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

// --- Main Component ---
export const ReviewStep = ({ formData, setFormData, setCurrentStep, variant = 'full', onNavigateToDashboard, onSave }) => {
    const { associations = {} } = formData;
    const { toast } = useToast();
    const { user, profile } = useAuth();
    const [associationsData, setAssociationsData] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [successDialog, setSuccessDialog] = useState({ open: false, statusLabel: '' });

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

    const getAssociationName = (id) => associationsData.find(a => a.id === id)?.name || id;

    const sponsors = formData.sponsors || [];
    const classSponsors = formData.classSponsors || [];
    const arenaSponsors = formData.arenaSponsors || [];
    const customSponsors = formData.customSponsors || [];
    const fees = formData.fees || [];
    const totalFeeIncome = useMemo(() => fees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0), [fees]);
    const levelSponsorRevenue = useMemo(() => sponsors.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0), [sponsors]);
    const classSponsorRevenue = useMemo(() => classSponsors.reduce((sum, cs) => sum + (parseFloat(cs.amount) || 0), 0), [classSponsors]);
    const arenaSponsorRevenue = useMemo(() => arenaSponsors.reduce((sum, as) => sum + (parseFloat(as.amount) || 0), 0), [arenaSponsors]);
    const customSponsorRevenue = useMemo(() => customSponsors.reduce((sum, cs) => sum + (parseFloat(cs.amount) || 0), 0), [customSponsors]);
    const totalSponsorshipRevenue = levelSponsorRevenue + classSponsorRevenue + arenaSponsorRevenue + customSponsorRevenue;

    // Calculate total staff costs from officials
    const totalStaffCosts = useMemo(() => {
        const officials = formData.showDetails?.officials || {};
        let total = 0;

        const calcDays = (startDate, endDate) => {
            if (!startDate || !endDate) return 0;
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start) || isNaN(end) || start > end) return 0;
            return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        };

        Object.values(officials).forEach(assocRoles => {
            Object.values(assocRoles || {}).forEach(members => {
                (members || []).forEach(member => {
                    // Days: use explicit days_worked if set, otherwise auto-calc from employment dates
                    const autoDays = calcDays(member.employment_start_date, member.employment_end_date);
                    const days = member.days_worked != null && member.days_worked !== '' ? (parseFloat(member.days_worked) || 0) : autoDays;
                    const dayFee = (parseFloat(member.day_fee) || 0) * days;
                    const hourlyFee = (parseFloat(member.hours_worked) || 0) * (parseFloat(member.hourly_rate) || 0);
                    const overtimeFee = (parseFloat(member.overtime_hours) || 0) * (parseFloat(member.overtime_rate_per_hour) || 0);
                    let expensesTotal = 0;
                    if (member.reimbursable_expenses) {
                        Object.values(member.reimbursable_expenses).forEach(exp => {
                            if (exp.reimbursed) expensesTotal += parseFloat(exp.total) || parseFloat(exp.max_value) || 0;
                        });
                    }
                    total += dayFee + hourlyFee + overtimeFee + expensesTotal;
                });
            });
        });
        return total;
    }, [formData.showDetails?.officials]);
    const totalSponsorCount = sponsors.filter(s => s.name).length + classSponsors.filter(cs => cs.sponsorName).length + arenaSponsors.filter(as => as.sponsorName).length + customSponsors.filter(cs => cs.name).length;
    const expenses = formData.showExpenses || [];
    const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + ((parseFloat(e.amount) || 0) * (parseInt(e.quantity) || 1)), 0), [expenses]);
    const awardExpenses = formData.awardExpenses || [];
    const totalAwardExpenses = useMemo(() => awardExpenses.reduce((sum, a) => sum + ((parseFloat(a.amount) || 0) * (parseInt(a.qty) || 1)), 0), [awardExpenses]);
    const classAwards = formData.classAwards || {};
    const totalClassAwards = useMemo(() => Object.values(classAwards).reduce((sum, ca) => {
        const items = ca.items || [];
        if (items.length === 0 && ca.budget) return sum + (parseFloat(ca.budget) || 0);
        return sum + items.reduce((s, i) => s + ((parseFloat(i.cost) || 0) * (parseInt(i.qty) || 1)), 0);
    }, 0), [classAwards]);
    const totalAllAwards = totalAwardExpenses + totalClassAwards;
    const totalAllExpenses = totalExpenses + totalAllAwards + totalStaffCosts;

    const selectedAssociations = Object.keys(associations || {}).filter(id => associations[id]);
    const details = formData.showDetails || {};
    const isFull = variant === 'full';
    const moduleKey = isFull ? 'showStructure' : 'feeStructure';
    const currentStatus = (formData.moduleStatuses || {})[moduleKey] || 'draft';

    const handleGoToDashboard = useCallback(() => {
        setSuccessDialog({ open: false, statusLabel: '' });
        if (onNavigateToDashboard) {
            onNavigateToDashboard();
        } else {
            window.location.href = '/horse-show-manager';
        }
    }, [onNavigateToDashboard]);

    const handleStatusChange = useCallback(async (newStatus) => {
        setIsSaving(true);
        try {
            // Determine which module key to update based on variant
            const moduleKey = isFull ? 'showStructure' : 'feeStructure';
            setFormData(prev => ({
                ...prev,
                moduleStatuses: {
                    ...(prev.moduleStatuses || {}),
                    [moduleKey]: newStatus,
                },
            }));
            if (onSave) {
                // Pass null as statusOverride so project-level status is not changed
                await onSave(null, moduleKey, newStatus);
            }
            const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
            setSuccessDialog({ open: true, statusLabel });
        } catch {
            // Error handled in hook
        } finally {
            setIsSaving(false);
        }
    }, [setFormData, onSave, isFull]);

    const handleExportBudget = useCallback(() => {
        try {
            exportShowBudgetToExcel(formData);
            toast({ title: 'Budget Exported', description: 'Your budget spreadsheet has been downloaded.' });
        } catch (err) {
            toast({ title: 'Export Error', description: err.message, variant: 'destructive' });
        }
    }, [formData, toast]);

    // Build review sections based on variant
    const sections = isFull ? [
        { num: 1, title: 'Event Setup', step: 1 },
        { num: 2, title: 'General & Venue', step: 2 },
        { num: 3, title: 'Officials & Staff', step: 3 },
        { num: 4, title: 'Show Expenses', step: 4 },
        { num: 5, title: 'Awards', step: 5 },
        { num: 6, title: 'General Information', step: 6 },
    ] : [
        { num: 1, title: 'Event Setup', step: 1 },
        { num: 2, title: 'Fee Structure', step: 2 },
        { num: 3, title: 'Sponsors', step: 3 },
    ];

    const renderSectionContent = (title) => {
        switch (title) {
            case 'Event Setup':
                return (
                    <>
                        {selectedAssociations.length > 0
                            ? selectedAssociations.map(id => getAssociationName(id)).join(', ')
                            : 'No associations selected.'}
                        <ReviewField label="Show Name" value={formData.showName} />
                    </>
                );
            case 'General & Venue':
                return (
                    <>
                        <ReviewField label="Venue" value={details.venue?.facilityName} />
                        <ReviewField label="Address" value={details.venue?.address} />
                        <ReviewField label="Stalls" value={details.venue?.numberOfStalls} />
                        <ReviewField label="Arenas" value={details.venue?.numberOfArenas} />
                        <ReviewField label="RV Spots" value={details.venue?.numberOfRVSpots} />
                        <ReviewField label="Host Hotel" value={details.venue?.hostHotel} />
                    </>
                );
            case 'Officials & Staff':
                return (formData.staff || []).length > 0
                    ? <p>{formData.staff.length} staff member{formData.staff.length !== 1 ? 's' : ''} configured.</p>
                    : <p>No staff configured.</p>;
            case 'Show Expenses':
                return (
                    <div className="space-y-3">
                        {expenses.filter(e => e.name).length > 0 ? (
                            <>
                                {expenses.filter(e => e.name).map(e => (
                                    <div key={e.id} className="p-2 border-b">
                                        <p><span className="font-semibold text-foreground">{e.name}:</span> ${e.amount}{e.quantity > 1 ? ` x ${e.quantity}` : ''}</p>
                                        <p className="text-xs">{e.timing?.replace('_', ' ')} {e.category ? `/ ${e.category}` : ''}</p>
                                    </div>
                                ))}
                                <div className="p-2 rounded-lg bg-red-500/5">
                                    <div className="flex justify-between text-sm font-bold">
                                        <span>Total Expenses</span>
                                        <span className="text-red-600">${totalExpenses.toFixed(2)}</span>
                                    </div>
                                </div>
                            </>
                        ) : <p>No expenses defined.</p>}
                    </div>
                );
            case 'Awards':
                return (
                    <>
                        <ReviewField label="High Point / All-Around" value={details.awards?.highPoint} />
                        <ReviewField label="Circuit Awards" value={details.awards?.circuitAwards} />
                        <ReviewField label="Special Awards" value={details.awards?.specialAwards} />
                        {totalAllAwards > 0 && (
                            <div className="p-2 rounded-lg bg-red-500/5 mt-2">
                                <div className="flex justify-between text-sm font-bold">
                                    <span>Total Award Expenses</span>
                                    <span className="text-red-600">${totalAllAwards.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </>
                );
            case 'General Information':
                return (
                    <>
                        <ReviewField label="Entry Deadlines" value={details.entry?.deadlines} />
                        <ReviewField label="Scratch Policy" value={details.entry?.scratchPolicy} />
                        <ReviewField label="Health Requirements" value={details.healthSafety?.healthReqs} />
                        <ReviewField label="Emergency Contacts" value={details.healthSafety?.emergencyContacts} />
                        <ReviewField label="Facility Rules" value={details.healthSafety?.facilityRules} />
                        <ReviewField label="Liability Release" value={details.healthSafety?.liability} />
                    </>
                );
            case 'Fee Structure':
                return (
                    <div className="space-y-2">
                        {(formData.fees || []).filter(f => f.name).length > 0 ? (
                            (formData.fees || []).filter(f => f.name).map(fee => (
                                <div key={fee.id} className="p-2 border-b">
                                    <p><span className="font-semibold text-foreground">{fee.name}:</span> ${fee.amount}</p>
                                    {fee.type && <p className="text-xs">{fee.type}</p>}
                                </div>
                            ))
                        ) : <p>No fees defined.</p>}
                    </div>
                );
            case 'Sponsors':
                return totalSponsorCount > 0
                    ? <p>{totalSponsorCount} sponsor{totalSponsorCount !== 1 ? 's' : ''} added. Total: ${totalSponsorshipRevenue.toFixed(2)}</p>
                    : <p>No sponsors added.</p>;
            default:
                return null;
        }
    };

    return (
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>{isFull ? '7. Save & Manage Your Show' : '4. Save & Manage'}</CardTitle>
                <CardDescription>
                    {isFull
                        ? 'Save your show, manage status, and publish when ready.'
                        : 'Save your fee structure & sponsors, manage status, and publish when ready.'}
                    <span className="block mt-1 text-xs text-muted-foreground/70">
                        Building a show is free — licensing applies only when publishing/exporting.
                    </span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Show Summary Panel */}
                {isFull && (
                    <ShowSummaryPanel
                        formData={formData}
                        totalExpenses={totalExpenses}
                        totalAllAwards={totalAllAwards}
                        totalStaffCosts={totalStaffCosts}
                        totalAllExpenses={totalAllExpenses}
                        totalFeeIncome={totalFeeIncome}
                        totalSponsorship={totalSponsorshipRevenue}
                    />
                )}

                {/* Admin & Owner Assignment */}
                <AdminOwnerSection formData={formData} setFormData={setFormData} user={user} profile={profile} isLocked={currentStatus === 'locked' || currentStatus === 'published'} />

                {/* 3-Column Layout: Project Info | Manage Show | Licensing */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-3">
                        <ProjectInfoCard formData={formData} user={user} setFormData={setFormData} totalAllExpenses={totalAllExpenses} isFull={isFull} moduleStatus={currentStatus} />
                    </div>
                    <div className="lg:col-span-5">
                        <ActionPanel
                            formData={formData}
                            currentStatus={currentStatus}
                            onStatusChange={handleStatusChange}
                            onExportBudget={isFull ? handleExportBudget : null}
                            isSaving={isSaving}
                            isFull={isFull}
                        />
                    </div>
                    <div className="lg:col-span-4">
                        <LicensingCard />
                    </div>
                </div>

                {/* Review Sections */}
                <Accordion type="multiple" defaultValue={['1. Event Setup']} className="w-full">
                    {sections.map(({ num, title, step }) => (
                        <ReviewSection key={title} title={`${num}. ${title}`} onEditClick={() => setCurrentStep(step)}>
                            {renderSectionContent(title)}
                        </ReviewSection>
                    ))}
                </Accordion>

                {/* Expense Summary — full variant only */}
                {isFull && totalAllExpenses > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-muted/50 border-b">
                            <h4 className="font-semibold text-base">Expense Summary</h4>
                        </div>
                        <div className="p-4 space-y-2">
                            {totalExpenses > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span>Show Expenses</span>
                                    <span className="font-semibold text-red-600">${totalExpenses.toFixed(2)}</span>
                                </div>
                            )}
                            {totalStaffCosts > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span>Staff & Officials</span>
                                    <span className="font-semibold text-red-600">${totalStaffCosts.toFixed(2)}</span>
                                </div>
                            )}
                            {totalAllAwards > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span>Award Expenses</span>
                                    <span className="font-semibold text-red-600">${totalAllAwards.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="border-t pt-2 flex justify-between text-sm font-bold">
                                <span>Total Expenses</span>
                                <span className="text-red-600">${totalAllExpenses.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
                {/* Success Confirmation Dialog */}
                <SuccessDialog
                    open={successDialog.open}
                    onClose={() => setSuccessDialog({ open: false, statusLabel: '' })}
                    onGoToDashboard={handleGoToDashboard}
                    statusLabel={successDialog.statusLabel}
                />
            </CardContent>
        </motion.div>
    );
};
