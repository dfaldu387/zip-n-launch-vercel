import React, { useMemo, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, User, Copy, ChevronsUpDown, Award } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandSeparator } from '@/components/ui/command';
import { staffRoles, associationStaffing, roleGroups } from '@/lib/staffingData';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';


// ─── Role Icon ───────────────────────────────────────────────────
const RoleIcon = ({ roleId, className = "h-4 w-4 text-muted-foreground" }) => {
    const role = staffRoles[roleId];
    if (!role || !role.icon) return <User className={className} />;
    const IconComponent = role.icon;
    return <IconComponent className={className} />;
};

// ─── Staff Member Row ────────────────────────────────────────────
const StaffMemberRow = ({ member, roleId, roleName, associationId, onUpdate, onRemove }) => {
    const isCustom = roleId === 'CUSTOM';

    return (
        <div className="flex items-center gap-2 p-2 rounded-md border bg-background/70">
            <div className="flex items-center gap-2 shrink-0">
                <RoleIcon roleId={roleId} />
                <span className="text-xs font-medium text-muted-foreground min-w-[80px]">
                    {isCustom ? (member.custom_role_name || 'Custom') : roleName}
                </span>
            </div>
            {isCustom && (
                <Input
                    value={member.custom_role_name || ''}
                    onChange={(e) => onUpdate(member.id, associationId, roleId, 'custom_role_name', e.target.value)}
                    placeholder="Role name"
                    className="max-w-[140px] text-sm h-8"
                />
            )}
            <Input
                value={member.name || ''}
                onChange={(e) => onUpdate(member.id, associationId, roleId, 'name', e.target.value)}
                placeholder="Name"
                className="text-sm h-8"
            />
            <Input
                value={member.email || ''}
                onChange={(e) => onUpdate(member.id, associationId, roleId, 'email', e.target.value)}
                placeholder="Email"
                type="email"
                className="text-sm h-8 hidden md:block"
            />
            <Input
                value={member.phone || ''}
                onChange={(e) => onUpdate(member.id, associationId, roleId, 'phone', e.target.value)}
                placeholder="Phone"
                type="tel"
                className="text-sm h-8 hidden md:block"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onRemove(member.id, associationId, roleId)}>
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
    );
};

