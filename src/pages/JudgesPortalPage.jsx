import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Gavel, FileText, Search, Star, BookOpen, Download, Eye, 
    ZoomIn, Heart, X, Plus, Trash2, Edit, Save, Loader2,
    ExternalLink, Filter, Clock, Package, StickyNote, Bell, Calendar
} from 'lucide-react';
import ProjectDetailModal from '@/components/ProjectDetailModal';
import JudgePatternEditor from '@/components/JudgePatternEditor';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { fetchAssociations } from '@/lib/associationsData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { cn, parseLocalDate } from '@/lib/utils';

// Admin email that has full access
const ADMIN_EMAIL = 'johndoe@mailinator.com';

// Component to fetch and display pattern preview image
const PatternPreviewImage = ({ patternId, patternName }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchPatternImage = async () => {
            if (!patternId) {
                setIsLoading(false);
                return;
            }
            
            try {
                const { data, error } = await supabase
                    .from('tbl_pattern_media')
                    .select('image_url')
                    .eq('pattern_id', patternId)
                    .maybeSingle();
                
                if (error) throw error;
                setImageUrl(data?.image_url || null);
            } catch (error) {
                console.error('Error fetching pattern image:', error);
                setImageUrl(null);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchPatternImage();
    }, [patternId]);
    
    if (isLoading) {
        return (
            <div className="w-full h-40 rounded border bg-muted flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    if (imageUrl) {
        return (
            <div className="rounded-md overflow-hidden border bg-muted/20">
                <img 
                    src={imageUrl} 
                    alt={patternName}
                    className="w-full h-auto object-contain max-h-[400px]"
                />
            </div>
        );
    }
    
    return (
        <div className="w-full h-40 rounded border bg-muted flex items-center justify-center text-muted-foreground text-sm">
            No preview available
        </div>
    );
};

const JudgesPortalPage = () => {
    const { user, updateUserProfile } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    
    // Check if current user is admin (has full access)
    const isAdminUser = user?.email === ADMIN_EMAIL;
    
    // Judge Profile State
    const [isCardedJudge, setIsCardedJudge] = useState(false);
    const [cardedAssociations, setCardedAssociations] = useState([]);
    const [displayCardedAssociationsPublicly, setDisplayCardedAssociationsPublicly] = useState(false);
    const [associationsData, setAssociationsData] = useState([]);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    
    // Tab State
    const [activeTab, setActiveTab] = useState('scoresheets');
    
    // Assigned Projects State (for non-admin judges)
    const [assignedProjects, setAssignedProjects] = useState([]);
    const [assignedProjectData, setAssignedProjectData] = useState([]);
    const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
    
    // Quick Score Sheet Finder State
    const [scoresheetFilters, setScoresheetFilters] = useState({
        association: 'all',
        discipline: 'all',
        type: 'all' // 'general', 'rulebook', 'custom'
    });
    const [scoresheets, setScoresheets] = useState([]);
    const [filteredScoresheets, setFilteredScoresheets] = useState([]);
    const [isLoadingScoresheets, setIsLoadingScoresheets] = useState(false);
    const [scoresheetFavorites, setScoresheetFavorites] = useState([]);
    
    // Association Rulebook Pattern Finder State
    const [patternFilters, setPatternFilters] = useState({
        association: 'all',
        discipline: 'all',
        searchTerm: ''
    });
    const [patterns, setPatterns] = useState([]);
    const [filteredPatterns, setFilteredPatterns] = useState([]);
    const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
    const [patternFavorites, setPatternFavorites] = useState([]);
    const [selectedPattern, setSelectedPattern] = useState(null);
    const [patternImage, setPatternImage] = useState(null);
    
    // Judge Favorite Patterns State
    const [favoritePatterns, setFavoritePatterns] = useState([]);
    const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
    const [isFavoriteDialogOpen, setIsFavoriteDialogOpen] = useState(false);
    const [editingFavorite, setEditingFavorite] = useState(null);
    const [favoriteForm, setFavoriteForm] = useState({
        association_id: '',
        discipline_id: '',
        class_id: '',
        pattern_id: '',
        rank: 1,
        creator_note: ''
    });
    
    // Disciplines State
    const [disciplines, setDisciplines] = useState([]);
    
    // Quick Links State
    const [recentScoresheets, setRecentScoresheets] = useState([]);
    const [recentPatterns, setRecentPatterns] = useState([]);
    
    // Notifications Table State
    const [notificationsTableData, setNotificationsTableData] = useState([]);
    const [isLoadingNotificationsTable, setIsLoadingNotificationsTable] = useState(false);
    
    // Project Detail Modal State
    const [selectedProjectForModal, setSelectedProjectForModal] = useState(null);
    const [isProjectDetailModalOpen, setIsProjectDetailModalOpen] = useState(false);
    
    // Judge Pattern Editor State
    const [selectedProjectForEdit, setSelectedProjectForEdit] = useState(null);
    const [isPatternEditorOpen, setIsPatternEditorOpen] = useState(false);
    
    // Fetch assigned projects for non-admin judges
    useEffect(() => {
        const fetchAssignedProjects = async () => {
            if (!user?.email || isAdminUser) return;
            
            setIsLoadingAssignments(true);
            try {
                // Get notifications for this judge
                const { data: notifications, error: notifError } = await supabase
                    .from('judge_notifications')
                    .select('project_id, project_name')
                    .eq('judge_email', user.email);
                
                if (notifError) throw notifError;
                
                const projectIds = [...new Set(notifications?.map(n => n.project_id) || [])];
                setAssignedProjects(projectIds);
                
                // Fetch project data to get patterns/scoresheets
                if (projectIds.length > 0) {
                    const { data: projects, error: projError } = await supabase
                        .from('projects')
                        .select('id, project_name, project_data')
                        .in('id', projectIds);
                    
                    if (projError) throw projError;
                    setAssignedProjectData(projects || []);
                }
            } catch (error) {
                console.error('Error fetching assigned projects:', error);
            } finally {
                setIsLoadingAssignments(false);
            }
        };
        
        fetchAssignedProjects();
    }, [user?.email, isAdminUser]);
    
    // Fetch notifications table data with project details
    useEffect(() => {
        const fetchNotificationsTableData = async () => {
            if (!user?.email) return;
            
            setIsLoadingNotificationsTable(true);
            try {
                // Get notifications for this user
                const { data: notifications, error: notifError } = await supabase
                    .from('judge_notifications')
                    .select('*')
                    .eq('judge_email', user.email.toLowerCase())
                    .order('created_at', { ascending: false });
                
                if (notifError) {
                    if (notifError.code === 'PGRST205' || notifError.code === '42P01') {
                        setNotificationsTableData([]);
                        return;
                    }
                    throw notifError;
                }
                
                if (!notifications || notifications.length === 0) {
                    setNotificationsTableData([]);
                    return;
                }
                
                // Get unique project IDs
                const projectIds = [...new Set(notifications.map(n => n.project_id))];
                
                // Fetch project data for dates and status
                const { data: projects, error: projError } = await supabase
                    .from('projects')
                    .select('id, project_name, project_data, status')
                    .in('id', projectIds);
                
                if (projError) throw projError;
                
                // Create a map of project data
                const projectMap = {};
                (projects || []).forEach(p => {
                    projectMap[p.id] = p;
                });
                
                // Collect all pattern IDs from all projects
                const allPatternIds = new Set();
                (projects || []).forEach(p => {
                    const projectData = p.project_data || {};
                    if (projectData.patternSelections) {
                        Object.values(projectData.patternSelections).forEach(disciplinePatterns => {
                            if (typeof disciplinePatterns === 'object') {
                                Object.values(disciplinePatterns).forEach(patternData => {
                                    if (patternData?.patternId) {
                                        allPatternIds.add(patternData.patternId);
                                    }
                                });
                            }
                        });
                    }
                });
                
                // Fetch pattern preview images from tbl_pattern_media
                let patternImageMap = {};
                if (allPatternIds.size > 0) {
                    const { data: patternMediaData, error: patError } = await supabase
                        .from('tbl_pattern_media')
                        .select('pattern_id, image_url')
                        .in('pattern_id', Array.from(allPatternIds));
                    
                    if (!patError && patternMediaData) {
                        // Use first image found for each pattern_id
                        patternMediaData.forEach(pm => {
                            if (!patternImageMap[pm.pattern_id]) {
                                patternImageMap[pm.pattern_id] = pm.image_url;
                            }
                        });
                    }
                }
                
                // Get judge name from project data (case-insensitive matching)
                const getJudgeNameForProject = (projectData) => {
                    const userEmailLower = user.email.toLowerCase();
                    
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
                };
                
                // Combine notifications with project data and extract pattern names
                const tableData = notifications.map(n => {
                    const project = projectMap[n.project_id] || {};
                    const projectData = project.project_data || {};
                    
                    // Get judge name for this project
                    const judgeName = getJudgeNameForProject(projectData);
                    if (!judgeName) {
                        // If judge name not found, return empty data
                        return {
                            id: n.id,
                            project_id: n.project_id,
                            project_name: n.project_name || project.project_name || 'Unknown Show',
                            pattern_items: [],
                            discipline_names: [],
                            start_date: projectData.startDate || null,
                            end_date: projectData.endDate || null,
                            status: project.status || 'Draft',
                            created_at: n.created_at,
                            is_read: n.is_read
                        };
                    }
                    
                    // Get disciplines and find which ones are assigned to this judge
                    const disciplines = projectData.disciplines || [];
                    const groupJudges = projectData.groupJudges || {};
                    const judgeSelections = projectData.judgeSelections || {};
                    const patternSelections = projectData.patternSelections || {};
                    
                    // Find assigned discipline IDs
                    const assignedDisciplineIds = new Set();
                    const assignedDisciplineIndices = new Set();
                    
                    disciplines.forEach((discipline, disciplineIndex) => {
                        const disciplineId = discipline.id;
                        let isAssigned = false;
                        
                        // Check discipline-level assignment
                        const disciplineJudge = judgeSelections[disciplineIndex];
                        if (disciplineJudge && disciplineJudge.toLowerCase().trim() === judgeName.toLowerCase().trim()) {
                            isAssigned = true;
                        }
                        
                        // Check group-level assignments
                        if (!isAssigned) {
                            const groups = discipline.patternGroups || [];
                            groups.forEach((group, groupIndex) => {
                                const groupJudge = groupJudges[disciplineIndex]?.[groupIndex];
                                if (groupJudge && groupJudge.toLowerCase().trim() === judgeName.toLowerCase().trim()) {
                                    isAssigned = true;
                                }
                            });
                        }
                        
                        if (isAssigned) {
                            assignedDisciplineIds.add(disciplineId);
                            assignedDisciplineIndices.add(disciplineIndex);
                        }
                    });
                    
                    // Extract pattern names, IDs, and disciplines from patternSelections (only for assigned disciplines)
                    const patternItems = [];
                    const disciplineNames = [];
                    
                    if (patternSelections) {
                        Object.entries(patternSelections).forEach(([disciplineKey, disciplinePatterns]) => {
                            // Check if this discipline is assigned to the judge
                            let isAssignedDiscipline = false;
                            
                            // Check by discipline ID
                            if (assignedDisciplineIds.has(disciplineKey)) {
                                isAssignedDiscipline = true;
                            } else {
                                // Check by discipline index (legacy format)
                                const disciplineIndex = parseInt(disciplineKey);
                                if (!isNaN(disciplineIndex) && assignedDisciplineIndices.has(disciplineIndex)) {
                                    isAssignedDiscipline = true;
                                }
                            }
                            
                            if (!isAssignedDiscipline) return;
                            
                            // Get discipline name
                            const discipline = disciplines.find((d, idx) => 
                                d.id === disciplineKey || idx.toString() === disciplineKey
                            );
                            const disciplineName = discipline?.name || disciplineKey;
                            
                            // Add discipline name if not already added
                            if (disciplineName && !disciplineNames.includes(disciplineName)) {
                                disciplineNames.push(disciplineName);
                            }
                            
                            // Extract patterns for this discipline
                            if (typeof disciplinePatterns === 'object') {
                                Object.values(disciplinePatterns).forEach(patternData => {
                                    if (patternData?.patternName) {
                                        patternItems.push({
                                            name: patternData.patternName,
                                            id: patternData.patternId || null,
                                            previewImageUrl: patternData.patternId ? patternImageMap[patternData.patternId] : null
                                        });
                                    }
                                });
                            }
                        });
                    }
                    
                    return {
                        id: n.id,
                        project_id: n.project_id,
                        project_name: n.project_name || project.project_name || 'Unknown Show',
                        pattern_items: patternItems,
                        discipline_names: disciplineNames,
                        start_date: projectData.startDate || null,
                        end_date: projectData.endDate || null,
                        status: project.status || 'Draft',
                        created_at: n.created_at,
                        is_read: n.is_read
                    };
                });
                
                setNotificationsTableData(tableData);
            } catch (error) {
                console.error('Error fetching notifications table data:', error);
                setNotificationsTableData([]);
            } finally {
                setIsLoadingNotificationsTable(false);
            }
        };
        
        fetchNotificationsTableData();
    }, [user?.email]);
    
    // Load user profile data
    useEffect(() => {
        if (user) {
            const meta = user.user_metadata || {};
            setIsCardedJudge(meta.isCardedJudge || false);
            setCardedAssociations(meta.cardedAssociations || []);
            setDisplayCardedAssociationsPublicly(meta.displayCardedAssociationsPublicly || false);
        }
    }, [user]);
    
    // Fetch associations
    useEffect(() => {
        const loadAssociations = async () => {
            const data = await fetchAssociations();
            setAssociationsData(data || []);
        };
        loadAssociations();
    }, []);
    
    // Fetch disciplines
    useEffect(() => {
        const fetchDisciplines = async () => {
            const { data, error } = await supabase
                .from('disciplines')
                .select('id, name, association_id')
                .order('name');
            
            if (error) {
                console.error('Error fetching disciplines:', error);
            } else {
                setDisciplines(data || []);
            }
        };
        fetchDisciplines();
    }, []);
    
    // Save judge profile
    const handleSaveJudgeProfile = async () => {
        if (!user) return;
        
        setIsSavingProfile(true);
        try {
            const metadata = {
                ...user.user_metadata,
                isCardedJudge,
                cardedAssociations,
                displayCardedAssociationsPublicly
            };
            
            await updateUserProfile(metadata);
            toast({
                title: 'Profile Updated',
                description: 'Your judge profile has been saved successfully.',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save judge profile. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSavingProfile(false);
        }
    };
    //test
    
    const toggleCardedAssociation = (assocId) => {
        setCardedAssociations(prev => 
            prev.includes(assocId) ? prev.filter(a => a !== assocId) : [...prev, assocId]
        );
    };
    
    // Fetch scoresheets
    useEffect(() => {
        const fetchScoresheets = async () => {
            setIsLoadingScoresheets(true);
            try {
                const { data, error } = await supabase
                    .from('tbl_scoresheet')
                    .select('*, pattern:tbl_patterns(id, pdf_file_name, association_name, discipline, pattern_version)')
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                setScoresheets(data || []);
            } catch (error) {
                console.error('Error fetching scoresheets:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load scoresheets.',
                    variant: 'destructive',
                });
            } finally {
                setIsLoadingScoresheets(false);
            }
        };
        
        if (activeTab === 'scoresheets') {
            fetchScoresheets();
        }
    }, [activeTab, toast]);
    
    // Filter scoresheets based on user type
    useEffect(() => {
        if (scoresheets.length === 0) {
            setFilteredScoresheets([]);
            return;
        }
        
        let baseList = scoresheets;
        
        // For non-admin users, filter to only assigned project scoresheets
        if (!isAdminUser && assignedProjectData.length > 0) {
            // Extract patternIds from assigned projects
            const assignedPatternIds = new Set();
            
            assignedProjectData.forEach(project => {
                const data = project.project_data;
                
                // Extract patternId from patternSelections
                if (data?.patternSelections) {
                    Object.values(data.patternSelections).forEach(disciplinePatterns => {
                        if (typeof disciplinePatterns === 'object') {
                            Object.values(disciplinePatterns).forEach(patternData => {
                                if (patternData?.patternId) {
                                    assignedPatternIds.add(patternData.patternId);
                                }
                            });
                        }
                    });
                }
            });
            
            // Filter scoresheets by matching pattern_id
            baseList = scoresheets.filter(s => {
                return s.pattern_id && assignedPatternIds.has(s.pattern_id);
            });
        } else if (!isAdminUser && assignedProjects.length === 0 && !isLoadingAssignments) {
            // No assignments - show empty
            setFilteredScoresheets([]);
            return;
        }
        
        const filtered = baseList.filter(s => {
            // Normalize association - get abbreviation for matching
            const rawAssoc = s.pattern?.association_name || s.association_abbrev;
            // Find matching abbreviation from associations data
            const matchedAssoc = associationsData.find(a => 
                a.abbreviation === rawAssoc || a.name === rawAssoc || a.id === rawAssoc
            );
            const assocAbbrev = matchedAssoc?.abbreviation || rawAssoc;
            const disc = s.discipline || s.pattern?.discipline;
            const hasPattern = !!s.pattern_id;
            
            const matchAssoc = scoresheetFilters.association === 'all' || assocAbbrev === scoresheetFilters.association;
            const matchDisc = scoresheetFilters.discipline === 'all' || disc === scoresheetFilters.discipline;
            
            let matchType = true;
            if (scoresheetFilters.type === 'rulebook' && !hasPattern) matchType = false;
            if (scoresheetFilters.type === 'custom' && hasPattern) matchType = false;
            if (scoresheetFilters.type === 'general' && hasPattern) matchType = false;
            
            return matchAssoc && matchDisc && matchType;
        });
        
        setFilteredScoresheets(filtered);
    }, [scoresheets, scoresheetFilters, isAdminUser, assignedProjectData, assignedProjects, isLoadingAssignments, associationsData]);
    
    // Fetch patterns
    useEffect(() => {
        const fetchPatterns = async () => {
            setIsLoadingPatterns(true);
            try {
                const { data, error } = await supabase
                    .from('tbl_patterns')
                    .select('id, pdf_file_name, association_name, discipline, pattern_version')
                    .order('pdf_file_name');
                
                if (error) throw error;
                setPatterns(data || []);
            } catch (error) {
                console.error('Error fetching patterns:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load patterns.',
                    variant: 'destructive',
                });
            } finally {
                setIsLoadingPatterns(false);
            }
        };
        
        if (activeTab === 'patterns') {
            fetchPatterns();
        }
    }, [activeTab, toast]);
    
    // Filter patterns based on user type
    useEffect(() => {
        if (patterns.length === 0) {
            setFilteredPatterns([]);
            return;
        }
        
        let baseList = patterns;
        
        // For non-admin users, filter to only assigned project patterns
        if (!isAdminUser && assignedProjectData.length > 0) {
            const assignedPatternNames = new Set();
            
            assignedProjectData.forEach(project => {
                const data = project.project_data;
                
                // Extract patternName from patternSelections - this matches pdf_file_name in tbl_patterns
                if (data?.patternSelections) {
                    Object.values(data.patternSelections).forEach(disciplinePatterns => {
                        if (typeof disciplinePatterns === 'object') {
                            Object.values(disciplinePatterns).forEach(patternData => {
                                if (patternData?.patternName) {
                                    assignedPatternNames.add(patternData.patternName);
                                }
                            });
                        }
                    });
                }
            });
            
            // Filter patterns to those matching patternName from assigned projects
            baseList = patterns.filter(p => {
                // Match pdf_file_name against patternName from patternSelections
                return assignedPatternNames.has(p.pdf_file_name);
            });
        } else if (!isAdminUser && assignedProjects.length === 0 && !isLoadingAssignments) {
            // No assignments - show empty
            setFilteredPatterns([]);
            return;
        }
        
        const filtered = baseList.filter(p => {
            const matchAssoc = patternFilters.association === 'all' || 
                p.association_name === patternFilters.association;
            const matchDisc = patternFilters.discipline === 'all' || 
                p.discipline === patternFilters.discipline;
            const matchSearch = !patternFilters.searchTerm || 
                p.pdf_file_name?.toLowerCase().includes(patternFilters.searchTerm.toLowerCase()) ||
                p.discipline?.toLowerCase().includes(patternFilters.searchTerm.toLowerCase());
            
            return matchAssoc && matchDisc && matchSearch;
        });
        
        setFilteredPatterns(filtered);
    }, [patterns, patternFilters, isAdminUser, assignedProjectData, assignedProjects, isLoadingAssignments]);
    
    // Fetch pattern image
    useEffect(() => {
        const fetchPatternImage = async () => {
            if (!selectedPattern) {
                setPatternImage(null);
                return;
            }
            
            try {
                const { data, error } = await supabase
                    .from('tbl_pattern_media')
                    .select('image_url')
                    .eq('pattern_id', selectedPattern.id)
                    .maybeSingle();
                
                if (error) throw error;
                setPatternImage(data?.image_url || null);
            } catch (error) {
                console.error('Error fetching pattern image:', error);
                setPatternImage(null);
            }
        };
        
        fetchPatternImage();
    }, [selectedPattern]);
    
    // Fetch judge favorites - table may not exist yet
    useEffect(() => {
        const fetchFavorites = async () => {
            if (!user) return;
            
            setIsLoadingFavorites(true);
            try {
                const { data, error } = await supabase
                    .from('judge_favorites')
                    .select('*')
                    .eq('judge_id', user.id)
                    .order('created_at', { ascending: false });
                
                // If table doesn't exist, just set empty array
                if (error && error.code === 'PGRST205') {
                    setFavoritePatterns([]);
                    return;
                }
                if (error) throw error;
                setFavoritePatterns(data || []);
            } catch (error) {
                console.error('Error fetching favorites:', error);
                setFavoritePatterns([]);
            } finally {
                setIsLoadingFavorites(false);
            }
        };
        
        if (activeTab === 'favorites' && user) {
            fetchFavorites();
        }
    }, [activeTab, user]);
    
    // Get unique associations from scoresheets - map abbreviations to full names
    const scoresheetAssociations = useMemo(() => {
        const assocMap = new Map(); // value -> displayName
        scoresheets.forEach(s => {
            // Prefer full name from pattern, fallback to association_abbrev
            const rawAssoc = s.pattern?.association_name || s.association_abbrev;
            if (rawAssoc) {
                // Try to find matching association to get full name
                const matchedAssoc = associationsData.find(a => 
                    a.abbreviation === rawAssoc || a.name === rawAssoc || a.id === rawAssoc
                );
                const displayName = matchedAssoc?.name || rawAssoc;
                const value = matchedAssoc?.abbreviation || rawAssoc;
                assocMap.set(value, displayName);
            }
        });
        return Array.from(assocMap.entries())
            .map(([value, displayName]) => ({ value, displayName }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [scoresheets, associationsData]);
    
    // Get unique disciplines from scoresheets
    const scoresheetDisciplines = useMemo(() => {
        const discs = new Set();
        scoresheets.forEach(s => {
            const disc = s.discipline || s.pattern?.discipline;
            if (disc) discs.add(disc);
        });
        return Array.from(discs).sort();
    }, [scoresheets]);
    
    // Get unique associations from patterns
    const patternAssociations = useMemo(() => {
        const assocs = new Set();
        patterns.forEach(p => {
            if (p.association_name) assocs.add(p.association_name);
        });
        return Array.from(assocs).sort();
    }, [patterns]);
    
    // Get unique disciplines from patterns
    const patternDisciplines = useMemo(() => {
        const discs = new Set();
        patterns.forEach(p => {
            if (p.discipline) discs.add(p.discipline);
        });
        return Array.from(discs).sort();
    }, [patterns]);
    
    // Handle scoresheet actions
    const handleViewScoresheet = (scoresheet) => {
        if (scoresheet.image_url) {
            window.open(scoresheet.image_url, '_blank');
        } else {
            toast({
                title: 'No Preview Available',
                description: 'This scoresheet does not have a preview image.',
            });
        }
    };
    
    const handleDownloadScoresheet = async (scoresheet) => {
        // Use image_url as the primary source (full public URL)
        const url = scoresheet.image_url;
        
        if (!url) {
            toast({
                title: 'Download Unavailable',
                description: 'This scoresheet does not have a downloadable file.',
                variant: 'destructive',
            });
            return;
        }
        
        try {
            // Fetch the file and create a blob for proper download
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch file');
            
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            // Determine filename from storage_path or URL
            let fileName = 'scoresheet.png';
            if (scoresheet.storage_path) {
                fileName = scoresheet.storage_path.split('/').pop() || fileName;
            } else if (scoresheet.file_name) {
                fileName = scoresheet.file_name;
            } else {
                // Extract from URL
                const urlParts = url.split('/');
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
                title: 'Download Started',
                description: `Downloading ${fileName}`,
            });
        } catch (error) {
            console.error('Download error:', error);
            toast({
                title: 'Download Failed',
                description: 'Could not download the scoresheet. Please try again.',
                variant: 'destructive',
            });
        }
    };
    
    const handleToggleScoresheetFavorite = (scoresheetId) => {
        setScoresheetFavorites(prev => 
            prev.includes(scoresheetId) 
                ? prev.filter(id => id !== scoresheetId)
                : [...prev, scoresheetId]
        );
        toast({
            title: scoresheetFavorites.includes(scoresheetId) ? 'Removed from Favorites' : 'Added to Favorites',
        });
    };
    
    // Handle pattern actions
    const handleViewPattern = (pattern) => {
        setSelectedPattern(pattern);
    };
    
    const handleTogglePatternFavorite = (patternId) => {
        setPatternFavorites(prev => 
            prev.includes(patternId) 
                ? prev.filter(id => id !== patternId)
                : [...prev, patternId]
        );
        toast({
            title: patternFavorites.includes(patternId) ? 'Removed from Favorites' : 'Added to Favorites',
        });
    };
    
    // Handle favorite patterns
    const handleAddFavorite = () => {
        setEditingFavorite(null);
        setFavoriteForm({
            association_id: '',
            discipline_id: '',
            class_id: '',
            pattern_id: '',
            rank: 1,
            creator_note: ''
        });
        setIsFavoriteDialogOpen(true);
    };
    
    // Handler for opening project detail modal from notification
    const handleOpenNotificationProject = async (notification) => {
        try {
            // Mark notification as read
            await supabase
                .from('judge_notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notification.id);
            
            // Navigate to Pattern Book Builder in view mode
            navigate(`/pattern-book-builder/${notification.project_id}?mode=judgeView`);
            
            // Refresh notifications table to update read status
            if (notificationsTableData.length > 0) {
                const updatedData = notificationsTableData.map(n => 
                    n.id === notification.id 
                        ? { ...n, is_read: true }
                        : n
                );
                setNotificationsTableData(updatedData);
            }
        } catch (error) {
            console.error('Error opening project:', error);
            toast({
                title: 'Error',
                description: 'Failed to open project.',
                variant: 'destructive',
            });
        }
    };
    
    const handleEditFavorite = (favorite) => {
        setEditingFavorite(favorite);
        setFavoriteForm({
            association_id: favorite.association_id,
            discipline_id: favorite.discipline_id,
            class_id: favorite.class_id,
            pattern_id: favorite.pattern_id,
            rank: favorite.rank,
            creator_note: favorite.creator_note || ''
        });
        setIsFavoriteDialogOpen(true);
    };
    
    const handleSaveFavorite = async () => {
        if (!user) return;
        
        try {
            if (editingFavorite) {
                // Update existing
                const { error } = await supabase
                    .from('judge_favorites')
                    .update({
                        pattern_id: favoriteForm.pattern_id,
                        rank: favoriteForm.rank,
                        creator_note: favoriteForm.creator_note,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingFavorite.id);
                
                if (error) throw error;
                toast({ title: 'Favorite Updated', description: 'Your favorite pattern has been updated.' });
            } else {
                // Check if already 3 favorites for this context
                const existing = favoritePatterns.filter(f => 
                    f.association_id === favoriteForm.association_id &&
                    f.discipline_id === favoriteForm.discipline_id &&
                    f.class_id === favoriteForm.class_id
                );
                
                if (existing.length >= 3) {
                    toast({
                        title: 'Limit Reached',
                        description: 'You can only have 3 favorite patterns per Association + Discipline + Class combination.',
                        variant: 'destructive',
                    });
                    return;
                }
                
                // Check if rank is already taken
                const rankTaken = existing.some(f => f.rank === favoriteForm.rank);
                if (rankTaken) {
                    toast({
                        title: 'Rank Taken',
                        description: 'This rank is already assigned. Please choose a different rank (1-3).',
                        variant: 'destructive',
                    });
                    return;
                }
                
                // Create new
                const { error } = await supabase
                    .from('judge_favorites')
                    .insert({
                        judge_id: user.id,
                        association_id: favoriteForm.association_id,
                        discipline_id: favoriteForm.discipline_id,
                        class_id: favoriteForm.class_id,
                        pattern_id: favoriteForm.pattern_id,
                        rank: favoriteForm.rank,
                        creator_note: favoriteForm.creator_note
                    });
                
                if (error) throw error;
                toast({ title: 'Favorite Added', description: 'Pattern added to your favorites.' });
            }
            
            // Refresh favorites
            const { data, error } = await supabase
                .from('judge_favorites')
                .select('*')
                .eq('judge_id', user.id)
                .order('created_at', { ascending: false });
            
            if (!error) setFavoritePatterns(data || []);
            
            setIsFavoriteDialogOpen(false);
        } catch (error) {
            console.error('Error saving favorite:', error);
            toast({
                title: 'Error',
                description: 'Failed to save favorite. Please try again.',
                variant: 'destructive',
            });
        }
    };
    
    const handleDeleteFavorite = async (favoriteId) => {
        try {
            const { error } = await supabase
                .from('judge_favorites')
                .delete()
                .eq('id', favoriteId);
            
            if (error) throw error;
            
            setFavoritePatterns(prev => prev.filter(f => f.id !== favoriteId));
            toast({ title: 'Favorite Removed', description: 'Pattern removed from your favorites.' });
        } catch (error) {
            console.error('Error deleting favorite:', error);
            toast({
                title: 'Error',
                description: 'Failed to remove favorite. Please try again.',
                variant: 'destructive',
            });
        }
    };
    
    // Get filtered disciplines for favorite form
    const favoriteFormDisciplines = useMemo(() => {
        if (!favoriteForm.association_id) return [];
        return disciplines.filter(d => d.association_id === favoriteForm.association_id);
    }, [favoriteForm.association_id, disciplines]);
    
    // Get filtered patterns for favorite form
    const favoriteFormPatterns = useMemo(() => {
        if (!favoriteForm.association_id || !favoriteForm.discipline_id) return [];
        return patterns.filter(p => 
            p.association_name === favoriteForm.association_id &&
            p.discipline === favoriteFormDisciplines.find(d => d.id === favoriteForm.discipline_id)?.name
        );
    }, [favoriteForm.association_id, favoriteForm.discipline_id, patterns, favoriteFormDisciplines]);
    
    return (
        <>
            <Helmet>
                <title>Judge's Toolbox - EquiPatterns</title>
                <meta name="description" content="Portal for judges to access patterns, scoresheets, and manage judge resources." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-7xl mx-auto space-y-6"
                    >
                        {/* Header */}
                        <div className="text-center mb-8">
                            <motion.div
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6"
                            >
                                <Gavel className="h-10 w-10 text-primary" />
                            </motion.div>
                            <h1 className="text-4xl font-bold mb-4">🧰 Judge's Toolbox</h1>
                            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                                Your dedicated portal for accessing patterns, scoresheets, and managing your judge resources.
                            </p>
                        </div>

                        {/* Notifications/Assignments Table */}
                        <Card className="mb-6 shadow-lg border-2">
                            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                                <CardTitle className="flex items-center gap-2 text-2xl">
                                    <Bell className="h-6 w-6 text-primary" />
                                    My Assigned Shows
                                </CardTitle>
                                <CardDescription className="text-base mt-1">
                                    View your assigned shows and patterns
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoadingNotificationsTable ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        <span className="ml-2 text-muted-foreground">Loading assignments...</span>
                                    </div>
                                ) : notificationsTableData.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
                                        <p>No assignments yet.</p>
                                        <p className="text-sm">You'll see your assigned shows here when you receive notifications.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow className="hover:bg-muted/50 border-b-2">
                                                    <TableHead className="font-semibold text-sm h-14">Show Name</TableHead>
                                                    <TableHead className="font-semibold text-sm">Discipline(s)</TableHead>
                                                    <TableHead className="font-semibold text-sm min-w-[280px]">Pattern(s)</TableHead>
                                                    <TableHead className="font-semibold text-sm">Start Date</TableHead>
                                                    <TableHead className="font-semibold text-sm">End Date</TableHead>
                                                    <TableHead className="font-semibold text-sm">Status</TableHead>
                                                    <TableHead className="font-semibold text-sm text-center">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {notificationsTableData.map((notification, rowIdx) => {
                                                    const isProjectLocked = ['Locked', 'Final', 'Lock & Approve Mode', 'Publication'].includes(notification.status || '');
                                                    return (
                                                    <TableRow 
                                                        key={notification.id}
                                                        className="border-b hover:bg-muted/30 transition-colors"
                                                    >
                                                        <TableCell className="font-semibold py-4">
                                                            <div className="flex items-center gap-2.5">
                                                                {!notification.is_read && (
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 animate-pulse" />
                                                                )}
                                                                <button
                                                                    className={cn(
                                                                        "text-base text-left transition-colors",
                                                                        isProjectLocked
                                                                            ? "text-muted-foreground cursor-default"
                                                                            : "hover:text-primary hover:underline"
                                                                    )}
                                                                    onClick={() => {
                                                                        if (isProjectLocked) {
                                                                            toast({ title: 'Project Locked', description: 'This project is locked. Pattern selection is not available.', variant: 'destructive' });
                                                                            return;
                                                                        }
                                                                        supabase
                                                                            .from('projects')
                                                                            .select('*')
                                                                            .eq('id', notification.project_id)
                                                                            .single()
                                                                            .then(({ data, error }) => {
                                                                                if (error) {
                                                                                    toast({
                                                                                        title: 'Error',
                                                                                        description: 'Failed to load project.',
                                                                                        variant: 'destructive',
                                                                                    });
                                                                                    return;
                                                                                }
                                                                                setSelectedProjectForEdit(data);
                                                                                setIsPatternEditorOpen(true);
                                                                            });
                                                                    }}
                                                                >
                                                                    {notification.project_name}
                                                                </button>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            {notification.discipline_names?.length > 0 ? (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {notification.discipline_names.slice(0, 3).map((name, idx) => (
                                                                        <Badge 
                                                                            key={idx} 
                                                                            variant="outline" 
                                                                            className="text-xs px-3 py-1.5 whitespace-nowrap bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-full shadow-sm hover:shadow-md transition-shadow"
                                                                        >
                                                                            {name}
                                                                        </Badge>
                                                                    ))}
                                                                    {notification.discipline_names.length > 3 && (
                                                                        <Badge variant="outline" className="text-xs px-3 py-1.5 whitespace-nowrap rounded-full">
                                                                            +{notification.discipline_names.length - 3} more
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="min-w-[320px] py-4">
                                                            {notification.pattern_items?.length > 0 ? (
                                                                <div className="flex flex-col gap-2.5">
                                                                    {notification.pattern_items.slice(0, 3).map((pattern, idx) => (
                                                                        <HoverCard key={idx} openDelay={150} closeDelay={100}>
                                                                            <HoverCardTrigger asChild>
                                                                                <span className="inline-flex items-center cursor-pointer">
                                                                                    <Badge 
                                                                                        variant="secondary" 
                                                                                        className="text-xs px-3.5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200 w-fit rounded-full shadow-sm hover:shadow-md"
                                                                                    >
                                                                                        <span className="block truncate max-w-[220px] font-medium" title={pattern.name}>{pattern.name}</span>
                                                                                        <Eye className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                                                    </Badge>
                                                                                </span>
                                                                            </HoverCardTrigger>
                                                                            <HoverCardContent 
                                                                                className="w-96 p-4 shadow-xl border-2 rounded-lg"
                                                                                align="start"
                                                                                sideOffset={8}
                                                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                                                            >
                                                                                <div className="space-y-3">
                                                                                    <p className="text-sm font-semibold text-center break-words mb-3 text-foreground border-b pb-2">{pattern.name}</p>
                                                                                    {pattern.previewImageUrl ? (
                                                                                        <div className="rounded-lg overflow-hidden border-2 bg-muted/30 shadow-inner">
                                                                                            <img 
                                                                                                src={pattern.previewImageUrl} 
                                                                                                alt={pattern.name}
                                                                                                className="w-full h-auto object-contain max-h-[400px]"
                                                                                                onError={(e) => {
                                                                                                    e.target.style.display = 'none';
                                                                                                    const errorDiv = e.target.parentElement?.querySelector('.error-fallback');
                                                                                                    if (errorDiv) errorDiv.style.display = 'flex';
                                                                                                }}
                                                                                            />
                                                                                            <div className="w-full h-40 rounded border bg-muted flex items-center justify-center text-muted-foreground text-sm hidden error-fallback">
                                                                                                No preview available
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : pattern.id ? (
                                                                                        <PatternPreviewImage patternId={pattern.id} patternName={pattern.name} />
                                                                                    ) : (
                                                                                        <div className="w-full h-40 rounded-lg border-2 bg-muted flex items-center justify-center text-muted-foreground text-sm">
                                                                                            No preview available
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </HoverCardContent>
                                                                        </HoverCard>
                                                                    ))}
                                                                    {notification.pattern_items.length > 3 && (
                                                                        <Badge variant="outline" className="text-xs px-3 py-1.5 w-fit whitespace-nowrap rounded-full">
                                                                            +{notification.pattern_items.length - 3} more
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            {notification.start_date ? (
                                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                                    <Calendar className="h-4 w-4 text-primary" />
                                                                    <span>{format(parseLocalDate(notification.start_date), "MMMM do, yyyy")}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            {notification.end_date ? (
                                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                                    <Calendar className="h-4 w-4 text-primary" />
                                                                    <span>{format(parseLocalDate(notification.end_date), "MMMM do, yyyy")}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <Badge 
                                                                variant={(notification.status || 'Draft') === 'Lock & Approve Mode' ? 'default' : 'secondary'}
                                                                className={cn(
                                                                    'text-xs px-3.5 py-2 font-semibold rounded-full shadow-sm',
                                                                    (notification.status || 'Draft') === 'Lock & Approve Mode' 
                                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-2 border-green-300 dark:border-green-700' 
                                                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600'
                                                                )}
                                                            >
                                                                {(notification.status || 'Draft') === 'Lock & Approve Mode' 
                                                                    ? 'Lock & Approve Mode' 
                                                                    : (notification.status || 'Draft') === 'Draft' 
                                                                    ? 'In Progress' 
                                                                    : notification.status || 'In Progress'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right py-4">
                                                            <div className="flex items-center gap-2.5 justify-end">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={isProjectLocked}
                                                                    className={cn(
                                                                        "font-medium transition-all duration-200",
                                                                        isProjectLocked
                                                                            ? "opacity-50 cursor-not-allowed"
                                                                            : "hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md"
                                                                    )}
                                                                    onClick={() => {
                                                                        // Fetch full project data
                                                                        supabase
                                                                            .from('projects')
                                                                            .select('*')
                                                                            .eq('id', notification.project_id)
                                                                            .single()
                                                                            .then(({ data, error }) => {
                                                                                if (error) {
                                                                                    toast({
                                                                                        title: 'Error',
                                                                                        description: 'Failed to load project.',
                                                                                        variant: 'destructive',
                                                                                    });
                                                                                    return;
                                                                                }
                                                                                setSelectedProjectForEdit(data);
                                                                                setIsPatternEditorOpen(true);
                                                                            });
                                                                    }}
                                                                >
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Select Pattern
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="font-medium transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md"
                                                                    onClick={() => handleOpenNotificationProject(notification)}
                                                                >
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    View
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                         {/* Non-admin user notice */}
                         {!isAdminUser && (
                            <Card className="mb-4 border-primary/30 bg-primary/5">
                                <CardContent className="py-4">
                                    <div className="flex items-center gap-3">
                                        <Bell className="h-5 w-5 text-primary" />
                                        <div>
                                            <p className="font-medium text-sm">Assigned Content View</p>
                                            <p className="text-xs text-muted-foreground">
                                                You're viewing scoresheets and patterns from your assigned shows. 
                                                {assignedProjects.length > 0 
                                                    ? ` (${assignedProjects.length} assignment${assignedProjects.length > 1 ? 's' : ''})` 
                                                    : ' Check notifications for new assignments.'}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="scoresheets">
                                    <FileText className="mr-2 h-4 w-4" />
                                    {isAdminUser ? 'Quick Score Sheet Finder' : 'Assigned Score Sheets'}
                                </TabsTrigger>
                                <TabsTrigger value="favorites">
                                    <Star className="mr-2 h-4 w-4" />
                                    Favorite Patterns
                                </TabsTrigger>
                            </TabsList>

                            {/* Tab A: Quick Score Sheet Finder */}
                            <TabsContent value="scoresheets" className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>{isAdminUser ? 'Quick Score Sheet Finder' : 'Assigned Score Sheets'}</CardTitle>
                                        <CardDescription>
                                            {isAdminUser 
                                                ? 'Find the correct score sheet instantly with filters'
                                                : 'Score sheets from your assigned shows'
                                            }
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Loading state for assignments */}
                                        {!isAdminUser && isLoadingAssignments ? (
                                            <div className="flex items-center justify-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <span className="ml-2 text-muted-foreground">Loading assignments...</span>
                                            </div>
                                        ) : (
                                            <>
                                        {/* Filters */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label>Association</Label>
                                                <Select 
                                                    value={scoresheetFilters.association}
                                                    onValueChange={(value) => setScoresheetFilters(prev => ({ ...prev, association: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="All Associations">
                                                            {scoresheetFilters.association === 'all' 
                                                                ? 'All Associations' 
                                                                : scoresheetAssociations.find(a => a.value === scoresheetFilters.association)?.displayName || scoresheetFilters.association}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Associations</SelectItem>
                                                        {scoresheetAssociations.map(assoc => (
                                                            <SelectItem key={assoc.value} value={assoc.value}>{assoc.displayName}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <Label>Discipline / Division</Label>
                                                <Select 
                                                    value={scoresheetFilters.discipline}
                                                    onValueChange={(value) => setScoresheetFilters(prev => ({ ...prev, discipline: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="All Disciplines" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Disciplines</SelectItem>
                                                        {scoresheetDisciplines.map(disc => (
                                                            <SelectItem key={disc} value={disc}>{disc}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <Label>Score Sheet Type</Label>
                                                <Select 
                                                    value={scoresheetFilters.type}
                                                    onValueChange={(value) => setScoresheetFilters(prev => ({ ...prev, type: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="All Types" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Types</SelectItem>
                                                        <SelectItem value="general">General</SelectItem>
                                                        <SelectItem value="rulebook">Rulebook Pattern</SelectItem>
                                                        <SelectItem value="custom">Custom Pattern</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Results */}
                                        {isLoadingScoresheets ? (
                                            <div className="flex items-center justify-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                        ) : filteredScoresheets.length === 0 ? (
                                            <div className="text-center py-12 text-muted-foreground">
                                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                <p>No scoresheets found matching your filters.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {filteredScoresheets.map(scoresheet => (
                                                    <Card key={scoresheet.id} className="hover:shadow-md transition-shadow">
                                                        <CardContent className="p-4 space-y-3">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <h4 className="font-semibold text-sm">
                                                                        {scoresheet.discipline || scoresheet.pattern?.discipline || 'Scoresheet'}
                                                                    </h4>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {scoresheet.pattern?.association_name || scoresheet.association_abbrev || 'Unknown'}
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() => handleToggleScoresheetFavorite(scoresheet.id)}
                                                                >
                                                                    <Heart 
                                                                        className={`h-4 w-4 ${
                                                                            scoresheetFavorites.includes(scoresheet.id) 
                                                                                ? 'fill-red-500 text-red-500' 
                                                                                : ''
                                                                        }`} 
                                                                    />
                                                                </Button>
                                                            </div>
                                                            
                                                            {scoresheet.image_url && (
                                                                <div className="rounded-md overflow-hidden border bg-muted/20">
                                                                    <img 
                                                                        src={scoresheet.image_url} 
                                                                        alt="Scoresheet Preview" 
                                                                        className="w-full h-auto max-h-32 object-contain"
                                                                    />
                                                                </div>
                                                            )}
                                                            
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="flex-1"
                                                                    onClick={() => handleViewScoresheet(scoresheet)}
                                                                >
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    View PDF
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="flex-1"
                                                                    onClick={() => handleDownloadScoresheet(scoresheet)}
                                                                >
                                                                    <Download className="mr-2 h-4 w-4" />
                                                                    Download
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Tab B: Judge Favorite Patterns */}
                            <TabsContent value="favorites" className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle>Judge Favorite Patterns</CardTitle>
                                                <CardDescription>
                                                    Define your top 3 preferred patterns per context (Association + Discipline)
                                                </CardDescription>
                                            </div>
                                            <Button onClick={handleAddFavorite}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Favorite
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {isLoadingFavorites ? (
                                            <div className="flex items-center justify-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                        ) : favoritePatterns.length === 0 ? (
                                            <div className="text-center py-12 text-muted-foreground">
                                                <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                <p>No favorite patterns yet. Add your top picks to help show managers.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {favoritePatterns.map(favorite => {
                                                    const pattern = patterns.find(p => p.id === favorite.pattern_id);
                                                    const association = associationsData.find(a => a.id === favorite.association_id);
                                                    const discipline = disciplines.find(d => d.id === favorite.discipline_id);
                                                    
                                                    return (
                                                        <Card key={favorite.id} className="bg-muted/30">
                                                            <CardContent className="p-4">
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex-1 space-y-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Badge variant="secondary">Rank {favorite.rank}</Badge>
                                                                            <span className="font-semibold">
                                                                                {association?.name || favorite.association_id} - {discipline?.name || favorite.discipline_id}
                                                                            </span>
                                                                        </div>
                                                                        {pattern && (
                                                                            <p className="text-sm text-muted-foreground">
                                                                                Pattern: {pattern.pdf_file_name || `Pattern ${pattern.id}`}
                                                                            </p>
                                                                        )}
                                                                        {favorite.creator_note && (
                                                                            <p className="text-sm text-muted-foreground italic">
                                                                                Note: {favorite.creator_note}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => handleEditFavorite(favorite)}
                                                                        >
                                                                            <Edit className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => handleDeleteFavorite(favorite.id)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        {/* Nice-to-Have: Quick Links */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Quick Links
                                </CardTitle>
                                <CardDescription>
                                    Recently used score sheets and viewed patterns
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="font-semibold mb-2">Recently Used Score Sheets</h4>
                                        {recentScoresheets.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No recent activity</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {recentScoresheets.slice(0, 5).map(s => (
                                                    <Button key={s.id} variant="ghost" className="w-full justify-start" size="sm">
                                                        <FileText className="mr-2 h-4 w-4" />
                                                        {s.discipline || 'Scoresheet'}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2">Recently Viewed Patterns</h4>
                                        {recentPatterns.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No recent activity</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {recentPatterns.slice(0, 5).map(p => (
                                                    <Button key={p.id} variant="ghost" className="w-full justify-start" size="sm">
                                                        <BookOpen className="mr-2 h-4 w-4" />
                                                        {p.pdf_file_name || `Pattern ${p.id}`}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </main>
            </div>

            {/* Pattern Preview Dialog */}
            {selectedPattern && (
                <Dialog open={!!selectedPattern} onOpenChange={() => setSelectedPattern(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                Pattern {selectedPattern.pdf_file_name?.match(/(\d+)/)?.[1] || selectedPattern.id}
                            </DialogTitle>
                            <DialogDescription>
                                {selectedPattern.discipline} - {selectedPattern.association_name}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            {patternImage ? (
                                <div className="rounded-md overflow-hidden border bg-muted/20">
                                    <img 
                                        src={patternImage} 
                                        alt="Pattern Diagram" 
                                        className="w-full h-auto"
                                    />
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No image available for this pattern.
                                </p>
                            )}
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => handleTogglePatternFavorite(selectedPattern.id)}>
                                    <Star className={`mr-2 h-4 w-4 ${patternFavorites.includes(selectedPattern.id) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                    {patternFavorites.includes(selectedPattern.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                                </Button>
                                <Button variant="outline" onClick={() => setSelectedPattern(null)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Add/Edit Favorite Dialog */}
            <Dialog open={isFavoriteDialogOpen} onOpenChange={setIsFavoriteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingFavorite ? 'Edit Favorite Pattern' : 'Add Favorite Pattern'}</DialogTitle>
                        <DialogDescription>
                            Select up to 3 patterns per Association + Discipline + Class combination, ranked 1-3
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Association</Label>
                            <Select 
                                value={favoriteForm.association_id}
                                onValueChange={(value) => setFavoriteForm(prev => ({ ...prev, association_id: value, discipline_id: '', pattern_id: '' }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Association" />
                                </SelectTrigger>
                                <SelectContent>
                                    {associationsData.map(assoc => (
                                        <SelectItem key={assoc.id} value={assoc.id}>{assoc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Discipline</Label>
                            <Select 
                                value={favoriteForm.discipline_id}
                                onValueChange={(value) => setFavoriteForm(prev => ({ ...prev, discipline_id: value, pattern_id: '' }))}
                                disabled={!favoriteForm.association_id}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Discipline" />
                                </SelectTrigger>
                                <SelectContent>
                                    {favoriteFormDisciplines.map(disc => (
                                        <SelectItem key={disc.id} value={disc.id}>{disc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Class</Label>
                            <Input
                                placeholder="Enter class name (optional)"
                                value={favoriteForm.class_id}
                                onChange={(e) => setFavoriteForm(prev => ({ ...prev, class_id: e.target.value }))}
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Pattern</Label>
                            <Select 
                                value={favoriteForm.pattern_id}
                                onValueChange={(value) => setFavoriteForm(prev => ({ ...prev, pattern_id: value }))}
                                disabled={!favoriteForm.discipline_id}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Pattern" />
                                </SelectTrigger>
                                <SelectContent>
                                    {favoriteFormPatterns.map(pattern => (
                                        <SelectItem key={pattern.id} value={String(pattern.id)}>
                                            {pattern.pdf_file_name || `Pattern ${pattern.id}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Rank (1-3)</Label>
                            <Select 
                                value={String(favoriteForm.rank)}
                                onValueChange={(value) => setFavoriteForm(prev => ({ ...prev, rank: parseInt(value) }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1</SelectItem>
                                    <SelectItem value="2">2</SelectItem>
                                    <SelectItem value="3">3</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Creator Note (Optional)</Label>
                            <Textarea
                                placeholder="Add a note for pattern book creators / show managers..."
                                value={favoriteForm.creator_note}
                                onChange={(e) => setFavoriteForm(prev => ({ ...prev, creator_note: e.target.value }))}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFavoriteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveFavorite} disabled={!favoriteForm.association_id || !favoriteForm.discipline_id || !favoriteForm.pattern_id}>
                            <Save className="mr-2 h-4 w-4" />
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Project Detail Modal for notifications */}
            <ProjectDetailModal
                open={isProjectDetailModalOpen}
                onClose={() => {
                    setIsProjectDetailModalOpen(false);
                    setSelectedProjectForModal(null);
                }}
                project={selectedProjectForModal}
                isFromJudgesPortal={true}
            />
            
            {/* Judge Pattern Editor Modal */}
            <Dialog open={isPatternEditorOpen} onOpenChange={setIsPatternEditorOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Select Pattern - {selectedProjectForEdit?.project_name || 'Project'}</DialogTitle>
                        <DialogDescription>
                            Select patterns for disciplines assigned to you. Your selections will be saved to the project.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedProjectForEdit && (
                        <JudgePatternEditor
                            project={selectedProjectForEdit}
                            userEmail={user?.email}
                            onSave={async (updatedProjectData) => {
                                // Update project in database
                                const { error } = await supabase
                                    .from('projects')
                                    .update({ project_data: updatedProjectData })
                                    .eq('id', selectedProjectForEdit.id);
                                
                                if (error) {
                                    toast({
                                        title: 'Error',
                                        description: 'Failed to save changes.',
                                        variant: 'destructive',
                                    });
                                    return;
                                }
                                
                                // Update local state
                                setSelectedProjectForEdit(prev => ({
                                    ...prev,
                                    project_data: updatedProjectData,
                                }));
                                
                                // Refresh notifications table by re-running the main fetch
                                // This will use the same filtering logic
                                const fetchNotificationsTableData = async () => {
                                    if (!user?.email) return;
                                    
                                    setIsLoadingNotificationsTable(true);
                                    try {
                                        const { data: notifications, error: notifError } = await supabase
                                            .from('judge_notifications')
                                            .select('*')
                                            .eq('judge_email', user.email.toLowerCase())
                                            .order('created_at', { ascending: false });
                                        
                                        if (notifError) {
                                            if (notifError.code === 'PGRST205' || notifError.code === '42P01') {
                                                setNotificationsTableData([]);
                                                return;
                                            }
                                            throw notifError;
                                        }
                                        
                                        if (!notifications || notifications.length === 0) {
                                            setNotificationsTableData([]);
                                            return;
                                        }
                                        
                                        const projectIds = [...new Set(notifications.map(n => n.project_id))];
                                        
                                        const { data: projects, error: projError } = await supabase
                                            .from('projects')
                                            .select('id, project_name, project_data, status')
                                            .in('id', projectIds);
                                        
                                        if (projError) throw projError;
                                        
                                        const projectMap = {};
                                        (projects || []).forEach(p => {
                                            projectMap[p.id] = p;
                                        });
                                        
                                        const allPatternIds = new Set();
                                        (projects || []).forEach(p => {
                                            const projectData = p.project_data || {};
                                            if (projectData.patternSelections) {
                                                Object.values(projectData.patternSelections).forEach(disciplinePatterns => {
                                                    if (typeof disciplinePatterns === 'object') {
                                                        Object.values(disciplinePatterns).forEach(patternData => {
                                                            if (patternData?.patternId) {
                                                                allPatternIds.add(patternData.patternId);
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                        
                                        let patternImageMap = {};
                                        if (allPatternIds.size > 0) {
                                            const { data: patternMediaData, error: patError } = await supabase
                                                .from('tbl_pattern_media')
                                                .select('pattern_id, image_url')
                                                .in('pattern_id', Array.from(allPatternIds));
                                            
                                            if (!patError && patternMediaData) {
                                                patternMediaData.forEach(pm => {
                                                    if (!patternImageMap[pm.pattern_id]) {
                                                        patternImageMap[pm.pattern_id] = pm.image_url;
                                                    }
                                                });
                                            }
                                        }
                                        
                                        const getJudgeNameForProject = (projectData) => {
                                            const userEmailLower = user.email.toLowerCase();
                                            const associationJudges = projectData.associationJudges || {};
                                            for (const assocId in associationJudges) {
                                                const assocData = associationJudges[assocId];
                                                const judgesList = assocData?.judges || [];
                                                const matchedJudge = judgesList.find(j => j.email?.toLowerCase() === userEmailLower);
                                                if (matchedJudge?.name) return matchedJudge.name;
                                            }
                                            const officials = projectData.officials || [];
                                            const matchedOfficial = officials.find(o => o.email?.toLowerCase() === userEmailLower);
                                            if (matchedOfficial?.name) return matchedOfficial.name;
                                            return null;
                                        };
                                        
                                        const tableData = notifications.map(n => {
                                            const project = projectMap[n.project_id] || {};
                                            const projectData = project.project_data || {};
                                            const judgeName = getJudgeNameForProject(projectData);
                                            if (!judgeName) {
                                                return {
                                                    id: n.id,
                                                    project_id: n.project_id,
                                                    project_name: n.project_name || project.project_name || 'Unknown Show',
                                                    pattern_items: [],
                                                    discipline_names: [],
                                                    start_date: projectData.startDate || null,
                                                    end_date: projectData.endDate || null,
                                                    status: project.status || 'Draft',
                                                    created_at: n.created_at,
                                                    is_read: n.is_read
                                                };
                                            }
                                            
                                            const disciplines = projectData.disciplines || [];
                                            const groupJudges = projectData.groupJudges || {};
                                            const judgeSelections = projectData.judgeSelections || {};
                                            const patternSelections = projectData.patternSelections || {};
                                            
                                            const assignedDisciplineIds = new Set();
                                            const assignedDisciplineIndices = new Set();
                                            
                                            disciplines.forEach((discipline, disciplineIndex) => {
                                                const disciplineId = discipline.id;
                                                let isAssigned = false;
                                                const disciplineJudge = judgeSelections[disciplineIndex];
                                                if (disciplineJudge && disciplineJudge.toLowerCase().trim() === judgeName.toLowerCase().trim()) {
                                                    isAssigned = true;
                                                }
                                                if (!isAssigned) {
                                                    const groups = discipline.patternGroups || [];
                                                    groups.forEach((group, groupIndex) => {
                                                        const groupJudge = groupJudges[disciplineIndex]?.[groupIndex];
                                                        if (groupJudge && groupJudge.toLowerCase().trim() === judgeName.toLowerCase().trim()) {
                                                            isAssigned = true;
                                                        }
                                                    });
                                                }
                                                if (isAssigned) {
                                                    assignedDisciplineIds.add(disciplineId);
                                                    assignedDisciplineIndices.add(disciplineIndex);
                                                }
                                            });
                                            
                                            const patternItems = [];
                                            const disciplineNames = [];
                                            
                                            if (patternSelections) {
                                                Object.entries(patternSelections).forEach(([disciplineKey, disciplinePatterns]) => {
                                                    let isAssignedDiscipline = false;
                                                    if (assignedDisciplineIds.has(disciplineKey)) {
                                                        isAssignedDiscipline = true;
                                                    } else {
                                                        const disciplineIndex = parseInt(disciplineKey);
                                                        if (!isNaN(disciplineIndex) && assignedDisciplineIndices.has(disciplineIndex)) {
                                                            isAssignedDiscipline = true;
                                                        }
                                                    }
                                                    
                                                    if (!isAssignedDiscipline) return;
                                                    
                                                    const discipline = disciplines.find((d, idx) => 
                                                        d.id === disciplineKey || idx.toString() === disciplineKey
                                                    );
                                                    const disciplineName = discipline?.name || disciplineKey;
                                                    
                                                    if (disciplineName && !disciplineNames.includes(disciplineName)) {
                                                        disciplineNames.push(disciplineName);
                                                    }
                                                    
                                                    if (typeof disciplinePatterns === 'object') {
                                                        Object.values(disciplinePatterns).forEach(patternData => {
                                                            if (patternData?.patternName) {
                                                                patternItems.push({
                                                                    name: patternData.patternName,
                                                                    id: patternData.patternId || null,
                                                                    previewImageUrl: patternData.patternId ? patternImageMap[patternData.patternId] : null
                                                                });
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                            
                                            return {
                                                id: n.id,
                                                project_id: n.project_id,
                                                project_name: n.project_name || project.project_name || 'Unknown Show',
                                                pattern_items: patternItems,
                                                discipline_names: disciplineNames,
                                                start_date: projectData.startDate || null,
                                                end_date: projectData.endDate || null,
                                                status: project.status || 'Draft',
                                                created_at: n.created_at,
                                                is_read: n.is_read
                                            };
                                        });
                                        
                                        setNotificationsTableData(tableData);
                                    } catch (error) {
                                        console.error('Error refreshing notifications:', error);
                                        setNotificationsTableData([]);
                                    } finally {
                                        setIsLoadingNotificationsTable(false);
                                    }
                                };
                                
                                fetchNotificationsTableData();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};

export default JudgesPortalPage;
