import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { parseDivisionId } from '@/lib/showBillUtils';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, FileText, RotateCcw, Eye, ZoomIn, ZoomOut, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PatternGroupPreview from './PatternGroupPreview';
import ScoresheetGroupPreview from './ScoresheetGroupPreview';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { parseLocalDate, cn } from '@/lib/utils';
import { fetchAssociations } from '@/lib/associationsData';

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
                setPatternManeuvers([]);
                setPatternImage(null);
                setImageZoom(1);
                setLoading(false);
                return;
            }
            setLoading(true);
            setImageZoom(1);
            try {
                // OP patterns: skip legacy tables.
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
            <HoverCardContent className="w-[90vw] sm:w-96" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                                        <HoverCardContent className="w-[95vw] sm:w-[700px] max-w-[95vw]" align="start" side="right" sideOffset={10}>
                                            <div className="space-y-2">
                                                <h4 className="font-medium text-sm mb-2">Pattern Image</h4>
                                                <div className="rounded-md border bg-muted/20 relative">
                                                    <div className="overflow-auto max-h-[60vh] sm:max-h-[600px] min-h-[200px] sm:min-h-[400px]">
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

// Helper: determine display state for a pattern group
const getGroupDisplayState = (rawSelection) => {
  if (!rawSelection) return 'placeholder';
  if (typeof rawSelection === 'object' && rawSelection !== null) {
    if (rawSelection.type === 'judgeAssigned') return 'judgeAssigned';
    if (rawSelection.type === 'customRequest') return 'customRequest';
    if (rawSelection.patternId) return 'patternSelected';
    return 'placeholder';
  }
  // Primitive value (legacy number/string ID)
  if (rawSelection) return 'patternSelected';
  return 'placeholder';
};

export const Step6_Preview = ({ formData, setFormData, isEducationMode, stepNumber = 7, onGoToStep, purposeName = null, isHubMode = false }) => {
  const [availablePatterns, setAvailablePatterns] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [selectedScoresheetDetails, setSelectedScoresheetDetails] = useState({});
  const [expandedDisciplines, setExpandedDisciplines] = useState(new Set());
  const [expandedSections, setExpandedSections] = useState(new Set()); // Track which Pattern/Scoresheet sections are expanded
  const [associationsData, setAssociationsData] = useState([]);
  
  // Get all disciplines that have either patterns or scoresheets
  const allDisciplines = useMemo(() => {
    return (formData.disciplines || [])
      .filter(d => {
        // Show disciplines that have patterns OR scoresheets
        const hasPattern = d.pattern;
        const hasScoresheet = d.scoresheet || d.pattern_type === 'scoresheet_only' || (!d.pattern && d.scoresheet);
        const groups = d.patternGroups || [];
        const hasGroupsWithContent = groups.some(
          g => Array.isArray(g?.divisions) && g.divisions.length > 0
        );

        // For scoresheet-only disciplines: if no groups but has divisionOrder, we'll create groups below
        if (hasScoresheet && !hasPattern && groups.length === 0 && d.divisionOrder && d.divisionOrder.length > 0) {
          return true; // Include it, we'll create groups below
        }

        // Include disciplines with scoresheets even if no pattern groups exist
        // This handles cases where pattern preview data doesn't exist but scoresheet does
        if (hasScoresheet && groups.length === 0) {
          return true;
        }

        // Skip discipline entries whose patternGroups only contain Step 2's
        // default empty placeholder (no divisions) — otherwise a merged
        // APHA+AQHA discipline renders a phantom "Western Riding — 0 Pattern /
        // 0 Scoresheets" block alongside the real one.
        return (hasPattern || hasScoresheet) && hasGroupsWithContent;
      })
      .map(d => {
        const hasPattern = d.pattern;
        const hasScoresheet = d.scoresheet || d.pattern_type === 'scoresheet_only' || (!d.pattern && d.scoresheet);
        let groups = d.patternGroups || [];
        
        // For scoresheet-only disciplines: if no groups exist but divisions are selected, create a default group
        if (hasScoresheet && !hasPattern && groups.length === 0 && d.divisionOrder && d.divisionOrder.length > 0) {
          const divisionsFromOrder = d.divisionOrder.map(divId => {
            // Parse division ID format: "assocId-divisionName"
            const { assocId, divisionName } = parseDivisionId(divId);
            return {
              id: divId,
              assocId: assocId,
              division: divisionName
            };
          });
          
          if (divisionsFromOrder.length > 0) {
            groups = [{
              id: `group-${d.id}-default`,
              name: 'Group 1',
              divisions: divisionsFromOrder
            }];
          }
        }
        
        // For disciplines with scoresheets but no groups (pattern data doesn't exist), create a default group
        // This ensures scoresheet preview can be shown even when pattern preview is missing
        if (hasScoresheet && groups.length === 0) {
          // Create a minimal group structure for scoresheet display
          groups = [{
            id: `group-${d.id}-scoresheet-only`,
            name: 'Group 1',
            divisions: []
          }];
        }
        
        return {
          ...d,
          patternGroups: groups, // Use created groups or existing ones
          hasPattern: hasPattern,
          hasScoresheet: hasScoresheet
        };
      });
  }, [formData.disciplines]);
  
  // Keep separate lists for pattern fetching logic
  const patternDisciplines = useMemo(() => {
    return allDisciplines.filter(d => d.hasPattern);
  }, [allDisciplines]);
  
  const scoresheetDisciplines = useMemo(() => {
    return allDisciplines.filter(d => d.hasScoresheet);
  }, [allDisciplines]);

  const dateRange = formData.startDate && formData.endDate
    ? `${format(parseLocalDate(formData.startDate), 'MMM d')} - ${format(parseLocalDate(formData.endDate), 'MMM d, yyyy')}`
    : 'Dates not set';

  useEffect(() => {
    const fetchPatterns = async () => {
        setIsLoading(true);
        const allGroupKeys = patternDisciplines.flatMap((discipline, discIndex) =>
            (discipline.patternGroups || []).map((group, groupIndex) => ({
                key: `${discIndex}-${groupIndex}`,
                disciplineName: discipline.name,
                selectedAssociations: discipline.selectedAssociations
            }))
        );

        if (allGroupKeys.length === 0) {
            setIsLoading(false);
            return;
        }

        try {
            const patternPromises = allGroupKeys.map(async groupInfo => {
                const assocKeys = Object.keys(groupInfo.selectedAssociations);

                let query = supabase
                    .from('patterns')
                    .select('id, name, display_name, difficulty:pattern_set_name, url:preview_image_url, approved_associations, pattern_associations(association_id), level, pattern_identifier')
                    .eq('review_status', 'approved')
                    .or(`class_name.eq.${groupInfo.disciplineName},class_name.eq.All`);

                const { data, error } = await query;

                if (error) {
                    console.error('Error fetching patterns for', groupInfo.key, error);
                    return { key: groupInfo.key, patterns: [] };
                }

                // Filter by associations: use approved_associations if set, otherwise fall back to pattern_associations
                const filtered = (data || []).filter(pattern => {
                    if (pattern.approved_associations && pattern.approved_associations.length > 0) {
                        return assocKeys.some(key => pattern.approved_associations.includes(key));
                    }
                    const submittedAssocs = (pattern.pattern_associations || []).map(pa => pa.association_id);
                    return assocKeys.some(key => submittedAssocs.includes(key));
                });

                return { key: groupInfo.key, patterns: filtered };
            });

            const results = await Promise.all(patternPromises);
            const newAvailablePatterns = results.reduce((acc, result) => {
                acc[result.key] = result.patterns;
                return acc;
            }, {});

            setAvailablePatterns(newAvailablePatterns);
        } catch (error) {
            toast({
                title: 'Error Fetching Patterns',
                description: 'Could not load available patterns. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (patternDisciplines.length > 0) {
      fetchPatterns();
    } else {
      setIsLoading(false);
    }
  }, [JSON.stringify(patternDisciplines), toast]);
  
  // Fetch details for selected patterns from tbl_patterns (to get correct names/versions for badges)
  const [selectedPatternDetails, setSelectedPatternDetails] = useState({});

  useEffect(() => {
    const fetchSelectedPatternDetails = async () => {
        const selectedIds = [];
        if (formData.patternSelections) {
            Object.values(formData.patternSelections).forEach(disciplineSels => {
                if (disciplineSels) {
                    Object.values(disciplineSels).forEach(val => {
                        // Handle both simple ID and object format
                        const id = typeof val === 'object' ? val?.patternId : val;
                        if (id) selectedIds.push(id);
                    });
                }
            });
        }

        // De-dupe, then split into legacy numeric IDs vs OP/CAPO string IDs ("op:<uuid>")
        // so each comes from its own source table. Without this split, OP/CAPO
        // ids fail the numeric filter and the Pattern Preview renders blank.
        const allIds = [...new Set(selectedIds)];
        const numericIds = allIds.filter(id => !isNaN(parseInt(id)) && isFinite(id));
        const opIds = allIds.filter(id => typeof id === 'string' && id.startsWith('op:'));

        if (numericIds.length === 0 && opIds.length === 0) return;

        const detailsMap = {};

        try {
            if (numericIds.length > 0) {
                const { data } = await supabase
                    .from('tbl_patterns')
                    .select('id, pdf_file_name, pattern_version')
                    .in('id', numericIds);

                if (data) {
                    const [maneuversResult, mediaResult] = await Promise.all([
                        supabase.from('tbl_maneuvers').select('*').in('pattern_id', numericIds).order('step_no'),
                        supabase.from('tbl_pattern_media').select('*').in('pattern_id', numericIds)
                    ]);

                    const maneuvers = maneuversResult.data || [];
                    const media = mediaResult.data || [];

                    data.forEach(p => {
                        detailsMap[p.id] = {
                            ...p,
                            maneuvers: maneuvers.filter(m => m.pattern_id === p.id),
                            media: media.filter(m => m.pattern_id === p.id)
                        };
                    });
                }
            }

            if (opIds.length > 0) {
                const rawUuids = opIds.map(id => id.slice(3));
                const { data: opData } = await supabase
                    .from('patterns')
                    .select('id, name, original_file_name, preview_image_url, pattern_number, tags')
                    .in('id', rawUuids);

                (opData || []).forEach(p => {
                    const fullId = `op:${p.id}`;
                    detailsMap[fullId] = {
                        id: fullId,
                        pdf_file_name: p.original_file_name || p.name || 'Original Pattern',
                        pattern_version: 'ALL',
                        maneuvers: [],
                        media: p.preview_image_url
                            ? [{ id: p.id, pattern_id: fullId, image_url: p.preview_image_url, media_url: p.preview_image_url }]
                            : [],
                    };
                });
            }

            setSelectedPatternDetails(detailsMap);
        } catch (err) {
            console.error("Error fetching selected pattern details:", err);
        }
    };
    
    fetchSelectedPatternDetails();
  }, [JSON.stringify(formData.patternSelections)]);

  // Fetch scoresheet images based on selected patterns AND user-selected scoresheets
  useEffect(() => {
    const fetchScoresheetDetails = async () => {
      // Check if 4-H association is selected
      const is4HSelected = formData.associations?.['4-H'] === true || 
        formData.disciplines?.some(d => d.association_id === '4-H');
      
      // Only filter by city_state when 4-H is selected AND city is specifically Colorado
      // For 4-H with other cities (or no city), show scoresheets normally without city_state filter
      const is4HWithColorado = is4HSelected && formData.selected4HCity === 'Colorado';
      
      const selectedIds = [];
      const patternIdToDisciplineMap = {}; // Map pattern_id to discipline info
      const disciplinesNeedingScoresheet = []; // Disciplines with scoresheets but no pattern selections
      
      if (formData.patternSelections) {
        Object.entries(formData.patternSelections).forEach(([disciplineId, disciplineSels]) => {
          if (disciplineSels) {
            // Find the discipline to get association_id and name
            const discipline = formData.disciplines?.find(d => d.id === disciplineId);
            
            Object.entries(disciplineSels).forEach(([groupId, val]) => {
              const id = typeof val === 'object' ? val?.patternId : val;
              if (id) {
                selectedIds.push(id);
                // Store mapping for fallback query
                if (discipline) {
                  patternIdToDisciplineMap[id] = {
                    association_id: discipline.association_id,
                    disciplineName: discipline.name,
                    disciplineId: disciplineId
                  };
                }
              }
            });
          }
        });
      }

      // Also collect disciplines that have scoresheets but no pattern selections
      if (formData.disciplines && associationsData.length > 0) {
        formData.disciplines.forEach(discipline => {
          const hasScoresheet = discipline.scoresheet || discipline.pattern_type === 'scoresheet_only' || (!discipline.pattern && discipline.scoresheet);
          const hasPatternSelection = formData.patternSelections?.[discipline.id];
          
          // If discipline has scoresheet but no pattern selection, add it for scoresheet fetching
          if (hasScoresheet && !hasPatternSelection) {
            disciplinesNeedingScoresheet.push({
              disciplineId: discipline.id,
              association_id: discipline.association_id,
              disciplineName: discipline.name
            });
          }
        });
      }

      const uniqueIds = [...new Set(selectedIds)].filter(id => !isNaN(parseInt(id)) && isFinite(id));
      
      // Start with user-selected scoresheets from Step 2 (disciplineScoresheetSelections)
      const scoresheetMap = {};
      
      // Add user-selected scoresheets from Step 2 (e.g., Working Cow Horse)
      if (formData.disciplineScoresheetSelections) {
        Object.entries(formData.disciplineScoresheetSelections).forEach(([disciplineKey, scoresheetData]) => {
          if (scoresheetData && scoresheetData.storage_path) {
            // Store with discipline key prefix for easy lookup
            scoresheetMap[`user-selected-${disciplineKey}`] = scoresheetData;
          }
        });
      }
      
      // Add VRH-RHC Ranch CowWork scoresheets from Step 2 dropdown selection
      if (formData.vrhRanchCowWorkSelections && associationsData.length > 0) {
        for (const [disciplineKey, selectedType] of Object.entries(formData.vrhRanchCowWorkSelections)) {
          if (selectedType) {
            // Parse discipline key to get association_id and discipline name
            // Format: association_id-sub_association_type-discipline_name-pattern_type
            const parts = disciplineKey.split('-');
            if (parts.length >= 3) {
              const associationId = parts[0];
              const disciplineName = parts.slice(2, -1).join('-'); // Handle names with hyphens
              
              // Map selected type to discipline name for database query
              let queryDisciplineName = 'VRH-RHC Ranch CowWork';
              if (selectedType === 'rookie') {
                queryDisciplineName = 'VRH-RHC Ranch CowWork Rookie';
              } else if (selectedType === 'limited') {
                queryDisciplineName = 'VRH-RHC Ranch CowWork Limited';
              }
              
              // Get association abbreviation
              const association = associationsData.find(a => a.id === associationId);
              const associationAbbrev = association?.abbreviation;
              
              if (associationAbbrev) {
                try {
                  let query = supabase
                    .from('tbl_scoresheet')
                    .select('id, pattern_id, image_url, storage_path, discipline, association_abbrev')
                    .eq('association_abbrev', associationAbbrev)
                    .eq('discipline', queryDisciplineName);
                  
                  // If 4-H is selected, add city_state filter only when Colorado is selected
                  // For 4-H with other cities, don't filter by city_state (show all 4-H scoresheets)
                  if (is4HSelected && associationAbbrev === '4-H' && is4HWithColorado) {
                    query = query.eq('city_state', 'Colorado');
                  }
                  
                  // When 4-H is selected with a non-Colorado city, get the first matching scoresheet
                  // (could be any city_state or null - we don't filter)
                  const { data: scoresheetData, error: scoresheetError } = await query.limit(1).maybeSingle();
                  
                  if (!scoresheetError && scoresheetData) {
                    // Store with discipline key for lookup
                    scoresheetMap[`vrh-ranch-cowwork-${disciplineKey}`] = scoresheetData;
                  }
                } catch (err) {
                  console.error(`Error fetching VRH-RHC Ranch CowWork scoresheet for ${selectedType}:`, err);
                }
              }
            }
          }
        }
      }
      
      // Add scoresheets from patternSelections (auto-linked or manually selected)
      if (formData.patternSelections) {
        Object.entries(formData.patternSelections).forEach(([disciplineId, disciplineSels]) => {
          if (disciplineSels) {
            Object.entries(disciplineSels).forEach(([groupId, selection]) => {
              if (selection && typeof selection === 'object' && selection.scoresheetData) {
                const ssData = selection.scoresheetData;
                // Normalize: support both array and single-object format
                const sheet = Array.isArray(ssData) ? ssData[0] : ssData;
                if (sheet && sheet.image_url) {
                  scoresheetMap[`step3-selected-${disciplineId}-${groupId}`] = sheet;
                }
              }
            });
          }
        });
      }

      // Fetch scoresheets by pattern_id if we have pattern selections
      if (uniqueIds.length > 0) {
        try {
          // If 4-H and Colorado, we need to handle 4-H scoresheets separately with city_state filter
          if (is4HWithColorado) {
            // First, get 4-H scoresheets with Colorado filter
            const { data: fourHData, error: fourHError } = await supabase
              .from('tbl_scoresheet')
              .select('id, pattern_id, image_url, storage_path, association_abbrev')
              .in('pattern_id', uniqueIds)
              .eq('association_abbrev', '4-H')
              .eq('city_state', 'Colorado');
            
            // Then, get non-4-H scoresheets (no city_state filter)
            const { data: otherData, error: otherError } = await supabase
              .from('tbl_scoresheet')
              .select('id, pattern_id, image_url, storage_path, association_abbrev')
              .in('pattern_id', uniqueIds)
              .neq('association_abbrev', '4-H');
            
            const data = [...(fourHData || []), ...(otherData || [])];
            const error = fourHError || otherError;
            
            if (data && data.length > 0) {
              data.forEach(s => {
                scoresheetMap[s.pattern_id] = s;
              });
            }
          } else {
            // For all other cases (non-Colorado, non-4-H, or 4-H with other cities): show scoresheets normally
            // NO city_state filter - get all scoresheets matching pattern_id regardless of city_state
            const { data, error } = await supabase
              .from('tbl_scoresheet')
              .select('id, pattern_id, image_url, storage_path, association_abbrev, city_state')
              .in('pattern_id', uniqueIds);
            
            if (data && data.length > 0) {
              data.forEach(s => {
                scoresheetMap[s.pattern_id] = s;
              });
            }
          }
          
          // Fallback: If pattern_id query returned empty or missing data, try by association_abbrev and discipline
          const missingPatternIds = uniqueIds.filter(id => !scoresheetMap[id]);
          
          if (missingPatternIds.length > 0 && associationsData.length > 0) {
            for (const patternId of missingPatternIds) {
              const disciplineInfo = patternIdToDisciplineMap[patternId];
              if (disciplineInfo) {
                // Get association abbreviation
                const association = associationsData.find(a => a.id === disciplineInfo.association_id);
                const associationAbbrev = association?.abbreviation;
                
                if (associationAbbrev && disciplineInfo.disciplineName) {
                  try {
                    let query = supabase
                      .from('tbl_scoresheet')
                      .select('id, pattern_id, image_url, storage_path, city_state')
                      .eq('association_abbrev', associationAbbrev)
                      .eq('discipline', disciplineInfo.disciplineName);
                    
                    // If 4-H is selected, add city_state filter only when Colorado is selected
                    // For 4-H with other cities (or no city), don't filter by city_state (show all 4-H scoresheets)
                    if (is4HSelected && associationAbbrev === '4-H' && is4HWithColorado) {
                      query = query.eq('city_state', 'Colorado');
                    }
                    // When 4-H is selected with a non-Colorado city, get the first matching scoresheet
                    // (could be any city_state or null - we don't filter)
                    
                    const { data: fallbackData, error: fallbackError } = await query.limit(1).maybeSingle();
                    
                    if (!fallbackError && fallbackData) {
                      scoresheetMap[patternId] = fallbackData;
                    }
                  } catch (fallbackErr) {
                    console.error(`Error fetching fallback scoresheet for pattern ${patternId}:`, fallbackErr);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("Error fetching scoresheet details by pattern_id:", err);
        }
      }

      // Fetch scoresheets for disciplines that have scoresheets but no pattern selections
      if (disciplinesNeedingScoresheet.length > 0 && associationsData.length > 0) {
        for (const discInfo of disciplinesNeedingScoresheet) {
          // Skip if already has user-selected scoresheet
          const disciplineKey = `${discInfo.association_id}-none-${discInfo.disciplineName}-none`;
          if (scoresheetMap[`user-selected-${disciplineKey}`]) {
            continue;
          }

          // Get association abbreviation
          const association = associationsData.find(a => a.id === discInfo.association_id);
          const associationAbbrev = association?.abbreviation;
          
          if (associationAbbrev && discInfo.disciplineName) {
            try {
              let query = supabase
                .from('tbl_scoresheet')
                .select('id, pattern_id, image_url, storage_path, city_state')
                .eq('association_abbrev', associationAbbrev)
                .eq('discipline', discInfo.disciplineName);
              
              // If 4-H is selected, add city_state filter only when Colorado is selected
              // For 4-H with other cities (or no city), don't filter by city_state (show all 4-H scoresheets)
              if (is4HSelected && associationAbbrev === '4-H' && is4HWithColorado) {
                query = query.eq('city_state', 'Colorado');
              }
              // When 4-H is selected with a non-Colorado city, get the first matching scoresheet
              // (could be any city_state or null - we don't filter)
              
              const { data: fallbackData, error: fallbackError } = await query.limit(1).maybeSingle();
              
              if (!fallbackError && fallbackData) {
                // Store with discipline ID key for lookup
                scoresheetMap[`discipline-${discInfo.disciplineId}`] = fallbackData;
              }
            } catch (fallbackErr) {
              console.error(`Error fetching scoresheet for discipline ${discInfo.disciplineId}:`, fallbackErr);
            }
          }
        }
      }
      
      setSelectedScoresheetDetails(prev => ({ ...prev, ...scoresheetMap }));
    };

    fetchScoresheetDetails();
  }, [JSON.stringify(formData.patternSelections), JSON.stringify(formData.disciplineScoresheetSelections), JSON.stringify(formData.vrhRanchCowWorkSelections), JSON.stringify(formData.disciplines), formData.selected4HCity, formData.associations, associationsData]);

  // Fetch associations data
  useEffect(() => {
    const loadAssociations = async () => {
      const data = await fetchAssociations();
      setAssociationsData(data || []);
    };
    loadAssociations();
  }, []);

  // Fetch scoresheet data for scoresheet-only disciplines (use user selection from Step 2 if available)
  useEffect(() => {
    const fetchScoresheetOnlyData = async () => {
      // Check if 4-H association is selected
      const is4HSelected = formData.associations?.['4-H'] === true || 
        formData.disciplines?.some(d => d.association_id === '4-H');
      
      // Only filter by city_state when 4-H is selected AND city is specifically Colorado
      // For 4-H with other cities (or no city), show scoresheets normally without city_state filter
      const is4HWithColorado = is4HSelected && formData.selected4HCity === 'Colorado';
      
      const scoresheetOnlyDisciplines = allDisciplines.filter(d => 
        d.hasScoresheet && !d.hasPattern
      );

      if (scoresheetOnlyDisciplines.length === 0) return;

      try {
        const scoresheetMap = { ...selectedScoresheetDetails };
        
        for (const discipline of scoresheetOnlyDisciplines) {
          // Check if user has selected a scoresheet in Step 2 (via disciplineScoresheetSelections)
          const disciplineKey = `${discipline.association_id}-${discipline.sub_association_type || 'none'}-${discipline.name}-${discipline.pattern_type || 'none'}`;
          const userSelectedScoresheet = formData.disciplineScoresheetSelections?.[disciplineKey];
          
          if (userSelectedScoresheet && userSelectedScoresheet.image_url) {
            // Use user-selected scoresheet from Step 2
            scoresheetMap[`scoresheet-only-${discipline.id}`] = userSelectedScoresheet;
            continue;
          }

          // Get association abbreviation(s)
          const associationIds = discipline.mergedAssociations || [discipline.association_id];
          const associationAbbrevs = associationIds
            .map(id => associationsData?.find(a => a.id === id)?.abbreviation)
            .filter(Boolean);

          // Try multiple strategies to find scoresheet
          let scoresheetResult = null;

          // Strategy 1: Match both discipline name and first available association abbreviation
          if (associationAbbrevs.length > 0) {
            let query = supabase
              .from('tbl_scoresheet')
              .select('*')
              .ilike('discipline', `%${discipline.name}%`)
              .ilike('association_abbrev', `%${associationAbbrevs[0]}%`);
            
            // If 4-H is selected, add city_state filter only when Colorado is selected
            // For 4-H with other cities, don't filter by city_state (show all 4-H scoresheets)
            if (is4HSelected && associationAbbrevs[0] === '4-H' && is4HWithColorado) {
              query = query.eq('city_state', 'Colorado');
            }
            // When 4-H is selected with a non-Colorado city, get the first matching scoresheet
            // (could be any city_state or null - we don't filter)
            
            const { data, error } = await query.limit(1).maybeSingle();
            
            if (!error && data) {
              scoresheetResult = data;
            }
          }

          // Strategy 2: If Strategy 1 fails, try matching only discipline name
          if (!scoresheetResult) {
            let query = supabase
              .from('tbl_scoresheet')
              .select('*')
              .ilike('discipline', `%${discipline.name}%`);
            
            // If 4-H is selected, always filter by association_abbrev
            if (is4HSelected && associationAbbrevs.length > 0 && associationAbbrevs[0] === '4-H') {
              query = query.eq('association_abbrev', '4-H');
              // Only add city_state filter if Colorado is selected
              if (is4HWithColorado) {
                query = query.eq('city_state', 'Colorado');
              }
            }
            
            const { data, error } = await query.limit(1).maybeSingle();
            
            if (!error && data) {
              scoresheetResult = data;
            }
          }

          // Strategy 3: If Strategy 2 fails, try matching only association abbreviation
          if (!scoresheetResult && associationAbbrevs.length > 0) {
            let query = supabase
              .from('tbl_scoresheet')
              .select('*')
              .ilike('association_abbrev', `%${associationAbbrevs[0]}%`);
            
            // If 4-H is selected, add city_state filter only when Colorado is selected
            // For 4-H with other cities (or no city), don't filter by city_state (show all 4-H scoresheets)
            if (is4HSelected && associationAbbrevs[0] === '4-H' && is4HWithColorado) {
              query = query.eq('city_state', 'Colorado');
            }
            // When 4-H is selected with a non-Colorado city, get the first matching scoresheet
            // (could be any city_state or null - we don't filter)
            
            const { data, error } = await query.limit(1).maybeSingle();
            
            if (!error && data) {
              scoresheetResult = data;
            }
          }

          // Store scoresheet data with a key based on discipline ID
          if (scoresheetResult) {
            scoresheetMap[`scoresheet-only-${discipline.id}`] = scoresheetResult;
          }
        }

        setSelectedScoresheetDetails(prev => ({ ...prev, ...scoresheetMap }));
      } catch (err) {
        console.error('Error fetching scoresheet-only data:', err);
      }
    };

    if (associationsData.length > 0) {
      fetchScoresheetOnlyData();
    }
  }, [allDisciplines, associationsData, formData.disciplineScoresheetSelections, formData.selected4HCity, formData.associations, formData.disciplines]);
  
  const handlePatternSelectionChange = (disciplineId, groupId, newPatternId) => {
    setFormData(prev => {
      const newFormData = { ...prev };
      if (!newFormData.patternSelections) {
          newFormData.patternSelections = {};
      }
      if (!newFormData.patternSelections[disciplineId]) {
        newFormData.patternSelections[disciplineId] = {};
      }
      newFormData.patternSelections[disciplineId][groupId] = newPatternId;
      return newFormData;
    });
  };

  const handleLayoutSelection = (layoutId) => {
    setFormData(prev => ({ ...prev, layoutSelection: layoutId }));
  };
  

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Fetching available patterns...</p>
        </div>
    );
  }

  return (
    <motion.div key="step6-preview" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader>
        <CardTitle>Step {stepNumber}: {isHubMode ? 'Preview Pattern' : 'Preview'}</CardTitle>
        <CardDescription>{isHubMode ? 'Review your selected pattern and scoresheet.' : 'Review your selected patterns and scoresheets. Use the carousel to see alternatives for each group.'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Layout & Design Section — hidden in Hub mode (single pattern) */}
        {!isHubMode && <section>
          <h3 className="text-lg font-semibold mb-4">Layout & Design</h3>
          <RadioGroup
            value={formData.layoutSelection || 'layout-a'}
            onValueChange={handleLayoutSelection}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem value="layout-a" id="layout-a" className="peer sr-only" />
              <Label
                htmlFor="layout-a"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <div className="w-full space-y-2">
                  <p className="font-semibold text-center mb-2">Layout A: By Date</p>
                  <div className="w-full min-h-48 bg-gradient-to-br from-primary/20 to-primary/5 rounded-md flex flex-col items-center justify-center text-xs p-6 border border-border space-y-4">
                    <div className="text-center space-y-2 border-b pb-4 w-full">
                      <p className="font-bold text-2xl">{formData.showName || (purposeName ? `${purposeName}` : 'Show Name')}</p>
                      <p className="text-muted-foreground font-semibold">{purposeName ? `${purposeName} Patterns` : 'Pattern Book'}</p>
                      <p className="text-xs text-muted-foreground">{dateRange}</p>
                      {formData.coverPageFile && (
                        <Badge variant="outline" className="text-xs mt-2">
                          Custom Cover Uploaded
                        </Badge>
                      )}
                    </div>
                    <div className="w-full space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">Patterns:</p>
                      {patternDisciplines.slice(0, 3).map((disc, idx) => {
                        let cumulativePage = 2;
                        for (let i = 0; i < idx; i++) {
                          const prevDisc = patternDisciplines[i];
                          const prevGroupCount = (prevDisc.patternGroups || []).length;
                          cumulativePage += prevGroupCount;
                        }
                        return (
                          <div key={disc.id} className="text-xs flex justify-between">
                            <span>{disc.name}</span>
                            <span className="text-muted-foreground">Page {cumulativePage}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Includes cover page with show details
                  </p>
                </div>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="layout-b" id="layout-b" className="peer sr-only" />
              <Label
                htmlFor="layout-b"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <div className="w-full space-y-2">
                  <p className="font-semibold text-center mb-2">Layout B: By Discipline</p>
                  <div className="w-full min-h-48 border-4 border-double border-border rounded-md flex flex-col p-6 bg-background space-y-4">
                    <div className="text-center border-b-2 border-double pb-3">
                      <p className="font-bold text-xl font-serif tracking-wide">
                        {formData.showName || (purposeName ? `${purposeName}` : 'Show Name')}
                      </p>
                      <p className="text-muted-foreground italic text-sm mt-1">{purposeName ? `${purposeName} Patterns` : 'Pattern Book'}</p>
                      <p className="text-xs text-muted-foreground mt-1">{dateRange}</p>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <p className="font-bold text-sm font-serif text-center mb-2 border-b pb-1">
                        Table of Contents
                      </p>
                      <div className="flex justify-between px-2">
                        <span className="font-semibold">{purposeName ? `${purposeName}` : 'Show Structure'}</span>
                        <span>1</span>
                      </div>
                      {patternDisciplines.slice(0, 4).map((disc, idx) => {
                        let cumulativePage = 2;
                        for (let i = 0; i < idx; i++) {
                          const prevDisc = patternDisciplines[i];
                          const prevGroupCount = (prevDisc.patternGroups || []).length;
                          cumulativePage += prevGroupCount;
                        }
                        return (
                          <div
                            key={disc.id}
                            className="flex justify-between px-2 border-b border-dotted"
                          >
                            <span>{disc.name}</span>
                            <span>{cumulativePage}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Includes table of contents
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </section>}

        {/* Download Includes — Hub mode only */}
        {isHubMode && (
          <section>
            <h3 className="text-lg font-semibold mb-3">What to include</h3>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-pattern"
                  checked={formData.downloadIncludes?.pattern !== false}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    downloadIncludes: { ...prev.downloadIncludes, pattern: !!checked }
                  }))}
                />
                <Label htmlFor="include-pattern" className="cursor-pointer">Pattern</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-scoresheet"
                  checked={formData.downloadIncludes?.scoresheet !== false}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    downloadIncludes: { ...prev.downloadIncludes, scoresheet: !!checked }
                  }))}
                />
                <Label htmlFor="include-scoresheet" className="cursor-pointer">Score Sheet</Label>
              </div>
            </div>
          </section>
        )}

        {/* Disciplines Preview - Grouped by Discipline */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Preview</h3>
            {onGoToStep && (
              <Button variant="outline" size="sm" onClick={() => onGoToStep(5)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Re-assign
              </Button>
            )}
          </div>
          
          {allDisciplines.length > 0 ? (
            <div className="space-y-2">
              {allDisciplines.map((pbbDiscipline) => {
                const originalDisciplineIndex = formData.disciplines.findIndex(d => d.id === pbbDiscipline.id);
                // Only count groups that have divisions assigned (exclude empty placeholder groups)
                const groups = (pbbDiscipline.patternGroups || []).filter(g => g.divisions && g.divisions.length > 0);
                const groupCount = groups.length;
                const isDisciplineExpanded = expandedDisciplines.has(pbbDiscipline.id);
                
                // Get pattern selections for badges
                const disciplinePatternSelections = [];
                groups.forEach((group) => {
                  let rawSelection = formData.patternSelections?.[pbbDiscipline.id]?.[group.id];
                  if (!rawSelection && groups.length === 1) {
                    const discSels = formData.patternSelections?.[pbbDiscipline.id];
                    if (discSels) { const fk = Object.keys(discSels)[0]; if (fk) rawSelection = discSels[fk]; }
                  }
                  const state = getGroupDisplayState(rawSelection);
                  if (state === 'judgeAssigned') {
                    disciplinePatternSelections.push({
                      patternId: null,
                      displayText: `Judge: ${rawSelection?.judgeName || 'TBD'}`,
                      type: 'judgeAssigned'
                    });
                  } else if (state === 'customRequest') {
                    disciplinePatternSelections.push({
                      patternId: null,
                      displayText: 'Custom Pattern',
                      type: 'customRequest'
                    });
                  } else {
                    const selectedId = typeof rawSelection === 'object' ? rawSelection?.patternId : rawSelection;
                    if (selectedId && selectedPatternDetails[selectedId]) {
                      const patternDetail = selectedPatternDetails[selectedId];
                      const patternName = patternDetail.pdf_file_name || '';
                      const cleanPatternName = patternName.replace(/\.(pdf|PDF)$/, '');
                      const version = patternDetail.pattern_version || '';
                      const displayText = version && version !== 'ALL' ? `${cleanPatternName} (${version})` : cleanPatternName;
                      disciplinePatternSelections.push({
                        patternId: selectedId,
                        displayText
                      });
                    }
                  }
                });
                
                // Section keys for nested accordion
                const patternSectionKey = `${pbbDiscipline.id}-pattern`;
                const scoresheetSectionKey = `${pbbDiscipline.id}-scoresheet`;
                const isPatternExpanded = expandedSections.has(patternSectionKey);
                const isScoresheetExpanded = expandedSections.has(scoresheetSectionKey);
                
                return (
                  <div key={pbbDiscipline.id} className={cn(
                    "border rounded-lg bg-muted/30 overflow-hidden transition-all duration-300",
                    isDisciplineExpanded && "border-primary"
                  )}>
                    {/* Discipline Header */}
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedDisciplines(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(pbbDiscipline.id)) {
                            newSet.delete(pbbDiscipline.id);
                          } else {
                            newSet.add(pbbDiscipline.id);
                          }
                          return newSet;
                        });
                      }}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="font-semibold text-base text-primary">{pbbDiscipline.name.replace(' at Halter', '')}</span>
                        {pbbDiscipline.hasScoresheet && !pbbDiscipline.hasPattern && (
                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                            (Scoresheet Only)
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 flex-wrap flex-1">
                          {disciplinePatternSelections.map((sel, idx) => (
                            sel.type === 'judgeAssigned' ? (
                              <Badge key={idx} className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{sel.displayText}</Badge>
                            ) : sel.type === 'customRequest' ? (
                              <Badge key={idx} className="bg-purple-100 text-purple-800 border-purple-200 text-xs">{sel.displayText}</Badge>
                            ) : (
                              <PatternBadgeWithHover
                                key={idx}
                                patternId={sel.patternId}
                                displayText={sel.displayText}
                                formData={formData}
                              />
                            )
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {isDisciplineExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    
                    {/* Expanded Discipline Content - Nested Pattern and Scoresheet Sections */}
                    {isDisciplineExpanded && (
                      <div className="px-2 sm:px-4 py-3 sm:py-4 border-t bg-background/50 space-y-3">
                        {/* Pattern Preview Section */}
                        {pbbDiscipline.hasPattern && (!isHubMode || formData.downloadIncludes?.pattern !== false) && (
                          <div className="border rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedSections(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(patternSectionKey)) {
                                    newSet.delete(patternSectionKey);
                                  } else {
                                    newSet.add(patternSectionKey);
                                  }
                                  return newSet;
                                });
                              }}
                              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">Pattern Preview</span>
                                <Badge variant="secondary" className="text-xs">
                                  {groups.filter(g => {
                                    const rawSelection = formData.patternSelections?.[pbbDiscipline.id]?.[g.id];
                                    const selectedId = typeof rawSelection === 'object' ? rawSelection?.patternId : rawSelection;
                                    return selectedId;
                                  }).length > 0 ? `${groups.length} Patterns` :  `${groups.length} Pattern`}
                                </Badge>
                              </div>
                              {isPatternExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            {isPatternExpanded && (
                              <div className="px-4 py-4 border-t bg-background/30">
                                <div className="space-y-6">
                                  {groups.map((group, groupIndex) => {
                                    const groupKey = `${originalDisciplineIndex}-${groupIndex}`;
                                    const groupPatterns = availablePatterns[groupKey] || [];
                                    // Try exact group.id match first; for single-group disciplines
                                    // fall back to first available selection (group IDs may differ
                                    // between auto-grouping runs)
                                    let rawSelection = formData.patternSelections?.[pbbDiscipline.id]?.[group.id];
                                    if (!rawSelection && groups.length === 1) {
                                      const discSelections = formData.patternSelections?.[pbbDiscipline.id];
                                      if (discSelections) {
                                        const firstKey = Object.keys(discSelections)[0];
                                        if (firstKey) rawSelection = discSelections[firstKey];
                                      }
                                    }
                                    const displayState = getGroupDisplayState(rawSelection);
                                    const selectedId = displayState === 'patternSelected'
                                      ? (typeof rawSelection === 'object' ? rawSelection?.patternId : rawSelection)
                                      : null;
                                    return (
                                      <div key={group.id}>
                                        {displayState === 'judgeAssigned' ? (
                                          <div className="p-4 border-2 border-dashed border-amber-300 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 text-center">
                                            <p className="text-amber-800 dark:text-amber-300 font-medium">
                                              Pattern to be selected by Judge: {rawSelection?.judgeName || 'TBD'}
                                            </p>
                                            {group.divisions && group.divisions.length > 0 && (
                                              <div className="flex flex-wrap gap-1 justify-center mt-2">
                                                {group.divisions.map(div => (
                                                  <Badge key={div.id} variant="secondary" className="text-xs">{div.division}</Badge>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ) : displayState === 'customRequest' ? (
                                          <div className="p-4 border-2 border-dashed border-purple-300 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 text-center">
                                            {rawSelection?.uploadedFileUrl ? (
                                              <>
                                                {rawSelection.uploadedFileType?.startsWith('image/') ? (
                                                  <img
                                                    src={rawSelection.uploadedFileUrl}
                                                    alt="Custom pattern"
                                                    className="w-full max-h-64 object-contain rounded mb-2"
                                                  />
                                                ) : (
                                                  <div className="flex items-center justify-center gap-2 p-3 mb-2 bg-white dark:bg-slate-800 rounded">
                                                    <FileText className="h-8 w-8 text-red-500" />
                                                    <div className="text-left">
                                                      <p className="text-sm font-medium">{rawSelection.uploadedFileName}</p>
                                                      <p className="text-xs text-muted-foreground">PDF Document</p>
                                                    </div>
                                                  </div>
                                                )}
                                                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Custom Pattern Uploaded</Badge>
                                              </>
                                            ) : (
                                              <>
                                                <p className="text-purple-800 dark:text-purple-300 font-medium">
                                                  {rawSelection?.requestStatus === 'email_sent'
                                                    ? 'Custom Pattern — Request Sent'
                                                    : 'Custom Pattern — Awaiting Upload'}
                                                </p>
                                                {rawSelection?.requestedFromName && (
                                                  <p className="text-sm text-muted-foreground mt-1">From: {rawSelection.requestedFromName}{rawSelection.requestedFromEmail ? ` (${rawSelection.requestedFromEmail})` : ''}</p>
                                                )}
                                                {(rawSelection?.requestNotes || rawSelection?.requestNote) && (
                                                  <p className="text-sm text-muted-foreground mt-1">Note: {rawSelection.requestNotes || rawSelection.requestNote}</p>
                                                )}
                                              </>
                                            )}
                                            {group.divisions && group.divisions.length > 0 && (
                                              <div className="flex flex-wrap gap-1 justify-center mt-2">
                                                {group.divisions.map(div => (
                                                  <Badge key={div.id} variant="secondary" className="text-xs">{div.division}</Badge>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ) : displayState === 'placeholder' ? (
                                          <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50/50 dark:bg-slate-900/20 text-center">
                                            <p className="text-slate-500 dark:text-slate-400 font-medium">
                                              Pattern Coming Soon
                                            </p>
                                            {group.divisions && group.divisions.length > 0 && (
                                              <div className="flex flex-wrap gap-1 justify-center mt-2">
                                                {group.divisions.map(div => (
                                                  <Badge key={div.id} variant="secondary" className="text-xs">{div.division}</Badge>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <PatternGroupPreview
                                            group={group}
                                            patterns={groupPatterns}
                                            selectedPatternId={selectedId}
                                            selectedPatternDetail={selectedPatternDetails[selectedId]}
                                            onPatternSelect={(newPatternId) => handlePatternSelectionChange(pbbDiscipline.id, group.id, newPatternId)}
                                            primaryAffiliates={new Set(formData.primaryAffiliates || [])}
                                          />
                                        )}
                                        {isEducationMode && formData.lessonPlans && formData.lessonPlans.length > 0 && (
                                          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                            <h5 className="font-semibold text-sm mb-2 text-blue-800 dark:text-blue-300">Associated Lesson Plans</h5>
                                            <div className="flex flex-wrap gap-2">
                                              {(formData.lessonPlans || []).map((plan, index) => (
                                                <Badge key={index} variant="outline" className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-600">
                                                  <FileText className="h-3 w-3" />
                                                  {plan.customName || plan.fileName}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Scoresheet Preview Section */}
                        {pbbDiscipline.hasScoresheet && (!isHubMode || formData.downloadIncludes?.scoresheet !== false) && (
                          <div className="border rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedSections(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(scoresheetSectionKey)) {
                                    newSet.delete(scoresheetSectionKey);
                                  } else {
                                    newSet.add(scoresheetSectionKey);
                                  }
                                  return newSet;
                                });
                              }}
                              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">Scoresheet Preview</span>
                                <Badge variant="secondary" className="text-xs">
                                  {groups.length} {groups.length === 1 ? 'Scoresheet' : 'Scoresheets'}
                                </Badge>
                              </div>
                              {isScoresheetExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            {isScoresheetExpanded && (
                              <div className="px-4 py-4 border-t bg-background/30">
                                <div className="space-y-6">
                                  {groups.map((group, groupIndex) => {
                                    // Check if this group is a custom pattern request
                                    let rawSelection = formData.patternSelections?.[pbbDiscipline.id]?.[group.id];
                                    if (!rawSelection && groups.length === 1) {
                                      const discSels = formData.patternSelections?.[pbbDiscipline.id];
                                      if (discSels) { const fk = Object.keys(discSels)[0]; if (fk) rawSelection = discSels[fk]; }
                                    }
                                    const isCustomRequest = rawSelection?.type === 'customRequest';

                                    if (isCustomRequest) {
                                      // Render generic scoresheet preview for custom pattern requests
                                      const divisions = (group.divisions || []).map(div => {
                                        const name = div.division || '';
                                        let cleaned = name.replace(/^[^\s-]+\s*[-–—]\s*/, '').trim();
                                        cleaned = cleaned.replace(/^(Pro|Non-Pro)\s*[-–—]?\s*/i, '').trim();
                                        if (cleaned === name) {
                                          const parts = name.split(/\s+/);
                                          if (parts.length > 1) cleaned = parts.slice(1).join(' ');
                                        }
                                        return cleaned || name;
                                      });

                                      return (
                                        <div key={group.id} className="border border-slate-700 rounded-lg p-4 bg-slate-900/30">
                                          <div className="mb-2">
                                            {groups.length > 1 && <p className="font-semibold">{group.name}</p>}
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {divisions.map((d, i) => (
                                                <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>
                                              ))}
                                            </div>
                                          </div>

                                          <div className="p-1 max-w-sm mx-auto">
                                            <div className="overflow-hidden rounded-lg bg-slate-900 border border-slate-700">
                                              {/* Generic scoresheet visual */}
                                              <div className="p-4 bg-white dark:bg-slate-800 space-y-2">
                                                <p className="text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Score Sheet</p>
                                                <p className="text-center text-[10px] text-slate-500 dark:text-slate-400">{pbbDiscipline.name.replace(' at Halter', '')}</p>
                                                {/* Mini 3x5 grid */}
                                                <div className="grid grid-cols-3 gap-1 px-2">
                                                  {Array.from({ length: 15 }, (_, i) => (
                                                    <div key={i} className="border border-slate-300 dark:border-slate-600 rounded-sm h-6 flex items-center justify-center">
                                                      <span className="text-[8px] text-slate-400">{i + 1}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                                <div className="flex gap-1 px-2">
                                                  <div className="flex-1 border border-slate-300 dark:border-slate-600 rounded-sm h-5 flex items-center px-1">
                                                    <span className="text-[7px] text-slate-400">Penalties</span>
                                                  </div>
                                                  <div className="flex-1 border border-slate-300 dark:border-slate-600 rounded-sm h-5 flex items-center px-1">
                                                    <span className="text-[7px] text-slate-400">Total</span>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Badge footer */}
                                              <div className="p-3 border-t border-slate-700 text-center space-y-1">
                                                <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700 text-[10px]">
                                                  Custom Pattern Requested – Generic Scoresheet Active
                                                </Badge>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }

                                    // --- Standard scoresheet lookup ---
                                    // For scoresheet-only disciplines, use discipline ID as key
                                    // For pattern disciplines, use pattern ID OR user-selected scoresheet
                                    const isScoresheetOnly = pbbDiscipline.hasScoresheet && !pbbDiscipline.hasPattern;
                                    let scoresheetData = null;

                                    // Priority 1: Check if scoresheet was selected in Step 3 (per group)
                                    const step3Scoresheet = selectedScoresheetDetails[`step3-selected-${pbbDiscipline.id}-${group.id}`];
                                    if (step3Scoresheet) {
                                      scoresheetData = step3Scoresheet;
                                    } else {
                                      // Priority 2: Check if VRH-RHC Ranch CowWork was selected in Step 2
                                      const disciplineKey = `${pbbDiscipline.association_id}-${pbbDiscipline.sub_association_type || 'none'}-${pbbDiscipline.name}-${pbbDiscipline.pattern_type || 'none'}`;
                                      const vrhRanchCowWorkScoresheet = selectedScoresheetDetails[`vrh-ranch-cowwork-${disciplineKey}`];

                                      if (vrhRanchCowWorkScoresheet) {
                                        // Use VRH-RHC Ranch CowWork scoresheet from Step 2 dropdown
                                        scoresheetData = vrhRanchCowWorkScoresheet;
                                      } else {
                                        // Priority 3: Check if user has selected a scoresheet for this discipline in Step 2
                                        const userSelectedScoresheet = selectedScoresheetDetails[`user-selected-${disciplineKey}`];

                                        if (userSelectedScoresheet) {
                                          // Use user-selected scoresheet (e.g., for Working Cow Horse)
                                          scoresheetData = userSelectedScoresheet;
                                        } else if (isScoresheetOnly) {
                                          // Use discipline ID key for scoresheet-only
                                          scoresheetData = selectedScoresheetDetails[`scoresheet-only-${pbbDiscipline.id}`] || null;
                                        } else {
                                          // For pattern disciplines, try pattern selection first
                                          const selectedPatternId = typeof rawSelection === 'object' ? rawSelection?.patternId : rawSelection;

                                          if (selectedPatternId) {
                                            // Try to get scoresheet by pattern_id
                                            scoresheetData = selectedScoresheetDetails[selectedPatternId] || null;
                                          }

                                          // Fallback: If pattern_id lookup failed or no pattern selected, try discipline-based lookup
                                          // This handles cases where pattern preview data doesn't exist but scoresheet does
                                          if (!scoresheetData) {
                                            scoresheetData = selectedScoresheetDetails[`discipline-${pbbDiscipline.id}`] || null;
                                          }
                                        }
                                      }
                                    }

                                    return (
                                      <ScoresheetGroupPreview
                                        key={group.id}
                                        group={group}
                                        scoresheets={group.scoresheets || []}
                                        discipline={pbbDiscipline}
                                        formData={formData}
                                        scoresheetImage={scoresheetData}
                                        hideGroupName={groups.length === 1}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">No disciplines to preview.</p>
            </div>
          )}
        </section>

      </CardContent>
    </motion.div>
  );
};