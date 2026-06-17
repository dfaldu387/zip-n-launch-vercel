import React, { useMemo, useState, useEffect, useRef } from 'react';
    import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Label } from '@/components/ui/label';
    import { Badge } from '@/components/ui/badge';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Button } from '@/components/ui/button';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { PlusCircle, Trash2, CheckCircle2, Circle, AlertCircle, Loader2, Copy } from 'lucide-react';
    import { PatternGrouping } from '@/components/pbb/PatternGrouping';
    import { ScheduleOrganizer } from '@/components/pbb/ScheduleOrganizer';
    import { cn } from '@/lib/utils';
    import { parseDivisionId } from '@/lib/showBillUtils';
    import { supabase } from '@/lib/supabaseClient';
    import { useToast } from '@/components/ui/use-toast';

    // Strip a division (by its base identifier, e.g. "AQHA-Horsemanship - Level 1")
    // from every place it can live on a discipline: the schedule order, pattern
    // groups (including Go 1/Go 2 split entries, which are stored as "<id>-go1"/"-go2"
    // with baseId === the identifier), dates, print titles and go-config.
    // Used when a division is unchecked or a custom division is deleted, so it does
    // not "carry across" into the Add Dates / Group Patterns tabs.
    const removeDivisionFromDiscipline = (disc, divisionIdentifier) => {
        const matchesDivision = (d) => {
            const id = typeof d === 'string' ? d : (d?.id ?? d);
            const baseId = typeof d === 'string' ? d : (d?.baseId ?? id);
            return id === divisionIdentifier || baseId === divisionIdentifier;
        };

        const newDivisionDates = { ...(disc.divisionDates || {}) };
        const newDivisionPrintTitles = { ...(disc.divisionPrintTitles || {}) };
        const newDivisionGos = { ...(disc.divisionGos || {}) };
        delete newDivisionDates[divisionIdentifier];
        delete newDivisionPrintTitles[divisionIdentifier];
        delete newDivisionGos[divisionIdentifier];

        return {
            divisionOrder: (disc.divisionOrder || []).filter(d => d !== divisionIdentifier),
            patternGroups: (disc.patternGroups || []).map(group => ({
                ...group,
                divisions: (group.divisions || []).filter(d => !matchesDivision(d)),
            })),
            divisionDates: newDivisionDates,
            divisionPrintTitles: newDivisionPrintTitles,
            divisionGos: newDivisionGos,
        };
    };

    const CustomDivisionManager = ({ pbbDiscipline, setFormData }) => {
        const [customDivisionName, setCustomDivisionName] = React.useState('');
        const [isCustomDivisionModalOpen, setIsCustomDivisionModalOpen] = React.useState(false);

        const openShowSuggestions = useMemo(() => {
            return {
                divisions: [
                    { group: 'Walk-Trot', levels: ['All'] },
                    { group: 'Youth', levels: ['All', '13 & Under', '14-18'] },
                    { group: 'Amateur', levels: ['All', 'Select'] },
                    { group: 'Open', levels: ['All', 'Junior Horse', 'Senior Horse'] },
                ]
            };
        }, []);
    
        const handleDivisionChange = (groupName, level, isChecked) => {
            setFormData(prev => {
                const newDisciplines = prev.disciplines.map(disc => {
                    if (disc.id === pbbDiscipline.id) {
                        const newDivisions = JSON.parse(JSON.stringify(disc.divisions || {}));
                        if (!newDivisions['open-show']) newDivisions['open-show'] = {};
                        if (!newDivisions['open-show'][groupName]) newDivisions['open-show'][groupName] = [];
    
                        if (isChecked) {
                            if (!newDivisions['open-show'][groupName].includes(level)) {
                                newDivisions['open-show'][groupName].push(level);
                            }
                        } else {
                            newDivisions['open-show'][groupName] = newDivisions['open-show'][groupName].filter(l => l !== level);
                            if (newDivisions['open-show'][groupName].length === 0) {
                                delete newDivisions['open-show'][groupName];
                            }
                        }
                        return { ...disc, divisions: newDivisions };
                    }
                    return disc;
                });
                return { ...prev, disciplines: newDisciplines };
            });
        };
    
        const handleAddCustomDivision = () => {
            if (!customDivisionName.trim()) return;
            handleDivisionChange(customDivisionName, 'All', true);
            setCustomDivisionName('');
            setIsCustomDivisionModalOpen(false);
        };
    
        const currentDivisions = pbbDiscipline.divisions && pbbDiscipline.divisions['open-show'] ? pbbDiscipline.divisions['open-show'] : {};
    
        return (
            <div className="space-y-3">
                <h4 className="font-semibold text-base">Select Divisions for "{pbbDiscipline.name.replace(' at Halter', '')}"</h4>
                <div className="space-y-2">
                    {openShowSuggestions.divisions.map(group => (
                        <div key={group.group}>
                            <p className="text-xs font-medium text-muted-foreground">{group.group}</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 mt-1">
                                {group.levels.map(level => (
                                    <div key={level} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`div-${pbbDiscipline.id}-open-${group.group}-${level}`}
                                            checked={!!currentDivisions[group.group]?.includes(level)}
                                            onCheckedChange={(c) => handleDivisionChange(group.group, level, c)}
                                        />
                                        <Label htmlFor={`div-${pbbDiscipline.id}-open-${group.group}-${level}`} className="font-normal text-xs">{level}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <Dialog open={isCustomDivisionModalOpen} onOpenChange={setIsCustomDivisionModalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="mt-4"><PlusCircle className="h-4 w-4 mr-2" />Add Custom Division</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Custom Division</DialogTitle>
                            <DialogDescription>Enter a name for a new division group (e.g., Leadline).</DialogDescription>
                        </DialogHeader>
                        <Input value={customDivisionName} onChange={(e) => setCustomDivisionName(e.target.value)} placeholder="Division Name" />
                        <DialogFooter>
                            <Button onClick={handleAddCustomDivision}>Add Division</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    };
    
    export const ClassTabs = ({ pbbDiscipline, mergedDisciplines, setFormData, isOpenShowMode, formData, associationsData, divisionsData, isComplete, onAutoGroupComplete }) => {
        const [customDivisionName, setCustomDivisionName] = React.useState('');
        const [isCustomDivisionModalOpen, setIsCustomDivisionModalOpen] = React.useState(false);
        const [customDivisionAssocId, setCustomDivisionAssocId] = React.useState(null);
        const [activeAssocTab, setActiveAssocTab] = React.useState(null);
        const [activeTab, setActiveTab] = React.useState('divisions');
        const prevDisciplineIdRef = React.useRef(null);
        const scheduleTabRef = useRef(null);
        const groupingTabRef = useRef(null);
        const [isSavingCustomDivision, setIsSavingCustomDivision] = useState(false);
        const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
        const [selectedSourceDisciplineId, setSelectedSourceDisciplineId] = useState(null);
        const { toast } = useToast();

        // Use mergedDisciplines if provided, otherwise just the single discipline
        const allDisciplines = mergedDisciplines && mergedDisciplines.length > 0 ? mergedDisciplines : [pbbDiscipline];
        
        // Get unique association IDs from all merged disciplines
        const associationTabsData = useMemo(() => {
            const assocMap = {};
            allDisciplines.forEach(disc => {
                const selectedAssocs = Object.keys(disc.selectedAssociations || {});
                selectedAssocs.forEach(assocId => {
                    if (!assocMap[assocId]) {
                        const assoc = associationsData?.find(a => a.id === assocId);
                        assocMap[assocId] = {
                            id: assocId,
                            name: assoc?.name || assocId,
                            abbreviation: assoc?.abbreviation || assocId,
                            discipline: disc
                        };
                    }
                });
            });
            return Object.values(assocMap);
        }, [allDisciplines, associationsData]);

        // Set default active tab if not set
        React.useEffect(() => {
            if (!activeAssocTab && associationTabsData.length > 0) {
                setActiveAssocTab(associationTabsData[0].id);
            }
        }, [activeAssocTab, associationTabsData]);

        // Get the currently active discipline based on selected tab
        const activeDiscipline = useMemo(() => {
            const activeAssocData = associationTabsData.find(a => a.id === activeAssocTab);
            return activeAssocData?.discipline || pbbDiscipline;
        }, [activeAssocTab, associationTabsData, pbbDiscipline]);
    
        const handleDisciplineConfigChange = (disciplineId, configKey, value) => {
            setFormData(prev => ({ ...prev, disciplines: prev.disciplines.map(c => c.id === disciplineId ? { ...c, [configKey]: value } : c) }));
        };
    
        const handleAddCustomDivision = async () => {
            if (!customDivisionName.trim() || !customDivisionAssocId) return;
            
            setIsSavingCustomDivision(true);
            
            try {
                // Save to database
                const { data: maxSortOrder } = await supabase
                    .from('divisions')
                    .select('sort_order')
                    .eq('association_id', customDivisionAssocId)
                    .order('sort_order', { ascending: false })
                    .limit(1)
                    .single();
                
                const newSortOrder = (maxSortOrder?.sort_order || 0) + 1;
                
                const { error: insertError } = await supabase
                    .from('divisions')
                    .insert({
                        name: customDivisionName.trim(),
                        association_id: customDivisionAssocId,
                        sort_order: newSortOrder
                    });
                
                if (insertError) {
                    console.error('Error saving custom division to DB:', insertError);
                    toast({
                        title: "Database Save Failed",
                        description: "Division was added locally but could not be saved to database.",
                        variant: "destructive",
                    });
                } else {
                    toast({
                        title: "Custom Division Added",
                        description: `"${customDivisionName.trim()}" has been saved to the database.`,
                    });
                }
                
                // Always update local state
                setFormData(prev => ({
                    ...prev,
                    disciplines: prev.disciplines.map(disc => {
                        if (disc.id === pbbDiscipline.id) {
                            const newCustomDivisions = Array.isArray(disc.customDivisions) ? [...disc.customDivisions] : [];
                            const newDivision = { name: customDivisionName.trim(), assocId: customDivisionAssocId };
                            if (!newCustomDivisions.some(d => d.name === newDivision.name && d.assocId === newDivision.assocId)) {
                                newCustomDivisions.push(newDivision);
                            }
                            return { ...disc, customDivisions: newCustomDivisions };
                        }
                        return disc;
                    })
                }));
                
                setCustomDivisionName('');
                setIsCustomDivisionModalOpen(false);
                setCustomDivisionAssocId(null);
            } catch (error) {
                console.error('Error in handleAddCustomDivision:', error);
                toast({
                    title: "Error",
                    description: "Failed to add custom division.",
                    variant: "destructive",
                });
            } finally {
                setIsSavingCustomDivision(false);
            }
        };
    
        const handleRemoveCustomDivision = (disciplineId, divisionName, assocId) => {
            setFormData(prev => ({
                ...prev,
                disciplines: prev.disciplines.map(disc => {
                    if (disc.id === disciplineId) {
                        const newCustomDivisions = (disc.customDivisions || []).filter(d => !(d.name === divisionName && d.assocId === assocId));
                        const newDivisions = { ...disc.divisions };
                        if (newDivisions[assocId]) {
                            newDivisions[assocId] = { ...newDivisions[assocId] };
                            delete newDivisions[assocId][`custom-${divisionName}`];
                        }
                        // Also strip it from the schedule order, pattern groups, dates, etc.
                        // so the deleted custom division does not carry across into Tabs 2 & 3.
                        const divisionIdentifier = `${assocId}-custom-${divisionName}`;
                        return {
                            ...disc,
                            customDivisions: newCustomDivisions,
                            divisions: newDivisions,
                            ...removeDivisionFromDiscipline(disc, divisionIdentifier),
                        };
                    }
                    return disc;
                })
            }));
        };
    
        const handleDivisionChange = (disciplineId, assocId, groupName, level, isChecked, isCustom = false) => {
            setFormData(prev => {
                return {
                    ...prev,
                    disciplines: prev.disciplines.map(disc => {
                        if (disc.id === disciplineId) {
                            const newDivisions = { ...(disc.divisions || {}) };
                            newDivisions[assocId] = { ...(newDivisions[assocId] || {}) };
                            const key = isCustom ? `custom-${groupName}` : `${groupName} - ${level}`;
                            const divisionIdentifier = `${assocId}-${key}`;

                            if (isChecked) {
                                newDivisions[assocId][key] = true;
                                const newDivisionOrder = disc.divisionOrder ? [...disc.divisionOrder] : [];
                                if (!newDivisionOrder.includes(divisionIdentifier)) {
                                    newDivisionOrder.push(divisionIdentifier);
                                }
                                return { ...disc, divisions: newDivisions, divisionOrder: newDivisionOrder };
                            }

                            // Unchecking: drop it everywhere it may have carried across
                            // (schedule order, pattern groups incl. Go 1/Go 2 entries, dates, titles, go-config)
                            delete newDivisions[assocId][key];
                            return {
                                ...disc,
                                divisions: newDivisions,
                                ...removeDivisionFromDiscipline(disc, divisionIdentifier),
                            };
                        }
                        return disc;
                    })
                }
            });
        };
    
        const getDivisionsForDiscipline = useMemo(() => {
            if (!associationsData || !divisionsData) return {};
        
            // Collect all relevant association IDs from all merged disciplines
            let relevantAssocIds = [];
            allDisciplines.forEach(disc => {
                const assocIds = Object.keys(disc.selectedAssociations || {});
                assocIds.forEach(id => {
                    if (!relevantAssocIds.includes(id)) {
                        relevantAssocIds.push(id);
                    }
                });
            });
        
            const isStandaloneMode = formData.nsbaApprovalType === 'standalone' || formData.nsbaApprovalType === 'both';
            allDisciplines.forEach(disc => {
                if (isStandaloneMode && disc.selectedAssociations?.['NSBA'] && !relevantAssocIds.includes('NSBA')) {
                    relevantAssocIds.push('NSBA');
                }
            });
        
            const divisionMap = {};
            const noOpenDisciplines = ['Showmanship at Halter', 'Hunt Seat Equitation', 'Western Horsemanship'];
            // Also hide open categories for disciplines containing "Amateur"
            const shouldHideOpenCategories = noOpenDisciplines.includes(pbbDiscipline.name) || 
                                            (pbbDiscipline.name && pbbDiscipline.name.toLowerCase().includes('amateur'));
        
            relevantAssocIds.forEach(assocId => {
                // Find the discipline that has this association
                const discForAssoc = allDisciplines.find(d => d.selectedAssociations?.[assocId]);
                const assocData = associationsData.find(a => a.id === assocId);
            if (assocData && divisionsData[assocId]) {
                    let divisions = divisionsData[assocId];
        
                    // Support multiple sub-association types
                    const selectedSubTypes = formData.subAssociationSelections?.[assocId]?.types || [];
                    
                    // For 4-H, filter divisions by selected city
                    if (assocId === '4-H' && formData.selected4HCity) {
                        divisions = divisions.filter(d => 
                            d.sub_association_type === formData.selected4HCity || 
                            !d.sub_association_type
                        );
                    }
                    // Filter divisions based on the discipline's sub_association_type
                    // If the discipline has a sub_association_type, only show divisions for that type
                    else if (discForAssoc?.sub_association_type) {
                        divisions = divisions.filter(d => 
                            d.sub_association_type === discForAssoc.sub_association_type || 
                            !d.sub_association_type
                        );
                    } else if (selectedSubTypes.length > 0) {
                        // If no specific sub-type on discipline but association has selected sub-types,
                        // show divisions without sub-type restrictions
                        divisions = divisions.filter(d => !d.sub_association_type);
                    }
                    
                    // Non-Pro divisions only apply to a few disciplines. Normalize the discipline name
                    // to the core keyword that appears in its Non-Pro level names (e.g.
                    // "Level 1 Horse Non-Pro Horsemanship"). Handles both naming styles:
                    // "Showmanship at Halter"/"Showmanship" and "Western Horsemanship"/"Horsemanship".
                    const nonProKeyword = (pbbDiscipline.name || '')
                        .replace(' at Halter', '')
                        .replace('Western ', '')
                        .trim();
                    const nonProDisciplines = ['Showmanship', 'Horsemanship', 'Hunt Seat Equitation'];
                    const shouldShowNonPro = nonProDisciplines.includes(nonProKeyword);
                    
                    // Associations that should only show Open, Non-Pro, Youth (hide Amateur)
                    const openNonProYouthOnlyAssocs = ['SHTX', 'NRHA', 'NRCHA'];
                    const isOpenNonProYouthOnlyAssoc = openNonProYouthOnlyAssocs.includes(assocId);
                    
                    divisionMap[assocId] = divisions
                        .filter(d => {
                            if (shouldHideOpenCategories) {
                                return d.group.toLowerCase() !== 'open';
                            }
                            // Hide Non-Pro division group entirely unless discipline allows it (for non Open/Non-Pro/Youth only assocs)
                            if (d.group === 'Non-Pro' && !shouldShowNonPro && !isOpenNonProYouthOnlyAssoc) {
                                return false;
                            }
                            // Hide Amateur for SHTX/NRHA - only show Open, Non-Pro, Youth
                            if (isOpenNonProYouthOnlyAssoc && d.group === 'Amateur') {
                                return false;
                            }
                            return true;
                        })
                        .map(d => {
                            // Filter Non-Pro levels to only show matching discipline (for non Open/Non-Pro/Youth only assocs)
                            if (shouldShowNonPro && d.group === 'Non-Pro' && !isOpenNonProYouthOnlyAssoc) {
                                return {
                                    ...d,
                                    // Only keep Non-Pro levels that belong to THIS discipline.
                                    levels: d.levels.filter(level => level.includes(nonProKeyword))
                                };
                            }
                            return d;
                        });
                } else if (assocData) {
                    divisionMap[assocId] = [];
                }
            });
            return divisionMap;
        }, [allDisciplines, pbbDiscipline, associationsData, divisionsData, formData.nsbaApprovalType, formData.subAssociationSelections, formData.selected4HCity]);
    
        // Check hasSelectedDivisions across all merged disciplines
        const hasSelectedDivisions = allDisciplines.some(disc => 
            disc.divisions && Object.values(disc.divisions).some(divs => {
                if (isOpenShowMode && disc.isCustom) {
                    return Object.values(divs || {}).some(levels => Array.isArray(levels) && levels.length > 0);
                }
                return Object.keys(divs || {}).length > 0;
            })
        );
    
        const isCustomOpenShowDiscipline = pbbDiscipline.isCustom && isOpenShowMode;
    
        // Check hasScheduled across all merged disciplines
        // Step 2 is complete when divisions have dates assigned, not just when they're in divisionOrder
        const hasScheduled = allDisciplines.some(disc => {
            if (!disc.divisionOrder || disc.divisionOrder.length === 0) return false;
            // Check if at least one division has a date assigned
            return disc.divisionOrder.some(divId => 
                disc.divisionDates && disc.divisionDates[divId]
            );
        });

        // Check if this is a scoresheet-only or rulebook discipline (Tab 3 should be disabled for both)
        const isScoresheetOnly = allDisciplines.some(disc => 
            disc && (disc.pattern_type === 'scoresheet_only' || (!disc.pattern && disc.scoresheet))
        );
        
        // Check if this is a rulebook pattern discipline (uses pre-defined patterns, no custom grouping needed)
        const isRulebookPattern = allDisciplines.some(disc => 
            disc && disc.pattern_type === 'rulebook'
        );

        // Get dual-approved settings for NSBA, NRHA, and NRCHA
        const dualApprovedSettings = useMemo(() => {
            const subSelections = formData.subAssociationSelections || {};
            const settings = {};
            
            ['nsba', 'nrha', 'nrcha'].forEach(assocKey => {
                const approvalType = subSelections[assocKey]?.approvalType;
                const dualApprovedWith = subSelections[assocKey]?.dualApprovedWith || [];
                if ((approvalType === 'dual' || approvalType === 'both') && dualApprovedWith.length > 0) {
                    settings[assocKey.toUpperCase()] = dualApprovedWith;
                }
            });
            
            return settings;
        }, [formData.subAssociationSelections]);

        // Helper to find the correct discipline for a given association ID
        const getDisciplineForAssoc = (assocId) => {
            return allDisciplines.find(d => d.selectedAssociations?.[assocId]) || pbbDiscipline;
        };

        // Get disciplines that have configured divisions with matching division labels (excluding current discipline)
        const getDisciplinesWithDivisions = useMemo(() => {
            const allDisciplinesInForm = formData.disciplines || [];
            
            // Get current discipline's available associations
            const currentAssocIds = Object.keys(pbbDiscipline.selectedAssociations || {}).filter(
                id => pbbDiscipline.selectedAssociations[id]
            );
            
            // Get available division groups for current discipline from divisionsData
            const currentDivisionGroups = new Set();
            currentAssocIds.forEach(assocId => {
                if (divisionsData && divisionsData[assocId]) {
                    divisionsData[assocId].forEach(group => {
                        if (group.group) {
                            currentDivisionGroups.add(`${assocId}-${group.group}`);
                        }
                    });
                }
            });
            
            return allDisciplinesInForm.filter(disc => {
                // Exclude current discipline
                if (disc.id === pbbDiscipline.id) return false;
                
                // Check if discipline has any configured divisions
                if (!disc.divisions) return false;
                
                // Check for regular divisions
                const hasRegularDivisions = Object.values(disc.divisions).some(divs => {
                    if (!divs) return false;
                    if (isOpenShowMode && disc.isCustom) {
                        // For open-show custom disciplines, check if arrays have items
                        return Object.values(divs).some(levels => Array.isArray(levels) && levels.length > 0);
                    }
                    // For regular divisions, check if object has keys
                    return Object.keys(divs).length > 0;
                });
                
                if (!hasRegularDivisions) return false;
                
                // Check if source discipline has matching associations
                const sourceAssocIds = Object.keys(disc.selectedAssociations || {}).filter(
                    id => disc.selectedAssociations[id]
                );
                
                // Check if there's at least one matching association
                const hasMatchingAssociations = currentAssocIds.some(assocId => 
                    sourceAssocIds.includes(assocId)
                );
                
                if (!hasMatchingAssociations) return false;
                
                // For disciplines with matching associations, check if they have compatible division structure
                // This ensures the division labels (groups) are compatible
                const sourceDivisionKeys = new Set();
                Object.entries(disc.divisions || {}).forEach(([assocId, divs]) => {
                    if (divs && typeof divs === 'object') {
                        Object.keys(divs).forEach(divKey => {
                            // Extract group name from division key (e.g., "Open - Level 1" -> "Open")
                            // or "custom-DivisionName" -> "custom-DivisionName"
                            if (divKey.startsWith('custom-')) {
                                sourceDivisionKeys.add(`${assocId}-custom`);
                            } else {
                                const groupMatch = divKey.match(/^([^-]+)/);
                                if (groupMatch) {
                                    sourceDivisionKeys.add(`${assocId}-${groupMatch[1].trim()}`);
                                }
                            }
                        });
                    }
                });
                
                // Check if there's at least one matching division group between current and source
                const hasMatchingDivisionGroups = Array.from(currentDivisionGroups).some(groupKey => 
                    sourceDivisionKeys.has(groupKey)
                );
                
                return hasMatchingDivisionGroups;
            });
        }, [formData.disciplines, pbbDiscipline.id, pbbDiscipline.selectedAssociations, isOpenShowMode, divisionsData]);

        // Handle duplication from another discipline
        const handleDuplicateFrom = (sourceDisciplineId) => {
            const sourceDiscipline = formData.disciplines?.find(d => d.id === sourceDisciplineId);
            if (!sourceDiscipline) {
                toast({
                    title: "Error",
                    description: "Source discipline not found.",
                    variant: "destructive",
                });
                return;
            }

            // Build the set of divisions that are actually valid (selectable) for THIS
            // target discipline. We only copy these, so classes that belong only to the
            // source discipline (e.g. a Non-Pro "Level 1 Horsemanship" level copied into
            // Western Riding, or a custom division for an association this discipline does
            // not have) are never brought across. Without this guard those classes have no
            // checkbox here, can never be unchecked, and leak into the Add Dates / Group
            // Patterns tabs even though the user never selected them.
            const validKeysByAssoc = {};
            Object.entries(getDivisionsForDiscipline).forEach(([assocId, groups]) => {
                const keys = new Set();
                (groups || []).forEach(group => {
                    (group.levels || []).forEach(level => keys.add(`${group.group} - ${level}`));
                });
                validKeysByAssoc[assocId] = keys;
            });

            // Custom divisions only render (and can be unchecked) for associations this
            // discipline actually has, so keep only those and register their keys as valid.
            const newCustomDivisions = (sourceDiscipline.customDivisions || [])
                .filter(cd => validKeysByAssoc[cd.assocId])
                .map(cd => ({ ...cd }));
            newCustomDivisions.forEach(cd => validKeysByAssoc[cd.assocId].add(`custom-${cd.name}`));

            const isValidDivision = (assocId, key) => !!validKeysByAssoc[assocId]?.has(key);

            setFormData(prev => {
                return {
                    ...prev,
                    disciplines: prev.disciplines.map(disc => {
                        if (disc.id === pbbDiscipline.id) {
                            // Copy only the divisions that are valid for this discipline
                            const newDivisions = {};
                            Object.entries(sourceDiscipline.divisions || {}).forEach(([assocId, keysObj]) => {
                                Object.entries(keysObj || {}).forEach(([key, isChecked]) => {
                                    if (isChecked && isValidDivision(assocId, key)) {
                                        if (!newDivisions[assocId]) newDivisions[assocId] = {};
                                        newDivisions[assocId][key] = true;
                                    }
                                });
                            });

                            // Copy divisionOrder, dropping any entry that is not valid here
                            const newDivisionOrder = (sourceDiscipline.divisionOrder || []).filter(divId => {
                                const { assocId, divisionName } = parseDivisionId(divId);
                                return isValidDivision(assocId, divisionName);
                            });

                            return {
                                ...disc,
                                divisions: newDivisions,
                                divisionOrder: newDivisionOrder,
                                customDivisions: newCustomDivisions,
                                duplicatedFromDisciplineId: sourceDisciplineId // Store source discipline ID for group duplication
                            };
                        }
                        return disc;
                    })
                };
            });

            toast({
                title: "Divisions Duplicated",
                description: `Divisions copied from "${sourceDiscipline.name}".`,
            });

            setIsDuplicateModalOpen(false);
            setSelectedSourceDisciplineId(null);
        };

        // Determine step completion status
        const step1Complete = hasSelectedDivisions;
        const step2Complete = hasScheduled;
        const step3Complete = !isScoresheetOnly && pbbDiscipline.pattern && hasScheduled && 
            (() => {
                // Check if all selected divisions are grouped
                // Aggregate across all merged disciplines to get complete picture
                const allSelectedDivisions = new Set();
                const allGroupedDivisions = new Set();
                
                allDisciplines.forEach(disc => {
                    if (!disc) return;
                    
                    // Collect all divisions from divisionOrder (selected divisions)
                    if (disc.divisionOrder && Array.isArray(disc.divisionOrder)) {
                        disc.divisionOrder.forEach(divId => {
                            if (divId) {
                                allSelectedDivisions.add(divId);
                            }
                        });
                    }
                    
                    // Collect all divisions from patternGroups (grouped divisions)
                    const groups = disc.patternGroups || [];
                    groups.forEach(g => {
                        if (g && g.divisions && Array.isArray(g.divisions)) {
                            g.divisions.forEach(d => {
                                // Handle both object format {id: ...} and string format
                                const divId = typeof d === 'string' ? d : (d?.id || d);
                                if (divId) {
                                    allGroupedDivisions.add(divId);
                                }
                            });
                        }
                    });
                });
                
                // If no divisions selected, not complete
                if (allSelectedDivisions.size === 0) {
                    return false;
                }
                
                // All selected divisions must be grouped
                const allGrouped = allSelectedDivisions.size === allGroupedDivisions.size && 
                       [...allSelectedDivisions].every(d => allGroupedDivisions.has(d));
                
                return allGrouped;
            })();

        // Auto-open appropriate tab when component mounts or discipline changes
        React.useEffect(() => {
            const disciplineChanged = prevDisciplineIdRef.current !== pbbDiscipline.id;
            if (disciplineChanged || prevDisciplineIdRef.current === null) {
                prevDisciplineIdRef.current = pbbDiscipline.id;

                if (hasSelectedDivisions && hasScheduled && !isScoresheetOnly) {
                    setActiveTab('grouping');
                } else if (hasSelectedDivisions) {
                    setActiveTab('schedule');
                } else {
                    setActiveTab('divisions');
                }
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [pbbDiscipline.id, isScoresheetOnly]);

        return (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                {!isCustomOpenShowDiscipline && pbbDiscipline.category?.startsWith('pattern') && (
                    <div className="flex gap-4 mb-4">
                        <div className="flex items-center space-x-2"><Checkbox id={`pat-${pbbDiscipline.id}`} checked={pbbDiscipline.pattern} onCheckedChange={(c) => handleDisciplineConfigChange(pbbDiscipline.id, 'pattern', c)}/><Label htmlFor={`pat-${pbbDiscipline.id}`} className="font-normal">Pattern</Label></div>
                        <div className="flex items-center space-x-2"><Checkbox id={`sco-${pbbDiscipline.id}`} checked={pbbDiscipline.scoresheet} onCheckedChange={(c) => handleDisciplineConfigChange(pbbDiscipline.id, 'scoresheet', c)}/><Label htmlFor={`sco-${pbbDiscipline.id}`} className="font-normal">Scoresheet</Label></div>
                    </div>
                )}
                
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger
                        value="divisions"
                        className={cn(
                            activeTab === 'divisions' && "bg-primary text-primary-foreground",
                            !step1Complete && activeTab !== 'divisions' && "opacity-60"
                        )}
                    >
                        1. Select Divisions
                        {step1Complete && <CheckCircle2 className="ml-2 w-4 h-4" />}
                    </TabsTrigger>
                    <TabsTrigger
                        ref={scheduleTabRef}
                        value="schedule"
                        disabled={!hasSelectedDivisions}
                        className={cn(
                            activeTab === 'schedule' && "bg-primary text-primary-foreground",
                            !hasSelectedDivisions && "opacity-50"
                        )}
                    >
                        2. Add Dates &amp; Arrange Classes
                        {step2Complete && <CheckCircle2 className="ml-2 w-4 h-4" />}
                        {!hasSelectedDivisions && <AlertCircle className="ml-2 w-4 h-4" />}
                    </TabsTrigger>
                    <TabsTrigger
                        ref={groupingTabRef}
                        value="grouping"
                        disabled={!hasSelectedDivisions || isScoresheetOnly}
                        className={cn(
                            activeTab === 'grouping' && "bg-primary text-primary-foreground",
                            (!hasSelectedDivisions || isScoresheetOnly) && "opacity-50",
                            // Highlight grouping tab when dates are done but grouping isn't yet
                            step2Complete && !step3Complete && !isScoresheetOnly && activeTab !== 'grouping' && "ring-2 ring-primary/40 ring-offset-1"
                        )}
                    >
                        3. Group Patterns
                        {step3Complete && <CheckCircle2 className="ml-2 w-4 h-4" />}
                        {(!hasSelectedDivisions || isScoresheetOnly) && <AlertCircle className="ml-2 w-4 h-4" />}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="divisions" className="mt-2">
                    {isCustomOpenShowDiscipline ? (
                        <CustomDivisionManager pbbDiscipline={pbbDiscipline} setFormData={setFormData} />
                    ) : (
                        <div className="space-y-3">
                            {/* Duplicate From Button */}
                            {getDisciplinesWithDivisions.length > 0 && (
                                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsDuplicateModalOpen(true)}
                                        className="flex items-center gap-2"
                                    >
                                        <Copy className="h-4 w-4" />
                                        Duplicate From
                                    </Button>
                                    <span className="text-xs text-muted-foreground">
                                        Copy divisions from another discipline
                                    </span>
                                </div>
                            )}
                            
                            {/* Duplicate From Dialog */}
                            <Dialog open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Duplicate Divisions From</DialogTitle>
                                        <DialogDescription>
                                            Select a discipline to copy all its divisions, levels, and custom divisions to "{pbbDiscipline.name.replace(' at Halter', '')}".
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="source-discipline">Source Discipline</Label>
                                            <Select
                                                value={selectedSourceDisciplineId || ''}
                                                onValueChange={setSelectedSourceDisciplineId}
                                            >
                                                <SelectTrigger id="source-discipline">
                                                    <SelectValue placeholder="Select a discipline..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {getDisciplinesWithDivisions.map(disc => (
                                                        <SelectItem key={disc.id} value={disc.id}>
                                                            {disc.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {selectedSourceDisciplineId && (
                                            <div className="p-3 bg-muted rounded-lg">
                                                <p className="text-sm text-muted-foreground">
                                                    This will copy all selected divisions, levels, and custom divisions. 
                                                    The copied divisions will be independent and can be modified separately.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setIsDuplicateModalOpen(false);
                                                setSelectedSourceDisciplineId(null);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={() => handleDuplicateFrom(selectedSourceDisciplineId)}
                                            disabled={!selectedSourceDisciplineId}
                                        >
                                            Duplicate
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            {Object.entries(getDivisionsForDiscipline).map(([assocId, divisionGroups]) => {
                                const assoc = associationsData.find(a => a.id === assocId);
                                const discForAssoc = getDisciplineForAssoc(assocId);
                                const subTypeId = discForAssoc.sub_association_type;
                                const subTypeName = subTypeId && assoc?.sub_association_info?.types.find(t => t.id === subTypeId)?.name;
                                
                                return (
                                    <div key={assocId} className="p-2.5 border rounded-md">
                                        <div className="flex items-center space-x-2 mb-1.5 flex-wrap">
                                            <Badge variant={assoc?.color || 'secondary'}>
                                                {assoc?.name || assocId}
                                            </Badge>
                                            {subTypeName && (
                                                <Badge variant="outline" className="bg-primary/10">
                                                    {subTypeName}
                                                </Badge>
                                            )}
                                            {/* Show dual-approved badges for NSBA, NRHA, NRCHA */}
                                            {Object.entries(dualApprovedSettings).map(([dualAssocId, dualApprovedWith]) => {
                                                if (dualApprovedWith.includes(assocId)) {
                                                    return <Badge key={`dual-${dualAssocId}`} variant="dualApproved">{dualAssocId} Dual-Approved</Badge>;
                                                }
                                                return null;
                                            })}
                                            {discForAssoc.isNsbaStandalone && assocId === 'NSBA' && <Badge variant="standalone">NSBA Standalone</Badge>}
                                        </div>
                                        {divisionGroups && Array.isArray(divisionGroups) && divisionGroups.length > 0 ? divisionGroups.map((group, index) => {
                                            // Custom 4-column layout for AQHA Amateur divisions
                                            const isAQHAAmateur = assocId === 'AQHA' && group.group === 'Amateur';
                                            
                                            if (isAQHAAmateur) {
                                                // Support both DB naming conventions (old: "L1 Amateur", new: "Amateur Level 1")
                                                const column1Levels = ['Amateur', 'Amateur Select', 'Select Amateur (50+)'];
                                                const column2Levels = ['Amateur Rookie', 'Amateur Select Rookie (50+)', 'Amateur Level 1', 'Amateur Select Level 1', 'Rookie Amateur', 'L1 Amateur'];
                                                const column3Levels = ['Amateur Level 2', 'Amateur Select Level 2', 'L2 Amateur'];
                                                const column4Levels = ['Amateur Level 3', 'Amateur Select Level 3', 'L3 Amateur'];

                                                // Collect all column levels for fallback detection
                                                const allColumnLevels = new Set([...column1Levels, ...column2Levels, ...column3Levels, ...column4Levels]);

                                                // Match exact level names
                                                const col1 = group.levels.filter(level => column1Levels.includes(level));
                                                const col2 = group.levels.filter(level => column2Levels.includes(level));
                                                const col3 = group.levels.filter(level => column3Levels.includes(level));
                                                const col4 = group.levels.filter(level => column4Levels.includes(level));

                                                // Catch any levels not matched by the columns (e.g. Walk-Trot Amateur)
                                                const unmatchedLevels = group.levels.filter(level => !allColumnLevels.has(level));
                                                
                                                return (
                                                    <div key={`${assocId}-${group.group}-${index}`} className="mt-1.5 pl-1.5">
                                                        <p className="text-xs font-medium text-muted-foreground">{group.group}</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
                                                            {/* Column 1 */}
                                                            <div className="space-y-1.5">
                                                                {col1.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 2 */}
                                                            <div className="space-y-1.5">
                                                                {col2.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 3 */}
                                                            <div className="space-y-1.5">
                                                                {col3.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 4 */}
                                                            <div className="space-y-1.5">
                                                                {col4.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        {/* Fallback row for any levels not captured by the columns above */}
                                                        {unmatchedLevels.length > 0 && (
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                                                                {unmatchedLevels.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            // Custom 4-column layout for AQHA Youth divisions
                                            const isAQHAYouth = assocId === 'AQHA' && group.group === 'Youth';
                                            
                                            if (isAQHAYouth) {
                                                const column1Levels = [
                                                    'Youth 13 & Under',
                                                    'Youth 14–18',
                                                    'Youth 18 & Under',
                                                    'Small Fry (9 & Under)',
                                                    'Walk-Trot Youth 13 & Under',
                                                    'Walk-Trot Youth 14–18',
                                                    'Walk-Trot Youth 18 & Under'
                                                ];
                                                const column2Levels = [
                                                    'Youth 13 & Under Rookie',
                                                    'Youth 14–18 Rookie',
                                                    'Youth 18 & Under Rookie',
                                                    'Youth 13 & Under Level 1',
                                                    'Youth 14–18 Level 1',
                                                    'Youth 18 & Under Level 1'
                                                ];
                                                const column3Levels = [
                                                    'Youth 13 & Under Level 2',
                                                    'Youth 14–18 Level 2',
                                                    'Youth 18 & Under Level 2'
                                                ];
                                                const column4Levels = [
                                                    'Youth 13 & Under Level 3',
                                                    'Youth 14–18 Level 3',
                                                    'Youth 18 & Under Level 3'
                                                ];
                                                
                                                // Match exact level names - maintain column order
                                                const col1 = column1Levels.filter(level => group.levels.includes(level));
                                                const col2 = column2Levels.filter(level => group.levels.includes(level));
                                                const col3 = column3Levels.filter(level => group.levels.includes(level));
                                                const col4 = column4Levels.filter(level => group.levels.includes(level));
                                                
                                                return (
                                                    <div key={`${assocId}-${group.group}-${index}`} className="mt-1.5 pl-1.5">
                                                        <p className="text-xs font-medium text-muted-foreground">{group.group}</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
                                                            {/* Column 1 */}
                                                            <div className="space-y-1.5">
                                                                {col1.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 2 */}
                                                            <div className="space-y-1.5">
                                                                {col2.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 3 */}
                                                            <div className="space-y-1.5">
                                                                {col3.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 4 */}
                                                            <div className="space-y-1.5">
                                                                {col4.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            
                                            // Custom 3-column layout for APHA Open divisions
                                            const isAPHAOpen = assocId === 'APHA' && group.group === 'Open';
                                            
                                            if (isAPHAOpen) {
                                                const column1Levels = ['All-Ages', 'Junior Horse (5 & Under)', 'Senior Horse (6 & Over)'];
                                                const column2Levels = ['Green Horse'];
                                                const column3Levels = ['2-Year-Old', '3-Year-Old'];
                                                
                                                const col1 = column1Levels.filter(level => group.levels.includes(level));
                                                const col2 = column2Levels.filter(level => group.levels.includes(level));
                                                const col3 = column3Levels.filter(level => group.levels.includes(level));
                                                
                                                return (
                                                    <div key={`${assocId}-${group.group}-${index}`} className="mt-1.5 pl-1.5">
                                                        <p className="text-xs font-medium text-muted-foreground">{group.group}</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-1">
                                                            {/* Column 1 */}
                                                            <div className="space-y-1.5">
                                                                {col1.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 2 */}
                                                            <div className="space-y-1.5">
                                                                {col2.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 3 */}
                                                            <div className="space-y-1.5">
                                                                {col3.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            
                                            // Custom 3-column layout for APHA Amateur divisions
                                            const isAPHAAmateur = assocId === 'APHA' && group.group === 'Amateur';
                                            
                                            if (isAPHAAmateur) {
                                                const column1Levels = ['Amateur (19 & Over)', 'Classic Amateur (19–44)', 'Masters Amateur (45 & Over)'];
                                                const column2Levels = ['Novice Amateur'];
                                                const column3Levels = ['Amateur Walk-Trot (19 & Over)', 'Classic Amateur Walk-Trot (19 -44)', 'Masters Walk-Trot (45 & Over)'];
                                                
                                                const col1 = column1Levels.filter(level => group.levels.includes(level));
                                                const col2 = column2Levels.filter(level => group.levels.includes(level));
                                                const col3 = column3Levels.filter(level => group.levels.includes(level));
                                                
                                                return (
                                                    <div key={`${assocId}-${group.group}-${index}`} className="mt-1.5 pl-1.5">
                                                        <p className="text-xs font-medium text-muted-foreground">{group.group}</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-1">
                                                            {/* Column 1 */}
                                                            <div className="space-y-1.5">
                                                                {col1.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 2 */}
                                                            <div className="space-y-1.5">
                                                                {col2.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 3 */}
                                                            <div className="space-y-1.5">
                                                                {col3.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            
                                            // Custom 3-column layout for APHA Youth divisions
                                            const isAPHAYouth = assocId === 'APHA' && group.group === 'Youth';
                                            
                                            if (isAPHAYouth) {
                                                const column1Levels = ['Youth 18 & Under', 'Youth 13 & Under', 'Youth 14–18'];
                                                const column2Levels = ['Novice Youth (18 & Under)'];
                                                const column3Levels = ['Youth Walk-Trot 18 & Under', 'Youth Walk-Trot 5–10', 'Youth Walk-Trot 11–18'];
                                                
                                                const col1 = column1Levels.filter(level => group.levels.includes(level));
                                                const col2 = column2Levels.filter(level => group.levels.includes(level));
                                                const col3 = column3Levels.filter(level => group.levels.includes(level));
                                                
                                                return (
                                                    <div key={`${assocId}-${group.group}-${index}`} className="mt-1.5 pl-1.5">
                                                        <p className="text-xs font-medium text-muted-foreground">{group.group}</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-1">
                                                            {/* Column 1 */}
                                                            <div className="space-y-1.5">
                                                                {col1.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 2 */}
                                                            <div className="space-y-1.5">
                                                                {col2.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Column 3 */}
                                                            <div className="space-y-1.5">
                                                                {col3.map(level => {
                                                                    const key = `${group.group} - ${level}`;
                                                                    return (
                                                                        <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                            <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                            <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            
                                            // Custom grid layout for Colorado 4-H Youth divisions
                                            const isColorado4H = assocId === '4-H' && formData.selected4HCity === 'Colorado' && group.group === 'Youth';

                                            if (isColorado4H) {
                                                // Detect the actual intermediate name from DB data (handles both old and new naming)
                                                const intermediateBase = group.levels.find(l => /^Intermediate\s/.test(l) && !/Level/i.test(l) && !/Walk/i.test(l)) || 'Intermediate 11–13';

                                                // Define age groups and levels for the grid
                                                const ageGroups = [
                                                    { label: 'Junior 8-10', base: 'Junior 8-10' },
                                                    { label: intermediateBase, base: intermediateBase },
                                                    { label: 'Senior 14-18', base: 'Senior 14-18' },
                                                ];

                                                // Detect which level suffixes actually exist in the data
                                                const allSuffixes = [
                                                    { label: 'Base', suffix: '' },
                                                    { label: 'Level I', suffix: ' Level I' },
                                                    { label: 'Level 2', suffix: ' Level 2' },
                                                    { label: 'Level 3', suffix: ' Level 3' },
                                                    { label: 'Level 4', suffix: ' Level 4' },
                                                    { label: 'Level 3 & 4', suffix: ' Level 3 & 4' },
                                                ];
                                                // Only show columns where at least one age group has that level
                                                const levelSuffixes = allSuffixes.filter(ls =>
                                                    ageGroups.some(ag => group.levels.includes(`${ag.base}${ls.suffix}`))
                                                );

                                                // Walk-Trot levels (separated)
                                                const walkTrotLevels = group.levels.filter(l => l.toLowerCase().includes('walk') && l.toLowerCase().includes('trot'));

                                                return (
                                                    <div key={`${assocId}-${group.group}-${index}`} className="mt-1.5 pl-1.5">
                                                        <p className="text-xs font-medium text-muted-foreground">{group.group}</p>

                                                        {/* Age Group × Level Grid */}
                                                        <div className="mt-2 border rounded-md overflow-hidden">
                                                            <table className="w-full text-xs">
                                                                <thead>
                                                                    <tr className="bg-muted/50">
                                                                        <th className="text-left p-2 font-medium text-muted-foreground">Age Group</th>
                                                                        {levelSuffixes.map(ls => (
                                                                            <th key={ls.label} className="text-center p-2 font-medium text-muted-foreground">{ls.label}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {ageGroups.map((ag, rowIdx) => (
                                                                        <tr key={ag.base} className={rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                                                            <td className="p-2 font-medium text-foreground whitespace-nowrap">{ag.label}</td>
                                                                            {levelSuffixes.map(ls => {
                                                                                const levelName = `${ag.base}${ls.suffix}`;
                                                                                const isAvailable = group.levels.includes(levelName);
                                                                                const divKey = `${group.group} - ${levelName}`;
                                                                                const isChecked = !!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][divKey]);
                                                                                return (
                                                                                    <td key={ls.label} className="text-center p-2">
                                                                                        {isAvailable ? (
                                                                                            <div className="flex justify-center">
                                                                                                <Checkbox
                                                                                                    id={`div-${pbbDiscipline.id}-${assocId}-${divKey}`}
                                                                                                    checked={isChecked}
                                                                                                    onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, levelName, c, false)}
                                                                                                />
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="text-muted-foreground/30">—</span>
                                                                                        )}
                                                                                    </td>
                                                                                );
                                                                            })}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {/* Walk-Trot Section (separated) */}
                                                        {walkTrotLevels.length > 0 && (
                                                            <div className="mt-3 p-2 border rounded-md bg-muted/10">
                                                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Walk-Trot</p>
                                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                                                                    {walkTrotLevels.map(level => {
                                                                        const divKey = `${group.group} - ${level}`;
                                                                        return (
                                                                            <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                                <Checkbox
                                                                                    id={`div-${pbbDiscipline.id}-${assocId}-${divKey}`}
                                                                                    checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][divKey])}
                                                                                    onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)}
                                                                                />
                                                                                <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${divKey}`} className="font-normal text-xs">{level}</Label>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            // Default layout for all other divisions
                                            return (
                                                <div key={`${assocId}-${group.group}-${index}`} className="mt-1.5 pl-1.5">
                                                    <p className="text-xs font-medium text-muted-foreground">{group.group}</p>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 mt-1">
                                                        {group.levels.map(level => {
                                                            const key = `${group.group} - ${level}`;
                                                            return (
                                                                <div key={`${assocId}-${level}`} className="flex items-center space-x-2">
                                                                    <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${key}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][key])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, group.group, level, c, false)} />
                                                                    <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${key}`} className="font-normal text-xs">{level}</Label>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        }) : <p className="text-xs text-muted-foreground pl-2">No divisions found for this association.</p>}
     
                                        <div className="mt-1.5 pl-1.5">
                                            <p className="text-xs font-medium text-muted-foreground">Custom Divisions</p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 mt-1">
                                                {(pbbDiscipline.customDivisions || []).filter(d => d.assocId === assocId).map(customDiv => (
                                                    <div key={customDiv.name} className="flex items-center space-x-2 bg-muted/50 p-1 rounded-md">
                                                        <Checkbox id={`div-${pbbDiscipline.id}-${assocId}-${customDiv.name}`} checked={!!(pbbDiscipline.divisions && pbbDiscipline.divisions[assocId] && pbbDiscipline.divisions[assocId][`custom-${customDiv.name}`])} onCheckedChange={(c) => handleDivisionChange(pbbDiscipline.id, assocId, customDiv.name, '', c, true)} />
                                                        <Label htmlFor={`div-${pbbDiscipline.id}-${assocId}-${customDiv.name}`} className="font-normal text-xs flex-grow">{customDiv.name}</Label>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveCustomDivision(pbbDiscipline.id, customDiv.name, assocId)}>
                                                            <Trash2 className="h-3 w-3 text-destructive" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div >
                                        <Button variant="outline" size="sm" className="mt-1.5" onClick={() => { setCustomDivisionAssocId(assocId); setIsCustomDivisionModalOpen(true); }}>
                                            <PlusCircle className="h-4 w-4 mr-2" />Add Custom Division
                                        </Button>
                                    </div>
                                );
                            })}
                             <Dialog open={isCustomDivisionModalOpen} onOpenChange={(open) => { if (!isSavingCustomDivision) setIsCustomDivisionModalOpen(open); }}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add Custom Division</DialogTitle>
                                        <DialogDescription>Enter a name for a new division for {associationsData.find(a => a.id === customDivisionAssocId)?.name || customDivisionAssocId}. This will be saved to the database.</DialogDescription>
                                    </DialogHeader>
                                    <Input 
                                        value={customDivisionName} 
                                        onChange={(e) => setCustomDivisionName(e.target.value)} 
                                        placeholder="E.g., Leadline 8 & Under"
                                        disabled={isSavingCustomDivision}
                                    />
                                    <DialogFooter>
                                        <Button onClick={handleAddCustomDivision} disabled={isSavingCustomDivision || !customDivisionName.trim()}>
                                            {isSavingCustomDivision ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                'Add Division'
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </TabsContent>
                <TabsContent
                    value="schedule"
                    className="mt-2"
                >
                    <ScheduleOrganizer
                        pbbDiscipline={pbbDiscipline}
                        setFormData={setFormData}
                        formData={formData}
                        associationsData={associationsData}
                    />
                </TabsContent>
                <TabsContent
                    value="grouping"
                    className="mt-2"
                >
                    <PatternGrouping
                        pbbDiscipline={pbbDiscipline}
                        setFormData={setFormData}
                        isCustomOpenShow={isCustomOpenShowDiscipline}
                        formData={formData}
                        associationsData={associationsData}
                        divisionsData={divisionsData}
                        onAutoGroupComplete={onAutoGroupComplete}
                    />
                </TabsContent>
            </Tabs>
        );
    };