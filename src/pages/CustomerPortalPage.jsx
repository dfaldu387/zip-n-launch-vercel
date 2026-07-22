import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, BookCopy, CalendarDays, PlusCircle, ArrowRight, Pencil, ImageIcon, CalendarIcon, Archive, ChevronDown, ChevronRight, FolderOpen, Eye, Folder, Edit, Download, FileText, LayoutGrid, Info, Users, Lock, MoreVertical, Trash2, Check, X, Share2, Printer, Mail, Link2, Image as LucideImage, FileSignature } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, parseLocalDate } from '@/lib/utils';
import { format } from 'date-fns';
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
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
import { Progress } from '@/components/ui/progress';
import ProjectDetailModal from '@/components/ProjectDetailModal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { downloadPatternBookFolder } from '@/lib/patternBookDownloader';
import { applyTextOverlay, getOverlayDataFromContext, batchDetectFieldPositions, applyTextOverlayWithPositions } from '@/lib/scoresheetTextOverlay';
import { findClassItemId } from '@/lib/resultsUtils';
import { fetchImageAsBase64, cropPatternImageSmart } from '@/lib/pdfHelpers';
import { generatePatternBookPdf } from '@/lib/bookGenerator';
import ResultsTab from '@/components/customer-portal/ResultsTab';
import PatternPortalDetailDialog from '@/components/customer-portal/PatternPortalDetailDialog';
import PatternBookDownloadDialog from '@/components/PatternBookDownloadDialog';
import { getPatternSelectionForAssoc, isAssocKeyedEntry, forEachPatternSelection, getForcedAssocForDivision, detectShowAssociations } from '@/lib/patternSelectionHelpers';
import { SendPatternEmailDialog } from '@/components/pattern-hub/SendPatternEmailDialog';
import CoverColorDialog from '@/components/customer-portal/CoverColorDialog';
import DueDateDialog from '@/components/customer-portal/DueDateDialog';
import ContractCard from '@/components/customer-portal/ContractCard';
import PatternBookDialogContent from '@/components/customer-portal/PatternBookDialogContent';

