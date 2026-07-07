import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Award, BookOpen, Share2, Twitter, Facebook, ExternalLink, Clock, Users, Trophy, Loader2, Building2, Mail, Phone, FileText, Image as ImageIcon, ZoomIn, Download, Printer, ShoppingCart } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { events } from '@/lib/eventsData';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { downloadPatternJpeg, printPatterns, downloadPatternBookPdf, buildBrandedPatternCanvas } from '@/lib/patternExport';

const EventDetailPage = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState(null);
  const [patternsData, setPatternsData] = useState([]);
  const [scoresheetsData, setScoresheetsData] = useState([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  // Full-size image preview (pattern / score sheet) — works for logged-out visitors.
  const [previewImage, setPreviewImage] = useState(null);
  // Rider-facing pattern filters: narrow the pattern list by show date and/or division.
  const [patternDateFilter, setPatternDateFilter] = useState('all');
  const [patternDivisionFilter, setPatternDivisionFilter] = useState('all');
  // Print-ready branded previews (show name + date + divisions + EquiPatterns baked in),
  // keyed by pattern uid — what the rider sees on the page IS the document they download.
  const [brandedPreviews, setBrandedPreviews] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    const fetchEventData = async () => {
      setIsLoading(true);
      try {
        // First try to find in events table
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (eventError) {
          console.error('Error fetching event:', eventError);
        }

        if (eventData) {
          // Convert database fields to display format
          const displayEvent = {
            ...eventData,
            startDate: eventData.start_date,
            endDate: eventData.end_date,
            association: eventData.associations ? (Array.isArray(eventData.associations) ? eventData.associations.join(', ') : JSON.stringify(eventData.associations)) : null,
            website: eventData.show_website || eventData.showWebsite,
          };
          setEvent(displayEvent);
          setIsLoading(false);
          return;
        }

        // If not found in events, try projects table
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (projectError) {
          console.error('Error fetching project:', projectError);
          toast({
            title: 'Error',
            description: 'Failed to load event details',
            variant: 'destructive',
          });
        }

        if (project && project.project_data) {
          const projectDataObj = project.project_data;
          
          // Convert project to event-like format
          const eventFromProject = {
            id: project.id,
            name: project.project_name || 'Untitled Show',
            startDate: projectDataObj.startDate || project.created_at,
            endDate: projectDataObj.endDate || project.created_at,
            location: projectDataObj.showLocation || projectDataObj.location || projectDataObj.venueName || projectDataObj.venueAddress || 'Location TBD',
            status: project.status === 'Publication' ? 'upcoming' : 'recent',
            pattern_book_id: project.id,
            project: { id: project.id, status: project.status },
            isFromProjects: true,
            association: projectDataObj.associations ? Object.keys(projectDataObj.associations).join(', ') : null,
            projectData: projectDataObj, // Store full project_data for display
          };

          setEvent(eventFromProject);
          setProjectData(projectDataObj);
          
          // Fetch patterns and scoresheets data
          if (projectDataObj.patternSelections || projectDataObj.disciplines) {
            fetchPatternsAndScoresheets(projectDataObj);
          }
        } else {
          // Fallback to static events data
          const foundEvent = events.find(e => e.id.toString() === id);
          setEvent(foundEvent);
        }
      } catch (error) {
        console.error('Error fetching event data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load event details',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    const fetchPatternsAndScoresheets = async (projectDataObj) => {
      setIsLoadingAssets(true);
      try {
        const patterns = [];
        const scoresheets = [];
        
        // Process disciplines and their pattern selections
        if (projectDataObj.disciplines && projectDataObj.patternSelections) {
          for (const discipline of projectDataObj.disciplines) {
            if (!discipline.pattern && !discipline.scoresheet) continue;
            
            const disciplineKey = discipline.id || discipline.name;
            const disciplineSelections = projectDataObj.patternSelections[disciplineKey] || 
                                        projectDataObj.patternSelections[discipline.id] ||
                                        projectDataObj.patternSelections[discipline.name];
            
            if (!disciplineSelections) continue;
            
            // Process pattern groups
            if (discipline.patternGroups && Array.isArray(discipline.patternGroups)) {
              for (const group of discipline.patternGroups) {
                const groupKey = group.id || `pattern-group-${group.name}`;
                const patternSelection = disciplineSelections[groupKey] || 
                                       disciplineSelections[group.id] ||
                                       disciplineSelections[group.name];
                
                if (patternSelection && patternSelection.patternId) {
                  const numericPatternId = typeof patternSelection.patternId === 'number' 
                    ? patternSelection.patternId 
                    : parseInt(patternSelection.patternId);
                  
                  if (numericPatternId) {
                    // Fetch pattern image
                    const { data: patternMedia } = await supabase
                      .from('tbl_pattern_media')
                      .select('image_url')
                      .eq('pattern_id', numericPatternId)
                      .maybeSingle();

                    const { data: patternInfo } = await supabase
                      .from('tbl_patterns')
                      .select('pdf_file_name, pattern_version')
                      .eq('id', numericPatternId)
                      .maybeSingle();

                    // Resolve the show date for this pattern so riders can filter by it.
                    // Ungrouped divisions carry `date`; grouped ones store baseId/goNumber,
                    // so the date is looked up in the discipline's divisionGos map.
                    const resolveDivisionDate = (d) => {
                      if (d?.date) return d.date;
                      const baseId = d?.baseId || d?.id;
                      const goInfo = discipline.divisionGos?.[baseId] || {};
                      return (d?.goNumber === 2 ? goInfo.go2Date : goInfo.go1Date) || null;
                    };
                    const patternDate = (group.divisions || [])
                      .map(resolveDivisionDate)
                      .find(Boolean) || null;

                    patterns.push({
                      uid: patterns.length, // stable id — matches branded-preview cache regardless of filtering
                      discipline: discipline.name,
                      group: group.name,
                      divisions: group.divisions || [],
                      patternId: numericPatternId,
                      patternName: patternSelection.patternName || patternInfo?.pdf_file_name || `Pattern ${numericPatternId}`,
                      imageUrl: patternMedia?.image_url || null,
                      version: patternSelection.version || patternInfo?.pattern_version || null,
                      date: patternDate,
                    });
                  }
                }
                
                // Fetch scoresheet for this group
                if (discipline.scoresheet && group.divisions && group.divisions.length > 0) {
                  const division = group.divisions[0];
                  const assocId = division.assocId || discipline.association_id;
                  
                  if (assocId) {
                    const { data: scoresheetData } = await supabase
                      .from('tbl_scoresheet')
                      .select('id, image_url, file_name, discipline')
                      .eq('association_abbrev', assocId)
                      .ilike('discipline', `%${discipline.name}%`)
                      .maybeSingle();
                    
                    if (scoresheetData) {
                      scoresheets.push({
                        discipline: discipline.name,
                        group: group.name,
                        divisions: group.divisions.map(d => d.division || d.name || d),
                        scoresheetId: scoresheetData.id,
                        imageUrl: scoresheetData.image_url || null,
                        fileName: scoresheetData.file_name || null,
                      });
                    }
                  }
                }
              }
            }
          }
        }
        
        setPatternsData(patterns);
        setScoresheetsData(scoresheets);
      } catch (error) {
        console.error('Error fetching patterns and scoresheets:', error);
      } finally {
        setIsLoadingAssets(false);
      }
    };

    fetchEventData();
  }, [id, toast]);

  // Build a print-ready branded document for each pattern (show name + class date +
  // divisions header, EquiPatterns footer) so the on-page preview matches the
  // downloaded/printed file exactly. Runs whenever the patterns or show identity change.
  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      if (!patternsData.length) { setBrandedPreviews({}); return; }
      const name = projectData?.showName || event?.name || 'EquiPatterns';
      const fmtDate = (d) => {
        try { return format(new Date(d + 'T00:00:00'), 'PPP'); } catch { return d; }
      };
      for (const p of patternsData) {
        if (cancelled) return;
        if (!p.imageUrl) continue;
        const rendered = await buildBrandedPatternCanvas(p.imageUrl, {
          showName: name,
          divisions: p.divisions,
          date: p.date ? fmtDate(p.date) : '',
          patternName: p.patternName,
        });
        if (cancelled) return;
        if (rendered) {
          setBrandedPreviews((prev) => ({ ...prev, [p.uid]: rendered.dataUrl }));
        }
      }
    };
    generate();
    return () => { cancelled = true; };
  }, [patternsData, projectData, event]);

  const handleShare = (platform) => {
    toast({
      title: 'Sharing Event!',
      description: `🚧 Sharing to ${platform} is not implemented yet.`,
    });
  };

  const getPatternStatus = () => {
    if (!event.patternBook) return null;

    if (event.patternBook.isLive) {
      return (
        <Button asChild className="w-full bg-green-500 hover:bg-green-600">
          <Link to={`/pattern-books/view/${event.patternBook.id}`}>
            <BookOpen className="h-4 w-4 mr-2" /> View Pattern Book
          </Link>
        </Button>
      );
    }
    return (
      <div className="text-center text-sm text-muted-foreground p-3 bg-secondary rounded-md">
        Patterns will be posted on {format(new Date(event.patternBook.publishDate), 'PPP')}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="text-foreground h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
            <p className="text-muted-foreground">The event you're looking for doesn't exist.</p>
            <Button asChild className="mt-4">
              <Link to="/events">Back to Events</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Pattern book is published (as a show module or a standalone book).
  const patternPublished = event.isFromProjects && (
    projectData?.moduleStatuses?.patternBook === 'published' ||
    ['Final', 'Publication', 'published'].includes(event.project?.status)
  );
  // Optional scheduled release: if a future Publication Date is set, hold the patterns
  // back until that day (string compare on yyyy-MM-dd is date-correct).
  const todayStr = new Date().toISOString().slice(0, 10);
  const patternsScheduled = patternPublished && projectData?.publicationDate && projectData.publicationDate > todayStr;
  const publicationDateLabel = projectData?.publicationDate
    ? format(new Date(projectData.publicationDate + 'T00:00:00'), 'PPP')
    : '';

  // --- Pattern search/filter (by date + division) ---
  const divLabel = (div) =>
    typeof div === 'object' ? (div.division || div.name || div.id) : div;
  const formatPatternDate = (d) => {
    try { return format(new Date(d + 'T00:00:00'), 'PPP'); } catch { return d; }
  };
  const patternDateOptions = [...new Set(patternsData.map((p) => p.date).filter(Boolean))].sort();
  const patternDivisionOptions = [
    ...new Set(patternsData.flatMap((p) => (p.divisions || []).map(divLabel)).filter(Boolean)),
  ].sort();
  const filteredPatterns = patternsData.filter((p) => {
    const dateOk = patternDateFilter === 'all' || p.date === patternDateFilter;
    const divOk =
      patternDivisionFilter === 'all' ||
      (p.divisions || []).map(divLabel).includes(patternDivisionFilter);
    return dateOk && divOk;
  });

  // --- Download / print (single pattern + branded pattern book) ---
  const showName = projectData?.showName || event.name || 'EquiPatterns';
  const patternMeta = (p) => ({
    showName,
    divisions: p.divisions,
    date: p.date ? formatPatternDate(p.date) : '',
    patternName: p.patternName,
  });
  const handleDownloadPattern = async (p) => {
    const ok = await downloadPatternJpeg(p.imageUrl, patternMeta(p));
    if (!ok) toast({ title: 'Download failed', description: 'Could not build the pattern image.', variant: 'destructive' });
  };
  const handlePrintPattern = async (p) => {
    const ok = await printPatterns({ imageUrl: p.imageUrl, meta: patternMeta(p) });
    if (!ok) toast({ title: 'Print blocked', description: 'Allow pop-ups to print this pattern.', variant: 'destructive' });
  };
  const handleDownloadBook = async () => {
    toast({ title: 'Building pattern book…', description: `${filteredPatterns.length} pattern(s)` });
    const ok = await downloadPatternBookPdf(
      filteredPatterns.map((p) => ({ ...p, dateLabel: p.date ? formatPatternDate(p.date) : '' })),
      { showName }
    );
    if (!ok) toast({ title: 'Download failed', description: 'No printable patterns in the current filter.', variant: 'destructive' });
  };
  const handlePrintBook = async () => {
    const items = filteredPatterns
      .filter((p) => p.imageUrl)
      .map((p) => ({ imageUrl: p.imageUrl, meta: patternMeta(p) }));
    if (items.length === 0) return;
    const ok = await printPatterns(items);
    if (!ok) toast({ title: 'Print blocked', description: 'Allow pop-ups to print the book.', variant: 'destructive' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="relative h-64 md:h-96 rounded-lg overflow-hidden mb-8">
            <img-replace alt={event.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-8 left-8 text-white">
              {event.association && (
                <Badge className="mb-2 bg-primary/80 backdrop-blur-sm text-primary-foreground">{event.association}</Badge>
              )}
              <h1 className="text-3xl md:text-5xl font-bold">{event.name}</h1>
              <div className="flex items-center text-lg mt-2 gap-4 flex-wrap">
                {event.startDate && (
                  <span className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" /> 
                    {format(new Date(event.startDate), 'MMM d, yyyy')} 
                    {event.endDate && ` - ${format(new Date(event.endDate), 'MMM d, yyyy')}`}
                  </span>
                )}
                {event.location && (
                  <span className="flex items-center gap-2"><MapPin className="h-5 w-5" /> {event.location}</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Show Details - Show when event has details (from events table or projects table) */}
            {((!event.isFromProjects && (event.venue_name || event.venue_address || event.show_type || event.associations || event.disciplines || event.officials || event.judges)) || (event.isFromProjects && projectData)) && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
                <Card className="bg-secondary border-border">
                  <CardHeader>
                    <CardTitle>Show Details</CardTitle>
                    <CardDescription>Complete information about this show</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Show Name - from projectData */}
                    {projectData?.showName && (
                      <div>
                        <h3 className="font-semibold text-primary mb-1">Show Name</h3>
                        <p className="text-foreground">{projectData.showName}</p>
                      </div>
                    )}

                    {/* Show Type */}
                    {(event.show_type || projectData?.showType) && (
                      <div>
                        <h3 className="font-semibold text-primary mb-1">Show Type</h3>
                        <Badge variant="outline">{event.show_type || projectData.showType}</Badge>
                      </div>
                    )}

                    {/* Venue Information */}
                    {(event.venue_name || event.venue_address || projectData?.venueName || projectData?.venueAddress) && (
                      <div>
                        <h3 className="font-semibold text-primary mb-1">Venue</h3>
                        {(event.venue_name || projectData?.venueName) && <p className="text-foreground">{event.venue_name || projectData.venueName}</p>}
                        {(event.venue_address || projectData?.venueAddress) && <p className="text-muted-foreground text-sm">{event.venue_address || projectData.venueAddress}</p>}
                      </div>
                    )}

                    {/* Associations */}
                    {(() => {
                      let associations = [];
                      if (event.associations) {
                        associations = Array.isArray(event.associations) ? event.associations : [];
                      } else if (projectData?.associations && Object.keys(projectData.associations).length > 0) {
                        associations = Object.keys(projectData.associations).filter(key => projectData.associations[key]);
                      }
                      if (associations.length > 0) {
                        return (
                          <div>
                            <h3 className="font-semibold text-primary mb-2">Associations</h3>
                            <div className="flex flex-wrap gap-2">
                              {associations.map((assoc, idx) => (
                                <Badge key={idx} variant="outline">{assoc}</Badge>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Disciplines */}
                    {(() => {
                      let disciplines = [];
                      if (event.disciplines) {
                        disciplines = Array.isArray(event.disciplines) ? event.disciplines : [];
                      } else if (projectData?.disciplines && projectData.disciplines.length > 0) {
                        disciplines = projectData.disciplines;
                      }
                      if (disciplines.length > 0) {
                        return (
                          <div>
                            <h3 className="font-semibold text-primary mb-2">Disciplines</h3>
                            <div className="flex flex-wrap gap-2">
                              {disciplines.map((discipline, idx) => (
                                <Badge key={idx} variant="outline">{typeof discipline === 'string' ? discipline : (discipline.name || discipline)}</Badge>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Officials */}
                    {(() => {
                      let officials = [];
                      if (event.officials) {
                        if (typeof event.officials === 'object' && !Array.isArray(event.officials)) {
                          // Convert object to array format
                          officials = Object.entries(event.officials).map(([role, name]) => ({ role, name }));
                        } else if (Array.isArray(event.officials)) {
                          officials = event.officials;
                        }
                      } else if (projectData?.officials && projectData.officials.length > 0) {
                        officials = projectData.officials;
                      }
                      if (officials.length > 0) {
                        return (
                          <div>
                            <h3 className="font-semibold text-primary mb-2">Officials</h3>
                            <div className="space-y-1">
                              {officials.map((official, idx) => (
                                <div key={idx} className="text-sm text-foreground">
                                  {typeof official === 'string' 
                                    ? official 
                                    : `${official.role || official.roleId || 'Official'}${official.name ? ': ' + official.name : ''}`}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Judges */}
                    {(() => {
                      let judges = [];
                      if (event.judges) {
                        judges = Array.isArray(event.judges) ? event.judges : [];
                      } else if (projectData?.associationJudges) {
                        Object.values(projectData.associationJudges).forEach(data => {
                          if (data.judges && Array.isArray(data.judges)) {
                            data.judges.forEach(judge => {
                              if (judge.name?.trim()) {
                                judges.push(judge.name.trim());
                              }
                            });
                          }
                        });
                      }
                      const uniqueJudges = [...new Set(judges)];
                      if (uniqueJudges.length > 0) {
                        return (
                          <div>
                            <h3 className="font-semibold text-primary mb-2">Judges</h3>
                            <div className="space-y-1">
                              {uniqueJudges.map((judgeName, idx) => (
                                <div key={idx} className="text-sm text-foreground">
                                  {judgeName}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Event Highlights - Show patterns, scoresheets, divisions, and judges */}
            <motion.div id="event-patterns" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
              <Card className="bg-secondary border-border">
                <CardHeader>
                  <CardTitle>Event Highlights</CardTitle>
                  {event.isFromProjects && <CardDescription>Patterns, scoresheets, divisions, and judges for this event</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Patterns and Scoresheets */}
                  {event.isFromProjects && projectData && (
                    <>
                      {/* Scheduled release — patterns are held until the Publication Date. */}
                      {patternsScheduled && (
                        <div className="p-4 rounded-lg border bg-secondary text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Patterns will be posted on {publicationDateLabel}.
                        </div>
                      )}
                      {/* Patterns */}
                      {!patternsScheduled && patternsData.length > 0 && (
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <h3 className="font-semibold text-primary flex items-center">
                              <FileText className="h-5 w-5 mr-2" /> Patterns
                            </h3>
                            {/* Whole-book actions — respect the active date/division filter */}
                            {filteredPatterns.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={handleDownloadBook}>
                                  <BookOpen className="h-4 w-4 mr-1" /> Download Book (PDF)
                                </Button>
                                <Button variant="outline" size="sm" onClick={handlePrintBook}>
                                  <Printer className="h-4 w-4 mr-1" /> Print Book
                                </Button>
                              </div>
                            )}
                          </div>
                          {/* Search / filter: find your patterns by show date and/or division */}
                          {(patternDateOptions.length > 0 || patternDivisionOptions.length > 0) && (
                            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                              {patternDateOptions.length > 0 && (
                                <div className="flex-1">
                                  <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" /> Date
                                  </label>
                                  <select
                                    value={patternDateFilter}
                                    onChange={(e) => setPatternDateFilter(e.target.value)}
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                  >
                                    <option value="all">All dates</option>
                                    {patternDateOptions.map((d) => (
                                      <option key={d} value={d}>{formatPatternDate(d)}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {patternDivisionOptions.length > 0 && (
                                <div className="flex-1">
                                  <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" /> Division
                                  </label>
                                  <select
                                    value={patternDivisionFilter}
                                    onChange={(e) => setPatternDivisionFilter(e.target.value)}
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                  >
                                    <option value="all">All divisions</option>
                                    {patternDivisionOptions.map((d) => (
                                      <option key={d} value={d}>{d}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {(patternDateFilter !== 'all' || patternDivisionFilter !== 'all') && (
                                <div className="flex items-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setPatternDateFilter('all'); setPatternDivisionFilter('all'); }}
                                  >
                                    Clear
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          {filteredPatterns.length === 0 ? (
                            <div className="p-4 rounded-lg border border-border bg-background/50 text-sm text-muted-foreground text-center">
                              No patterns match this date/division. Try clearing the filters.
                            </div>
                          ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredPatterns.map((pattern, idx) => (
                              <div key={idx} className="border border-border rounded-lg p-3 bg-background/50">
                                {/* Divisions at top — most important for riders searching their class */}
                                {pattern.divisions && pattern.divisions.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-xs text-muted-foreground mb-1">Divisions:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {pattern.divisions.map((div, divIdx) => (
                                        <Badge key={divIdx} variant="secondary" className="text-xs">
                                          {typeof div === 'object' ? (div.division || div.name || div.id) : div}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {pattern.imageUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImage({ url: brandedPreviews[pattern.uid] || pattern.imageUrl, title: pattern.patternName })}
                                    className="group relative block w-full mt-2"
                                    title="Click to view full size"
                                  >
                                    {/* Branded, print-ready document (falls back to raw drawing until it renders) */}
                                    <img
                                      src={brandedPreviews[pattern.uid] || pattern.imageUrl}
                                      alt={pattern.patternName}
                                      className="w-full h-48 object-contain rounded border border-border bg-white transition group-hover:opacity-90"
                                    />
                                    {!brandedPreviews[pattern.uid] && (
                                      <span className="absolute top-1 right-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                                        Preparing…
                                      </span>
                                    )}
                                    <span className="absolute inset-0 flex items-center justify-center rounded bg-black/0 opacity-0 transition group-hover:bg-black/10 group-hover:opacity-100">
                                      <span className="inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
                                        <ZoomIn className="h-3.5 w-3.5" /> View
                                      </span>
                                    </span>
                                  </button>
                                ) : (
                                  <div className="w-full h-32 bg-muted rounded border border-border mt-2 flex items-center justify-center">
                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                )}
                                {/* Save to phone / print this single pattern (branded) */}
                                {pattern.imageUrl && (
                                  <div className="flex gap-2 mt-2">
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDownloadPattern(pattern)}>
                                      <Download className="h-4 w-4 mr-1" /> JPEG
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handlePrintPattern(pattern)}>
                                      <Printer className="h-4 w-4 mr-1" /> Print
                                    </Button>
                                  </div>
                                )}
                                {/* Pattern name / group at the bottom; version intentionally hidden */}
                                <div className="mt-2">
                                  <p className="font-medium text-foreground">{pattern.patternName}</p>
                                  <p className="text-sm text-muted-foreground">{pattern.discipline} - {pattern.group}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          )}
                        </div>
                      )}

                      {/* Scoresheets */}
                      {!patternsScheduled && scoresheetsData.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-primary mb-3 flex items-center">
                            <FileText className="h-5 w-5 mr-2" /> Score Sheets
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {scoresheetsData.map((scoresheet, idx) => (
                              <div key={idx} className="border border-border rounded-lg p-3 bg-background/50">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <p className="font-medium text-foreground">{scoresheet.fileName || 'Score Sheet'}</p>
                                    <p className="text-sm text-muted-foreground">{scoresheet.discipline} - {scoresheet.group}</p>
                                  </div>
                                </div>
                                {scoresheet.imageUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImage({ url: scoresheet.imageUrl, title: scoresheet.fileName || 'Score Sheet' })}
                                    className="group relative block w-full mt-2"
                                    title="Click to view full size"
                                  >
                                    <img
                                      src={scoresheet.imageUrl}
                                      alt={scoresheet.fileName || 'Score Sheet'}
                                      className="w-full h-32 object-contain rounded border border-border bg-white transition group-hover:opacity-90"
                                    />
                                    <span className="absolute inset-0 flex items-center justify-center rounded bg-black/0 opacity-0 transition group-hover:bg-black/10 group-hover:opacity-100">
                                      <span className="inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
                                        <ZoomIn className="h-3.5 w-3.5" /> View
                                      </span>
                                    </span>
                                  </button>
                                ) : (
                                  <div className="w-full h-32 bg-muted rounded border border-border mt-2 flex items-center justify-center">
                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                )}
                                {scoresheet.divisions && scoresheet.divisions.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs text-muted-foreground mb-1">Divisions:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {scoresheet.divisions.map((div, divIdx) => (
                                        <Badge key={divIdx} variant="secondary" className="text-xs">
                                          {typeof div === 'object' ? (div.division || div.name || div.id) : div}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* All Divisions Summary */}


                      {/* Judges Summary */}
                      {(() => {
                        const allJudges = [];

                        if (projectData.associationJudges) {
                          Object.values(projectData.associationJudges).forEach(data => {
                            if (data.judges && Array.isArray(data.judges)) {
                              data.judges.forEach(judge => {
                                if (judge.name?.trim()) {
                                  allJudges.push(judge.name.trim());
                                }
                              });
                            }
                          });
                        }

                        const uniqueJudges = [...new Set(allJudges)];

                        if (uniqueJudges.length > 0) {
                          return (
                            <div>
                              <h3 className="font-semibold text-primary mb-3 flex items-center">
                                <Users className="h-5 w-5 mr-2" /> Judges
                              </h3>
                              <div className="space-y-1">
                                {uniqueJudges.map((judgeName, idx) => (
                                  <div key={idx} className="text-sm text-foreground">
                                    {judgeName}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {isLoadingAssets && (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="ml-2 text-muted-foreground">Loading patterns and scoresheets...</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Fallback for regular events */}
                  {!event.isFromProjects && (
                    <>
                      <div className="flex flex-wrap justify-start gap-6 text-foreground/80">
                        {event.totalEntries && (
                          <div className="flex items-center">
                            <Users className="h-5 w-5 mr-2" />
                            <span>{event.totalEntries} Entries</span>
                          </div>
                        )}
                        {event.totalPrizes && (
                          <div className="flex items-center">
                            <Trophy className="h-5 w-5 mr-2" />
                            <span>{event.totalPrizes} in Prizes</span>
                          </div>
                        )}
                      </div>
                      {event.classes && event.classes.length > 0 && (
                        <div className="pt-4">
                          <h3 className="font-semibold text-primary mb-2">Featured Classes</h3>
                          <div className="flex flex-wrap gap-2">
                              {event.classes.slice(0, 4).map((c, idx) => (
                                <Badge key={idx} variant="outline">{c.name || c}</Badge>
                              ))}
                              {event.classes.length > 4 && <Badge variant="outline">+{event.classes.length - 4} more</Badge>}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Results - Show finalized results from the Results module */}
            {event.isFromProjects && projectData?.results?.classResults && (() => {
              const finalResults = Object.values(projectData.results.classResults).filter(r => r.status === 'final');
              if (finalResults.length === 0) return null;
              return (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
                  <Card className="bg-secondary border-border">
                    <CardHeader>
                      <CardTitle>Results</CardTitle>
                      <CardDescription>Official results for {finalResults.length} class{finalResults.length !== 1 ? 'es' : ''}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {finalResults
                        .sort((a, b) => (a.classNumber || 0) - (b.classNumber || 0))
                        .map((result, idx) => (
                        <div key={idx} className="rounded-lg border bg-background/50 overflow-hidden">
                          <div className="px-4 py-2 bg-muted/50 font-medium text-sm flex items-center gap-2">
                            <span className="font-mono text-muted-foreground">#{result.classNumber}</span>
                            <span>{result.className}</span>
                            {result.scoringType === 'timed' && <Badge variant="outline" className="text-[10px]">Timed</Badge>}
                            {result.scoringType === 'scored' && <Badge variant="outline" className="text-[10px]">Scored</Badge>}
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-muted-foreground border-b">
                                <th className="px-4 py-1 text-left w-14">Place</th>
                                <th className="px-4 py-1 text-left">Rider</th>
                                <th className="px-4 py-1 text-left">Horse</th>
                                {result.scoringType === 'scored' && <th className="px-4 py-1 text-left w-20">Score</th>}
                                {result.scoringType === 'timed' && <th className="px-4 py-1 text-left w-20">Time</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {(result.entries || []).filter(e => e.riderName?.trim()).map((entry, eIdx) => (
                                <tr key={eIdx} className="border-b last:border-0">
                                  <td className="px-4 py-1.5 font-bold text-muted-foreground">{entry.placing}</td>
                                  <td className="px-4 py-1.5">{entry.riderName}</td>
                                  <td className="px-4 py-1.5 text-muted-foreground">{entry.horseName || '—'}</td>
                                  {result.scoringType === 'scored' && <td className="px-4 py-1.5 font-mono">{entry.score ?? '—'}</td>}
                                  {result.scoringType === 'timed' && <td className="px-4 py-1.5 font-mono">{entry.time ?? '—'}</td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })()}

            {/* Class Schedule - Show for regular events */}
            {event.classes && event.classes.length > 0 && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.4 }}>
                <Card className="bg-secondary border-border">
                   <CardHeader>
                    <CardTitle>Class Schedule</CardTitle>
                    <CardDescription>Today's competition schedule</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {event.classes.map((classItem, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 * index }}
                        className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <h3 className="text-foreground font-medium">{classItem.name || classItem}</h3>
                          {classItem.time && (
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center"><Clock className="h-4 w-4 mr-1" />{classItem.time}</span>
                              {classItem.ring && <span>{classItem.ring}</span>}
                              {classItem.entries && <span>{classItem.entries} entries</span>}
                            </div>
                          )}
                        </div>
                        <Badge variant={event.status === 'live' ? 'default' : 'secondary'} className={event.status === 'live' ? 'bg-green-500' : ''}>
                          {event.status === 'live' ? 'Live Now' : 'Completed'}
                        </Badge>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          <div className="space-y-8">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
              <Card className="bg-secondary border-border">
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Book Stalls, RV & Supplies — only when the organizer has published it. */}
                  {event.isFromProjects && projectData?.moduleStatuses?.housing === 'published' && (
                    <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                      <Link to={`/show/${event.id}/book`}>
                        <Building2 className="h-4 w-4 mr-2" /> Book Stalls, RV &amp; Supplies
                      </Link>
                    </Button>
                  )}
                  {/* Order Hay & Shavings — live at-show reorder. Shows when housing is
                      published AND the organizer stocks supplies (hay/shavings/etc). */}
                  {event.isFromProjects &&
                    projectData?.moduleStatuses?.housing === 'published' &&
                    (projectData?.stallingService?.supplies || []).length > 0 && (
                    <Button asChild className="w-full bg-amber-600 hover:bg-amber-700">
                      <Link to={`/show/${event.id}/order-supplies`}>
                        <ShoppingCart className="h-4 w-4 mr-2" /> Order Hay &amp; Shavings
                      </Link>
                    </Button>
                  )}
                  {/* Pattern book: a future Publication Date holds it back with a "posted on" note;
                      otherwise a button that jumps to the patterns below. */}
                  {patternPublished && (
                    patternsScheduled ? (
                      <div className="w-full text-center text-sm text-muted-foreground p-3 bg-secondary rounded-md flex items-center justify-center gap-2">
                        <Calendar className="h-4 w-4" /> Patterns posted on {publicationDateLabel}
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => document.getElementById('event-patterns')?.scrollIntoView({ behavior: 'smooth' })}
                      >
                        <BookOpen className="h-4 w-4 mr-2" /> View Pattern Book
                      </Button>
                    )
                  )}
                  {getPatternStatus()}
                  {(event.website || event.show_website || event.showWebsite) && (
                    <Button asChild variant="outline" className="w-full">
                      <a href={event.website || event.show_website || event.showWebsite} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" /> Visit Official Website
                      </a>
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground pt-2 text-center">Share this event:</p>
                   <div className="flex justify-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleShare('Twitter')}><Twitter className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => handleShare('Facebook')}><Facebook className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => handleShare('Link')}><Share2 className="h-4 w-4" /></Button>
                   </div>
                </CardContent>
              </Card>
            </motion.div>

             <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.5 }}>
              <Card className="bg-secondary border-border">
                <CardHeader>
                  <CardTitle>Shareable Summary</CardTitle>
                   <CardDescription>Copy and paste to share.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="bg-background p-3 rounded-md text-sm text-muted-foreground">
                    Check out the highlights from {event.name}! Incredible performances in {event.classes?.map(c => c.name).slice(0, 2).join(' & ')}. Congratulations to all competitors! #EquiPatterns #{event.association} #{event.name.replace(/\s+/g, '')}
                   </div>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(`Check out the highlights from ${event.name}! #EquiPatterns`).then(() => toast({title: "Copied to clipboard!"}))}>
                        Copy Summary
                    </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Full-size image preview — click any pattern / score sheet to open it. */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-2 sm:p-4">
          {previewImage && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-center">{previewImage.title}</p>
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="w-full max-h-[80vh] object-contain rounded bg-white"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventDetailPage;