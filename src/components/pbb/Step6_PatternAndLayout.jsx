import React, { useState, useRef, useEffect } from 'react';
import { parseDivisionId } from '@/lib/showBillUtils';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronDown, MapPin, Building, CheckCircle2, AlertCircle, Trophy, Eye, X, ZoomIn, ZoomOut, RotateCcw, Loader2, ChevronRight, UploadCloud, FileText, Image as ImageIcon, Trash2, ListPlus } from 'lucide-react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { cn, parseLocalDate } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import PatternPagePreview from './PatternPagePreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid';

// Judge Assignment Field — select from existing judges or type custom
const JudgeAssignmentField = ({ disciplineName, currentValue, onValueChange, formData, isReadOnly }) => {
  const [isCustom, setIsCustom] = useState(false);

  const judges = new Map();
  Object.values(formData.associationJudges || {})
    .flatMap(assocData => (assocData.judges || []))
    .filter(j => j?.name)
    .forEach(j => judges.set(j.name, j.name));
  Object.values(formData.showDetails?.officials || {})
    .flatMap(assocRoles => assocRoles?.JUDGE || [])
    .filter(j => j?.name)
    .forEach(j => judges.set(j.name, j.name));
  Object.values(formData.showDetails?.judges || {})
    .flat()
    .filter(j => j?.name)
    .forEach(j => judges.set(j.name, j.name));
  const judgeNames = [...judges.values()];

  // If current value is custom (not in the list), show input
  const isCustomValue = currentValue && !judgeNames.includes(currentValue);

  return (
    <div className="p-3 border-2 border-dashed border-amber-300 rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
      <Label className="text-xs text-muted-foreground mb-1 block">Assigned Judge for {disciplineName}</Label>
      {judgeNames.length > 0 && !isCustom && !isCustomValue ? (
        <div className="space-y-2">
          <Select
            value={currentValue}
            onValueChange={onValueChange}
            disabled={isReadOnly}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select a judge..." />
            </SelectTrigger>
            <SelectContent>
              {judgeNames.map((name, idx) => (
                <SelectItem key={idx} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
            onClick={() => setIsCustom(true)}
            disabled={isReadOnly}
          >
            + Enter custom judge name
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            placeholder="Type judge name..."
            value={currentValue}
            onChange={(e) => onValueChange(e.target.value)}
            disabled={isReadOnly}
            className="bg-background"
          />
          {judgeNames.length > 0 && (
            <button
              type="button"
              className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
              onClick={() => { setIsCustom(false); onValueChange(''); }}
              disabled={isReadOnly}
            >
              Select from existing judges
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
        Pattern will be selected by the assigned judge for all classes in this discipline.
      </p>
    </div>
  );
};

// Pattern Badge with Hover Functionality Component
const PatternBadgeWithHover = ({ patternId, displayText, formData, scoresheetData }) => {
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
                // OP (user-uploaded Original Patterns) use a different data source:
                // no tbl_maneuvers entry, image comes from patterns.preview_image_url.
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
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-xs hover:bg-green-200 hover:text-green-900 transition-colors flex items-center gap-1">
                        <span className="whitespace-normal break-words">{displayText}</span>
                        <Eye className="h-3 w-3 flex-shrink-0" />
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
                                                    style={{ clipPath: 'inset(0 0 12% 0)' }}
                                                    loading="lazy"
                                                />
                                            </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-[95vw] sm:w-[700px] max-w-[95vw]" align="start" side="right" sideOffset={10}>
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
                                                                    height: 'auto',
                                                                    clipPath: 'inset(0 0 12% 0)'
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

                            {/* Score Sheet Preview(s) inside pattern hover card */}
                            {(() => {
                                if (!scoresheetData) return null;
                                const sheets = Array.isArray(scoresheetData) ? scoresheetData : (scoresheetData.image_url ? [scoresheetData] : []);
                                if (sheets.length === 0) return null;
                                return (
                                    <div className="space-y-2 border-t pt-2">
                                        <h4 className="font-medium text-sm text-emerald-700 dark:text-emerald-400">Score Sheets</h4>
                                        {sheets.map((sheet, idx) => (
                                            <div key={sheet.id || idx} className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">{sheet.displayName || `Score Sheet ${idx + 1}`}</p>
                                                <div className="rounded-md overflow-hidden border bg-muted/20">
                                                    <img
                                                        src={sheet.image_url}
                                                        alt={sheet.displayName || 'Score Sheet'}
                                                        className="w-full h-auto object-contain max-h-[250px]"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    );
};

// Level category badge colors (kept for reference)
// Pattern version categories (Standardized)
const PATTERN_VERSIONS = [
  { id: 'ALL', label: 'All', color: 'bg-blue-100 text-blue-800', dotColor: 'bg-blue-500' },
  { id: 'L1', label: 'L1', color: 'bg-green-100 text-green-800', dotColor: 'bg-green-500' },
  { id: 'GR/NOV', label: 'Green / Novice', color: 'bg-teal-100 text-teal-800', dotColor: 'bg-teal-500' },
  { id: 'Championship', label: 'Championship', color: 'bg-yellow-100 text-yellow-800', dotColor: 'bg-yellow-500' },
  { id: 'Skilled', label: 'Skilled', color: 'bg-indigo-100 text-indigo-800', dotColor: 'bg-indigo-500' },
  { id: 'Intermediate', label: 'Intermediate', color: 'bg-orange-100 text-orange-800', dotColor: 'bg-orange-500' },
  { id: 'Beginner', label: 'Beginner', color: 'bg-purple-100 text-purple-800', dotColor: 'bg-purple-500' },
  { id: 'Walk-Trot', label: 'Walk-Trot', color: 'bg-pink-100 text-pink-800', dotColor: 'bg-pink-500' },
];

export const Step6_PatternAndLayout = ({ formData, setFormData, associationsData = [], stepNumber = 5, isReadOnly = false, isClinicMode = false, isHubMode = false }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [openDisciplineId, setOpenDisciplineId] = useState(null);
  const disciplineRefs = useRef({});
  const [previewDiscipline, setPreviewDiscipline] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [uploadingCustomPattern, setUploadingCustomPattern] = useState(null); // track which group is uploading

  // Database-driven pattern state
  const [dbPatterns, setDbPatterns] = useState({});
  const [loadingPatterns, setLoadingPatterns] = useState({});
  const [maneuversRangeMap, setManeuversRangeMap] = useState({});
  // New state for "Reference" style selection
  const [disciplineSelections, setDisciplineSelections] = useState({}); // { [disciplineId]: { difficulty: ['ALL'] } }
  
  // State for hover functionality
  const [hoveredPatternId, setHoveredPatternId] = useState(null);
  const [hoveredPatternImage, setHoveredPatternImage] = useState(null);
  const [loadingHoveredImage, setLoadingHoveredImage] = useState(false);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  
  // Filter and sort state for Discipline Folders
  const [filters, setFilters] = useState({
    incomplete: true,
    completed: true,
    patternsAssigned: false
  });
  const [sortBy, setSortBy] = useState('name');
  const [showAllDisciplines, setShowAllDisciplines] = useState(false);
  const [isDisciplineFoldersOpen, setIsDisciplineFoldersOpen] = useState(true);
  const [isDisciplineConfigOpen, setIsDisciplineConfigOpen] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [dialogDueDate, setDialogDueDate] = useState('');
  const [currentDiscipline, setCurrentDiscipline] = useState(null);

  // Sync maneuversRangeMap from formData.patternSelections on mount
  useEffect(() => {
    if (formData.patternSelections) {
      const newMap = {};
      Object.keys(formData.patternSelections).forEach(disciplineId => {
        const disciplineSelections = formData.patternSelections[disciplineId];
        if (disciplineSelections && typeof disciplineSelections === 'object') {
          // Collect unique maneuversRange from ALL groups to ensure we don't miss any if they differ
          const allRanges = new Set();
          Object.values(disciplineSelections).forEach(selection => {
            const val = selection?.maneuversRange;
            if (Array.isArray(val)) {
              val.forEach(v => allRanges.add(v));
            } else if (val && typeof val === 'string') {
              allRanges.add(val);
            }
          });
          
          if (allRanges.size > 0) {
            newMap[disciplineId] = Array.from(allRanges);
          }
        }
      });
      setManeuversRangeMap(prev => ({ ...prev, ...newMap }));
    }
  }, [formData.patternSelections]);

  // Get disciplines with patterns OR scoresheet-only and merge duplicates by name
  const rawPatternDisciplines = (formData.disciplines || []).filter(d => {
    // Include disciplines with patterns
    if (d.pattern) return true;
    // Include scoresheet-only disciplines
    if (d.pattern_type === 'scoresheet_only' || (!d.pattern && d.scoresheet)) return true;
    return false;
  });
  
  // Merge disciplines with the same name and filter out empty groups
  const patternDisciplines = rawPatternDisciplines.reduce((acc, discipline) => {
    const existingIndex = acc.findIndex(d => d.name === discipline.name);
    
    // Check if this is a scoresheet-only discipline
    const isScoresheetOnly = discipline.pattern_type === 'scoresheet_only' || (!discipline.pattern && discipline.scoresheet);
    
    // Filter out groups that don't have actual divisions/content
    let validGroups = (discipline.patternGroups || []).filter(group =>
      group.divisions && group.divisions.length > 0
    );

    // If no groups have divisions, create a default group from divisionOrder if available
    if (validGroups.length === 0 && discipline.divisionOrder && discipline.divisionOrder.length > 0) {
      const divisionsFromOrder = discipline.divisionOrder.map(divId => {
        const { assocId, divisionName } = parseDivisionId(divId);
        return {
          id: divId,
          assocId: assocId,
          division: divisionName
        };
      });

      if (divisionsFromOrder.length > 0) {
        validGroups = [{
          id: `group-${discipline.id}-default`,
          name: 'Group 1',
          divisions: divisionsFromOrder
        }];
      }
    }

    // If still no valid groups but original groups exist, keep them so patterns can be assigned
    if (validGroups.length === 0) {
      const originalGroups = discipline.patternGroups || [];
      if (originalGroups.length > 0) {
        validGroups = originalGroups;
      }
    }
    
    if (existingIndex === -1) {
      // First occurrence - add to array with filtered groups
      // Preserve isCustom and pattern_type properties
      acc.push({ 
        ...discipline, 
        patternGroups: validGroups,
        isCustom: discipline.isCustom || discipline.pattern_type === 'custom',
        pattern_type: discipline.pattern_type || 'none'
      });
    } else {
      // Merge patternGroups from duplicate into existing
      const existing = acc[existingIndex];
      const existingGroups = existing.patternGroups || [];
      existing.patternGroups = [...existingGroups, ...validGroups];
      // Preserve isCustom property if either discipline is custom
      existing.isCustom = existing.isCustom || discipline.isCustom || discipline.pattern_type === 'custom';
      // Preserve pattern_type if it's custom
      if (discipline.pattern_type === 'custom') {
        existing.pattern_type = 'custom';
      }
      // Also merge association IDs if needed
      if (!existing.mergedAssociations) {
        existing.mergedAssociations = [existing.association_id];
      }
      existing.mergedAssociations.push(discipline.association_id);
      
    }
    return acc;
  }, []);
  
  // Get selected associations from formData
  const selectedAssociations = associationsData.filter(
    assoc => formData.associations?.[assoc.id]
  );

  // Fetch patterns from database for a discipline (fetch ALL patterns, filter by group associations later)
  const fetchPatternsForDiscipline = async (discipline) => {
    if (!discipline?.name) return;
    const disciplineId = discipline.id;
    
    if (loadingPatterns[disciplineId] || dbPatterns[disciplineId]) return;
    
    setLoadingPatterns(prev => ({ ...prev, [disciplineId]: true }));
    
    try {
      // Check if this is an open-show discipline
      const isOpenShowDiscipline = discipline?.selectedAssociations?.['open-show'] || 
                                   discipline?.association_id === 'open-show';
      
      let query = supabase
        .from('tbl_patterns')
        .select('id, pdf_file_name, maneuvers_range, pattern_version, discipline, association_name');
      
      // For open-show disciplines, fetch ALL patterns (no discipline filter)
      // For other disciplines, filter by discipline name
      if (!isOpenShowDiscipline) {
        // Use exact match (case-insensitive) to avoid matching substrings
        // For example, "Reining" should not match "Ranch Reining"
        query = query.ilike('discipline', discipline.name);
      }
      // For open-show, fetch all patterns without discipline filter
      
      const { data, error } = await query;
      if (error) throw error;

      // Layer in approved user-uploaded Original Patterns (OP) and Choose-A-Pattern-Only
      // (CAPO) submissions alongside legacy tbl_patterns. Both surface in the Choose A
      // Pattern picker; the tag disambiguates CAPO vs OP when rendering the structured ID.
      // OPs use string ids prefixed with "op:" so they never collide with integer legacy ids.
      let opPatterns = [];
      try {
        let opQuery = supabase
          .from('patterns')
          .select('id, name, original_file_name, class_name, tags, preview_image_url, pattern_number, review_status, use_as_original')
          .eq('use_as_original', true)
          .eq('review_status', 'approved')
          .overlaps('tags', ['OP', 'CAPO']);

        if (!isOpenShowDiscipline) {
          opQuery = opQuery.ilike('class_name', discipline.name);
        }

        const { data: opData, error: opError } = await opQuery;
        if (opError) {
          console.warn('OP fetch failed (non-fatal):', opError.message);
        } else if (Array.isArray(opData)) {
          opPatterns = opData.map(p => ({
            id: `op:${p.id}`,
            pdf_file_name: p.original_file_name || p.name || 'Original Pattern',
            maneuvers_range: null,
            pattern_version: 'ALL',
            discipline: p.class_name,
            association_name: null,
            // OP-specific fields consumed by hover/select handlers:
            __op: true,
            __opId: p.id,
            __previewImageUrl: p.preview_image_url || null,
            __patternNumber: p.pattern_number || null,
            // Distinguish CAPO (Choose A Pattern Only) from regular OP so the
            // select item renders the correct identifier badge.
            __isCapo: Array.isArray(p.tags) && p.tags.includes('CAPO'),
          }));
        }
      } catch (opErr) {
        console.warn('OP fetch threw (non-fatal):', opErr);
      }

      setDbPatterns(prev => ({ ...prev, [disciplineId]: [...(data || []), ...opPatterns] }));
    } catch (err) {
      console.error('Error fetching patterns:', err);
      setDbPatterns(prev => ({ ...prev, [disciplineId]: [] }));
    } finally {
      setLoadingPatterns(prev => ({ ...prev, [disciplineId]: false }));
    }
  };

  // Fetch patterns for all disciplines on mount
  useEffect(() => {
    patternDisciplines.forEach(discipline => {
      fetchPatternsForDiscipline(discipline);
    });
  }, [patternDisciplines.length]);

  // Fetch pattern image when hovering over a pattern in dropdown
  useEffect(() => {
    const fetchHoveredPatternImage = async () => {
      if (!hoveredPatternId) {
        setHoveredPatternImage(null);
        return;
      }
      setLoadingHoveredImage(true);
      try {
        // OP patterns: use preview_image_url already on the patterns row
        // (no tbl_pattern_media entry).
        if (typeof hoveredPatternId === 'string' && hoveredPatternId.startsWith('op:')) {
          const opUuid = hoveredPatternId.slice(3);
          const { data: opRow, error: opErr } = await supabase
            .from('patterns')
            .select('preview_image_url')
            .eq('id', opUuid)
            .maybeSingle();
          if (opErr) console.error('Error fetching OP hovered image:', opErr);
          setHoveredPatternImage(opRow?.preview_image_url || null);
          return;
        }

        const { data: imageData, error: imageError } = await supabase
          .from('tbl_pattern_media')
          .select('image_url')
          .eq('pattern_id', hoveredPatternId)
          .maybeSingle();

        if (imageError) console.error('Error fetching hovered pattern image:', imageError);
        setHoveredPatternImage(imageData?.image_url || null);
      } catch (err) {
        console.error('Error fetching hovered pattern image:', err);
        setHoveredPatternImage(null);
      } finally {
        setLoadingHoveredImage(false);
      }
    };
    fetchHoveredPatternImage();
  }, [hoveredPatternId]);

  const handlePatternSelection = (disciplineIndex, groupIndex, patternId) => {
    if (isReadOnly) return;
    setFormData(prev => {
      const newSelections = { ...(prev.patternSelections || {}) };
      if (!newSelections[disciplineIndex]) newSelections[disciplineIndex] = {};
      newSelections[disciplineIndex][groupIndex] = patternId;
      return { ...prev, patternSelections: newSelections };
    });
  };

  // Handle maneuvers range change at discipline level (Multi-select)
  const handleManeuversRangeChange = (disciplineId, rangeValue) => {
    if (isReadOnly) return;
    setManeuversRangeMap(prev => {
      const currentRanges = prev[disciplineId] || [];
      let newRanges;
      if (currentRanges.includes(rangeValue)) {
        newRanges = currentRanges.filter(r => r !== rangeValue);
      } else {
        newRanges = [...currentRanges, rangeValue];
      }
      
      // Update all groups with this new array of ranges
      if (setFormData) {
        setFormData(prevFormData => {
            const newSelections = { ...(prevFormData.patternSelections || {}) };
            if (!newSelections[disciplineId]) newSelections[disciplineId] = {};
            
            // Find the discipline to get groups
            const discipline = patternDisciplines.find(d => d.id === disciplineId);
            const groups = discipline?.patternGroups || [];
            
            groups.forEach(group => {
            newSelections[disciplineId][group.id] = {
                ...(newSelections[disciplineId]?.[group.id] || {}),
                maneuversRange: newRanges, // Store array
                patternId: null, // Reset pattern selection when range changes? Maybe keep if valid? simpler to reset for now or keep if still valid.
                patternName: null
            };
            });
            return { ...prevFormData, patternSelections: newSelections };
        });
      }

      return { ...prev, [disciplineId]: newRanges };
    });
  };

  // Handle custom pattern file upload
  const handleCustomPatternUpload = async (file, disciplineId, groupId) => {
    if (!user || !formData.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please save the project before uploading.' });
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Only PDF, JPG, and PNG files are accepted.' });
      return;
    }
    const uploadKey = `${disciplineId}-${groupId}`;
    setUploadingCustomPattern(uploadKey);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${formData.id}/custom-patterns/${uuidv4()}.${fileExt}`;
      const { error } = await supabase.storage.from('project_files').upload(filePath, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('project_files').getPublicUrl(filePath);
      setFormData(prev => {
        const newSelections = { ...(prev.patternSelections || {}) };
        if (!newSelections[disciplineId]) newSelections[disciplineId] = {};
        const fileData = {
          uploadedFileUrl: publicUrl,
          uploadedFilePath: filePath,
          uploadedFileName: file.name,
          uploadedFileType: file.type,
          requestStatus: 'uploaded',
        };
        // Apply to ALL groups in the discipline
        const allGroupIds = Object.keys(newSelections[disciplineId]);
        allGroupIds.forEach(gId => {
          newSelections[disciplineId][gId] = {
            ...newSelections[disciplineId][gId],
            ...fileData,
          };
        });
        return { ...prev, patternSelections: newSelections };
      });
      toast({ title: 'Upload successful', description: `${file.name} has been uploaded.` });
    } catch (err) {
      console.error('Custom pattern upload failed:', err);
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message || 'Could not upload file.' });
    } finally {
      setUploadingCustomPattern(null);
    }
  };

  // Remove an uploaded custom pattern file
  const handleRemoveCustomPatternUpload = async (disciplineId, groupId) => {
    const selection = formData.patternSelections?.[disciplineId]?.[groupId];
    if (!selection?.uploadedFilePath) return;
    try {
      await supabase.storage.from('project_files').remove([selection.uploadedFilePath]);
    } catch (err) {
      console.error('Failed to remove file from storage:', err);
    }
    setFormData(prev => {
      const newSelections = { ...(prev.patternSelections || {}) };
      // Remove file data from ALL groups in the discipline
      const allGroupIds = Object.keys(newSelections[disciplineId] || {});
      allGroupIds.forEach(gId => {
        const { uploadedFileUrl: _u, uploadedFilePath: _p, uploadedFileName: _n, uploadedFileType: _t, ...rest } = newSelections[disciplineId][gId] || {};
        newSelections[disciplineId][gId] = {
          ...rest,
          requestStatus: rest.requestStatus === 'uploaded' ? 'requested' : rest.requestStatus,
        };
      });
      return { ...prev, patternSelections: newSelections };
    });
    toast({ title: 'File removed' });
  };

  // Handle pattern selection for a specific group
  const handleGroupPatternSelect = async (disciplineId, groupId, patternId, maneuversRangeValue) => {
    if (isReadOnly) return;
    const patterns = dbPatterns[disciplineId] || [];
    const selectedPattern = patterns.find(p => p.id.toString() === patternId);
    // Use provided maneuversRangeValue (string) or get from selected pattern's maneuvers_range
    const maneuversRange = maneuversRangeValue || selectedPattern?.maneuvers_range || '';

    // OP patterns keep their string id ("op:<uuid>"); legacy ids stay numeric.
    const isOp = typeof patternId === 'string' && patternId.startsWith('op:');
    const storedPatternId = isOp ? patternId : parseInt(patternId);

    setFormData(prev => {
      const newSelections = { ...(prev.patternSelections || {}) };
      if (!newSelections[disciplineId]) newSelections[disciplineId] = {};
      newSelections[disciplineId][groupId] = {
        maneuversRange, // Store as string to match Step 3 format
        patternId: storedPatternId,
        patternName: selectedPattern?.pdf_file_name?.trim() || `Pattern ${patternId}`,
        version: selectedPattern?.pattern_version || 'ALL',
        isOriginalPattern: isOp,
        patternNumber: selectedPattern?.__patternNumber || null,
      };
      return { ...prev, patternSelections: newSelections };
    });

    // OP patterns carry their own pattern_files (score sheet / build sheet / etc.)
    // rather than legacy tbl_scoresheet joins. Fetch and attach those.
    if (isOp) {
      try {
        const opUuid = selectedPattern?.__opId;
        if (opUuid) {
          const { data: files, error: filesError } = await supabase
            .from('pattern_files')
            .select('id, file_type, file_name, file_url, file_path, sort_order')
            .eq('pattern_id', opUuid)
            .order('sort_order', { ascending: true });

          if (filesError) {
            console.warn('Failed to fetch pattern_files for OP:', filesError.message);
          } else if (files?.length) {
            setFormData(prev => {
              const newSelections = { ...(prev.patternSelections || {}) };
              if (newSelections[disciplineId]?.[groupId]) {
                newSelections[disciplineId][groupId] = {
                  ...newSelections[disciplineId][groupId],
                  patternFiles: files,
                };
              }
              return { ...prev, patternSelections: newSelections };
            });
          }
        }
      } catch (err) {
        console.error('Error fetching pattern_files for OP pattern:', err);
      }
      return; // skip legacy scoresheet auto-link for OP patterns
    }

    // Auto-fetch linked scoresheet(s) for the selected pattern
    // Working Cow Horse may have multiple (Reining + Cow Work)
    try {
      let scoresheets = [];

      // Step 1: Try exact pattern_id match (may return multiple)
      const { data: linkedSheets } = await supabase
        .from('tbl_scoresheet')
        .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev')
        .eq('pattern_id', parseInt(patternId));

      if (linkedSheets?.length > 0) {
        scoresheets = linkedSheets.filter(s => s.image_url);
      }

      // Step 2: Fallback — match by association + discipline (standalone scoresheets)
      if (scoresheets.length === 0) {
        const discipline = formData.disciplines?.find(d => d.id === disciplineId);
        const assocId = discipline?.association_id;
        const assoc = associationsData?.find(a => a.id === assocId);
        const assocAbbrev = assoc?.abbreviation;
        const discName = discipline?.name;

        if (assocAbbrev && discName) {
          const { data: fallbackSheets } = await supabase
            .from('tbl_scoresheet')
            .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev')
            .eq('association_abbrev', assocAbbrev)
            .ilike('discipline', discName)
            .is('pattern_id', null);

          if (fallbackSheets?.length > 0) {
            scoresheets = fallbackSheets.filter(s => s.image_url);
          }
        }
      }

      if (scoresheets.length > 0) {
        const scoresheetDataArray = scoresheets.map(ss => {
          let displayName = ss.file_name || ss.discipline || 'Score Sheet';
          const path = ss.storage_path || '';
          if (path.includes('_LTD_')) displayName = 'Cow Work - Limited';
          else if (path.includes('_BDBD_')) displayName = 'Cow Work - Rookie';
          else if (path.toLowerCase().includes('cowwork') || path.toLowerCase().includes('cow_work')) displayName = 'Cow Work';
          else if (path.toLowerCase().includes('reining') || (ss.discipline && ss.discipline.toLowerCase().includes('reining'))) displayName = 'Reining';
          return {
            id: ss.id,
            image_url: ss.image_url,
            displayName,
            storage_path: ss.storage_path
          };
        });

        setFormData(prev => {
          const newSelections = { ...(prev.patternSelections || {}) };
          if (newSelections[disciplineId]?.[groupId]) {
            newSelections[disciplineId][groupId] = {
              ...newSelections[disciplineId][groupId],
              scoresheetId: scoresheets[0].id,
              scoresheetData: scoresheetDataArray
            };
          }
          return { ...prev, patternSelections: newSelections };
        });
      }
    } catch (err) {
      console.error('Error auto-fetching scoresheet for pattern:', err);
    }
  };

  // Handle assign pattern dialog confirmation
  const handleAssignPattern = () => {
    // TODO: implement pattern assignment logic
    setAssignDialogOpen(false);
    setDialogDueDate('');
  };

  // Get available maneuvers ranges for a discipline
  const getManeuversRanges = (disciplineId) => {
    const patterns = dbPatterns[disciplineId] || [];
    return [...new Set(patterns.filter(p => p.maneuvers_range).map(p => p.maneuvers_range))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  // Get filtered patterns for a discipline based on selected maneuvers range
  // Get filtered patterns for a discipline (Difficulty filter applied in render)
  const getFilteredPatterns = (disciplineId) => {
    return dbPatterns[disciplineId] || [];
  };

  // Get association name(s) and abbreviation(s) for a group based on Primary logic (similar to DropZoneGroup)
  const getGroupAssociationNames = (group, discipline) => {
    // Get all unique associations from divisions in this group
    let uniqueAssocIds = group?.divisions?.length > 0
      ? [...new Set(group.divisions.map(div => div.assocId).filter(Boolean))]
      : [];

    // Fallback: if no assocIds from divisions, use discipline or formData associations
    if (uniqueAssocIds.length === 0 && discipline) {
      const discAssocIds = Object.keys(discipline.selectedAssociations || {})
        .filter(id => discipline.selectedAssociations[id]);
      if (discAssocIds.length > 0) {
        uniqueAssocIds = discAssocIds;
      } else if (discipline.association_id) {
        uniqueAssocIds = [discipline.association_id];
      }
    }
    if (uniqueAssocIds.length === 0) {
      // Last resort: user's selected associations from Event Setup
      uniqueAssocIds = Object.keys(formData.associations || {}).filter(id => formData.associations[id]);
    }

    if (uniqueAssocIds.length === 0) {
      return { names: [], abbreviations: [], ids: [] };
    }
    
    // If only one association, use it
    if (uniqueAssocIds.length === 1) {
      const assocId = uniqueAssocIds[0];
      const assoc = associationsData?.find(a => a.id === assocId);
      if (assoc) {
        return {
          names: assoc.name ? [assoc.name] : [],
          abbreviations: assoc.abbreviation ? [assoc.abbreviation] : [],
          ids: [assocId] // Include ID as fallback for matching
        };
      }
      // Fallback: if association not found in associationsData, use the ID itself
      return { names: [], abbreviations: [], ids: [assocId] };
    }

    // If multiple associations, check which are Primary
    if (uniqueAssocIds.length > 1 && formData?.primaryAffiliates) {
      const primaryAssocIds = uniqueAssocIds.filter(assocId => 
        formData.primaryAffiliates.includes(assocId)
      );
      
      // If we have Primary associations, use them
      if (primaryAssocIds.length > 0) {
        const names = [];
        const abbreviations = [];
        primaryAssocIds.forEach(assocId => {
          const assoc = associationsData?.find(a => a.id === assocId);
          if (assoc) {
            if (assoc.name) names.push(assoc.name);
            if (assoc.abbreviation) abbreviations.push(assoc.abbreviation);
          }
        });
        return { names, abbreviations, ids: primaryAssocIds };
      }
    }

    // Fallback: use ALL associations if multiple and no Primary found
    if (uniqueAssocIds.length > 0) {
      const names = [];
      const abbreviations = [];
      uniqueAssocIds.forEach(assocId => {
      const assoc = associationsData?.find(a => a.id === assocId);
      if (assoc) {
          if (assoc.name) names.push(assoc.name);
          if (assoc.abbreviation) abbreviations.push(assoc.abbreviation);
      }
      });
      return { names, abbreviations, ids: uniqueAssocIds };
    }

    return { names: [], abbreviations: [], ids: [] };
  };

  // Get pattern selection from formData
  const getPatternSelection = (disciplineId, groupId) => {
    return formData.patternSelections?.[disciplineId]?.[groupId];
  };

  // Extract pattern number from filename (e.g., "WesternRiding0001" -> "1", "WesternRiding0001.L1" -> "1")
  const extractPatternNumber = (fileName) => {
    if (!fileName) return null;
    // Remove extension if present
    const nameWithoutExt = fileName.replace(/\.(pdf|PDF)$/, '');
    // Extract trailing digits before any dot (e.g., "WesternRiding0001.L1" -> "0001")
    const match = nameWithoutExt.match(/(\d+)(?:\.|$)/);
    if (match) {
      // Convert to number to remove leading zeros (e.g., "0001" -> 1)
      const num = parseInt(match[1], 10);
      return isNaN(num) ? null : num;
    }
    // Fallback: try to find any sequence of digits at the end
    const fallbackMatch = nameWithoutExt.match(/(\d+)$/);
    if (fallbackMatch) {
      const num = parseInt(fallbackMatch[1], 10);
      return isNaN(num) ? null : num;
    }
    return null;
  };

  // Check if discipline is complete
  const isDisciplineComplete = (discipline, disciplineIndex) => {
    const groups = discipline.patternGroups || [];
    if (groups.length === 0) return false;

    // Check if this is a scoresheet-only discipline
    const isScoresheetOnly = discipline.pattern_type === 'scoresheet_only' || (!discipline.pattern && discipline.scoresheet);

    // For scoresheet-only disciplines: complete if they have groups with divisions
    if (isScoresheetOnly) {
      return groups.every(group => group.divisions && group.divisions.length > 0);
    }

    // Check if any pattern is assigned to any group
    const hasPatternAssigned = groups.some(group => {
      const selection = getPatternSelection(discipline.id, group.id);
      return selection?.patternId;
    });

    // Also check that all custom request groups have valid name/email
    const customRequestGroups = groups.filter(group => {
      const selection = getPatternSelection(discipline.id, group.id);
      return selection?.type === 'customRequest';
    });
    const customRequestsValid = customRequestGroups.every(group => {
      const selection = getPatternSelection(discipline.id, group.id);
      const hasName = !!selection.requestedFromName?.trim();
      const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selection.requestedFromEmail || '');
      return hasName && hasValidEmail;
    });

    // Discipline is complete if it has patterns or valid custom requests, and all custom requests are valid
    return (hasPatternAssigned || (customRequestGroups.length > 0 && customRequestsValid)) && customRequestsValid;
  };


  const dateRange = formData.startDate && formData.endDate
    ? `${format(parseLocalDate(formData.startDate), 'MMM d')} - ${format(parseLocalDate(formData.endDate), 'MMM d, yyyy')}`
    : 'Dates not set';





  // Scroll to discipline and expand it
  const scrollToDiscipline = (disciplineId) => {
    const ref = disciplineRefs.current[disciplineId];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Expand the discipline
      setOpenDisciplineId(disciplineId);
    }
  };

  return (
    <motion.div
      key="step6-pattern-layout"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <CardHeader>
        <CardTitle>
          Step {stepNumber}: Pattern Selection
        </CardTitle>
        <CardDescription>
          Assign patterns to each group for your book.
        </CardDescription>
        {!isHubMode && formData.showName && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-xl font-semibold">
              {formData.showName}
            </h3>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Show summary - 2 column layout with Discipline Folders in second row */}
        <Card className="p-4 bg-muted/50">
          <div className="space-y-6">
            {/* First Row - 2 columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Show Structure */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Show Structure</h3>
                <div className="space-y-3 text-sm">
                  {(formData.showName || isHubMode) && (
                    <div className="flex items-start gap-2">
                      <Trophy className="w-4 h-4 mt-0.5 text-blue-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-xs text-muted-foreground">{isHubMode ? 'Pattern Name' : 'Show Name'}</p>
                        {isHubMode ? (
                          <Input
                            value={formData.showName || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, showName: e.target.value }))}
                            placeholder="Enter pattern name"
                            className="h-8 mt-1"
                          />
                        ) : (
                          <p className="font-medium">{formData.showName}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {formData.venueName && (
                    <div className="flex items-start gap-2">
                      <Building className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-xs text-muted-foreground">Venue Name</p>
                        <p className="text-muted-foreground">{formData.venueName}</p>
                      </div>
                    </div>
                  )}
                  {!isHubMode && (
                    <div className="flex items-start gap-2">
                      <CalendarIcon className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-xs text-muted-foreground">Show Dates</p>
                        <p className="text-muted-foreground">{dateRange}</p>
                      </div>
                    </div>
                  )}
                  {!isHubMode && formData.venueAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-blue-600" />
                      <div>
                        <p className="font-semibold text-xs text-muted-foreground">Location</p>
                        <p className="text-muted-foreground">{formData.venueAddress}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Second Row - Discipline Folders (Full Width) */}
            <div className="space-y-4 pt-4 border-t">
              <div 
                className="flex items-center justify-between mb-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                onClick={() => setIsDisciplineFoldersOpen(!isDisciplineFoldersOpen)}
              >
                <div className="flex items-center gap-2">
                  <ChevronDown className={cn("w-4 h-4 transition-transform", isDisciplineFoldersOpen ? "rotate-0" : "-rotate-90")} />
                  <h3 className="text-lg font-semibold">Discipline Folders</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllDisciplines(!showAllDisciplines);
                  }}
                >
                  {showAllDisciplines ? 'Show Less' : 'See All'} <ChevronRight className={cn("w-4 h-4 ml-1 transition-transform", showAllDisciplines && "rotate-90")} />
                </Button>
              </div>
              
              {isDisciplineFoldersOpen && (
                <>
              
              <div className="text-sm text-muted-foreground mb-4">
                <p>
                  {(() => {
                    const incompleteCount = patternDisciplines.filter((discipline) => {
                      const disciplineIndex = (formData.disciplines || []).findIndex(d => d.id === discipline.id);
                      return !isDisciplineComplete(discipline, disciplineIndex);
                    }).length;
                    return `${incompleteCount} of ${patternDisciplines.length} disciplines incomplete`;
                  })()}
                </p>
              </div>
              
              {/* Filter Checkboxes */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="filter-incomplete"
                    checked={filters.incomplete}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, incomplete: checked }))}
                  />
                  <Label 
                    htmlFor="filter-incomplete" 
                    className={cn(
                      "text-sm cursor-pointer px-2 py-1 rounded transition-colors"
                    )}
                  >
                    Incomplete
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="filter-completed"
                    checked={filters.completed}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, completed: checked }))}
                  />
                  <Label htmlFor="filter-completed" className="text-sm cursor-pointer">Completed</Label>
                </div>
                {!isHubMode && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="filter-patterns-assigned"
                    checked={filters.patternsAssigned}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, patternsAssigned: checked }))}
                  />
                  <Label htmlFor="filter-patterns-assigned" className="text-sm cursor-pointer">Patterns Assigned</Label>
                </div>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-sm">Sort by:</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[150px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="patterns">Patterns</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Grid of Discipline Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(() => {
                  // Filter disciplines based on selected filters
                  const hasActiveFilters = Object.values(filters).some(v => v);
                  
                  let filteredDisciplines = patternDisciplines.filter((discipline) => {
                    if (!hasActiveFilters) return true; // Show all if no filters active
                    
                    const disciplineIndex = (formData.disciplines || []).findIndex(d => d.id === discipline.id);
                    const isComplete = isDisciplineComplete(discipline, disciplineIndex);
                    const isScoresheetOnly = discipline.pattern_type === 'scoresheet_only' || (!discipline.pattern && discipline.scoresheet);
                    
                    // Count patterns/groups
                    const assignedCount = isScoresheetOnly
                      ? (discipline.patternGroups || []).filter(group => group.divisions && group.divisions.length > 0).length
                      : (discipline.patternGroups || []).filter(group => {
                          const selection = getPatternSelection(discipline.id, group.id);
                          return selection?.patternId;
                        }).length;
                    const hasPatterns = assignedCount > 0;
                    
                    // Check if discipline matches any active filter
                    if (filters.incomplete && !isComplete) return true;
                    if (filters.completed && isComplete) return true;
                    if (filters.patternsAssigned && hasPatterns) return true;
                    return false;
                  });
                  
                  // Sort disciplines
                  filteredDisciplines = [...filteredDisciplines].sort((a, b) => {
                    const aIndex = (formData.disciplines || []).findIndex(d => d.id === a.id);
                    const bIndex = (formData.disciplines || []).findIndex(d => d.id === b.id);
                    const aComplete = isDisciplineComplete(a, aIndex);
                    const bComplete = isDisciplineComplete(b, bIndex);
                    const aIsScoresheetOnly = a.pattern_type === 'scoresheet_only' || (!a.pattern && a.scoresheet);
                    const bIsScoresheetOnly = b.pattern_type === 'scoresheet_only' || (!b.pattern && b.scoresheet);
                    
                    const aAssignedCount = aIsScoresheetOnly
                      ? (a.patternGroups || []).filter(group => group.divisions && group.divisions.length > 0).length
                      : (a.patternGroups || []).filter(group => {
                          const selection = getPatternSelection(a.id, group.id);
                          return selection?.patternId;
                        }).length;
                    const bAssignedCount = bIsScoresheetOnly
                      ? (b.patternGroups || []).filter(group => group.divisions && group.divisions.length > 0).length
                      : (b.patternGroups || []).filter(group => {
                          const selection = getPatternSelection(b.id, group.id);
                          return selection?.patternId;
                        }).length;
                    
                    if (sortBy === 'name') {
                      return a.name.localeCompare(b.name);
                    } else if (sortBy === 'status') {
                      return aComplete === bComplete ? 0 : aComplete ? 1 : -1;
                    } else if (sortBy === 'patterns') {
                      return bAssignedCount - aAssignedCount;
                    }
                    return 0;
                  });
                  
                  // Limit to 8 items if not showing all
                  const displayDisciplines = showAllDisciplines ? filteredDisciplines : filteredDisciplines.slice(0, 8);
                  
                  return displayDisciplines.map((discipline) => {
                    const disciplineIndex = (formData.disciplines || []).findIndex(d => d.id === discipline.id);
                    // Only count groups that have divisions assigned (exclude empty placeholder groups)
                    const groups = (discipline.patternGroups || []).filter(g => g.divisions && g.divisions.length > 0);
                    const isComplete = isDisciplineComplete(discipline, disciplineIndex);
                    const isScoresheetOnly = discipline.pattern_type === 'scoresheet_only' || (!discipline.pattern && discipline.scoresheet);

                    // Count assigned patterns/groups
                    const assignedCount = isScoresheetOnly
                      ? groups.length
                      : groups.filter(group => {
                          const selection = getPatternSelection(discipline.id, group.id);
                          return selection?.patternId;
                        }).length;
                    
                    // Get pattern names for display
                    const patternNames = [];
                    if (!isScoresheetOnly) {
                      groups.forEach(group => {
                        const selection = getPatternSelection(discipline.id, group.id);
                        if (selection?.patternName) {
                          const patternName = selection.patternName.replace(/\.(pdf|PDF)$/, '');
                          const version = selection.version || '';
                          const displayText = version && version !== 'ALL' ? `${patternName} (${version})` : patternName;
                          if (!patternNames.includes(displayText)) {
                            patternNames.push(displayText);
                          }
                        }
                      });
                    }
                    
                    // Determine subtitle text
                    let subtitle = '';
                    let subtitleColor = 'text-muted-foreground';
                    if (isScoresheetOnly) {
                      subtitle = `${assignedCount} group${assignedCount !== 1 ? 's' : ''} configured`;
                    } else if (assignedCount > 0) {
                      subtitle = `${assignedCount} pattern${assignedCount !== 1 ? 's' : ''} assigned`;
                      // Add pattern names if available
                      if (patternNames.length > 0) {
                        subtitle += ` ${patternNames.join(' ')}`;
                      }
                    } else {
                      subtitle = '0 patterns assigned';
                    }
                    
                    const handleDisciplineClick = () => {
                      scrollToDiscipline(discipline.id);
                    };
                    
                    return (
                      <div
                        key={discipline.id}
                        onClick={handleDisciplineClick}
                        className={cn(
                          "relative p-4 border-2 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md",
                          isComplete 
                            ? "bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-950/30" 
                            : "bg-orange-50 border-orange-300 dark:bg-orange-950/20 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-950/30"
                        )}
                      >
                        {/* Discipline Name with Status Icon */}
                        <div className="flex items-start gap-2 mb-2">
                          {isComplete ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-base leading-tight">{discipline.name.replace(' at Halter', '')}</h4>
                            {subtitle && (
                              <p className={cn("text-sm mt-1", subtitleColor)}>
                                {subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Footer with status badge and action */}
                        <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-current/10">
                          <Badge 
                            className={cn(
                              "text-xs font-semibold",
                              isComplete 
                                ? "bg-green-200 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-700" 
                                : "bg-orange-200 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-700"
                            )}
                          >
                            {isComplete ? "Complete" : "Incomplete"}
                          </Badge>
                          {isComplete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewDiscipline(discipline);
                                setIsPreviewOpen(true);
                              }}
                              className="p-1 hover:bg-green-200 dark:hover:bg-green-900/40 rounded transition-colors flex-shrink-0"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4 text-green-700 dark:text-green-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Pattern selection accordion-style list */}
        {patternDisciplines.length > 0 && (
          <section>
            <div 
              className="flex items-center justify-between mb-4 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
              onClick={() => setIsDisciplineConfigOpen(!isDisciplineConfigOpen)}
            >
              <div className="flex items-center gap-2">
                <ChevronDown className={cn("w-4 h-4 transition-transform", isDisciplineConfigOpen ? "rotate-0" : "-rotate-90")} />
                <h3 className="text-lg font-semibold">Discipline Configuration</h3>
              </div>
            </div>
            
            {isDisciplineConfigOpen && (
              <div className="space-y-2">
              {patternDisciplines.map((discipline, logicalIndex) => {
                const disciplineIndex = (formData.disciplines || []).findIndex(d => d.id === discipline.id);
                const isOpen = openDisciplineId === discipline.id;
                // Exclude phantom empty groups left behind by Step 2's default
                // "Group 1" placeholder when no divisions ever get assigned to it.
                // Without this filter, a merged APHA+AQHA discipline shows "3
                // Groups" even though only 2 groups actually hold divisions.
                // Hub mode skips Step 3 (Configure Classes), so divisions never
                // get attached to the placeholder group — keep it so the user
                // can still select a pattern.
                const groups = isHubMode
                  ? (discipline.patternGroups || [])
                  : (discipline.patternGroups || []).filter(
                      g => Array.isArray(g?.divisions) && g.divisions.length > 0
                    );
                
                // Check if this is a scoresheet-only discipline
                const isScoresheetOnly = discipline.pattern_type === 'scoresheet_only' || (!discipline.pattern && discipline.scoresheet);

                // Determine discipline-level assignment type from first group
                const firstGroupSelection = groups.length > 0 ? getPatternSelection(discipline.id, groups[0].id) : null;
                const disciplineAssignType = firstGroupSelection?.type || null;

                // Helper: apply assignment type to ALL groups in this discipline
                const setDisciplineAssignType = (type, extraData = {}) => {
                  if (isReadOnly) return;
                  setFormData(prev => {
                    const newSelections = { ...(prev.patternSelections || {}) };
                    if (!newSelections[discipline.id]) newSelections[discipline.id] = {};
                    groups.forEach(group => {
                      const existing = newSelections[discipline.id][group.id] || {};
                      if (type) {
                        newSelections[discipline.id][group.id] = {
                          ...existing,
                          type,
                          ...(type === 'judgeAssigned' && { judgeName: existing.judgeName || firstGroupSelection?.judgeName || '' }),
                          ...(type === 'customRequest' && { customPatternRequested: true, requestedFromName: existing.requestedFromName || '', requestedFromEmail: existing.requestedFromEmail || '', requestNotes: existing.requestNotes || '', requestStatus: existing.requestStatus || 'requested' }),
                          ...extraData
                        };
                      } else {
                        // Remove the type but preserve existing pattern selection
                        const { type: _removedType, judgeName: _j, customPatternRequested: _c, requestedFromName: _rn, requestedFromEmail: _re, requestNotes: _rno, requestStatus: _rs, ...preserved } = existing;
                        newSelections[discipline.id][group.id] = preserved;
                      }
                    });
                    return { ...prev, patternSelections: newSelections };
                  });
                };

                // Helper: update a field on ALL groups for this discipline
                const updateDisciplineAssignField = (field, value) => {
                  if (isReadOnly) return;
                  setFormData(prev => {
                    const newSelections = { ...(prev.patternSelections || {}) };
                    if (!newSelections[discipline.id]) newSelections[discipline.id] = {};
                    groups.forEach(group => {
                      if (newSelections[discipline.id][group.id]) {
                        newSelections[discipline.id][group.id] = {
                          ...newSelections[discipline.id][group.id],
                          [field]: value
                        };
                      }
                    });
                    return { ...prev, patternSelections: newSelections };
                  });
                };

                return (
                  <div
                    key={discipline.id}
                    className={cn(
                      "bg-card rounded-lg border transition-all duration-300",
                      isOpen
                        ? "border-2 border-primary shadow-md ring-2 ring-primary/20 bg-primary/5"
                        : "border-border"
                    )}
                    ref={(el) => disciplineRefs.current[discipline.id] = el}
                  >
                    {/* Discipline header row */}
                    <div className="px-3 sm:px-4 py-2 sm:py-3 border-b">
                      {/* Row 1: Name + Pattern selector + badges */}
                      <div
                        className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 cursor-pointer hover:bg-muted/50 active:bg-muted/70 transition-colors -mx-3 sm:-mx-4 px-3 sm:px-4 -my-2 sm:-my-3 py-2 sm:py-3"
                        onClick={() =>
                          setOpenDisciplineId(prev => (prev === discipline.id ? null : discipline.id))
                        }
                      >
                        <div className="flex items-center gap-2 hover:text-primary transition-colors">
                          <span className="font-semibold text-base">{discipline.name.replace(' at Halter', '')}</span>
                          {!isHubMode && groups.length > 0 && (
                            <Badge variant="secondary" className="ml-1">
                              {groups.length} {groups.length === 1 ? 'Group' : 'Groups'}
                            </Badge>
                          )}
                          <ChevronDown
                            className={cn(
                              'w-4 h-4 transition-transform text-muted-foreground',
                              isOpen ? 'rotate-180' : 'rotate-0'
                            )}
                          />
                        </div>

                        <div className="flex-1 flex items-center gap-2 flex-wrap min-h-[40px]">
                        {/* Show scoresheet-only badge */}
                        {isScoresheetOnly && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                            Scoresheet Only
                          </Badge>
                        )}
                        
                        {/* Pattern selection UI - only show for non-scoresheet-only disciplines, hidden in hub mode (flat layout) */}
                        {!isScoresheetOnly && !isHubMode && (
                          <>
                        {/* Pattern Dropdown - Apply to all groups */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select
                            value=""
                            onValueChange={(patternId) => {
                              // Apply selected pattern to all groups in this discipline
                              const selectedPattern = (dbPatterns[discipline.id] || []).find(p => p.id.toString() === patternId);
                              if (selectedPattern) {
                                const patternManeuversRange = selectedPattern?.maneuvers_range || '';
                                groups.forEach((group) => {
                                  handleGroupPatternSelect(discipline.id, group.id, patternId, patternManeuversRange);
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs bg-background">
                              <SelectValue placeholder="Select Pattern for All Groups" />
                            </SelectTrigger>
                            <SelectContent
                              className="max-h-[300px]"
                            >
                                            {(() => {
                                let allPatterns = getFilteredPatterns(discipline.id);
                                
                                // Check if this is an open-show discipline
                                const isOpenShowDiscipline = discipline?.selectedAssociations?.['open-show'] || 
                                                             discipline?.association_id === 'open-show';
                                
                                // For open-show disciplines, show all patterns without association filtering
                                if (!isOpenShowDiscipline) {
                                  // Get all unique associations from all groups in this discipline
                                  // This works for ANY associations (AQHA, APHA, VRH, RHC, etc.)
                                  const uniqueAssocIds = new Set();
                                  groups.forEach(group => {
                                    if (group.divisions) {
                                      group.divisions.forEach(div => {
                                        if (div.assocId) {
                                          uniqueAssocIds.add(div.assocId);
                                        }
                                      });
                                    }
                                  });

                                  // Fallback: if no assocIds from divisions, use discipline's own association
                                  // or the user's selected associations from Step 1
                                  if (uniqueAssocIds.size === 0) {
                                    const discAssocIds = Object.keys(discipline.selectedAssociations || {})
                                      .filter(id => discipline.selectedAssociations[id]);
                                    if (discAssocIds.length > 0) {
                                      discAssocIds.forEach(id => uniqueAssocIds.add(id));
                                    } else if (discipline.association_id) {
                                      uniqueAssocIds.add(discipline.association_id);
                                    } else {
                                      // Last resort: use formData.associations (user's selections from Event Setup)
                                      Object.keys(formData.associations || {}).forEach(id => {
                                        if (formData.associations[id]) uniqueAssocIds.add(id);
                                      });
                                    }
                                  }

                                  const assocIdsArray = Array.from(uniqueAssocIds);
                                  
                                  // If discipline has 2+ associations: show patterns from all of them
                                  // If discipline has 1 association: show only patterns from that association
                                  if (assocIdsArray.length > 0) {
                                    // Get association names and abbreviations for all associations found
                                    const associationNames = [];
                                    assocIdsArray.forEach(assocId => {
                                      const assoc = associationsData?.find(a => a.id === assocId);
                                      if (assoc) {
                                        if (assoc.name) associationNames.push(assoc.name);
                                        if (assoc.abbreviation) associationNames.push(assoc.abbreviation);
                                      }
                                    });
                                    
                                    // Filter patterns to only show those matching ANY of the discipline's associations
                                    if (associationNames.length > 0) {
                                      allPatterns = allPatterns.filter(pattern => {
                                        const patternAssocName = (pattern.association_name || '').trim();
                                        if (!patternAssocName) return false;
                                        
                                        const patternAssocLower = patternAssocName.toLowerCase();
                                        
                                        // Check if pattern matches ANY of the associations in this discipline
                                        return associationNames.some(assocName => {
                                          const assocNameLower = (assocName || '').trim().toLowerCase();
                                          if (!assocNameLower) return false;
                                          
                                          // 1. Exact match (case-insensitive)
                                          if (patternAssocLower === assocNameLower) return true;
                                          
                                          // 2. Pattern starts with association abbreviation
                                          if (patternAssocLower.startsWith(assocNameLower + ' ') || 
                                              patternAssocLower.startsWith(assocNameLower + '-')) {
                                            return true;
                                          }
                                          
                                          // 3. Association abbreviation matches pattern's first word before dash/space
                                          const patternFirstPart = patternAssocLower.split(/[\s-]+/)[0];
                                          if (patternFirstPart === assocNameLower) return true;
                                          
                                          // 4. Pattern contains full association name
                                          if (assocNameLower.length > 3 && patternAssocLower.includes(assocNameLower)) {
                                            return true;
                                          }
                                          
                                          return false;
                                        });
                                      });
                                    }
                                  }
                                }
                                
                                if (allPatterns.length === 0) {
                                  return <SelectItem value="none" disabled>No patterns available</SelectItem>;
                                }
                                
                                // Extract pattern number helper
                                const extractPatternNumber = (fileName) => {
                                  if (!fileName) return null;
                                  const match = fileName.match(/(\d+)(?:\..*)?$/);
                                  if (match) {
                                    return parseInt(match[1], 10);
                                  }
                                  return null;
                                };
                                
                                // Sort patterns
                                const sortedPatterns = [...allPatterns].sort((a, b) => {
                                  const numA = extractPatternNumber(a.pdf_file_name) || 0;
                                  const numB = extractPatternNumber(b.pdf_file_name) || 0;
                                  return numA - numB;
                                });
                                
                                return sortedPatterns.map((pattern) => {
                                  const patternNumber = extractPatternNumber(pattern.pdf_file_name);
                                  const version = pattern.pattern_version || 'ALL';
                                  
                                  // Display label as "Pattern 1", "Pattern 2", etc.
                                  const displayLabel = patternNumber !== null 
                                    ? `Pattern ${patternNumber}`
                                    : `Pattern ${pattern.id}`;
                                  
                                  return (
                                    <SelectItem
                                      key={pattern.id}
                                      value={pattern.id.toString()}
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <span className="whitespace-normal break-words">{displayLabel}</span>
                                        {version && version !== 'ALL' && (
                                          <Badge variant="outline" className="text-xs flex-shrink-0">{version}</Badge>
                                        )}
                                                            </div>
                                    </SelectItem>
                                                    );
                                });
                              })()}
                            </SelectContent>
                          </Select>
                        </div>

                          </>
                        )}

                        {/* Display pattern badges for selected patterns */}
                        {(() => {
                          const groupSelections = (isHubMode ? groups.filter(g => !g._hubExtra) : groups).map((group) => {
                            const selection = getPatternSelection(discipline.id, group.id);
                            if (!selection?.patternId && !selection?.patternName) return null;

                            const patternName = selection.patternName || '';
                            const cleanPatternName = patternName.replace(/\.(pdf|PDF)$/, '');
                            const version = selection.version || '';
                            const displayText = version && version !== 'ALL' ? `${cleanPatternName} (${version})` : cleanPatternName;

                            return {
                              groupName: group.name,
                              patternId: selection.patternId,
                              displayText,
                              scoresheetData: selection.scoresheetData
                            };
                          }).filter(Boolean);

                          return groupSelections.length > 0 && (
                            <div
                              className="flex items-center gap-1 flex-wrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {groupSelections.map((sel, idx) => (
                                <PatternBadgeWithHover
                                  key={idx}
                                  patternId={sel.patternId}
                                  displayText={sel.displayText}
                                  formData={formData}
                                  scoresheetData={sel.scoresheetData}
                                />
                              ))}
                            </div>
                          );
                        })()}

                        </div>
                      </div>

                      {/* Row 2: Discipline-level action buttons — always visible */}
                      {!isScoresheetOnly && !isHubMode && !isReadOnly && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant={disciplineAssignType === 'judgeAssigned' ? 'default' : 'outline'}
                            size="sm"
                            className={cn("h-7 text-xs", disciplineAssignType === 'judgeAssigned' && "bg-amber-600 hover:bg-amber-700")}
                            onClick={() => setDisciplineAssignType(disciplineAssignType === 'judgeAssigned' ? null : 'judgeAssigned')}
                          >
                            {disciplineAssignType === 'judgeAssigned' ? `Judge: ${firstGroupSelection?.judgeName || 'TBD'}` : 'Assign Judge'}
                          </Button>

                          <Button
                            variant={disciplineAssignType === 'customRequest' ? 'default' : 'outline'}
                            size="sm"
                            className={cn("h-7 text-xs", disciplineAssignType === 'customRequest' && "bg-purple-600 hover:bg-purple-700")}
                            onClick={() => {
                              const isToggling = disciplineAssignType !== 'customRequest';
                              setDisciplineAssignType(isToggling ? 'customRequest' : null);
                              if (isToggling) {
                                // Auto-open the discipline and scroll to reveal the custom pattern section
                                setOpenDisciplineId(discipline.id);
                                setTimeout(() => {
                                  const ref = disciplineRefs.current[discipline.id];
                                  if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                              }
                            }}
                          >
                            {disciplineAssignType === 'customRequest' ? 'Custom Pattern Requested' : '+ Custom Pattern'}
                          </Button>
                        </div>
                      )}

                      {/* Status badges when read-only */}
                      {!isScoresheetOnly && !isHubMode && isReadOnly && disciplineAssignType && (
                        <div className="flex items-center gap-2 mt-2">
                          {disciplineAssignType === 'judgeAssigned' && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                              Judge: {firstGroupSelection?.judgeName || 'TBD'}
                            </Badge>
                          )}
                          {disciplineAssignType === 'customRequest' && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                              Custom Pattern Requested
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {isOpen && (
                      <div className="px-2 sm:px-4 pb-3 sm:pb-4 pt-2 space-y-3 sm:space-y-4">
                        {/* ── Discipline-Level Detail Forms (expanded) ── */}
                        {!isScoresheetOnly && !isHubMode && (
                          <div className="space-y-3">
                            {/* Judge Assignment Details — discipline level */}
                            {disciplineAssignType === 'judgeAssigned' && (
                              <JudgeAssignmentField
                                disciplineName={discipline.name.replace(' at Halter', '')}
                                currentValue={firstGroupSelection?.judgeName || ''}
                                onValueChange={(judgeName) => updateDisciplineAssignField('judgeName', judgeName)}
                                formData={formData}
                                isReadOnly={isReadOnly}
                              />
                            )}

                            {/* Custom Pattern Request Details — discipline level */}
                            {disciplineAssignType === 'customRequest' && (
                              <div className="p-3 border-2 border-dashed border-purple-300 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 space-y-3">
                                <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Custom Pattern Requested for {discipline.name.replace(' at Halter', '')}</p>
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1 block">
                                    Request From Name <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    placeholder="Name of person to request pattern from..."
                                    value={firstGroupSelection?.requestedFromName || ''}
                                    onChange={(e) => updateDisciplineAssignField('requestedFromName', e.target.value)}
                                    disabled={isReadOnly}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1 block">
                                    Request From Email <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    type="email"
                                    placeholder="Email address..."
                                    value={firstGroupSelection?.requestedFromEmail || ''}
                                    onChange={(e) => updateDisciplineAssignField('requestedFromEmail', e.target.value)}
                                    disabled={isReadOnly}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1 block">Optional Notes</Label>
                                  <Textarea
                                    placeholder="Optional notes for custom pattern request..."
                                    value={firstGroupSelection?.requestNotes || ''}
                                    onChange={(e) => updateDisciplineAssignField('requestNotes', e.target.value)}
                                    disabled={isReadOnly}
                                    rows={3}
                                  />
                                </div>

                                {/* Custom Pattern Upload — applies to all groups */}
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1 block">Upload Custom Pattern</Label>
                                  {firstGroupSelection?.uploadedFileUrl ? (
                                    <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                      {firstGroupSelection.uploadedFileType?.startsWith('image/') ? (
                                        <img src={firstGroupSelection.uploadedFileUrl} alt="Custom pattern" className="w-full max-h-48 object-contain bg-slate-50 dark:bg-slate-800" />
                                      ) : (
                                        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800">
                                          <FileText className="h-8 w-8 text-red-500 flex-shrink-0" />
                                          <div className="overflow-hidden">
                                            <p className="text-sm font-medium truncate">{firstGroupSelection.uploadedFileName}</p>
                                            <p className="text-xs text-muted-foreground">PDF Document</p>
                                          </div>
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between p-2 border-t">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs flex-shrink-0">Uploaded</Badge>
                                          <span className="text-xs text-muted-foreground truncate">{firstGroupSelection.uploadedFileName}</span>
                                        </div>
                                        {!isReadOnly && groups.length > 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                            onClick={() => handleRemoveCustomPatternUpload(discipline.id, groups[0].id)}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <label
                                      className={cn(
                                        "flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                                        "border-purple-200 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/30",
                                        isReadOnly && "opacity-50 cursor-not-allowed"
                                      )}
                                    >
                                      <UploadCloud className="h-6 w-6 text-purple-400" />
                                      <span className="text-xs text-purple-600">Drop or click to upload PDF, JPG, or PNG</span>
                                      <input
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        disabled={isReadOnly}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file && groups.length > 0) handleCustomPatternUpload(file, discipline.id, groups[0].id);
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>

                                {!firstGroupSelection?.uploadedFileUrl && (
                                  <p className="text-xs text-purple-700 dark:text-purple-400">
                                    A custom pattern will be assigned later. No standard pattern will be selected.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Group Level Details */}
                        <div className="space-y-3">
                          {groups.length > 0 ? (
                            (isHubMode
                              ? groups.filter(g => !g._hubExtra || getPatternSelection(discipline.id, g.id)?.patternId || groups.indexOf(g) < 2)
                              // Non-hub mode: hide phantom groups that have no divisions
                              // assigned AND no pattern selection — they show up as
                              // empty "Select Pattern" rows the user can't delete.
                              : groups.filter(g => (g.divisions && g.divisions.length > 0) || getPatternSelection(discipline.id, g.id)?.patternId)
                            ).map((group, groupIndex) => {
                              const currentSelection = getPatternSelection(discipline.id, group.id);
                              const filteredPatterns = getFilteredPatterns(discipline.id);
                              const hubGroupIndex = isHubMode ? groups.filter(g => !g._hubExtra || groups.indexOf(g) <= groups.indexOf(group)).indexOf(group) : groupIndex;
                              const isSingleGroup = groups.length === 1 && !isHubMode;

                              return (
                                <div
                                  key={group.id}
                                  className={cn(
                                    "space-y-3 sm:space-y-4",
                                    !isSingleGroup && "p-3 sm:p-4 border-2 border-primary rounded-lg bg-primary/5 shadow-sm ring-1 ring-primary/20"
                                  )}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {!isHubMode && !isSingleGroup && <Label className="font-semibold text-base">{group.name}</Label>}
                                      {/* Hub mode: show entry label with custom name input */}
                                      {isHubMode && groups.filter(g => !g._hubExtra || g === group).length > 0 && (
                                        <div className="flex items-center gap-2">
                                          <Label className="font-semibold text-base">Pattern {hubGroupIndex + 1}</Label>
                                          <Input
                                            className="h-7 text-sm w-40 sm:w-52"
                                            placeholder={`e.g. ${hubGroupIndex === 0 ? 'Monday Practice' : 'Tuesday Practice'}`}
                                            value={group.customLabel || ''}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                              const newLabel = e.target.value;
                                              setFormData(prev => {
                                                const newDisciplines = prev.disciplines.map(d => {
                                                  if (d.id !== discipline.id) return d;
                                                  return {
                                                    ...d,
                                                    patternGroups: (d.patternGroups || []).map(g =>
                                                      g.id === group.id ? { ...g, customLabel: newLabel } : g
                                                    ),
                                                  };
                                                });
                                                return { ...prev, disciplines: newDisciplines };
                                              });
                                            }}
                                          />
                                          {group._hubExtra && !isReadOnly && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setFormData(prev => {
                                                  const newDisciplines = prev.disciplines.map(d => {
                                                    if (d.id !== discipline.id) return d;
                                                    return {
                                                      ...d,
                                                      patternGroups: (d.patternGroups || []).filter(g => g.id !== group.id),
                                                    };
                                                  });
                                                  // Also remove pattern selection for this group
                                                  const newSelections = { ...(prev.patternSelections || {}) };
                                                  if (newSelections[discipline.id]) {
                                                    delete newSelections[discipline.id][group.id];
                                                  }
                                                  return { ...prev, disciplines: newDisciplines, patternSelections: newSelections };
                                                });
                                              }}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                      {/* Show pattern badge, judge-assigned badge, or custom-request badge */}
                                      {!isScoresheetOnly && currentSelection?.type === 'judgeAssigned' && (
                                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                                          Judge: {currentSelection.judgeName || 'TBD'}
                                        </Badge>
                                      )}
                                      {!isScoresheetOnly && currentSelection?.type === 'customRequest' && (
                                        <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                                          Custom Pattern
                                        </Badge>
                                      )}
                                      {!isScoresheetOnly && !currentSelection?.type && currentSelection?.patternName && (() => {
                                        const patternName = currentSelection.patternName || '';
                                        // Remove .pdf extension if present
                                        const cleanPatternName = patternName.replace(/\.(pdf|PDF)$/, '');
                                        const version = currentSelection.version || '';
                                        // Format: "WesternRiding0001.L1 (L1)" or just "WesternRiding0001.L1" if no version
                                        const displayText = version && version !== 'ALL' ? `${cleanPatternName} (${version})` : cleanPatternName;
                                        return (
                                          <PatternBadgeWithHover
                                            patternId={currentSelection.patternId}
                                            displayText={displayText}
                                            formData={formData}
                                            scoresheetData={currentSelection.scoresheetData}
                                          />
                                        );
                                        })()}
                                      </div>
                                      {/* Show association badge on right side - get from pattern data */}
                                      {!isScoresheetOnly && currentSelection?.patternId && (() => {
                                        // Get the pattern from database patterns to extract association name
                                        const pattern = (dbPatterns[discipline.id] || []).find(p => p.id === currentSelection.patternId);
                                        const associationName = pattern?.association_name || currentSelection?.filterAssociation;
                                        
                                        if (associationName) {
                                          // Extract just the association abbreviation/name (before dash if present)
                                          const assocDisplay = associationName.split(/[\s-]+/)[0].trim();
                                          return (
                                            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                                              {assocDisplay}
                                            </Badge>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                    {!isSingleGroup && <div className="flex flex-wrap gap-1 mt-2">
                                      {(group.divisions || []).map(div => {
                                        const divisionName = div.division || div.id || '';

                                        // If structured tags exist (from Division & Level step), render separate badges
                                        if (div.category) {
                                          // Parse level name: remove category prefix to get the rest
                                          // e.g., "Open Junior Level 2" with category "Open" → "Junior Level 2"
                                          const categoryPrefix = div.category;
                                          let remainder = divisionName;
                                          if (remainder.toLowerCase().startsWith(categoryPrefix.toLowerCase())) {
                                            remainder = remainder.slice(categoryPrefix.length).trim();
                                          }

                                          // Split remainder into division and level parts
                                          // e.g., "Junior Level 2" → division="Junior", level="Level 2"
                                          // e.g., "All Aged" → just show as-is
                                          // e.g., "Senior Level 1" → division="Senior", level="Level 1"
                                          const levelMatch = remainder.match(/^(.*?)\s*(Level\s+\d+)$/i);
                                          const tags = [categoryPrefix];
                                          if (levelMatch) {
                                            const divPart = levelMatch[1].trim();
                                            const levelPart = levelMatch[2].trim();
                                            if (divPart) tags.push(divPart);
                                            tags.push(levelPart);
                                          } else if (remainder) {
                                            tags.push(remainder);
                                          }

                                          return tags.map((tag, tagIdx) => (
                                            <Badge
                                              key={`${div.id || divisionName}-${tagIdx}`}
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              {tag}
                                            </Badge>
                                          ));
                                        }

                                        // Fallback: remove first word for legacy division format
                                        const removeFirstWord = (name) => {
                                          if (!name) return name;
                                          let cleaned = name;
                                          cleaned = cleaned.replace(/^[^\s-]+\s*[-–—]\s*/, '').trim();
                                          cleaned = cleaned.replace(/^(Pro|Non-Pro)\s*[-–—]?\s*/i, '').trim();
                                          if (cleaned === name) {
                                            const parts = name.split(/\s+/);
                                            if (parts.length > 1 && !/^(Pro|Non-Pro)$/i.test(parts[0])) {
                                              cleaned = parts.slice(1).join(' ');
                                            } else if (parts.length > 1) {
                                              cleaned = parts.slice(1).join(' ').replace(/^\s*[-–—]\s*/, '').trim();
                                            }
                                          }
                                          return cleaned || name;
                                        };
                                        const displayName = removeFirstWord(divisionName);

                                        return (
                                          <Badge
                                            key={div.id || `${div.assocId}-${div.division}`}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {displayName}
                                          </Badge>
                                        );
                                      })}
                                    </div>}
                                  </div>

                                {/* Judge/Custom badges shown inline at group level (controls moved to discipline level) */}

                                {/* Pattern Selection - Only show for non-scoresheet-only disciplines and when not judge-assigned/custom-request */}
                                {!isScoresheetOnly && currentSelection?.type !== 'judgeAssigned' && currentSelection?.type !== 'customRequest' && (
                                  <div className="space-y-2">
                                      <Label className="text-sm text-muted-foreground">Pattern Selection</Label>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                          {/* Pattern Selector */}
                                          <div>
                                              <Label className="text-xs text-muted-foreground mb-1 block">Select Pattern</Label>
                                          <Select
                                            value={currentSelection?.patternId?.toString() || ''}
                                            onValueChange={(value) => {
                                                const selectedPattern = (dbPatterns[discipline.id] || []).find(p => p.id.toString() === value);
                                                const patternManeuversRange = selectedPattern?.maneuvers_range || '';
                                                handleGroupPatternSelect(discipline.id, group.id, value, patternManeuversRange);
                                            }}
                                        >
                                                <SelectTrigger className="bg-background [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words">
                                                <SelectValue placeholder="Select Pattern" />
                                            </SelectTrigger>
                                            <SelectContent
                                                className="max-h-[300px]"
                                            >
                                                {(() => {
                                                    let filtered = getFilteredPatterns(discipline.id);

                                                    // Check if this is an open-show discipline
                                                    const isOpenShowDiscipline = discipline?.selectedAssociations?.['open-show'] || 
                                                                                 discipline?.association_id === 'open-show';
                                                    
                                                    // For open-show disciplines, show all patterns without association filtering
                                                    // For other disciplines, filter by group associations
                                                    if (!isOpenShowDiscipline) {
                                                        // If filterAssociation is set from Step 3, use only that association
                                                        // Otherwise, use all associations in the group
                                                        let associationNamesToFilter = [];
                                                        
                                                        if (currentSelection?.filterAssociation) {
                                                            // Use the saved filterAssociation value from Step 3
                                                            associationNamesToFilter = [currentSelection.filterAssociation];
                                                        } else {
                                                            // Fallback to group associations based on Primary logic
                                                        const groupAssociations = getGroupAssociationNames(group, discipline);
                                                            associationNamesToFilter = [...groupAssociations.names, ...groupAssociations.abbreviations, ...groupAssociations.ids];
                                                        }
                                                        
                                                        if (associationNamesToFilter.length > 0) {
                                                            const filteredByAssoc = filtered.filter(pattern => {
                                                                // OP (user-uploaded Original Patterns) are already matched by
                                                                // discipline at query time and don't carry legacy association
                                                                // names — always let them through the association filter.
                                                                if (pattern.__op) return true;
                                                                const patternAssocName = (pattern.association_name || '').trim();
                                                                if (!patternAssocName) {
                                                                    // If pattern has no association name, exclude it (patterns should have association names)
                                                                    return false;
                                                                }
                                                                
                                                                const patternAssocLower = patternAssocName.toLowerCase();
                                                                
                                                                return associationNamesToFilter.some(assocName => {
                                                                    const assocNameLower = (assocName || '').trim().toLowerCase();
                                                                    if (!assocNameLower) return false;
                                                                    
                                                                    // 1. Exact match (case-insensitive)
                                                                    if (patternAssocLower === assocNameLower) return true;
                                                                    
                                                                    // 2. Pattern starts with association abbreviation (e.g., "AQHA - ..." matches "AQHA")
                                                                    if (patternAssocLower.startsWith(assocNameLower + ' ') || 
                                                                        patternAssocLower.startsWith(assocNameLower + '-')) {
                                                                        return true;
                                                                    }
                                                                    
                                                                    // 3. Association abbreviation matches pattern's first word before dash/space
                                                                    // (e.g., "AQHA" matches "AQHA - American Quarter Horse Association")
                                                                    const patternFirstPart = patternAssocLower.split(/[\s-]+/)[0];
                                                                    if (patternFirstPart === assocNameLower) return true;
                                                                    
                                                                    // 4. Pattern contains full association name (for cases like "American Quarter Horse Association" in pattern)
                                                                    // Only if the association name is longer than 3 chars to avoid false matches
                                                                    if (assocNameLower.length > 3 && patternAssocLower.includes(assocNameLower)) {
                                                                        return true;
                                                                    }
                                                                    
                                                                    return false;
                                                                });
                                                            });
                                                            
                                                            // Use filtered results if we found matches, otherwise show "No patterns found"
                                                            if (filteredByAssoc.length > 0) {
                                                                // Deduplicate by pattern ID to avoid showing same pattern multiple times
                                                                const seenIds = new Set();
                                                                filtered = filteredByAssoc.filter(pattern => {
                                                                    if (seenIds.has(pattern.id)) {
                                                                        return false;
                                                                    }
                                                                    seenIds.add(pattern.id);
                                                                    return true;
                                                                });
                                                            } else {
                                                                // If no matches found for this group's association, show empty (will display "No patterns")
                                                                filtered = [];
                                                            }
                                                        } else {
                                                            // If group has no associations identified, show empty (will display "No patterns")
                                                            filtered = [];
                                                        }
                                                    }
                                                    // For open-show disciplines, keep all filtered patterns (no association filtering)

                                                    // Filter by group-level difficulty if set
                                                    const groupDifficulty = currentSelection?.version;
                                                    if (groupDifficulty && groupDifficulty !== 'ALL') {
                                                        filtered = filtered.filter(p => p.pattern_version === groupDifficulty);
                                                    }
                                                    
                                                    // Final deduplication by pattern ID (in case same pattern appears multiple times)
                                                    const uniquePatterns = [];
                                                    const seenPatternIds = new Set();
                                                    filtered.forEach(pattern => {
                                                        if (!seenPatternIds.has(pattern.id)) {
                                                            seenPatternIds.add(pattern.id);
                                                            uniquePatterns.push(pattern);
                                                        }
                                                    });
                                                    filtered = uniquePatterns;
                                                    
                                                    // Sort by discipline first, then by pattern number within each discipline
                                                    filtered.sort((a, b) => {
                                                        const nameA = a.pdf_file_name?.trim() || '';
                                                        const nameB = b.pdf_file_name?.trim() || '';
                                                        const disciplineA = a.discipline?.trim() || '';
                                                        const disciplineB = b.discipline?.trim() || '';
                                                        
                                                        // First sort by discipline (alphabetically)
                                                        if (disciplineA !== disciplineB) {
                                                            return disciplineA.localeCompare(disciplineB);
                                                        }
                                                        
                                                        // Within the same discipline, sort by pattern number
                                                        const extractPatternNumber = (fileName) => {
                                                            // Try to match trailing digits before optional dot/extension
                                                            const match = fileName.match(/(\d+)(?:\..*)?$/);
                                                            if (match) {
                                                                return parseInt(match[1], 10);
                                                            }
                                                            // Fallback: try to find any number in the filename
                                                            const anyNumber = fileName.match(/\d+/);
                                                            return anyNumber ? parseInt(anyNumber[0], 10) : 0;
                                                        };
                                                        
                                                        const numA = extractPatternNumber(nameA);
                                                        const numB = extractPatternNumber(nameB);
                                                        
                                                        // Sort by numeric value within the same discipline
                                                        if (numA !== numB) {
                                                            return numA - numB;
                                                        }
                                                        return nameA.localeCompare(nameB, undefined, { numeric: true });
                                                    });

                                                    if (filtered.length === 0) {
                                                        return <SelectItem value="none" disabled>No patterns</SelectItem>;
                                                    }

                                                    return filtered.map((p) => {
                                                        const patternNumber = extractPatternNumber(p.pdf_file_name);
                                                        const version = p.pattern_version || 'ALL';
                                                        
                                                        // Display label as "Pattern 1", "Pattern 2", etc.
                                                        const displayLabel = patternNumber !== null 
                                                            ? `Pattern ${patternNumber}`
                                                            : `Pattern ${p.id}`;
                                                        
                                                        const isOpItem = !!p.__op;
                                                        const opLabel = isOpItem
                                                            ? (p.pdf_file_name?.replace(/\.pdf$/i, '') || displayLabel)
                                                            : displayLabel;
                                                        return (
                                                            <SelectItem
                                                                key={p.id}
                                                                value={p.id.toString()}
                                                            >
                                                                <div className="flex items-center gap-2 w-full">
                                                                    <span className="whitespace-normal break-words">{opLabel}</span>
                                                                    {isOpItem && (
                                                                        p.__isCapo ? (
                                                                            <Badge variant="outline" className="text-xs flex-shrink-0 bg-purple-50 text-purple-700 border-purple-300">CAPO</Badge>
                                                                        ) : (
                                                                            <Badge variant="outline" className="text-xs flex-shrink-0 bg-amber-50 text-amber-700 border-amber-300">OP</Badge>
                                                                        )
                                                                    )}
                                                                    {version && version !== 'ALL' && (
                                                                        <Badge variant="outline" className="text-xs flex-shrink-0">{version}</Badge>
                                                                    )}
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    });
                                                })()}
                                            </SelectContent>
                                        </Select>
                                        </div>
                                        
                                        {/* Difficulty Dropdown */}
                                        <div>
                                            <Label className="text-xs text-muted-foreground mb-1 block">Select Difficulty</Label>
                                            <Select 
                                                value={currentSelection?.version || 'ALL'}
                                                onValueChange={(value) => {
                                                    // Update the version in formData
                                                    setFormData(prev => {
                                                        const newSelections = { ...(prev.patternSelections || {}) };
                                                        if (!newSelections[discipline.id]) newSelections[discipline.id] = {};
                                                        if (newSelections[discipline.id][group.id]) {
                                                            newSelections[discipline.id][group.id] = {
                                                                ...newSelections[discipline.id][group.id],
                                                                version: value
                                                            };
                                                        } else {
                                                            // If no pattern selected yet, just set the version
                                                            newSelections[discipline.id][group.id] = {
                                                                maneuversRange: '',
                                                                patternId: null,
                                                                patternName: null,
                                                                version: value
                                                            };
                                                        }
                                                        return { ...prev, patternSelections: newSelections };
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="bg-background">
                                                    <SelectValue placeholder="Select difficulty..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PATTERN_VERSIONS.map(version => (
                                                        <SelectItem key={version.id} value={version.id}>
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn("h-2 w-2 rounded-full", version.dotColor)} />
                                                                <span>{version.label}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    
                                        {/* Pattern preview is handled by PatternBadgeWithHover (eye icon hover) */}
                                  </div>
                                )}
                              </div>
                            );
                          })
                          ) : (
                            <div className="p-4 border rounded-lg bg-muted/30 text-center text-sm text-muted-foreground">
                              No groups configured. Please go back to Step 3 to configure divisions.
                            </div>
                          )}

                          {/* Hub mode: Add Another Pattern button (max 2 per discipline) */}
                          {isHubMode && !isReadOnly && !isScoresheetOnly && groups.length > 0 && groups.length < 2 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-2 border-dashed"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData(prev => {
                                  const newDisciplines = prev.disciplines.map(d => {
                                    if (d.id !== discipline.id) return d;
                                    const baseGroup = d.patternGroups[0];
                                    const newGroup = {
                                      ...baseGroup,
                                      id: `hub-extra-${Date.now()}`,
                                      name: `${baseGroup.name} (2)`,
                                      customLabel: '',
                                      _hubExtra: true,
                                    };
                                    return {
                                      ...d,
                                      patternGroups: [...(d.patternGroups || []), newGroup],
                                    };
                                  });
                                  return { ...prev, disciplines: newDisciplines };
                                });
                              }}
                            >
                              <ListPlus className="h-4 w-4" />
                              Add Another Pattern
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </section>
        )}

        {/* Assign Pattern Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Pattern</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="dialog-due-date" className="text-sm">Due Date</Label>
                  {dialogDueDate && dialogDueDate.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDialogDueDate('')}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Remove Date
                    </Button>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dialogDueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dialogDueDate ? format(parseLocalDate(dialogDueDate), 'EEE, MMM d') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dialogDueDate ? parseLocalDate(dialogDueDate) : undefined}
                      onSelect={(date) => setDialogDueDate(date ? format(date, 'yyyy-MM-dd') : '')}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssignPattern}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </CardContent>

        {/* Pattern Preview Modal */}
        <PatternPagePreview
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          discipline={previewDiscipline ? {
              ...previewDiscipline,
              patternGroups: (previewDiscipline.patternGroups || []).map(group => {
                  const selection = getPatternSelection(previewDiscipline.id, group.id);
                  return {
                      ...group,
                      selectedPatternId: selection?.patternId,
                      selectedPatternName: selection?.patternName
                  };
              })
          } : null}
          associationsData={associationsData}
        />

    </motion.div>
  );
};