// Collapsible Folder for Pattern Folder section
const PatternFolderItem = ({ project, onRefresh, currentUserName, isPastPatternPortal = false }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [coverDialogOpen, setCoverDialogOpen] = useState(false);
    const [dueDateDialogOpen, setDueDateDialogOpen] = useState(false);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const mapDbStatusToDisplay = (currentStatus) => {
        const s = currentStatus || 'Draft';
        if (s === 'Locked' || s === 'Lock & Approve Mode') return 'Approval and Locked';
        if (s === 'Final' || s === 'Publication') return 'Publication';
        return 'Draft';
    };
    const [selectedStatus, setSelectedStatus] = useState(() => mapDbStatusToDisplay(project.status));
    // Re-sync when the parent refreshes the project so the lock state does
    // not reset to "Draft" on refetch.
    useEffect(() => {
        setSelectedStatus(mapDbStatusToDisplay(project.status));
    }, [project.status, project.id]);
    const [isSavingStatus, setIsSavingStatus] = useState(false);
    const [coverColor, setCoverColor] = useState(project.project_data?.coverColor || null);
    const [dueDate, setDueDate] = useState(project.project_data?.dueDate || null);
    const [scoreSheetsDialogOpen, setScoreSheetsDialogOpen] = useState(false);
    const [scoreSheets, setScoreSheets] = useState([]);
    const [isLoadingScoreSheets, setIsLoadingScoreSheets] = useState(false);
    const [patternsDialogOpen, setPatternsDialogOpen] = useState(false);
    const [patterns, setPatterns] = useState([]);
    const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
    const [judgeCardsDialogOpen, setJudgeCardsDialogOpen] = useState(false);
    const [judgeCards, setJudgeCards] = useState([]);
    const [isLoadingJudgeCards, setIsLoadingJudgeCards] = useState(false);
    
    // Get judges list from project_data (Step 8 Staff Access & Delegation)
    const getJudgesList = () => {
        const formData = project.project_data || {};
        const delegations = formData.delegations || {};
        const judgesList = [];
        
        // Get judges from associationJudges
        const seenJudgeNames = new Set();
        Object.entries(formData.associationJudges || {}).forEach(([assocId, assocData]) => {
            (assocData.judges || []).forEach((judge, index) => {
                if (judge && judge.name) {
                    const judgeId = `judge-${assocId}-${index}`;
                    const judgeDelegation = delegations[judgeId] || {};
                    const accessPhase = judgeDelegation.accessPhase || [];

                    // Determine status from accessPhase
                    let status = 'Pending';
                    if (accessPhase.includes('publication')) status = 'Published';
                    else if (accessPhase.includes('approval') || accessPhase.includes('locked')) status = 'Approval and Locked';
                    else if (accessPhase.includes('draft')) status = 'Review';

                    judgesList.push({
                        id: judgeId,
                        name: judge.name,
                        email: judge.email || delegations[judgeId]?.email,
                        role: 'Judge',
                        delegation: judgeDelegation,
                        status: status,
                        updatedAt: project.updated_at
                    });
                    seenJudgeNames.add(judge.name.trim().toLowerCase());
                }
            });
        });

        // Get judges from patternSelections (assigned at discipline level in Step 5)
        Object.entries(formData.patternSelections || {}).forEach(([discId, disciplineSels]) => {
            if (disciplineSels && typeof disciplineSels === 'object') {
                const flat = [];
                forEachPatternSelection(disciplineSels, (_g, _a, v) => flat.push(v));
                flat.forEach(sel => {
                    if (sel?.type === 'judgeAssigned' && sel?.judgeName?.trim()) {
                        const name = sel.judgeName.trim();
                        if (!seenJudgeNames.has(name.toLowerCase())) {
                            seenJudgeNames.add(name.toLowerCase());
                            judgesList.push({
                                id: `judge-pattern-${discId}`,
                                name: name,
                                email: '',
                                role: 'Judge',
                                delegation: {},
                                status: 'Assigned',
                                updatedAt: project.updated_at
                            });
                        }
                    }
                });
            }
        });

        return judgesList;
    };
    
    const judgesList = getJudgesList();

    // Check if all judges have locked or published status (hide Open card if true)
    const allJudgesLockedOrPublished = judgesList.length > 0 && judgesList.every(judge => {
        const accessPhase = judge.delegation?.accessPhase || [];
        return accessPhase.includes('approval') || accessPhase.includes('locked') || accessPhase.includes('publication');
    });

    const handleMenuAction = async (action) => {
        switch (action) {
            case 'open':
                navigate(`/pattern-book-builder/${project.id}?step=8`);
                break;
            case 'preview':
                navigate(`/pattern-book-builder/${project.id}?step=1&mode=preview`);
                break;
            case 'cover':
                setCoverDialogOpen(true);
                break;
            default:
        }
    };

    const handleSelectColor = async (color) => {
        setCoverColor(color);
        const updatedData = { ...project.project_data, coverColor: color };
        await supabase
            .from('projects')
            .update({ project_data: updatedData })
            .eq('id', project.id);
        setCoverDialogOpen(false);
    };

    const handleRemoveCover = async () => {
        setCoverColor(null);
        const updatedData = { ...project.project_data, coverColor: null };
        await supabase
            .from('projects')
            .update({ project_data: updatedData })
            .eq('id', project.id);
        setCoverDialogOpen(false);
    };

    const handleSaveDueDate = async (date) => {
        setDueDate(date);
        const updatedData = { ...project.project_data, dueDate: date };
        await supabase
            .from('projects')
            .update({ project_data: updatedData })
            .eq('id', project.id);
        toast({ title: "Due date updated", description: date ? `Due date set to ${format(new Date(date), 'MMM d, yyyy')}` : "Due date removed" });
    };

    const handleSaveStatus = async () => {
        setIsSavingStatus(true);
        try {
            // Map selected status to database status values (unified with PBB)
            let dbStatus = selectedStatus;
            if (selectedStatus === 'Approval and Locked') {
                dbStatus = 'Locked';
            } else if (selectedStatus === 'Publication') {
                dbStatus = 'Final';
            } else {
                dbStatus = 'Draft';
            }

            await supabase
                .from('projects')
                .update({ status: dbStatus })
                .eq('id', project.id);
            
            toast({ 
                title: "Status updated", 
                description: `Pattern status changed to ${selectedStatus}` 
            });
            setStatusDialogOpen(false);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error updating status:', error);
            toast({ 
                title: "Error", 
                description: "Failed to update status.", 
                variant: "destructive" 
            });
        } finally {
            setIsSavingStatus(false);
        }
    };

    const fetchScoreSheets = async () => {
        setIsLoadingScoreSheets(true);
        try {
            const projectData = project.project_data || {};
            const patternSelections = projectData.patternSelections || {};
            const disciplines = projectData.disciplines || [];
            const associations = projectData.associations || {};
            
            // Fetch associations data
            const { data: associationsData } = await supabase
                .from('associations')
                .select('id, abbreviation, name');
            
            const associationsMap = {};
            (associationsData || []).forEach(a => {
                associationsMap[a.id] = a;
            });
            
            const scoreSheetsList = [];
            const processedScoresheets = new Set(); // To avoid duplicates
            
            // Iterate through disciplines and groups to get score sheets
            for (const discipline of disciplines) {
                const disciplineSelections = patternSelections[discipline.id] || patternSelections[discipline.name];
                if (!disciplineSelections) continue;
                const disciplineAssocAbbrev = (() => {
                    const a = associationsMap[discipline.association_id];
                    return a?.abbreviation ? String(a.abbreviation).toUpperCase() : (discipline.association_id ? String(discipline.association_id).toUpperCase() : null);
                })();

                const groups = discipline.patternGroups || [];
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    let patternSelection = getPatternSelectionForAssoc(disciplineSelections, group.id, disciplineAssocAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, groupIndex, disciplineAssocAbbrev);
                    if (!patternSelection) continue;
                    
                    // Get pattern ID
                    const patternId = typeof patternSelection === 'object' 
                        ? (patternSelection.patternId || patternSelection.id) 
                        : patternSelection;
                    
                    if (!patternId) continue;
                    
                    // Extract divisions for this group
                    const divisions = Array.isArray(group.divisions) ? group.divisions : [];
                    const extractedDivisions = divisions.map(div => {
                        if (typeof div === 'string') {
                            return { name: div, association: '' };
                        } else if (div && typeof div === 'object') {
                            let assocName = div.association || div.assocName || '';
                            if (!assocName && div.association_id) {
                                const assoc = associationsMap[div.association_id];
                                assocName = assoc?.abbreviation || assoc?.name || div.association_id;
                            }
                            return {
                                name: div.name || div.divisionName || div.division || div.title || '',
                                association: assocName
                            };
                        } else {
                            return { name: String(div || ''), association: '' };
                        }
                    }).filter(div => div.name && div.name.trim() !== '');
                    
                    // Priority 1: Check if scoresheet was selected in patternSelection
                    if (typeof patternSelection === 'object' && patternSelection.scoresheetData) {
                        const scoresheetId = `${patternSelection.scoresheetData.id || patternSelection.scoresheetData.pattern_id}`;
                        if (!processedScoresheets.has(scoresheetId)) {
                            scoreSheetsList.push({
                                ...patternSelection.scoresheetData,
                                disciplineName: discipline.name,
                                groupName: group.name,
                                divisions: extractedDivisions
                            });
                            processedScoresheets.add(scoresheetId);
                        }
                        continue;
                    }
                    
                    // Priority 2: Fetch by pattern_id
                    if (patternId && !isNaN(parseInt(patternId))) {
                        const { data: scoresheet } = await supabase
                            .from('tbl_scoresheet')
                            .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev')
                            .eq('pattern_id', parseInt(patternId))
                            .maybeSingle();
                        
                        if (scoresheet && scoresheet.image_url) {
                            const scoresheetId = `${scoresheet.id}`;
                            if (!processedScoresheets.has(scoresheetId)) {
                                scoreSheetsList.push({
                                    ...scoresheet,
                                    disciplineName: discipline.name,
                                    groupName: group.name,
                                    divisions: extractedDivisions
                                });
                                processedScoresheets.add(scoresheetId);
                            }
                        }
                    }
                    
                    // Priority 3: Try by association and discipline
                    const association = associationsMap[discipline.association_id];
                    if (association?.abbreviation && discipline.name) {
                        const { data: scoresheet } = await supabase
                            .from('tbl_scoresheet')
                            .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev')
                            .eq('association_abbrev', association.abbreviation)
                            .ilike('discipline', `%${discipline.name}%`)
                            .maybeSingle();
                        
                        if (scoresheet && scoresheet.image_url) {
                            const scoresheetId = `${scoresheet.id}`;
                            if (!processedScoresheets.has(scoresheetId)) {
                                scoreSheetsList.push({
                                    ...scoresheet,
                                    disciplineName: discipline.name,
                                    groupName: group.name,
                                    divisions: extractedDivisions
                                });
                                processedScoresheets.add(scoresheetId);
                            }
                        }
                    }
                }
            }
            
            setScoreSheets(scoreSheetsList);
        } catch (error) {
            console.error('Error fetching score sheets:', error);
            toast({
                title: 'Error',
                description: 'Failed to load score sheets.',
                variant: 'destructive'
            });
        } finally {
            setIsLoadingScoreSheets(false);
        }
    };

    const handleOpenScoreSheets = () => {
        setScoreSheetsDialogOpen(true);
        fetchScoreSheets();
    };

    const fetchPatterns = async () => {
        setIsLoadingPatterns(true);
        try {
            const projectData = project.project_data || {};
            const disciplines = projectData.disciplines || [];
            const patternSelections = projectData.patternSelections || {};
            const patternsList = [];
            const processedPatterns = new Set(); // To prevent duplicates
            
            // Collect all pattern IDs
            const patternIds = new Set();
            // Flatten a potentially assoc-keyed entry into an array of selections.
            const flattenEntry = (entry) => {
                if (!entry) return [];
                if (isAssocKeyedEntry(entry)) return Object.values(entry);
                return [entry];
            };
            for (const discipline of disciplines) {
                const disciplineSelections = patternSelections[discipline.id] || patternSelections[discipline.name] || patternSelections[discipline.index];
                if (!disciplineSelections) continue;

                const groups = discipline.patternGroups || [];
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    const entries = flattenEntry(disciplineSelections[group.id]).concat(flattenEntry(disciplineSelections[groupIndex]));
                    for (const patternSelection of entries) {
                        if (!patternSelection) continue;
                        const patternId = typeof patternSelection === 'object'
                            ? (patternSelection.patternId || patternSelection.id)
                            : patternSelection;
                        if (patternId && !isNaN(parseInt(patternId))) {
                            patternIds.add(parseInt(patternId));
                        }
                    }
                }
            }
            
            // Fetch pattern images from tbl_pattern_media
            let patternImageMap = {};
            if (patternIds.size > 0) {
                const { data: patternMediaData, error: patError } = await supabase
                    .from('tbl_pattern_media')
                    .select('pattern_id, image_url')
                    .in('pattern_id', Array.from(patternIds));
                
                if (!patError && patternMediaData) {
                    patternMediaData.forEach(pm => {
                        if (!patternImageMap[pm.pattern_id]) {
                            patternImageMap[pm.pattern_id] = pm.image_url;
                        }
                    });
                }
            }
            
            // Fetch pattern details from tbl_patterns
            let patternDetailsMap = {};
            if (patternIds.size > 0) {
                const { data: patternData, error: patDetailError } = await supabase
                    .from('tbl_patterns')
                    .select('id, pdf_file_name, pattern_version, discipline, association_name')
                    .in('id', Array.from(patternIds));
                
                if (!patDetailError && patternData) {
                    patternData.forEach(p => {
                        patternDetailsMap[p.id] = p;
                    });
                }
            }
            
            // Build patterns list with discipline and group info
            for (const discipline of disciplines) {
                const disciplineSelections = patternSelections[discipline.id] || patternSelections[discipline.name] || patternSelections[discipline.index];
                if (!disciplineSelections) continue;
                const disciplineAbbrev = discipline.association_id
                    ? String(discipline.association_id).toUpperCase()
                    : null;

                const groups = discipline.patternGroups || [];
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    const patternSelection = getPatternSelectionForAssoc(disciplineSelections, group.id, disciplineAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, groupIndex, disciplineAbbrev);
                    if (!patternSelection) continue;
                    
                    // Get pattern ID
                    const patternId = typeof patternSelection === 'object' 
                        ? (patternSelection.patternId || patternSelection.id) 
                        : patternSelection;
                    
                    if (!patternId || isNaN(parseInt(patternId))) continue;
                    
                    const patternIdNum = parseInt(patternId);
                    const patternKey = `${patternIdNum}-${discipline.id}-${group.id || groupIndex}`;
                    
                    if (!processedPatterns.has(patternKey)) {
                        const patternDetail = patternDetailsMap[patternIdNum];
                        const imageUrl = patternImageMap[patternIdNum];
                        
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
                        
                        patternsList.push({
                            patternId: patternIdNum,
                            imageUrl: imageUrl,
                            patternName: patternDetail?.pdf_file_name || `Pattern ${patternIdNum}`,
                            version: patternDetail?.pattern_version || patternSelection.version || 'ALL',
                            disciplineName: discipline.name,
                            groupName: group.name,
                            discipline: patternDetail?.discipline || discipline.name,
                            divisions: extractedDivisions
                        });
                        processedPatterns.add(patternKey);
                    }
                }
            }
            
            setPatterns(patternsList);
        } catch (error) {
            console.error('Error fetching patterns:', error);
            toast({
                title: 'Error',
                description: 'Failed to load patterns.',
                variant: 'destructive'
            });
        } finally {
            setIsLoadingPatterns(false);
        }
    };

    const handleOpenPatterns = () => {
        setPatternsDialogOpen(true);
        fetchPatterns();
    };

    const fetchJudgeCards = async () => {
        setIsLoadingJudgeCards(true);
        try {
            const projectData = project.project_data || {};
            const disciplines = projectData.disciplines || [];
            const groupJudges = projectData.groupJudges || {};
            const judgeSelections = projectData.judgeSelections || {};
            const patternSelections = projectData.patternSelections || {};
            const associationJudges = projectData.associationJudges || {};
            const officials = projectData.officials || [];
            
            // Fetch associations data for division association names
            const { data: associationsData } = await supabase
                .from('associations')
                .select('id, abbreviation, name');
            
            const associationsMap = {};
            (associationsData || []).forEach(a => {
                associationsMap[a.id] = a;
            });
            
            // Collect ALL judges from associationJudges and officials
            const allJudgesSet = new Set();
            
            // Collect from associationJudges
            Object.values(associationJudges).forEach(assocData => {
                const judgesList = assocData?.judges || [];
                judgesList.forEach(judge => {
                    if (judge && judge.name && typeof judge.name === 'string') {
                        allJudgesSet.add(judge.name.trim());
                    }
                });
            });
            
            // Collect from showDetails.judges (Step 4 "Number of Judges" UI — canonical storage)
            const showDetailsJudgesMap = projectData.showDetails?.judges || {};
            Object.values(showDetailsJudgesMap).forEach(list => {
                (list || []).forEach(judge => {
                    if (judge?.name && typeof judge.name === 'string') {
                        allJudgesSet.add(judge.name.trim());
                    }
                });
            });

            // Collect from officials
            officials.forEach(official => {
                if (official && official.name && typeof official.name === 'string') {
                    allJudgesSet.add(official.name.trim());
                }
            });
            
            // Collect assigned judges to mark them
            const assignedJudgesSet = new Set();
            
            // Collect from discipline-level assignments
            Object.values(judgeSelections).forEach(judgeName => {
                if (judgeName && typeof judgeName === 'string') {
                    assignedJudgesSet.add(judgeName.trim());
                }
            });
            
            // Mark all showDetails.judges as assigned (they're explicitly added for the show)
            Object.values(showDetailsJudgesMap).forEach(list => {
                (list || []).forEach(judge => {
                    if (judge?.name) assignedJudgesSet.add(judge.name.trim());
                });
            });

            // Collect from group-level assignments
            Object.values(groupJudges).forEach(disciplineGroups => {
                if (disciplineGroups && typeof disciplineGroups === 'object' && !Array.isArray(disciplineGroups)) {
                    Object.values(disciplineGroups).forEach(judgeName => {
                        if (judgeName && typeof judgeName === 'string') {
                            assignedJudgesSet.add(judgeName.trim());
                        }
                    });
                } else if (Array.isArray(disciplineGroups)) {
                    disciplineGroups.forEach(judgeName => {
                        if (judgeName && typeof judgeName === 'string') {
                            assignedJudgesSet.add(judgeName.trim());
                        }
                    });
                }
            });
            
            // Build judge cards data for ALL judges
            const judgeCardsList = [];
            
            for (const judgeName of allJudgesSet) {
                const isAssigned = assignedJudgesSet.has(judgeName);
                const judgeAssignments = [];
                
                // Iterate through disciplines to find assignments
                disciplines.forEach((discipline, disciplineIndex) => {
                    const disciplineId = discipline.id || discipline.name || disciplineIndex;
                    const groups = discipline.patternGroups || [];
                    const assignedGroups = [];
                    
                    // Check discipline-level assignment
                    const isDisciplineAssigned = judgeSelections[disciplineIndex]?.toLowerCase().trim() === judgeName.toLowerCase().trim();
                    
                    // Check group-level assignments
                    groups.forEach((group, groupIndex) => {
                        if (!group) return;
                        
                        const groupJudge = groupJudges[disciplineIndex]?.[groupIndex] || 
                                         groupJudges[disciplineIndex]?.[group.id] ||
                                         groupJudges[disciplineIndex]?.[String(groupIndex)];
                        const isGroupAssigned = groupJudge && typeof groupJudge === 'string' && 
                                              groupJudge.toLowerCase().trim() === judgeName.toLowerCase().trim();
                        
                        if (isDisciplineAssigned || isGroupAssigned) {
                            // Get divisions for this group
                            const divisions = Array.isArray(group.divisions) ? group.divisions : [];
                            
                            // Get pattern selection for this group
                            const disciplinePatternSelections = patternSelections[disciplineId] ||
                                                               patternSelections[discipline.name] ||
                                                               patternSelections[disciplineIndex] ||
                                                               patternSelections[String(disciplineIndex)];
                            const judgeCardDiscAbbrev = discipline.association_id
                                ? String(discipline.association_id).toUpperCase()
                                : null;
                            const patternSelection = disciplinePatternSelections
                                ? (getPatternSelectionForAssoc(disciplinePatternSelections, group.id, judgeCardDiscAbbrev)
                                    || getPatternSelectionForAssoc(disciplinePatternSelections, groupIndex, judgeCardDiscAbbrev)
                                    || getPatternSelectionForAssoc(disciplinePatternSelections, String(groupIndex), judgeCardDiscAbbrev))
                                : null;
                            const patternId = typeof patternSelection === 'object' && patternSelection !== null
                                ? (patternSelection.patternId || patternSelection.id) 
                                : patternSelection;
                            
                            // Extract divisions with proper name handling
                            const extractedDivisions = divisions.map(div => {
                                // Handle different division formats
                                if (typeof div === 'string') {
                                    return {
                                        name: div,
                                        association: ''
                                    };
                                } else if (div && typeof div === 'object') {
                                    // Try multiple possible name fields
                                    const divName = div.name || div.divisionName || div.division || div.title || '';
                                    // Get association name from association_id if needed
                                    let assocName = div.association || div.assocName || '';
                                    if (!assocName && div.association_id) {
                                        // Try to get association name from associations map
                                        const assoc = associationsMap[div.association_id];
                                        assocName = assoc?.abbreviation || assoc?.name || div.association_id;
                                    }
                                    return {
                                        name: divName,
                                        association: assocName || div.assocId || ''
                                    };
                                } else {
                                    return {
                                        name: String(div || ''),
                                        association: ''
                                    };
                                }
                            }).filter(div => div.name && div.name.trim() !== ''); // Filter out empty divisions
                            
                            assignedGroups.push({
                                groupName: group.name || `Group ${groupIndex + 1}`,
                                divisions: extractedDivisions,
                                patternId: patternId && !isNaN(parseInt(patternId)) ? parseInt(patternId) : null
                            });
                        }
                    });
                    
                    if (assignedGroups.length > 0) {
                        judgeAssignments.push({
                            disciplineName: discipline.name,
                            groups: assignedGroups
                        });
                    }
                });
                
                // Add judge card whether assigned or not
                judgeCardsList.push({
                    judgeName,
                    isAssigned,
                    assignments: judgeAssignments.length > 0 ? judgeAssignments : []
                });
            }
            
            // Fetch pattern details for all pattern IDs
            const allPatternIds = new Set();
            judgeCardsList.forEach(judgeCard => {
                judgeCard.assignments.forEach(assignment => {
                    assignment.groups.forEach(group => {
                        if (group.patternId) {
                            allPatternIds.add(group.patternId);
                        }
                    });
                });
            });
            
            let patternDetailsMap = {};
            let patternImageMap = {};
            
            if (allPatternIds.size > 0) {
                // Fetch pattern details
                const { data: patternData, error: patDetailError } = await supabase
                    .from('tbl_patterns')
                    .select('id, pdf_file_name, pattern_version, discipline')
                    .in('id', Array.from(allPatternIds));
                
                if (!patDetailError && patternData) {
                    patternData.forEach(p => {
                        patternDetailsMap[p.id] = p;
                    });
                }
                
                // Fetch pattern images
                const { data: patternMediaData, error: patMediaError } = await supabase
                    .from('tbl_pattern_media')
                    .select('pattern_id, image_url')
                    .in('pattern_id', Array.from(allPatternIds));
                
                if (!patMediaError && patternMediaData) {
                    patternMediaData.forEach(pm => {
                        if (!patternImageMap[pm.pattern_id]) {
                            patternImageMap[pm.pattern_id] = pm.image_url;
                        }
                    });
                }
            }
            
            // Add pattern names and images to judge cards
            judgeCardsList.forEach(judgeCard => {
                judgeCard.assignments.forEach(assignment => {
                    assignment.groups.forEach(group => {
                        if (group.patternId && patternDetailsMap[group.patternId]) {
                            group.patternName = patternDetailsMap[group.patternId].pdf_file_name;
                            group.patternVersion = patternDetailsMap[group.patternId].pattern_version;
                            group.patternImageUrl = patternImageMap[group.patternId] || null;
                        }
                    });
                });
            });
            
            setJudgeCards(judgeCardsList);
        } catch (error) {
            console.error('Error fetching judge cards:', error);
            toast({
                title: 'Error',
                description: 'Failed to load judge cards.',
                variant: 'destructive'
            });
        } finally {
            setIsLoadingJudgeCards(false);
        }
    };

    const handleOpenJudgeCards = () => {
        setJudgeCardsDialogOpen(true);
        fetchJudgeCards();
    };

    return (
        <>
            <div 
                className="border rounded-lg overflow-hidden bg-transparent mb-4"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Folder Header */}
                <div 
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${!coverColor ? 'bg-muted border-b' : ''}`}
                    style={coverColor ? { backgroundColor: coverColor } : undefined}
                >
                    <div 
                        className="flex items-center gap-3 flex-1"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? (
                            <ChevronDown className={`h-5 w-5 ${coverColor ? 'text-white/80' : 'text-muted-foreground'}`} />
                        ) : (
                            <ChevronRight className={`h-5 w-5 ${coverColor ? 'text-white/80' : 'text-muted-foreground'}`} />
                        )}
                        <Folder className={`h-5 w-5 ${coverColor ? 'text-white' : 'text-primary'}`} />
                        <span className={`font-semibold ${coverColor ? 'text-white' : 'text-foreground'}`}>{project.project_name || 'Untitled Project'}</span>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 transition-opacity duration-200 ${coverColor ? 'text-white hover:bg-white/20' : 'text-muted-foreground hover:bg-muted'} ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {!allJudgesLockedOrPublished && !isPastPatternPortal && (
                                <DropdownMenuItem onClick={() => handleMenuAction('open')}>
                                    <Pencil className="mr-2 h-4 w-4" /> Open card
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleMenuAction('preview')}>
                                <Eye className="mr-2 h-4 w-4" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMenuAction('cover')}>
                                <ImageIcon className="mr-2 h-4 w-4" /> Change cover
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                
                {/* Expanded Content - Navigation Sections and Judge Cards */}
                {isExpanded && (
                    <div className="px-4 pb-4 pt-3 space-y-3 bg-background">
                        {/* Status Changer - Visible Button */}
                        <div className="mb-4 p-3 rounded-lg border border-border bg-muted/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Status:</span>
                                    <Badge 
                                        variant="outline"
                                        className={cn(
                                            "font-medium",
                                            selectedStatus === 'Draft' 
                                                ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                                                : selectedStatus === 'Approval and Locked'
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                                                : "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                                        )}
                                    >
                                        {selectedStatus === 'Approval and Locked' ? 'Lock & Approve Mode' : selectedStatus}
                                    </Badge>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setStatusDialogOpen(true);
                                    }}
                                    className="h-8"
                                >
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                    Change Status
                                </Button>
                            </div>
                        </div>
                        
                        {/* Navigation Sections */}
                        <div className="space-y-2 mb-4">
                            <div className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setStatusDialogOpen(true);
                                    }}
                                    className="h-8 w-8 hover:bg-primary hover:text-primary-foreground shrink-0"
                                    title="Change Status"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenScoreSheets();
                                    }}
                                    className="flex-1 text-left"
                                >
                                    <span className="text-foreground font-medium">Score Sheets</span>
                                </button>
                            </div>
                            <div className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setStatusDialogOpen(true);
                                    }}
                                    className="h-8 w-8 hover:bg-primary hover:text-primary-foreground shrink-0"
                                    title="Change Status"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenPatterns();
                                    }}
                                    className="flex-1 text-left"
                                >
                                    <span className="text-foreground font-medium">Patterns</span>
                                </button>
                            </div>
                            <div className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setStatusDialogOpen(true);
                                    }}
                                    className="h-8 w-8 hover:bg-primary hover:text-primary-foreground shrink-0"
                                    title="Change Status"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenJudgeCards();
                                    }}
                                    className="flex-1 text-left"
                                >
                                    <span className="text-foreground font-medium">Judge Cards</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <CoverColorDialog
                open={coverDialogOpen}
                onClose={() => setCoverDialogOpen(false)}
                currentColor={coverColor}
                onSelectColor={handleSelectColor}
                onRemoveCover={handleRemoveCover}
            />
            <DueDateDialog
                open={dueDateDialogOpen}
                onClose={() => setDueDateDialogOpen(false)}
                currentDate={dueDate}
                onSaveDate={handleSaveDueDate}
            />
            
            {/* Score Sheets Dialog */}
            <Dialog open={scoreSheetsDialogOpen} onOpenChange={setScoreSheetsDialogOpen}>
                <DialogContent className="sm:max-w-6xl max-h-[95vh] p-0 flex flex-col bg-white">
                    {/* Announced by screen readers; the visible heading below is a
                        styled <h2>, which Radix cannot use as the dialog's name. */}
                    <DialogTitle className="sr-only">Score Sheets</DialogTitle>
                    {/* Header Section */}
                    <div className="text-center border-b border-gray-300 px-6 py-4 bg-white">
                        <h2 className="text-2xl font-bold text-black mb-1">
                            {project.project_name || 'Pattern Book'}
                        </h2>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">
                            Score Sheet Details
                        </h3>
                        {project.project_data?.startDate && (
                            <p className="text-xs text-gray-500 mt-1">
                                Show Date: {format(parseLocalDate(project.project_data.startDate), 'MM-dd-yyyy')}
                            </p>
                        )}
                    </div>
                    
                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
                        {isLoadingScoreSheets ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="ml-3 text-muted-foreground">Loading score sheets...</span>
                            </div>
                        ) : scoreSheets.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4 items-start">
                                {scoreSheets.map((scoresheet, index) => (
                                    <div 
                                        key={scoresheet.id || index} 
                                        className="border border-gray-300 bg-white overflow-hidden flex flex-col h-full"
                                    >
                                        {/* Pattern Title */}
                                        <div className="bg-gray-50 border-b border-gray-300 px-3 py-3 text-center min-h-[80px] flex flex-col justify-center">
                                            <p className="font-semibold text-sm text-black">
                                                {scoresheet.disciplineName || scoresheet.discipline || 'Score Sheet'}
                                            </p>
                                            {scoresheet.groupName && (
                                                <p className="text-xs text-gray-600 mt-0.5 font-medium">
                                                    {scoresheet.groupName}
                                                </p>
                                            )}
                                            {/* Divisions per Group */}
                                            {scoresheet.divisions && scoresheet.divisions.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap justify-center gap-1">
                                                    {scoresheet.divisions.map((division, divIndex) => {
                                                        const divName = division?.name || '';
                                                        const divAssoc = division?.association || '';
                                                        if (!divName || divName.trim() === '') return null;
                                                        return (
                                                            <span 
                                                                key={`div-${divIndex}`}
                                                                className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                                                            >
                                                                {divName}
                                                                {divAssoc && ` (${divAssoc})`}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="mt-2 h-5"></div>
                                            )}
                                        </div>
                                        
                                        {/* Pattern Image */}
                                        <div className="relative bg-white p-4 min-h-[400px] flex items-center justify-center flex-1">
                                            {scoresheet.image_url ? (
                                                <img
                                                    src={scoresheet.image_url}
                                                    alt={scoresheet.file_name || scoresheet.discipline || 'Score Sheet'}
                                                    className="max-w-full max-h-[500px] object-contain cursor-pointer hover:opacity-95 transition-opacity"
                                                    onClick={() => window.open(scoresheet.image_url, '_blank')}
                                                />
                                            ) : (
                                                <div className="w-full h-64 bg-gray-100 flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-300">
                                                    No image available
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Footer Info */}
                                        <div className="bg-gray-50 border-t border-gray-300 px-3 py-2 text-center">
                                            <p className="text-xs text-gray-600">
                                                {scoresheet.file_name || scoresheet.discipline || 'Score Sheet'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No score sheets found for this pattern book.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* Patterns Dialog */}
            <Dialog open={patternsDialogOpen} onOpenChange={setPatternsDialogOpen}>
                <DialogContent className="sm:max-w-6xl max-h-[95vh] p-0 flex flex-col bg-white">
                    <DialogTitle className="sr-only">Patterns</DialogTitle>
                    {/* Header Section */}
                    <div className="text-center border-b border-gray-300 px-6 py-4 bg-white">
                        <h2 className="text-2xl font-bold text-black mb-1">
                            {project.project_name || 'Pattern Book'}
                        </h2>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">
                            Pattern Details
                        </h3>
                        {project.project_data?.startDate && (
                            <p className="text-xs text-gray-500 mt-1">
                                Show Date: {format(parseLocalDate(project.project_data.startDate), 'MM-dd-yyyy')}
                            </p>
                        )}
                    </div>
                    
                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
                        {isLoadingPatterns ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="ml-3 text-muted-foreground">Loading patterns...</span>
                            </div>
                        ) : patterns.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4">
                                {patterns.map((pattern, index) => (
                                    <div 
                                        key={`${pattern.patternId}-${index}`} 
                                        className="border border-gray-300 bg-white overflow-hidden"
                                    >
                                        {/* Pattern Title */}
                                        <div className="bg-gray-50 border-b border-gray-300 px-3 py-2 text-center">
                                            <p className="font-semibold text-sm text-black">
                                                {pattern.disciplineName || pattern.discipline || 'Pattern'}
                                            </p>
                                            {pattern.groupName && (
                                                <p className="text-xs text-gray-600 mt-0.5 font-medium">
                                                    {pattern.groupName}
                                                </p>
                                            )}
                                            {/* Divisions per Group */}
                                            {pattern.divisions && pattern.divisions.length > 0 && (
                                                <div className="mt-2 flex flex-wrap justify-center gap-1">
                                                    {pattern.divisions.map((division, divIndex) => {
                                                        const divName = division?.name || '';
                                                        const divAssoc = division?.association || '';
                                                        if (!divName || divName.trim() === '') return null;
                                                        return (
                                                            <span 
                                                                key={`div-${divIndex}`}
                                                                className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                                                            >
                                                                {divName}
                                                                {divAssoc && ` (${divAssoc})`}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Pattern Image */}
                                        <div className="relative bg-white p-4 min-h-[400px] flex items-center justify-center">
                                            {pattern.imageUrl ? (
                                                <img
                                                    src={pattern.imageUrl}
                                                    alt={pattern.patternName || 'Pattern'}
                                                    className="max-w-full max-h-[500px] object-contain cursor-pointer hover:opacity-95 transition-opacity"
                                                    onClick={() => window.open(pattern.imageUrl, '_blank')}
                                                />
                                            ) : (
                                                <div className="w-full h-64 bg-gray-100 flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-300">
                                                    No image available
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Footer Info */}
                                        <div className="bg-gray-50 border-t border-gray-300 px-3 py-2 text-center">
                                            <p className="text-xs text-gray-600">
                                                {pattern.patternName || `Pattern ${pattern.patternId}`}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No patterns found for this pattern book.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* Judge Cards Dialog */}
            <Dialog open={judgeCardsDialogOpen} onOpenChange={setJudgeCardsDialogOpen}>
                <DialogContent className="sm:max-w-6xl max-h-[95vh] p-0 flex flex-col bg-white">
                    <DialogTitle className="sr-only">Judge Cards</DialogTitle>
                    {/* Header Section */}
                    <div className="text-center border-b border-gray-300 px-6 py-4 bg-white">
                        <h2 className="text-2xl font-bold text-black mb-1">
                            {project.project_name || 'Pattern Book'}
                        </h2>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">
                            Judges Details
                        </h3>
                        {project.project_data?.startDate && (
                            <p className="text-xs text-gray-500 mt-1">
                                Show Date: {format(parseLocalDate(project.project_data.startDate), 'MM-dd-yyyy')}
                            </p>
                        )}
                    </div>
                    
                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
                        {isLoadingJudgeCards ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="ml-3 text-muted-foreground">Loading judge cards...</span>
                            </div>
                        ) : judgeCards.length > 0 ? (
                            <div className="space-y-8">
                                {judgeCards.map((judgeCard, judgeIndex) => (
                                    <div 
                                        key={`judge-${judgeIndex}`} 
                                        className="border border-gray-300 bg-white rounded-lg overflow-hidden"
                                    >
                                        {/* Judge Name Header - Prominent */}
                                        <div className="bg-white border-b-2 border-gray-300 px-6 py-4 flex items-center justify-between">
                                            <h3 className="text-2xl font-bold text-black">
                                                {judgeCard.judgeName}
                                            </h3>
                                            {judgeCard.isAssigned ? (
                                                <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                                    Assigned
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                                    Not Assigned
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Judge Assignments */}
                                        <div className="p-6 space-y-6">
                                            {judgeCard.assignments.length > 0 ? (
                                                judgeCard.assignments.map((assignment, assignmentIndex) => (
                                                <div 
                                                    key={`assignment-${assignmentIndex}`}
                                                    className="space-y-4"
                                                >
                                                    {/* Discipline Name */}
                                                    <h4 className="text-xl font-semibold text-black">
                                                        {assignment.disciplineName}
                                                    </h4>
                                                    
                                                    {/* Groups - Horizontal Layout */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {assignment.groups.map((group, groupIndex) => (
                                                            <div 
                                                                key={`group-${groupIndex}`}
                                                                className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col"
                                                            >
                                                                {/* Group Name */}
                                                                <div className="mb-3">
                                                                    <p className="font-semibold text-base text-gray-900">
                                                                        {group.groupName}
                                                                    </p>
                                                                </div>
                                                                
                                                                {/* Divisions - Per Group */}
                                                                <div className="mb-3">
                                                                    <p className="text-xs font-medium text-gray-600 mb-2">Divisions:</p>
                                                                    {group.divisions && group.divisions.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {group.divisions.map((division, divIndex) => {
                                                                                const divName = division?.name || division || '';
                                                                                const divAssoc = division?.association || '';
                                                                                if (!divName || divName.trim() === '') return null;
                                                                                return (
                                                                                    <span 
                                                                                        key={`div-${divIndex}`}
                                                                                        className="inline-block px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                                                                                    >
                                                                                        {divName}
                                                                                        {divAssoc && ` (${divAssoc})`}
                                                                                    </span>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-gray-400 italic">No divisions assigned</p>
                                                                    )}
                                                                </div>
                                                                
                                                                {/* Pattern Image and Name */}
                                                                {group.patternId && (
                                                                    <div className="mt-auto">
                                                                        {group.patternImageUrl ? (
                                                                            <div className="space-y-2">
                                                                                <img
                                                                                    src={group.patternImageUrl}
                                                                                    alt={group.patternName || `Pattern ${group.patternId}`}
                                                                                    className="w-full h-auto border border-gray-200 rounded cursor-pointer hover:opacity-90 transition-opacity"
                                                                                    onClick={() => window.open(group.patternImageUrl, '_blank')}
                                                                                />
                                                                                <div className="text-center">
                                                                                    <p className="text-sm text-gray-900 font-semibold">
                                                                                        {group.patternName || `Pattern ${group.patternId}`}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-center border border-gray-200 rounded p-4 bg-white">
                                                                                <p className="text-sm text-gray-900 font-semibold">
                                                                                    {group.patternName || `Pattern ${group.patternId}`}
                                                                                </p>
                                                                                <p className="text-xs text-gray-400 mt-2">No image available</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-8 text-gray-500">
                                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                                    <p className="text-sm">No assignments for this judge</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No judge assignments found for this pattern book.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* Status Change Dialog */}
            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Change Pattern Status</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Select the status for this pattern book:
                        </p>
                        <div className="space-y-2">
                            {(() => {
                                // Status flow is fully bidirectional: Draft ↔ Locked ↔ Publication.
                                // An organizer can roll a Published book back to Draft to edit, then re-publish.
                                const draftDisabled = false;
                                const lockedDisabled = false;
                                return (
                                    <>
                                        <button
                                            onClick={() => !draftDisabled && setSelectedStatus('Draft')}
                                            disabled={draftDisabled}
                                            className={cn(
                                                "w-full text-left p-3 rounded-lg border-2 transition-colors",
                                                selectedStatus === 'Draft'
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:bg-muted/50",
                                                draftDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                                            )}
                                        >
                                            <div className="font-medium text-foreground">Draft</div>
                                            <div className="text-sm text-muted-foreground mt-1">Pattern is in draft mode</div>
                                        </button>
                                        <button
                                            onClick={() => !lockedDisabled && setSelectedStatus('Approval and Locked')}
                                            disabled={lockedDisabled}
                                            className={cn(
                                                "w-full text-left p-3 rounded-lg border-2 transition-colors",
                                                selectedStatus === 'Approval and Locked'
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:bg-muted/50",
                                                lockedDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                                            )}
                                        >
                                            <div className="font-medium text-foreground">Approval and Locked</div>
                                            <div className="text-sm text-muted-foreground mt-1">Pattern is locked and ready for approval</div>
                                        </button>
                                        <button
                                            onClick={() => setSelectedStatus('Publication')}
                                            className={cn(
                                                "w-full text-left p-3 rounded-lg border-2 transition-colors",
                                                selectedStatus === 'Publication'
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:bg-muted/50"
                                            )}
                                        >
                                            <div className="font-medium text-foreground">Publication</div>
                                            <div className="text-sm text-muted-foreground mt-1">Pattern is published and available</div>
                                        </button>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button 
                                variant="outline" 
                                className="flex-1" 
                                onClick={() => setStatusDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button 
                                className="flex-1" 
                                onClick={handleSaveStatus} 
                                disabled={isSavingStatus}
                            >
                                {isSavingStatus ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

// Active Pattern Book Card Component - matches the image design
const ActivePatternBookCard = ({ project, onRefresh, profile, user }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isHovered, setIsHovered] = useState(false);
    const [associationsData, setAssociationsData] = useState([]);
    const [patternBookDialogOpen, setPatternBookDialogOpen] = useState(false);
    const [dialogInitialTab, setDialogInitialTab] = useState('patternBook');
    const [patternsList, setPatternsList] = useState([]);
    const [isLoadingPatternsList, setIsLoadingPatternsList] = useState(false);
    
    const projectData = project.project_data || {};
    const editPath = `/pattern-book-builder/${project.id}`;
    const coverColor = projectData.coverColor || 'hsl(var(--primary))';
    
    // Fetch associations data
    useEffect(() => {
        const fetchAssociations = async () => {
            const { data } = await supabase
                .from('associations')
                .select('id, abbreviation, name, logo')
                .order('name');
            if (data) {
                // Process logos - check if logo is a URL or needs to be constructed
                const processedData = data.map(assoc => ({
                    ...assoc,
                    logo_url: assoc.logo && typeof assoc.logo === 'string' && assoc.logo.startsWith('http') ? assoc.logo : null
                }));
                setAssociationsData(processedData);
            }
        };
        fetchAssociations();
    }, []);
    
    // Extract people data
    const getPeopleData = () => {
        // adminOwner is sometimes a string, sometimes an object { adminName, ownerName, ... }
        // depending on which builder step wrote it. Normalize to a string.
        const ownerRaw = projectData.adminOwner;
        const ownerFromObject = ownerRaw && typeof ownerRaw === 'object'
            ? (ownerRaw.ownerName || ownerRaw.adminName || '')
            : '';
        const owner = (typeof ownerRaw === 'string' ? ownerRaw : ownerFromObject)
            || profile?.full_name || user?.email || 'Not set';

        const secondAdminRaw = projectData.secondAdmin;
        const adminFromObject = secondAdminRaw && typeof secondAdminRaw === 'object'
            ? (secondAdminRaw.adminName || secondAdminRaw.name || '')
            : '';
        const admin = (typeof secondAdminRaw === 'string' ? secondAdminRaw : adminFromObject)
            || projectData.officials?.find(o => o.role === 'admin')?.name || 'Not set';
        
        // Count judges from associationJudges + showDetails.judges + patternSelections
        const judgeNames = new Set();
        Object.values(projectData.associationJudges || {}).forEach(assocData => {
            const judges = assocData?.judges || (Array.isArray(assocData) ? assocData : []);
            if (Array.isArray(judges)) judges.forEach(j => { if (j?.name) judgeNames.add(j.name.trim()); });
        });
        // From showDetails.judges (Step 4 "Number of Judges" UI — canonical storage)
        Object.values(projectData.showDetails?.judges || {}).forEach(list => {
            (list || []).forEach(j => { if (j?.name) judgeNames.add(j.name.trim()); });
        });
        // From patternSelections (judges assigned at discipline level in Step 5)
        Object.values(projectData.patternSelections || {}).forEach(disciplineSels => {
            if (disciplineSels && typeof disciplineSels === 'object') {
                forEachPatternSelection(disciplineSels, (_g, _a, sel) => {
                    if (sel?.type === 'judgeAssigned' && sel?.judgeName?.trim()) {
                        judgeNames.add(sel.judgeName.trim());
                    }
                });
            }
        });
        const judgesCount = judgeNames.size;
        
        // Count staff from officials (excluding judges)
        const officials = projectData.officials || [];
        const staffCount = officials.filter(o => o.role !== 'judge' && o.role !== 'admin').length;
        
        return { owner, admin, judgesCount, staffCount };
    };
    
    const { owner, admin, judgesCount, staffCount } = getPeopleData();
    
    // Get selected associations - they're stored by abbreviation in projectData.associations
    const selectedAssociations = Object.keys(projectData.associations || {}).filter(key => projectData.associations[key]);
    const affiliations = associationsData.filter(a => 
        selectedAssociations.includes(a.id) || selectedAssociations.includes(a.abbreviation)
    );
    
    const handleContinueEditing = () => {
        navigate(editPath);
    };
    
    // Format status for display - map to dropdown options (supports both old and new values)
    const getDisplayStatus = () => {
        const status = (project.status || '').toString().trim();
        if (status === 'Locked' || status === 'Lock & Approve Mode') {
            return 'Lock & Approve Mode';
        }
        if (status === 'Final' || status === 'Publication') {
            return 'Publication';
        }
        if (status.toLowerCase() === 'in progress') {
            return 'In progress';
        }
        return 'Draft';
    };

    const displayStatus = getDisplayStatus();

    const handleStatusChange = async (newStatus) => {
        try {
            // Map display values to unified DB values
            const dbStatus = newStatus === 'Lock & Approve Mode' ? 'Locked' : newStatus === 'Publication' ? 'Final' : newStatus;
            await supabase
                .from('projects')
                .update({ status: dbStatus })
                .eq('id', project.id);
            toast({
                title: "Status updated",
                description: `Status changed to ${newStatus === 'Lock & Approve Mode' ? 'Apprvd & Locked' : newStatus}`
            });
            if (onRefresh) onRefresh();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update status",
                variant: "destructive"
            });
        }
    };

    // Taking a book *off* Published removes it from the public Events page, so confirm first.
    const [pendingStatus, setPendingStatus] = useState(null);
    const requestStatusChange = (newStatus) => {
        if (newStatus === displayStatus) return;
        if (displayStatus === 'Publication' && newStatus !== 'Publication') {
            setPendingStatus(newStatus);
            return;
        }
        handleStatusChange(newStatus);
    };

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleArchive = async () => {
        try {
            await supabase
                .from('projects')
                .update({ mode: 'archived' })
                .eq('id', project.id);
            toast({
                title: "Project archived",
                description: "Project has been archived successfully"
            });
            if (onRefresh) onRefresh();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to archive project",
                variant: "destructive"
            });
        }
    };

    const handleDeleteProject = async () => {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', project.id);

        if (!error) {
            toast({ title: "Project deleted", description: "Project has been permanently deleted" });
            setDeleteDialogOpen(false);
            if (onRefresh) onRefresh();
        } else {
            toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full relative group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Back paper layers - 3D effect */}
            <div className="absolute top-3 left-2 right-0 bottom-0 z-0">
                {/* Third layer (furthest back) */}
                <div 
                    className="absolute inset-0 rounded-lg border-2 bg-card/30 translate-x-2 translate-y-2"
                    style={{ borderColor: coverColor }}
                />
                {/* Second layer */}
                <div 
                    className="absolute inset-0 rounded-lg border-2 bg-card/50 translate-x-1 translate-y-1"
                    style={{ borderColor: coverColor }}
                />
            </div>

            {/* Folder Tab - small tab on left */}
            <div className="flex items-end relative z-20">
                <div 
                    className="h-5 w-16 rounded-t-md border-2 border-b-0 bg-card/80"
                    style={{ borderColor: coverColor }}
                />
                {/* Slanted edge connector */}
                <svg 
                    className="h-5 w-4 -ml-px"
                    viewBox="0 0 16 20" 
                    fill="none"
                >
                    <path 
                        d="M0 0 L16 20 L0 20 Z" 
                        className="fill-card/80"
                    />
                    <path 
                        d="M0 0 L16 20" 
                        stroke={coverColor} 
                        strokeWidth="2"
                    />
                </svg>
            </div>
            
            {/* Folder Body - main front panel */}
            <div 
                className="flex-grow rounded-lg rounded-tl-none shadow-xl overflow-hidden relative bg-card/90 backdrop-blur-sm border-2 z-20"
                style={{ borderColor: coverColor }}
            >
                {/* Header Section */}
                <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-1">
                            <BookCopy className="h-5 w-5 text-primary shrink-0" />
                            <h3 className="text-lg font-bold text-foreground">
                                {projectData.showNumber 
                                    ? `${project.project_name || 'Untitled Project'} - ${projectData.showNumber}`
                                    : project.project_name || 'Untitled Project'}
                            </h3>
                        </div>
                        {/* Horse Show Logo Placeholder */}
                        <div className="w-16 h-16 bg-primary/10 border-2 border-primary/30 rounded-full flex items-center justify-center">
                            <BookCopy className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    
                    {/* Tabs */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => { setDialogInitialTab('patternBook'); setPatternBookDialogOpen(true); }}
                            className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary/90 cursor-pointer"
                        >
                            Pattern Books & Score Sheets
                        </button>
                        <button
                            onClick={() => { setDialogInitialTab('results'); setPatternBookDialogOpen(true); }}
                            className="px-3 py-1.5 bg-transparent border border-primary/30 text-muted-foreground text-sm font-medium rounded-full hover:bg-primary/20 cursor-pointer"
                        >
                            Results
                        </button>
                    </div>
                </div>
                
                {/* Main Content - Two Columns */}
                <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column - People */}
                    <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3">People:</h4>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <Users className="h-4 w-4 text-primary shrink-0" />
                                <span className="text-muted-foreground">Owner</span>
                                <span className="font-medium text-foreground ml-auto">{owner}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Users className="h-4 w-4 text-primary shrink-0" />
                                <span className="text-muted-foreground">Admin</span>
                                <span className="font-medium text-foreground ml-auto">{admin}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <div className="relative">
                                    <Users className="h-4 w-4 text-primary shrink-0" />
                                    <span className="absolute -top-1 -right-1 text-[8px] text-primary">*</span>
                                </div>
                                <span className="text-muted-foreground">Judges</span>
                                <span className="font-medium text-foreground ml-auto">{judgesCount} Assigned</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <div className="relative">
                                    <Users className="h-4 w-4 text-primary shrink-0" />
                                    <span className="absolute -top-1 -right-1 text-[8px] text-primary">*</span>
                                </div>
                                <span className="text-muted-foreground">Staff</span>
                                <span className="font-medium text-foreground ml-auto">{staffCount} Assigned</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Right Column - Affiliations */}
                    <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3">Affiliated with:</h4>
                        <div className="flex flex-wrap gap-2">
                            {affiliations.length > 0 ? (
                                affiliations.map(assoc => {
                                    // Check if logo is a URL or needs to be constructed
                                    const logoUrl = assoc.logo_url || (assoc.logo && typeof assoc.logo === 'string' && assoc.logo.startsWith('http') ? assoc.logo : null);
                                    // If only one association, make logo bigger
                                    const isSingleAssociation = affiliations.length === 1;
                                    return (
                                        <div key={assoc.id} className="flex items-center">
                                            {logoUrl ? (
                                                <img 
                                                    src={logoUrl} 
                                                    alt={assoc.name} 
                                                    className={isSingleAssociation 
                                                        ? "h-12 w-auto max-w-[180px] object-contain" 
                                                        : "h-8 w-auto max-w-[120px] object-contain"
                                                    } 
                                                />
                                            ) : (
                                                <div className={isSingleAssociation 
                                                    ? "h-12 px-4 bg-primary/20 border border-primary/30 rounded flex items-center" 
                                                    : "h-8 px-3 bg-primary/20 border border-primary/30 rounded flex items-center"
                                                }>
                                                    <span className={isSingleAssociation 
                                                        ? "text-sm font-medium text-primary" 
                                                        : "text-xs font-medium text-primary"
                                                    }>{assoc.abbreviation || assoc.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-sm text-muted-foreground">No affiliations</p>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Footer Section */}
                <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-muted-foreground">
                            Last saved: {format(new Date(project.updated_at), "MMM d, yyyy")}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Status:</span>
                            <Select value={displayStatus} onValueChange={requestStatusChange}>
                                <SelectTrigger className="w-36 h-9 text-sm">
                                    <SelectValue>
                                        {displayStatus === 'Lock & Approve Mode' ? 'Apprvd & Locked' : displayStatus === 'Publication' ? 'Published' : displayStatus}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {/* Fully bidirectional — roll back to Draft from any status to edit. */}
                                    <SelectItem value="Draft">
                                        Draft
                                    </SelectItem>
                                    <SelectItem value="Lock & Approve Mode">
                                        Apprvd & Locked
                                    </SelectItem>
                                    <SelectItem value="Publication">
                                        Published
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <ConfirmationDialog
                                isOpen={!!pendingStatus}
                                onClose={() => setPendingStatus(null)}
                                onConfirm={() => { const s = pendingStatus; setPendingStatus(null); handleStatusChange(s); }}
                                title="Unpublish this pattern book?"
                                description="It will be removed from the public Events page and visitors won't be able to view it. You can publish it again anytime."
                                confirmText="Yes, unpublish"
                                cancelText="Cancel"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        {/* Continue Editing Button - Only show when status is Draft */}
                        {displayStatus === 'Draft' && (
                            <Button 
                                onClick={handleContinueEditing} 
                                className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium"
                            >
                                Continue Editing <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                        {/* Archive Button - Show for all projects */}
                        <Button
                            onClick={handleArchive}
                            variant="outline"
                            size="sm"
                        >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                        </Button>
                        {/* Delete Button */}
                        <Button
                            onClick={() => setDeleteDialogOpen(true)}
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                </div>
            </div>

            {/* Delete Project Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Project</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{project.project_name || 'Untitled Project'}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteProject}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Pattern Book Dialog */}
            <Dialog open={patternBookDialogOpen} onOpenChange={setPatternBookDialogOpen}>
                <DialogContent className="w-[95vw] h-screen max-w-none max-h-none p-0 m-0 rounded-none overflow-hidden">
                    <DialogTitle className="sr-only">Pattern Books &amp; Score Sheets</DialogTitle>
                    <PatternBookDialogContent
                        project={project}
                        profile={profile}
                        user={user}
                        associationsData={associationsData}
                        onClose={() => setPatternBookDialogOpen(false)}
                        onRefresh={onRefresh}
                        initialTab={dialogInitialTab}
                    />
                </DialogContent>
            </Dialog>
        </motion.div>
    );
};

const ProjectCard = ({ project, menuType = 'full', onRefresh, isPastPatternPortal = false, isInProgressPortal = false }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [coverDialogOpen, setCoverDialogOpen] = useState(false);
    const [dueDateDialogOpen, setDueDateDialogOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [coverColor, setCoverColor] = useState(project.project_data?.coverColor || null);
    const [dueDate, setDueDate] = useState(project.project_data?.dueDate || null);
    const [isHovered, setIsHovered] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [patternDetailDialogOpen, setPatternDetailDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const isPatternBook = project.project_type === 'pattern_book';
    const isPatternFolder = project.project_type === 'pattern_folder';
    const isPatternHub = project.project_type === 'pattern_hub';
    const isPatternUpload = project.project_type === 'pattern_upload';
    const editPath = isPatternBook
        ? `/pattern-book-builder/${project.id}`
        : isPatternFolder
        ? `/pattern-folder/${project.id}`
        : isPatternHub
        ? `/pattern-hub/${project.id}`
        : isPatternUpload
        ? `/upload-patterns/edit/${project.id}`
        : `/horse-show-manager/edit/${project.id}`;
    
    // Check if project is locked (supports both old and new status values)
    const isLocked = project.status === 'Locked' || project.status === 'Lock & Approve Mode' || project.status === 'Final' || project.status === 'Publication';

    // Handle continue editing button click
    const handleContinueEditing = () => {
        if (isLocked) {
            toast({
                variant: "destructive",
                title: "Pattern Book Locked",
                description: "This project is locked. You cannot edit it.",
            });
            return;
        }
        
        // For pattern_hub projects, navigate directly to PatternHub
        if (isPatternHub) {
            navigate(editPath);
            return;
        }
        
        // For other project types, open detail modal
        setDetailModalOpen(true);
    };

    const handleDownloadFolder = async () => {
        if (isDownloading) return;
        
        setIsDownloading(true);
        toast({ 
            title: "Download started", 
            description: "Preparing your folder for download. This may take a moment..." 
        });

        try {
            const projectData = project.project_data || {};
            const projectName = project.name || projectData.showName || 'Pattern_Book';
            
            await downloadPatternBookFolder(projectData, projectName, (progress) => {
            });
            
            toast({ 
                title: "Download complete", 
                description: "Your pattern book folder has been downloaded successfully." 
            });
        } catch (error) {
            console.error('Download error:', error);
            toast({ 
                title: "Download failed", 
                description: "There was an error preparing your download. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsDownloading(false);
        }
    };

    // Helper: convert data URI to Blob for reliable downloads
    const dataUriToBlob = (dataUri) => {
        const [header, base64] = dataUri.split(',');
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    };

    const triggerBlobDownload = (blob, fileName) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    };

    const handlePatternExport = async (exportType) => {
        const projectData = project.project_data || {};
        const fileName = (project.project_name || projectData.showName || 'Pattern').replace(/ /g, '_');

        try {
            if (exportType === 'pdf') {
                toast({ title: 'Generating PDF...', description: 'Preparing your pattern.' });
                const pdfDataUri = await generatePatternBookPdf(projectData);
                const blob = dataUriToBlob(pdfDataUri);
                triggerBlobDownload(blob, `${fileName}.pdf`);
                toast({ title: 'Downloaded!', description: 'Your pattern PDF has been downloaded.' });
            } else if (exportType === 'png') {
                toast({ title: 'Generating PNG...', description: 'Converting to image.' });
                const { default: pdfjsLib } = await import('pdfjs-dist');
                const { default: pdfjsWorkerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
                pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
                const pdfDataUri = await generatePatternBookPdf(projectData);
                const pdfDoc = await pdfjsLib.getDocument(pdfDataUri).promise;
                let targetPageNum = 1;
                for (let p = 1; p <= Math.min(pdfDoc.numPages, 3); p++) {
                    const testPage = await pdfDoc.getPage(p);
                    const textContent = await testPage.getTextContent();
                    if (textContent.items.length > 0) { targetPageNum = p; break; }
                }
                const page = await pdfDoc.getPage(targetPageNum);
                const viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;
                ctx.save();
                ctx.font = '12px Helvetica, Arial, sans-serif';
                ctx.fillStyle = 'rgba(120, 120, 120, 0.7)';
                ctx.textAlign = 'right';
                ctx.fillText('Generated by EQ Patterns', canvas.width - 20, canvas.height - 14);
                ctx.restore();
                const pngDataUri = canvas.toDataURL('image/png');
                const pngBlob = dataUriToBlob(pngDataUri);
                triggerBlobDownload(pngBlob, `${fileName}.png`);
                toast({ title: 'Downloaded!', description: 'Your pattern PNG has been downloaded.' });
            } else if (exportType === 'print') {
                toast({ title: 'Preparing to print...', description: 'Opening print dialog.' });
                const pdfDataUri = await generatePatternBookPdf(projectData);
                const blob = dataUriToBlob(pdfDataUri);
                const blobUrl = URL.createObjectURL(blob);
                const printWindow = window.open(blobUrl, '_blank');
                if (printWindow) {
                    printWindow.addEventListener('afterprint', () => URL.revokeObjectURL(blobUrl));
                    printWindow.addEventListener('load', () => setTimeout(() => printWindow.print(), 500));
                }
            } else if (exportType === 'email') {
                setEmailDialogOpen(true);
                return; // Dialog handles the rest
            } else if (exportType === 'share') {
                const shareUrl = `${window.location.origin}/pattern-hub/${project.id}`;
                await navigator.clipboard.writeText(shareUrl);
                toast({ title: 'Link Copied!', description: 'Shareable link has been copied to your clipboard.' });
            }
        } catch (error) {
            console.error('Export error:', error);
            toast({ title: 'Export Failed', description: error.message || 'There was a problem exporting your pattern.', variant: 'destructive' });
        }
    };

    const handleMenuAction = async (action) => {
        switch (action) {
            case 'open':
                navigate(editPath);
                break;
            case 'cover':
                setCoverDialogOpen(true);
                break;
            case 'dates':
                setDueDateDialogOpen(true);
                break;
            case 'archive':
                await supabase
                    .from('projects')
                    .update({ mode: 'archived' })
                    .eq('id', project.id);
                toast({ title: "Project archived", description: "Project has been archived" });
                if (onRefresh) onRefresh();
                break;
            case 'preview':
                navigate(`${editPath}?preview=true`);
                break;
            case 'download':
                handleDownloadFolder();
                break;
            case 'export-pdf':
                handlePatternExport('pdf');
                break;
            case 'export-png':
                handlePatternExport('png');
                break;
            case 'export-print':
                handlePatternExport('print');
                break;
            case 'export-email':
                handlePatternExport('email');
                break;
            case 'export-share':
                handlePatternExport('share');
                break;
            case 'delete':
                setDeleteDialogOpen(true);
                break;
            default:
        }
    };

    const handleDeleteProject = async () => {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', project.id);

        if (!error) {
            toast({ title: "Project deleted", description: "Project has been permanently deleted" });
            setDeleteDialogOpen(false);
            if (onRefresh) onRefresh();
        } else {
            toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
        }
    };

    const handleSelectColor = async (color) => {
        setCoverColor(color);
        const updatedData = { ...project.project_data, coverColor: color };
        await supabase
            .from('projects')
            .update({ project_data: updatedData })
            .eq('id', project.id);
        setCoverDialogOpen(false);
    };

    const handleRemoveCover = async () => {
        setCoverColor(null);
        const updatedData = { ...project.project_data, coverColor: null };
        await supabase
            .from('projects')
            .update({ project_data: updatedData })
            .eq('id', project.id);
        setCoverDialogOpen(false);
    };

    const handleSaveDueDate = async (date) => {
        setDueDate(date);
        const updatedData = { ...project.project_data, dueDate: date };
        await supabase
            .from('projects')
            .update({ project_data: updatedData })
            .eq('id', project.id);
        toast({ title: "Due date updated", description: date ? `Due date set to ${format(new Date(date), 'MMM d, yyyy')}` : "Due date removed" });
    };

    // Pattern hub is "completed" when it has pattern selections OR status is not 'in progress'
    const hasPatternSelections = isPatternHub && Object.keys(project.project_data?.patternSelections || {}).length > 0;
    const isCompletedPatternHub = isPatternHub && (hasPatternSelections || (project.status || '').toLowerCase() !== 'in progress');

    // Render menu items based on menuType
    const renderMenuItems = () => {
        if (isCompletedPatternHub) {
            // Completed Pattern Hub: export actions + open/archive
            return (
                <>
                    <DropdownMenuItem onClick={() => handleMenuAction('open')}>
                        <Pencil className="mr-2 h-4 w-4" /> Open Pattern
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('export-pdf')}>
                        <FileText className="mr-2 h-4 w-4" /> Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('export-png')}>
                        <LucideImage className="mr-2 h-4 w-4" /> Download PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('export-print')}>
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('export-email')}>
                        <Mail className="mr-2 h-4 w-4" /> Send Email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('export-share')}>
                        <Link2 className="mr-2 h-4 w-4" /> Share Link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('archive')}>
                        <Archive className="mr-2 h-4 w-4" /> Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('delete')} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </>
            );
        } else if (menuType === 'folder') {
            // Pattern Folder: open card, change cover, preview only (hide open card for Past Pattern Portal)
            return (
                <>
                    {!isPastPatternPortal && (
                        <DropdownMenuItem onClick={() => handleMenuAction('open')}>
                            <Pencil className="mr-2 h-4 w-4" /> Open card
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleMenuAction('cover')}>
                        <ImageIcon className="mr-2 h-4 w-4" /> Change cover
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('preview')}>
                        <Eye className="mr-2 h-4 w-4" /> Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('archive')}>
                        <Archive className="mr-2 h-4 w-4" /> Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('delete')} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </>
            );
        } else {
            // Pattern Books and Horse Shows: open card, change cover, edit dates, download folder, archive (hide open card for Past Pattern Portal)
            return (
                <>
                    {!isPastPatternPortal && (
                        <DropdownMenuItem onClick={() => handleMenuAction('open')}>
                            <Pencil className="mr-2 h-4 w-4" /> Open card
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleMenuAction('cover')}>
                        <ImageIcon className="mr-2 h-4 w-4" /> Change cover
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('dates')}>
                        <CalendarIcon className="mr-2 h-4 w-4" /> Edit dates
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('download')} disabled={isDownloading}>
                        {isDownloading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        {isDownloading ? 'Downloading...' : 'Download Folder'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('archive')}>
                        <Archive className="mr-2 h-4 w-4" /> Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMenuAction('delete')} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </>
            );
        }
    };

    // Folder-style card for Pattern Folder
    if (isPatternFolder) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                whileHover={{ y: -5, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
                className="flex flex-col h-full relative group"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Folder Tab */}
                <div className="flex">
                    <div 
                        className="h-4 w-20 rounded-t-lg"
                        style={{ backgroundColor: coverColor || 'hsl(var(--primary))' }}
                    />
                    <div 
                        className="h-4 w-4"
                        style={{ 
                            background: `linear-gradient(135deg, ${coverColor || 'hsl(var(--primary))'} 50%, transparent 50%)`
                        }}
                    />
                </div>
                
                {/* Delete & Edit Buttons */}
                <div className={`absolute top-6 right-2 z-10 flex items-center gap-1 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 bg-destructive/10 hover:bg-destructive/20 text-destructive shadow-sm border border-destructive/20"
                        onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true); }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 bg-background/80 hover:bg-background shadow-sm border"
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            {renderMenuItems()}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Folder Body */}
                <Card className="flex flex-col flex-grow rounded-tl-none border-t-0" style={{ borderColor: coverColor || undefined }}>
                    {coverColor && (
                        <div className="h-2 w-full rounded-tr-lg" style={{ backgroundColor: coverColor }} />
                    )}
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg">
                                <FolderOpen className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <CardTitle className="leading-tight truncate cursor-pointer max-w-[150px]">{project.project_name || 'Untitled Project'}</CardTitle>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                            <p>{project.project_name || 'Untitled Project'}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <CardDescription>Pattern Folder</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground">
                            Last saved: {format(new Date(project.updated_at), "MMMM d, yyyy 'at' h:mm a")}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Status: <span className="capitalize font-medium text-foreground">{project.status === 'Draft' ? 'Draft' : project.status === 'Lock & Approve Mode' ? 'Lock & Approve Mode' : project.status || 'Draft'}</span></p>
                        {dueDate && (
                            <p className="text-sm text-muted-foreground mt-1">
                                Due: <span className="font-medium text-foreground">{format(new Date(dueDate), 'MMM d, yyyy')}</span>
                            </p>
                        )}
                    </CardContent>
                    <CardFooter>
                        {!isPastPatternPortal && (
                            <Button 
                                onClick={handleContinueEditing} 
                                className="w-full"
                                disabled={isLocked}
                            >
                                Continue Editing <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </CardFooter>
                </Card>

                <CoverColorDialog
                    open={coverDialogOpen}
                    onClose={() => setCoverDialogOpen(false)}
                    currentColor={coverColor}
                    onSelectColor={handleSelectColor}
                    onRemoveCover={handleRemoveCover}
                />
                
                <ProjectDetailModal
                    open={detailModalOpen}
                    onClose={() => setDetailModalOpen(false)}
                    project={project}
                    onRefresh={onRefresh}
                />
            </motion.div>
        );
    }

    // Folder colors - use primary (blue) for tab/border, transparent body
    const tabColor = coverColor || 'hsl(var(--primary))';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ y: -5 }}
            className="flex flex-col h-full relative group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Back paper layers - 3D effect */}
            <div className="absolute top-3 left-2 right-0 bottom-0 z-0">
                {/* Third layer (furthest back) */}
                <div 
                    className="absolute inset-0 rounded-lg border-2 bg-card/30 translate-x-2 translate-y-2"
                    style={{ borderColor: coverColor || 'hsl(var(--primary))' }}
                />
                {/* Second layer */}
                <div 
                    className="absolute inset-0 rounded-lg border-2 bg-card/50 translate-x-1 translate-y-1"
                    style={{ borderColor: coverColor || 'hsl(var(--primary))' }}
                />
            </div>

            {/* Folder Tab - small tab on left */}
            <div className="flex items-end relative z-20">
                <div 
                    className="h-5 w-16 rounded-t-md border-2 border-b-0 bg-card/80"
                    style={{ borderColor: coverColor || 'hsl(var(--primary))' }}
                />
                {/* Slanted edge connector */}
                <svg 
                    className="h-5 w-4 -ml-px"
                    viewBox="0 0 16 20" 
                    fill="none"
                >
                    <path 
                        d="M0 0 L16 20 L0 20 Z" 
                        className="fill-card/80"
                    />
                    <path 
                        d="M0 0 L16 20" 
                        stroke={coverColor || 'hsl(var(--primary))'} 
                        strokeWidth="2"
                    />
                </svg>
            </div>
            
            {/* Folder Body - main front panel */}
            <div 
                className="flex-grow rounded-lg rounded-tl-none shadow-xl overflow-hidden relative bg-card/90 backdrop-blur-sm border-2 z-20"
                style={{ borderColor: coverColor || 'hsl(var(--primary))' }}
            >
                {/* Delete & Edit Buttons - Only visible on hover */}
                <div className={`absolute top-2 right-2 z-10 flex items-center gap-1 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 bg-destructive/10 hover:bg-destructive/20 text-destructive shadow-sm border border-destructive/20"
                        onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true); }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {!isInProgressPortal && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 bg-background/80 hover:bg-background shadow-sm border"
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 bg-popover">
                                {renderMenuItems()}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                <div
                    className={`p-4 ${isCompletedPatternHub ? 'cursor-pointer' : ''}`}
                    onClick={isCompletedPatternHub ? () => setPatternDetailDialogOpen(true) : undefined}
                >
                    {/* Project Name */}
                    <div className="flex items-center gap-2 mb-3 min-w-0">
                        {isPatternBook ? (
                            <BookCopy className="h-5 w-5 text-primary shrink-0" />
                        ) : (
                            <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                        )}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <h3 className="font-semibold text-foreground truncate cursor-pointer max-w-[150px]">
                                        {project.project_name || 'Untitled Project'}
                                    </h3>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p>{project.project_name || 'Untitled Project'}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    
                    {/* Project Type Badge */}
                    <div className="mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                            {isPatternHub ? 'Pattern' : isPatternBook ? 'Pattern Book' : isPatternUpload ? 'Pattern Upload' : 'Horse Show'}
                        </span>
                    </div>

                    {/* Project Details */}
                    <div className="space-y-1 text-sm text-muted-foreground mb-4">
                        <p>Last saved: {format(new Date(project.updated_at), "MMM d, yyyy")}</p>
                        {!isCompletedPatternHub && (
                            <p>
                                Status: {' '}
                                <span className={`font-medium ${
                                    (project.status || '').toString().toLowerCase() === 'in progress'
                                        ? 'text-green-500'
                                        : 'text-foreground'
                                }`}>
                                    {(() => {
                                        const s = (project.status || 'Draft').toString().toLowerCase();
                                        if (s === 'in progress') return 'In Progress';
                                        if (s === 'draft') return 'Draft';
                                        if (s === 'locked' || s === 'lock & approve mode') return 'Apprvd & Locked';
                                        if (s === 'final' || s === 'publication' || s === 'published') return 'Published';
                                        return project.status || 'Draft';
                                    })()}
                                </span>
                            </p>
                        )}
                        {dueDate && (
                            <p>Due: <span className="font-medium text-foreground">{format(new Date(dueDate), 'MMM d, yyyy')}</span></p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    {!isPastPatternPortal && (
                        isCompletedPatternHub ? (
                            <Button
                                onClick={() => setPatternDetailDialogOpen(true)}
                                className="w-full"
                                size="sm"
                            >
                                <Download className="mr-2 h-4 w-4" /> View & Download
                            </Button>
                        ) : (
                            <Button
                                onClick={handleContinueEditing}
                                className="w-full"
                                size="sm"
                                disabled={isLocked}
                            >
                                Continue Editing <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )
                    )}
                </div>
            </div>

            <CoverColorDialog
                open={coverDialogOpen}
                onClose={() => setCoverDialogOpen(false)}
                currentColor={coverColor}
                onSelectColor={handleSelectColor}
                onRemoveCover={handleRemoveCover}
            />
            
            <DueDateDialog
                open={dueDateDialogOpen}
                onClose={() => setDueDateDialogOpen(false)}
                currentDate={dueDate}
                onSaveDate={handleSaveDueDate}
            />
            
            <ProjectDetailModal
                open={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                project={project}
                onRefresh={onRefresh}
            />

            {isPatternHub && (
                <SendPatternEmailDialog
                    open={emailDialogOpen}
                    onOpenChange={setEmailDialogOpen}
                    projectData={project.project_data}
                    patternName={project.project_name || project.project_data?.showName}
                />
            )}

            {isCompletedPatternHub && (
                <PatternPortalDetailDialog
                    open={patternDetailDialogOpen}
                    onOpenChange={setPatternDetailDialogOpen}
                    project={project}
                />
            )}

            {/* Delete Project Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Project</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{project.project_name || 'Untitled Project'}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteProject}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
};

// Contract Card for Contracts Portal section
const CustomerPortalPage = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const hasLoadedRef = useRef(false);

    const fetchProjects = async () => {
        if (!user) return;
        // Only blank the page for the very first load. A later refetch must keep the
        // cards mounted, otherwise an open dialog is destroyed under the user.
        if (!hasLoadedRef.current) setIsLoading(true);

        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching projects:', error);
        } else {
            setProjects(data);
        }
        hasLoadedRef.current = true;
        setIsLoading(false);
    };

    // Keyed on the id, not the object: Supabase hands back a fresh user object on
    // every token refresh (which fires when you come back to the browser tab).
    useEffect(() => {
        fetchProjects();
    }, [user?.id]);

    const patternBookProjects = projects.filter(p => p.project_type === 'pattern_book');
    const allShowProjects = projects.filter(p => {
        const mode = (p.mode || '').toString().trim();
        return p.project_type !== 'pattern_book' && p.project_type !== 'pattern_folder' && p.project_type !== 'pattern_hub' && p.project_type !== 'pattern_upload' && p.project_type !== 'contract' && mode.toLowerCase() !== 'archived';
    });

    // Active Horse Shows: Only Locked/Final (credit-consuming, exportable)
    const activeShowProjects = allShowProjects.filter(p => {
        const status = (p.status || 'Draft').toString().trim().toLowerCase();
        return status === 'locked' || status === 'final' || status === 'lock & approve mode' || status === 'publication' || status === 'published';
    });

    // In Progress Horse Shows: Draft and In progress (still editable, no credit used)
    const inProgressShowProjects = allShowProjects.filter(p => {
        const status = (p.status || 'Draft').toString().trim().toLowerCase();
        return status === 'in progress' || status === 'draft';
    });

    // In Progress Uploaded Patterns: Draft, In progress, and Pending pattern_upload projects
    const inProgressUploads = projects.filter(p => {
        const status = (p.status || 'Draft').toString().trim().toLowerCase();
        const mode = (p.mode || '').toString().trim();
        return p.project_type === 'pattern_upload' &&
               (status === 'in progress' || status === 'draft' || status === 'pending') &&
               mode.toLowerCase() !== 'archived';
    });

    // Keep combined list for backward compatibility
    const showManagerProjects = allShowProjects;
    
    // Filter pattern books by status
    // Active Pattern Books Portal: Only Locked/Final projects (credit-consuming, exportable)
    // Supports both new values (Locked/Final) and legacy values (Lock & Approve Mode/Publication)
    const activePatternBooks = patternBookProjects.filter(p => {
        const status = (p.status || 'Draft').toString().trim().toLowerCase();
        const mode = (p.mode || '').toString().trim();
        const isActive = status === 'locked' || status === 'final' || status === 'lock & approve mode' || status === 'publication';
        return isActive && mode.toLowerCase() !== 'archived';
    });

    // In Progress Pattern Books Portal: Draft and In progress projects (still editable, no credit used)
    const inProgressPatternBooks = patternBookProjects.filter(p => {
        const status = (p.status || 'Draft').toString().trim().toLowerCase();
        const mode = (p.mode || '').toString().trim();
        return (status === 'in progress' || status === 'draft') && mode.toLowerCase() !== 'archived';
    });
    
    // Pattern Portal: Only Locked and Final pattern_hub projects (official, credit-consuming)
    const patternPortalBooks = projects.filter(p => {
        const projectType = (p.project_type || '').toString().trim();
        const status = (p.status || 'Draft').toString().trim().toLowerCase();
        const mode = (p.mode || '').toString().trim();
        return projectType.toLowerCase() === 'pattern_hub' &&
               (status === 'locked' || status === 'final') &&
               mode.toLowerCase() !== 'archived';
    });
    
    // Choose a Pattern Portal: Show only projects with project_type = 'pattern_hub' AND status = 'In progress' AND mode !== 'archived'
    // Choose a Pattern In Progress: Draft and In progress pattern_hub projects (still editable)
    const choosePatternBooks = projects.filter(p => {
        const projectType = (p.project_type || '').toString().trim();
        const status = (p.status || 'Draft').toString().trim().toLowerCase();
        const mode = (p.mode || '').toString().trim();
        return projectType.toLowerCase() === 'pattern_hub' &&
               (status === 'in progress' || status === 'draft') &&
               mode.toLowerCase() !== 'archived';
    });
    
    // Past Patterns & Pattern Books Portal: Show only archived projects (mode === 'archived')
    const pastPatternBooks = patternBookProjects.filter(p => {
        const mode = (p.mode || '').toString().trim();
        return mode.toLowerCase() === 'archived';
    });

    // Contracts Portal: All contract projects (both linked and standalone)
    const contractProjects = projects.filter(p => p.project_type === 'contract');

    const [expandedSections, setExpandedSections] = useState({
        activePatternBooks: true,
        inProgressPatternBooks: true,
        contractsPortal: true,
        patternPortal: true,
        choosePatternPortal: true,
        pastPatternPortal: true,
        horseShows: true,
        inProgressUploads: true
    });
    
    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const renderProjectList = (projectList, title, description, newProjectPath, newProjectLabel, sectionKey, menuType = 'full', hideNewButton = false) => (
        <div className="mb-16">
            <div className="flex justify-between items-center mb-4">
                <button 
                    onClick={() => toggleSection(sectionKey)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                    {expandedSections[sectionKey] ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="text-left">
                        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
                        <p className="text-muted-foreground mt-1">{description}</p>
                    </div>
                </button>
                {!hideNewButton && (
                    <Button onClick={() => navigate(newProjectPath)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> {newProjectLabel}
                    </Button>
                )}
            </div>
            {expandedSections[sectionKey] && (
                projectList.length > 0 ? (
                    sectionKey === 'activePatternBooks' ? (
                        // Active Pattern Books Portal - custom card layout matching the image
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {projectList.map(project => (
                                <ActivePatternBookCard 
                                    key={project.id} 
                                    project={project} 
                                    onRefresh={fetchProjects}
                                    profile={profile}
                                    user={user}
                                />
                            ))}
                        </div>
                    ) : menuType === 'folder' ? (
                        // Folder-style layout for Pattern Portal - 3 folders per row
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {projectList.map(project => (
                                <PatternFolderItem 
                                    key={project.id} 
                                    project={project} 
                                    currentUserName={profile?.full_name || user?.email || 'User'} 
                                    isPastPatternPortal={sectionKey === 'pastPatternPortal'}
                                />
                            ))}
                        </div>
                    ) : (
                        // Grid layout for Pattern Books and Horse Shows
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                            {projectList.map(project => (
                                <ProjectCard 
                                    key={project.id} 
                                    project={project} 
                                    menuType={menuType} 
                                    onRefresh={fetchProjects} 
                                    isPastPatternPortal={sectionKey === 'pastPatternPortal'}
                                    isInProgressPortal={sectionKey === 'inProgressPatternBooks' || sectionKey === 'choosePatternPortal'}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">You haven't created any projects here yet.</p>
                    </div>
                )
            )}
        </div>
    );

    return (
        <>
            <Helmet>
                <title>Customer Portal - EquiPatterns</title>
                <meta name="description" content="Manage your horse show projects, pattern books, and access exclusive customer tools." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-8">
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                            Welcome to Your Portal
                        </h1>
                        <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
                            This is your command center for all your projects. Manage your pattern books, build show schedules, and access your assets.
                        </p>
                    </motion.div>

                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div>
                            {renderProjectList(
                                activePatternBooks,
                                "Active Pattern Books Portal",
                                "Build and manage your horse show pattern books.",
                                "/pattern-book-builder",
                                "New Pattern Book",
                                "activePatternBooks",
                                "default"
                            )}
                            {renderProjectList(
                                inProgressPatternBooks,
                                "In Progress Pattern Books Portal",
                                "Pattern books that are in progress.",
                                "",
                                "",
                                "inProgressPatternBooks",
                                "default",
                                true
                            )}
                            {/* Contracts Portal */}
                            <div className="mb-16">
                                <div className="flex justify-between items-center mb-4">
                                    <button
                                        onClick={() => toggleSection('contractsPortal')}
                                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                    >
                                        {expandedSections.contractsPortal ? (
                                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                        )}
                                        <div className="text-left">
                                            <h2 className="text-3xl font-bold tracking-tight">Contracts Portal</h2>
                                            <p className="text-muted-foreground mt-1">Manage all your contracts — linked to shows or standalone.</p>
                                        </div>
                                    </button>
                                    <Button onClick={() => navigate('/horse-show-manager/employee-management/contracts')}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> New Contract
                                    </Button>
                                </div>
                                {expandedSections.contractsPortal && (
                                    contractProjects.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {contractProjects.map(project => (
                                                <ContractCard key={project.id} project={project} onRefresh={fetchProjects} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                            <p className="text-muted-foreground">You haven't created any contracts yet.</p>
                                        </div>
                                    )
                                )}
                            </div>
                            {renderProjectList(
                                patternPortalBooks,
                                "Pattern Portal",
                                "Your generated patterns. Download, print, email, or share.",
                                "",
                                "",
                                "patternPortal",
                                "default",
                                true
                            )}
                            {renderProjectList(
                                choosePatternBooks,
                                "Choose a Pattern Portal",
                                "Browse and select from all available pattern books.",
                                "",
                                "",
                                "choosePatternPortal",
                                "default",
                                true
                            )}
                            {renderProjectList(
                                pastPatternBooks,
                                "Past Patterns & Pattern Books Portal",
                                "View your published pattern books.",
                                "",
                                "",
                                "pastPatternPortal",
                                "default",
                                true
                            )}
                            {renderProjectList(
                                activeShowProjects,
                                "Active Horse Shows",
                                "Your approved and finalized horse shows.",
                                "/horse-show-manager/create",
                                "New Horse Show",
                                "activeHorseShows",
                                "default"
                            )}
                            {renderProjectList(
                                inProgressShowProjects,
                                "In Progress Horse Shows",
                                "Draft and in-progress shows still being built.",
                                "/horse-show-manager/create",
                                "New Horse Show",
                                "inProgressHorseShows",
                                "default"
                            )}
                            {renderProjectList(
                                inProgressUploads,
                                "Uploaded Patterns – In Progress",
                                "Pattern uploads still being completed.",
                                "/upload-patterns/new",
                                "New Upload",
                                "inProgressUploads",
                                "default"
                            )}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default CustomerPortalPage;
