import React, { useState, useMemo, useEffect } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { GripVertical, Loader2, Eye, ZoomIn, ZoomOut, RotateCcw, Copy } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { ClassTabs } from '@/components/pbb/ClassTabs';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

// Pattern Badge with Hover Functionality Component
const PatternBadgeWithHover = ({ patternId, displayText, formData }) => {
    const [patternImage, setPatternImage] = useState(null);
    const [patternManeuvers, setPatternManeuvers] = useState([]);
    const [imageZoom, setImageZoom] = useState(1);
    const [loading, setLoading] = useState(false);

    // Fetch pattern details when patternId changes
    useEffect(() => {
        const fetchPatternDetails = async () => {
            if (!patternId) {
                console.log('PatternBadgeWithHover: No patternId provided', { patternId, displayText });
                setPatternManeuvers([]);
                setPatternImage(null);
                setImageZoom(1);
                setLoading(false);
                return;
            }
            console.log('PatternBadgeWithHover: Fetching pattern details for patternId:', patternId);
            setLoading(true);
            setImageZoom(1);
            try {
                // OP (user-uploaded Original Patterns): skip legacy tables.
                if (typeof patternId === 'string' && patternId.startsWith('op:')) {
                    const opUuid = patternId.slice(3);
                    setPatternManeuvers([]);
                    const { data: opRow, error: opErr } = await supabase
                        .from('patterns')
                        .select('preview_image_url')
                        .eq('id', opUuid)
                        .maybeSingle();
                    if (opErr) console.error('Error fetching OP pattern image:', opErr);
                    setPatternImage(opRow?.preview_image_url || null);
                    return;
                }

                // Fetch maneuvers
                const { data: maneuversData, error: maneuversError } = await supabase
                    .from('tbl_maneuvers')
                    .select('step_no, instruction')
                    .eq('pattern_id', patternId)
                    .order('step_no');

                if (maneuversError) throw maneuversError;
                setPatternManeuvers(maneuversData || []);

                // Fetch image
                const { data: imageData, error: imageError } = await supabase
                    .from('tbl_pattern_media')
                    .select('image_url')
                    .eq('pattern_id', patternId)
                    .maybeSingle();

                if (imageError) console.error('Error fetching pattern image:', imageError);
                setPatternImage(imageData?.image_url || null);

            } catch (err) {
                console.error('Error fetching pattern details:', err);
                setPatternManeuvers([]);
                setPatternImage(null);
            } finally {
                setLoading(false);
            }
        };
        fetchPatternDetails();
    }, [patternId]);

    return (
        <HoverCard openDelay={100} closeDelay={100}>
            <HoverCardTrigger asChild>
                <span className="inline-flex items-center cursor-pointer">
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-xs whitespace-nowrap hover:bg-green-200 hover:text-green-900 transition-colors flex items-center gap-1">
                        {displayText}
                        <Eye className="h-3 w-3" />
                    </Badge>
                </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-96" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="space-y-3">
                    <h4 className="font-medium leading-none border-b pb-2">Pattern Details</h4>
                    <p className="text-xs text-muted-foreground mb-2">{displayText}</p>
                    
                    {loading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="ml-2 text-sm text-muted-foreground">Loading pattern details...</span>
                        </div>
                    ) : !patternId ? (
                        <p className="text-sm text-muted-foreground">Pattern ID not available. Please select a pattern first.</p>
                    ) : (
                        <>
                            {/* Pattern Image with Nested Hover for Larger View */}
                            {patternImage ? (
                                <div className="space-y-2">
                                    <HoverCard openDelay={200} closeDelay={100}>
                                        <HoverCardTrigger asChild>
                                            <div className="rounded-md overflow-hidden border bg-muted/20 cursor-pointer hover:border-primary transition-colors">
                                                <img 
                                                    src={patternImage} 
                                                    alt="Pattern Diagram" 
                                                    className="w-full h-auto object-contain max-h-[300px]"
                                                    loading="lazy"
                                                />
                                            </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-[700px] max-w-[95vw]" align="start" side="right" sideOffset={10}>
                                            <div className="space-y-2">
                                                <h4 className="font-medium text-sm mb-2">Pattern Image</h4>
                                                <div className="rounded-md border bg-muted/20 relative">
                                                    <div className="overflow-auto max-h-[600px] min-h-[400px]">
                                                        <div 
                                                            className="flex items-center justify-center p-4"
                                                            style={{ 
                                                                minHeight: '400px'
                                                            }}
                                                        >
                                                            <img 
                                                                src={patternImage} 
                                                                alt="Pattern Diagram - Zoomed" 
                                                                className="object-contain transition-transform duration-200"
                                                                loading="lazy"
                                                                style={{ 
                                                                    transform: `scale(${imageZoom})`,
                                                                    transformOrigin: 'center',
                                                                    maxWidth: '100%',
                                                                    height: 'auto'
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    {/* Zoom Controls */}
                                                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/95 backdrop-blur-sm rounded-md p-1 border shadow-lg z-10">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setImageZoom(prev => Math.min(prev + 0.25, 3));
                                                            }}
                                                            title="Zoom In"
                                                        >
                                                            <ZoomIn className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setImageZoom(prev => Math.max(prev - 0.25, 0.5));
                                                            }}
                                                            title="Zoom Out"
                                                        >
                                                            <ZoomOut className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setImageZoom(1);
                                                            }}
                                                            title="Reset Zoom"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    {/* Zoom Level Indicator */}
                                                    {imageZoom !== 1 && (
                                                        <div className="absolute bottom-2 left-2 bg-background/95 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium border shadow-lg z-10">
                                                            {Math.round(imageZoom * 100)}%
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </HoverCardContent>
                                    </HoverCard>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No image available for this pattern.</p>
                            )}

                            {/* Maneuvers List */}
                            <div className="text-sm text-muted-foreground max-h-[200px] overflow-y-auto">
                                {patternManeuvers.length > 0 ? (
                                    <div className="space-y-1 pl-1">
                                        {patternManeuvers.map((m) => (
                                            <div key={m.step_no} className="flex gap-2">
                                                <span className="font-semibold min-w-[20px] text-right">{m.step_no}.</span>
                                                <span>{m.instruction}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    !patternImage && <p className="text-sm text-muted-foreground">No maneuvers available for this pattern.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    );
};

const isDisciplineComplete = (pbbDiscipline, isOpenShowMode, mergedDisciplines) => {
    if (!pbbDiscipline) return false;

    const allDisciplines = mergedDisciplines && mergedDisciplines.length > 0 ? mergedDisciplines : [pbbDiscipline];

    // Complete when any discipline has divisions in divisionOrder
    return allDisciplines.some(disc => disc?.divisionOrder?.length > 0);
};


const SortableDisciplineItem = ({ pbbDiscipline, mergedDisciplines, isOpenShowMode, formData, associationsData, divisionsData, setFormData, isOpen, onDuplicate }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pbbDiscipline.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
    };
    
    // Check completion for all merged disciplines - aggregate divisions and groups across all
    const allDisciplines = mergedDisciplines || [pbbDiscipline];
    
    // Get pattern selection info for this discipline
    const patternSelectionInfo = useMemo(() => {
        const disciplineId = pbbDiscipline?.id;
        const selections = formData?.patternSelections?.[disciplineId];
        if (!selections) return null;
        
        // Find the first group with a pattern selection (check patternId or setNumber)
        const groupsWithPatterns = Object.entries(selections).filter(([_, sel]) => sel?.patternId || sel?.setNumber);
        if (groupsWithPatterns.length === 0) return null;
        
        // Get all group pattern selections with their group names
        const allPatternSelections = groupsWithPatterns.map(([groupId, sel]) => {
            const patternName = sel.patternName || '';
            // Use the actual patternName (e.g., "WesternRiding0001.L1") instead of extracting "PATTERN 1"
            // Remove .pdf extension if present
            const cleanPatternName = patternName.replace(/\.(pdf|PDF)$/, '');
            const version = sel.version || '';
            // Format: "WesternRiding0001.L1 (L1)" or just "WesternRiding0001.L1" if no version
            const displayText = version && version !== 'ALL' ? `${cleanPatternName} (${version})` : cleanPatternName;
            return {
                groupId,
                patternId: sel.patternId, // Include patternId for hover functionality
                patternName: cleanPatternName,
                version,
                displayText
            };
        });
        
        // Create display text showing all patterns
        const displayTexts = allPatternSelections.map(p => p.displayText).filter(Boolean);
        
        return {
            count: groupsWithPatterns.length,
            allPatterns: allPatternSelections,
            displayText: displayTexts.join(' | '),
            hasMultiple: displayTexts.length > 1
        };
    }, [pbbDiscipline?.id, formData?.patternSelections]);
    
    const isComplete = useMemo(() => {
        // Complete if any divisions are selected (Step 1)
        const hasAnyDivisions = allDisciplines.some(disc =>
            disc?.divisionOrder?.length > 0
        );
        return hasAnyDivisions;
    }, [allDisciplines]);

    const getDivisionCounts = () => {
        // Get associations that this discipline belongs to (from merged disciplines)
        // Prioritize selectedAssociations (what user actually selected) over association_id
        const disciplineAssocIds = new Set();
        allDisciplines.forEach(disc => {
            // First, add associations from selectedAssociations (user's explicit selection)
            if (disc.selectedAssociations) {
                Object.keys(disc.selectedAssociations).filter(id => disc.selectedAssociations[id]).forEach(id => disciplineAssocIds.add(id));
            }
            // Only add association_id if it's not already in selectedAssociations (to avoid duplicates)
            // This handles cases where selectedAssociations might be empty but association_id exists
            if (disc.association_id && (!disc.selectedAssociations || !disc.selectedAssociations[disc.association_id])) {
                disciplineAssocIds.add(disc.association_id);
            }
        });
        
        // Initialize counts with only discipline's associations (count 0 by default)
        const countsMap = {};
        disciplineAssocIds.forEach(assocId => {
            const assoc = associationsData.find(a => a.id === assocId);
            if (assoc) {
                countsMap[assocId] = {
                    id: assocId,
                    name: assoc.name || assocId,
                    abbreviation: assoc.abbreviation || assocId,
                    count: 0,
                    color: assoc.color || 'secondary'
                };
            }
        });
        
        // Aggregate division counts from all merged disciplines
        allDisciplines.forEach(disc => {
            if (!disc || !disc.divisions) return;
        
            if (isOpenShowMode) {
                const openShowDivs = disc.divisions['open-show'] || {};
                const count = Object.values(openShowDivs).reduce((acc, levels) => acc + (Array.isArray(levels) ? levels.length : 0), 0);
                if (count > 0) {
                    if (countsMap['open-show']) {
                        countsMap['open-show'].count += count;
                    } else {
                        countsMap['open-show'] = { id: 'open-show', name: 'Open Show', abbreviation: 'Open', count };
                    }
                }
            } else {
                Object.entries(disc.divisions).forEach(([assocId, assocDivs]) => {
                    const count = Object.keys(assocDivs || {}).length;
                    if (count === 0) return;
        
                    if (countsMap[assocId]) {
                        countsMap[assocId].count += count;
                    }
                });
            }
        });
        
        return Object.values(countsMap).sort((a,b) => a.name.localeCompare(b.name));
    };

    const divisionCounts = getDivisionCounts();


    // Get dual-approved info - returns which associations have dual-approved with which options
    const getDualApprovedInfo = () => {
        const dualApprovedSelections = formData.dualApprovedSelections || {};
        const dualApprovedWith = formData.subAssociationSelections?.nsba?.dualApprovedWith || [];
        const result = []; // { assocAbbrev: 'AQHA', dualWith: 'NSBA' }
        
        allDisciplines.forEach(disc => {
            // Only check if this discipline's association is in the dualApprovedWith list
            if (!dualApprovedWith.includes(disc.association_id)) return;
            
            // Include pattern_type in key to match Step2 format
            const patternType = disc.pattern_type || 'none';
            const disciplineKey = `${disc.association_id}-${disc.sub_association_type || 'none'}-${disc.name}-${patternType}`;
            const dualSelections = dualApprovedSelections[disciplineKey] || {};
            
            Object.entries(dualSelections).forEach(([dualAssocId, isSelected]) => {
                if (isSelected) {
                    const assoc = associationsData.find(a => a.id === disc.association_id);
                    const assocAbbrev = assoc?.abbreviation || disc.association_id;
                    // Check if this association is already added
                    if (!result.some(r => r.assocAbbrev === assocAbbrev && r.dualWith === dualAssocId)) {
                        result.push({ assocAbbrev, dualWith: dualAssocId });
                    }
                }
            });
        });
        
        return result;
    };
    
    const dualApprovedInfo = getDualApprovedInfo();

    // Check if this accordion is open
    const isAccordionOpen = isOpen === pbbDiscipline.id;
    
    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={cn(
                "bg-card rounded-lg border transition-all duration-300 relative overflow-hidden",
                isAccordionOpen && "border-primary",
                !isComplete && !isAccordionOpen && "border-red-500/70 shadow-lg shadow-red-500/30"
            )}
        >
            {/* Left-to-right shimmer effect for incomplete items when closed */}
            {!isComplete && !isAccordionOpen && (
                <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-red-500/30 to-transparent pointer-events-none z-0" />
            )}
            <AccordionItem value={pbbDiscipline.id} className="border-b-0">
                <AccordionTrigger className="w-full px-3 py-2 hover:no-underline">
                    <div className="flex items-center w-full gap-3">
                        <div {...attributes} {...listeners} className="cursor-grab p-1">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-grow text-left min-w-0">
                            <span className="font-semibold text-sm">{pbbDiscipline.name.replace(' at Halter', '')}</span>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {divisionCounts.map(item => (
                                    <span key={item.id} className="text-xs text-amber-600 font-medium">{item.abbreviation}</span>
                                ))}
                                {dualApprovedInfo.length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                        • <span className="text-amber-600 font-medium">{dualApprovedInfo[0].assocAbbrev}</span>
                                        {' '}Dual-Approved: <span className="text-green-600 font-medium">{dualApprovedInfo[0].dualWith}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        {/* Pattern Selection Display - Show all group patterns */}
                        {patternSelectionInfo && patternSelectionInfo.displayText && (
                            <div className="flex items-center gap-1 flex-wrap">
                                {patternSelectionInfo.allPatterns?.map((pattern, idx) => (
                                    <PatternBadgeWithHover 
                                        key={idx} 
                                        patternId={pattern.patternId} 
                                        displayText={pattern.displayText}
                                        formData={formData}
                                    />
                                ))}
                            </div>
                        )}
                        
                        <span className={`text-xs font-semibold ${isComplete ? 'text-green-600' : 'text-red-600'}`}>
                            - {isComplete ? 'complete' : 'incomplete'}
                        </span>
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Duplicate ${pbbDiscipline.name}`}
                                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-primary cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            onDuplicate?.(allDisciplines);
                                        }}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                onDuplicate?.(allDisciplines);
                                            }
                                        }}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p className="text-xs">Duplicate this discipline (divisions & groups, not dates)</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <div className="flex items-center gap-1.5 mr-2">
                            {divisionCounts.length > 0 ? (
                                divisionCounts.map(item => (
                                    <Badge 
                                        key={item.id} 
                                        variant="secondary" 
                                        className="whitespace-nowrap text-xs px-2 py-0.5 bg-sky-100 text-sky-700 border border-sky-200"
                                    >
                                        {item.abbreviation}: {item.count}
                                    </Badge>
                                ))
                            ) : (
                                <Badge variant="secondary" className="whitespace-nowrap text-xs px-2 py-0.5 bg-sky-100 text-sky-700 border border-sky-200">0 Divisions</Badge>
                            )}
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-3 border-t">
                    <ClassTabs
                        pbbDiscipline={pbbDiscipline}
                        mergedDisciplines={allDisciplines}
                        setFormData={setFormData}
                        isOpenShowMode={isOpenShowMode}
                        formData={formData}
                        associationsData={associationsData}
                        divisionsData={divisionsData}
                        isComplete={isComplete}
                        onAutoGroupComplete={() => setOpenAccordion(null)}
                    />
                </AccordionContent>
            </AccordionItem>
        </div>
    );
};

export const ClassConfiguration = ({ formData, setFormData, isOpenShowMode, associationsData, divisionsData }) => {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const [openAccordion, setOpenAccordion] = useState(null);
    const [activeDragId, setActiveDragId] = useState(null);
    const { toast } = useToast();

    const handleDragStart = (event) => {
        setActiveDragId(event.active.id);
    };

    const handleDragEnd = (event) => {
        setActiveDragId(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        if (active.id !== over.id) {
            setFormData(prev => {
                const disciplines = prev.disciplines || [];
                const oldIndex = disciplines.findIndex(c => c.id === active.id);
                const newIndex = disciplines.findIndex(c => c.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return prev;
                return { ...prev, disciplines: arrayMove(disciplines, oldIndex, newIndex) };
            });
        }
    };

    const handleDuplicateDiscipline = (mergedSources) => {
        if (!mergedSources || mergedSources.length === 0) return;

        setFormData(prev => {
            const disciplines = prev.disciplines || [];
            const patternSelections = prev.patternSelections || {};
            const dualApprovedSelections = prev.dualApprovedSelections || {};

            const sourceName = mergedSources[0].name;
            const existingNames = new Set(disciplines.map(d => d.name));
            let newName = `${sourceName} (Copy)`;
            let copyNum = 2;
            while (existingNames.has(newName)) {
                newName = `${sourceName} (Copy ${copyNum})`;
                copyNum += 1;
            }

            const buildDisciplineKey = (disc) =>
                `${disc.association_id}-${disc.sub_association_type || 'none'}-${disc.name}-${disc.pattern_type || 'none'}`;

            const baseTs = Date.now();
            const newPatternSelections = { ...patternSelections };
            const newDualApprovedSelections = { ...dualApprovedSelections };
            const newDiscEntries = mergedSources.map((src, idx) => {
                const newId = `${newName.replace(/\s+/g, '-')}-${src.association_id || 'assoc'}-${baseTs}-${idx}`;

                const groupIdMap = new Map();
                const newPatternGroups = (src.patternGroups || []).map((g, gi) => {
                    const newGroupId = `pattern-group-${baseTs}-${idx}-${gi}`;
                    groupIdMap.set(g.id, newGroupId);
                    return {
                        id: newGroupId,
                        name: g.name,
                        divisions: (g.divisions || []).map(d =>
                            typeof d === 'string' ? d : { ...d }
                        ),
                        rulebookPatternId: g.rulebookPatternId || '',
                        competitionDate: null,
                    };
                });

                const srcSelections = patternSelections[src.id];
                if (srcSelections && Object.keys(srcSelections).length > 0) {
                    const mappedSelections = {};
                    Object.entries(srcSelections).forEach(([groupId, sel]) => {
                        const newGroupId = groupIdMap.get(groupId);
                        if (newGroupId && sel) {
                            mappedSelections[newGroupId] = JSON.parse(JSON.stringify(sel));
                        }
                    });
                    if (Object.keys(mappedSelections).length > 0) {
                        newPatternSelections[newId] = mappedSelections;
                    }
                }

                const newDisc = {
                    ...src,
                    id: newId,
                    name: newName,
                    divisions: JSON.parse(JSON.stringify(src.divisions || {})),
                    divisionOrder: [...(src.divisionOrder || [])],
                    customDivisions: (src.customDivisions || []).map(cd => ({ ...cd })),
                    selectedAssociations: { ...(src.selectedAssociations || {}) },
                    patternGroups: newPatternGroups,
                    divisionPrintTitles: { ...(src.divisionPrintTitles || {}) },
                    divisionDates: {},
                    divisionGos: {},
                    duplicatedFromDisciplineId: src.id,
                };

                const srcKey = buildDisciplineKey(src);
                const destKey = buildDisciplineKey(newDisc);
                if (dualApprovedSelections[srcKey]) {
                    newDualApprovedSelections[destKey] = { ...dualApprovedSelections[srcKey] };
                }

                return newDisc;
            });

            const lastSourceIdx = Math.max(
                ...mergedSources.map(src => disciplines.findIndex(d => d.id === src.id))
            );
            const insertAt = lastSourceIdx >= 0 ? lastSourceIdx + 1 : disciplines.length;
            const nextDisciplines = [
                ...disciplines.slice(0, insertAt),
                ...newDiscEntries,
                ...disciplines.slice(insertAt),
            ];

            return {
                ...prev,
                disciplines: nextDisciplines,
                patternSelections: newPatternSelections,
                dualApprovedSelections: newDualApprovedSelections,
            };
        });

        toast({
            title: 'Discipline Duplicated',
            description: `Copied "${mergedSources[0].name}" with its divisions and groups. Dates were not copied.`,
        });
    };

    const disciplines = formData?.disciplines || [];

    // Group disciplines by name for merging display
    const groupedDisciplines = useMemo(() => {
        const groups = {};
        disciplines.forEach(disc => {
            const name = disc.name;
            if (!groups[name]) {
                groups[name] = [];
            }
            groups[name].push(disc);
        });
        return groups;
    }, [disciplines]);

    // Get unique discipline names in order (preserving first occurrence order)
    const uniqueNames = useMemo(() => {
        const seen = new Set();
        return disciplines.map(d => d.name).filter(name => {
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        });
    }, [disciplines]);

    if (!associationsData || !divisionsData) {
        return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (disciplines.length === 0) {
        return (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">No disciplines to configure.</p>
                <p className="text-sm text-muted-foreground mt-1">Go back to Step 2 to add disciplines.</p>
            </div>
        );
    }

    const activeDiscipline = activeDragId ? disciplines.find(d => d.id === activeDragId) : null;

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={disciplines.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <Accordion type="single" collapsible className="w-full space-y-1.5" value={openAccordion} onValueChange={setOpenAccordion}>
                    {uniqueNames.map(name => {
                        const mergedDisciplines = groupedDisciplines[name];
                        const primaryDiscipline = mergedDisciplines[0];

                        return (
                            <SortableDisciplineItem
                                key={primaryDiscipline.id}
                                pbbDiscipline={primaryDiscipline}
                                mergedDisciplines={mergedDisciplines}
                                isOpenShowMode={isOpenShowMode}
                                formData={formData}
                                associationsData={associationsData}
                                divisionsData={divisionsData}
                                setFormData={setFormData}
                                isOpen={openAccordion}
                                onDuplicate={handleDuplicateDiscipline}
                            />
                        );
                    })}
                </Accordion>
            </SortableContext>
            <DragOverlay>
                {activeDiscipline && (
                    <div className="p-2 border rounded-lg bg-background shadow-lg cursor-grabbing flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{activeDiscipline.name.replace(' at Halter', '')}</span>
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
};