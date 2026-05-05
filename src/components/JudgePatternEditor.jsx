import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

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

// Extract pattern number from filename
const extractPatternNumber = (fileName) => {
  if (!fileName) return null;
  const match = fileName.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
};

const JudgePatternEditor = ({ project, userEmail, onSave }) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [patterns, setPatterns] = useState([]);
  const [loadingPatterns, setLoadingPatterns] = useState({});
  const [hoveredPatternId, setHoveredPatternId] = useState(null);
  const [hoveredPatternImage, setHoveredPatternImage] = useState(null);
  const [loadingHoveredImage, setLoadingHoveredImage] = useState(false);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  
  const projectData = project?.project_data || {};
  const disciplines = projectData.disciplines || [];
  const [patternSelections, setPatternSelections] = useState(projectData.patternSelections || {});
  const groupJudges = projectData.groupJudges || {};
  const judgeSelections = projectData.judgeSelections || {};
  
  // Sync patternSelections when projectData changes
  useEffect(() => {
    setPatternSelections(projectData.patternSelections || {});
  }, [projectData.patternSelections]);

  // Get judge name from project data (case-insensitive matching)
  const judgeName = useMemo(() => {
    if (!userEmail || !projectData) return null;
    const userEmailLower = userEmail.toLowerCase();
    
    // Check associationJudges
    const associationJudges = projectData.associationJudges || {};
    for (const assocId in associationJudges) {
      const assocData = associationJudges[assocId];
      const judgesList = assocData?.judges || [];
      const matchedJudge = judgesList.find(j => j.email?.toLowerCase() === userEmailLower);
      if (matchedJudge?.name) return matchedJudge.name;
    }
    
    // Check officials
    const officials = projectData.officials || [];
    const matchedOfficial = officials.find(o => o.email?.toLowerCase() === userEmailLower);
    if (matchedOfficial?.name) return matchedOfficial.name;
    
    return null;
  }, [userEmail, projectData]);

  // Filter disciplines to show only those assigned to this judge
  const assignedDisciplines = useMemo(() => {
    if (!judgeName) return [];
    
    const assigned = [];
    disciplines.forEach((discipline, disciplineIndex) => {
      // Check if judge is assigned at discipline level
      const disciplineJudge = judgeSelections[disciplineIndex];
      if (disciplineJudge && disciplineJudge.toLowerCase().trim() === judgeName.toLowerCase().trim()) {
        assigned.push({ discipline, disciplineIndex });
        return;
      }
      
      // Check if judge is assigned at group level
      const groups = discipline.patternGroups || [];
      const hasGroupAssignment = groups.some((group, groupIndex) => {
        const groupJudge = groupJudges[disciplineIndex]?.[groupIndex];
        return groupJudge && groupJudge.toLowerCase().trim() === judgeName.toLowerCase().trim();
      });
      
      if (hasGroupAssignment) {
        assigned.push({ discipline, disciplineIndex });
      }
    });
    
    return assigned;
  }, [disciplines, judgeName, groupJudges, judgeSelections]);

  // Fetch patterns for a discipline
  const fetchPatternsForDiscipline = async (discipline, disciplineIndex) => {
    const disciplineId = discipline.id;
    if (loadingPatterns[disciplineId]) return;
    
    setLoadingPatterns(prev => ({ ...prev, [disciplineId]: true }));
    
    try {
      // Get associations for this discipline
      const associationIds = [];
      if (discipline.association_id) {
        associationIds.push(discipline.association_id);
      }
      if (discipline.selectedAssociations) {
        Object.keys(discipline.selectedAssociations).forEach(id => {
          if (discipline.selectedAssociations[id] && !associationIds.includes(id)) {
            associationIds.push(id);
          }
        });
      }
      
      // Get groups to determine associations
      const groups = discipline.patternGroups || [];
      const groupAssociations = new Set();
      groups.forEach(group => {
        (group.divisions || []).forEach(div => {
          if (div.assocId) groupAssociations.add(div.assocId);
        });
      });
      groupAssociations.forEach(id => {
        if (!associationIds.includes(id)) {
          associationIds.push(id);
        }
      });
      
      if (associationIds.length === 0) {
        setPatterns(prev => ({ ...prev, [disciplineId]: [] }));
        return;
      }
      
      // Build query - always fetch ALL patterns for the discipline (no difficulty filter)
      // We'll filter by difficulty in the UI based on selected difficulty
      const { data, error } = await supabase
        .from('tbl_patterns')
        .select('id, pdf_file_name, association_name, discipline, pattern_version, maneuvers_range')
        .in('association_name', associationIds)
        .eq('discipline', discipline.name)
        .order('pdf_file_name');
      
      if (error) throw error;
      setPatterns(prev => ({ ...prev, [disciplineId]: data || [] }));
    } catch (error) {
      console.error('Error fetching patterns:', error);
      toast({
        title: 'Error',
        description: 'Failed to load patterns for this discipline.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPatterns(prev => ({ ...prev, [disciplineId]: false }));
    }
  };

  // Fetch patterns when disciplines are assigned
  useEffect(() => {
    assignedDisciplines.forEach(({ discipline, disciplineIndex }) => {
      const disciplineId = discipline.id;
      if (!patterns[disciplineId] && !loadingPatterns[disciplineId]) {
        fetchPatternsForDiscipline(discipline, disciplineIndex);
      }
    });
  }, [assignedDisciplines]);

  // Fetch pattern image on hover
  useEffect(() => {
    const fetchPatternImage = async () => {
      if (!hoveredPatternId) {
        setHoveredPatternImage(null);
        setLoadingHoveredImage(false);
        return;
      }
      
      setLoadingHoveredImage(true);
      setHoveredPatternImage(null);
      
      try {
        const { data, error } = await supabase
          .from('tbl_pattern_media')
          .select('image_url')
          .eq('pattern_id', hoveredPatternId)
          .maybeSingle();
        
        if (error) throw error;
        setHoveredPatternImage(data?.image_url || null);
      } catch (error) {
        console.error('Error fetching pattern image:', error);
        setHoveredPatternImage(null);
      } finally {
        setLoadingHoveredImage(false);
      }
    };
    
    fetchPatternImage();
  }, [hoveredPatternId]);

  // Handle pattern selection change
  const handlePatternChange = (disciplineId, disciplineIndex, groupId, patternId) => {
    if (!project) return;
    
    const updatedSelections = { ...patternSelections };
    
    // Use discipline ID as key (preferred)
    if (!updatedSelections[disciplineId]) {
      updatedSelections[disciplineId] = {};
    }
    
    const selectedPattern = patterns[disciplineId]?.find(p => p.id.toString() === patternId);
    if (selectedPattern) {
      updatedSelections[disciplineId][groupId] = {
        patternId: parseInt(patternId),
        patternName: selectedPattern.pdf_file_name?.trim() || `Pattern ${patternId}`,
        version: selectedPattern.pattern_version || 'ALL',
        maneuversRange: selectedPattern.maneuvers_range || '',
      };
    } else {
      updatedSelections[disciplineId][groupId] = null;
    }
    
    // Update local state immediately for UI
    const updatedProjectData = {
      ...projectData,
      patternSelections: updatedSelections,
    };
    
    // Update local patternSelections state
    setPatternSelections(updatedSelections);
    
    // Call onSave callback if provided
    if (onSave) {
      onSave(updatedProjectData);
    }
  };

  // Handle difficulty change
  const handleDifficultyChange = (disciplineId, disciplineIndex, groupId, difficulty) => {
    if (!project) return;
    
    const updatedSelections = { ...patternSelections };
    
    // Use discipline ID as key (preferred)
    if (!updatedSelections[disciplineId]) {
      updatedSelections[disciplineId] = {};
    }
    
    // Get current selection - try multiple key formats
    let currentSelection = updatedSelections[disciplineId][groupId];
    if (!currentSelection) {
      // Try legacy format
      if (!updatedSelections[disciplineIndex]) {
        updatedSelections[disciplineIndex] = {};
      }
      currentSelection = updatedSelections[disciplineIndex][groupId];
    }
    
    if (currentSelection) {
      // Update existing selection
      updatedSelections[disciplineId][groupId] = {
        ...currentSelection,
        version: difficulty,
      };
      
      // If pattern doesn't match new difficulty, clear it
      if (difficulty !== 'ALL' && currentSelection.patternId) {
        const pattern = patterns[disciplineId]?.find(p => p.id === currentSelection.patternId);
        if (pattern && pattern.pattern_version !== difficulty) {
          // Pattern doesn't match difficulty, clear selection
          updatedSelections[disciplineId][groupId] = {
            ...currentSelection,
            patternId: null,
            patternName: null,
            version: difficulty,
          };
        }
      }
    } else {
      // Create new selection with just difficulty
      updatedSelections[disciplineId][groupId] = {
        version: difficulty,
      };
    }
    
    const updatedProjectData = {
      ...projectData,
      patternSelections: updatedSelections,
    };
    
    // Update local patternSelections state
    setPatternSelections(updatedSelections);
    
    if (onSave) {
      onSave(updatedProjectData);
    }
  };

  // Save changes to database
  const handleSave = async () => {
    if (!project) return;
    
    setIsSaving(true);
    try {
      const updatedProjectData = {
        ...projectData,
        patternSelections,
      };
      
      const { error } = await supabase
        .from('projects')
        .update({ project_data: updatedProjectData })
        .eq('id', project.id);
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Pattern selections have been saved.',
      });
      
      if (onSave) {
        onSave(updatedProjectData);
      }
    } catch (error) {
      console.error('Error saving patterns:', error);
      toast({
        title: 'Error',
        description: 'Failed to save pattern selections.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (assignedDisciplines.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No disciplines assigned to you for this project.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {assignedDisciplines.map(({ discipline, disciplineIndex }) => {
        const disciplineId = discipline.id;
        // Only count groups that have divisions assigned (exclude empty placeholder groups)
        const groups = (discipline.patternGroups || []).filter(g => g.divisions && g.divisions.length > 0);
        const disciplinePatterns = patterns[disciplineId] || [];
        const isLoading = loadingPatterns[disciplineId];
        
        return (
          <Card key={disciplineId}>
            <CardHeader>
              <CardTitle>{discipline.name}</CardTitle>
              <CardDescription>
                {groups.length} Group{groups.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {groups.map((group, groupIndex) => {
                // Try to get selection by discipline ID and group ID first
                let currentSelection = patternSelections[disciplineId]?.[group.id];
                
                // If not found, try by discipline index and group index (legacy format)
                if (!currentSelection) {
                  currentSelection = patternSelections[disciplineIndex]?.[groupIndex];
                }
                
                // If still not found, try by discipline index and group ID
                if (!currentSelection) {
                  currentSelection = patternSelections[disciplineIndex]?.[group.id];
                }
                
                const selectedPatternId = currentSelection?.patternId?.toString();
                const selectedDifficulty = currentSelection?.version || 'ALL';
                
                // Filter patterns by selected difficulty - show ALL patterns when difficulty is "ALL"
                let filteredPatterns = disciplinePatterns;
                if (selectedDifficulty && selectedDifficulty !== 'ALL') {
                  filteredPatterns = disciplinePatterns.filter(p => 
                    (p.pattern_version || 'ALL') === selectedDifficulty
                  );
                }
                // When difficulty is "ALL", show all patterns (no filtering)
                
                // Sort patterns by number
                const sortedPatterns = [...filteredPatterns].sort((a, b) => {
                  const numA = extractPatternNumber(a.pdf_file_name) || 0;
                  const numB = extractPatternNumber(b.pdf_file_name) || 0;
                  return numA - numB;
                });
                
                return (
                  <div key={group.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Label className="font-semibold text-base">{group.name}</Label>
                          {currentSelection?.patternName && (
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs">
                              {currentSelection.patternName}
                            </Badge>
                          )}
                        </div>
                        {/* Show divisions if available */}
                        {group.divisions && group.divisions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {group.divisions.map((div, divIdx) => {
                              // Handle different division formats
                              const divisionName = div.division || div.name || div.id || 'Unknown Division';
                              const divisionKey = div.id || `${div.assocId}-${div.division}-${divIdx}`;
                              
                              return (
                                <Badge
                                  key={divisionKey}
                                  variant="secondary"
                                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                >
                                  {divisionName}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Select Pattern</Label>
                        {isLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading patterns...
                          </div>
                        ) : (
                            <Select
                            value={selectedPatternId || ''}
                            onValueChange={(value) => handlePatternChange(disciplineId, disciplineIndex, group.id, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Pattern" />
                            </SelectTrigger>
                            <SelectContent>
                              {sortedPatterns.length === 0 ? (
                                <SelectItem value="none" disabled>No patterns available</SelectItem>
                              ) : (
                                sortedPatterns.map((pattern) => {
                                  const patternNumber = extractPatternNumber(pattern.pdf_file_name);
                                  const version = pattern.pattern_version || 'ALL';
                                  const displayLabel = patternNumber !== null 
                                    ? `Pattern ${patternNumber}`
                                    : `Pattern ${pattern.id}`;
                                  
                                  return (
                                    <SelectItem 
                                      key={pattern.id} 
                                      value={pattern.id.toString()}
                                      onMouseEnter={(e) => {
                                        setHoveredPatternId(pattern.id);
                                        const screenWidth = window.innerWidth;
                                        const screenHeight = window.innerHeight;
                                        setHoverPosition({ 
                                          x: screenWidth / 2, 
                                          y: screenHeight / 2 
                                        });
                                      }}
                                      onMouseLeave={() => {
                                        setTimeout(() => {
                                          setHoveredPatternId(prev => prev === pattern.id ? null : prev);
                                        }, 100);
                                      }}
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <span className="whitespace-normal break-words">{displayLabel}</span>
                                        {version && version !== 'ALL' && (
                                          <Badge variant="outline" className="text-xs flex-shrink-0">{version}</Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  );
                                })
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Select Difficulty</Label>
                        <Select
                          value={selectedDifficulty}
                          onValueChange={(value) => handleDifficultyChange(disciplineId, disciplineIndex, group.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PATTERN_VERSIONS.map(version => (
                              <SelectItem key={version.id} value={version.id}>
                                <div className="flex items-center gap-2">
                                  <div className={cn('w-2 h-2 rounded-full', version.dotColor)} />
                                  <span>{version.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
      
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
      
      {/* Pattern Preview Hover - Using Portal for proper z-index */}
      {hoveredPatternId && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] pointer-events-auto"
          style={{
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
          onMouseEnter={() => {}} // Keep preview open when hovering over it
          onMouseLeave={() => {
            setHoveredPatternId(null);
            setHoveredPatternImage(null);
          }}
        >
          <div className="bg-background border rounded-lg shadow-lg p-3 w-96 max-w-[90vw]">
            {loadingHoveredImage ? (
              <div className="w-full h-40 rounded border bg-muted flex items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading preview...
              </div>
            ) : hoveredPatternImage ? (
              <>
                <img 
                  src={hoveredPatternImage} 
                  alt="Pattern Preview" 
                  className="w-full h-auto rounded border"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const errorDiv = e.target.nextSibling;
                    if (errorDiv) errorDiv.style.display = 'flex';
                  }}
                />
                <div className="w-full h-40 rounded border bg-muted flex items-center justify-center text-muted-foreground text-sm hidden">
                  No preview available
                </div>
              </>
            ) : (
              <div className="w-full h-40 rounded border bg-muted flex items-center justify-center text-muted-foreground text-sm">
                No preview available
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default JudgePatternEditor;

