import React, { useState, useMemo } from 'react';
import { parseDivisionId } from '@/lib/showBillUtils';
import { PlusCircle, Move, Info, Undo2, Sparkles, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DndContext, closestCenter, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useToast } from '@/components/ui/use-toast';
import { isWalkTrotDivision, cn } from '@/lib/utils';
import DraggableDivision from './DraggableDivision';
import DropZoneGroup from './DropZoneGroup';

const UNGROUPED_ID = 'ungrouped-list';

export const PatternGrouping = ({ pbbDiscipline, setFormData, isCustomOpenShow, formData, associationsData, divisionsData, onAutoGroupComplete }) => {
    const [selectedForBulkMove, setSelectedForBulkMove] = useState([]);
    const [isDuplicateGroupsDialogOpen, setIsDuplicateGroupsDialogOpen] = useState(false);
    const [selectedSourceDisciplineId, setSelectedSourceDisciplineId] = useState(null);
    const { toast } = useToast();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const { setNodeRef: setUngroupedNodeRef, isOver: isOverUngrouped } = useDroppable({ id: UNGROUPED_ID });

    // Helper: Get all associations that have divisions in this discipline
    const getAllAssociationsForDiscipline = () => {
        if (!pbbDiscipline) return [];
        
        const allAssocIds = new Set();
        
        // From divisionOrder (all divisions including ungrouped)
        if (pbbDiscipline.divisionOrder) {
            pbbDiscipline.divisionOrder.forEach(divId => {
                const { assocId } = parseDivisionId(divId);
                if (assocId) allAssocIds.add(assocId);
            });
        }
        
        // From grouped divisions
        (pbbDiscipline.patternGroups || []).forEach(group => {
            (group.divisions || []).forEach(div => {
                if (div.assocId) allAssocIds.add(div.assocId);
            });
        });
        
        return Array.from(allAssocIds);
    };

    // Helper: Get Primary associations for this discipline based on actual divisions
    const getPrimaryAssociationsForDiscipline = () => {
        if (!formData?.primaryAffiliates || !pbbDiscipline) return [];
        
        const allAssocIds = getAllAssociationsForDiscipline();
        
        // Filter to only Primary associations that have divisions
        return allAssocIds.filter(assocId => 
            formData.primaryAffiliates.includes(assocId)
        );
    };

    const AFFECTED_CLASSES_FOR_WT_RULE = [
        "Showmanship at Halter", "Trail", "Western Horsemanship", "Hunter Hack",
        "In-Hand Trail", "Working Hunter", "Ranch Trail", "Equitation Over Fences",
        "VRH Ranch Trail", "Jumping"
    ];

    const handleAiAssistClick = () => {
        toast({
            title: "🚧 AI Verbiage Summarizer Coming Soon!",
            description: "This feature will automatically extract key maneuvers from verbiage and place them on the score sheet. Stay tuned! 🚀",
            duration: 6000,
        });
    };

    const handleAddPatternGroup = (disciplineId) => {
        setFormData(prev => ({
            ...prev,
            disciplines: prev.disciplines.map(disc => {
                if (disc.id === disciplineId) {
                    const patternGroups = disc.patternGroups || [];

                    // Maximum 5 pattern groups allowed
                    if (patternGroups.length >= 5) {
                        toast({
                            title: "Maximum Groups Reached",
                            description: "You can only create up to 5 pattern groups.",
                            variant: "destructive",
                        });
                        return disc;
                    }

                    const newGroupId = `pattern-group-${Date.now()}`;
                    const newGroup = {
                        id: newGroupId,
                        name: `Group ${patternGroups.length + 1}`,
                        divisions: [],
                        rulebookPatternId: '',
                    };
                    return { ...disc, patternGroups: [...patternGroups, newGroup] };
                }
                return disc;
            })
        }));
    };

    const handleRemovePatternGroup = (disciplineId, groupId) => {
        setFormData(prev => ({
            ...prev,
            disciplines: prev.disciplines.map(disc => {
                if (disc.id === disciplineId) {
                    const groupToRemove = disc.patternGroups.find(g => g.id === groupId);
                    if (!groupToRemove) return disc;

                    const newPatternGroups = disc.patternGroups.filter(g => g.id !== groupId);

                    return {
                        ...disc,
                        patternGroups: newPatternGroups
                    };
                }
                return disc;
            })
        }));
    };

    const handleGroupFieldChange = (disciplineId, groupId, field, value) => {
        setFormData(prev => ({
            ...prev,
            disciplines: prev.disciplines.map(disc => {
                if (disc.id === disciplineId) {
                    const newPatternGroups = (disc.patternGroups || []).map(g => g.id === groupId ? { ...g, [field]: value } : g);
                    return { ...disc, patternGroups: newPatternGroups };
                }
                return disc;
            })
        }));
    };

    const handleDragEnd = (event) => {
        const { over, active } = event;
        if (!over || !pbbDiscipline) return;

        const activeType = active.data.current?.type;
        const overType = over.data.current?.type;

        const patternGroups = pbbDiscipline.patternGroups || [];

        // --- GROUP REORDERING (dragging whole Group 1, Group 2 etc.) ---
        if (activeType === 'group' && overType === 'group' && active.id !== over.id) {
            setFormData((prev) => ({
                ...prev,
                disciplines: prev.disciplines.map((disc) => {
                    if (disc.id !== pbbDiscipline.id) return disc;
                    const groups = disc.patternGroups || [];
                    const oldIndex = groups.findIndex((g) => g.id === active.id);
                    const newIndex = groups.findIndex((g) => g.id === over.id);
                    if (oldIndex === -1 || newIndex === -1) return disc;
                    return {
                        ...disc,
                        patternGroups: arrayMove(groups, oldIndex, newIndex),
                    };
                }),
            }));
            return;
        }

        // From here down we only care about division rows being dragged
        if (activeType !== 'division') return;

        const divisionToMove = active.data.current?.division;
        if (!divisionToMove) return;

        const activeContainerId = active.data.current?.sortable?.containerId;
        const overContainerId = over.data.current?.sortable?.containerId;

        // Helper: find which group (if any) a division currently belongs to
        const findGroupIdByDivisionId = (divisionId) => {
            const group = patternGroups.find((g) => g.divisions?.some((d) => d.id === divisionId));
            return group ? group.id : null;
        };

        const sourceGroupId =
            activeContainerId && activeContainerId !== UNGROUPED_ID
                ? activeContainerId
                : findGroupIdByDivisionId(active.id) || UNGROUPED_ID;

        let targetGroupId = UNGROUPED_ID;

        if (overType === 'division') {
            // Dropping on top of another division
            const viaDivisionGroupId =
                overContainerId && overContainerId !== UNGROUPED_ID
                    ? overContainerId
                    : findGroupIdByDivisionId(over.id);
            targetGroupId = viaDivisionGroupId || UNGROUPED_ID;
        } else if (overType === 'group') {
            // Dropping on a group header / empty group area
            targetGroupId = over.id;
        } else if (over.id === UNGROUPED_ID) {
            targetGroupId = UNGROUPED_ID;
        }

        // Walk-Trot Validation ONLY: WT can only mix with WT or Youth
        if (targetGroupId !== UNGROUPED_ID) {
            const targetGroup = patternGroups.find((g) => g.id === targetGroupId);

            if (targetGroup && targetGroup.divisions.length > 0) {
                const isYouth = (divName) => {
                    const lower = divName.toLowerCase();
                    return lower.includes('youth') || lower.includes('small fry') || lower.includes('leadline');
                };

                const isWt = isWalkTrotDivision(divisionToMove.division);
                const movingIsYouth = isYouth(divisionToMove.division);

                for (const groupDiv of targetGroup.divisions) {
                    const groupIsWt = isWalkTrotDivision(groupDiv.division);
                    const groupIsYouth = isYouth(groupDiv.division);

                    // If both are WT, or both are Non-WT, it's fine
                    if (isWt === groupIsWt) continue;

                    // If mixed (one WT, one Non-WT): allowed ONLY if the Non-WT one is Youth
                    const isCompatible = (isWt && groupIsYouth) || (groupIsWt && movingIsYouth);

                    if (!isCompatible) {
                        toast({
                            variant: 'destructive',
                            title: 'Invalid Grouping',
                            description: 'Walk-Trot divisions can only be grouped with other Walk-Trot divisions or Youth divisions.',
                        });
                        return;
                    }
                }

                // Go 1/Go 2 Constraint: Go 1 and Go 2 of the same class cannot be in the same pattern group
                if (divisionToMove.baseId && divisionToMove.goNumber) {
                    const hasSameBaseWithDifferentGo = targetGroup.divisions.some(d =>
                        d.baseId === divisionToMove.baseId &&
                        d.goNumber !== divisionToMove.goNumber &&
                        d.goNumber !== null
                    );
                    if (hasSameBaseWithDifferentGo) {
                        toast({
                            variant: 'destructive',
                            title: 'Invalid Grouping',
                            description: 'Go 1 and Go 2 of the same class cannot be in the same pattern group.',
                        });
                        return;
                    }
                }

                // Primary Association Validation: If 2+ associations exist AND 2+ are Primary, prevent mixing
                const allAssociations = getAllAssociationsForDiscipline();
                const primaryAssociations = getPrimaryAssociationsForDiscipline();
                if (allAssociations.length >= 2 && primaryAssociations.length >= 2) {
                    const movingAssocId = divisionToMove.assocId;
                    const targetAssocIds = new Set(targetGroup.divisions.map(d => d.assocId));
                    
                    // Check if moving division's association is Primary
                    if (primaryAssociations.includes(movingAssocId)) {
                        // If target group has divisions from a different Primary association, prevent mixing
                        const hasDifferentPrimary = Array.from(targetAssocIds).some(
                            assocId => primaryAssociations.includes(assocId) && assocId !== movingAssocId
                        );
                        
                        if (hasDifferentPrimary) {
                            toast({
                                variant: 'destructive',
                                title: 'Invalid Grouping',
                                description: 'When multiple associations are set as Primary, divisions from different Primary associations cannot be mixed in the same group.',
                            });
                            return;
                        }
                    }
                }
            }
        }

        // If nothing actually changes, bail out
        if (sourceGroupId === targetGroupId) {
            // Reorder within same group if dropped on a different division
            if (targetGroupId !== UNGROUPED_ID && overType === 'division' && active.id !== over.id) {
                setFormData((prev) => ({
                    ...prev,
                    disciplines: prev.disciplines.map((disc) => {
                        if (disc.id !== pbbDiscipline.id) return disc;
                        const groups = disc.patternGroups || [];
                        const groupIndex = groups.findIndex((g) => g.id === targetGroupId);
                        if (groupIndex === -1) return disc;
                        const group = groups[groupIndex];
                        const oldIndex = group.divisions.findIndex((d) => d.id === active.id);
                        const newIndex = group.divisions.findIndex((d) => d.id === over.id);
                        if (oldIndex === -1 || newIndex === -1) return disc;
                        const newDivisions = arrayMove(group.divisions, oldIndex, newIndex);
                        const newGroups = [...groups];
                        newGroups[groupIndex] = { ...group, divisions: newDivisions };
                        return { ...disc, patternGroups: newGroups };
                    }),
                }));
            }
            return;
        }

        // Move between containers (ungrouped <-> group, or group <-> group)
        setFormData((prev) => ({
            ...prev,
            disciplines: prev.disciplines.map((disc) => {
                if (disc.id !== pbbDiscipline.id) return disc;

                let newPatternGroups = [...(disc.patternGroups || [])];

                // 1) Remove from source group (if it currently lives in a group)
                if (sourceGroupId !== UNGROUPED_ID) {
                    const sourceIdx = newPatternGroups.findIndex((g) => g.id === sourceGroupId);
                    if (sourceIdx > -1) {
                        newPatternGroups[sourceIdx] = {
                            ...newPatternGroups[sourceIdx],
                            divisions: newPatternGroups[sourceIdx].divisions.filter(
                                (d) => d.id !== divisionToMove.id
                            ),
                        };
                    }
                }

                // 2) If target is a real group, insert there (end of list for simplicity)
                if (targetGroupId !== UNGROUPED_ID) {
                    const targetIdx = newPatternGroups.findIndex((g) => g.id === targetGroupId);
                    if (targetIdx > -1) {
                        const targetGroup = newPatternGroups[targetIdx];
                        const newDivisions = [...(targetGroup.divisions || [])];

                        // Avoid duplicates
                        if (!newDivisions.some((d) => d.id === divisionToMove.id)) {
                            newDivisions.push({
                                id: divisionToMove.id,
                                baseId: divisionToMove.baseId,
                                assocId: divisionToMove.assocId,
                                division: divisionToMove.division,
                                goNumber: divisionToMove.goNumber,
                                hasGo2: divisionToMove.hasGo2,
                            });
                        }

                        newPatternGroups[targetIdx] = { ...targetGroup, divisions: newDivisions };
                    }
                }

                return { ...disc, patternGroups: newPatternGroups };
            }),
        }));
    };

    const handleBulkMove = (disciplineId, targetGroupId) => {
        if (selectedForBulkMove.length === 0 || !pbbDiscipline) return;

        const divisionsToMove = ungroupedDivisions.filter(d => selectedForBulkMove.includes(d.id));
        const simpleDivs = divisionsToMove.map(d => ({
            id: d.id,
            baseId: d.baseId,
            assocId: d.assocId,
            division: d.division,
            goNumber: d.goNumber
        }));

        const targetGroup = pbbDiscipline.patternGroups.find(g => g.id === targetGroupId);

        // Walk-Trot Validation ONLY for Bulk Move
        if (targetGroup) {
            const isYouth = (divName) => {
                const lower = divName.toLowerCase();
                return lower.includes('youth') || lower.includes('small fry') || lower.includes('leadline');
            };

            // Check Walk-Trot: WT can only mix with WT or Youth
            const groupDivs = targetGroup.divisions;
            const allDivsToCheck = [...simpleDivs, ...groupDivs];

            const hasWt = allDivsToCheck.some(d => isWalkTrotDivision(d.division));
            const hasNonWtNonYouth = allDivsToCheck.some(d => !isWalkTrotDivision(d.division) && !isYouth(d.division));

            if (hasWt && hasNonWtNonYouth) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid Grouping',
                    description: 'Walk-Trot divisions can only be grouped with other Walk-Trot divisions or Youth divisions.',
                });
                return;
            }

            // Go 1/Go 2 Constraint: Go 1 and Go 2 of the same class cannot be in the same pattern group
            const allDivsForGoCheck = [...simpleDivs, ...targetGroup.divisions];
            const goConflict = allDivsForGoCheck.some((div, index) => {
                if (!div.baseId || div.goNumber === null) return false;
                return allDivsForGoCheck.some((other, otherIndex) =>
                    index !== otherIndex &&
                    other.baseId === div.baseId &&
                    other.goNumber !== div.goNumber &&
                    other.goNumber !== null
                );
            });
            if (goConflict) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid Grouping',
                    description: 'Go 1 and Go 2 of the same class cannot be in the same pattern group.',
                });
                return;
            }

            // Primary Association Validation: If 2+ associations exist AND 2+ are Primary, prevent mixing
            const allAssociations = getAllAssociationsForDiscipline();
            const primaryAssociations = getPrimaryAssociationsForDiscipline();
            if (allAssociations.length >= 2 && primaryAssociations.length >= 2 && targetGroup.divisions.length > 0) {
                const movingAssocIds = new Set(simpleDivs.map(d => d.assocId));
                const targetAssocIds = new Set(targetGroup.divisions.map(d => d.assocId));
                
                // Check if any moving divisions are from Primary associations
                const movingPrimaryAssocs = Array.from(movingAssocIds).filter(id => primaryAssociations.includes(id));
                
                if (movingPrimaryAssocs.length > 0) {
                    // Check if target group has divisions from a different Primary association
                    const targetPrimaryAssocs = Array.from(targetAssocIds).filter(id => primaryAssociations.includes(id));
                    const hasDifferentPrimary = movingPrimaryAssocs.some(movingAssoc => 
                        targetPrimaryAssocs.some(targetAssoc => targetAssoc !== movingAssoc)
                    );
                    
                    if (hasDifferentPrimary) {
                        toast({
                            variant: 'destructive',
                            title: 'Invalid Grouping',
                            description: 'When multiple associations are set as Primary, divisions from different Primary associations cannot be mixed in the same group.',
                        });
                        return;
                    }
                }
            }
        }

        setFormData(prev => {
            let updatedDisciplines = prev.disciplines.map(disc => {
                if (disc.id === disciplineId) {

                    let updatedGroups = disc.patternGroups.map(g => {
                        if (g.id === targetGroupId) {
                            const existingDivs = new Set(g.divisions.map(d => d.id));
                            const newDivsToAdd = simpleDivs.filter(d => !existingDivs.has(d.id));
                            return { ...g, divisions: [...g.divisions, ...newDivsToAdd] };
                        }
                        return g;
                    });

                    // Global Hierarchy Rule for WT
                    let wtGroupIndex = -1;
                    updatedGroups.forEach((g, index) => {
                        if (g.divisions.some(d => isWalkTrotDivision(d.division))) wtGroupIndex = index;
                    });
                    if (wtGroupIndex !== -1 && updatedGroups.length > 1 && wtGroupIndex < updatedGroups.length - 1) {
                        toast({ title: 'Hierarchy Rule', description: 'Walk-Trot group must be the lowest hierarchy. Reordering groups.' });
                        const wtGroup = updatedGroups.splice(wtGroupIndex, 1)[0];
                        updatedGroups.push(wtGroup);
                    }

                    return { ...disc, patternGroups: updatedGroups };
                }
                return disc;
            });
            return { ...prev, disciplines: updatedDisciplines };
        });
        setSelectedForBulkMove([]);
    };

    const handleBulkSelectChange = (divisionId, isChecked) => {
        if (isChecked) {
            setSelectedForBulkMove(prev => [...prev, divisionId]);
        } else {
            setSelectedForBulkMove(prev => prev.filter(id => id !== divisionId));
        }
    };

    const handleSelectAll = (isChecked) => {
        if (isChecked) {
            setSelectedForBulkMove(ungroupedDivisions.map(d => d.id));
        } else {
            setSelectedForBulkMove([]);
        }
    };

    // Get disciplines that have pattern groups (for duplicate groups dialog)
    const getDisciplinesWithGroups = useMemo(() => {
        return (formData.disciplines || []).filter(disc => {
            // Exclude current discipline
            if (disc.id === pbbDiscipline.id) return false;
            // Only include disciplines that have pattern groups
            const groups = disc.patternGroups || [];
            return groups.length > 0;
        });
    }, [formData.disciplines, pbbDiscipline.id]);

    // Handle duplicating groups from source discipline
    const handleDuplicateGroups = (sourceDisciplineId) => {
        if (!sourceDisciplineId) {
            toast({
                title: 'Error',
                description: 'Please select a source discipline.',
                variant: 'destructive',
            });
            return;
        }

        const sourceDiscipline = formData.disciplines?.find(d => d.id === sourceDisciplineId);
        if (!sourceDiscipline) {
            toast({
                title: 'Error',
                description: 'Source discipline not found.',
                variant: 'destructive',
            });
            return;
        }

        const sourceGroups = sourceDiscipline.patternGroups || [];
        if (sourceGroups.length === 0) {
            toast({
                title: 'No Groups to Duplicate',
                description: `"${sourceDiscipline.name}" has no pattern groups to copy.`,
            });
            return;
        }

        // Map source divisions to current discipline divisions by matching division names
        const createDivisionMapping = () => {
            const mapping = new Map();
            
            // Get all divisions from source discipline
            const sourceDivisionOrder = sourceDiscipline.divisionOrder || [];
            const currentDivisionOrder = pbbDiscipline.divisionOrder || [];
            
            // Create a map of division names to division IDs for both disciplines
            const sourceDivisionsMap = new Map();
            sourceDivisionOrder.forEach(divId => {
                const { assocId, divisionName } = parseDivisionId(divId);
                sourceDivisionsMap.set(divisionName, divId);
            });
            
            const currentDivisionsMap = new Map();
            currentDivisionOrder.forEach(divId => {
                const { assocId, divisionName } = parseDivisionId(divId);
                currentDivisionsMap.set(divisionName, divId);
            });
            
            // Map source division IDs to current division IDs by matching names
            sourceDivisionsMap.forEach((sourceDivId, divisionName) => {
                if (currentDivisionsMap.has(divisionName)) {
                    mapping.set(sourceDivId, currentDivisionsMap.get(divisionName));
                }
            });
            
            return mapping;
        };

        const divisionMapping = createDivisionMapping();

        setFormData(prev => {
            // Create a mapping of source group IDs to new group IDs
            const groupIdMapping = new Map();
            const newPatternGroups = sourceGroups.map((sourceGroup, index) => {
                const newGroupId = `pattern-group-${Date.now()}-${index}`;
                groupIdMapping.set(sourceGroup.id, newGroupId);
                
                // Map divisions from source to current discipline
                const mappedDivisions = (sourceGroup.divisions || []).map(sourceDiv => {
                    const sourceDivId = typeof sourceDiv === 'string' ? sourceDiv : (sourceDiv?.id || sourceDiv);
                    const currentDivId = divisionMapping.get(sourceDivId);
                    
                    if (currentDivId) {
                        // Parse current division ID to get assocId and division name
                        const { assocId, divisionName } = parseDivisionId(currentDivId);
                        return {
                            id: currentDivId,
                            assocId: assocId,
                            division: divisionName
                        };
                    }
                    return null;
                }).filter(Boolean); // Remove null entries

                return {
                    id: newGroupId,
                    name: sourceGroup.name || `Group ${index + 1}`,
                    divisions: mappedDivisions,
                    rulebookPatternId: sourceGroup.rulebookPatternId || '',
                };
            });

            // Copy pattern selections from source discipline
            const newPatternSelections = { ...(prev.patternSelections || {}) };
            const sourcePatternSelections = prev.patternSelections?.[sourceDisciplineId] || {};
            
            if (Object.keys(sourcePatternSelections).length > 0) {
                newPatternSelections[pbbDiscipline.id] = {};
                Object.entries(sourcePatternSelections).forEach(([sourceGroupId, selection]) => {
                    const newGroupId = groupIdMapping.get(sourceGroupId);
                    if (newGroupId && selection) {
                        // Deep copy the selection
                        newPatternSelections[pbbDiscipline.id][newGroupId] = JSON.parse(JSON.stringify(selection));
                    }
                });
            }

            return {
                ...prev,
                disciplines: prev.disciplines.map(disc => {
                    if (disc.id === pbbDiscipline.id) {
                        return {
                            ...disc,
                            patternGroups: newPatternGroups
                        };
                    }
                    return disc;
                }),
                patternSelections: newPatternSelections
            };
        });

        toast({
            title: 'Groups Duplicated',
            description: `Pattern groups copied from "${sourceDiscipline.name}".`,
        });

        setIsDuplicateGroupsDialogOpen(false);
        setSelectedSourceDisciplineId(null);
    };

    // Helper to map division to full object with Go fields
    const mapDivisionToGroupObject = (d) => ({
        id: d.id,
        baseId: d.baseId,
        assocId: d.assocId,
        division: d.division,
        goNumber: d.goNumber,
        hasGo2: d.hasGo2
    });

    const handleAutoGroup = () => {
        if (ungroupedDivisions.length === 0) {
            toast({ title: 'Nothing to group!', description: 'There are no ungrouped divisions.' });
            return;
        }

        // Get all unique associations from ungrouped divisions
        const ungroupedAssocIds = [...new Set(ungroupedDivisions.map(d => d.assocId).filter(Boolean))];
        const hasMultipleAssociations = ungroupedAssocIds.length >= 2;
        const isWtAffected = AFFECTED_CLASSES_FOR_WT_RULE.includes(pbbDiscipline.name);

        // Separate Go 1 and Go 2 divisions
        const go1Divisions = ungroupedDivisions.filter(d => d.goNumber === 1 || d.goNumber === null);
        const go2Divisions = ungroupedDivisions.filter(d => d.goNumber === 2);

        setFormData(prev => {
            const newDisciplines = prev.disciplines.map(disc => {
                if (disc.id !== pbbDiscipline.id) return disc;

                let newPatternGroups = [...(disc.patternGroups || [])].filter(g => g.divisions.length > 0);
                let nextPatternNum = newPatternGroups.length + 1;

                // Helper to create groups from a set of divisions
                const createGroupsFromDivisions = (divisions, suffix = '') => {
                    if (divisions.length === 0) return;

                    if (hasMultipleAssociations) {
                        // Multiple associations: Create separate groups per association
                        ungroupedAssocIds.forEach(assocId => {
                            const assocDivisions = divisions.filter(d => d.assocId === assocId);
                            if (assocDivisions.length === 0) return;

                            // Separate WT and non-WT for each association
                            const wtDivisions = isWtAffected
                                ? assocDivisions.filter(d => isWalkTrotDivision(d.division))
                                : [];
                            const nonWtDivisions = isWtAffected
                                ? assocDivisions.filter(d => !isWalkTrotDivision(d.division))
                                : assocDivisions;

                            if (nonWtDivisions.length > 0) {
                                newPatternGroups.push({
                                    id: `pattern-group-${Date.now()}-${assocId}-nonwt${suffix}`,
                                    name: `Group ${nextPatternNum++}`,
                                    divisions: nonWtDivisions.map(mapDivisionToGroupObject),
                                    rulebookPatternId: '',
                                });
                            }

                            if (wtDivisions.length > 0) {
                                newPatternGroups.push({
                                    id: `pattern-group-${Date.now()}-${assocId}-wt${suffix}`,
                                    name: `Group ${nextPatternNum++}`,
                                    divisions: wtDivisions.map(mapDivisionToGroupObject),
                                    rulebookPatternId: '',
                                });
                            }
                        });
                    } else {
                        // Single association: Group divisions with additional separation conditions
                        const isLevel1Division = (divisionName) => {
                            const name = divisionName?.toLowerCase() || '';
                            return name.includes('level 1') || name.includes('level1') || name.includes('l1');
                        };

                        const isWalkTrotOrSmallFry = (divisionName) => {
                            const name = divisionName?.toLowerCase() || '';
                            return name.includes('walk-trot') || name.includes('walktrot') || name.includes('walk trot') || name.includes('small fry');
                        };

                        const isGreenHorseOrNoviceAmateur = (divisionName) => {
                            const name = divisionName?.toLowerCase() || '';
                            return name.includes('green horse') || name.includes('novice amateur');
                        };

                        // Categorize divisions
                        const wtSmallFryDivisions = divisions.filter(d => isWalkTrotOrSmallFry(d.division));
                        const greenHorseNoviceDivisions = divisions.filter(d =>
                            !isWalkTrotOrSmallFry(d.division) && isGreenHorseOrNoviceAmateur(d.division)
                        );
                        const level1Divisions = divisions.filter(d =>
                            !isWalkTrotOrSmallFry(d.division) && !isGreenHorseOrNoviceAmateur(d.division) && isLevel1Division(d.division)
                        );
                        const regularDivisions = divisions.filter(d =>
                            !isWalkTrotOrSmallFry(d.division) && !isGreenHorseOrNoviceAmateur(d.division) && !isLevel1Division(d.division)
                        );

                        // Group 1: Regular divisions
                        if (regularDivisions.length > 0) {
                            newPatternGroups.push({
                                id: `pattern-group-${Date.now()}${suffix}`,
                                name: `Group ${nextPatternNum++}`,
                                divisions: regularDivisions.map(mapDivisionToGroupObject),
                                rulebookPatternId: '',
                            });
                        }

                        // Group 2: Level 1 divisions
                        if (level1Divisions.length > 0) {
                            newPatternGroups.push({
                                id: `pattern-group-${Date.now() + 1}${suffix}`,
                                name: `Group ${nextPatternNum++}`,
                                divisions: level1Divisions.map(mapDivisionToGroupObject),
                                rulebookPatternId: '',
                            });
                        }

                        // Group 3: Green Horse / Novice Amateur divisions
                        if (greenHorseNoviceDivisions.length > 0) {
                            newPatternGroups.push({
                                id: `pattern-group-${Date.now() + 2}${suffix}`,
                                name: `Group ${nextPatternNum++}`,
                                divisions: greenHorseNoviceDivisions.map(mapDivisionToGroupObject),
                                rulebookPatternId: '',
                            });
                        }

                        // Group 4: Walk-Trot / Small Fry divisions
                        if (wtSmallFryDivisions.length > 0) {
                            newPatternGroups.push({
                                id: `pattern-group-${Date.now() + 3}${suffix}`,
                                name: `Group ${nextPatternNum++}`,
                                divisions: wtSmallFryDivisions.map(mapDivisionToGroupObject),
                                rulebookPatternId: '',
                            });
                        }
                    }
                };

                // First, group Go 1 divisions (and single-go divisions)
                createGroupsFromDivisions(go1Divisions, '-go1');

                // Then, group Go 2 divisions separately
                createGroupsFromDivisions(go2Divisions, '-go2');

                return { ...disc, patternGroups: newPatternGroups };
            });
            return { ...prev, disciplines: newDisciplines };
        });

        toast({ title: 'Auto-Grouping Complete!', description: 'Divisions have been automatically grouped.' });
        if (onAutoGroupComplete) onAutoGroupComplete();
    };

    const allDivisions = useMemo(() => {
        if (!pbbDiscipline?.divisionOrder) return [];
        const result = [];
        (pbbDiscipline.divisionOrder || []).forEach(divId => {
            const goInfo = pbbDiscipline.divisionGos?.[divId] || {};
            const { assocId, divisionName } = parseDivisionId(divId);
            const customTitle = (pbbDiscipline.divisionPrintTitles && pbbDiscipline.divisionPrintTitles[divId]) || null;

            if (goInfo.hasGo2) {
                // Two-go class: create separate entries for Go 1 and Go 2
                result.push({
                    id: `${divId}-go1`,
                    baseId: divId,
                    assocId,
                    division: divisionName,
                    goNumber: 1,
                    hasGo2: true,
                    date: goInfo.go1Date || null,
                    customTitle
                });
                result.push({
                    id: `${divId}-go2`,
                    baseId: divId,
                    assocId,
                    division: divisionName,
                    goNumber: 2,
                    hasGo2: true,
                    date: goInfo.go2Date || null,
                    customTitle
                });
            } else {
                // Single-go class: one entry, no go label needed
                result.push({
                    id: divId,
                    baseId: divId,
                    assocId,
                    division: divisionName,
                    goNumber: null,
                    hasGo2: false,
                    date: goInfo.go1Date || null,
                    customTitle
                });
            }
        });
        return result;
    }, [pbbDiscipline]);

    const groupedDivisionsSet = new Set((pbbDiscipline?.patternGroups || []).flatMap(g => g.divisions.map(d => d.id)));

    const ungroupedDivisions = useMemo(() => {
        return allDivisions.filter(d => !groupedDivisionsSet.has(d.id));
    }, [allDivisions, groupedDivisionsSet]);

    const hierarchyInfoText = "Group divisions that will share the same same pattern. The order of groups determines the pattern order in your book. You can also re-order divisions within a group to set their display order in the pattern's title block.";

    if (!pbbDiscipline) {
        return <div className="text-center text-muted-foreground p-4">Loading configuration...</div>;
    }

    const patternGroups = pbbDiscipline.patternGroups || [];
    const allUngroupedSelected = ungroupedDivisions.length > 0 && selectedForBulkMove.length === ungroupedDivisions.length;

    return (
        <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter} sensors={sensors}>
            <div className="flex justify-between items-center mb-2">
                {formData?.showName && (
                    <div className="text-xs font-medium text-muted-foreground">
                        Horse Show: {formData.showName}
                    </div>
                )}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs">
                            <Info className="h-4 w-4 mr-2" /> How does this work?
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="text-sm w-80">{hierarchyInfoText}</PopoverContent>
                </Popover>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {ungroupedDivisions.length > 0 && (
                    <div ref={setUngroupedNodeRef} className={cn('lg:col-span-1 p-4 border rounded-xl bg-muted/20 transition-colors', isOverUngrouped ? 'border-primary bg-primary/10' : 'border-dashed')}>
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <Label className="font-semibold flex items-center text-base">
                                    <Undo2 className="h-5 w-5 mr-2 text-muted-foreground" />
                                    Ungrouped Divisions
                                </Label>
                                <p className="text-xs text-muted-foreground">Drag, or select and move divisions.</p>
                            </div>
                            <div className="flex gap-2">
                                {getDisciplinesWithGroups.length > 0 && (
                                    <Button 
                                        variant="secondary" 
                                        size="sm" 
                                        onClick={() => setIsDuplicateGroupsDialogOpen(true)}
                                    >
                                        <Copy className="h-4 w-4 mr-2" />
                                        Duplicate Groups
                                    </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={handleAutoGroup} disabled={ungroupedDivisions.length === 0}>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Auto-Group
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-background p-2 rounded-md mb-3">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="select-all-ungrouped"
                                    checked={allUngroupedSelected}
                                    onCheckedChange={handleSelectAll}
                                    disabled={ungroupedDivisions.length === 0}
                                />
                                <Label htmlFor="select-all-ungrouped" className="text-xs font-normal">
                                    {selectedForBulkMove.length > 0 ? `${selectedForBulkMove.length} selected` : 'Select All'}
                                </Label>
                            </div>
                            {selectedForBulkMove.length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="secondary" size="sm" className="h-8 text-xs">
                                            <Move className="h-3.5 w-3.5 mr-1.5" /> Move to...
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {patternGroups.map(group => (
                                            <DropdownMenuItem key={group.id} onSelect={() => handleBulkMove(pbbDiscipline.id, group.id)}>
                                                {group.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>

                        <div className="space-y-2 min-h-[100px] max-h-[400px] overflow-y-auto pr-2">
                            <SortableContext items={ungroupedDivisions.map(d => d.id)} id="ungrouped-list">
                                {ungroupedDivisions.map((div) => (
                                    <div key={div.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`bulk-${div.id}`}
                                            checked={selectedForBulkMove.includes(div.id)}
                                            onCheckedChange={c => handleBulkSelectChange(div.id, c)}
                                        />
                                        <div className="flex-grow">
                                            <DraggableDivision
                                                id={div.id}
                                                division={div}
                                                pbbDiscipline={pbbDiscipline}
                                                formData={formData}
                                                associationsData={associationsData}
                                                goNumber={div.goNumber}
                                                hasGo2={div.hasGo2}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </SortableContext>
                            {ungroupedDivisions.length === 0 && (
                                <div className="flex flex-col items-center justify-center text-center text-sm text-muted-foreground py-10">
                                    <Check className="h-8 w-8 text-green-500 mb-2" />
                                    <p className="font-semibold">All divisions are grouped!</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div className={cn(ungroupedDivisions.length === 0 ? 'lg:col-span-2' : 'lg:col-span-1', 'space-y-4')}>
                    <SortableContext items={patternGroups.map(g => g.id)} strategy={verticalListSortingStrategy} id="groups-container">
                        {patternGroups.map((group, index) => (
                            <DropZoneGroup
                                key={group.id}
                                group={group}
                                index={index}
                                pbbDiscipline={pbbDiscipline}
                                handleGroupFieldChange={handleGroupFieldChange}
                                handleRemovePatternGroup={handleRemovePatternGroup}
                                handleAiAssistClick={handleAiAssistClick}
                                setFormData={setFormData}
                                formData={formData}
                                associationsData={associationsData}
                                divisionsData={divisionsData}
                                hasUngroupedDivisions={ungroupedDivisions.length > 0}
                            />
                        ))}
                    </SortableContext>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleAddPatternGroup(pbbDiscipline.id)}><PlusCircle className="h-4 w-4 mr-2" />Add Pattern Group</Button>
                </div>
            </div>

            {/* Duplicate Groups Dialog */}
            <Dialog open={isDuplicateGroupsDialogOpen} onOpenChange={setIsDuplicateGroupsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Duplicate Groups From</DialogTitle>
                        <DialogDescription>
                            Select a discipline to copy all its pattern groups to "{pbbDiscipline.name.replace(' at Halter', '')}".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="source-discipline-duplicate">Source Discipline</Label>
                            <Select
                                value={selectedSourceDisciplineId || ''}
                                onValueChange={setSelectedSourceDisciplineId}
                            >
                                <SelectTrigger id="source-discipline-duplicate">
                                    <SelectValue placeholder="Select a discipline..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {getDisciplinesWithGroups.map(disc => (
                                        <SelectItem key={disc.id} value={disc.id}>
                                            {disc.name} ({disc.patternGroups?.length || 0} groups)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setIsDuplicateGroupsDialogOpen(false);
                            setSelectedSourceDisciplineId(null);
                        }}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => handleDuplicateGroups(selectedSourceDisciplineId)}
                            disabled={!selectedSourceDisciplineId}
                        >
                            Duplicate Groups
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DndContext>
    );
};
