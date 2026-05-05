import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Play, Search, BookOpen, Clock, Loader2, ChevronDown, ChevronRight, FolderOpen, Eye, Folder, Edit, Download, FileText, LayoutGrid, Info, Users, Lock, MoreVertical, Trash2, Check, X, Archive, PlusCircle, Globe, Facebook } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { format, isFuture, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { downloadPatternBookFolder } from '@/lib/patternBookDownloader';
import JSZip from 'jszip';
import { generatePatternBookPdf } from '@/lib/bookGenerator';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, pointerWithin, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import PatternBookDownloadDialog from '@/components/PatternBookDownloadDialog';

// Compute event status dynamically from dates
const getComputedStatus = (event) => {
  if (!event.start_date || !event.end_date) return 'upcoming';
  const now = new Date();
  const start = startOfDay(new Date(event.start_date));
  const end = endOfDay(new Date(event.end_date));
  if (isBefore(now, start)) return 'upcoming';
  if (isAfter(now, end)) return 'completed';
  return 'ongoing';
};

const LiveEventCard = ({ event, onSelect }) => {
  return (
    <motion.div
      layoutId={`event-card-${event.id}`}
      onClick={() => onSelect(event)}
      className="relative rounded-lg overflow-hidden cursor-pointer group"
      whileHover={{ scale: 1.03 }}
    >
      <img  alt={event.name} className="w-full h-full object-cover aspect-[4/3] transition-transform duration-300 group-hover:scale-105" src="https://images.unsplash.com/photo-1691257790470-b5e4e80ca59f" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute bottom-0 left-0 p-4 text-white">
        <Badge className="bg-red-500 text-white mb-2 animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full mr-2"></div>
          LIVE NOW
        </Badge>
        <h3 className="font-bold text-lg">{event.name}</h3>
        <p className="text-sm text-white/80">{event.location}</p>
      </div>
    </motion.div>
  );
};

const STATUS_BADGE_CONFIG = {
  upcoming: { label: 'Upcoming', variant: 'secondary', className: 'backdrop-blur-sm bg-black/30 text-white' },
  ongoing: { label: 'Ongoing', variant: 'default', className: 'backdrop-blur-sm bg-green-600/80 text-white' },
  completed: { label: 'Completed', variant: 'outline', className: 'backdrop-blur-sm bg-black/30 text-white' },
};

const EventCard = ({ event, onPatternBookClick }) => {
    const computedStatus = getComputedStatus(event);
    const badgeConfig = STATUS_BADGE_CONFIG[computedStatus] || STATUS_BADGE_CONFIG.upcoming;

    const getLocationDisplay = () => {
        if (event.location) return event.location;
        return 'Location TBD';
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
        >
            <Card className="bg-secondary border-border hover:border-primary/50 transition-all duration-300 group h-full flex flex-col">
                <CardHeader className="p-0">
                    <Link to={`/event-detail/${event.id}`}>
                        <div className="aspect-video relative overflow-hidden rounded-t-lg">
                            <img
                              alt={event.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              src={event.thumbnail_url || "https://images.unsplash.com/photo-1691257790470-b5e4e80ca59f"}
                            />
                            <div className="absolute top-2 right-2">
                                <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                                    {badgeConfig.label}
                                </Badge>
                            </div>
                        </div>
                    </Link>
                </CardHeader>
                <CardContent className="pt-4 flex-grow">
                    <Link to={`/event-detail/${event.id}`}>
                        <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">{event.name}</CardTitle>
                    </Link>
                    <div className="text-sm text-muted-foreground mt-2 space-y-2">
                        <div className="flex items-center"><Calendar className="h-4 w-4 mr-2" />{format(new Date(event.start_date), 'MMM d, yyyy')} - {format(new Date(event.end_date), 'MMM d, yyyy')}</div>
                        <div className="flex items-center"><MapPin className="h-4 w-4 mr-2" />{getLocationDisplay()}</div>
                        {computedStatus === 'upcoming' && (
                            <div className="flex items-center">
                                <BookOpen className="h-4 w-4 mr-2" />
                                {['published', 'Publication'].includes(event.project?.status) ? (
                                    <span
                                        className="text-green-600 dark:text-green-400 cursor-pointer hover:underline"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (onPatternBookClick && event.pattern_book_id) {
                                                onPatternBookClick(event.pattern_book_id);
                                            }
                                        }}
                                    >
                                        Published
                                    </span>
                                ) : ['approved', 'locked'].includes(event.project?.status) ? (
                                    <span className="text-blue-600 dark:text-blue-400">Approved</span>
                                ) : (
                                    <span className="text-amber-600 dark:text-amber-400">Pending</span>
                                )}
                            </div>
                        )}
                        {(event.show_website || event.showWebsite) && (
                            <div className="flex items-center">
                                <Globe className="h-4 w-4 mr-2" />
                                <a href={event.show_website || event.showWebsite} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{(event.show_website || event.showWebsite).replace(/^https?:\/\//, '')}</a>
                            </div>
                        )}
                        {(event.show_facebook || event.showFacebook) && (
                            <div className="flex items-center">
                                <Facebook className="h-4 w-4 mr-2" />
                                <a href={event.show_facebook || event.showFacebook} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Facebook Event</a>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="pt-4 flex items-center justify-between">
                    <Link to={`/event-detail/${event.id}`} className="flex-1">
                        <Button variant="ghost" size="sm">View Details</Button>
                    </Link>
                </CardFooter>
            </Card>
        </motion.div>
    );
};

const EventsPage = () => {
  const [allEvents, setAllEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShow, setSelectedShow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [patternBookDialogOpen, setPatternBookDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [associationsData, setAssociationsData] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
        setIsLoading(true);
        
        // Fetch events from events table only
        const { data: eventsData, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .order('start_date', { ascending: false });
        
        if (eventsError) {
            toast({ title: 'Error fetching events', description: eventsError.message, variant: 'destructive' });
        }

        // Convert snake_case to camelCase for display and use only events from events table
        const formattedEvents = (eventsData || []).map(event => ({
          ...event,
          showWebsite: event.show_website || event.showWebsite,
          showFacebook: event.show_facebook || event.showFacebook,
        }));

        setAllEvents(formattedEvents);
        const live = formattedEvents.filter(e => e.status === 'live');
        if (live.length > 0) {
            setSelectedShow(live[0]);
        }
        setIsLoading(false);
    };
    fetchEvents();
  }, [toast]);

  // Compute status dynamically from dates — never rely on stored status
  const liveEvents = allEvents.filter(e => e.status === 'live');
  const upcomingEvents = allEvents.filter(e => getComputedStatus(e) === 'upcoming');
  const ongoingEvents = allEvents.filter(e => getComputedStatus(e) === 'ongoing');
  const completedEvents = allEvents.filter(e => getComputedStatus(e) === 'completed');

  const handleSelectShow = (show) => {
    setSelectedShow(show);
  };
  
  const handlePatternSelect = (pattern) => {
    toast({
      title: "🚧 Pattern viewing isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
      description: `Pattern: ${pattern.name}`,
    });
  };

  const handlePatternBookClick = async (projectId) => {
    try {
      // Fetch project data
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        toast({
          title: 'Error',
          description: 'Failed to load pattern book',
          variant: 'destructive'
        });
        return;
      }

      // Fetch associations data
      const { data: associations, error: associationsError } = await supabase
        .from('associations')
        .select('*');

      if (!associationsError && associations) {
        setAssociationsData(associations);
      }

      setSelectedProject(project);
      setPatternBookDialogOpen(true);
    } catch (error) {
      console.error('Error opening pattern book:', error);
      toast({
        title: 'Error',
        description: 'Failed to open pattern book',
        variant: 'destructive'
      });
    }
  };

  const filteredUpcoming = upcomingEvents.filter(event => event.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredOngoing = ongoingEvents.filter(event => event.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCompleted = completedEvents.filter(event => event.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (isLoading) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Events</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Watch live shows, discover upcoming events, and review results from recent competitions.
          </p>
        </motion.div>

        {liveEvents.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-6 text-center">Live Now</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <motion.div className="lg:col-span-2 relative aspect-video rounded-xl overflow-hidden bg-black" layoutId={`event-card-${selectedShow?.id}`}>
                {selectedShow && <img  alt={selectedShow.name} className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1601944179066-29786cb9d32a" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-center justify-center">
                    <Button size="lg" variant="ghost" className="bg-white/20 hover:bg-white/30 text-white h-20 w-20 rounded-full backdrop-blur-sm">
                        <Play className="h-10 w-10" />
                    </Button>
                </div>
              </motion.div>
              <div className="lg:col-span-1 space-y-4">
                <Card className="glass-effect border-border h-full flex flex-col">
                  <CardHeader>
                    <CardTitle>{selectedShow?.name}</CardTitle>
                    <CardDescription>{selectedShow?.currentClass || 'Live Feed'}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                     <div className="space-y-3">
                      {/* This part would need live data */}
                      <p className="text-sm text-muted-foreground">Live class data coming soon.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {liveEvents.map(event => (
                    <LiveEventCard key={event.id} event={event} onSelect={handleSelectShow} />
                ))}
            </div>
          </section>
        )}

        {filteredOngoing.length > 0 && (
          <section className="mb-16">
            <div className="flex justify-between items-center mb-6">
                 <h2 className="text-3xl font-bold">Ongoing Events</h2>
                 <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input placeholder="Search events..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                 </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredOngoing.map(event => (
                    <EventCard key={event.id} event={event} onPatternBookClick={handlePatternBookClick} />
                ))}
            </div>
          </section>
        )}

        <section className="mb-16">
            <div className="flex justify-between items-center mb-6">
                 <h2 className="text-3xl font-bold">Upcoming Events</h2>
                 {filteredOngoing.length === 0 && (
                   <div className="relative w-full max-w-xs">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input placeholder="Search events..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                   </div>
                 )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredUpcoming.map(event => (
                    <EventCard key={event.id} event={event} onPatternBookClick={handlePatternBookClick} />
                ))}
            </div>
             {filteredUpcoming.length === 0 && <p className="text-muted-foreground col-span-full text-center">No upcoming events match your search.</p>}
        </section>

        <section>
            <h2 className="text-3xl font-bold mb-6">Completed Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredCompleted.map(event => (
                    <EventCard key={event.id} event={event} onPatternBookClick={handlePatternBookClick} />
                ))}
            </div>
            {filteredCompleted.length === 0 && <p className="text-muted-foreground col-span-full text-center">No completed events yet.</p>}
        </section>

      </main>

      {/* Pattern Book Dialog */}
      {selectedProject && (
        <Dialog open={patternBookDialogOpen} onOpenChange={setPatternBookDialogOpen}>
          <DialogContent className="w-[95vw] h-screen max-w-none max-h-none p-0 m-0 rounded-none overflow-hidden">
            <EventPatternBookDialogContent 
              project={selectedProject}
              profile={profile}
              user={user}
              associationsData={associationsData}
              onClose={() => {
                setPatternBookDialogOpen(false);
                setSelectedProject(null);
              }}
              onRefresh={() => {
                // Refresh events if needed
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Event Pattern Book Dialog Content Component - Copy from CustomerPortalPage
// This is a separate copy so it can be modified independently for EventsPage
const EventPatternBookDialogContent = ({ project, profile, user, associationsData, onClose, onRefresh }) => {
    const [activeTab, setActiveTab] = useState('patternBook');
    const [activeSubTab, setActiveSubTab] = useState('patterns');
    const [patterns, setPatterns] = useState([]);
    const [scoresheets, setScoresheets] = useState([]);
    const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
    const [isLoadingScoresheets, setIsLoadingScoresheets] = useState(false);
    const [selectedSidebarItem, setSelectedSidebarItem] = useState('allItems');
    const [filterDisciplines, setFilterDisciplines] = useState(new Set()); // multi-select discipline
    const [filterClasses, setFilterClasses] = useState(new Set());
    const [filterJudges, setFilterJudges] = useState(new Set());
    const [sortBy, setSortBy] = useState('newest');
    // Filter dropdown open states
    const [disciplineFilterOpen, setDisciplineFilterOpen] = useState(false);
    const [classFilterOpen, setClassFilterOpen] = useState(false);
    const [judgeFilterOpen, setJudgeFilterOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState(null); // For pattern/scoresheet preview modal
    const [previewType, setPreviewType] = useState(null); // 'pattern' or 'scoresheet'
    const [previewImage, setPreviewImage] = useState(null); // Image URL for preview
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [projectStatus, setProjectStatus] = useState(project.status || 'Draft'); // Local status state
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [viewDownloadDialogOpen, setViewDownloadDialogOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    // Folder management state - Use separate key for EventsPage to keep folders independent
    const [folders, setFolders] = useState(() => {
        // Load folders from project_data using eventsPageFolders key (separate from CustomerPortalPage folders)
        const savedFolders = project.project_data?.eventsPageFolders || [];
        return savedFolders.length > 0 ? savedFolders : [];
    });
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
    const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [editingFolderId, setEditingFolderId] = useState(null);
    const [folderToDelete, setFolderToDelete] = useState(null);
    const [selectedFolderId, setSelectedFolderId] = useState(null); // For filtering by folder
    const [selectedParentFolderId, setSelectedParentFolderId] = useState(null); // For creating nested folders
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [creatingFolderParentId, setCreatingFolderParentId] = useState(null);
    const [editingFolderName, setEditingFolderName] = useState(''); // For inline rename
    const [renamingFolderId, setRenamingFolderId] = useState(null); // For inline rename
    
    // Drag and drop state
    const [activeId, setActiveId] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);
    
    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );
    
    const projectData = project.project_data || {};
    const { toast } = useToast();
    
    // Handle status change
    const handleStatusChange = async (newStatus) => {
        setIsUpdatingStatus(true);
        try {
            await supabase
                .from('projects')
                .update({ status: newStatus })
                .eq('id', project.id);
            
            setProjectStatus(newStatus);
            
            toast({
                title: "Status updated",
                description: `Pattern book status changed to ${newStatus === 'Lock & Approve Mode' ? 'Apprvd & Locked' : newStatus}`
            });
            
            // Refresh parent component if callback provided
            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error('Error updating status:', error);
            toast({
                title: "Error",
                description: "Failed to update status",
                variant: "destructive"
            });
        } finally {
            setIsUpdatingStatus(false);
        }
    };
    
    // Format status for display
    const getDisplayStatus = () => {
        return projectStatus || 'Draft';
    };
    
    const displayStatus = getDisplayStatus();
    
    // Handle preview button click
    const handleViewPattern = async (pattern) => {
        setPreviewItem(pattern);
        setPreviewType('pattern');
        setIsLoadingPreview(true);
        setPreviewImage(null);
        
        try {
            // Get pattern image (same as download logic)
            let imageUrl = pattern.image_url || null;
            
            if (!imageUrl && pattern.numericId) {
                const { data: imageData } = await supabase
                    .from('tbl_pattern_media')
                    .select('image_url')
                    .eq('pattern_id', pattern.numericId)
                    .maybeSingle();
                
                imageUrl = imageData?.image_url || null;
            }
            
            setPreviewImage(imageUrl);
        } catch (error) {
            console.error('Error loading pattern image:', error);
        } finally {
            setIsLoadingPreview(false);
        }
    };
    
    const handleViewScoresheet = async (scoresheet) => {
        setPreviewItem(scoresheet);
        setPreviewType('scoresheet');
        setIsLoadingPreview(true);
        setPreviewImage(null);
        
        try {
            // Get scoresheet image (same as download logic)
            let imageUrl = scoresheet.image_url || null;
            
            if (!imageUrl && scoresheet.id) {
                let numericId = null;
                if (typeof scoresheet.id === 'number') {
                    numericId = scoresheet.id;
                } else if (typeof scoresheet.id === 'string' && !isNaN(parseInt(scoresheet.id))) {
                    numericId = parseInt(scoresheet.id);
                }
                
                if (numericId) {
                    const { data: scoresheetData } = await supabase
                        .from('tbl_scoresheet')
                        .select('image_url')
                        .eq('id', numericId)
                        .maybeSingle();
                    
                    imageUrl = scoresheetData?.image_url || null;
                }
            }
            
            setPreviewImage(imageUrl);
        } catch (error) {
            console.error('Error loading scoresheet image:', error);
        } finally {
            setIsLoadingPreview(false);
        }
    };
    
    // Download pattern handler
    const handleDownloadPattern = async (pattern) => {
        try {
            console.log('Downloading pattern:', pattern);
            
            // If pattern has pdf_url or download_url, download directly (as local file)
            const downloadUrl = pattern.pdf_url || pattern.download_url || pattern.image_url;
            if (downloadUrl) {
                try {
                    const response = await fetch(downloadUrl);
                    if (!response.ok) throw new Error('Failed to fetch file');
                    
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    
                    const fileName = pattern.patternName || pattern.name || 'pattern.pdf';
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    window.URL.revokeObjectURL(blobUrl);
                    
                    toast({
                        title: "Download started",
                        description: "Pattern download initiated"
                    });
                    return;
                } catch (fetchError) {
                    console.error('Error downloading pattern file:', fetchError);
                    // Continue to try database fetch
                }
            }
            
            // Extract numeric pattern ID from various formats
            // First check if we stored numericId directly
            let numericPatternId = pattern.numericId || null;
            
            // If not, try to extract from pattern.id
            if (!numericPatternId && pattern.id) {
                if (typeof pattern.id === 'number') {
                    numericPatternId = pattern.id;
                } else if (typeof pattern.id === 'string') {
                    // Handle formats like "pattern-1-ALL" or "123"
                    if (pattern.id.includes('-')) {
                        const match = pattern.id.match(/\d+/);
                        if (match) {
                            numericPatternId = parseInt(match[0]);
                        }
                    } else if (!isNaN(parseInt(pattern.id))) {
                        numericPatternId = parseInt(pattern.id);
                    }
                }
            }
            
            // Also try originalPatternId if available
            if (!numericPatternId && pattern.originalPatternId) {
                if (typeof pattern.originalPatternId === 'number') {
                    numericPatternId = pattern.originalPatternId;
                } else if (typeof pattern.originalPatternId === 'string') {
                    if (pattern.originalPatternId.includes('-')) {
                        const match = pattern.originalPatternId.match(/\d+/);
                        if (match) {
                            numericPatternId = parseInt(match[0]);
                        }
                    } else if (!isNaN(parseInt(pattern.originalPatternId))) {
                        numericPatternId = parseInt(pattern.originalPatternId);
                    }
                }
            }
            
            console.log('Extracted numeric pattern ID:', numericPatternId, 'from pattern:', pattern);
            
            // Step 2: If we have numeric ID, fetch image from tbl_pattern_media (same as Step6_Preview.jsx)
            if (numericPatternId) {
                // First, verify pattern exists in tbl_patterns (same as Step6_Preview)
                const { data: patternData, error: patternError } = await supabase
                    .from('tbl_patterns')
                    .select('id, pdf_file_name')
                    .eq('id', numericPatternId)
                    .maybeSingle();
                
                if (patternError) {
                    console.error('Error fetching pattern from tbl_patterns:', patternError);
                }
                
                if (!patternData) {
                    console.log('Pattern not found in tbl_patterns. ID:', numericPatternId);
                    toast({
                        title: "Download not available",
                        description: `Pattern with ID ${numericPatternId} not found in database`,
                        variant: "destructive"
                    });
                    return;
                }
                
                // Step 3: Fetch image from tbl_pattern_media using pattern_id (exactly like Step6_Preview.jsx)
                const { data: imageData, error: imageError } = await supabase
                    .from('tbl_pattern_media')
                    .select('image_url')
                    .eq('pattern_id', numericPatternId)
                    .maybeSingle();
                
                if (imageError) {
                    console.error('Error fetching pattern image:', imageError);
                }
                
                const imageUrl = imageData?.image_url || null;
                
                if (imageUrl) {
                    // Fetch the file and create a blob for proper local download (not opening in new tab)
                    try {
                        const response = await fetch(imageUrl);
                        if (!response.ok) throw new Error('Failed to fetch file');
                        
                        const blob = await response.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        
                        // Determine filename
                        const fileName = patternData.pdf_file_name || pattern.patternName || pattern.name || 'pattern.pdf';
                        
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = fileName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Clean up blob URL
                        window.URL.revokeObjectURL(blobUrl);
                        
                        toast({
                            title: "Download started",
                            description: "Pattern download initiated"
                        });
                        return;
                    } catch (fetchError) {
                        console.error('Error downloading pattern file:', fetchError);
                        toast({
                            title: "Download failed",
                            description: "Failed to download pattern file",
                            variant: "destructive"
                        });
                        return;
                    }
                } else {
                    toast({
                        title: "Download not available",
                        description: "Pattern image not found in database",
                        variant: "destructive"
                    });
                }
            } else {
                console.log('No valid numeric pattern ID found. Pattern ID:', pattern.id);
                toast({
                    title: "Download not available",
                    description: "Pattern ID is not valid for download",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error('Error downloading pattern:', error);
            toast({
                title: "Download failed",
                description: error.message || "Failed to download pattern",
                variant: "destructive"
            });
        }
    };
    
    // Download scoresheet handler - Same logic as Step6_Preview.jsx
    const handleDownloadScoresheet = async (scoresheet) => {
        try {
            console.log('Downloading scoresheet:', scoresheet);
            
            // Step 1: Get scoresheet image_url (same as Step6_Preview fetches scoresheet images)
            let imageUrl = scoresheet.image_url || null;
            
            // Step 2: If no image_url, try to fetch from database (same as Step6_Preview)
            if (!imageUrl) {
                // Try by ID first
                if (scoresheet.id) {
                    let numericId = null;
                    if (typeof scoresheet.id === 'number') {
                        numericId = scoresheet.id;
                    } else if (typeof scoresheet.id === 'string') {
                        // Handle string IDs like "scoresheet-0-1-Western Riding"
                        if (scoresheet.id.startsWith('scoresheet-')) {
                            // Try to extract numeric ID if present
                            const match = scoresheet.id.match(/\d+/);
                            if (match) {
                                numericId = parseInt(match[0]);
                            }
                        } else if (!isNaN(parseInt(scoresheet.id))) {
                            numericId = parseInt(scoresheet.id);
                        }
                    }
                    
                    if (numericId) {
                        const { data: scoresheetData, error: scoresheetError } = await supabase
                            .from('tbl_scoresheet')
                            .select('id, image_url, file_name, storage_path')
                            .eq('id', numericId)
                            .maybeSingle();
                        
                        if (scoresheetError) {
                            console.error('Error fetching scoresheet by ID:', scoresheetError);
                        }
                        
                        if (scoresheetData && scoresheetData.image_url) {
                            imageUrl = scoresheetData.image_url;
                        }
                    }
                }
                
                // Fallback: Try to fetch by discipline and association (same as Step6_Preview)
                if (!imageUrl && scoresheet.disciplineName && associationsData.length > 0) {
                    // Get association from discipline
                    const discipline = projectData.disciplines?.[scoresheet.disciplineIndex];
                    const associationId = discipline?.association_id || 
                        (discipline?.selectedAssociations ? 
                         Object.keys(discipline.selectedAssociations).find(key => discipline.selectedAssociations[key]) : null);
                    const association = associationsData.find(a => a.id === associationId);
                    const associationAbbrev = association?.abbreviation;
                    
                    if (associationAbbrev && scoresheet.disciplineName) {
                        try {
                            const { data: scoresheetData, error: scoresheetError } = await supabase
                                .from('tbl_scoresheet')
                                .select('id, image_url, file_name, storage_path, discipline, association_abbrev')
                                .eq('association_abbrev', associationAbbrev)
                                .eq('discipline', scoresheet.disciplineName)
                                .limit(1)
                                .maybeSingle();
                            
                            if (!scoresheetError && scoresheetData && scoresheetData.image_url) {
                                imageUrl = scoresheetData.image_url;
                            }
                        } catch (err) {
                            console.error('Error fetching scoresheet by discipline:', err);
                        }
                    }
                }
            }
            
            // Step 3: Download the file as local file (not opening in new tab)
            if (imageUrl) {
                try {
                    const response = await fetch(imageUrl);
                    if (!response.ok) throw new Error('Failed to fetch file');
                    
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    
                    // Determine filename from storage_path or file_name
                    let fileName = 'scoresheet.png';
                    if (scoresheet.storage_path) {
                        fileName = scoresheet.storage_path.split('/').pop() || fileName;
                    } else if (scoresheet.file_name) {
                        fileName = scoresheet.file_name;
                    } else if (scoresheet.displayName) {
                        fileName = scoresheet.displayName;
                    } else {
                        // Extract from URL
                        const urlParts = imageUrl.split('/');
                        fileName = urlParts[urlParts.length - 1] || fileName;
                    }
                    
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    // Clean up blob URL
                    window.URL.revokeObjectURL(blobUrl);
                    
                    toast({
                        title: "Download started",
                        description: "Scoresheet download initiated"
                    });
                } catch (fetchError) {
                    console.error('Error downloading scoresheet file:', fetchError);
                    toast({
                        title: "Download failed",
                        description: "Failed to download scoresheet file",
                        variant: "destructive"
                    });
                }
            } else {
                toast({
                    title: "Download not available",
                    description: "Scoresheet file not found in database",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error('Error downloading scoresheet:', error);
            toast({
                title: "Download failed",
                description: error.message || "Failed to download scoresheet",
                variant: "destructive"
            });
        }
    };
    
    // Discipline options from project_data.disciplines (source of truth)
    const disciplineOptions = [...new Set((projectData.disciplines || []).map(d => (d?.name || '').trim()))]
        .filter(Boolean)
        .sort();
    
    // Get unique classes from both patterns AND scoresheets
    const allClassesFromPatterns = [...new Set(patterns.map(p => p.groupName))];
    const allClassesFromScoresheets = [...new Set(scoresheets.map(s => s.groupName))];
    const uniqueClasses = [...new Set([...allClassesFromPatterns, ...allClassesFromScoresheets])].filter(Boolean).sort();
    
    // Get unique judges from patterns, scoresheets, and project data (associationJudges)
    const allJudgesFromPatterns = patterns.flatMap(p => p.judges || []);
    const allJudgesFromScoresheets = scoresheets.flatMap(s => s.judges || []);
    const allJudgesFromProjectData = Object.values(projectData.associationJudges || {}).flatMap(assoc => 
        (assoc?.judges || []).map(j => j?.name).filter(Boolean)
    );
    const uniqueJudges = [...new Set([...allJudgesFromPatterns, ...allJudgesFromScoresheets, ...allJudgesFromProjectData])].filter(Boolean).sort();
    
    // Get folder items as patterns/scoresheets when folder is selected
    const folderItemsAsPatterns = useMemo(() => {
        if (selectedSidebarItem === 'folder' && selectedFolderId) {
            const folder = folders.find(f => f.id === selectedFolderId);
            if (folder && folder.items) {
                return folder.items
                    .filter(item => item.type === 'pattern')
                    .map(item => {
                        // Use stored data if available, otherwise try to find in patterns array
                        if (item.data) {
                            return item.data;
                        }
                        // Try to find pattern in main array by ID
                        const foundPattern = patterns.find(p => {
                            const pId = p.id || p.numericId || p.patternId;
                            return (item.id === pId || item.id === String(pId));
                        });
                        return foundPattern;
                    })
                    .filter(Boolean); // Remove any undefined items
            }
        }
        return [];
    }, [selectedSidebarItem, selectedFolderId, folders, patterns]);
    
    const folderItemsAsScoresheets = useMemo(() => {
        if (selectedSidebarItem === 'folder' && selectedFolderId) {
            const folder = folders.find(f => f.id === selectedFolderId);
            if (folder && folder.items) {
                return folder.items
                    .filter(item => item.type === 'scoresheet')
                    .map(item => {
                        // Use stored data if available, otherwise try to find in scoresheets array
                        if (item.data) {
                            return item.data;
                        }
                        // Try to find scoresheet in main array by ID
                        const foundScoresheet = scoresheets.find(s => {
                            const sId = s.id || s.numericId;
                            return (item.id === sId || item.id === String(sId));
                        });
                        return foundScoresheet;
                    })
                    .filter(Boolean); // Remove any undefined items
            }
        }
        return [];
    }, [selectedSidebarItem, selectedFolderId, folders, scoresheets]);
    
    // Filter patterns based on selected filters
    const filteredPatterns = (selectedSidebarItem === 'folder' && selectedFolderId ? folderItemsAsPatterns : patterns).filter(pattern => {
        // Filter by folder if one is selected - already handled by folderItemsAsPatterns
        if (selectedSidebarItem === 'folder' && selectedFolderId) {
            // Items are already filtered, just apply other filters
        } else if (selectedSidebarItem === 'allItems') {
            // Show all items when "All Items" is selected
        } else if (selectedSidebarItem === 'recentlyViewed') {
            // TODO: Implement recently viewed filter
        } else if (selectedSidebarItem === 'assignedToMe') {
            // TODO: Implement assigned to me filter
        }
        
        // Multi-select discipline filter
        if (filterDisciplines.size > 0) {
            const patternDiscipline = (pattern.discipline || '').trim();
            if (!filterDisciplines.has(patternDiscipline)) return false;
        }
        // Multi-select class filter
        if (filterClasses.size > 0 && !filterClasses.has(pattern.groupName)) return false;
        // Multi-select judge filter
        if (filterJudges.size > 0) {
            const patternJudges = pattern.judges || [];
            const patternJudgeNames = pattern.judgeNames || '';
            const hasMatchingJudge = Array.from(filterJudges).some(selectedJudge => 
                patternJudges.includes(selectedJudge) || patternJudgeNames.includes(selectedJudge)
            );
            if (!hasMatchingJudge) return false;
        }
        return true;
    }).sort((a, b) => {
        if (sortBy === 'newest') {
            return (b.numericId || b.id || 0) - (a.numericId || a.id || 0);
        } else if (sortBy === 'oldest') {
            return (a.numericId || a.id || 0) - (b.numericId || b.id || 0);
        } else if (sortBy === 'name') {
            return (a.name || '').localeCompare(b.name || '');
        }
        return 0;
    });
    
    // Filter scoresheets based on selected filters (same filters)
    const filteredScoresheets = (selectedSidebarItem === 'folder' && selectedFolderId ? folderItemsAsScoresheets : scoresheets).filter(scoresheet => {
        // Filter by folder if one is selected - already handled by folderItemsAsScoresheets
        if (selectedSidebarItem === 'folder' && selectedFolderId) {
            // Items are already filtered, just apply other filters
        } else if (selectedSidebarItem === 'allItems') {
            // Show all items when "All Items" is selected
        } else if (selectedSidebarItem === 'recentlyViewed') {
            // TODO: Implement recently viewed filter
        } else if (selectedSidebarItem === 'assignedToMe') {
            // TODO: Implement assigned to me filter
        }
        
        // Multi-select discipline filter
        if (filterDisciplines.size > 0) {
            const scoresheetDiscipline = (scoresheet.disciplineName || scoresheet.discipline || '').trim();
            if (!filterDisciplines.has(scoresheetDiscipline)) return false;
        }
        // Multi-select class filter
        if (filterClasses.size > 0 && !filterClasses.has(scoresheet.groupName)) return false;
        // Multi-select judge filter
        if (filterJudges.size > 0) {
            const scoresheetJudges = scoresheet.judges || [];
            const scoresheetJudgeNames = scoresheet.judgeNames || '';
            const hasMatchingJudge = Array.from(filterJudges).some(selectedJudge => 
                scoresheetJudges.includes(selectedJudge) || scoresheetJudgeNames.includes(selectedJudge)
            );
            if (!hasMatchingJudge) return false;
        }
        return true;
    });
    
    // Fetch data when dialog opens or tabs change
    useEffect(() => {
        if (activeTab === 'patternBook' && activeSubTab === 'patterns') {
            fetchPatterns();
        } else if (activeTab === 'patternBook' && activeSubTab === 'scoreSheets') {
            fetchScoresheets();
        }
    }, [activeTab, activeSubTab]);
    
    const fetchPatterns = async () => {
        setIsLoadingPatterns(true);
        try {
            const disciplines = projectData.disciplines || [];
            const patternSelections = projectData.patternSelections || {};
            const patternsList = [];
            const processedPatterns = new Set();
            
            console.log('=== FETCHING PATTERNS ===');
            console.log('Full project_data:', JSON.stringify(projectData, null, 2));
            console.log('Disciplines:', disciplines);
            console.log('Pattern selections:', patternSelections);
            
            // Collect numeric pattern IDs for database lookup
            const numericPatternIds = new Set();
            
            // First pass: collect numeric pattern IDs from all possible patternSelections structures
            // Iterate through all patternSelections keys to find patterns
            Object.keys(patternSelections).forEach(disciplineKey => {
                const disciplineSelections = patternSelections[disciplineKey];
                if (!disciplineSelections || typeof disciplineSelections !== 'object') return;
                
                // Iterate through all groups in this discipline selection
                Object.keys(disciplineSelections).forEach(groupKey => {
                    const patternSelection = disciplineSelections[groupKey];
                    if (!patternSelection) return;
                    
                    const patternId = typeof patternSelection === 'object' 
                        ? (patternSelection.patternId || patternSelection.id || patternSelection.pattern_id) 
                        : patternSelection;
                    
                    // Try to extract numeric ID
                    if (patternId) {
                        if (typeof patternId === 'string' && patternId.includes('-')) {
                            const match = patternId.match(/\d+/);
                            if (match) {
                                numericPatternIds.add(parseInt(match[0]));
                            }
                        } else if (!isNaN(parseInt(patternId))) {
                            numericPatternIds.add(parseInt(patternId));
                        }
                    }
                });
            });
            
            // Also try the old structure (by index/id/name) for backward compatibility
            for (let disciplineIndex = 0; disciplineIndex < disciplines.length; disciplineIndex++) {
                const discipline = disciplines[disciplineIndex];
                const disciplineName = discipline.name || 'Unknown Discipline';
                const associationId = discipline.association_id || 
                    (discipline.selectedAssociations ? Object.keys(discipline.selectedAssociations).find(key => discipline.selectedAssociations[key]) : null);
                
                let disciplineSelections = patternSelections[disciplineIndex] 
                    || patternSelections[`${disciplineIndex}`]
                    || patternSelections[discipline.id] 
                    || patternSelections[discipline.name];
                
                // Try to find by matching key format
                if (!disciplineSelections && disciplineName && associationId) {
                    const disciplineNameNormalized = disciplineName.replace(/\s+/g, '-');
                    const matchingKey = Object.keys(patternSelections).find(key => {
                        return key.includes(disciplineNameNormalized) && key.includes(associationId);
                    });
                    if (matchingKey) {
                        disciplineSelections = patternSelections[matchingKey];
                    }
                }
                
                if (!disciplineSelections) continue;
                
                const groups = discipline.patternGroups || [];
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    const groupId = group.id || `pattern-group-${groupIndex}`;
                    
                    let patternSelection = disciplineSelections[groupIndex]
                        || disciplineSelections[`${groupIndex}`]
                        || disciplineSelections[groupId]
                        || disciplineSelections[group.id];
                    
                    // Try to find by group ID pattern
                    if (!patternSelection && groupId) {
                        const matchingGroupKey = Object.keys(disciplineSelections).find(key => {
                            return key === groupId || key.includes('pattern-group') || key === `group-${groupIndex}`;
                        });
                        if (matchingGroupKey) {
                            patternSelection = disciplineSelections[matchingGroupKey];
                        }
                    }
                    
                    if (!patternSelection) continue;
                    
                    const patternId = typeof patternSelection === 'object' 
                        ? (patternSelection.patternId || patternSelection.id || patternSelection.pattern_id) 
                        : patternSelection;
                    
                    // Try to extract numeric ID
                    if (patternId) {
                        if (typeof patternId === 'string' && patternId.includes('-')) {
                            const match = patternId.match(/\d+/);
                            if (match) {
                                numericPatternIds.add(parseInt(match[0]));
                            }
                        } else if (!isNaN(parseInt(patternId))) {
                            numericPatternIds.add(parseInt(patternId));
                        }
                    }
                }
            }
            
            // Fetch pattern details from database for numeric IDs (including file URLs and images)
            let patternDetailsMap = {};
            if (numericPatternIds.size > 0) {
                // First try to get from tbl_pattern_media for images and PDF URLs
                const { data: patternMediaData } = await supabase
                    .from('tbl_pattern_media')
                    .select('pattern_id, image_url, pdf_url, file_url')
                    .in('pattern_id', Array.from(numericPatternIds));
                
                if (patternMediaData) {
                    patternMediaData.forEach(pm => {
                        patternDetailsMap[pm.pattern_id] = {
                            image_url: pm.image_url,
                            pdf_url: pm.pdf_url || pm.file_url || pm.image_url,
                            download_url: pm.pdf_url || pm.file_url || pm.image_url
                        };
                    });
                }
                
                // Then get pattern details from tbl_patterns
                const { data: patternData, error: patDetailError } = await supabase
                    .from('tbl_patterns')
                    .select('id, pdf_file_name, pattern_version, discipline, association_name')
                    .in('id', Array.from(numericPatternIds));

                if (!patDetailError && patternData) {
                    patternData.forEach(p => {
                        if (patternDetailsMap[p.id]) {
                            patternDetailsMap[p.id] = {
                                ...patternDetailsMap[p.id],
                                ...p,
                                image_url: patternDetailsMap[p.id].image_url,
                                pdf_url: patternDetailsMap[p.id].pdf_url,
                                download_url: patternDetailsMap[p.id].download_url
                            };
                        } else {
                            patternDetailsMap[p.id] = { ...p };
                        }
                    });
                }
                
                // Also fetch from tbl_pattern_media if we still don't have image_url or pdf_url
                const missingData = Array.from(numericPatternIds).filter(id => 
                    !patternDetailsMap[id] || (!patternDetailsMap[id].image_url && !patternDetailsMap[id].pdf_url)
                );
                if (missingData.length > 0) {
                    const { data: additionalMedia } = await supabase
                        .from('tbl_pattern_media')
                        .select('pattern_id, file_url, image_url')
                        .in('pattern_id', missingData);
                    
                    if (additionalMedia) {
                        additionalMedia.forEach(pm => {
                            if (!patternDetailsMap[pm.pattern_id]) {
                                patternDetailsMap[pm.pattern_id] = {};
                            }
                            if (!patternDetailsMap[pm.pattern_id].image_url && pm.image_url) {
                                patternDetailsMap[pm.pattern_id].image_url = pm.image_url;
                            }
                            if (!patternDetailsMap[pm.pattern_id].pdf_url) {
                                patternDetailsMap[pm.pattern_id].pdf_url = pm.file_url || pm.image_url;
                            }
                            if (!patternDetailsMap[pm.pattern_id].download_url) {
                                patternDetailsMap[pm.pattern_id].download_url = pm.file_url || pm.image_url;
                            }
                        });
                    }
                }
                console.log('Fetched pattern details from DB:', patternDetailsMap);
            }
            
            // Build patterns list with all details from project_data
            for (let disciplineIndex = 0; disciplineIndex < disciplines.length; disciplineIndex++) {
                const discipline = disciplines[disciplineIndex];
                
                // Get discipline name
                const disciplineName = discipline.name || 'Unknown Discipline';
                
                // Get association for this discipline
                const associationId = discipline.association_id || 
                    (discipline.selectedAssociations ? Object.keys(discipline.selectedAssociations).find(key => discipline.selectedAssociations[key]) : null) ||
                    (discipline.associations ? Object.keys(discipline.associations).find(key => discipline.associations[key]) : null);
                
                // Try multiple ways to find discipline selections
                // First try by direct discipline.id (most reliable for unique discipline keys like "VRH-RHC-Ranch-Reining-AQHA-1767684438175")
                let disciplineSelections = patternSelections[discipline.id];
                
                // Then try by index or string index
                if (!disciplineSelections) {
                    disciplineSelections = patternSelections[disciplineIndex] 
                        || patternSelections[`${disciplineIndex}`]
                        || patternSelections[discipline.name];
                }
                
                // If not found, try to find by matching key format: "Discipline-Name-Association-Timestamp"
                if (!disciplineSelections && disciplineName && associationId) {
                    const disciplineNameNormalized = disciplineName.replace(/\s+/g, '-');
                    const associationAbbrev = associationId;
                    
                    // Find matching key in patternSelections - check all possible matching strategies
                    const matchingKey = Object.keys(patternSelections).find(key => {
                        // Skip numeric keys (indices)
                        if (!isNaN(parseInt(key))) return false;
                        // Match format: "Discipline-Name-Association-..." or "Discipline-Name-AssociationAbbrev-..."
                        const keyNormalized = key.toLowerCase();
                        const disciplineNormalized = disciplineNameNormalized.toLowerCase();
                        return keyNormalized.includes(disciplineNormalized) && keyNormalized.includes(associationAbbrev.toLowerCase());
                    });
                    
                    if (matchingKey) {
                        disciplineSelections = patternSelections[matchingKey];
                        console.log(`Found patternSelections for ${disciplineName} using key: ${matchingKey}`);
                    }
                }
                
                if (!disciplineSelections) {
                    console.log(`No selections for discipline index ${disciplineIndex}: ${disciplineName}`);
                    console.log('Available patternSelections keys:', Object.keys(patternSelections));
                    continue;
                }
                
                const groups = discipline.patternGroups || [];
                const groupJudges = projectData.groupJudges?.[disciplineIndex] || projectData.groupJudges?.[`${disciplineIndex}`] || {};
                
                console.log(`Processing discipline ${disciplineIndex}: ${disciplineName} with ${groups.length} groups`);
                console.log(`Discipline selections keys:`, Object.keys(disciplineSelections));
                
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    const groupName = group.name || `Group ${groupIndex + 1}`;
                    const groupId = group.id || `pattern-group-${groupIndex}`;
                    
                    // Try multiple ways to find pattern selection
                    let patternSelection = disciplineSelections[groupIndex]
                        || disciplineSelections[`${groupIndex}`]
                        || disciplineSelections[groupId]
                        || disciplineSelections[group.id]
                        || (Array.isArray(disciplineSelections) ? disciplineSelections[groupIndex] : null);
                    
                    // If not found, try to find by group ID pattern (e.g., "pattern-group-1767684453160")
                    if (!patternSelection && groupId) {
                        const matchingGroupKey = Object.keys(disciplineSelections).find(key => {
                            return key === groupId || key.includes('pattern-group') || key === `group-${groupIndex}`;
                        });
                        
                        if (matchingGroupKey) {
                            patternSelection = disciplineSelections[matchingGroupKey];
                            console.log(`Found pattern selection for group ${groupName} using key: ${matchingGroupKey}`);
                        }
                    }
                    
                    if (!patternSelection) {
                        console.log(`No pattern selection for group ${groupIndex} (${groupName}, id: ${groupId}) in discipline ${disciplineIndex}`);
                        console.log(`Available group keys in disciplineSelections:`, Object.keys(disciplineSelections));
                        continue;
                    }
                    
                    console.log(`Found pattern selection for group ${groupName}:`, patternSelection);
                    
                    // Get pattern ID - could be numeric or string
                    let patternId = typeof patternSelection === 'object' 
                        ? (patternSelection.patternId || patternSelection.id || patternSelection.pattern_id) 
                        : patternSelection;
                    
                    // Get version from patternSelection if available
                    const patternVersion = typeof patternSelection === 'object' 
                        ? (patternSelection.version || patternSelection.patternVersion || patternSelection.pattern_version || 'ALL')
                        : 'ALL';
                    
                    // Extract numeric ID if possible
                    let numericPatternId = null;
                    if (patternId) {
                        if (typeof patternId === 'string' && patternId.includes('-')) {
                            const match = patternId.match(/\d+/);
                            if (match) {
                                numericPatternId = parseInt(match[0]);
                            }
                        } else if (!isNaN(parseInt(patternId))) {
                            numericPatternId = parseInt(patternId);
                        }
                    }
                    
                    console.log(`Pattern ID: ${patternId}, Numeric ID: ${numericPatternId}, Version: ${patternVersion}`);
                    
                    // Get pattern detail from database if we have numeric ID
                    const patternDetail = numericPatternId ? patternDetailsMap[numericPatternId] : null;
                    
                    if (patternDetail) {
                        console.log(`Found pattern detail in DB:`, patternDetail);
                    } else if (numericPatternId) {
                        console.log(`Pattern ${numericPatternId} not found in database`);
                    }
                    
                    // Extract divisions for this group
                    const divisions = Array.isArray(group.divisions) ? group.divisions : [];
                    const extractedDivisions = divisions.map(div => {
                        if (typeof div === 'string') {
                            return { name: div, association: '' };
                        } else if (div && typeof div === 'object') {
                            return {
                                name: div.name || div.divisionName || div.division || div.title || '',
                                association: div.association || div.assocName || (div.association_id ? div.association_id : '')
                            };
                        } else {
                            return { name: String(div || ''), association: '' };
                        }
                    }).filter(div => div.name && div.name.trim() !== '');
                    
                    // Get pattern name - prioritize patternSelection.patternName, then database, then fallback
                    let patternDisplayName = '';
                    
                    // First, check if patternSelection has patternName (from project_data)
                    if (typeof patternSelection === 'object' && patternSelection.patternName) {
                        patternDisplayName = patternSelection.patternName;
                        // Clean up the name (remove .pdf extension if present)
                        if (patternDisplayName.endsWith('.pdf')) {
                            patternDisplayName = patternDisplayName.replace('.pdf', '');
                        }
                        patternDisplayName = patternDisplayName.replace(/_/g, ' ').trim();
                    }
                    // Second, check database patternDetail
                    else if (patternDetail && patternDetail.pdf_file_name) {
                        patternDisplayName = patternDetail.pdf_file_name.replace('.pdf', '').replace(/_/g, ' ').trim();
                    }
                    // Third, try to use patternId if it's meaningful
                    else if (patternId) {
                        if (typeof patternId === 'string' && patternId.length > 0 && !patternId.match(/^pattern-?\d+/i)) {
                            // Use patternId as name if it's a meaningful string identifier
                            patternDisplayName = patternId;
                        } else if (typeof patternId === 'number' || (typeof patternId === 'string' && !isNaN(parseInt(patternId)))) {
                            // If it's just a number, use it with "Pattern" prefix
                            const numId = typeof patternId === 'number' ? patternId : parseInt(patternId);
                            patternDisplayName = `Pattern ${numId}`;
                        } else {
                            patternDisplayName = `Pattern ${numericPatternId || patternsList.length + 1}`;
                        }
                    }
                    // Last resort: use numeric ID or index
                    else {
                        patternDisplayName = `Pattern ${numericPatternId || patternsList.length + 1}`;
                    }
                    
                    // Use patternDisplayName as the main name (discipline is shown separately in UI)
                    // Only add discipline suffix if patternDisplayName is generic like "Pattern 1", "Pattern 2"
                    const isGenericName = patternDisplayName.match(/^Pattern\s+\d+$/i);
                    const patternName = isGenericName 
                        ? `${patternDisplayName} - ${disciplineName}` 
                        : patternDisplayName;
                    
                    // Get judges for this group
                    const judgesForGroup = groupJudges[groupIndex] || groupJudges[`${groupIndex}`] || [];
                    const judgeNames = Array.isArray(judgesForGroup) 
                        ? judgesForGroup 
                        : (judgesForGroup ? [judgesForGroup] : []);
                    
                    // Create unique key based on content, not just indices, to prevent duplicates
                    const uniqueKey = `${disciplineName}-${groupName}-${numericPatternId || patternId || 'no-pattern'}-${patternVersion || 'default'}`;
                    
                    // Always add pattern if we have a selection (even if not in database)
                    if (!processedPatterns.has(uniqueKey)) {
                        patternsList.push({
                            uniqueKey,
                            id: numericPatternId || patternId || `pattern-${disciplineIndex}-${groupIndex}`,
                            numericId: numericPatternId, // Store numeric ID separately for downloads
                            originalPatternId: patternId, // Store original pattern ID
                            name: patternName, // Full name for display
                            discipline: disciplineName,
                            disciplineIndex: disciplineIndex,
                            patternName: patternDisplayName, // Clean pattern name (without discipline suffix)
                            patternVersion: patternVersion || patternDetail?.pattern_version || 'ALL',
                            version: patternVersion, // Store version from patternSelection
                            associationId: patternDetail?.association_id || discipline.association_id,
                            groupName: groupName,
                            groupId: group.id,
                            groupIndex: groupIndex,
                            divisions: extractedDivisions,
                            divisionNames: extractedDivisions.map(d => {
                                // Remove category prefix (e.g., "Open - ", "Amateur - ", "Youth - ")
                                const name = d.name || '';
                                const parts = name.split(' - ');
                                // If there's a " - ", take everything after it; otherwise keep original
                                return parts.length > 1 ? parts.slice(1).join(' - ') : name;
                            }).join(', '),
                            judges: judgeNames,
                            judgeNames: judgeNames.join(', '),
                            image_url: patternDetail?.image_url || null, // Pattern image for display
                            pdf_url: patternDetail?.pdf_url || patternDetail?.download_url || patternDetail?.url || patternDetail?.image_url || null // URL for download
                        });
                        processedPatterns.add(uniqueKey);
                        console.log(`✓ Added pattern: ${patternName}`);
                        console.log(`  - Discipline: ${disciplineName}`);
                        console.log(`  - Class: ${groupName}`);
                        console.log(`  - Divisions: ${extractedDivisions.map(d => d.name).join(', ') || 'None'}`);
                        console.log(`  - Judges: ${judgeNames.join(', ') || 'None'}`);
                    }
                }
            }
            
            console.log('Fetched patterns:', patternsList);
            setPatterns(patternsList);
        } catch (error) {
            console.error('Error fetching patterns:', error);
        } finally {
            setIsLoadingPatterns(false);
        }
    };
    
    const fetchScoresheets = async () => {
        setIsLoadingScoresheets(true);
        try {
            const disciplines = projectData.disciplines || [];
            const patternSelections = projectData.patternSelections || {};
            const scoresheetsList = [];
            const processedScoresheets = new Set();
            
            console.log('=== FETCHING SCORESHEETS ===');
            console.log('Disciplines:', disciplines.length);
            console.log('Pattern selections:', patternSelections);
            
            // Fetch associations data
            const { data: associationsData } = await supabase
                .from('associations')
                .select('id, abbreviation, name');
            
            const associationsMap = {};
            (associationsData || []).forEach(a => {
                associationsMap[a.id] = a;
                associationsMap[a.abbreviation] = a;
            });
            
            // Step 1: Collect all pattern IDs from patternSelections (same as Step6_Preview)
            const selectedPatternIds = [];
            const patternIdToDisciplineMap = {};
            
            for (let disciplineIndex = 0; disciplineIndex < disciplines.length; disciplineIndex++) {
                const discipline = disciplines[disciplineIndex];
                const disciplineName = discipline.name || 'Unknown Discipline';
                
                // Get association for this discipline
                const associationId = discipline.association_id || 
                    (discipline.selectedAssociations ? Object.keys(discipline.selectedAssociations).find(key => discipline.selectedAssociations[key]) : null) ||
                    (discipline.associations ? Object.keys(discipline.associations).find(key => discipline.associations[key]) : null);
                
                // Try multiple ways to find discipline selections
                // First try by direct discipline.id (most reliable for unique discipline keys)
                let disciplineSelections = patternSelections[discipline.id];
                
                // Then try by index or string index
                if (!disciplineSelections) {
                    disciplineSelections = patternSelections[disciplineIndex] 
                        || patternSelections[`${disciplineIndex}`]
                        || patternSelections[discipline.name];
                }
                
                // If not found, try to find by matching key format: "Discipline-Name-Association-Timestamp"
                if (!disciplineSelections && disciplineName && associationId) {
                    const disciplineNameNormalized = disciplineName.replace(/\s+/g, '-');
                    const matchingKey = Object.keys(patternSelections).find(key => {
                        // Skip numeric keys
                        if (!isNaN(parseInt(key))) return false;
                        const keyNormalized = key.toLowerCase();
                        const disciplineNormalized = disciplineNameNormalized.toLowerCase();
                        return keyNormalized.includes(disciplineNormalized) && keyNormalized.includes(associationId.toLowerCase());
                    });
                    if (matchingKey) {
                        disciplineSelections = patternSelections[matchingKey];
                        console.log(`Found patternSelections for ${disciplineName} using key: ${matchingKey}`);
                    }
                }
                
                if (!disciplineSelections) continue;
                
                const groups = discipline.patternGroups || [];
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    const groupId = group.id || `pattern-group-${groupIndex}`;
                    
                    // Try multiple ways to find pattern selection
                    let patternSelection = disciplineSelections[groupIndex]
                        || disciplineSelections[`${groupIndex}`]
                        || disciplineSelections[groupId]
                        || disciplineSelections[group.id];
                    
                    // If not found, try to find by group ID pattern
                    if (!patternSelection && groupId) {
                        const matchingGroupKey = Object.keys(disciplineSelections).find(key => {
                            return key === groupId || key.includes('pattern-group');
                        });
                        if (matchingGroupKey) {
                            patternSelection = disciplineSelections[matchingGroupKey];
                        }
                    }
                    
                    if (!patternSelection) continue;
                    
                    const patternId = typeof patternSelection === 'object' 
                        ? (patternSelection.patternId || patternSelection.id || patternSelection.pattern_id) 
                        : patternSelection;
                    
                    // Extract numeric pattern ID
                    let numericPatternId = null;
                    if (patternId) {
                        if (typeof patternId === 'string' && patternId.includes('-')) {
                            const match = patternId.match(/\d+/);
                            if (match) {
                                numericPatternId = parseInt(match[0]);
                            }
                        } else if (!isNaN(parseInt(patternId))) {
                            numericPatternId = parseInt(patternId);
                        }
                    }
                    
                    if (numericPatternId) {
                        selectedPatternIds.push(numericPatternId);
                        patternIdToDisciplineMap[numericPatternId] = {
                            disciplineIndex,
                            disciplineName,
                            groupIndex,
                            groupName: groups[groupIndex]?.name || `Group ${groupIndex + 1}`,
                            association_id: discipline.association_id,
                            discipline: discipline
                        };
                    }
                }
            }
            
            const uniquePatternIds = [...new Set(selectedPatternIds)].filter(id => !isNaN(id) && isFinite(id));
            console.log('Pattern IDs for scoresheet lookup:', uniquePatternIds);
            
            // Step 2: Fetch scoresheets by pattern_id (same as Step6_Preview)
            const scoresheetMap = {};
            
            if (uniquePatternIds.length > 0) {
                try {
                    // Fetch scoresheets by pattern_id (same as Step6_Preview)
                    const { data: scoresheetData, error: scoresheetError } = await supabase
                        .from('tbl_scoresheet')
                        .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev, city_state')
                        .in('pattern_id', uniquePatternIds);
                    
                    if (scoresheetError) {
                        console.error('Error fetching scoresheets by pattern_id:', scoresheetError);
                    }
                    
                    if (scoresheetData && scoresheetData.length > 0) {
                        scoresheetData.forEach(s => {
                            if (s.pattern_id) {
                                scoresheetMap[s.pattern_id] = s;
                            }
                        });
                    }
                    
                    // Fallback: If pattern_id query returned empty, try by association_abbrev and discipline
                    const missingPatternIds = uniquePatternIds.filter(id => !scoresheetMap[id]);
                    
                    if (missingPatternIds.length > 0 && associationsData.length > 0) {
                        for (const patternId of missingPatternIds) {
                            const disciplineInfo = patternIdToDisciplineMap[patternId];
                            if (disciplineInfo) {
                                const association = associationsMap[disciplineInfo.association_id];
                                const associationAbbrev = association?.abbreviation;
                                
                                if (associationAbbrev && disciplineInfo.disciplineName) {
                                    try {
                                        const { data: fallbackData, error: fallbackError } = await supabase
                                            .from('tbl_scoresheet')
                                            .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev, city_state')
                                            .eq('association_abbrev', associationAbbrev)
                                            .eq('discipline', disciplineInfo.disciplineName)
                                            .limit(1)
                                            .maybeSingle();
                                        
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
            
            // Step 3: Build scoresheets list with all discipline data
            for (let disciplineIndex = 0; disciplineIndex < disciplines.length; disciplineIndex++) {
                const discipline = disciplines[disciplineIndex];
                const disciplineName = discipline.name || 'Unknown Discipline';
                const hasScoresheet = discipline.scoresheet || discipline.pattern_type === 'scoresheet_only' || (!discipline.pattern && discipline.scoresheet);
                
                // Only process disciplines that have scoresheets
                if (!hasScoresheet) continue;
                
                const groups = discipline.patternGroups || [];
                const groupJudges = projectData.groupJudges?.[disciplineIndex] || projectData.groupJudges?.[`${disciplineIndex}`] || {};
                
                // Get association for this discipline
                const associationId = discipline.association_id || 
                    (discipline.selectedAssociations ? Object.keys(discipline.selectedAssociations).find(key => discipline.selectedAssociations[key]) : null) ||
                    (discipline.associations ? Object.keys(discipline.associations).find(key => discipline.associations[key]) : null);
                
                // Try multiple ways to find discipline selections (same as patterns)
                // First try by direct discipline.id (most reliable for unique discipline keys)
                let disciplineSelections = patternSelections[discipline.id];
                
                // Then try by index or string index
                if (!disciplineSelections) {
                    disciplineSelections = patternSelections[disciplineIndex] 
                        || patternSelections[`${disciplineIndex}`]
                        || patternSelections[discipline.name];
                }
                
                // If not found, try to find by matching key format
                if (!disciplineSelections && disciplineName && associationId) {
                    const disciplineNameNormalized = disciplineName.replace(/\s+/g, '-');
                    const matchingKey = Object.keys(patternSelections).find(key => {
                        // Skip numeric keys
                        if (!isNaN(parseInt(key))) return false;
                        const keyNormalized = key.toLowerCase();
                        const disciplineNormalized = disciplineNameNormalized.toLowerCase();
                        return keyNormalized.includes(disciplineNormalized) && keyNormalized.includes(associationId.toLowerCase());
                    });
                    if (matchingKey) {
                        disciplineSelections = patternSelections[matchingKey];
                        console.log(`Found patternSelections for scoresheet ${disciplineName} using key: ${matchingKey}`);
                    }
                }
                
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    const groupName = group.name || `Group ${groupIndex + 1}`;
                    const groupId = group.id || `pattern-group-${groupIndex}`;
                    
                    // Get judges for this group
                    const judgesForGroup = groupJudges[groupIndex] || groupJudges[`${groupIndex}`] || [];
                    const judgeNames = Array.isArray(judgesForGroup) 
                        ? judgesForGroup 
                        : (judgesForGroup ? [judgesForGroup] : []);
                    
                    // Get pattern selection to find pattern ID - try multiple matching strategies
                    let patternSelection = disciplineSelections?.[groupIndex]
                        || disciplineSelections?.[`${groupIndex}`]
                        || disciplineSelections?.[groupId]
                        || disciplineSelections?.[group.id];
                    
                    // If not found, try to find by group ID pattern
                    if (!patternSelection && disciplineSelections && groupId) {
                        const matchingGroupKey = Object.keys(disciplineSelections).find(key => {
                            return key === groupId || key.includes('pattern-group');
                        });
                        if (matchingGroupKey) {
                            patternSelection = disciplineSelections[matchingGroupKey];
                        }
                    }
                    
                    let scoresheetData = null;
                    let numericPatternId = null;
                    
                    // Try to get pattern ID from selection
                    if (patternSelection) {
                        const patternId = typeof patternSelection === 'object' 
                            ? (patternSelection.patternId || patternSelection.id || patternSelection.pattern_id) 
                            : patternSelection;
                        
                        if (patternId) {
                            if (typeof patternId === 'string' && patternId.includes('-')) {
                                const match = patternId.match(/\d+/);
                                if (match) {
                                    numericPatternId = parseInt(match[0]);
                                }
                            } else if (!isNaN(parseInt(patternId))) {
                                numericPatternId = parseInt(patternId);
                            }
                        }
                    }
                    
                    // Get scoresheet from map using pattern_id
                    if (numericPatternId && scoresheetMap[numericPatternId]) {
                        scoresheetData = scoresheetMap[numericPatternId];
                    }
                    
                    // Fallback: Try to get from patternSelection.scoresheetData
                    if (!scoresheetData && patternSelection && typeof patternSelection === 'object' && patternSelection.scoresheetData) {
                        scoresheetData = patternSelection.scoresheetData;
                    }
                    
                    // Fallback: Try to fetch by association and discipline
                    if (!scoresheetData) {
                        const associationId = discipline.association_id || 
                            (discipline.selectedAssociations ? 
                             Object.keys(discipline.selectedAssociations).find(key => discipline.selectedAssociations[key]) : null);
                        const association = associationsMap[associationId] || associationsMap[associationId?.abbreviation];
                        
                        if (association?.abbreviation && disciplineName) {
                            try {
                                const { data: scoresheet } = await supabase
                                    .from('tbl_scoresheet')
                                    .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev, city_state')
                                    .eq('association_abbrev', association.abbreviation)
                                    .ilike('discipline', `%${disciplineName}%`)
                                    .limit(1)
                                    .maybeSingle();
                                
                                if (scoresheet) {
                                    scoresheetData = scoresheet;
                                }
                            } catch (err) {
                                console.error(`Error fetching scoresheet for ${disciplineName}:`, err);
                            }
                        }
                    }
                    
                    // Extract divisions for scoresheet
                    const divisions = Array.isArray(group.divisions) ? group.divisions : [];
                    const extractedDivisions = divisions.map(div => {
                        if (typeof div === 'string') {
                            return { name: div };
                        } else if (div && typeof div === 'object') {
                            return {
                                name: div.name || div.divisionName || div.division || div.title || ''
                            };
                        } else {
                            return { name: String(div || '') };
                        }
                    }).filter(div => div.name && div.name.trim() !== '');
                    
                    // Get scoresheet name
                    const scoresheetName = scoresheetData?.file_name 
                        || scoresheetData?.discipline 
                        || `${disciplineName} Scoresheet`;
                    
                    // Create unique key based on content to prevent duplicates
                    const uniqueKey = `${disciplineName}-${groupName}-${scoresheetData?.id || 'no-scoresheet'}`;
                    
                    if (!processedScoresheets.has(uniqueKey)) {
                        scoresheetsList.push({
                            ...(scoresheetData || {}),
                            uniqueKey,
                            id: scoresheetData?.id || `scoresheet-${disciplineIndex}-${groupIndex}`,
                            disciplineName: disciplineName,
                            disciplineIndex: disciplineIndex,
                            groupName: groupName,
                            groupIndex: groupIndex,
                            displayName: scoresheetName,
                            divisions: extractedDivisions,
                            divisionNames: extractedDivisions.map(d => {
                                // Remove category prefix (e.g., "Open - ", "Amateur - ", "Youth - ")
                                const name = d.name || '';
                                const parts = name.split(' - ');
                                // If there's a " - ", take everything after it; otherwise keep original
                                return parts.length > 1 ? parts.slice(1).join(' - ') : name;
                            }).join(', '),
                            judges: judgeNames,
                            judgeNames: judgeNames.join(', '),
                            image_url: scoresheetData?.image_url || null // Ensure image_url is stored
                        });
                        processedScoresheets.add(uniqueKey);
                        console.log(`✓ Added scoresheet: ${scoresheetName}`);
                        console.log(`  - Discipline: ${disciplineName}`);
                        console.log(`  - Class: ${groupName}`);
                        console.log(`  - Divisions: ${extractedDivisions.map(d => d.name).join(', ') || 'None'}`);
                        console.log(`  - Judges: ${judgeNames.join(', ') || 'None'}`);
                        console.log(`  - Image URL: ${scoresheetData?.image_url || 'Not found'}`);
                    }
                }
            }
            
            console.log('Total scoresheets fetched:', scoresheetsList.length);
            setScoresheets(scoresheetsList);
        } catch (error) {
            console.error('Error fetching scoresheets:', error);
        } finally {
            setIsLoadingScoresheets(false);
        }
    };
    
    // Get people data
    const getPeopleData = () => {
        const owner = projectData.adminOwner || profile?.full_name || user?.email || 'Not set';
        
        // Get admin - check secondAdmin or officials with admin role
        let admin = projectData.secondAdmin || 'Not set';
        if (admin === 'Not set') {
            const adminOfficial = projectData.officials?.find(o => o.role === 'admin');
            admin = adminOfficial?.name || 'Not set';
        }
        
        // Collect judges from associationJudges
        const judgesList = [];
        Object.values(projectData.associationJudges || {}).forEach(assocData => {
            const judges = assocData?.judges || (Array.isArray(assocData) ? assocData : []);
            if (Array.isArray(judges)) {
                judges.forEach(judge => {
                    if (typeof judge === 'string') {
                        judgesList.push(judge);
                    } else if (judge?.name) {
                        judgesList.push(judge.name);
                    } else if (judge?.email) {
                        judgesList.push(judge.email);
                    }
                });
            }
        });
        
        // Also collect judges from officials
        const officials = projectData.officials || [];
        const judgeOfficials = officials.filter(o => o.role === 'judge');
        judgeOfficials.forEach(judge => {
            if (judge.name && !judgesList.includes(judge.name)) {
                judgesList.push(judge.name);
            } else if (judge.email && !judgesList.includes(judge.email)) {
                judgesList.push(judge.email);
            }
        });
        
        const judgesCount = judgesList.length;
        
        // Count staff (excluding judges and admins)
        const staffCount = officials.filter(o => o.role !== 'judge' && o.role !== 'admin').length;
        
        // Return admin as is (no fallback to judges count)
        return { owner, admin, judgesCount, staffCount, judgesList };
    };
    
    const { owner, admin, judgesCount, staffCount, judgesList } = getPeopleData();
    
    // Get selected associations
    const selectedAssociations = Object.keys(projectData.associations || {}).filter(key => projectData.associations[key]);
    const affiliations = associationsData.filter(a => 
        selectedAssociations.includes(a.id) || selectedAssociations.includes(a.abbreviation)
    );
    
    // Folder management functions
    const generateFolderId = () => `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const saveFoldersToProject = async (updatedFolders) => {
        try {
            const updatedProjectData = {
                ...projectData,
                eventsPageFolders: updatedFolders, // Use separate key for EventsPage
            };

            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedProjectData })
                .eq('id', project.id);

            if (error) {
                console.error('Error saving folders:', error);
                toast({
                    title: "Error",
                    description: error.message || "Failed to save folders",
                    variant: "destructive",
                });
                return { ok: false, error };
            }

            return { ok: true };
        } catch (error) {
            console.error('Error saving folders:', error);
            toast({
                title: "Error",
                description: error?.message || "Failed to save folders",
                variant: "destructive",
            });
            return { ok: false, error };
        }
    };
    
    const handleCreateFolder = async (folderName, parentId = null) => {
        if (!folderName || !folderName.trim()) {
            setIsCreatingFolder(false);
            setCreatingFolderParentId(null);
            return;
        }
        
        const newFolder = {
            id: generateFolderId(),
            name: folderName.trim(),
            parentId: parentId || null,
            items: [], // Store pattern/scoresheet IDs here
            createdAt: new Date().toISOString()
        };
        
        const updatedFolders = [...folders, newFolder];
        setFolders(updatedFolders);
        await saveFoldersToProject(updatedFolders);
        
        // Auto-expand parent folder if nested
        if (parentId) {
            setExpandedFolders(prev => new Set([...prev, parentId]));
        }
        
        setIsCreatingFolder(false);
        setCreatingFolderParentId(null);
        
        toast({
            title: "Folder Created",
            description: `"${newFolder.name}" has been created`
        });
    };
    
    const startCreatingFolder = (parentId = null) => {
        setIsCreatingFolder(true);
        setCreatingFolderParentId(parentId);
        setNewFolderName('');
        // Auto-expand parent folder if creating a subfolder
        if (parentId) {
            setExpandedFolders(prev => new Set([...prev, parentId]));
        }
    };
    
    const cancelCreatingFolder = () => {
        setIsCreatingFolder(false);
        setCreatingFolderParentId(null);
        setNewFolderName('');
    };
    
    const handleInlineRename = async (folderId, newName) => {
        if (!newName || !newName.trim()) {
            setRenamingFolderId(null);
            setEditingFolderName('');
            return;
        }
        
        const updatedFolders = folders.map(folder =>
            folder.id === folderId
                ? { ...folder, name: newName.trim() }
                : folder
        );
        
        setFolders(updatedFolders);
        await saveFoldersToProject(updatedFolders);
        
        setRenamingFolderId(null);
        setEditingFolderName('');
        
        toast({
            title: "Folder Renamed",
            description: `Folder has been renamed to "${newName.trim()}"`
        });
    };
    
    const startRenamingFolder = (folderId, currentName) => {
        setRenamingFolderId(folderId);
        setEditingFolderName(currentName);
    };
    
    // Drag and drop handlers
    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(active.id);
        
        // Find the item being dragged (pattern or scoresheet)
        const itemId = active.id.toString();
        if (itemId.startsWith('pattern-')) {
            // Extract the unique identifier from the ID
            const uniqueId = itemId.replace('pattern-', '');
            // Find pattern by matching uniqueKey, id, numericId, or originalPatternId
            const pattern = filteredPatterns.find(p => 
                (p.uniqueKey && String(p.uniqueKey) === uniqueId) ||
                (p.id && String(p.id) === uniqueId) ||
                (p.numericId && String(p.numericId) === uniqueId) ||
                (p.originalPatternId && String(p.originalPatternId) === uniqueId)
            );
            if (pattern) {
                const index = filteredPatterns.indexOf(pattern);
                setDraggedItem({ type: 'pattern', data: pattern, index });
            }
        } else if (itemId.startsWith('scoresheet-')) {
            // Extract the unique identifier from the ID
            const uniqueId = itemId.replace('scoresheet-', '');
            // Find scoresheet by matching uniqueKey, id, numericId, or pattern_id
            const scoresheet = filteredScoresheets.find(s => 
                (s.uniqueKey && String(s.uniqueKey) === uniqueId) ||
                (s.id && String(s.id) === uniqueId) ||
                (s.numericId && String(s.numericId) === uniqueId) ||
                (s.pattern_id && String(s.pattern_id) === uniqueId)
            );
            if (scoresheet) {
                const index = filteredScoresheets.indexOf(scoresheet);
                setDraggedItem({ type: 'scoresheet', data: scoresheet, index });
            }
        }
    };
    
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        
        if (!over || !draggedItem) {
            setActiveId(null);
            setDraggedItem(null);
            return;
        }
        
        const overId = over.id.toString();
        
        // Check if dropped on a folder
        if (overId.startsWith('folder-')) {
            const folderId = overId.replace('folder-', '');
            const folder = folders.find(f => f.id === folderId);
            
            if (folder) {
                // Get unique identifier for the item
                const itemId = draggedItem.data.id || 
                              draggedItem.data.numericId || 
                              `${draggedItem.type}-${draggedItem.index}`;
                
                // Check if item already exists in folder
                const itemExists = folder.items.some(item => 
                    item.id === itemId && item.type === draggedItem.type
                );
                
                if (!itemExists) {
                    // Copy item to folder (don't remove from original list)
                    const updatedFolders = folders.map(f => {
                        if (f.id === folderId) {
                            return {
                                ...f,
                                items: [...f.items, { 
                                    id: itemId, 
                                    type: draggedItem.type,
                                    data: draggedItem.data, // Store full data for reference
                                    storedAt: new Date().toISOString() // Store timestamp when added
                                }]
                            };
                        }
                        return f;
                    });
                    
                    setFolders(updatedFolders);
                    await saveFoldersToProject(updatedFolders);
                    
                    // Auto-expand folder if collapsed
                    setExpandedFolders(prev => new Set([...prev, folderId]));
                    
                    toast({
                        title: "Item Added to Folder",
                        description: `${draggedItem.type === 'pattern' ? 'Pattern' : 'Scoresheet'} copied to "${folder.name}"`
                    });
                } else {
                    toast({
                        title: "Already in Folder",
                        description: "This item is already in the selected folder",
                        variant: "default"
                    });
                }
            }
        }
        
        setActiveId(null);
        setDraggedItem(null);
    };
    
    const handleDragOver = (event) => {
        // This helps ensure proper collision detection for nested droppables
        // The custom collision detection function handles the logic
    };
    
    const handleDragCancel = () => {
        setActiveId(null);
        setDraggedItem(null);
    };
    
    const handleRenameFolder = async () => {
        if (!newFolderName.trim() || !editingFolderId) {
            toast({
                title: "Invalid Name",
                description: "Folder name cannot be empty",
                variant: "destructive"
            });
            return;
        }
        
        const updatedFolders = folders.map(folder =>
            folder.id === editingFolderId
                ? { ...folder, name: newFolderName.trim() }
                : folder
        );
        
        setFolders(updatedFolders);
        await saveFoldersToProject(updatedFolders);
        
        setNewFolderName('');
        setEditingFolderId(null);
        setRenameFolderDialogOpen(false);
        
        toast({
            title: "Folder Renamed",
            description: `Folder has been renamed to "${newFolderName.trim()}"`
        });
    };
    
    const handleDeleteFolder = async (folderId = null) => {
        // Some UI elements (droppable IDs) prefix folder IDs with "folder-".
        // Normalize so we always delete by the real folder.id stored in state.
        const resolveFolderId = (maybeId) => {
            if (!maybeId) return null;

            const raw = String(maybeId);
            if (folders.some((f) => String(f.id) === raw)) return raw;

            // Strip repeated "folder-" prefixes until we find a match.
            let probe = raw;
            while (probe.startsWith('folder-')) {
                probe = probe.replace(/^folder-/, '');
                if (folders.some((f) => String(f.id) === probe)) return probe;
            }

            return raw;
        };

        const rawTargetId = folderId || folderToDelete;
        const targetFolderId = resolveFolderId(rawTargetId);

        if (!targetFolderId) return;

        const getAllNestedFolderIds = (parentId, allFolders) => {
            const ids = [String(parentId)];
            const childFolders = allFolders.filter((f) => String(f.parentId) === String(parentId));
            childFolders.forEach((child) => {
                ids.push(...getAllNestedFolderIds(child.id, allFolders));
            });
            return ids;
        };

        const folderIdsToDelete = new Set(getAllNestedFolderIds(targetFolderId, folders).map(String));

        console.log('[Folders] delete requested', {
            rawTargetId,
            targetFolderId,
            folderIdsToDelete: [...folderIdsToDelete],
            allFolderIds: folders.map((f) => String(f.id)),
        });

        // If the current view is inside the folder tree being deleted, navigate out.
        if (selectedFolderId && folderIdsToDelete.has(String(selectedFolderId))) {
            const targetFolder = folders.find((f) => String(f.id) === String(targetFolderId));
            const nextFolderId = targetFolder?.parentId;

            if (nextFolderId && !folderIdsToDelete.has(String(nextFolderId)) && folders.some((f) => String(f.id) === String(nextFolderId))) {
                setSelectedFolderId(nextFolderId);
            } else {
                setSelectedSidebarItem('allItems');
                setSelectedFolderId(null);
            }
        }

        const prevFolders = folders;
        const updatedFolders = folders.filter((folder) => !folderIdsToDelete.has(String(folder.id)));

        // Optimistic UI update
        setFolders(updatedFolders);

        // Clean up expanded state so deleted folders don't linger in UI state.
        setExpandedFolders((prev) => {
            const next = new Set([...prev].filter((id) => !folderIdsToDelete.has(String(id))));
            return next;
        });

        const saveResult = await saveFoldersToProject(updatedFolders);
        if (!saveResult?.ok) {
            // Revert if persistence failed
            console.warn('[Folders] delete failed, reverting UI');
            setFolders(prevFolders);
            return;
        }

        setFolderToDelete(null);
        setDeleteFolderDialogOpen(false);

        toast({
            title: "Folder Deleted",
            description: `Folder and ${folderIdsToDelete.size > 1 ? 'its subfolders have' : 'its contents have'} been removed`,
        });
    };
    
    const handleAddToFolder = async (itemId, itemType = 'pattern', folderId = null, itemData = null) => {
        const targetFolderId = folderId || selectedFolderId;
        
        if (!targetFolderId) {
            toast({
                title: "No Folder Selected",
                description: "Please select a folder first",
                variant: "destructive"
            });
            return;
        }
        
        // Find the item data if not provided
        let foundItemData = itemData;
        if (!foundItemData) {
            if (itemType === 'pattern') {
                foundItemData = patterns.find(p => {
                    const pId = p.id || p.numericId || p.patternId;
                    return (itemId === pId || itemId === String(pId));
                });
            } else if (itemType === 'scoresheet') {
                foundItemData = scoresheets.find(s => {
                    const sId = s.id || s.numericId;
                    return (itemId === sId || itemId === String(sId));
                });
            }
        }
        
        const updatedFolders = folders.map(folder => {
            if (folder.id === targetFolderId) {
                // Check if item already exists
                const itemExists = folder.items.some(item => item.id === itemId && item.type === itemType);
                if (!itemExists) {
                    return {
                        ...folder,
                        items: [...folder.items, { 
                            id: itemId, 
                            type: itemType,
                            data: foundItemData, // Store full data
                            storedAt: new Date().toISOString() // Store timestamp
                        }]
                    };
                } else {
                    toast({
                        title: "Already in Folder",
                        description: "This item is already in the selected folder",
                        variant: "default"
                    });
                }
            }
            return folder;
        });
        
        setFolders(updatedFolders);
        await saveFoldersToProject(updatedFolders);
        
        if (updatedFolders.some(f => f.id === targetFolderId && f.items.some(item => item.id === itemId && item.type === itemType))) {
            toast({
                title: "Item Added",
                description: "Item has been added to folder"
            });
        }
    };
    
    const toggleFolderExpansion = (folderId) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    };
    
    const getFolderItemCount = (folderId) => {
        const folder = folders.find(f => f.id === folderId);
        return folder?.items?.length || 0;
    };
    
    const handleRemoveItemFromFolder = async (itemId, itemType, folderId) => {
        const updatedFolders = folders.map(folder => {
            if (folder.id === folderId) {
                return {
                    ...folder,
                    items: folder.items.filter(item => 
                        !(item.id === itemId && item.type === itemType)
                    )
                };
            }
            return folder;
        });
        
        setFolders(updatedFolders);
        await saveFoldersToProject(updatedFolders);
        
        toast({
            title: "Item Removed",
            description: "Item has been removed from folder"
        });
    };
    
    const handleDownloadFolderContents = async (folder) => {
        try {
            if (!folder || !folder.id) {
                toast({
                    title: "Error",
                    description: "Folder not found",
                    variant: "destructive"
                });
                return;
            }
            
            // Get the latest folder data from state to ensure we have all items
            const latestFolder = folders.find(f => f.id === folder.id);
            if (!latestFolder) {
                toast({
                    title: "Error",
                    description: "Folder not found in state",
                    variant: "destructive"
                });
                return;
            }
            
            // Count total items including subfolders
            const countItems = (f) => {
                // Get latest folder data
                const folderData = folders.find(folder => folder.id === f.id) || f;
                let count = folderData.items?.length || 0;
                const subfolders = folders.filter(sub => sub.parentId === folderData.id);
                subfolders.forEach(sub => {
                    count += countItems(sub);
                });
                return count;
            };
            
            const totalItems = countItems(latestFolder);
            
            if (totalItems === 0) {
                toast({
                    title: "Folder Empty",
                    description: "This folder has no items to download",
                    variant: "default"
                });
                return;
            }
            
            toast({
                title: "Preparing Download",
                description: `Downloading ${totalItems} item(s) from "${latestFolder.name}"...`
            });
            
            const zip = new JSZip();
            const folderName = latestFolder.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'folder';
            
            // Track downloaded items
            let downloadedCount = 0;
            let failedCount = 0;
            const failedItems = [];
            
            // Recursive function to add folder and its contents to ZIP
            const addFolderToZip = async (currentFolder, zipFolder) => {
                // Get the latest folder data from state
                const folderData = folders.find(f => f.id === currentFolder.id) || currentFolder;
                
                // Add items in current folder
                if (folderData.items && folderData.items.length > 0) {
                    console.log(`Processing ${folderData.items.length} items in folder "${folderData.name}"`);
                    for (let i = 0; i < folderData.items.length; i++) {
                        const item = folderData.items[i];
                        console.log(`Processing item ${i + 1}/${folderData.items.length}:`, item);
                        
                        try {
                            let fileUrl = null;
                            let fileName = null;
                            
                            if (item.type === 'pattern') {
                                // Use stored data if available
                                let patternData = item.data;
                                
                                // If no stored data, try to find in patterns array
                                if (!patternData) {
                                    patternData = patterns.find(p => {
                                        const pId = p.id || p.numericId || p.patternId;
                                        const itemId = item.id;
                                        return (
                                            (pId === itemId) || 
                                            (String(pId) === String(itemId)) ||
                                            (p.patternName === item.data?.patternName) ||
                                            (p.name === item.data?.name)
                                        );
                                    });
                                }
                                
                                if (patternData) {
                                    console.log('Found pattern data:', patternData);
                                    // Try multiple URL sources
                                    fileUrl = patternData.pdf_url || 
                                             patternData.download_url || 
                                             patternData.image_url ||
                                             patternData.url;
                                    fileName = patternData.patternName || 
                                              patternData.name || 
                                              patternData.pdf_file_name ||
                                              `pattern_${item.id}.pdf`;
                                    
                                    console.log(`Pattern fileUrl: ${fileUrl}, fileName: ${fileName}`);
                                    
                                    // If still no URL, try to fetch from database using pattern ID
                                    // Check multiple ID sources: numericId, originalPatternId, id
                                    const possibleIds = [
                                        patternData.numericId,
                                        patternData.originalPatternId,
                                        patternData.id,
                                        patternData.patternId
                                    ].filter(Boolean);
                                    
                                    console.log('Possible pattern IDs to try:', possibleIds);
                                    
                                    if (!fileUrl && possibleIds.length > 0) {
                                        for (const potentialId of possibleIds) {
                                            try {
                                                let numericId = null;
                                                if (typeof potentialId === 'number') {
                                                    numericId = potentialId;
                                                } else if (typeof potentialId === 'string') {
                                                    // Handle formats like "pattern-1-ALL" or just "123"
                                                    if (potentialId.includes('-')) {
                                                        const match = potentialId.match(/\d+/);
                                                        if (match) {
                                                            numericId = parseInt(match[0]);
                                                        }
                                                    } else if (!isNaN(parseInt(potentialId))) {
                                                        numericId = parseInt(potentialId);
                                                    }
                                                }
                                                
                                                if (numericId && !isNaN(numericId)) {
                                                    console.log(`Trying to fetch pattern image for ID: ${numericId}`);
                                                    const { data: patternDetail, error: patternError } = await supabase
                                                        .from('tbl_pattern_media')
                                                        .select('image_url, file_url, storage_path')
                                                        .eq('pattern_id', numericId)
                                                        .maybeSingle();
                                                    
                                                    console.log('Pattern media query result:', { patternDetail, patternError });
                                                    
                                                    if (!patternError && patternDetail) {
                                                        fileUrl = patternDetail.image_url || patternDetail.file_url;
                                                        console.log('Fetched pattern URL from database:', fileUrl);
                                                        if (fileUrl) break; // Found URL, stop trying other IDs
                                                    }
                                                }
                                            } catch (dbError) {
                                                console.error('Error fetching pattern from database:', dbError);
                                            }
                                        }
                                    }
                                } else {
                                    console.warn('Pattern data not found for item:', item);
                                }
                            } else if (item.type === 'scoresheet') {
                                // Use stored data if available
                                const scoresheetData = item.data || scoresheets.find(s => {
                                    const sId = s.id || s.numericId;
                                    return (item.id === sId || item.id === String(sId));
                                });
                                
                                if (scoresheetData) {
                                    fileUrl = scoresheetData.image_url || scoresheetData.download_url;
                                    fileName = scoresheetData.displayName || scoresheetData.file_name || scoresheetData.disciplineName || `scoresheet_${item.id}.pdf`;
                                }
                            }
                            
                            if (fileUrl) {
                                try {
                                    console.log(`Fetching file from URL: ${fileUrl}`);
                                    const response = await fetch(fileUrl);
                                    if (response.ok) {
                                        const blob = await response.blob();
                                        // Sanitize filename
                                        const sanitizedFileName = fileName.replace(/[^a-z0-9._-]/gi, '_');
                                        zipFolder.file(sanitizedFileName, blob);
                                        downloadedCount++;
                                        console.log(`✓ Added file to ZIP: ${sanitizedFileName}`);
                                    } else {
                                        failedCount++;
                                        failedItems.push({ name: fileName, type: item.type, reason: `HTTP ${response.status}` });
                                        console.error(`Failed to fetch file: ${response.status} ${response.statusText}`);
                                    }
                                } catch (fetchError) {
                                    failedCount++;
                                    failedItems.push({ name: fileName || item.id, type: item.type, reason: fetchError.message });
                                    console.error(`Error fetching file for item ${item.id}:`, fetchError);
                                }
                            } else {
                                failedCount++;
                                failedItems.push({ name: item.id, type: item.type, reason: 'No file URL available' });
                                console.warn(`No fileUrl found for item ${item.id} (type: ${item.type})`);
                            }
                        } catch (itemError) {
                            console.error(`Error processing item ${item.id}:`, itemError);
                        }
                    }
                }
                
                // Add subfolders recursively
                const subfolders = folders.filter(f => f.parentId === folderData.id);
                console.log(`Found ${subfolders.length} subfolders in "${folderData.name}"`);
                for (const subfolder of subfolders) {
                    const subfolderName = subfolder.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'subfolder';
                    const subfolderZip = zipFolder.folder(subfolderName);
                    await addFolderToZip(subfolder, subfolderZip);
                }
            };
            
            // Start adding from root folder
            const rootZipFolder = zip.folder(folderName);
            await addFolderToZip(latestFolder, rootZipFolder);
            
            // Generate ZIP file
            const content = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            
            // Trigger download
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${folderName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            const successMessage = failedCount > 0 
                ? `Downloaded ${downloadedCount} item(s), ${failedCount} failed`
                : `Downloaded ${downloadedCount} item(s) successfully`;
            
            toast({
                title: downloadedCount > 0 ? "Download Complete" : "Download Failed",
                description: successMessage,
                variant: failedCount > 0 ? "default" : "default"
            });
            
            if (failedCount > 0) {
                console.warn('Failed items:', failedItems);
            }
        } catch (error) {
            console.error('Error downloading folder:', error);
            toast({
                title: "Download Failed",
                description: error.message || "Failed to download folder",
                variant: "destructive"
            });
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        <h2 className="text-2xl font-bold">{project.project_name || 'Untitled Project'}</h2>
                    </div>
              
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span>
                        Show dates: {
                            projectData.startDate 
                                ? projectData.endDate && projectData.startDate !== projectData.endDate
                                    ? `${format(new Date(projectData.startDate), "MMM d")} - ${format(new Date(projectData.endDate), "MMM d, yyyy")}`
                                    : format(new Date(projectData.startDate), "MMM d, yyyy")
                                : 'Not set'
                        }
                    </span>
                    <span>Location: {projectData.venueName || projectData.venueAddress || 'Not set'}</span>
                    <span>Last saved: {format(new Date(project.updated_at), "MMM d, yyyy")}</span>
                </div>
                
                {/* Main Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('patternBook')}
                        className={`px-4 py-2 rounded-full text-sm font-medium ${
                            activeTab === 'patternBook' 
                                ? 'bg-primary text-white' 
                                : 'bg-transparent text-muted-foreground hover:bg-primary/10'
                        }`}
                    >
                        Pattern Book
                    </button>
                    
                    {/* Association Logos */}
                    <div className="flex items-center gap-2 ml-auto">
                        {affiliations.map(assoc => {
                            const logoUrl = assoc.logo_url || (assoc.logo && typeof assoc.logo === 'string' && assoc.logo.startsWith('http') ? assoc.logo : null);
                            return logoUrl ? (
                                <img key={assoc.id} src={logoUrl} alt={assoc.name} className="h-8 w-auto max-w-[100px] object-contain" />
                            ) : null;
                        })}
                    </div>
                </div>
            </div>
            
            {/* Main Content */}
            <DndContext
                sensors={sensors}
                collisionDetection={(args) => {
                    try {
                        // ONLY use pointerWithin - requires pointer to be directly over target
                        // Do NOT fallback to closestCenter as it causes auto-assignment when not hovering
                        const pointerCollisions = pointerWithin(args);
                        if (pointerCollisions && pointerCollisions.length > 0) {
                            // Sort by depth (more specific/nested items first)
                            const sorted = [...pointerCollisions].sort((a, b) => {
                                try {
                                    const aId = a.id?.toString() || '';
                                    const bId = b.id?.toString() || '';
                                    // Prioritize folders that are deeper in hierarchy
                                    if (aId.startsWith('folder-') && bId.startsWith('folder-')) {
                                        const aFolderId = aId.replace('folder-', '');
                                        const bFolderId = bId.replace('folder-', '');
                                        const aFolder = folders?.find(f => f.id === aFolderId);
                                        const bFolder = folders?.find(f => f.id === bFolderId);
                                        // If one is a child of the other, prioritize the child
                                        if (aFolder?.parentId === bFolder?.id) return -1;
                                        if (bFolder?.parentId === aFolder?.id) return 1;
                                    }
                                } catch (e) {
                                    console.error('Error in collision detection sort:', e);
                                }
                                return 0;
                            });
                            return sorted;
                        }
                    } catch (e) {
                        console.error('Error in collision detection:', e);
                    }
                    // Return empty array - no valid drop target if pointer isn't directly over one
                    return [];
                }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar */}
                    <div className="w-64 border-r bg-muted/30 p-4 flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold mb-2">My Filing System</h3>
                        <div className="space-y-1">
                            <button
                                onClick={() => {
                                    setSelectedSidebarItem('allItems');
                                    setSelectedFolderId(null);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${
                                    selectedSidebarItem === 'allItems' ? 'bg-primary text-white' : 'hover:bg-muted'
                                }`}
                            >
                                <LayoutGrid className="h-4 w-4" />
                                All Items
                            </button>
                            <button
                                onClick={() => setSelectedSidebarItem('recentlyViewed')}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${
                                    selectedSidebarItem === 'recentlyViewed' ? 'bg-primary text-white' : 'hover:bg-muted'
                                }`}
                            >
                                Recently Viewed
                            </button>
                        </div>
                    </div>
                    
                    <div className="mb-6">
                        <h3 
                            className="text-sm font-semibold mb-2 cursor-pointer hover:text-primary"
                            onClick={() => {
                                setSelectedSidebarItem('folder');
                                setSelectedFolderId(null);
                            }}
                        >
                            My Folders
                        </h3>
                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                            {/* Inline folder creation at root level */}
                            {isCreatingFolder && !creatingFolderParentId && (
                                <div className="flex items-center gap-2 px-3 py-2">
                                    <Folder className="h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleCreateFolder(newFolderName, null);
                                            } else if (e.key === 'Escape') {
                                                cancelCreatingFolder();
                                            }
                                        }}
                                        onBlur={() => {
                                            if (newFolderName.trim()) {
                                                handleCreateFolder(newFolderName, null);
                                            } else {
                                                cancelCreatingFolder();
                                            }
                                        }}
                                        placeholder="New folder"
                                        className="h-7 text-sm"
                                        autoFocus
                                    />
                                </div>
                            )}
                            
                            {folders.length === 0 && !isCreatingFolder ? (
                                <p className="text-xs text-muted-foreground px-3 py-2">No folders yet. Create one to get started.</p>
                            ) : (
                                // Recursive folder rendering function
                                (() => {
                                    const renderFolder = (folder, depth = 0) => {
                                        const isExpanded = expandedFolders.has(folder.id);
                                        const itemCount = getFolderItemCount(folder.id);
                                        const subfolders = folders.filter(f => f.parentId === folder.id);
                                        const hasSubfolders = subfolders.length > 0;
                                        const marginLeft = depth * 16; // 16px per level
                                        
                                        return (
                                            <div key={folder.id}>
                                                {renamingFolderId === folder.id ? (
                                                    <div className="flex items-center gap-2 px-3 py-2" style={{ marginLeft }}>
                                                        <Folder className="h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            value={editingFolderName}
                                                            onChange={(e) => setEditingFolderName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleInlineRename(folder.id, editingFolderName);
                                                                } else if (e.key === 'Escape') {
                                                                    setRenamingFolderId(null);
                                                                    setEditingFolderName('');
                                                                }
                                                            }}
                                                            onBlur={() => {
                                                                if (editingFolderName.trim()) {
                                                                    handleInlineRename(folder.id, editingFolderName);
                                                                } else {
                                                                    setRenamingFolderId(null);
                                                                    setEditingFolderName('');
                                                                }
                                                            }}
                                                            className="h-7 text-sm"
                                                            autoFocus
                                                        />
                                                    </div>
                                                ) : (() => {
                                                    const DroppableFolder = () => {
                                                        const { setNodeRef, isOver } = useDroppable({
                                                            id: `folder-${folder.id}`,
                                                        });
                                                        
                                                        return (
                                                            <div 
                                                                ref={setNodeRef}
                                                                className={cn(
                                                                    "flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors relative",
                                                                    selectedFolderId === folder.id ? "bg-primary text-white" : "hover:bg-muted",
                                                                    isOver && "bg-primary/20 border-2 border-primary border-dashed z-50"
                                                                )}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedSidebarItem('folder');
                                                                    setSelectedFolderId(folder.id);
                                                                }}
                                                                style={{ zIndex: isOver ? 50 : 10, marginLeft }}
                                                            >
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleFolderExpansion(folder.id);
                                                                    }}
                                                                    className="p-0.5 hover:bg-muted rounded"
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="h-3 w-3" />
                                                                    ) : (
                                                                        <ChevronRight className="h-3 w-3" />
                                                                    )}
                                                                </button>
                                                                <Folder className="h-4 w-4" />
                                                                <span className="text-sm flex-1 truncate">{folder.name}</span>
                                                                {itemCount > 0 && (
                                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                                        {itemCount}
                                                                    </Badge>
                                                                )}
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger onClick={(e) => e.stopPropagation()}>
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent className="bg-popover z-50">
                                                                        <DropdownMenuItem
                                                                            onClick={() => {
                                                                                startCreatingFolder(folder.id);
                                                                                setExpandedFolders(prev => new Set([...prev, folder.id]));
                                                                            }}
                                                                        >
                                                                            <PlusCircle className="h-4 w-4 mr-2" />
                                                                            Create Subfolder
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onClick={() => {
                                                                                startRenamingFolder(folder.id, folder.name);
                                                                            }}
                                                                        >
                                                                            <Edit className="h-4 w-4 mr-2" />
                                                                            Rename
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onClick={() => {
                                                                                handleDownloadFolderContents(folder);
                                                                            }}
                                                                        >
                                                                            <Download className="h-4 w-4 mr-2" />
                                                                            Download Folder
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onSelect={(e) => {
                                                                                e.stopPropagation();
                                                                                setFolderToDelete(folder.id);
                                                                                requestAnimationFrame(() => setDeleteFolderDialogOpen(true));
                                                                            }}
                                                                            className="text-destructive"
                                                                        >
                                                                            <Archive className="h-4 w-4 mr-2" />
                                                                            Delete
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        );
                                                    };
                                                    
                                                    return <DroppableFolder key={folder.id} />;
                                                })()}
                                                
                                                {/* Show subfolder creation input and subfolders when expanded */}
                                                {(isExpanded || (isCreatingFolder && creatingFolderParentId === folder.id)) && (
                                                    <div className="space-y-1">
                                                        {/* Inline folder creation for subfolder */}
                                                        {isCreatingFolder && creatingFolderParentId === folder.id && (
                                                            <div className="flex items-center gap-2 px-3 py-2" style={{ marginLeft: marginLeft + 16 }}>
                                                                <Folder className="h-4 w-4 text-muted-foreground" />
                                                                <Input
                                                                    value={newFolderName}
                                                                    onChange={(e) => setNewFolderName(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            handleCreateFolder(newFolderName, folder.id);
                                                                        } else if (e.key === 'Escape') {
                                                                            cancelCreatingFolder();
                                                                        }
                                                                    }}
                                                                    onBlur={() => {
                                                                        if (newFolderName.trim()) {
                                                                            handleCreateFolder(newFolderName, folder.id);
                                                                        } else {
                                                                            cancelCreatingFolder();
                                                                        }
                                                                    }}
                                                                    placeholder="New folder"
                                                                    className="h-7 text-sm"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                        )}
                                                        {/* Recursively render subfolders */}
                                                        {isExpanded && subfolders.map(subfolder => renderFolder(subfolder, depth + 1))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    };
                                    
                                    // Render only root folders, subfolders are handled recursively
                                    return folders
                                        .filter(folder => !folder.parentId)
                                        .map(folder => renderFolder(folder, 0));
                                })()
                            )}
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-2"
                            onClick={() => {
                                startCreatingFolder(null);
                            }}
                        >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            New Folder
                        </Button>
                    </div>
                    
                    <Button 
                        className="w-full mt-auto"
                        onClick={() => setViewDownloadDialogOpen(true)}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        View/Download Entire Pattern Book
                    </Button>
                </div>
                
                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 p-6 flex flex-col overflow-hidden">
                        {activeTab === 'patternBook' && (
                            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                                {/* Sub-tabs - Hide when viewing folder */}
                                {selectedSidebarItem !== 'folder' && (
                                    <div className="flex gap-4 mb-6 border-b">
                                        <button 
                                            onClick={() => setActiveSubTab('patterns')}
                                            className={`px-4 py-2 border-b-2 font-medium ${
                                                activeSubTab === 'patterns' 
                                                    ? 'border-primary text-primary' 
                                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Patterns
                                        </button>

                                        <button 
                                            onClick={() => setActiveSubTab('complete')}
                                            className={`px-4 py-2 border-b-2 font-medium ${
                                                activeSubTab === 'complete' 
                                                    ? 'border-primary text-primary' 
                                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Complete Pattern Books
                                        </button>
                                    </div>
                                )}
                                
                                {/* Filters and Actions - Hide when viewing folder */}
                                {selectedSidebarItem !== 'folder' && (
                                    <div className="flex items-center gap-4 mb-4 flex-wrap">
                                        {/* Discipline Multi-Select Filter */}
                                        <Popover open={disciplineFilterOpen} onOpenChange={setDisciplineFilterOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-44 justify-between">
                                                    <span className="truncate">
                                                        {filterDisciplines.size === 0 
                                                            ? 'All Disciplines' 
                                                            : filterDisciplines.size === 1 
                                                                ? Array.from(filterDisciplines)[0]
                                                                : `${filterDisciplines.size} Selected`}
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-0 bg-popover text-popover-foreground border border-border z-50" align="start">
                                                <div className="p-2 border-b flex items-center justify-between">
                                                    <span className="text-sm font-medium">Disciplines</span>
                                                    {filterDisciplines.size > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-xs"
                                                            onClick={() => setFilterDisciplines(new Set())}
                                                        >
                                                            Clear
                                                        </Button>
                                                    )}
                                                </div>
                                                <ScrollArea className="max-h-60">
                                                    <div className="p-2 space-y-1">
                                                        {disciplineOptions.map(discipline => (
                                                            <div 
                                                                key={discipline} 
                                                                className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                                                                onClick={() => {
                                                                    setFilterDisciplines(prev => {
                                                                        const newSet = new Set(prev);
                                                                        if (newSet.has(discipline)) {
                                                                            newSet.delete(discipline);
                                                                        } else {
                                                                            newSet.add(discipline);
                                                                        }
                                                                        return newSet;
                                                                    });
                                                                }}
                                                            >
                                                                <Checkbox checked={filterDisciplines.has(discipline)} />
                                                                <span className="text-sm">{discipline}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </PopoverContent>
                                        </Popover>

                                        {/* Class Multi-Select Filter */}
                                        <Popover open={classFilterOpen} onOpenChange={setClassFilterOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-44 justify-between">
                                                    <span className="truncate">
                                                        {filterClasses.size === 0 
                                                            ? 'All Classes' 
                                                            : filterClasses.size === 1 
                                                                ? Array.from(filterClasses)[0]
                                                                : `${filterClasses.size} Selected`}
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-0 bg-background border" align="start">
                                                <div className="p-2 border-b flex items-center justify-between">
                                                    <span className="text-sm font-medium">Classes</span>
                                                    {filterClasses.size > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-xs"
                                                            onClick={() => setFilterClasses(new Set())}
                                                        >
                                                            Clear
                                                        </Button>
                                                    )}
                                                </div>
                                                <ScrollArea className="max-h-60">
                                                    <div className="p-2 space-y-1">
                                                        {uniqueClasses.map(className => (
                                                            <div 
                                                                key={className} 
                                                                className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                                                                onClick={() => {
                                                                    setFilterClasses(prev => {
                                                                        const newSet = new Set(prev);
                                                                        if (newSet.has(className)) {
                                                                            newSet.delete(className);
                                                                        } else {
                                                                            newSet.add(className);
                                                                        }
                                                                        return newSet;
                                                                    });
                                                                }}
                                                            >
                                                                <Checkbox checked={filterClasses.has(className)} />
                                                                <span className="text-sm">{className}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </PopoverContent>
                                        </Popover>

                                        {/* Judge Multi-Select Filter */}
                                      
                                    </div>
                                )}
                                
                                {/* My Folders View - Show all root folders */}
                                {selectedSidebarItem === 'folder' && !selectedFolderId && (() => {
                                    // Get all root-level folders (folders without parentId)
                                    const rootFolders = folders.filter(f => !f.parentId);
                                    
                                    return (
                                        <div className="flex flex-col flex-1 min-h-0 overflow-hidden border rounded-lg bg-background">
                                            {/* Breadcrumb Navigation */}
                                            <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 text-sm">
                                                <span className="font-medium">My Folders</span>
                                            </div>
                                            
                                            {/* Toolbar */}
                                            <div className="px-4 py-2 border-b flex items-center gap-2">
                                                <Button variant="ghost" size="sm" className="h-8 text-xs">
                                                    <Edit className="h-3 w-3 mr-1" />
                                                    Rename
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-8 text-xs">
                                                    <Archive className="h-3 w-3 mr-1" />
                                                    Delete
                                                </Button>
                                                <div className="ml-auto flex items-center gap-2">
                                                    <Select value="name" onValueChange={() => {}}>
                                                        <SelectTrigger className="h-8 w-24 text-xs">
                                                            <SelectValue>Sort</SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="name">Name</SelectItem>
                                                            <SelectItem value="date">Date</SelectItem>
                                                            <SelectItem value="type">Type</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Select value="list" onValueChange={() => {}}>
                                                        <SelectTrigger className="h-8 w-20 text-xs">
                                                            <SelectValue>View</SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="list">List</SelectItem>
                                                            <SelectItem value="grid">Grid</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            
                                            {/* Table View */}
                                            <div className="flex-1 overflow-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[300px]">Name</TableHead>
                                                            <TableHead>Date modified</TableHead>
                                                            <TableHead>Type</TableHead>
                                                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {rootFolders.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                                                    No folders yet. Create a new folder to get started.
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            rootFolders.map((folder) => {
                                                                const folderDate = folder.createdAt 
                                                                    ? format(new Date(folder.createdAt), 'MM-dd-yyyy HH:mm')
                                                                    : 'N/A';
                                                                const itemCount = folder.items?.length || 0;
                                                                
                                                                return (
                                                                    <TableRow 
                                                                        key={folder.id}
                                                                        className="hover:bg-muted/50"
                                                                    >
                                                                        <TableCell 
                                                                            className="font-medium cursor-pointer"
                                                                            onClick={() => {
                                                                                setSelectedFolderId(folder.id);
                                                                            }}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <Folder className="h-4 w-4 text-yellow-500" />
                                                                                <span>{folder.name}</span>
                                                                                {itemCount > 0 && (
                                                                                    <Badge variant="secondary" className="ml-2 text-xs">
                                                                                        {itemCount}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell 
                                                                            className="cursor-pointer"
                                                                            onClick={() => {
                                                                                setSelectedFolderId(folder.id);
                                                                            }}
                                                                        >
                                                                            {folderDate}
                                                                        </TableCell>
                                                                        <TableCell 
                                                                            className="cursor-pointer"
                                                                            onClick={() => {
                                                                                setSelectedFolderId(folder.id);
                                                                            }}
                                                                        >
                                                                            File folder
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteFolder(folder.id);
                                                                                }}
                                                                                title="Delete folder"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    );
                                })()}
                                
                                {/* Folder View - Windows Explorer Style Table */}
                                {selectedSidebarItem === 'folder' && selectedFolderId && (() => {
                                    const selectedFolder = folders.find(f => f.id === selectedFolderId);
                                    if (!selectedFolder) return null;
                                    
                                    // Get subfolders of the current folder
                                    const subfolders = folders.filter(f => f.parentId === selectedFolderId);
                                    
                                    // Get folder items (patterns and scoresheets)
                                    const folderItems = selectedFolder.items || [];
                                    const allFolderItems = folderItems.map(item => {
                                        if (item.data) {
                                            return {
                                                ...item.data,
                                                itemType: item.type,
                                                storedAt: item.storedAt || item.createdAt || selectedFolder.createdAt
                                            };
                                        }
                                        // Try to find in main arrays
                                        if (item.type === 'pattern') {
                                            const found = patterns.find(p => {
                                                const pId = p.id || p.numericId || p.patternId;
                                                return (item.id === pId || item.id === String(pId));
                                            });
                                            return found ? { ...found, itemType: 'pattern', storedAt: item.storedAt || selectedFolder.createdAt } : null;
                                        } else if (item.type === 'scoresheet') {
                                            const found = scoresheets.find(s => {
                                                const sId = s.id || s.numericId;
                                                return (item.id === sId || item.id === String(sId));
                                            });
                                            return found ? { ...found, itemType: 'scoresheet', storedAt: item.storedAt || selectedFolder.createdAt } : null;
                                        }
                                        return null;
                                    }).filter(Boolean);
                                    
                                    // Build breadcrumb path
                                    const buildBreadcrumbPath = (folderId) => {
                                        const path = [];
                                        let currentFolder = folders.find(f => f.id === folderId);
                                        while (currentFolder) {
                                            path.unshift(currentFolder);
                                            if (currentFolder.parentId) {
                                                currentFolder = folders.find(f => f.id === currentFolder.parentId);
                                            } else {
                                                break;
                                            }
                                        }
                                        return path;
                                    };
                                    
                                    const breadcrumbPath = buildBreadcrumbPath(selectedFolderId);
                                    
                                    return (
                                        <div className="flex flex-col flex-1 min-h-0 overflow-hidden border rounded-lg bg-background">
                                            {/* Breadcrumb Navigation */}
                                            <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 text-sm">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedFolderId(null);
                                                    }}
                                                    className="h-7 text-xs"
                                                >
                                                    My Folders
                                                </Button>
                                                {breadcrumbPath.map((folder, idx) => (
                                                    <React.Fragment key={folder.id}>
                                                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedFolderId(folder.id);
                                                            }}
                                                            className="h-7 text-xs"
                                                        >
                                                            {folder.name}
                                                        </Button>
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            
                                            {/* Toolbar */}
                                            <div className="px-4 py-2 border-b flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-xs"
                                                    onClick={() => {
                                                        startRenamingFolder(selectedFolder.id, selectedFolder.name);
                                                    }}
                                                >
                                                    <Edit className="h-3 w-3 mr-1" />
                                                    Rename
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-xs"
                                                    onClick={() => {
                                                        setFolderToDelete(selectedFolder.id);
                                                        setDeleteFolderDialogOpen(true);
                                                    }}
                                                >
                                                    <Archive className="h-3 w-3 mr-1" />
                                                    Delete
                                                </Button>
                                                <div className="ml-auto flex items-center gap-2">
                                                    <Select value="name" onValueChange={() => {}}>
                                                        <SelectTrigger className="h-8 w-24 text-xs">
                                                            <SelectValue>Sort</SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="name">Name</SelectItem>
                                                            <SelectItem value="date">Date</SelectItem>
                                                            <SelectItem value="type">Type</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Select value="list" onValueChange={() => {}}>
                                                        <SelectTrigger className="h-8 w-20 text-xs">
                                                            <SelectValue>View</SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="list">List</SelectItem>
                                                            <SelectItem value="grid">Grid</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            
                                            {/* Table View */}
                                            <div className="flex-1 overflow-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[300px]">Name</TableHead>
                                                            <TableHead>Date modified</TableHead>
                                                            <TableHead>Type</TableHead>
                                                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {subfolders.length === 0 && allFolderItems.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                                                    This folder is empty
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            <>
                                                                {/* Subfolders first */}
                                                                {subfolders.map((subfolder) => {
                                                                    const subfolderDate = subfolder.createdAt 
                                                                        ? format(new Date(subfolder.createdAt), 'MM-dd-yyyy HH:mm')
                                                                        : 'N/A';
                                                                    const itemCount = subfolder.items?.length || 0;
                                                                    
                                                                    return (
                                                                        <TableRow 
                                                                            key={subfolder.id}
                                                                            className="hover:bg-muted/50"
                                                                        >
                                                                            <TableCell 
                                                                                className="font-medium cursor-pointer"
                                                                                onClick={() => {
                                                                                    setSelectedFolderId(subfolder.id);
                                                                                }}
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <Folder className="h-4 w-4 text-yellow-500" />
                                                                                    <span>{subfolder.name}</span>
                                                                                    {itemCount > 0 && (
                                                                                        <Badge variant="secondary" className="ml-2 text-xs">
                                                                                            {itemCount}
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell 
                                                                                className="cursor-pointer"
                                                                                onClick={() => {
                                                                                    setSelectedFolderId(subfolder.id);
                                                                                }}
                                                                            >
                                                                                {subfolderDate}
                                                                            </TableCell>
                                                                            <TableCell 
                                                                                className="cursor-pointer"
                                                                                onClick={() => {
                                                                                    setSelectedFolderId(subfolder.id);
                                                                                }}
                                                                            >
                                                                                File folder
                                                                            </TableCell>
                                                                            <TableCell className="text-right">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeleteFolder(subfolder.id);
                                                                                    }}
                                                                                    title="Delete folder"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                                
                                                                {/* Folder items (patterns and scoresheets) */}
                                                                {allFolderItems.map((item, idx) => {
                                                                    const itemName = item.itemType === 'pattern' 
                                                                        ? (item.patternName || item.name || 'Pattern')
                                                                        : (item.displayName || item.file_name || item.disciplineName || 'Scoresheet');
                                                                    
                                                                    const itemDate = item.storedAt 
                                                                        ? format(new Date(item.storedAt), 'MM-dd-yyyy HH:mm')
                                                                        : (item.createdAt ? format(new Date(item.createdAt), 'MM-dd-yyyy HH:mm') : 'N/A');
                                                                    
                                                                    const itemType = item.itemType === 'pattern' ? 'Pattern File' : 'Scoresheet File';
                                                                    
                                                                    // Get the item ID from the folder items
                                                                    const folderItem = folderItems.find(fi => {
                                                                        if (fi.data) {
                                                                            const fiId = fi.data.id || fi.data.numericId || fi.data.patternId;
                                                                            const itemId = item.id || item.numericId || item.patternId;
                                                                            return (fiId === itemId || fiId === String(itemId));
                                                                        }
                                                                        const fiId = fi.id;
                                                                        const itemId = item.id || item.numericId || item.patternId;
                                                                        return (fiId === itemId || fiId === String(itemId));
                                                                    });
                                                                    const itemId = folderItem?.id || item.id || item.numericId || item.patternId;
                                                                    
                                                                    return (
                                                                        <TableRow 
                                                                            key={`item-${idx}`}
                                                                            className="hover:bg-muted/50"
                                                                        >
                                                                            <TableCell 
                                                                                className="font-medium cursor-pointer"
                                                                                onClick={() => {
                                                                                    if (item.itemType === 'pattern') {
                                                                                        handleViewPattern(item);
                                                                                    } else {
                                                                                        handleViewScoresheet(item);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    {item.itemType === 'pattern' ? (
                                                                                        <FileText className="h-4 w-4 text-primary" />
                                                                                    ) : (
                                                                                        <FileText className="h-4 w-4 text-orange-500" />
                                                                                    )}
                                                                                    <span>{itemName}</span>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell 
                                                                                className="cursor-pointer"
                                                                                onClick={() => {
                                                                                    if (item.itemType === 'pattern') {
                                                                                        handleViewPattern(item);
                                                                                    } else {
                                                                                        handleViewScoresheet(item);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {itemDate}
                                                                            </TableCell>
                                                                            <TableCell 
                                                                                className="cursor-pointer"
                                                                                onClick={() => {
                                                                                    if (item.itemType === 'pattern') {
                                                                                        handleViewPattern(item);
                                                                                    } else {
                                                                                        handleViewScoresheet(item);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {itemType}
                                                                            </TableCell>
                                                                            <TableCell className="text-right">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleRemoveItemFromFolder(itemId, item.itemType, selectedFolderId);
                                                                                    }}
                                                                                    title="Remove from folder"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    );
                                })()}
                                
                                {/* Content based on active sub-tab */}
                                {selectedSidebarItem !== 'folder' && activeSubTab === 'patterns' && (
                                    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                                            {/* Patterns List */}
                                            {isLoadingPatterns ? (
                                                <div className="flex items-center justify-center py-12">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                </div>
                                            ) : (
                                                <div className="space-y-2 overflow-y-auto pr-2 flex-1">
                                                    {filteredPatterns.map((pattern, index) => {
                                                        const DraggablePattern = () => {
                                                            const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
                                                                id: `pattern-${pattern.uniqueKey || pattern.id || pattern.numericId || pattern.originalPatternId || index}`,
                                                            });
                                                            
                                                            const style = transform ? {
                                                                transform: CSS.Translate.toString(transform),
                                                            } : undefined;
                                                            
                                                            return (
                                                                <div
                                                                    ref={setNodeRef}
                                                                    style={style}
                                                                    {...listeners}
                                                                    {...attributes}
                                                                    className={cn(
                                                                        "flex items-center gap-4 p-3 rounded hover:bg-muted/50 cursor-grab active:cursor-grabbing",
                                                                        isDragging && "opacity-50"
                                                                    )}
                                                                >
                                                        {/* Pattern Image or Icon - Similar to Step 3 */}
                                                        {pattern.image_url ? (
                                                            <div className="w-16 h-16 rounded-md overflow-hidden border bg-muted/20 shrink-0 flex items-center justify-center">
                                                                <img 
                                                                    src={pattern.image_url} 
                                                                    alt={pattern.patternName || pattern.name || 'Pattern'} 
                                                                    className="w-full h-full object-contain"
                                                                    loading="lazy"
                                                                    onError={(e) => {
                                                                        // Fallback to icon if image fails to load
                                                                        e.target.style.display = 'none';
                                                                        e.target.parentElement.innerHTML = '<div class="w-full h-full bg-primary/10 rounded flex items-center justify-center"><svg class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div>';
                                                                    }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center shrink-0">
                                                                <Users className="h-4 w-4 text-primary" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium truncate">{pattern.discipline || pattern.disciplineName || 'Pattern'}</div>
                                                            <div className="text-sm text-muted-foreground space-y-1 mt-1">
                                                                {pattern.groupName && (
                                                                    <div>
                                                                        <span className="font-medium">Class:</span> {pattern.groupName}
                                                                    </div>
                                                                )}
                                                                {pattern.divisionNames && (
                                                                    <div>
                                                                        <span className="font-medium">Divisions:</span> <span className="text-xs">({pattern.divisionNames})</span>
                                                                    </div>
                                                                )}
                                                                {pattern.judgeNames && (
                                                                    <div>
                                                                        <span className="font-medium">Judges:</span> {pattern.judgeNames}
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <span className="font-medium">Pattern No:</span> {
                                                                        (() => {
                                                                            // Extract the last 4 digits from patternName or name
                                                                            // e.g., "VRH&RHCRanchReining0002" -> "0002"
                                                                            // e.g., "VRH&RHCRanchReining0007" -> "0007"
                                            
                                                                            let patternNumStr = null;
                                                                            
                                                                            // Try to extract last 4 digits from patternName
                                                                            if (pattern.patternName) {
                                                                                const match = pattern.patternName.match(/(\d{4})$/);
                                                                                if (match) {
                                                                                    patternNumStr = match[1]; // Keep as string to preserve leading zeros
                                                                                }
                                                                                // If no 4 digits, try any digits at the end
                                                                                else {
                                                                                    const matchAny = pattern.patternName.match(/(\d+)$/);
                                                                                    if (matchAny) {
                                                                                        patternNumStr = matchAny[1].padStart(4, '0');
                                                                                    }
                                                                                }
                                                                            }
                                                                            // Try to extract from name
                                                                            else if (pattern.name) {
                                                                                const match = pattern.name.match(/(\d{4})$/);
                                                                                if (match) {
                                                                                    patternNumStr = match[1];
                                                                                }
                                                                                // If no 4 digits, try any digits at the end
                                                                                else {
                                                                                    const matchAny = pattern.name.match(/(\d+)$/);
                                                                                    if (matchAny) {
                                                                                        patternNumStr = matchAny[1].padStart(4, '0');
                                                                                    }
                                                                                }
                                                                            }
                                                                            
                                                                            // If we found a pattern number string, return it
                                                                            if (patternNumStr) {
                                                                                return patternNumStr;
                                                                            }
                                                                            
                                                                            // Fallback: try numericId and format as 4 digits
                                                                            if (pattern.numericId) {
                                                                                return String(pattern.numericId).padStart(4, '0');
                                                                            }
                                                                            
                                                                            // Final fallback
                                                                            return '0000';
                                                                        })()
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDownloadPattern(pattern);
                                                                }}
                                                                title="Download Pattern"
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewPattern(pattern);
                                                                }}
                                                                title="View Pattern Image"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                            </Button>
                                                            {folders.length > 0 && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            title="Add to Folder"
                                                                        >
                                                                            <Folder className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent>
                                                                        {folders.map(folder => (
                                                                            <DropdownMenuItem
                                                                                key={folder.id}
                                                                                onClick={() => {
                                                                                    const itemId = pattern.id || pattern.numericId || `pattern-${index}`;
                                                                                    handleAddToFolder(itemId, 'pattern', folder.id, pattern);
                                                                                }}
                                                                            >
                                                                                <Folder className="h-4 w-4 mr-2" />
                                                                                {folder.name}
                                                                            </DropdownMenuItem>
                                                                        ))}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Handle more options
                                                                }}
                                                                title="More options"
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                                </div>
                                                            );
                                                        };
                                                        
                                                        return <DraggablePattern key={pattern.uniqueKey || pattern.id || index} />;
                                                    })}
                                                    {filteredPatterns.length === 0 && !isLoadingPatterns && (
                                                        <div className="text-center py-12 text-muted-foreground">
                                                            {patterns.length === 0 ? 'No patterns found' : 'No patterns match the selected filters'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                )}
                                
                                {selectedSidebarItem !== 'folder' && activeSubTab === 'scoreSheets' && (
                                    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                                        {/* Score Sheets List */}
                                        {isLoadingScoresheets ? (
                                            <div className="flex items-center justify-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                        ) : (
                                            <div className="space-y-2 overflow-y-auto pr-2 flex-1">
                                                    {filteredScoresheets.map((scoresheet, index) => {
                                                        const DraggableScoresheet = () => {
                                                            const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
                                                                id: `scoresheet-${scoresheet.uniqueKey || scoresheet.id || scoresheet.numericId || scoresheet.pattern_id || index}`,
                                                            });
                                                        
                                                        const style = transform ? {
                                                            transform: CSS.Translate.toString(transform),
                                                        } : undefined;
                                                        
                                                        return (
                                                            <div
                                                                ref={setNodeRef}
                                                                style={style}
                                                                {...listeners}
                                                                {...attributes}
                                                                className={cn(
                                                                    "flex items-center gap-4 p-3 rounded hover:bg-muted/50 cursor-grab active:cursor-grabbing",
                                                                    isDragging && "opacity-50"
                                                                )}
                                                            >
                                                        <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center shrink-0">
                                                            <FileText className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium truncate">{scoresheet.displayName || scoresheet.file_name || scoresheet.disciplineName || 'Scoresheet'}</div>
                                                            <div className="text-sm text-muted-foreground space-y-1">
                                                                <div>
                                                                    <span className="font-medium">Discipline:</span> {scoresheet.disciplineName || scoresheet.discipline}
                                                                </div>
                                                                {scoresheet.groupName && (
                                                                    <div>
                                                                        <span className="font-medium">Class:</span> {scoresheet.groupName}
                                                                    </div>
                                                                )}
                                                                {scoresheet.divisionNames && (
                                                                    <div>
                                                                        <span className="font-medium">Divisions:</span> <span className="text-xs">({scoresheet.divisionNames})</span>
                                                                    </div>
                                                                )}
                                                                {scoresheet.judgeNames && (
                                                                    <div>
                                                                        <span className="font-medium">Judges:</span> {scoresheet.judgeNames}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                title="Download Scoresheet"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDownloadScoresheet(scoresheet);
                                                                }}
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                title="View Scoresheet Image"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewScoresheet(scoresheet);
                                                                }}
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                title="More options"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Handle more options
                                                                }}
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                                </div>
                                                            );
                                                        };
                                                        
                                                        return <DraggableScoresheet key={scoresheet.uniqueKey || scoresheet.id || index} />;
                                                    })}
                                                    {filteredScoresheets.length === 0 && !isLoadingScoresheets && (
                                                    <div className="text-center py-12 text-muted-foreground">
                                                        {scoresheets.length === 0 ? 'No scoresheets found' : 'No scoresheets match the selected filters'}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {(activeSubTab === 'accessory' || activeSubTab === 'complete') && (
                                    <div className="text-center py-12 text-muted-foreground">
                                        Coming soon
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {activeTab === 'results' && (
                            <div className="text-center py-12 text-muted-foreground">
                                Results content coming soon
                            </div>
                        )}
                    </div>
                </div>
                    
                {/* Right Panel - Hide when viewing folder contents */}
                {selectedSidebarItem !== 'folder' && (
                    <div className="w-64 border-l bg-muted/30 p-4">
                        <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Affiliated with:</h4>
                            <div className="flex flex-wrap gap-2">
                                {affiliations.length > 0 ? (
                                    affiliations.map(assoc => {
                                        const logoUrl = assoc.logo_url || (assoc.logo && typeof assoc.logo === 'string' && assoc.logo.startsWith('http') ? assoc.logo : null);
                                        return logoUrl ? (
                                            <img key={assoc.id} src={logoUrl} alt={assoc.name} className="h-6 w-auto max-w-[100px] object-contain" />
                                        ) : (
                                            <span key={assoc.id} className="text-xs px-2 py-1 bg-primary/20 rounded">
                                                {assoc.abbreviation || assoc.name}
                                            </span>
                                        );
                                    })
                                ) : (
                                    <span className="text-sm text-muted-foreground">No affiliations</span>
                                )}
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm"><span className="font-semibold">Owner:</span> {owner}</p>
                            </div>
                            {admin && admin !== 'Not set' && (
                                <div>
                                    <p className="text-sm"><span className="font-semibold">Admin:</span> {admin}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm mb-1"><span className="font-semibold">Judges:</span> {judgesCount} Assigned</p>
                                {judgesList && judgesList.length > 0 && (
                                    <div className="ml-2 space-y-1">
                                        {judgesList.map((judge, idx) => (
                                            <p key={idx} className="text-xs text-muted-foreground">• {judge}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-sm"><span className="font-semibold">Staff:</span> {staffCount} Assigned</p>
                            </div>
                        </div>
                        </div>
                    </div>
                )}
                </div>
                <DragOverlay>
                    {activeId && draggedItem ? (
                        <div className="flex items-center gap-4 p-3 border rounded bg-background shadow-lg opacity-90">
                            <Folder className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">
                                {draggedItem.type === 'pattern' 
                                    ? (draggedItem.data.patternName || draggedItem.data.name || 'Pattern')
                                    : (draggedItem.data.displayName || draggedItem.data.name || 'Scoresheet')
                                }
                            </span>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
            
            {/* Pattern/Scoresheet Preview Modal */}
            <Dialog open={!!previewItem} onOpenChange={() => {
                setPreviewItem(null);
                setPreviewType(null);
                setPreviewImage(null);
            }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {previewType === 'pattern' 
                                ? (previewItem?.patternName || previewItem?.name || 'Pattern Preview')
                                : (previewItem?.displayName || previewItem?.file_name || 'Scoresheet Preview')
                            }
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {isLoadingPreview ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="ml-2 text-sm text-muted-foreground">Loading image...</span>
                            </div>
                        ) : previewImage ? (
                            <div className="rounded-md overflow-hidden border bg-muted/20">
                                <img 
                                    src={previewImage} 
                                    alt={previewType === 'pattern' ? 'Pattern Diagram' : 'Scoresheet'} 
                                    className="w-full h-auto max-h-[70vh] object-contain"
                                    loading="lazy"
                                />
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <p>No image available for this {previewType === 'pattern' ? 'pattern' : 'scoresheet'}.</p>
                            </div>
                        )}
                        {previewItem && (
                            <div className="text-sm text-muted-foreground space-y-1 border-t pt-4">
                                {previewType === 'pattern' ? (
                                    <>
                                        <div><span className="font-medium">Discipline:</span> {previewItem.discipline}</div>
                                        {previewItem.groupName && <div><span className="font-medium">Class:</span> {previewItem.groupName}</div>}
                                        {previewItem.divisionNames && <div><span className="font-medium">Divisions:</span> {previewItem.divisionNames}</div>}
                                    </>
                                ) : (
                                    <>
                                        <div><span className="font-medium">Discipline:</span> {previewItem.disciplineName || previewItem.discipline}</div>
                                        {previewItem.groupName && <div><span className="font-medium">Class:</span> {previewItem.groupName}</div>}
                                        {previewItem.divisionNames && <div><span className="font-medium">Divisions:</span> {previewItem.divisionNames}</div>}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* View/Download Entire Pattern Book Dialog */}
            <PatternBookDownloadDialog
                open={viewDownloadDialogOpen}
                onOpenChange={setViewDownloadDialogOpen}
                project={project}
            />
            
            {/* Rename Folder Dialog */}
            <Dialog open={renameFolderDialogOpen} onOpenChange={setRenameFolderDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Folder</DialogTitle>
                        <DialogDescription>
                            Enter a new name for this folder.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="rename-folder-name">Folder Name</Label>
                            <Input
                                id="rename-folder-name"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Enter folder name..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleRenameFolder();
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => {
                            setRenameFolderDialogOpen(false);
                            setNewFolderName('');
                            setEditingFolderId(null);
                        }}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameFolder} disabled={!newFolderName.trim()}>
                            Rename
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* Delete Folder Dialog */}
            <Dialog open={deleteFolderDialogOpen} onOpenChange={setDeleteFolderDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Folder</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this folder? This will also remove all items stored in this folder. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => {
                            setDeleteFolderDialogOpen(false);
                            setFolderToDelete(null);
                        }}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => handleDeleteFolder(folderToDelete)}>
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};


export default EventsPage;