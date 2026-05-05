import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

const PatternPagePreview = ({ isOpen, onClose, discipline, associationsData }) => {
  const [currentPage, setCurrentPage] = React.useState(0);
  const [patternData, setPatternData] = React.useState(null);
  const [maneuvers, setManeuvers] = React.useState([]);
  const [patternMedia, setPatternMedia] = React.useState(null);
  const [scoresheetData, setScoresheetData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  
  // Check if this is a scoresheet-only discipline
  const isScoresheetOnly = discipline?.pattern_type === 'scoresheet_only' || (!discipline?.pattern && discipline?.scoresheet);

  // Reset to first page when dialog opens - MUST be before any conditional returns
  React.useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
    }
  }, [isOpen]);

  const groups = discipline?.patternGroups || [];
  const totalPages = groups.length;
  const currentGroup = groups[currentPage];
  // Fetch pattern data when page (group) changes
  React.useEffect(() => {
      const fetchPatternDetails = async () => {
          // For scoresheet-only disciplines, fetch from tbl_scoresheet
          if (isScoresheetOnly) {
              setLoading(true);
              try {
                  // Get association abbreviation(s) from discipline
                  const associationIds = discipline.mergedAssociations || [discipline.association_id];
                  const associationAbbrevs = associationIds
                      .map(id => associationsData?.find(a => a.id === id)?.abbreviation)
                      .filter(Boolean);
                  
                  // Build query to fetch scoresheet by association and discipline name
                  // Try multiple strategies: both filters, then just discipline, then just association
                  let scoresheetData = null;
                  
                  // Strategy 1: Try with both discipline and association abbreviation(s)
                  if (associationAbbrevs.length > 0) {
                      // Try exact match first for each abbreviation
                      for (const abbrev of associationAbbrevs) {
                          const { data, error } = await supabase
                              .from('tbl_scoresheet')
                              .select('*')
                              .ilike('discipline', `%${discipline.name}%`)
                              .eq('association_abbrev', abbrev)
                              .limit(1);
                          
                          if (!error && data && data.length > 0) {
                              scoresheetData = data[0];
                              break;
                          }
                      }
                      
                      // If no exact match, try with ilike for abbreviation
                      if (!scoresheetData) {
                          for (const abbrev of associationAbbrevs) {
                              const { data, error } = await supabase
                                  .from('tbl_scoresheet')
                                  .select('*')
                                  .ilike('discipline', `%${discipline.name}%`)
                                  .ilike('association_abbrev', `%${abbrev}%`)
                                  .limit(1);
                              
                              if (!error && data && data.length > 0) {
                                  scoresheetData = data[0];
                                  break;
                              }
                          }
                      }
                  }
                  
                  // Strategy 2: If still no match, try with just discipline name
                  if (!scoresheetData) {
                      const { data, error } = await supabase
                          .from('tbl_scoresheet')
                          .select('*')
                          .ilike('discipline', `%${discipline.name}%`)
                          .limit(1);
                      
                      if (!error && data && data.length > 0) {
                          scoresheetData = data[0];
                      }
                  }
                  
                  setScoresheetData(scoresheetData);
                  
                  // Clear pattern-related data for scoresheet-only
                  setPatternData(null);
                  setManeuvers([]);
                  setPatternMedia(null);
                  
              } catch (err) {
                  console.error('Error fetching scoresheet preview data:', err);
                  setScoresheetData(null);
              } finally {
                  setLoading(false);
              }
              return;
          }
          
          // For pattern disciplines, fetch pattern data as before
          if (!currentGroup?.selectedPatternId) {
              setPatternData(null);
              setManeuvers([]);
              setPatternMedia(null);
              setScoresheetData(null);
              return;
          }

          setLoading(true);
          try {
              const pid = currentGroup?.selectedPatternId;

              // OP (user-uploaded Original Patterns) live in the `patterns` table
              // with uuid ids prefixed `op:`. Route to that source instead of
              // legacy tbl_patterns / tbl_maneuvers / tbl_pattern_media.
              if (typeof pid === 'string' && pid.startsWith('op:')) {
                  const opUuid = pid.slice(3);
                  const { data: opRow, error: opErr } = await supabase
                      .from('patterns')
                      .select('id, name, original_file_name, class_name, preview_image_url, pattern_number, verbiage, tags')
                      .eq('id', opUuid)
                      .maybeSingle();
                  if (opErr) throw opErr;
                  setPatternData(opRow ? {
                      id: pid,
                      pdf_file_name: opRow.original_file_name || opRow.name,
                      discipline: opRow.class_name,
                      pattern_number: opRow.pattern_number,
                      verbiage: opRow.verbiage,
                      tags: opRow.tags,
                      __op: true,
                  } : null);
                  setManeuvers([]);
                  setPatternMedia(opRow?.preview_image_url ? { image_url: opRow.preview_image_url } : null);
                  setScoresheetData(null);
                  return;
              }

              // 1. Fetch Pattern Details
              const { data: pData, error: pError } = await supabase
                  .from('tbl_patterns')
                  .select('*')
                  .eq('id', pid)
                  .single();

              if (pError) throw pError;
              setPatternData(pData);

              // 2. Fetch Maneuvers
              const { data: mData, error: mError } = await supabase
                  .from('tbl_maneuvers')
                  .select('step_no, instruction')
                  .eq('pattern_id', pid)
                  .order('step_no');

              if (mError) throw mError;
              setManeuvers(mData || []);

              // 3. Fetch Pattern Media (Graph/Image)
              const { data: mediaData, error: mediaError } = await supabase
                  .from('tbl_pattern_media')
                  .select('*')
                  .eq('pattern_id', pid)
                  .maybeSingle(); // Use maybeSingle in case none exists for some

              if (!mediaError && mediaData) {
                  setPatternMedia(mediaData);
              } else {
                  setPatternMedia(null);
              }
              
              // Clear scoresheet data for pattern disciplines
              setScoresheetData(null);

          } catch (err) {
              console.error('Error fetching pattern preview data:', err);
          } finally {
              setLoading(false);
          }
      };

      fetchPatternDetails();
  }, [currentGroup?.selectedPatternId, isScoresheetOnly, discipline, associationsData]);

  // Early return logic - AFTER all hooks have been called
  if (!discipline) return null;

  // Derived state that requires discipline to be present
  const associationIds = discipline.mergedAssociations || [discipline.association_id];
  const associationNames = associationIds
    .map(id => associationsData?.find(a => a.id === id)?.name || id)
    .filter(Boolean);
  const associationFullName = associationNames.join(' • ');

  const disciplineDate = discipline.date 
    ? format(parseLocalDate(discipline.date), 'MM-dd-yyyy')
    : '';

  const handlePrevious = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Pattern Book Preview</span>
            <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              Page {currentPage + 1} of {totalPages}
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Preview of pattern book pages for {discipline?.name || 'selected discipline'}
          </DialogDescription>
        </DialogHeader>

        {/* Pattern Page */}
        <div className="bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 p-8 rounded-lg shadow-lg">
          {/* Header - Association Name */}
          <div className="border-b-4 border-red-500 pb-3 mb-6 text-center">
            {associationNames.map((name, idx) => (
              <h1 key={idx} className="text-2xl font-bold text-red-600 dark:text-red-500">
                {name}
              </h1>
            ))}
          </div>

          {/* Discipline Name */}
          <div className="mb-4 text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {discipline.name.toUpperCase()}
            </h2>
            {currentGroup?.selectedPatternName && (
                <h3 className="text-xl font-medium text-muted-foreground mt-2">
                    {currentGroup.selectedPatternName}
                </h3>
            )}
          </div>

          {/* Group Data - Show actual divisions */}
          {currentGroup && currentGroup.divisions && (
            <div className="mb-6 space-y-1">
              {currentGroup.divisions.map((div, idx) => {
                // Remove first word, "Pro", and "Non-Pro" from division name
                const divisionName = div.division || '';
                const removeFirstWord = (name) => {
                  if (!name) return name;
                  let cleaned = name;
                  
                  // Remove first word and any separator (dash, hyphen, etc.)
                  cleaned = cleaned.replace(/^[^\s-]+\s*[-–—]\s*/, '').trim();
                  
                  // Remove "Pro" or "Non-Pro" at the start
                  cleaned = cleaned.replace(/^(Pro|Non-Pro)\s*[-–—]?\s*/i, '').trim();
                  
                  // If no separator found and still original, try removing just the first word
                  if (cleaned === name) {
                    const parts = name.split(/\s+/);
                    // Skip first word if it's not "Pro" or "Non-Pro"
                    if (parts.length > 1 && !/^(Pro|Non-Pro)$/i.test(parts[0])) {
                      cleaned = parts.slice(1).join(' ');
                    } else if (parts.length > 1) {
                      // If first word is "Pro" or "Non-Pro", remove it and separator if present
                      cleaned = parts.slice(1).join(' ').replace(/^\s*[-–—]\s*/, '').trim();
                    }
                  }
                  
                  return cleaned || name;
                };
                const displayName = removeFirstWord(divisionName);
                
                return (
                  <p key={idx} className="text-base text-gray-800 dark:text-gray-200">
                    {displayName}
                  </p>
                );
              })}
            </div>
          )}

          {/* Pattern Diagram / Scoresheet Image */}
          <div className="my-8 flex items-center justify-center min-h-[300px] bg-muted/10 rounded-lg">
            {loading ? (
                <div className="text-muted-foreground">Loading {isScoresheetOnly ? 'scoresheet' : 'pattern'}...</div>
            ) : (
                (() => {
                    // For scoresheet-only: use scoresheet image
                    if (isScoresheetOnly) {
                        const scoresheetImageUrl = scoresheetData?.image_url || scoresheetData?.file_url;
                        if (scoresheetImageUrl) {
                            return (
                                <img 
                                  src={scoresheetImageUrl} 
                                  alt="Scoresheet" 
                                  className="max-w-full h-auto rounded-lg max-h-[500px]"
                                />
                            );
                        } else {
                            return (
                                <div className="text-center p-8">
                                  <p className="text-sm text-muted-foreground mt-2">No scoresheet image available</p>
                                </div>
                            );
                        }
                    }
                    
                    // For pattern disciplines: determine image source: Media Table > Pattern Table > Placeholder
                    const mediaUrl = patternMedia?.image_url || patternMedia?.media_url || patternMedia?.graphic_url;
                    const patternUrl = patternData?.image_url || patternData?.url;
                    const imageUrl = mediaUrl || patternUrl;

                    if (imageUrl) {
                        return (
                            <div className="overflow-hidden" style={{ maxHeight: '500px' }}>
                                <img
                                  src={imageUrl}
                                  alt="Pattern Diagram"
                                  className="max-w-full h-auto rounded-lg"
                                  style={{ clipPath: 'inset(0 0 12% 0)' }}
                                />
                            </div>
                        );
                    } else {
                        return (
                            <div className="text-center p-8">
                              <p className="text-sm text-muted-foreground mt-2">No specific diagram available</p>
                            </div>
                        );
                    }
                })()
            )}
          </div>

          {/* Pattern steps omitted — maneuvers are already part of the pattern image */}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-700 text-center text-xs text-gray-600 dark:text-gray-400">
            {discipline.name} Patterns 2025 – Page {currentPage + 1}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Group {currentPage + 1} of {totalPages}
          </span>

          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentPage === totalPages - 1}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatternPagePreview;
