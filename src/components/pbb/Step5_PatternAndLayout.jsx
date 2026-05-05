import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar, Users, UserCheck, Trash2, Trophy, MapPin, Eye, AlertCircle, Loader2 } from 'lucide-react';
import { cn, parseLocalDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabaseClient';
import { getPatternSelectionForAssoc, writePatternSelectionForAssoc, forEachPatternSelection, detectShowAssociations } from '@/lib/patternSelectionHelpers';

// Pattern Sets with version categories (ALL = universal, GR/NOV = Green/Novice simplified)
const PATTERN_SETS = [
  { setNumber: 1, name: 'Pattern 1-9', maneuvers: { ALL: 11, 'GR/NOV': 9 } },
  { setNumber: 2, name: 'Pattern 1-15', maneuvers: { ALL: 11, 'GR/NOV': 9 } },
  { setNumber: 3, name: 'Pattern 1-20', maneuvers: { ALL: 12, 'GR/NOV': 10 } },
];

// Pattern version categories
const PATTERN_VERSIONS = [
  { id: 'ALL', label: 'ALL (Universal)', description: 'Valid for every class', color: 'bg-blue-100 text-blue-800' },
  { id: 'GR/NOV', label: 'GR/NOV (Green/Novice)', description: 'Simplified for Green/Novice', color: 'bg-teal-100 text-teal-800' },
  { id: 'L1', label: 'L1 (Level 1)', description: 'Simplified for Level 1', color: 'bg-green-100 text-green-800' },
  { id: 'Beginner', label: 'Beginner', description: 'For beginner classes', color: 'bg-purple-100 text-purple-800' },
];

// Helper to detect group type based on division names
// Returns specific type only if ALL divisions match that type, otherwise returns 'ALL' (mixed)
const detectGroupType = (divisions) => {
  if (!divisions || divisions.length === 0) return 'ALL';
  
  const divisionNames = divisions.map(d => (d.name || d.division)?.toLowerCase() || '');
  
  // Check if each division belongs to a specific category
  const categoryCheck = divisionNames.map(name => {
    const isL1 = name.includes('level 1') || name.includes('l1 ') || name.match(/\bl1\b/);
    const isGreen = name.includes('green');
    const isNovice = name.includes('novice') || name.includes('rookie');
    const isBeginner = name.includes('beginner');
    const isWalkTrot = name.includes('walk-trot') || name.includes('walk trot');
    
    // L1 takes priority - if explicitly "Level 1" in name, it's L1 even if also has "Green"
    if (isL1) return 'L1';
    if (isGreen || isNovice) return 'GR/NOV';
    if (isBeginner || isWalkTrot) return 'Beginner';
    return 'standard'; // Open, Amateur, Youth without level qualifiers
  });
  
  // Get unique categories
  const uniqueCategories = [...new Set(categoryCheck)];
  
  // If all divisions are the same specific category, return that category
  if (uniqueCategories.length === 1 && uniqueCategories[0] !== 'standard') {
    return uniqueCategories[0];
  }
  
  // Mixed divisions or all standard = use ALL (universal pattern)
  return 'ALL';
};

    export const Step5_PatternAndLayout = ({ formData, setFormData, associationsData = [] }) => {
  const { toast } = useToast();
  const [calendarOpen, setCalendarOpen] = React.useState({});
  const [openAccordions, setOpenAccordions] = React.useState([]);
  const disciplineRefs = React.useRef({});
  
  // State for database patterns per discipline
  const [dbPatternsMap, setDbPatternsMap] = useState({});
  const [loadingPatterns, setLoadingPatterns] = useState({});
  const [maneuversRangeMap, setManeuversRangeMap] = useState({});

  // Assoc abbrevs the show actually uses — drives multi-breed picker grouping.
  const showAssocAbbrevs = React.useMemo(() => detectShowAssociations(formData), [formData]);

  // Resolve the assoc abbreviation for a discipline (uppercase) or null.
  const getDisciplineAssocAbbrev = (discipline) => {
    if (!discipline) return null;
    const raw = discipline.association_id
      || (discipline.selectedAssociations
          ? Object.keys(discipline.selectedAssociations).find(k => discipline.selectedAssociations[k])
          : null);
    if (!raw) return null;
    // association_id is already an abbreviation-ish string in project data; upper-case it.
    const s = String(raw).trim();
    if (!s) return null;
    // If it happens to be a numeric id, resolve through associationsData.
    if (/^\d+$/.test(s)) {
      const assoc = associationsData?.find(a => String(a.id) === s);
      return assoc?.abbreviation ? String(assoc.abbreviation).toUpperCase() : null;
    }
    return s.toUpperCase();
  };

  // Helper to get pattern selection - checks both ID-based (Step 3) and index-based keys
  const getPatternSelection = (disciplineId, groupId, disciplineIndex, groupIndex, assocAbbrev) => {
    const selections = formData.patternSelections || {};
    // First check ID-based key (from Step 3)
    const idBased = selections[disciplineId];
    if (idBased) {
      const v = getPatternSelectionForAssoc(idBased, groupId, assocAbbrev);
      if (v) return v;
    }
    // Fallback to index-based key (legacy)
    const idxBased = selections[disciplineIndex];
    if (idxBased) {
      return getPatternSelectionForAssoc(idxBased, groupIndex, assocAbbrev);
    }
    return null;
  };

  // Helper to set pattern selection using ID-based keys (scoped to association)
  const setPatternSelection = (disciplineId, groupId, selection, assocAbbrev) => {
    setFormData(prev => {
      const newSelections = { ...(prev.patternSelections || {}) };
      const discSel = newSelections[disciplineId] || {};
      newSelections[disciplineId] = writePatternSelectionForAssoc(discSel, groupId, assocAbbrev, selection);
      return { ...prev, patternSelections: newSelections };
    });
  };

  const handlePatternSelection = (disciplineIndex, groupIndex, patternId, assocAbbrev) => {
    setFormData(prev => {
      const newSelections = { ...(prev.patternSelections || {}) };
      const discSel = newSelections[disciplineIndex] || {};
      newSelections[disciplineIndex] = writePatternSelectionForAssoc(discSel, groupIndex, assocAbbrev, patternId);
      return { ...prev, patternSelections: newSelections };
    });
  };
  
  // Fetch patterns from database for a discipline
  const fetchPatternsForDiscipline = async (disciplineId, disciplineName, associationName) => {
    if (dbPatternsMap[disciplineId]) return; // Already fetched
    
    setLoadingPatterns(prev => ({ ...prev, [disciplineId]: true }));
    try {
      // Use exact match (case-insensitive) to avoid matching substrings
      // For example, "Reining" should not match "Ranch Reining"
      let query = supabase
        .from('tbl_patterns')
        .select('id, pdf_file_name, maneuvers_range, pattern_version, discipline, association_name')
        .ilike('discipline', disciplineName);
      
      if (associationName) {
        query = query.ilike('association_name', `%${associationName}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setDbPatternsMap(prev => ({ ...prev, [disciplineId]: data || [] }));
    } catch (err) {
      console.error('Error fetching patterns:', err);
      setDbPatternsMap(prev => ({ ...prev, [disciplineId]: [] }));
    } finally {
      setLoadingPatterns(prev => ({ ...prev, [disciplineId]: false }));
    }
  };
  
  // Get association name for a discipline
  const getAssociationName = (discipline) => {
    if (discipline?.association_id) {
      const assoc = associationsData?.find(a => a.id === discipline.association_id);
      if (assoc) return assoc.name || assoc.abbreviation;
    }
    return null;
  };
  
  // Sync maneuversRangeMap with formData on mount
  useEffect(() => {
    const newManeuversMap = {};
    const patternSelections = formData.patternSelections || {};
    
    Object.keys(patternSelections).forEach(disciplineId => {
      const disciplineSelections = patternSelections[disciplineId] || {};
      forEachPatternSelection(disciplineSelections, (groupId, _abbrev, selection) => {
        if (selection?.maneuversRange) {
          newManeuversMap[`${disciplineId}-${groupId}`] = selection.maneuversRange;
        }
      });
    });
    
    if (Object.keys(newManeuversMap).length > 0) {
      setManeuversRangeMap(newManeuversMap);
    }
  }, [formData.patternSelections]);
  
  // Pre-fetch patterns for all pattern disciplines on mount
  useEffect(() => {
    const patternDisciplines = (formData.disciplines || []).filter(d => d.pattern);
    patternDisciplines.forEach(discipline => {
      const associationName = getAssociationName(discipline);
      fetchPatternsForDiscipline(discipline.id, discipline.name, associationName);
    });
  }, [formData.disciplines]);

  // Auto-select the only matching pattern when a discipline resolves to a
  // single association AND exactly one DB pattern exists for the group's
  // maneuvers range. Never overwrites an existing user selection.
  useEffect(() => {
    const disciplines = (formData.disciplines || []).filter(d => d.pattern);
    disciplines.forEach((discipline) => {
      const abbrev = getDisciplineAssocAbbrev(discipline);
      if (!abbrev) return;
      const dbPatterns = dbPatternsMap[discipline.id];
      if (!Array.isArray(dbPatterns) || dbPatterns.length === 0) return;
      const disciplineIndex = (formData.disciplines || []).findIndex(d => d.id === discipline.id);
      (discipline.patternGroups || []).forEach((group, groupIndex) => {
        const existing = getPatternSelection(discipline.id, group.id, disciplineIndex, groupIndex, abbrev);
        if (existing?.patternId) return; // don't overwrite
        const range = existing?.maneuversRange || maneuversRangeMap[`${discipline.id}-${group.id}`];
        const candidates = range
          ? dbPatterns.filter(p => p.maneuvers_range === range)
          : dbPatterns;
        if (candidates.length !== 1) return;
        const p = candidates[0];
        const patternAbbrev = p.association_name
          ? String(p.association_name).trim().toUpperCase()
          : abbrev;
        setPatternSelection(discipline.id, group.id, {
          maneuversRange: p.maneuvers_range || range || null,
          patternId: p.id,
          patternName: p.pdf_file_name?.trim() || `Pattern ${p.id}`,
          version: p.pattern_version || 'ALL',
          association_abbrev: patternAbbrev,
          association_name: p.association_name || null,
        }, patternAbbrev);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbPatternsMap, formData.disciplines]);

  const handleDueDateChange = (disciplineIndex, groupIndex, date) => {
    setFormData(prev => {
      const newDueDates = { ...(prev.groupDueDates || {}) };
      if (!newDueDates[disciplineIndex]) newDueDates[disciplineIndex] = {};
      newDueDates[disciplineIndex][groupIndex] = date;
      return { ...prev, groupDueDates: newDueDates };
    });
    // Close the specific calendar after selection
    const key = `${disciplineIndex}-${groupIndex}`;
    setCalendarOpen(prev => ({ ...prev, [key]: false }));
  };

  const handleStaffSelection = (disciplineIndex, groupIndex, staffId) => {
    setFormData(prev => {
      const newStaff = { ...(prev.groupStaff || {}) };
      if (!newStaff[disciplineIndex]) newStaff[disciplineIndex] = {};
      newStaff[disciplineIndex][groupIndex] = staffId;
      return { ...prev, groupStaff: newStaff };
    });
  };

  const handleJudgeSelection = (disciplineIndex, groupIndex, judgeId) => {
    setFormData(prev => {
      const newJudges = { ...(prev.groupJudges || {}) };
      if (!newJudges[disciplineIndex]) newJudges[disciplineIndex] = {};
      newJudges[disciplineIndex][groupIndex] = judgeId;
      return { ...prev, groupJudges: newJudges };
    });
  };

  const handleLayoutSelection = (layoutId) => {
    setFormData(prev => ({ ...prev, layoutSelection: layoutId }));
  };

  const handleDeletePatternGroup = (disciplineIndex, groupIndex) => {
    setFormData(prev => {
      const newDisciplines = [...(prev.disciplines || [])];
      const discipline = newDisciplines[disciplineIndex];
      const deletedGroupId = discipline?.patternGroups?.[groupIndex]?.id;
      
      if (discipline && discipline.patternGroups) {
        const deletedGroup = discipline.patternGroups[groupIndex];
        const updatedPatternGroups = discipline.patternGroups.filter((_, idx) => idx !== groupIndex);
        newDisciplines[disciplineIndex] = {
          ...discipline,
          patternGroups: updatedPatternGroups
        };
        
        // Also clear related data for this group
        const newPatternSelections = { ...(prev.patternSelections || {}) };
        const newGroupDueDates = { ...(prev.groupDueDates || {}) };
        const newGroupStaff = { ...(prev.groupStaff || {}) };
        const newGroupJudges = { ...(prev.groupJudges || {}) };
        
        if (newPatternSelections[disciplineIndex]) {
          delete newPatternSelections[disciplineIndex][groupIndex];
        }
        if (discipline?.id && newPatternSelections[discipline.id]) {
          if (deletedGroupId) delete newPatternSelections[discipline.id][deletedGroupId];
          delete newPatternSelections[discipline.id][groupIndex];
        }
        if (newGroupDueDates[disciplineIndex]) {
          delete newGroupDueDates[disciplineIndex][groupIndex];
        }
        if (newGroupStaff[disciplineIndex]) {
          delete newGroupStaff[disciplineIndex][groupIndex];
        }
        if (newGroupJudges[disciplineIndex]) {
          delete newGroupJudges[disciplineIndex][groupIndex];
        }
        
        toast({
          title: "Pattern group deleted",
          description: "The pattern group has been removed from all steps."
        });
        
        return { 
          ...prev, 
          disciplines: newDisciplines,
          patternSelections: newPatternSelections,
          groupDueDates: newGroupDueDates,
          groupStaff: newGroupStaff,
          groupJudges: newGroupJudges
        };
      }
      
      return prev;
    });
  };
      
      const patternDisciplines = (formData.disciplines || []).filter(d => d.pattern && (d.patternGroups || []).length > 0);

      // Format date range
      const dateRange = formData.startDate && formData.endDate 
        ? `${format(parseLocalDate(formData.startDate), 'MMM d')} - ${format(parseLocalDate(formData.endDate), 'MMM d, yyyy')}`
        : 'Dates not set';

      // Check if a discipline is complete (all groups have patterns assigned)
      const isDisciplineComplete = (pbbDiscipline, disciplineIndex) => {
        const groups = pbbDiscipline.patternGroups || [];
        if (groups.length === 0) return false;
        
        const abbrev = getDisciplineAssocAbbrev(pbbDiscipline);
        return groups.every((group, groupIndex) => {
          const selection = getPatternSelection(pbbDiscipline.id, group.id, disciplineIndex, groupIndex, abbrev);
          // Check if selection has both maneuversRange and patternId (new format from Step 3)
          // OR setNumber and version (legacy format)
          return (selection?.maneuversRange && selection?.patternId) || (selection?.setNumber && selection?.version);
        });
      };

      // Scroll to discipline and expand it
      const scrollToDiscipline = (disciplineIndex) => {
        const ref = disciplineRefs.current[disciplineIndex];
        if (ref) {
          ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Expand the accordion for this discipline
          const accordionValue = `discipline-${disciplineIndex}`;
          setOpenAccordions(prev => {
            if (prev.includes(accordionValue)) {
              return prev;
            }
            return [...prev, accordionValue];
          });
        }
      };


      // Extract judges from associationJudges AND showDetails.officials
      const judgesWithAssociations = [];
      const addJudge = (judgeName, assocId) => {
        const association = (formData.associations || []).find(a => a.id === assocId);
        const assocName = association?.name || assocId;
        const existing = judgesWithAssociations.find(j => j.name === judgeName);
        if (existing) {
          if (!existing.associations.includes(assocName)) existing.associations.push(assocName);
        } else {
          judgesWithAssociations.push({ name: judgeName, associations: [assocName] });
        }
      };
      // From associationJudges (legacy/JudgesAndStaff)
      if (formData.associationJudges) {
        Object.keys(formData.associationJudges).forEach(assocId => {
          const assocJudges = formData.associationJudges[assocId]?.judges || [];
          assocJudges.forEach(judge => { if (judge.name) addJudge(judge.name, assocId); });
        });
      }
      // From showDetails.officials (OfficialsStaffSection)
      if (formData.showDetails?.officials) {
        Object.keys(formData.showDetails.officials).forEach(assocId => {
          const judges = formData.showDetails.officials[assocId]?.JUDGE || [];
          judges.forEach(judge => { if (judge.name) addJudge(judge.name, assocId); });
        });
      }
      
      // Get show staff from officials
      const showStaff = formData.officials || [];

      return (
        <motion.div key="step6" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
          <CardHeader>
            <CardTitle>Step 5: Pattern Selection</CardTitle>
            <CardDescription>Assign a pattern to each group for your book.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            
            {/* 3-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left Column - Show Structure */}
              <Card className="p-4 bg-muted/50">
                <h3 className="text-lg font-semibold mb-4">Show Structure</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Trophy className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Show Name</p>
                      <p className="text-muted-foreground">{formData.showName || 'Not set'}</p>
                    </div>
                  </div>

                  {formData.venueName && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">Venue Name</p>
                        <p className="text-muted-foreground">{formData.venueName}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Show Dates</p>
                      <p className="text-muted-foreground">{dateRange}</p>
                    </div>
                  </div>

                  {formData.venueAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">Location</p>
                        <p className="text-muted-foreground">{formData.venueAddress}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Middle Column - Show Staff & Judges */}
              <Card className="p-4 bg-muted/50">
                <div className="space-y-4">
                  {/* Show Staff Section */}
                  {showStaff.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Show Staff</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {showStaff.map((staff, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {staff.role}: {staff.name || 'Not assigned'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Judges Section */}
                  {judgesWithAssociations.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Judges</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {judgesWithAssociations.map((judge, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {judge.name} - {judge.associations.join(', ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Right Column - Discipline Folders */}
              <Card className="p-4 bg-muted/50">
                <h3 className="text-lg font-semibold mb-4">Discipline Folders</h3>
                <div className="text-sm text-muted-foreground mb-4">
                  <p>
                    {patternDisciplines.filter((d, idx) => {
                      const originalDisciplineIndex = (formData.disciplines || []).findIndex(fd => fd.id === d.id);
                      return !isDisciplineComplete(d, originalDisciplineIndex);
                    }).length} of {patternDisciplines.length} disciplines incomplete
                  </p>
                </div>
                <div className="space-y-2">
                  {patternDisciplines.map((pbbDiscipline) => {
                    const originalDisciplineIndex = (formData.disciplines || []).findIndex(fd => fd.id === pbbDiscipline.id);
                    const isComplete = isDisciplineComplete(pbbDiscipline, originalDisciplineIndex);
                    // Count patterns using ID-based keys (from Step 3) or index-based (legacy)
                    const pbbAbbrev = getDisciplineAssocAbbrev(pbbDiscipline);
                    const patternCount = (pbbDiscipline.patternGroups || []).filter((group, gIdx) => {
                      const selection = getPatternSelection(pbbDiscipline.id, group.id, originalDisciplineIndex, gIdx, pbbAbbrev);
                      return selection?.patternId || selection?.patternName || selection?.setNumber;
                    }).length;
                    
                    return (
                      <div
                        key={originalDisciplineIndex}
                        onClick={() => scrollToDiscipline(originalDisciplineIndex)}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{pbbDiscipline.name.replace(' at Halter', '')}</p>
                              <p className="text-xs text-muted-foreground">
                                {patternCount} patterns assigned
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant={isComplete ? "default" : "destructive"}
                            className="flex-shrink-0 text-xs"
                          >
                            {isComplete ? "Complete" : "Incomplete"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {patternDisciplines.length > 0 ? (
              <div>
                <h3 className="text-lg font-semibold mb-4">Pattern Selection</h3>
                <Accordion 
                  type="multiple" 
                  value={openAccordions}
                  onValueChange={setOpenAccordions}
                  className="space-y-4"
                >
                  {patternDisciplines.map((pbbDiscipline) => {
                    const originalDisciplineIndex = (formData.disciplines || []).findIndex(d => d.id === pbbDiscipline.id);
                    const isComplete = isDisciplineComplete(pbbDiscipline, originalDisciplineIndex);
                    const associationName = getAssociationName(pbbDiscipline);
                    const disciplineDbPatterns = dbPatternsMap[pbbDiscipline.id] || [];
                    const isLoadingDiscipline = loadingPatterns[pbbDiscipline.id];
                    
                    // Filter judges by this discipline's association (from both data sources)
                    const disciplineJudges = [];
                    const seenJudgeNames = new Set();
                    const pushJudge = (judge) => {
                      if (judge.name && !seenJudgeNames.has(judge.name)) {
                        seenJudgeNames.add(judge.name);
                        disciplineJudges.push(judge);
                      }
                    };
                    if (pbbDiscipline.association_id) {
                      // From associationJudges (legacy)
                      (formData.associationJudges?.[pbbDiscipline.association_id]?.judges || []).forEach(pushJudge);
                      // From showDetails.officials (OfficialsStaffSection)
                      (formData.showDetails?.officials?.[pbbDiscipline.association_id]?.JUDGE || []).forEach(pushJudge);
                    }
                    
                    // Get unique maneuvers ranges from database patterns
                    const availableManeuversRanges = [...new Set(disciplineDbPatterns.filter(p => p.maneuvers_range).map(p => p.maneuvers_range))];
                    const pbbAbbrev = getDisciplineAssocAbbrev(pbbDiscipline);
                    
                    return (
                    <AccordionItem 
                      key={originalDisciplineIndex} 
                      value={`discipline-${originalDisciplineIndex}`}
                      className="border rounded-lg"
                      ref={(el) => disciplineRefs.current[originalDisciplineIndex] = el}
                      onFocus={() => fetchPatternsForDiscipline(pbbDiscipline.id, pbbDiscipline.name, associationName)}
                      onMouseEnter={() => fetchPatternsForDiscipline(pbbDiscipline.id, pbbDiscipline.name, associationName)}
                    >
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-2">
                          <h4 className="font-bold text-md">{pbbDiscipline.name.replace(' at Halter', '')}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Show all group pattern selections from Step 3 data */}
                            {(() => {
                              const groupSelections = (pbbDiscipline.patternGroups || []).map((group, gIdx) => {
                                const selection = getPatternSelection(pbbDiscipline.id, group.id, originalDisciplineIndex, gIdx, pbbAbbrev);
                                if (!selection?.patternId && !selection?.patternName) return null;
                                
                                const patternName = selection.patternName || '';
                                const match = patternName.match(/PATTERN\s*\d+/i);
                                const shortName = match ? match[0].toUpperCase() : patternName;
                                const version = selection.version || '';
                                const maneuversRange = selection.maneuversRange || '';
                                
                                return {
                                  groupName: group.name,
                                  shortName,
                                  version,
                                  maneuversRange,
                                  displayText: version ? `${shortName} (${version})` : shortName
                                };
                              }).filter(Boolean);
                              
                              return groupSelections.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {groupSelections.map((sel, idx) => (
                                    <Badge key={idx} className="bg-green-100 text-green-800 border-green-200 text-xs whitespace-nowrap">
                                      {sel.displayText}
                                    </Badge>
                                  ))}
                                </div>
                              );
                            })()}
                            {isComplete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-2 text-green-600 hover:text-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast({
                                    title: "Preview Pattern",
                                    description: "Pattern preview will be available soon."
                                  });
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Badge variant={isComplete ? "default" : "destructive"} className="ml-2">
                              {isComplete ? "Complete" : "Incomplete"}
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                      <div className="space-y-6">
                        {(pbbDiscipline.patternGroups || []).map((group, groupIndex) => {
                          const currentSelection = getPatternSelection(pbbDiscipline.id, group.id, originalDisciplineIndex, groupIndex, pbbAbbrev);
                          const selectedManeuversRange = currentSelection?.maneuversRange || maneuversRangeMap[`${pbbDiscipline.id}-${group.id}`] || '';
                          const filteredPatterns = selectedManeuversRange
                            ? disciplineDbPatterns.filter(p => {
                                if (p.maneuvers_range !== selectedManeuversRange) return false;
                                // Prevent mixing: when the group resolves to a specific
                                // association, hide patterns belonging to other associations.
                                if (pbbAbbrev && p.association_name) {
                                  const pAbbrev = String(p.association_name).trim().toUpperCase();
                                  if (pAbbrev !== pbbAbbrev) return false;
                                }
                                return true;
                              })
                            : [];
                          
                          return (
                          <div key={group.id} className="p-4 border rounded-lg bg-muted/30 space-y-4">
                            <div className="mb-3 flex items-start justify-between">
                              <div className="flex-1">
                                <Label className="font-semibold">{group.name}</Label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(group.divisions || []).map(div => (
                                    <Badge key={`${div.assocId}-${div.division}`} variant="secondary" className="text-xs">{div.division}</Badge>
                                  ))}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeletePatternGroup(originalDisciplineIndex, groupIndex)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor={`due-date-${originalDisciplineIndex}-${groupIndex}`} className="text-sm">Due Date</Label>
                                <Popover 
                                  key={`popover-${originalDisciplineIndex}-${groupIndex}`}
                                  open={calendarOpen[`${originalDisciplineIndex}-${groupIndex}`] || false}
                                  onOpenChange={(open) => setCalendarOpen(prev => ({ ...prev, [`${originalDisciplineIndex}-${groupIndex}`]: open }))}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full justify-start text-left font-normal mt-1",
                                        !formData.groupDueDates?.[originalDisciplineIndex]?.[groupIndex] && "text-muted-foreground"
                                      )}
                                    >
                                      <Calendar className="mr-2 h-4 w-4" />
                                      {formData.groupDueDates?.[originalDisciplineIndex]?.[groupIndex] 
                                        ? format(new Date(formData.groupDueDates[originalDisciplineIndex][groupIndex]), "PPP") 
                                        : <span>Pick a date</span>
                                      }
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                      key={`calendar-${originalDisciplineIndex}-${groupIndex}`}
                                      mode="single"
                                      selected={formData.groupDueDates?.[originalDisciplineIndex]?.[groupIndex] ? new Date(formData.groupDueDates[originalDisciplineIndex][groupIndex]) : undefined}
                                      onSelect={(date) => handleDueDateChange(originalDisciplineIndex, groupIndex, date ? format(date, 'yyyy-MM-dd') : '')}
                                      initialFocus
                                      className="pointer-events-auto"
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                              
                              {/* Two-step Pattern Selection: Maneuvers Range → Select Pattern */}
                              <div className="col-span-1 md:col-span-2 space-y-3">
                                <Label className="text-sm font-medium">Pattern Selection</Label>
                                
                                {/* Suggested version based on group divisions */}
                                {(() => {
                                  const suggestedVersion = detectGroupType(group.divisions);
                                  return suggestedVersion !== 'ALL' && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                      <AlertCircle className="h-3 w-3" />
                                      Suggested: <Badge variant="outline" className="text-xs">{suggestedVersion}</Badge> based on divisions
                                    </div>
                                  );
                                })()}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Step 1: Pattern Set (Maneuvers) - Database driven */}
                                  <div>
                                    <Label className="text-xs text-muted-foreground">1. Pattern Set (Maneuvers)</Label>
                                    <Select 
                                      value={selectedManeuversRange}
                                      onValueChange={(value) => {
                                        // Update local state
                                        setManeuversRangeMap(prev => ({ ...prev, [`${pbbDiscipline.id}-${group.id}`]: value }));
                                        // Update formData with maneuversRange, clear patternId
                                        setPatternSelection(pbbDiscipline.id, group.id, {
                                          maneuversRange: value,
                                          patternId: null,
                                          patternName: null,
                                          version: null
                                        }, pbbAbbrev);
                                      }}
                                    >
                                      <SelectTrigger className="mt-1">
                                        {isLoadingDiscipline ? (
                                          <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Loading...</span>
                                          </div>
                                        ) : (
                                          <SelectValue placeholder="Select maneuvers range..." />
                                        )}
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableManeuversRanges.length > 0 ? (
                                          availableManeuversRanges.map(range => (
                                            <SelectItem key={range} value={range}>
                                              {pbbDiscipline.name.replace(' at Halter', '')} Pattern {range}
                                            </SelectItem>
                                          ))
                                        ) : (
                                          // Fallback to static options if no DB patterns
                                          PATTERN_SETS.map(set => (
                                            <SelectItem key={set.setNumber} value={set.setNumber.toString()}>
                                              {pbbDiscipline.name.replace(' at Halter', '')} {set.name}
                                            </SelectItem>
                                          ))
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {/* Step 2: Select Pattern - Database driven */}
                                  <div>
                                    <Label className="text-xs text-muted-foreground">2. Select Pattern</Label>
                                    <Select
                                      value={currentSelection?.patternId?.toString() || ''}
                                      onValueChange={(selectedId) => {
                                        const selectedPattern = filteredPatterns.find(p => p.id.toString() === selectedId);
                                        // Prefer the pattern row's own association (e.g. APHA-specific
                                        // pattern row) for the key; fall back to the discipline abbrev.
                                        const patternAbbrev = selectedPattern?.association_name
                                          ? String(selectedPattern.association_name).trim().toUpperCase()
                                          : pbbAbbrev;
                                        setPatternSelection(pbbDiscipline.id, group.id, {
                                          maneuversRange: selectedManeuversRange,
                                          patternId: parseInt(selectedId),
                                          patternName: selectedPattern?.pdf_file_name?.trim() || `Pattern ${selectedId}`,
                                          version: selectedPattern?.pattern_version || 'ALL',
                                          association_abbrev: patternAbbrev,
                                          association_name: selectedPattern?.association_name || null,
                                        }, patternAbbrev);
                                      }}
                                      disabled={!selectedManeuversRange}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select pattern..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {filteredPatterns.length > 0 ? (
                                          (showAssocAbbrevs.length > 1 ? (() => {
                                            const byAssoc = {};
                                            filteredPatterns.forEach(p => {
                                              const key = p.association_name
                                                ? String(p.association_name).trim().toUpperCase()
                                                : (pbbAbbrev || 'OTHER');
                                              if (!byAssoc[key]) byAssoc[key] = [];
                                              byAssoc[key].push(p);
                                            });
                                            return Object.keys(byAssoc).sort().map(assocKey => (
                                              <SelectGroup key={assocKey}>
                                                <SelectLabel>{assocKey}</SelectLabel>
                                                {byAssoc[assocKey].map(pattern => (
                                                  <SelectItem key={pattern.id} value={pattern.id.toString()}>
                                                    <div className="flex items-center gap-2">
                                                      <span>{pattern.pdf_file_name || `Pattern ${pattern.id}`}</span>
                                                      {pattern.pattern_version && (
                                                        <Badge variant="outline" className="text-xs">
                                                          {pattern.pattern_version}
                                                        </Badge>
                                                      )}
                                                    </div>
                                                  </SelectItem>
                                                ))}
                                              </SelectGroup>
                                            ));
                                          })() : filteredPatterns.map(pattern => (
                                            <SelectItem key={pattern.id} value={pattern.id.toString()}>
                                              <div className="flex items-center gap-2">
                                                <span>{pattern.pdf_file_name || `Pattern ${pattern.id}`}</span>
                                                {pattern.pattern_version && (
                                                  <Badge variant="outline" className="text-xs">
                                                    {pattern.pattern_version}
                                                  </Badge>
                                                )}
                                              </div>
                                            </SelectItem>
                                          )))
                                        ) : (
                                          // Fallback to static version options
                                          PATTERN_VERSIONS.map(version => (
                                            <SelectItem key={version.id} value={version.id}>
                                              <div className="flex items-center gap-2">
                                                <span>{version.label}</span>
                                                <Badge variant="outline" className={`text-xs ${version.color}`}>
                                                  {version.description}
                                                </Badge>
                                              </div>
                                            </SelectItem>
                                          ))
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                
                                {/* Show selected pattern summary */}
                                {currentSelection?.patternName && (
                                  <div className="text-sm bg-muted/50 p-2 rounded flex items-center justify-between">
                                    <span>
                                      <strong>{currentSelection.patternName}</strong>
                                      {' '}
                                      {currentSelection.version && (
                                        <Badge className={PATTERN_VERSIONS.find(v => v.id === currentSelection.version)?.color || 'bg-blue-100 text-blue-800'}>
                                          {currentSelection.version}
                                        </Badge>
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              
                              <div>
                                <Label htmlFor={`staff-${originalDisciplineIndex}-${groupIndex}`} className="text-sm">Assign Staff</Label>
                                <Select 
                                  value={formData.groupStaff?.[originalDisciplineIndex]?.[groupIndex] || ''}
                                  onValueChange={(value) => handleStaffSelection(originalDisciplineIndex, groupIndex, value)}
                                >
                                  <SelectTrigger id={`staff-${originalDisciplineIndex}-${groupIndex}`} className="mt-1">
                                    <SelectValue placeholder="Select staff..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {showStaff.map((staff, idx) => (
                                      <SelectItem key={idx} value={staff.name || idx.toString()}>
                                        {staff.role}: {staff.name || 'Unnamed'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label htmlFor={`judge-${originalDisciplineIndex}-${groupIndex}`} className="text-sm">Assign Judge</Label>
                                <Select 
                                  value={
                                    // Check this group's judge first
                                    formData.groupJudges?.[originalDisciplineIndex]?.[groupIndex] ||
                                    // Fallback to first group's judge (when assigned via Step 6 dialog)
                                    formData.groupJudges?.[originalDisciplineIndex]?.[0] ||
                                    // Fallback to discipline-level judge
                                    formData.judgeSelections?.[originalDisciplineIndex] ||
                                    ''
                                  }
                                  onValueChange={(value) => handleJudgeSelection(originalDisciplineIndex, groupIndex, value)}
                                >
                                  <SelectTrigger id={`judge-${originalDisciplineIndex}-${groupIndex}`} className="mt-1">
                                    <SelectValue placeholder="Select judge..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {disciplineJudges.length > 0 ? (
                                      disciplineJudges.map((judge, idx) => (
                                        <SelectItem key={idx} value={judge.name || idx.toString()}>
                                          {judge.name || 'Unnamed Judge'}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="no-judges" disabled>No judges for this association</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )})}
                      </div>
                      </AccordionContent>
                    </AccordionItem>
                  )})}
                </Accordion>
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">No disciplines require pattern selections.</p>
              </div>
            )}

          </CardContent>
        </motion.div>
      );
    };