// ─── Add Staff Dropdown ──────────────────────────────────────────
const AddStaffDropdown = ({ availableRoles, onAdd, associationId }) => {
    const [open, setOpen] = useState(false);

    // Group available roles by category
    const grouped = useMemo(() => {
        const groups = {};
        Object.entries(roleGroups)
            .sort(([, a], [, b]) => a.order - b.order)
            .forEach(([key, value]) => {
                if (key !== 'custom') {
                    const rolesInGroup = availableRoles.filter(rId => staffRoles[rId]?.group === key);
                    if (rolesInGroup.length > 0) {
                        groups[key] = { ...value, roles: rolesInGroup };
                    }
                }
            });
        return groups;
    }, [availableRoles]);

    const handleSelect = (roleId) => {
        onAdd(associationId, roleId);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" role="combobox" aria-expanded={open}>
                    <Plus className="h-4 w-4 mr-1" /> Add Staff Member
                    <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search roles..." />
                    <CommandEmpty>No role found.</CommandEmpty>
                    {Object.entries(grouped).map(([key, group], idx) => (
                        <React.Fragment key={key}>
                            {idx > 0 && <CommandSeparator />}
                            <CommandGroup heading={group.name}>
                                {group.roles.map(roleId => (
                                    <CommandItem
                                        key={roleId}
                                        value={staffRoles[roleId].name}
                                        onSelect={() => handleSelect(roleId)}
                                    >
                                        <RoleIcon roleId={roleId} className="h-4 w-4 mr-2 text-muted-foreground" />
                                        {staffRoles[roleId].name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </React.Fragment>
                    ))}
                    <CommandSeparator />
                    <CommandGroup>
                        <CommandItem onSelect={() => handleSelect('CUSTOM')}>
                            <Plus className="h-4 w-4 mr-2 text-muted-foreground" />
                            Custom Role
                        </CommandItem>
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

// ─── Officials & Staff Section ───────────────────────────────────
export const OfficialsStaffSection = ({ formData, setFormData }) => {
    const { toast } = useToast();
    const [associationsData, setAssociationsData] = useState([]);

    const selectedAssociationIds = useMemo(() =>
        Object.keys(formData.associations || {}).filter(id => formData.associations[id]),
        [formData.associations]
    );
    const primaryAffiliates = formData.primaryAffiliates || [];

    useEffect(() => {
        const fetchAssociations = async () => {
            const { data, error } = await supabase.from('associations').select('*');
            if (error) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
            } else {
                setAssociationsData(data || []);
            }
        };
        fetchAssociations();
    }, [toast]);

    const officials = (formData.showDetails?.officials) || {};
    const judgeCount = formData.showDetails?.judgeCount || {};

    const getAssociationName = (id) => {
        if (id === 'default') return 'General';
        const assocData = associationsData.find(a => a.id === id);
        return assocData?.name || id;
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
                ...(roleId === 'CUSTOM' && { custom_role_name: '' }),
            };
            newOfficials[assocId][roleId].push(newMember);
            return { ...prev, showDetails: { ...currentDetails, officials: newOfficials } };
        });
    };

    const handleUpdateStaff = (memberId, assocId, roleId, field, value) => {
        setFormData(prev => {
            const currentDetails = prev.showDetails || {};
            const newOfficials = JSON.parse(JSON.stringify(currentDetails.officials || {}));
            if (newOfficials[assocId]?.[roleId]) {
                const idx = newOfficials[assocId][roleId].findIndex(m => m.id === memberId);
                if (idx > -1) {
                    newOfficials[assocId][roleId][idx][field] = value;
                }
            }
            return { ...prev, showDetails: { ...currentDetails, officials: newOfficials } };
        });
    };

    const handleRemoveStaff = (memberId, assocId, roleId) => {
        setFormData(prev => {
            const currentDetails = prev.showDetails || {};
            const newOfficials = JSON.parse(JSON.stringify(currentDetails.officials || {}));
            if (newOfficials[assocId]?.[roleId]) {
                newOfficials[assocId][roleId] = newOfficials[assocId][roleId].filter(m => m.id !== memberId);
            }
            return { ...prev, showDetails: { ...currentDetails, officials: newOfficials } };
        });
    };

    const handleJudgeCountChange = (assocId, count) => {
        setFormData(prev => {
            const currentDetails = prev.showDetails || {};
            const newJudgeCount = { ...(currentDetails.judgeCount || {}), [assocId]: count };
            // Auto-generate judge entries to match the new count
            const newJudges = { ...(currentDetails.judges || {}) };
            const currentJudges = newJudges[assocId] || [];
            if (count > currentJudges.length) {
                // Add new empty judge entries
                const additional = Array.from({ length: count - currentJudges.length }, () => ({
                    id: uuidv4(), name: '', email: '', phone: ''
                }));
                newJudges[assocId] = [...currentJudges, ...additional];
            } else if (count < currentJudges.length) {
                // Trim from the end
                newJudges[assocId] = currentJudges.slice(0, count);
            }
            return { ...prev, showDetails: { ...currentDetails, judgeCount: newJudgeCount, judges: newJudges } };
        });
    };

    const handleAddJudge = (assocId) => {
        setFormData(prev => {
            const currentDetails = prev.showDetails || {};
            const newJudges = { ...(currentDetails.judges || {}) };
            const currentJudges = newJudges[assocId] || [];
            newJudges[assocId] = [...currentJudges, { id: uuidv4(), name: '', email: '', phone: '' }];
            const newJudgeCount = { ...(currentDetails.judgeCount || {}), [assocId]: newJudges[assocId].length };
            return { ...prev, showDetails: { ...currentDetails, judges: newJudges, judgeCount: newJudgeCount } };
        });
    };

    const handleUpdateJudge = (assocId, judgeId, field, value) => {
        setFormData(prev => {
            const currentDetails = prev.showDetails || {};
            const newJudges = { ...(currentDetails.judges || {}) };
            newJudges[assocId] = (newJudges[assocId] || []).map(j =>
                j.id === judgeId ? { ...j, [field]: value } : j
            );
            return { ...prev, showDetails: { ...currentDetails, judges: newJudges } };
        });
    };

    const handleRemoveJudge = (assocId, judgeId) => {
        setFormData(prev => {
            const currentDetails = prev.showDetails || {};
            const newJudges = { ...(currentDetails.judges || {}) };
            newJudges[assocId] = (newJudges[assocId] || []).filter(j => j.id !== judgeId);
            const newJudgeCount = { ...(currentDetails.judgeCount || {}), [assocId]: newJudges[assocId].length };
            return { ...prev, showDetails: { ...currentDetails, judges: newJudges, judgeCount: newJudgeCount } };
        });
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
                    ...(roleId === 'CUSTOM' && { custom_role_name: member.custom_role_name || '' }),
                }));
                newOfficials[targetAssocId][roleId].push(...syncedMembers);
            }

            // Also sync judge count
            const newJudgeCount = { ...(currentDetails.judgeCount || {}) };
            if (newJudgeCount[primaryAssocId] !== undefined) {
                newJudgeCount[targetAssocId] = newJudgeCount[primaryAssocId];
            }

            return { ...prev, showDetails: { ...currentDetails, officials: newOfficials, judgeCount: newJudgeCount } };
        });
        toast({ title: 'Staff Synced', description: `Synced staff from ${getAssociationName(primaryAssocId)}.` });
    };

    // Build association-specific role lists
    const associationRoles = useMemo(() => {
        const roles = {};
        const assocList = selectedAssociationIds.length > 0 ? selectedAssociationIds : ['default'];
        assocList.forEach(assocId => {
            const staffingConfig = associationStaffing[assocId] || associationStaffing['default'];
            roles[assocId] = [...new Set([...(staffingConfig.core || []), ...(staffingConfig.specialized || [])])];
        });
        return roles;
    }, [selectedAssociationIds]);

    const sortedAssociations = useMemo(() => {
        const uniqueAssociations = [...new Set(selectedAssociationIds)];
        if (uniqueAssociations.length === 0) return ['default'];
        return uniqueAssociations.sort((a, b) => {
            const aIsPrimary = primaryAffiliates.includes(a);
            const bIsPrimary = primaryAffiliates.includes(b);
            if (aIsPrimary && !bIsPrimary) return -1;
            if (!aIsPrimary && bIsPrimary) return 1;
            return 0;
        });
    }, [selectedAssociationIds, primaryAffiliates]);

    const hasPrimary = primaryAffiliates.length > 0;
    const primaryAssocId = hasPrimary ? primaryAffiliates[0] : null;

    // Flatten all staff for an association into a single list
    const getStaffList = (assocId) => {
        const assocOfficials = officials[assocId] || {};
        const list = [];
        Object.entries(assocOfficials).forEach(([roleId, members]) => {
            members.forEach(member => {
                list.push({ ...member, roleId, roleName: staffRoles[roleId]?.name || roleId });
            });
        });
        return list;
    };

    return (
        <Accordion type="multiple" defaultValue={sortedAssociations} className="w-full space-y-4">
            {sortedAssociations.map((assocId) => {
                const rolesForAssoc = associationRoles[assocId];
                if (!rolesForAssoc) return null;
                const isPrimary = primaryAffiliates.includes(assocId);
                const staffList = getStaffList(assocId);
                const currentJudgeCount = judgeCount[assocId] ?? 0;
                const judgesList = (formData.showDetails?.judges || {})[assocId] || [];

                return (
                    <AccordionItem key={assocId} value={assocId} className="border rounded-lg bg-background/50">
                        <AccordionTrigger className="px-4 py-3 text-lg font-semibold hover:no-underline">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    {getAssociationName(assocId)} Staff
                                    {isPrimary && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md">Primary</span>}
                                </div>
                                <div className="flex items-center gap-3 mr-2">
                                    {currentJudgeCount > 0 && (
                                        <span className="text-xs font-medium text-primary flex items-center gap-1">
                                            <Award className="h-3 w-3" /> {currentJudgeCount} judge{currentJudgeCount !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {staffList.length > 0 && (
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {staffList.length} staff
                                        </span>
                                    )}
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-2 space-y-4">
                            {/* ── Judges Section ── */}
                            <div className="rounded-lg border bg-primary/5 overflow-hidden">
                                <div className="flex items-center gap-4 p-3">
                                    <Award className="h-5 w-5 text-primary shrink-0" />
                                    <Label className="font-semibold text-sm whitespace-nowrap">Number of Judges</Label>
                                    <Select
                                        value={String(currentJudgeCount)}
                                        onValueChange={(val) => handleJudgeCountChange(assocId, parseInt(val, 10))}
                                    >
                                        <SelectTrigger className="w-20 h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                                <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {currentJudgeCount > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            Score sheets = {currentJudgeCount} × classes
                                        </span>
                                    )}
                                </div>

                                {/* ── Auto-generated Judge Fields ── */}
                                {judgesList.length > 0 && (
                                    <div className="px-3 pb-3 space-y-2">
                                        {judgesList.map((judge, idx) => (
                                            <div key={judge.id} className="flex items-center gap-2 p-2 rounded-md border bg-background/70">
                                                <Award className="h-4 w-4 text-primary shrink-0" />
                                                <span className="text-xs font-medium text-muted-foreground min-w-[60px] shrink-0">Judge {idx + 1}</span>
                                                <Input
                                                    value={judge.name || ''}
                                                    onChange={(e) => handleUpdateJudge(assocId, judge.id, 'name', e.target.value)}
                                                    placeholder={`Judge ${idx + 1} Name`}
                                                    className="text-sm h-8"
                                                />
                                                <Input
                                                    value={judge.email || ''}
                                                    onChange={(e) => handleUpdateJudge(assocId, judge.id, 'email', e.target.value)}
                                                    placeholder="Email"
                                                    type="email"
                                                    className="text-sm h-8 hidden md:block"
                                                />
                                                <Input
                                                    value={judge.phone || ''}
                                                    onChange={(e) => handleUpdateJudge(assocId, judge.id, 'phone', e.target.value)}
                                                    placeholder="Phone"
                                                    type="tel"
                                                    className="text-sm h-8 hidden md:block"
                                                />
                                                <Button
                                                    variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                                                    onClick={() => handleRemoveJudge(assocId, judge.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline" size="sm"
                                            className="w-full mt-1"
                                            onClick={() => handleAddJudge(assocId)}
                                        >
                                            <Plus className="h-4 w-4 mr-1" /> Add Judge
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* ── Actions row ── */}
                            <div className="flex items-center gap-2">
                                <AddStaffDropdown
                                    availableRoles={rolesForAssoc}
                                    onAdd={handleAddStaff}
                                    associationId={assocId}
                                />
                                {!isPrimary && hasPrimary && (
                                    <Button variant="outline" size="sm" onClick={() => handleSyncStaff(assocId)}>
                                        <Copy className="h-4 w-4 mr-1" />
                                        Sync from {getAssociationName(primaryAssocId)}
                                    </Button>
                                )}
                            </div>

                            {/* ── Added Staff List ── */}
                            {staffList.length > 0 && (
                                <div className="space-y-2">
                                    {staffList.map(member => (
                                        <StaffMemberRow
                                            key={member.id}
                                            member={member}
                                            roleId={member.roleId}
                                            roleName={member.roleName}
                                            associationId={assocId}
                                            onUpdate={handleUpdateStaff}
                                            onRemove={handleRemoveStaff}
                                        />
                                    ))}
                                </div>
                            )}

                            {staffList.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                    No staff added yet. Use the dropdown above to add staff members.
                                </p>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                );
            })}
        </Accordion>
    );
};
