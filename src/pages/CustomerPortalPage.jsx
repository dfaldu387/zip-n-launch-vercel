import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { downloadPatternBookFolder } from '@/lib/patternBookDownloader';
import { applyTextOverlay, getOverlayDataFromContext, batchDetectFieldPositions, applyTextOverlayWithPositions } from '@/lib/scoresheetTextOverlay';
import { findClassItemId } from '@/lib/resultsUtils';
import { fetchImageAsBase64, cropPatternImageSmart } from '@/lib/pdfHelpers';
import JSZip from 'jszip';
import { generatePatternBookPdf } from '@/lib/bookGenerator';
import { jsPDF } from 'jspdf';
import ResultsTab from '@/components/customer-portal/ResultsTab';
import PatternPortalDetailDialog from '@/components/customer-portal/PatternPortalDetailDialog';
import PatternBookDownloadDialog from '@/components/PatternBookDownloadDialog';
import { getPatternSelectionForAssoc, isAssocKeyedEntry, forEachPatternSelection, getForcedAssocForDivision, detectShowAssociations } from '@/lib/patternSelectionHelpers';
import { SendPatternEmailDialog } from '@/components/pattern-hub/SendPatternEmailDialog';

const accessPhaseLabels = {
    draft: 'Draft, Build, Review',
    approval: 'Approval and Locked',
    publication: 'Publication',
};

const COVER_COLORS = [
    '#4BCE97', '#F5CD47', '#FEA362', '#F87168', '#E774BB', '#C59CDF',
    '#579DFF', '#6CC3E0', '#94C748', '#E388A3'
];

const accessPhases = [
    { id: 'draft', name: 'Draft, Build, Review' },
    { id: 'approval', name: 'Approval and Locked' },
    { id: 'publication', name: 'Publication' },
];

// Staff Access Card inside folder
const StaffAccessCard = ({ staffMember, projectId, projectData, projectName, currentUserName, onRefresh }) => {
    const { toast } = useToast();
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [selectedPhases, setSelectedPhases] = useState(staffMember.delegation?.accessPhase || []);
    const [currentPhases, setCurrentPhases] = useState(staffMember.delegation?.accessPhase || []);
    const [isSaving, setIsSaving] = useState(false);

    const getStatusFromAccessPhase = (accessPhase) => {
        if (!accessPhase || accessPhase.length === 0) return 'Pending';
        if (accessPhase.includes('approval') || accessPhase.includes('locked')) return 'Approval and Locked';
        if (accessPhase.includes('publication')) return 'Published';
        if (accessPhase.includes('draft')) return 'Review';
        return 'Pending';
    };

    const status = getStatusFromAccessPhase(currentPhases);
    const statusColor = status === 'Review' ? 'text-orange-500' : 
                        status === 'Approval and Locked' ? 'text-amber-500' :
                        status === 'Published' ? 'text-green-500' : 'text-muted-foreground';

    const handlePhaseToggle = (phaseId) => {
        setSelectedPhases(prev => 
            prev.includes(phaseId) 
                ? prev.filter(p => p !== phaseId) 
                : [...prev, phaseId]
        );
    };

    const sendStatusNotificationEmail = async (newPhases) => {
        try {
            // Determine the primary status to send
            const primaryStatus = newPhases.includes('publication') ? 'publication' :
                                  newPhases.includes('approval') ? 'approval' :
                                  newPhases.includes('draft') ? 'draft' : 'pending';
            
            const staffEmail = staffMember.email || staffMember.delegation?.email;
            const staffRole = staffMember.role || staffMember.delegation?.role || 'Staff';
            
            if (!staffEmail) {
                return;
            }

            const response = await supabase.functions.invoke('send-status-notification', {
                body: {
                    staffEmail,
                    staffName: staffMember.name || 'Staff Member',
                    staffRole,
                    projectName: projectName || 'Pattern Book',
                    newStatus: primaryStatus,
                    changedBy: currentUserName || 'System'
                }
            });

            if (response.error) {
                console.error("Error sending notification email:", response.error);
            } else {
            }
        } catch (error) {
            console.error("Failed to send status notification:", error);
        }
    };

    const handleSaveStatus = async () => {
        setIsSaving(true);
        try {
            const updatedDelegations = {
                ...(projectData.delegations || {}),
                [staffMember.id]: {
                    ...(projectData.delegations?.[staffMember.id] || {}),
                    accessPhase: selectedPhases
                }
            };

            const updatedProjectData = {
                ...projectData,
                delegations: updatedDelegations
            };

            await supabase
                .from('projects')
                .update({ project_data: updatedProjectData })
                .eq('id', projectId);

            // Update local state immediately for UI refresh
            setCurrentPhases(selectedPhases);
            
            // Send email notification for status change
            await sendStatusNotificationEmail(selectedPhases);
            
            toast({ title: "Status updated", description: "Staff access phase has been updated and notification sent." });
            setStatusDialogOpen(false);
            if (onRefresh) onRefresh();
        } catch (error) {
            toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div 
                className="border border-border rounded-lg p-4 bg-background hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setStatusDialogOpen(true)}
            >
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <Eye className="h-5 w-5 text-orange-400" />
                        <div>
                            <p className="font-semibold">{staffMember.name || 'Staff Member'}</p>
                            <p className="text-sm text-muted-foreground">
                                Last saved: {staffMember.updatedAt ? format(new Date(staffMember.updatedAt), 'MMM d, yyyy') : 'N/A'}
                            </p>
                            <p className="text-sm">
                                Status: <span className={cn("font-medium", statusColor)}>{status}</span>
                            </p>
                        </div>
                    </div>
                    <Edit className="h-4 w-4 text-muted-foreground" />
                </div>
            </div>

            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
                <DialogContent className="sm:max-w-[350px]">
                    <DialogHeader>
                        <DialogTitle>Edit Status - {staffMember.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm font-medium">Access Per Phase</p>
                        <div className="space-y-3">
                            {accessPhases.map(phase => (
                                <div key={phase.id} className="flex items-center space-x-3">
                                    <input
                                        type="checkbox"
                                        id={`status-${staffMember.id}-${phase.id}`}
                                        checked={selectedPhases.includes(phase.id)}
                                        onChange={() => handlePhaseToggle(phase.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <label 
                                        htmlFor={`status-${staffMember.id}-${phase.id}`}
                                        className="text-sm cursor-pointer"
                                    >
                                        {phase.name}
                                    </label>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setStatusDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button className="flex-1" onClick={handleSaveStatus} disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

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
                                // Status flow: Draft ↔ Locked (bidirectional), → Publication (terminal).
                                // Users can roll a Locked project back to Draft to edit, then re-lock.
                                const dbStatus = project.status || 'Draft';
                                const isPublished = dbStatus === 'Final' || dbStatus === 'Publication';
                                const draftDisabled = isPublished;
                                const lockedDisabled = isPublished;
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

const CoverColorDialog = ({ open, onClose, currentColor, onSelectColor, onRemoveCover }) => {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[320px]">
                <DialogHeader>
                    <DialogTitle>Cover</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">Size</p>
                        <div className="flex gap-2">
                            <div className="flex-1 h-12 bg-muted rounded border-2 border-primary flex items-center justify-center">
                                <div className="w-full h-2 bg-primary/30 mx-4 rounded" />
                            </div>
                            <div className="flex-1 h-12 bg-muted rounded border flex items-center justify-center">
                                <div className="w-full h-full bg-primary/20 rounded" />
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" className="w-full" onClick={onRemoveCover}>
                        Remove cover
                    </Button>
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">Colors</p>
                        <div className="grid grid-cols-5 gap-2">
                            {COVER_COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => onSelectColor(color)}
                                    className={`w-10 h-8 rounded cursor-pointer transition-all hover:scale-110 ${currentColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const DueDateDialog = ({ open, onClose, currentDate, onSaveDate }) => {
    const [selectedDate, setSelectedDate] = useState(currentDate ? new Date(currentDate) : undefined);
    
    const handleSave = () => {
        onSaveDate(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '');
        onClose();
    };
    
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[320px]">
                <DialogHeader>
                    <DialogTitle>Edit Due Date</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">Due Date</p>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !selectedDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    initialFocus
                                    className={cn("p-3 pointer-events-auto")}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setSelectedDate(undefined)}>
                            Clear
                        </Button>
                        <Button className="flex-1" onClick={handleSave}>
                            Save
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
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
                            <Select value={displayStatus} onValueChange={handleStatusChange}>
                                <SelectTrigger className="w-36 h-9 text-sm">
                                    <SelectValue>
                                        {displayStatus === 'Lock & Approve Mode' ? 'Apprvd & Locked' : displayStatus === 'Publication' ? 'Published' : displayStatus}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        value="Draft"
                                        disabled={displayStatus === 'Lock & Approve Mode' || displayStatus === 'Publication'}
                                    >
                                        Draft
                                    </SelectItem>
                                    <SelectItem
                                        value="Lock & Approve Mode"
                                        disabled={displayStatus === 'Publication'}
                                    >
                                        Apprvd & Locked
                                    </SelectItem>
                                    <SelectItem value="Publication">
                                        Published
                                    </SelectItem>
                                </SelectContent>
                            </Select>
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

// Pattern Book Dialog Content Component
const PatternBookDialogContent = ({ project, profile, user, associationsData, onClose, onRefresh, initialTab = 'patternBook' }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [activeSubTab, setActiveSubTab] = useState('patterns');
    const [patterns, setPatterns] = useState([]);
    const [scoresheets, setScoresheets] = useState([]);
    const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
    const [isLoadingScoresheets, setIsLoadingScoresheets] = useState(false);
    const [selectedSidebarItem, setSelectedSidebarItem] = useState('allItems');
    const [filterDisciplines, setFilterDisciplines] = useState(new Set()); // multi-select discipline
    const [filterDivisions, setFilterDivisions] = useState(new Set()); // multi-select division (renamed from filterClasses)
    const [filterJudges, setFilterJudges] = useState(new Set()); // multi-select judge
    const [filterAssociations, setFilterAssociations] = useState(new Set()); // multi-select association/breed
    const [sortBy, setSortBy] = useState('newest');
    // Filter dropdown open states
    const [disciplineFilterOpen, setDisciplineFilterOpen] = useState(false);
    const [divisionFilterOpen, setDivisionFilterOpen] = useState(false);
    const [judgeFilterOpen, setJudgeFilterOpen] = useState(false);
    const [associationFilterOpen, setAssociationFilterOpen] = useState(false);
    const [disciplineSearch, setDisciplineSearch] = useState('');
    const [divisionSearch, setDivisionSearch] = useState('');
    const [judgeSearch, setJudgeSearch] = useState('');
    const [associationSearch, setAssociationSearch] = useState('');
    const [filterDates, setFilterDates] = useState(new Set());
    const [dateFilterOpen, setDateFilterOpen] = useState(false);

    // Score sheet generation state (user-controlled, not auto-fetched)
    const [generatedScoresheets, setGeneratedScoresheets] = useState([]);
    const [isGeneratingScoresheets, setIsGeneratingScoresheets] = useState(false);
    const [selectedScoresheetIds, setSelectedScoresheetIds] = useState(new Set());
    const [selectedPatternIds, setSelectedPatternIds] = useState(new Set());
    const [scoresheetSortBy, setScoresheetSortBy] = useState('association');
    const [bulkDownloadProgress, setBulkDownloadProgress] = useState(null);

    const [previewItem, setPreviewItem] = useState(null); // For pattern/scoresheet preview modal
    const [previewType, setPreviewType] = useState(null); // 'pattern' or 'scoresheet'
    const [previewImage, setPreviewImage] = useState(null); // Image URL for preview
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [projectStatus, setProjectStatus] = useState(project.status || 'Draft'); // Local status state
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [viewDownloadDialogOpen, setViewDownloadDialogOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    // Local mirror of project.project_data so Layout C's builder can mutate it
    // through setFormData. Every update is persisted to Supabase immediately
    // (there's no "Save Draft" button in the Customer Portal dialog).
    const [localProjectData, setLocalProjectData] = useState(() => project.project_data || {});
    
    // Folder management state
    const [folders, setFolders] = useState(() => {
        // Load folders from project_data
        const savedFolders = project.project_data?.folders || [];
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
    
    // Move to Folder dialog state
    const [moveToFolderDialogOpen, setMoveToFolderDialogOpen] = useState(false);
    const [itemToMove, setItemToMove] = useState(null); // { type: 'pattern' | 'scoresheet', data: pattern/scoresheet }
    
    const projectData = project.project_data || {};
    const { toast } = useToast();

    // Keep the local project_data mirror in sync when parent refreshes the project
    useEffect(() => {
        setLocalProjectData(project.project_data || {});
    }, [project.project_data]);

    // setFormData-compatible handler for Layout C builder. Auto-persists each
    // mutation to Supabase so the customer portal doesn't need a separate
    // "Save Draft" step.
    const handleDialogFormDataChange = useCallback(
        (updater) => {
            setLocalProjectData((prev) => {
                const next = typeof updater === 'function' ? updater(prev) : updater;
                // Fire-and-forget DB persist. Errors surface via toast.
                supabase
                    .from('projects')
                    .update({ project_data: next })
                    .eq('id', project.id)
                    .then(({ error }) => {
                        if (error) {
                            console.error('Error persisting project_data:', error);
                            toast({
                                title: 'Save failed',
                                description: error.message || 'Could not save changes.',
                                variant: 'destructive',
                            });
                        } else if (onRefresh) {
                            // Refresh the parent so subsequent opens see the latest data
                            onRefresh();
                        }
                    });
                return next;
            });
        },
        [project.id, toast, onRefresh]
    );

    // Project shape fed to the dialog — uses the local, possibly-ahead-of-DB mirror
    const dialogProject = useMemo(
        () => ({ ...project, project_data: localProjectData }),
        [project, localProjectData]
    );
    
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
    
    // Format status for display — map DB values to the dropdown's option values
    // so the trigger label shows the friendly name (e.g. "Published") and the
    // Select correctly highlights the matching SelectItem.
    const getDisplayStatus = () => {
        const status = (projectStatus || '').toString().trim();
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
    
    // Helper function to format association name (same as bookGenerator.js)
    const formatAssociationName = (assocId) => {
        return assocId?.toUpperCase() || 'HORSE ASSOCIATION';
    };
    
    // Helper function to remove first word from division names (same as bookGenerator.js)
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
    
    // Helper function to format division with Go label (same as bookGenerator.js)
    const formatDivisionWithGo = (division) => {
        const baseName = removeFirstWord(typeof division === 'string' ? division : (division.division || division.name || ''));
        // Only add Go label if this division has a goNumber (meaning it's part of a two-go class)
        if (division && typeof division === 'object' && (division.goNumber === 1 || division.goNumber === 2)) {
            return `${baseName} (Go ${division.goNumber})`;
        }
        return baseName;
    };
    
    // Helper function to find discipline and group for a pattern
    const findPatternDisciplineAndGroup = (patternId, expectedAssociationId = null) => {
        const disciplines = projectData.disciplines || [];
        const patternSelections = projectData.patternSelections || {};

        // Try to find by numeric ID
        const numericId = typeof patternId === 'number' ? patternId : parseInt(patternId);
        if (isNaN(numericId)) return null;
        const matches = [];
        
        for (let disciplineIndex = 0; disciplineIndex < disciplines.length; disciplineIndex++) {
            const discipline = disciplines[disciplineIndex];
            const groups = discipline.patternGroups || [];
            const disciplineName = discipline.name || 'Unknown Discipline';
            const associationId = discipline.association_id || 
                (discipline.selectedAssociations ? Object.keys(discipline.selectedAssociations).find(key => discipline.selectedAssociations[key]) : null);
            
            // Try multiple ways to find discipline selections (same as pattern loading logic)
            let disciplineSelections = patternSelections[discipline.id];
            if (!disciplineSelections) {
                disciplineSelections = patternSelections[disciplineIndex] 
                    || patternSelections[`${disciplineIndex}`]
                    || patternSelections[discipline.name];
            }
            
            // If not found, try to find by matching key format
            if (!disciplineSelections && disciplineName && associationId) {
                const disciplineNameNormalized = disciplineName.replace(/\s+/g, '-');
                const matchingKey = Object.keys(patternSelections).find(key => {
                    if (!isNaN(parseInt(key))) return false;
                    const keyNormalized = key.toLowerCase();
                    const disciplineNormalized = disciplineNameNormalized.toLowerCase();
                    return keyNormalized.includes(disciplineNormalized) && keyNormalized.includes(associationId.toLowerCase());
                });
                if (matchingKey) {
                    disciplineSelections = patternSelections[matchingKey];
                }
            }
            
            if (!disciplineSelections) continue;
            
            for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                const group = groups[groupIndex];
                const groupId = group.id || `pattern-group-${groupIndex}`;
                
                // Try multiple ways to find pattern selection (same as pattern loading logic)
                let patternSelection = disciplineSelections[groupIndex]
                    || disciplineSelections[`${groupIndex}`]
                    || disciplineSelections[groupId]
                    || disciplineSelections[group.id]
                    || (Array.isArray(disciplineSelections) ? disciplineSelections[groupIndex] : null);

                // If not found, try to find by group ID pattern
                if (!patternSelection && groupId) {
                    const matchingGroupKey = Object.keys(disciplineSelections).find(key => {
                        return key === groupId || key.includes('pattern-group') || key === `group-${groupIndex}`;
                    });
                    if (matchingGroupKey) {
                        patternSelection = disciplineSelections[matchingGroupKey];
                    }
                }

                if (!patternSelection) continue;

                // Resolve assoc-keyed entry: try expected assoc first, else discipline abbrev,
                // else any assoc value (so every APHA/AQHA variant gets matched).
                const unwrapCandidates = [];
                if (isAssocKeyedEntry(patternSelection)) {
                    const tryAbbrevs = [];
                    if (expectedAssociationId) tryAbbrevs.push(String(expectedAssociationId).toUpperCase());
                    if (associationId) tryAbbrevs.push(String(associationId).toUpperCase());
                    for (const a of tryAbbrevs) {
                        if (patternSelection[a]) { unwrapCandidates.push(patternSelection[a]); }
                    }
                    if (unwrapCandidates.length === 0) {
                        Object.values(patternSelection).forEach(v => unwrapCandidates.push(v));
                    }
                } else {
                    unwrapCandidates.push(patternSelection);
                }

              for (const ps of unwrapCandidates) {
                patternSelection = ps;
                if (!patternSelection) continue;

                // Get pattern ID from selection — prefer numeric patternId over string forms
                let selectedNumericId = null;
                if (typeof patternSelection === 'object' && patternSelection !== null) {
                    const numCandidate = patternSelection.patternId ?? patternSelection.pattern_id ?? patternSelection.id;
                    if (typeof numCandidate === 'number') {
                        selectedNumericId = numCandidate;
                    } else if (typeof numCandidate === 'string' && /^\d+$/.test(numCandidate)) {
                        selectedNumericId = parseInt(numCandidate);
                    } else if (typeof numCandidate === 'string') {
                        const m = numCandidate.match(/\d+/);
                        if (m) selectedNumericId = parseInt(m[0]);
                    }
                } else if (typeof patternSelection === 'number') {
                    selectedNumericId = patternSelection;
                } else if (typeof patternSelection === 'string' && /^\d+$/.test(patternSelection)) {
                    selectedNumericId = parseInt(patternSelection);
                }

                if (selectedNumericId === numericId) {
                    matches.push({ discipline, group });
                }
              }
            }
        }

        if (matches.length === 0) return null;
        // Disambiguate by expected association when provided (breed-based mapping)
        if (expectedAssociationId && matches.length > 1) {
            const norm = String(expectedAssociationId).toLowerCase();
            const exact = matches.find(m => String(m.discipline.association_id || '').toLowerCase() === norm);
            if (exact) return exact;
        }
        return matches[0];
    };
    
    // Helper function to create PDF from image with full header (for Published/Approved/Locked states)
    const createPdfWithFullHeader = async (imageUrl, patternTitle, headerInfo, maneuvers = []) => {
        try {
            const base64 = await fetchImageAsBase64(imageUrl);
            if (!base64) return null;

            const doc = new jsPDF('p', 'pt', 'letter');
            const pageWidth = doc.internal.pageSize.getWidth();   // 612 pt
            const pageHeight = doc.internal.pageSize.getHeight();  // 792 pt
            const margin = 36;
            let yPos = margin;

            // Header: show name centered, association, discipline, divisions
            // (same clean layout the client approved for individual downloads)
            if (headerInfo) {
                // Show name (heading) - centered at top
                if (headerInfo.showName) {
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(16);
                    const showNameLines = doc.splitTextToSize(headerInfo.showName.toUpperCase(), pageWidth - margin * 2);
                    doc.text(showNameLines, pageWidth / 2, yPos, { align: 'center' });
                    yPos += (showNameLines.length * 18) + 4;
                }

                // Show dates - centered below show name
                if (headerInfo.showDates) {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(80, 80, 80);
                    doc.text(headerInfo.showDates, pageWidth / 2, yPos, { align: 'center' });
                    doc.setTextColor(0, 0, 0);
                    yPos += 16;
                }

                // Association name
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text(headerInfo.associationName.toUpperCase(), margin, yPos);
                yPos += 14;

                // Discipline name, pattern number, and competition date
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const dateStr = headerInfo.competitionDate ? format(parseLocalDate(headerInfo.competitionDate), 'MM-dd-yyyy') : '';
                const patternNumSegment = headerInfo.patternNumber ? ` - PATTERN ${headerInfo.patternNumber}` : '';
                const disciplineText = `${headerInfo.disciplineName.toUpperCase()}${patternNumSegment}${dateStr ? ` - ${dateStr}` : ''}`;
                const disciplineMaxWidth = pageWidth - margin * 2;
                const disciplineLines = doc.splitTextToSize(disciplineText, disciplineMaxWidth);
                doc.text(disciplineLines, margin, yPos);
                yPos += (disciplineLines.length * 13) + 2;

                // Division names
                if (headerInfo.divisions && headerInfo.divisions.length > 0) {
                    const divisions = headerInfo.divisions.map(d => formatDivisionWithGo(d)).join(' / ');
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    const maxWidth = pageWidth - margin * 2;
                    const divisionLines = doc.splitTextToSize(divisions, maxWidth);
                    const linesToDisplay = divisionLines.slice(0, 2);
                    doc.text(linesToDisplay, margin, yPos);
                    yPos += (linesToDisplay.length * 11) + 8;
                } else {
                    yPos += 8;
                }
            } else {
                // Fallback: Add pattern title at the top (for non-Published states)
                let formattedTitle = (patternTitle || 'Pattern')
                    .replace(/\.pdf$/i, '')
                    .replace(/_/g, ' ')
                    .trim();

                formattedTitle = formattedTitle
                    .split(' ')
                    .map(word => {
                        if (word.length <= 4 && word === word.toUpperCase()) {
                            return word;
                        }
                        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                    })
                    .join(' ');

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(formattedTitle, pageWidth / 2, margin, { align: 'center' });
                yPos = margin + 30;
            }

            // Smart-crop: remove baked-in header/footer text from pattern image
            // (the PDF already provides its own header info above)
            const croppedBase64 = headerInfo ? await cropPatternImageSmart(base64) : base64;

            // Pre-measure the pattern-language block so the image shrinks to leave
            // room for the numbered maneuvers on the SAME page (client request:
            // pattern diagram and language must live on one page, not two).
            const measureManeuversHeight = () => {
                if (!Array.isArray(maneuvers) || maneuvers.length === 0) return 0;
                const savedFontName = doc.getFont().fontName;
                const savedStyle = doc.getFont().fontStyle;
                const savedSize = doc.getFontSize();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                // 14 id-label line + 10 gap + 14 title + 8 gap
                let h = 14 + 10 + 14 + 8;
                const textWidth = pageWidth - margin * 2;
                const sorted = [...maneuvers].sort((a, b) => (a.step_no || 0) - (b.step_no || 0));
                for (const m of sorted) {
                    const stepLabel = m.step_no != null ? `${m.step_no}.` : '\u2022';
                    const line = `${stepLabel} ${m.instruction || ''}`.trim();
                    const wrapped = doc.splitTextToSize(line, textWidth);
                    h += wrapped.length * 12 + 4;
                }
                doc.setFont(savedFontName, savedStyle);
                doc.setFontSize(savedSize);
                return h + 6;
            };
            const maneuversHeight = measureManeuversHeight();

            // Image fills remaining space, reserve room for branding footer + maneuvers
            const bottomReserve = 28;
            const imgMaxWidth = pageWidth - margin * 2;
            const imgMaxHeight = pageHeight - yPos - bottomReserve - maneuversHeight;

            // Create image to get dimensions
            const img = new Image();
            img.src = croppedBase64;

            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
            });

            let imgWidth = img.width || 500;
            let imgHeight = img.height || 700;

            // Scale image to fit — fill available space while preserving aspect ratio
            const scale = Math.min(imgMaxWidth / imgWidth, imgMaxHeight / imgHeight);
            imgWidth *= scale;
            imgHeight *= scale;

            const x = (pageWidth - imgWidth) / 2;
            const y = yPos;

            const imageType = croppedBase64.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(croppedBase64, imageType, x, y, imgWidth, imgHeight);

            // Identification label below the diagram — e.g. "Western Riding – Pattern 0002"
            const idDiscipline = headerInfo?.disciplineName || (patternTitle || '').replace(/\.pdf$/i, '').trim();
            const idNumber = headerInfo?.patternNumber || null;
            if (idDiscipline || idNumber) {
                const idLabel = idNumber
                    ? `${idDiscipline} \u2013 Pattern ${idNumber}`
                    : `${idDiscipline}`;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
                const labelY = Math.min(y + imgHeight + 14, pageHeight - bottomReserve);
                doc.text(idLabel, pageWidth / 2, labelY, { align: 'center' });
            }

            // Pattern language / maneuvers — render INLINE directly below the
            // pattern diagram on the same page. Space was pre-reserved above
            // by shrinking the image. Only spills to a new page if individual
            // maneuvers overflow the bottom margin.
            if (Array.isArray(maneuvers) && maneuvers.length > 0) {
                const labelY = Math.min(y + imgHeight + 14, pageHeight - bottomReserve);
                let py = labelY + 10;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                const langTitle = idNumber
                    ? `${idDiscipline} \u2013 Pattern ${idNumber} \u2013 Pattern Language`
                    : 'Pattern Language';
                doc.text(langTitle, pageWidth / 2, py, { align: 'center' });
                py += 14;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                const textWidth = pageWidth - margin * 2;
                const sorted = [...maneuvers].sort((a, b) => (a.step_no || 0) - (b.step_no || 0));
                for (const m of sorted) {
                    const stepLabel = m.step_no != null ? `${m.step_no}.` : '\u2022';
                    const line = `${stepLabel} ${m.instruction || ''}`.trim();
                    const wrapped = doc.splitTextToSize(line, textWidth);
                    if (py + wrapped.length * 12 > pageHeight - bottomReserve) {
                        doc.addPage();
                        py = margin;
                    }
                    doc.text(wrapped, margin, py);
                    py += wrapped.length * 12 + 4;
                }
            }

            // Branding — bottom-right on every page
            const totalPages = doc.internal.getNumberOfPages();
            for (let p = 1; p <= totalPages; p++) {
                doc.setPage(p);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(150, 150, 150);
                doc.text('equipatterns.com', pageWidth - margin, pageHeight - 14, { align: 'right' });
            }

            return doc.output('blob');
        } catch (error) {
            console.error("Error creating PDF from image:", error);
            return null;
        }
    };
    
    // Helper function to create PDF from image with title (for Draft/other states)
    const createPdfFromImageWithTitle = async (imageUrl, title) => {
        return createPdfWithFullHeader(imageUrl, title, null);
    };
    
    // Download pattern handler
    const handleDownloadPattern = async (pattern) => {
        try {
            // Check if project is in Published/Approved/Locked state
            const status = (projectStatus || project.status || '').toString().trim();
            const statusLower = status.toLowerCase();
            const isPublishedState = statusLower === 'published' || 
                                   statusLower === 'approved' || 
                                   statusLower === 'lock & approve mode' ||
                                   statusLower.includes('approved') ||
                                   statusLower.includes('locked');
            
            console.log('Pattern download - Status:', status, 'isPublishedState:', isPublishedState);
            
            // Extract numeric pattern ID from various formats
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
            
            // Get image URL - try multiple sources
            let imageUrl = pattern.pdf_url || pattern.download_url || pattern.image_url || null;
            let patternDataFromDb = null;
            
            // If we have numeric ID but no image URL, fetch from database
            if (!imageUrl && numericPatternId) {
                // First, verify pattern exists in tbl_patterns
                const { data: patternData, error: patternError } = await supabase
                    .from('tbl_patterns')
                    .select('id, pdf_file_name')
                    .eq('id', numericPatternId)
                    .maybeSingle();
                
                if (patternError) {
                    console.error('Error fetching pattern from tbl_patterns:', patternError);
                }
                
                if (!patternData) {
                    toast({
                        title: "Download not available",
                        description: `Pattern with ID ${numericPatternId} not found in database`,
                        variant: "destructive"
                    });
                    return;
                }
                
                patternDataFromDb = patternData;
                
                // Fetch image from tbl_pattern_media
                const { data: imageData, error: imageError } = await supabase
                    .from('tbl_pattern_media')
                    .select('image_url')
                    .eq('pattern_id', numericPatternId)
                    .maybeSingle();
                
                if (imageError) {
                    console.error('Error fetching pattern image:', imageError);
                }
                
                imageUrl = imageData?.image_url || null;
            }
            
            if (!imageUrl) {
                toast({
                    title: "Download not available",
                    description: "Pattern image not found",
                    variant: "destructive"
                });
                return;
            }
            
            // Get pattern title
            let patternTitle = patternDataFromDb?.pdf_file_name || 
                             pattern.patternName || 
                             pattern.name || 
                             pattern.discipline || 
                             'Pattern';
            
            // Prepare header information - always include if we have project data
            let headerInfo = null;
            
            // Always include show name and dates from project
            const showName = project.project_name || projectData.showName || 'Pattern Book';
            const showDates = projectData.startDate && projectData.endDate 
                ? `${format(parseLocalDate(projectData.startDate), 'MM-dd-yyyy')} - ${format(parseLocalDate(projectData.endDate), 'MM-dd-yyyy')}`
                : (projectData.startDate ? format(parseLocalDate(projectData.startDate), 'MM-dd-yyyy') : '');
            
            // Extract 4-digit pattern number for header label (e.g. "Pattern 0002")
            const patternNumberLabel = (() => {
                const source = patternDataFromDb?.pdf_file_name || pattern.patternName || pattern.name || '';
                const m4 = source.match(/(\d{4})(?!.*\d)/);
                if (m4) return m4[1];
                const mAny = source.match(/(\d+)(?!.*\d)/);
                if (mAny) return mAny[1].padStart(4, '0');
                if (numericPatternId) return String(numericPatternId).padStart(4, '0');
                return null;
            })();

            // Get association ID - try from pattern, discipline, or project
            let assocId = pattern.associationId ||
                         Object.keys(projectData.associations || {})[0];
            
            if (numericPatternId) {
                // Prefer the exact row context (disciplineIndex + groupIndex) so we don't
                // cross-match when two associations (e.g. APHA + AQHA) selected the same pattern ID.
                let patternContext = null;
                const disciplinesArr = projectData.disciplines || [];
                if (
                    typeof pattern.disciplineIndex === 'number' &&
                    typeof pattern.groupIndex === 'number' &&
                    disciplinesArr[pattern.disciplineIndex]
                ) {
                    const exactDiscipline = disciplinesArr[pattern.disciplineIndex];
                    const exactGroup = (exactDiscipline.patternGroups || [])[pattern.groupIndex];
                    if (exactGroup) {
                        patternContext = { discipline: exactDiscipline, group: exactGroup };
                    }
                }
                if (!patternContext) {
                    patternContext = findPatternDisciplineAndGroup(numericPatternId, pattern.associationId);
                }
                console.log('Pattern context found:', patternContext, 'for pattern ID:', numericPatternId);
                
                if (patternContext) {
                    const { discipline, group } = patternContext;

                    // Use the pattern's resolved associationId (derived from groupName) as the
                    // source of truth. Only fall back to discipline.association_id if not available.
                    // This prevents "APHA GREEN NOVICE WR" patterns from getting an AQHA header
                    // in dual-affiliated shows.
                    if (!assocId) {
                        assocId = discipline.association_id ||
                                  (discipline.selectedAssociations ? Object.keys(discipline.selectedAssociations).find(key => discipline.selectedAssociations[key]) : null);
                    }
                    // Also check the group name for an association prefix (e.g., "APHA GREEN NOVICE WR")
                    const gName = (group.name || '').toUpperCase();
                    const knownAssocs = Object.keys(projectData.associations || {}).map(k => k.toUpperCase()).filter(Boolean);
                    const groupAssoc = knownAssocs.find(a => gName.startsWith(a + ' ') || gName === a);
                    if (groupAssoc) assocId = groupAssoc;
                    const associationName = formatAssociationName(assocId);
                    
                    // Get competition date - same logic as Pattern Book
                    let competitionDate = projectData.startDate;
                    
                    // Try to get date from divisionDates (set in Step 3, tab 2)
                    if (group.divisions && group.divisions.length > 0) {
                        const divisionDates = group.divisions
                            .map(div => {
                                const divId = typeof div === 'object' ? (div.id || div.division) : div;
                                return discipline.divisionDates?.[divId];
                            })
                            .filter(Boolean);
                        
                        if (divisionDates.length > 0) {
                            competitionDate = divisionDates[0];
                        }
                    }
                    
                    // Fallback to groupDueDates if no divisionDates found
                    if (!competitionDate || competitionDate === projectData.startDate) {
                        const discIndex = (projectData.disciplines || []).indexOf(discipline);
                        const groupIndex = (discipline.patternGroups || []).indexOf(group);
                        competitionDate = projectData.groupDueDates?.[discIndex]?.[groupIndex] || projectData.startDate;
                    }
                    
                    // Get divisions from group, filtered to match the resolved association
                    const allGroupDivisions = group.divisions || [];
                    const divisions = assocId ? allGroupDivisions.filter(div => {
                        if (typeof div === 'string') return true; // Can't filter strings, keep all
                        const divAssoc = (div.assocId || div.association_id || div.association || '').toString().toUpperCase();
                        // Keep division if it has no association tag (shared) or matches current association
                        if (!divAssoc) return true;
                        return divAssoc === assocId.toUpperCase();
                    }) : allGroupDivisions;

                    headerInfo = {
                        showName: showName,
                        showDates: showDates,
                        associationName: associationName,
                        disciplineName: discipline.name || '',
                        competitionDate: competitionDate,
                        divisions: divisions,
                        patternNumber: patternNumberLabel,
                        classGrouping: group.name || `Group ${(discipline.patternGroups || []).indexOf(group) + 1}`
                    };
                    console.log('Header info created from pattern context:', headerInfo);
                } else {
                    // Pattern context not found, use pattern object properties
                    console.warn('Pattern context not found for pattern ID:', numericPatternId, 'Using pattern object properties');
                    
                    // Parse divisions from pattern.divisions (array) or pattern.divisionNames (string)
                    let divisions = [];
                    if (pattern.divisions && Array.isArray(pattern.divisions)) {
                        // Use divisions array directly
                        divisions = pattern.divisions;
                    } else if (pattern.divisionNames) {
                        // Parse division names string into array of objects
                        const divNames = pattern.divisionNames.split(',').map(d => d.trim()).filter(Boolean);
                        divisions = divNames.map(name => ({ division: name, name: name }));
                    }
                    
                    // Use pattern's associationId if available
                    const patternAssocId = pattern.associationId || assocId;
                    
                    headerInfo = {
                        showName: showName,
                        showDates: showDates,
                        associationName: formatAssociationName(patternAssocId),
                        disciplineName: pattern.disciplineName || pattern.discipline || '',
                        competitionDate: projectData.startDate,
                        divisions: divisions,
                        patternNumber: patternNumberLabel,
                        classGrouping: pattern.groupName || (pattern.groupIndex !== undefined ? `Group ${pattern.groupIndex + 1}` : '')
                    };
                    console.log('Header info (from pattern object):', headerInfo);
                }
            } else {
                // No numeric ID, use pattern object properties
                console.log('No numeric ID, using pattern object properties');
                
                // Parse divisions from pattern.divisions (array) or pattern.divisionNames (string)
                let divisions = [];
                if (pattern.divisions && Array.isArray(pattern.divisions)) {
                    // Use divisions array directly
                    divisions = pattern.divisions;
                } else if (pattern.divisionNames) {
                    // Parse division names string into array of objects
                    const divNames = pattern.divisionNames.split(',').map(d => d.trim()).filter(Boolean);
                    divisions = divNames.map(name => ({ division: name, name: name }));
                }
                
                // Use pattern's associationId if available
                const patternAssocId = pattern.associationId || assocId;
                
                headerInfo = {
                    showName: showName,
                    showDates: showDates,
                    associationName: formatAssociationName(patternAssocId),
                    disciplineName: pattern.disciplineName || pattern.discipline || '',
                    competitionDate: projectData.startDate,
                    divisions: divisions,
                    patternNumber: patternNumberLabel,
                    classGrouping: pattern.groupName || (pattern.groupIndex !== undefined ? `Group ${pattern.groupIndex + 1}` : '')
                };
                console.log('Header info (no numeric ID, from pattern object):', headerInfo);
            }
            
            // Fetch maneuvers (pattern language) from DB so the PDF can render them
            let maneuvers = [];
            if (numericPatternId) {
                const { data: maneuverRows, error: maneuverErr } = await supabase
                    .from('tbl_maneuvers')
                    .select('step_no, instruction')
                    .eq('pattern_id', numericPatternId)
                    .order('step_no');
                if (maneuverErr) {
                    console.warn('Failed to load maneuvers for pattern', numericPatternId, maneuverErr);
                } else {
                    maneuvers = maneuverRows || [];
                }
            }

            // Create PDF with full header if in Published state, otherwise with simple title
            const pdfBlob = await createPdfWithFullHeader(imageUrl, patternTitle, headerInfo, maneuvers);
            
            if (!pdfBlob) {
                throw new Error('Failed to create PDF');
            }
            
            // Format filename
            let fileName = patternTitle
                .replace(/\.pdf$/i, '')
                .replace(/[<>:"/\\|?*]/g, '-')
                .replace(/\s+/g, '_')
                .trim();
            
            if (!fileName) fileName = 'Pattern';
            fileName = fileName + '.pdf';
            
            const blobUrl = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            window.URL.revokeObjectURL(blobUrl);
            
            toast({
                title: "Download started",
                description: isPublishedState && headerInfo 
                    ? "Pattern PDF with full header downloaded" 
                    : "Pattern PDF with title downloaded"
            });
            
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
                        if (/^\d+$/.test(scoresheet.id)) {
                            numericId = parseInt(scoresheet.id);
                        } else {
                            // String IDs like "scoresheet-0-1-Western Riding": prefer the
                            // last 1-6 digit run (the real scoresheet ID), not the first.
                            const matches = scoresheet.id.match(/\d+/g);
                            if (matches && matches.length > 0) {
                                const real = [...matches].reverse().find(m => m.length <= 6) || matches[0];
                                numericId = parseInt(real);
                            }
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
            
            // Step 3: Download the file as local file with AI text overlay
            if (imageUrl) {
                try {
                    toast({
                        title: "Processing scoresheet...",
                        description: "Detecting fields and applying text overlay"
                    });
                    
                    // Get overlay data - use per-scoresheet division/judge if available (generated scoresheets)
                    let overlayData;
                    if (scoresheet.divisionName && scoresheet.judgeName) {
                        // Generated scoresheet: use specific division and judge
                        const projectDataLocal = project?.project_data || {};
                        let date = '';
                        // Use per-class date if available
                        if (scoresheet.classDate) {
                            date = scoresheet.classDate;
                        } else {
                            // Fallback: look up divisionDates by matching division name
                            for (const disc of (projectDataLocal.disciplines || [])) {
                                for (const group of (disc.patternGroups || [])) {
                                    for (const div of (group.divisions || [])) {
                                        const divName = div?.name || div?.divisionName || div?.division || div?.title || '';
                                        const divId = div?.id;
                                        if (divName.trim() === scoresheet.divisionName && divId && disc.divisionDates?.[divId]) {
                                            date = disc.divisionDates[divId];
                                            break;
                                        }
                                    }
                                    if (date) break;
                                }
                                if (date) break;
                            }
                            // Final fallback to show start date only (not range)
                            if (!date) date = projectDataLocal.startDate || '';
                        }
                        // Include the actual pattern number so generated scoresheets
                        // also reflect the row's pattern (e.g. "Pattern 0002 – Open Amateur").
                        const pn = scoresheet.patternNumber
                            ? String(scoresheet.patternNumber).padStart(4, '0')
                            : null;
                        const classLabel = pn
                            ? `${scoresheet.disciplineName || ''} \u2013 Pattern ${pn} \u2013 ${scoresheet.divisionName}`.trim()
                            : scoresheet.divisionName;
                        overlayData = {
                            showName: project?.project_name || projectDataLocal.showName || '',
                            className: classLabel,
                            date,
                            judgeName: scoresheet.judgeName,
                        };
                    } else {
                        // Fallback to original context extraction
                        overlayData = getOverlayDataFromContext(project, scoresheet);
                    }
                    console.log('Overlay data:', overlayData);

                    // Resolve which project holds the schedule + results for this
                    // score sheet. Pattern book projects don't have their own
                    // schedule — they must declare a linkedShowProjectId
                    // pointing at the show project that owns the classes.
                    // For show projects (no link), fall back to self.
                    let resultsProjectId = project?.id || null;
                    let resultsProjectData = project?.project_data || null;
                    const linkedShowId = project?.project_data?.linkedShowProjectId;
                    if (linkedShowId) {
                        try {
                            const { data: linked } = await supabase
                                .from('projects')
                                .select('id, project_data')
                                .eq('id', linkedShowId)
                                .maybeSingle();
                            if (linked) {
                                resultsProjectId = linked.id;
                                resultsProjectData = linked.project_data;
                            } else {
                                console.warn('linkedShowProjectId set but project not found:', linkedShowId);
                            }
                        } catch (e) {
                            console.warn('Failed to load linked show project, falling back:', e);
                        }
                    }

                    // Insert a QR record so the printed QR resolves back to this
                    // exact sheet via /s/:id. project_id + class_item_id let
                    // /s/:id/results look up classResults[class_item_id] from
                    // the linked project's project_data.
                    let qrUrl = null;
                    try {
                        const classItemId = findClassItemId(
                            resultsProjectData,
                            scoresheet.disciplineName,
                            scoresheet.divisionName,
                        );
                        const { data: qrInsert, error: qrError } = await supabase
                            .from('score_sheet_qr_codes')
                            .insert({
                                association: scoresheet.association_abbrev || scoresheet.associationId || null,
                                class_name: scoresheet.disciplineName || null,
                                pattern_name: overlayData.className || null,
                                division: scoresheet.divisionName || null,
                                judge_name: scoresheet.judgeName || null,
                                show_name: overlayData.showName || null,
                                show_date: overlayData.date || null,
                                image_url: imageUrl,
                                project_id: resultsProjectId,
                                class_item_id: classItemId,
                            })
                            .select('id')
                            .single();
                        if (qrError) {
                            console.warn('QR record insert failed; continuing without QR:', qrError);
                        } else {
                            qrUrl = `${window.location.origin}/s/${qrInsert.id}`;
                        }
                    } catch (qrEx) {
                        console.warn('QR record insert threw; continuing without QR:', qrEx);
                    }

                    // Apply text overlay using AI detection
                    const blob = await applyTextOverlay(imageUrl, overlayData, qrUrl);
                    const blobUrl = window.URL.createObjectURL(blob);

                    // Determine filename
                    let fileName = 'scoresheet.png';
                    if (scoresheet.divisionName && scoresheet.judgeName) {
                        // Generated scoresheet: use descriptive filename
                        fileName = `${scoresheet.disciplineName || 'Scoresheet'}_${scoresheet.divisionName}_${scoresheet.judgeName}.png`
                            .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
                    } else if (scoresheet.storage_path) {
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
                        title: "Download complete",
                        description: "Scoresheet with project details downloaded"
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

    // Bulk download selected scoresheets as a single ZIP with deduplicated AI calls
    const handleBulkDownloadScoresheets = async () => {
        const selected = displayedScoresheets.filter(s => selectedScoresheetIds.has(s.uniqueKey));
        if (selected.length === 0) return;

        setBulkDownloadProgress({ phase: 'detecting', current: 0, total: 0, message: 'Resolving scoresheet images...' });

        try {
            // Resolve the linked show project once for the whole batch — every
            // QR row inserted below uses the same resolution.
            let resultsProjectId = project?.id || null;
            let resultsProjectData = project?.project_data || null;
            const linkedShowId = project?.project_data?.linkedShowProjectId;
            if (linkedShowId) {
                try {
                    const { data: linked } = await supabase
                        .from('projects')
                        .select('id, project_data')
                        .eq('id', linkedShowId)
                        .maybeSingle();
                    if (linked) {
                        resultsProjectId = linked.id;
                        resultsProjectData = linked.project_data;
                    } else {
                        console.warn('linkedShowProjectId set but project not found:', linkedShowId);
                    }
                } catch (e) {
                    console.warn('Failed to load linked show project, falling back:', e);
                }
            }

            // Phase 0: Resolve image URLs for all selected scoresheets
            const resolvedScoresheets = [];
            for (const scoresheet of selected) {
                let imageUrl = scoresheet.image_url || null;

                if (!imageUrl && scoresheet.id) {
                    let numericId = null;
                    if (typeof scoresheet.id === 'number') {
                        numericId = scoresheet.id;
                    } else if (typeof scoresheet.id === 'string') {
                        if (scoresheet.id.startsWith('scoresheet-')) {
                            const match = scoresheet.id.match(/\d+/);
                            if (match) numericId = parseInt(match[0]);
                        } else if (!isNaN(parseInt(scoresheet.id))) {
                            numericId = parseInt(scoresheet.id);
                        }
                    }
                    if (numericId) {
                        const { data: ssData } = await supabase
                            .from('tbl_scoresheet')
                            .select('id, image_url')
                            .eq('id', numericId)
                            .maybeSingle();
                        if (ssData?.image_url) imageUrl = ssData.image_url;
                    }
                }

                if (!imageUrl && scoresheet.disciplineName && associationsData.length > 0) {
                    const discipline = projectData.disciplines?.[scoresheet.disciplineIndex];
                    const associationId = discipline?.association_id ||
                        (discipline?.selectedAssociations ? Object.keys(discipline.selectedAssociations).find(k => discipline.selectedAssociations[k]) : null);
                    const association = associationsData.find(a => a.id === associationId);
                    if (association?.abbreviation && scoresheet.disciplineName) {
                        const { data: ssData } = await supabase
                            .from('tbl_scoresheet')
                            .select('id, image_url')
                            .eq('association_abbrev', association.abbreviation)
                            .eq('discipline', scoresheet.disciplineName)
                            .limit(1)
                            .maybeSingle();
                        if (ssData?.image_url) imageUrl = ssData.image_url;
                    }
                }

                resolvedScoresheets.push({ scoresheet, imageUrl });
            }

            const downloadable = resolvedScoresheets.filter(r => r.imageUrl);
            if (downloadable.length === 0) {
                toast({ title: 'No scoresheets available', description: 'Could not find image files for selected scoresheets', variant: 'destructive' });
                setBulkDownloadProgress(null);
                return;
            }

            // Phase 1: Deduplicated AI field detection
            const uniqueImageUrls = [...new Set(downloadable.map(r => r.imageUrl))];
            setBulkDownloadProgress({
                phase: 'detecting',
                current: 0,
                total: uniqueImageUrls.length,
                message: `Detecting fields on ${uniqueImageUrls.length} unique template(s)...`
            });

            const fieldPositionsMap = await batchDetectFieldPositions(
                uniqueImageUrls,
                (completed, total) => {
                    setBulkDownloadProgress({
                        phase: 'detecting',
                        current: completed,
                        total,
                        message: `Detecting fields: ${completed} of ${total} template(s)...`
                    });
                }
            );

            // Phase 2: Render overlays in parallel batches and pack into ZIP
            const zip = new JSZip();
            const BATCH_SIZE = 4;
            let renderedCount = 0;
            const totalToRender = downloadable.length;
            const usedFileNames = new Set();

            setBulkDownloadProgress({
                phase: 'rendering',
                current: 0,
                total: totalToRender,
                message: `Rendering scoresheets: 0 of ${totalToRender}...`
            });

            for (let i = 0; i < downloadable.length; i += BATCH_SIZE) {
                const batch = downloadable.slice(i, i + BATCH_SIZE);

                const batchResults = await Promise.allSettled(
                    batch.map(async ({ scoresheet, imageUrl }) => {
                        // Build overlay data (same logic as handleDownloadScoresheet)
                        let overlayData;
                        if (scoresheet.divisionName && scoresheet.judgeName) {
                            const projectDataLocal = project?.project_data || {};
                            let date = '';
                            if (scoresheet.classDate) {
                                date = scoresheet.classDate;
                            } else {
                                for (const disc of (projectDataLocal.disciplines || [])) {
                                    for (const group of (disc.patternGroups || [])) {
                                        for (const div of (group.divisions || [])) {
                                            const divName = div?.name || div?.divisionName || div?.division || div?.title || '';
                                            const divId = div?.id;
                                            if (divName.trim() === scoresheet.divisionName && divId && disc.divisionDates?.[divId]) {
                                                date = disc.divisionDates[divId];
                                                break;
                                            }
                                        }
                                        if (date) break;
                                    }
                                    if (date) break;
                                }
                                if (!date) date = projectDataLocal.startDate || '';
                            }
                            const pn = scoresheet.patternNumber
                                ? String(scoresheet.patternNumber).padStart(4, '0')
                                : null;
                            const classLabel = pn
                                ? `${scoresheet.disciplineName || ''} \u2013 Pattern ${pn} \u2013 ${scoresheet.divisionName}`.trim()
                                : scoresheet.divisionName;
                            overlayData = {
                                showName: project?.project_name || projectDataLocal.showName || '',
                                className: classLabel,
                                date,
                                judgeName: scoresheet.judgeName,
                            };
                        } else {
                            overlayData = getOverlayDataFromContext(project, scoresheet);
                        }

                        // Insert a QR record per scoresheet — one printed sheet,
                        // one scannable id. If insert fails, skip the QR but
                        // still produce the sheet (degraded functionality > broken).
                        let qrUrl = null;
                        try {
                            const classItemId = findClassItemId(
                                resultsProjectData,
                                scoresheet.disciplineName,
                                scoresheet.divisionName,
                            );
                            const { data: qrInsert, error: qrError } = await supabase
                                .from('score_sheet_qr_codes')
                                .insert({
                                    association: scoresheet.association_abbrev || scoresheet.associationId || null,
                                    class_name: scoresheet.disciplineName || null,
                                    pattern_name: overlayData.className || null,
                                    division: scoresheet.divisionName || null,
                                    judge_name: scoresheet.judgeName || null,
                                    show_name: overlayData.showName || null,
                                    show_date: overlayData.date || null,
                                    image_url: imageUrl,
                                    project_id: resultsProjectId,
                                    class_item_id: classItemId,
                                })
                                .select('id')
                                .single();
                            if (qrError) {
                                console.warn('Bulk QR insert failed; continuing without QR:', qrError);
                            } else {
                                qrUrl = `${window.location.origin}/s/${qrInsert.id}`;
                            }
                        } catch (qrEx) {
                            console.warn('Bulk QR insert threw; continuing without QR:', qrEx);
                        }

                        // Apply overlay using pre-resolved positions
                        const positions = fieldPositionsMap.get(imageUrl);
                        const blob = await applyTextOverlayWithPositions(imageUrl, overlayData, positions, qrUrl);

                        // Build filename
                        let fileName = 'scoresheet.png';
                        if (scoresheet.divisionName && scoresheet.judgeName) {
                            fileName = `${scoresheet.disciplineName || 'Scoresheet'}_${scoresheet.divisionName}_${scoresheet.judgeName}.png`
                                .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
                        } else if (scoresheet.displayName) {
                            fileName = scoresheet.displayName.replace(/[^a-zA-Z0-9._-]/g, '_') + '.png';
                        }

                        // Ensure unique filename within ZIP
                        let finalName = fileName;
                        let counter = 1;
                        while (usedFileNames.has(finalName)) {
                            const extIdx = fileName.lastIndexOf('.');
                            finalName = extIdx > 0
                                ? `${fileName.slice(0, extIdx)}_${counter}${fileName.slice(extIdx)}`
                                : `${fileName}_${counter}`;
                            counter++;
                        }
                        usedFileNames.add(finalName);

                        return { fileName: finalName, blob };
                    })
                );

                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        zip.file(result.value.fileName, result.value.blob);
                    } else {
                        console.error('Failed to render scoresheet:', result.reason);
                    }
                    renderedCount++;
                }

                setBulkDownloadProgress({
                    phase: 'rendering',
                    current: renderedCount,
                    total: totalToRender,
                    message: `Rendering scoresheets: ${renderedCount} of ${totalToRender}...`
                });
            }

            // Phase 3: Generate and download ZIP
            setBulkDownloadProgress({
                phase: 'rendering',
                current: totalToRender,
                total: totalToRender,
                message: 'Generating ZIP file...'
            });

            const projectName = (project?.project_name || 'Scoresheets').replace(/[^a-z0-9]/gi, '_');
            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${projectName}_Scoresheets.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            const addedCount = Object.keys(zip.files).length;
            const failedCount = totalToRender - addedCount;
            toast({
                title: 'Download complete',
                description: failedCount > 0
                    ? `Downloaded ${addedCount} scoresheets (${failedCount} failed)`
                    : `Downloaded ${addedCount} scoresheets as ZIP`
            });
        } catch (error) {
            console.error('Bulk download error:', error);
            toast({
                title: 'Download failed',
                description: error.message || 'Failed to download scoresheets',
                variant: 'destructive'
            });
        } finally {
            setBulkDownloadProgress(null);
            setSelectedScoresheetIds(new Set());
        }
    };

    // Bulk move selected scoresheets to folder (batched to avoid stale-state overwrites)
    const handleBulkMoveToFolder = async (folderId) => {
        const selected = displayedScoresheets.filter(s => selectedScoresheetIds.has(s.uniqueKey));
        if (selected.length === 0 || !folderId) return;
        await bulkMoveItemsToFolder(
            selected.map(s => ({ id: s.uniqueKey, type: 'scoresheet', data: s })),
            folderId
        );
        setSelectedScoresheetIds(new Set());
    };

    const handleBulkMovePatternsToFolder = async (folderId) => {
        const selected = filteredPatterns.filter((p, i) => {
            const key = p.uniqueKey || p.id || p.numericId || `pattern-${i}`;
            return selectedPatternIds.has(key);
        });
        if (selected.length === 0 || !folderId) return;
        await bulkMoveItemsToFolder(
            selected.map((p, i) => ({
                id: p.id || p.numericId || p.uniqueKey || `pattern-${i}`,
                type: 'pattern',
                data: p,
            })),
            folderId
        );
        setSelectedPatternIds(new Set());
    };

    // Single-pass move that updates every target folder once, then persists.
    // Item is removed from any other folder it belongs to (move, not copy).
    const bulkMoveItemsToFolder = async (items, folderId) => {
        const targetFolder = folders.find(f => f.id === folderId);
        if (!targetFolder) return;

        const updatedFolders = folders.map(folder => {
            if (folder.id === folderId) {
                const existingKeys = new Set((folder.items || []).map(it => `${it.type}:${it.id}`));
                const additions = items
                    .filter(it => !existingKeys.has(`${it.type}:${it.id}`))
                    .map(it => ({
                        id: it.id,
                        type: it.type,
                        data: it.data,
                        storedAt: new Date().toISOString(),
                    }));
                return { ...folder, items: [...(folder.items || []), ...additions] };
            }
            // Remove items from any other folder so move semantics are honored
            const moveKeys = new Set(items.map(it => `${it.type}:${it.id}`));
            const filtered = (folder.items || []).filter(it => !moveKeys.has(`${it.type}:${it.id}`));
            return filtered.length === (folder.items || []).length ? folder : { ...folder, items: filtered };
        });

        setFolders(updatedFolders);
        await saveFoldersToProject(updatedFolders);
        toast({
            title: 'Moved to folder',
            description: `Moved ${items.length} item${items.length === 1 ? '' : 's'} to "${targetFolder.name}"`,
        });
    };

    // Helper: get all association IDs for a discipline
    const getDisciplineAssocIdsLocal = (d) => {
        const ids = new Set();
        const projectAssocIds = Object.keys(projectData.associations || {})
            .filter(k => projectData.associations[k])
            .map(k => String(k).toUpperCase());
        const isValidKey = (k) => { const s = String(k || '').trim(); return s && !/^\d+$/.test(s); };
        if (isValidKey(d.association_id)) ids.add(String(d.association_id).toUpperCase());
        if (d.selectedAssociations && typeof d.selectedAssociations === 'object') {
            Object.keys(d.selectedAssociations).forEach(k => { if (d.selectedAssociations[k] && isValidKey(k)) ids.add(String(k).toUpperCase()); });
        }
        if (d.associations && typeof d.associations === 'object' && !Array.isArray(d.associations)) {
            Object.keys(d.associations).forEach(k => { if (d.associations[k] && isValidKey(k)) ids.add(String(k).toUpperCase()); });
        }
        if (ids.size <= 1 && projectAssocIds.length > 1) {
            projectAssocIds.forEach(a => ids.add(a));
        }
        return [...ids];
    };

    // Discipline options filtered by selected associations
    const disciplineOptions = useMemo(() => {
        let disciplines = (projectData.disciplines || []);
        if (filterAssociations.size > 0) {
            disciplines = disciplines.filter(d => {
                const aids = getDisciplineAssocIdsLocal(d);
                return aids.some(a => filterAssociations.has(a));
            });
        }
        return [...new Set(disciplines.map(d => (d?.name || '').trim()))].filter(Boolean).sort();
    }, [projectData, filterAssociations]);

    // Get unique division names from patterns AND project data disciplines
    const allDivisionNamesFromPatterns = patterns.flatMap(p => {
        if (p.divisionNames) {
            return p.divisionNames.replace(/^\(|\)$/g, '').split(',').map(d => d.trim()).filter(Boolean);
        }
        if (p.divisions && Array.isArray(p.divisions)) {
            return p.divisions.map(d => d.name || d.divisionName || d.division || '').filter(Boolean);
        }
        return [];
    });
    // Extract a displayable division name from a division object or string
    // Simplify division names by removing the division-group prefix.
    // Division names are stored as "{Group} - {Level}" (e.g., "Amateur - Amateur (19 & Over)",
    // "Amateur - Novice Amateur", "Youth - Youth 18 & Under").
    // The group prefix is redundant in display — the level conveys the full meaning.
    // Result: "Amateur (19 & Over)", "Novice Amateur", "Youth 18 & Under".
    const simplifyDivisionName = (name) => {
        if (!name) return '';
        const idx = name.indexOf(' - ');
        if (idx === -1) return name;
        const level = name.slice(idx + 3).trim();
        // Use the level part if it's not empty
        if (level) return level;
        return name;
    };

    const extractDivisionName = (div) => {
        if (typeof div === 'string') return simplifyDivisionName(div);
        // Try standard name fields first
        const name = div?.name || div?.divisionName || div?.division || div?.title || '';
        if (name.trim()) return simplifyDivisionName(name.trim());
        // Fallback: extract from ID (custom divisions may have id like "custom-All Breed Open Horse")
        if (typeof div?.id === 'string') {
            const cleaned = div.id.replace(/^custom-/i, '').trim();
            if (cleaned) return simplifyDivisionName(cleaned);
        }
        return '';
    };

    // Derive all available divisions from project data with association tagging
    const allDivisionNamesFromProjectData = useMemo(() => {
        const divs = new Set();
        (projectData.disciplines || []).forEach(discipline => {
            (discipline.patternGroups || []).forEach(group => {
                (group.divisions || []).forEach(div => {
                    const name = extractDivisionName(div);
                    if (name) divs.add(name);
                });
            });
        });
        return [...divs];
    }, [projectData]);

    // Normalize a division name to prevent duplicates like "Open Green Horse" vs "Green Horse"
    const normalizeDivisionName = (name) => {
        if (!name) return '';
        let cleaned = name.trim();
        // Remove leading "Open " prefix when a more specific name follows (e.g., "Open Green Horse" → "Green Horse")
        // But keep standalone "Open" or compound names like "Open All Ages"
        if (/^Open\s+/i.test(cleaned) && !/^Open\s+(All\s+)/i.test(cleaned) && cleaned.split(/\s+/).length > 2) {
            const withoutOpen = cleaned.replace(/^Open\s+/i, '').trim();
            // Only strip if the remainder is a known division name
            if (allDivisionNamesFromProjectData.some(d => d.toLowerCase() === withoutOpen.toLowerCase())) {
                cleaned = withoutOpen;
            }
        }
        return cleaned;
    };

    // Build divisions grouped by association for the dropdown
    const { uniqueDivisions, divisionsByAssociation } = useMemo(() => {
        const assocDivMap = {}; // { ASSOC: Set<divName> }
        const allDivs = new Set();

        (projectData.disciplines || []).forEach(discipline => {
            const assocIds = getDisciplineAssocIdsLocal(discipline);
            (discipline.patternGroups || []).forEach(group => {
                (group.divisions || []).forEach(div => {
                    const rawName = extractDivisionName(div);
                    const divAssoc = typeof div === 'object' && div
                        ? (div.assocId || div.association_id || div.association || '')
                        : '';
                    const name = normalizeDivisionName(rawName);
                    if (!name) return;

                    // Tag this division with its association(s)
                    const divAssocNorm = divAssoc ? String(divAssoc).toUpperCase() : '';
                    const targetAssocs = divAssocNorm ? [divAssocNorm] : assocIds;
                    targetAssocs.forEach(a => {
                        if (!assocDivMap[a]) assocDivMap[a] = new Set();
                        assocDivMap[a].add(name);
                    });
                    allDivs.add(name);
                });
            });
        });

        // Also add pattern-sourced divisions
        allDivisionNamesFromPatterns.forEach(d => {
            const normalized = normalizeDivisionName(d);
            if (normalized) allDivs.add(normalized);
        });

        // Filter by selected associations
        let filteredDivs;
        if (filterAssociations.size > 0) {
            filteredDivs = new Set();
            filterAssociations.forEach(assocId => {
                const divs = assocDivMap[assocId];
                if (divs) divs.forEach(d => filteredDivs.add(d));
            });
        } else {
            filteredDivs = allDivs;
        }

        // Deduplicate: if both "Open Green Horse" and "Green Horse" exist, keep only "Green Horse"
        const finalDivs = [...filteredDivs].sort();
        const deduped = [];
        const lowerSet = new Set(finalDivs.map(d => d.toLowerCase()));
        for (const div of finalDivs) {
            const withOpen = `Open ${div}`;
            // Skip if this is the "Open X" variant and the shorter "X" also exists
            if (/^Open\s+/i.test(div)) {
                const shorter = div.replace(/^Open\s+/i, '').trim();
                if (lowerSet.has(shorter.toLowerCase())) continue;
            }
            deduped.push(div);
        }

        return {
            uniqueDivisions: deduped,
            divisionsByAssociation: assocDivMap,
        };
    }, [projectData, filterAssociations, allDivisionNamesFromPatterns, allDivisionNamesFromProjectData]);

    // Get unique dates from divisionDates and show date range
    const uniqueDates = useMemo(() => {
        const dates = new Set();
        // Collect per-division dates
        (projectData.disciplines || []).forEach(discipline => {
            Object.values(discipline.divisionDates || {}).forEach(d => {
                if (d) dates.add(d);
            });
        });
        // Also include all dates from show date range
        if (projectData.startDate) {
            dates.add(projectData.startDate);
            if (projectData.endDate && projectData.endDate !== projectData.startDate) {
                // Generate each day between start and end
                const start = parseLocalDate(projectData.startDate);
                const end = parseLocalDate(projectData.endDate);
                const current = new Date(start);
                while (current <= end) {
                    dates.add(format(current, 'yyyy-MM-dd'));
                    current.setDate(current.getDate() + 1);
                }
            }
        }
        return [...dates].sort();
    }, [projectData]);

    // Get unique judges from patterns and project data
    // (associationJudges, showDetails.judges, officials, groupJudges, patternSelections)
    const allJudgesFromPatterns = patterns.flatMap(p => p.judges || []);
    const allJudgesFromProjectData = useMemo(() => {
        const judges = new Set();
        // From associationJudges
        Object.values(projectData.associationJudges || {}).forEach(assocData => {
            (assocData?.judges || []).forEach(j => {
                if (j?.name) judges.add(j.name.trim());
            });
        });
        // From showDetails.judges (Step 4 "Number of Judges" UI — canonical storage)
        Object.values(projectData.showDetails?.judges || {}).forEach(list => {
            (list || []).forEach(j => { if (j?.name) judges.add(j.name.trim()); });
        });
        // From officials
        (projectData.officials || []).forEach(o => {
            if (o?.role === 'judge' && o?.name) judges.add(o.name.trim());
        });
        // From groupJudges
        Object.values(projectData.groupJudges || {}).forEach(disciplineGroups => {
            if (typeof disciplineGroups === 'object' && !Array.isArray(disciplineGroups)) {
                Object.values(disciplineGroups).forEach(val => {
                    if (typeof val === 'string' && val.trim()) judges.add(val.trim());
                    if (Array.isArray(val)) val.forEach(j => { if (typeof j === 'string' && j.trim()) judges.add(j.trim()); });
                });
            } else if (Array.isArray(disciplineGroups)) {
                disciplineGroups.forEach(j => { if (typeof j === 'string' && j.trim()) judges.add(j.trim()); });
            }
        });
        // From patternSelections (judges assigned at discipline/group level in Step 5)
        Object.values(projectData.patternSelections || {}).forEach(disciplineSels => {
            if (disciplineSels && typeof disciplineSels === 'object') {
                forEachPatternSelection(disciplineSels, (_g, _a, sel) => {
                    if (sel?.type === 'judgeAssigned' && sel?.judgeName?.trim()) {
                        judges.add(sel.judgeName.trim());
                    }
                });
            }
        });
        return [...judges];
    }, [projectData]);
    const uniqueJudges = [...new Set([...allJudgesFromPatterns, ...allJudgesFromProjectData])].filter(Boolean).sort();

    // Get unique associations from project disciplines and build association→judges mapping
    const { uniqueAssociations, judgesByAssociation } = useMemo(() => {
        const assocs = new Set();
        const judgeMap = {}; // { assocId: Set<judgeName> }

        // Collect associations from disciplines
        (projectData.disciplines || []).forEach(d => {
            const aid = d.association_id ||
                (d.selectedAssociations ? Object.keys(d.selectedAssociations).find(k => d.selectedAssociations[k]) : null) ||
                (d.associations ? Object.keys(d.associations).find(k => d.associations[k]) : null);
            if (aid) assocs.add(aid.toUpperCase());
        });
        // Also from project-level associations
        Object.keys(projectData.associations || {}).forEach(k => {
            if (projectData.associations[k]) assocs.add(k.toUpperCase());
        });

        // Build judge→association mapping from associationJudges
        Object.entries(projectData.associationJudges || {}).forEach(([assocId, assocData]) => {
            const key = assocId.toUpperCase();
            if (!judgeMap[key]) judgeMap[key] = new Set();
            (assocData?.judges || []).forEach(j => {
                if (j?.name) judgeMap[key].add(j.name.trim());
            });
        });
        // From showDetails.judges (keyed by association)
        Object.entries(projectData.showDetails?.judges || {}).forEach(([assocId, list]) => {
            const key = assocId.toUpperCase();
            if (!judgeMap[key]) judgeMap[key] = new Set();
            (list || []).forEach(j => { if (j?.name) judgeMap[key].add(j.name.trim()); });
        });

        return {
            uniqueAssociations: [...assocs].sort(),
            judgesByAssociation: judgeMap,
        };
    }, [projectData]);

    // When association filter changes, compute which judges are available
    const filteredJudgeOptions = useMemo(() => {
        if (filterAssociations.size === 0) return uniqueJudges;
        const allowed = new Set();
        filterAssociations.forEach(assocId => {
            const judges = judgesByAssociation[assocId.toUpperCase()];
            if (judges) judges.forEach(j => allowed.add(j));
        });
        // If no judges mapped for selected associations, show all (graceful fallback)
        return allowed.size > 0 ? uniqueJudges.filter(j => allowed.has(j)) : uniqueJudges;
    }, [filterAssociations, judgesByAssociation, uniqueJudges]);

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
                        // Use stored data if available, otherwise try to find in generated scoresheets
                        if (item.data) {
                            return item.data;
                        }
                        // Try to find scoresheet in generated array by ID or uniqueKey
                        const foundScoresheet = generatedScoresheets.find(s => {
                            const sId = s.id || s.numericId || s.uniqueKey;
                            return (item.id === sId || item.id === String(sId));
                        });
                        return foundScoresheet;
                    })
                    .filter(Boolean); // Remove any undefined items
            }
        }
        return [];
    }, [selectedSidebarItem, selectedFolderId, folders, generatedScoresheets]);

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

        // Association filter - strict: match against the pattern's resolved associationId
        // For dual-affiliated shows, each pattern group has a specific association derived from its groupName
        if (filterAssociations.size > 0) {
            const patternAssocId = String(pattern.associationId || '').toUpperCase();
            const patternGroupName = String(pattern.groupName || '').toUpperCase();

            // First try: exact match on the resolved associationId
            let matched = filterAssociations.has(patternAssocId);

            // Second try: check if groupName starts with a selected association abbreviation
            if (!matched && patternGroupName) {
                matched = Array.from(filterAssociations).some(sel => {
                    const s = sel.toUpperCase();
                    return patternGroupName.startsWith(s + ' ') || patternGroupName === s;
                });
            }

            // Fallback for patterns without a groupName: check if any of the discipline's associations match
            if (!matched && !patternGroupName) {
                const allAssocIds = (pattern.associationIds || []).map(a => String(a).toUpperCase());
                matched = allAssocIds.some(a => filterAssociations.has(a));
            }

            if (!matched) return false;
        }
        // Multi-select discipline filter
        if (filterDisciplines.size > 0) {
            const patternDiscipline = (pattern.discipline || '').trim();
            if (!filterDisciplines.has(patternDiscipline)) return false;
        }
        // Multi-select division filter (match against actual division names)
        if (filterDivisions.size > 0) {
            // Extract individual division names from the pattern
            let patternDivNames = [];
            if (pattern.divisionNames) {
                patternDivNames = pattern.divisionNames.replace(/^\(|\)$/g, '').split(',').map(d => d.trim()).filter(Boolean);
            } else if (pattern.divisions && Array.isArray(pattern.divisions)) {
                patternDivNames = pattern.divisions.map(d => d.name || d.divisionName || d.division || '').filter(Boolean);
            }
            const hasMatchingDivision = patternDivNames.some(divName =>
                Array.from(filterDivisions).some(selected =>
                    divName.toLowerCase() === selected.toLowerCase()
                )
            );
            if (!hasMatchingDivision) return false;
        }
        // Date filter
        if (filterDates.size > 0) {
            if (!pattern.classDate || !filterDates.has(pattern.classDate)) return false;
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
    
    // Display scoresheets: use generated list (already filtered at generation time), with sorting.
    // Defensively filter by all active filters so stale rows from a previous generation
    // don't leak through while a regeneration is in flight.
    const displayedScoresheets = useMemo(() => {
        const base = selectedSidebarItem === 'folder' && selectedFolderId
            ? folderItemsAsScoresheets
            : generatedScoresheets;

        const list = base.filter(s => {
            // Association filter
            if (filterAssociations.size > 0) {
                const abbrev = String(s.association_abbrev || s.associationId || '').toUpperCase();
                if (!filterAssociations.has(abbrev)) return false;
            }
            // Discipline filter
            if (filterDisciplines.size > 0) {
                if (!filterDisciplines.has((s.disciplineName || '').trim())) return false;
            }
            // Division filter
            if (filterDivisions.size > 0) {
                if (!Array.from(filterDivisions).some(sel => sel.toLowerCase() === (s.divisionName || '').toLowerCase())) return false;
            }
            // Judge filter
            if (filterJudges.size > 0) {
                if (!filterJudges.has((s.judgeName || '').trim())) return false;
            }
            return true;
        });

        return [...list].sort((a, b) => {
            if (scoresheetSortBy === 'association') {
                const cmp = (a.associationId || '').localeCompare(b.associationId || '');
                return cmp !== 0 ? cmp : (a.divisionName || '').localeCompare(b.divisionName || '');
            }
            if (scoresheetSortBy === 'division') return (a.divisionName || '').localeCompare(b.divisionName || '');
            if (scoresheetSortBy === 'judge') return (a.judgeName || '').localeCompare(b.judgeName || '');
            if (scoresheetSortBy === 'discipline') return (a.disciplineName || '').localeCompare(b.disciplineName || '');
            if (scoresheetSortBy === 'name') return (a.displayName || '').localeCompare(b.displayName || '');
            return 0;
        });
    }, [generatedScoresheets, folderItemsAsScoresheets, selectedSidebarItem, selectedFolderId, scoresheetSortBy, filterAssociations, filterDisciplines, filterDivisions, filterJudges]);
    
    // Fetch data when dialog opens or tabs change
    useEffect(() => {
        if (activeTab === 'patternBook' && activeSubTab === 'patterns') {
            fetchPatterns();
        } else if (activeTab === 'patternBook' && activeSubTab === 'scoreSheets' && generatedScoresheets.length === 0 && !isGeneratingScoresheets) {
            // Auto-generate all score sheets on first tab visit
            generateScoresheets();
        }
    }, [activeTab, activeSubTab]);

    // Auto-regenerate score sheets when filters change
    useEffect(() => {
        if (activeTab === 'patternBook' && activeSubTab === 'scoreSheets') {
            generateScoresheets();
        }
    }, [filterDisciplines, filterDivisions, filterJudges, filterDates, filterAssociations]);

    const fetchPatterns = async () => {
        setIsLoadingPatterns(true);
        try {
            const disciplines = projectData.disciplines || [];
            const patternSelections = projectData.patternSelections || {};
            const patternsList = [];
            const processedPatterns = new Set();
            
            
            // Collect numeric pattern IDs for database lookup
            const numericPatternIds = new Set();
            
            // First pass: collect numeric pattern IDs from all possible patternSelections structures
            // Iterate through all patternSelections keys to find patterns
            Object.keys(patternSelections).forEach(disciplineKey => {
                const disciplineSelections = patternSelections[disciplineKey];
                if (!disciplineSelections || typeof disciplineSelections !== 'object') return;

                // Iterate through all groups (and assoc-scoped entries) in this discipline selection
                forEachPatternSelection(disciplineSelections, (_groupKey, _abbrev, patternSelection) => {
                    if (!patternSelection) return;

                    const patternId = typeof patternSelection === 'object'
                        ? (patternSelection.patternId ?? patternSelection.pattern_id ?? patternSelection.id)
                        : patternSelection;

                    // Extract numeric ID — same rules as the build-pass below
                    if (typeof patternId === 'number') {
                        numericPatternIds.add(patternId);
                    } else if (typeof patternId === 'string') {
                        if (/^\d+$/.test(patternId)) {
                            numericPatternIds.add(parseInt(patternId));
                        } else {
                            const m = patternId.match(/\d+/g);
                            if (m) {
                                const real = m.find(x => x.length <= 6) || m[0];
                                numericPatternIds.add(parseInt(real));
                            }
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
                    
                    const discAbbrev = associationId ? String(associationId).toUpperCase() : null;
                    let patternSelection = getPatternSelectionForAssoc(disciplineSelections, groupIndex, discAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, `${groupIndex}`, discAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, groupId, discAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, group.id, discAbbrev);

                    // Try to find by group ID pattern
                    if (!patternSelection && groupId) {
                        const matchingGroupKey = Object.keys(disciplineSelections).find(key => {
                            return key === groupId || key.includes('pattern-group') || key === `group-${groupIndex}`;
                        });
                        if (matchingGroupKey) {
                            patternSelection = getPatternSelectionForAssoc(disciplineSelections, matchingGroupKey, discAbbrev);
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
                    .select('pattern_id, image_url, file_url')
                    .in('pattern_id', Array.from(numericPatternIds));

                if (patternMediaData) {
                    patternMediaData.forEach(pm => {
                        patternDetailsMap[pm.pattern_id] = {
                            image_url: pm.image_url,
                            pdf_url: pm.file_url || pm.image_url,
                            download_url: pm.file_url || pm.image_url
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
                    }
                }
                
                if (!disciplineSelections) {
                   
                    continue;
                }
                
                const groups = discipline.patternGroups || [];
                const groupJudges = projectData.groupJudges?.[disciplineIndex] || projectData.groupJudges?.[`${disciplineIndex}`] || {};
                

                
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    // Hide group name when there's only 1 group (no manual grouping)
                    const groupName = groups.length > 1 ? (group.name || `Group ${groupIndex + 1}`) : '';
                    const groupId = group.id || `pattern-group-${groupIndex}`;

                    const buildDiscAbbrev = associationId ? String(associationId).toUpperCase() : null;
                    // Try multiple ways to find pattern selection (assoc-aware)
                    let patternSelection = getPatternSelectionForAssoc(disciplineSelections, groupIndex, buildDiscAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, `${groupIndex}`, buildDiscAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, groupId, buildDiscAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, group.id, buildDiscAbbrev)
                        || (Array.isArray(disciplineSelections) ? disciplineSelections[groupIndex] : null);

                    // If not found, try to find by group ID pattern (e.g., "pattern-group-1767684453160")
                    if (!patternSelection && groupId) {
                        const matchingGroupKey = Object.keys(disciplineSelections).find(key => {
                            return key === groupId || key.includes('pattern-group') || key === `group-${groupIndex}`;
                        });

                        if (matchingGroupKey) {
                            patternSelection = getPatternSelectionForAssoc(disciplineSelections, matchingGroupKey, buildDiscAbbrev);
                        }
                    }

                    // Single-group fallback: use first available selection
                    if (!patternSelection && groups.length === 1) {
                        const firstKey = Object.keys(disciplineSelections)[0];
                        if (firstKey) patternSelection = getPatternSelectionForAssoc(disciplineSelections, firstKey, buildDiscAbbrev);
                    }

                    if (!patternSelection) {
                        continue;
                    }


                    // Get pattern ID - prefer the explicit numeric patternId / pattern_id field.
                    // String IDs like "pattern-2-1767684438175" embed timestamps that the old
                    // regex would mis-parse, causing pattern #2 to be replaced by pattern #1, etc.
                    let patternId = typeof patternSelection === 'object'
                        ? (patternSelection.patternId ?? patternSelection.pattern_id ?? patternSelection.id)
                        : patternSelection;

                    // Get version from patternSelection if available
                    const patternVersion = typeof patternSelection === 'object'
                        ? (patternSelection.version || patternSelection.patternVersion || patternSelection.pattern_version || 'ALL')
                        : 'ALL';

                    // Extract numeric ID. Trust numeric values directly; only regex-parse
                    // string IDs as a last resort (and use the LAST digit run, which the
                    // upload pipeline appends as the real pattern_id).
                    let numericPatternId = null;
                    if (typeof patternId === 'number') {
                        numericPatternId = patternId;
                    } else if (typeof patternId === 'string') {
                        if (/^\d+$/.test(patternId)) {
                            numericPatternId = parseInt(patternId);
                        } else if (typeof patternSelection === 'object' && typeof patternSelection.patternId === 'number') {
                            numericPatternId = patternSelection.patternId;
                        } else {
                            const matches = patternId.match(/\d+/g);
                            if (matches && matches.length > 0) {
                                // Prefer a 1–6 digit run (real pattern ids), skip 10+ digit timestamps
                                const real = matches.find(m => m.length <= 6) || matches[0];
                                numericPatternId = parseInt(real);
                            }
                        }
                    }
                    
                    
                    // Get pattern detail from database if we have numeric ID
                    const patternDetail = numericPatternId ? patternDetailsMap[numericPatternId] : null;
                    
                    if (patternDetail) {
                    } else if (numericPatternId) {
                    }
                    
                    // Extract divisions for this group (include assocId — the canonical
                    // field written by the Pattern Book Builder on each group division).
                    const divisions = Array.isArray(group.divisions) ? group.divisions : [];
                    const extractedDivisions = divisions.map(div => {
                        const name = extractDivisionName(div);
                        const association = (typeof div === 'object' && div)
                            ? (div.assocId || div.association || div.assocName || div.association_id || '')
                            : '';
                        return { name, association };
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
                    
                    // Compute classDate from divisionDates for the first division in this group
                    let classDate = null;
                    const groupDivisions = group.divisions || [];
                    for (const div of groupDivisions) {
                        const divId = typeof div === 'string' ? div : div?.id;
                        if (divId && discipline.divisionDates?.[divId]) {
                            classDate = discipline.divisionDates[divId];
                            break;
                        }
                    }
                    if (!classDate) {
                        classDate = projectData.groupDueDates?.[disciplineIndex]?.[groupIndex] || projectData.startDate || null;
                    }

                    // Create unique key based on content, not just indices, to prevent duplicates
                    const uniqueKey = `${disciplineName}-${groupName}-${numericPatternId || patternId || 'no-pattern'}-${patternVersion || 'default'}`;

                    // Resolve the pattern-card's association up-front so the badge and the
                    // divisionNames filter always agree. Priority order:
                    //   1. Group-name prefix (explicit user tagging, e.g. "APHA WR Novice")
                    //   2. Actual divisions inside the group — their assocId plus name-based
                    //      forced rules (e.g. "Green Horse" / "Novice Amateur" are APHA-only;
                    //      "Level 1" / "Open All Aged" / bare "Amateur" are AQHA-only)
                    //   3. Discipline-level association fallback
                    const resolvedPatternAssoc = (() => {
                        const allAssocIds = getDisciplineAssocIdsLocal(discipline);
                        if (groupName && allAssocIds.length > 0) {
                            const gn = groupName.toUpperCase();
                            const matchedAssoc = allAssocIds.find(a => gn.startsWith(a + ' ') || gn === a);
                            if (matchedAssoc) return matchedAssoc;
                        }
                        const divAssocs = new Set();
                        divisions.forEach(div => {
                            if (typeof div === 'object' && div) {
                                const aid = div.assocId || div.association_id || div.association || div.assocName;
                                if (aid) divAssocs.add(String(aid).toUpperCase());
                            }
                            const forced = getForcedAssocForDivision(extractDivisionName(div));
                            if (forced) divAssocs.add(forced);
                        });
                        if (divAssocs.size === 1) return [...divAssocs][0];
                        if (divAssocs.size > 1) {
                            const discUpper = allAssocIds.map(a => String(a).toUpperCase());
                            const match = [...divAssocs].find(a => discUpper.includes(a));
                            if (match) return match;
                            return [...divAssocs][0];
                        }
                        return buildDiscAbbrev || patternDetail?.association_id || discipline.association_id;
                    })();

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
                            associationId: resolvedPatternAssoc,
                            association_name: patternDetail?.association_name || null,
                            associationIds: getDisciplineAssocIdsLocal(discipline),
                            groupName: groupName,
                            groupId: group.id,
                            groupIndex: groupIndex,
                            classDate, // Per-class competition date
                            divisions: extractedDivisions,
                            divisionNames: (() => {
                                // Use the same resolved assoc as the badge so divisions
                                // shown on the card match the assoc that's displayed.
                                const patAssocUpper = String(resolvedPatternAssoc || '').toUpperCase();
                                return [...new Set(extractedDivisions.map(d => {
                                    const name = d.name || '';
                                    // Skip divisions that belong to a different association
                                    const forced = getForcedAssocForDivision(name);
                                    if (forced && patAssocUpper && forced !== patAssocUpper) return null;
                                    const parts = name.split(' - ');
                                    return parts.length > 1 ? parts.slice(1).join(' - ') : name;
                                }).filter(Boolean))].join(', ');
                            })(),
                            judges: judgeNames,
                            judgeNames: judgeNames.join(', '),
                            image_url: patternDetail?.image_url || null, // Pattern image for display
                            pdf_url: patternDetail?.pdf_url || patternDetail?.download_url || patternDetail?.url || patternDetail?.image_url || null // URL for download
                        });
                        processedPatterns.add(uniqueKey);
                      
                    }
                }
            }
            
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
                    }
                }
                
                if (!disciplineSelections) continue;
                
                const groups = discipline.patternGroups || [];
                const ssDiscAbbrev = associationId ? String(associationId).toUpperCase() : null;
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    const groupId = group.id || `pattern-group-${groupIndex}`;

                    // Try multiple ways to find pattern selection (assoc-aware)
                    let patternSelection = getPatternSelectionForAssoc(disciplineSelections, groupIndex, ssDiscAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, `${groupIndex}`, ssDiscAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, groupId, ssDiscAbbrev)
                        || getPatternSelectionForAssoc(disciplineSelections, group.id, ssDiscAbbrev);

                    // If not found, try to find by group ID pattern
                    if (!patternSelection && groupId) {
                        const matchingGroupKey = Object.keys(disciplineSelections).find(key => {
                            return key === groupId || key.includes('pattern-group');
                        });
                        if (matchingGroupKey) {
                            patternSelection = getPatternSelectionForAssoc(disciplineSelections, matchingGroupKey, ssDiscAbbrev);
                        }
                    }

                    if (!patternSelection) continue;

                    const patternId = typeof patternSelection === 'object'
                        ? (patternSelection.patternId ?? patternSelection.pattern_id ?? patternSelection.id)
                        : patternSelection;

                    // Extract numeric pattern ID — prefer numeric, avoid timestamp digits
                    let numericPatternId = null;
                    if (typeof patternId === 'number') {
                        numericPatternId = patternId;
                    } else if (typeof patternId === 'string') {
                        if (/^\d+$/.test(patternId)) {
                            numericPatternId = parseInt(patternId);
                        } else {
                            const matches = patternId.match(/\d+/g);
                            if (matches && matches.length > 0) {
                                const real = matches.find(m => m.length <= 6) || matches[0];
                                numericPatternId = parseInt(real);
                            }
                        }
                    }

                    if (numericPatternId) {
                        selectedPatternIds.push(numericPatternId);
                        // Key by pattern + discipline+group so APHA/AQHA don't collide
                        const mapKey = `${numericPatternId}__${disciplineIndex}__${groupIndex}`;
                        patternIdToDisciplineMap[mapKey] = {
                            disciplineIndex,
                            disciplineName,
                            groupIndex,
                            groupName: groups[groupIndex]?.name || `Group ${groupIndex + 1}`,
                            association_id: associationId,
                            discipline: discipline
                        };
                    }
                }
            }
            
            const uniquePatternIds = [...new Set(selectedPatternIds)].filter(id => !isNaN(id) && isFinite(id));
            
            // Step 2: Fetch scoresheets by pattern_id, indexed by (pattern_id, association)
            // so an APHA + AQHA pair sharing the same pattern_id don't overwrite each other.
            const scoresheetMap = {}; // key: `${pattern_id}__${association_abbrev}` (lowercase)
            const scoresheetByPattern = {}; // fallback: pattern_id -> first scoresheet seen

            const ssKey = (pid, abbrev) => `${pid}__${String(abbrev || '').toLowerCase()}`;

            if (uniquePatternIds.length > 0) {
                try {
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
                                scoresheetMap[ssKey(s.pattern_id, s.association_abbrev)] = s;
                                if (!scoresheetByPattern[s.pattern_id]) {
                                    scoresheetByPattern[s.pattern_id] = s;
                                }
                            }
                        });
                    }

                    // Fallback: For every (pattern, discipline, association) tuple that has no
                    // matching scoresheet yet, query by association_abbrev + discipline.
                    for (const mapKey of Object.keys(patternIdToDisciplineMap)) {
                        const disciplineInfo = patternIdToDisciplineMap[mapKey];
                        const patternId = parseInt(mapKey.split('__')[0]);
                        const association = associationsMap[disciplineInfo.association_id];
                        const associationAbbrev = association?.abbreviation || disciplineInfo.association_id;
                        if (!associationAbbrev) continue;
                        const key = ssKey(patternId, associationAbbrev);
                        if (scoresheetMap[key]) continue;

                        try {
                            const { data: fallbackData } = await supabase
                                .from('tbl_scoresheet')
                                .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev, city_state')
                                .eq('association_abbrev', associationAbbrev)
                                .eq('discipline', disciplineInfo.disciplineName)
                                .limit(1)
                                .maybeSingle();
                            if (fallbackData) {
                                scoresheetMap[key] = fallbackData;
                                if (!scoresheetByPattern[patternId]) {
                                    scoresheetByPattern[patternId] = fallbackData;
                                }
                            }
                        } catch (fallbackErr) {
                            console.error(`Error fetching fallback scoresheet for pattern ${patternId} / ${associationAbbrev}:`, fallbackErr);
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
                    }
                }
                
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];
                    const groupName = groups.length > 1 ? (group.name || `Group ${groupIndex + 1}`) : '';
                    const groupId = group.id || `pattern-group-${groupIndex}`;

                    // Get judges for this group — tries per-group, discipline-level,
                    // and association-level judges in priority order.
                    const judgesForGroup = groupJudges[groupIndex]
                        || groupJudges[`${groupIndex}`]
                        || groupJudges[group.id]
                        || [];
                    let judgeNames = Array.isArray(judgesForGroup)
                        ? judgesForGroup.filter(Boolean)
                        : (judgesForGroup ? [judgesForGroup] : []);

                    if (judgeNames.length === 0) {
                        const discLevel = projectData.judgeSelections?.[disciplineIndex]
                            || projectData.judgeSelections?.[`${disciplineIndex}`]
                            || projectData.judgeSelections?.[discipline.id];
                        if (discLevel) {
                            judgeNames = Array.isArray(discLevel) ? discLevel.filter(Boolean) : [discLevel];
                        }
                    }
                    if (judgeNames.length === 0 && associationId) {
                        const showDetailsJudges = projectData.showDetails?.judges?.[associationId] || [];
                        const sdNames = showDetailsJudges.map(j => j?.name).filter(Boolean);
                        if (sdNames.length > 0) judgeNames = sdNames;
                    }
                    if (judgeNames.length === 0 && associationId) {
                        const assocJudges = projectData.associationJudges?.[associationId]?.judges || [];
                        const assocNames = assocJudges.map(j => j?.name).filter(Boolean);
                        if (assocNames.length > 0) judgeNames = assocNames;
                    }
                    if (judgeNames.length === 0) {
                        const allShowJudges = Object.values(projectData.showDetails?.judges || {})
                            .flat()
                            .map(j => j?.name)
                            .filter(Boolean);
                        if (allShowJudges.length > 0) judgeNames = allShowJudges;
                    }

                    const buildSSAbbrev = associationId ? String(associationId).toUpperCase() : null;
                    // Get pattern selection to find pattern ID - try multiple matching strategies
                    let patternSelection = disciplineSelections
                        ? (getPatternSelectionForAssoc(disciplineSelections, groupIndex, buildSSAbbrev)
                            || getPatternSelectionForAssoc(disciplineSelections, `${groupIndex}`, buildSSAbbrev)
                            || getPatternSelectionForAssoc(disciplineSelections, groupId, buildSSAbbrev)
                            || getPatternSelectionForAssoc(disciplineSelections, group.id, buildSSAbbrev))
                        : null;

                    // If not found, try to find by group ID pattern
                    if (!patternSelection && disciplineSelections && groupId) {
                        const matchingGroupKey = Object.keys(disciplineSelections).find(key => {
                            return key === groupId || key.includes('pattern-group');
                        });
                        if (matchingGroupKey) {
                            patternSelection = getPatternSelectionForAssoc(disciplineSelections, matchingGroupKey, buildSSAbbrev);
                        }
                    }

                    // Single-group fallback
                    if (!patternSelection && groups.length === 1 && disciplineSelections) {
                        const firstKey = Object.keys(disciplineSelections)[0];
                        if (firstKey) patternSelection = getPatternSelectionForAssoc(disciplineSelections, firstKey, buildSSAbbrev);
                    }

                    let scoresheetData = null;
                    let numericPatternId = null;

                    // Try to get pattern ID from selection — same numeric-preferred logic as patterns
                    if (patternSelection) {
                        const patternId = typeof patternSelection === 'object'
                            ? (patternSelection.patternId ?? patternSelection.pattern_id ?? patternSelection.id)
                            : patternSelection;

                        if (typeof patternId === 'number') {
                            numericPatternId = patternId;
                        } else if (typeof patternId === 'string') {
                            if (/^\d+$/.test(patternId)) {
                                numericPatternId = parseInt(patternId);
                            } else {
                                const matches = patternId.match(/\d+/g);
                                if (matches && matches.length > 0) {
                                    const real = matches.find(m => m.length <= 6) || matches[0];
                                    numericPatternId = parseInt(real);
                                }
                            }
                        }
                    }

                    // Get scoresheet using breed-aware key. Prefer the pattern's own stored
                    // association (patternSelection.association_abbrev) over the discipline's
                    // association — the pattern row is the source of truth.
                    if (numericPatternId) {
                        const patternOwnAbbrev = (typeof patternSelection === 'object' && patternSelection)
                            ? (patternSelection.association_abbrev
                                || patternSelection.associationAbbrev
                                || patternSelection.association_name
                                || patternSelection.associationName)
                            : null;
                        const expectedAssoc = patternOwnAbbrev
                            || associationsMap[associationId]?.abbreviation
                            || associationId;
                        const key = `${numericPatternId}__${String(expectedAssoc || '').toLowerCase()}`;
                        if (scoresheetMap[key]) {
                            scoresheetData = scoresheetMap[key];
                        }
                        // NOTE: removed the `scoresheetByPattern[numericPatternId]` fallback —
                        // it was silently returning another association's scoresheet when the
                        // exact (pattern + assoc) key missed. Leave unresolved instead.
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
                                // Exact-match association_abbrev AND discipline so APHA results
                                // never bleed into AQHA rows (and vice versa).
                                const { data: scoresheet } = await supabase
                                    .from('tbl_scoresheet')
                                    .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev, city_state')
                                    .eq('association_abbrev', association.abbreviation)
                                    .eq('discipline', disciplineName)
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
                    
                    // Per-selection override: Step 3 judgeAssigned patterns carry their own judgeName
                    const selectionJudge = (typeof patternSelection === 'object' && patternSelection?.judgeName)
                        ? patternSelection.judgeName
                        : null;
                    const finalJudgeNames = selectionJudge ? [selectionJudge] : judgeNames;

                    if (!processedScoresheets.has(uniqueKey)) {
                        // Check if divisions have a forced association (e.g., Amateur → AQHA)
                        let resolvedAssocId = associationId;
                        for (const d of extractedDivisions) {
                            const forced = getForcedAssocForDivision(d.name);
                            if (forced) { resolvedAssocId = forced; break; }
                        }
                        const expectedAbbrev = associationsMap[resolvedAssocId]?.abbreviation || resolvedAssocId || null;
                        // Compute the actual pattern number this row represents (4-digit padded),
                        // pulled from patternSelection (so APHA Pattern 0002 stays 0002, etc.)
                        const selectionPatternNumber = (typeof patternSelection === 'object' && patternSelection?.patternNumber)
                            ? String(patternSelection.patternNumber)
                            : null;
                        const patternNumberLabel = selectionPatternNumber
                            ? selectionPatternNumber.padStart(4, '0')
                            : (numericPatternId ? String(numericPatternId).padStart(4, '0') : null);
                        scoresheetsList.push({
                            ...(scoresheetData || {}),
                            uniqueKey,
                            id: scoresheetData?.id || `scoresheet-${disciplineIndex}-${groupIndex}`,
                            disciplineName: disciplineName,
                            disciplineIndex: disciplineIndex,
                            groupName: groupName,
                            groupIndex: groupIndex,
                            associationId: resolvedAssocId,
                            associationAbbrev: expectedAbbrev,
                            patternNumber: patternNumberLabel,
                            patternId: numericPatternId,
                            displayName: scoresheetName,
                            divisions: extractedDivisions,
                            divisionNames: (() => {
                                const assocUpper = String(resolvedAssocId || '').toUpperCase();
                                return [...new Set(extractedDivisions.map(d => {
                                    const name = d.name || '';
                                    // Skip divisions forced to a different association
                                    const forced = getForcedAssocForDivision(name);
                                    if (forced && assocUpper && forced !== assocUpper) return null;
                                    const parts = name.split(' - ');
                                    return parts.length > 1 ? parts.slice(1).join(' - ') : name;
                                }).filter(Boolean))].join(', ');
                            })(),
                            judges: finalJudgeNames,
                            judgeNames: finalJudgeNames.join(', '),
                            judgeName: finalJudgeNames.join(', '),
                            image_url: scoresheetData?.image_url || null
                        });
                        processedScoresheets.add(uniqueKey);
                    }
                }
            }
            
            setScoresheets(scoresheetsList);
        } catch (error) {
            console.error('Error fetching scoresheets:', error);
        } finally {
            setIsLoadingScoresheets(false);
        }
    };

    // Generate scoresheets: Division x Judge cross-product (user-controlled)
    const generateScoresheets = async () => {
        setIsGeneratingScoresheets(true);
        setSelectedScoresheetIds(new Set());
        try {
            const disciplines = projectData.disciplines || [];
            const patternSelections = projectData.patternSelections || {};
            const result = [];
            const validationErrors = [];

            // Fetch associations data
            const { data: assocData } = await supabase
                .from('associations')
                .select('id, abbreviation, name');
            const associationsMap = {};
            (assocData || []).forEach(a => {
                associationsMap[a.id] = a;
                associationsMap[a.abbreviation] = a;
            });

            // Collect ALL associations a discipline belongs to (disciplines can be multi-association).
            // NOTE: When a user adds a class, the builder may only record ONE association on the
            // discipline (association_id / selectedAssociations), even though the show is affiliated
            // with multiple (e.g. both APHA + AQHA). In that case the class is implicitly valid for
            // every show-level association — so we treat the project-level associations as the
            // authoritative fallback whenever the discipline has no explicit multi-assoc list.
            const projectAssocIds = Object.keys(projectData.associations || {})
                .filter(k => projectData.associations[k])
                .map(k => String(k).toUpperCase());

            const isValidAssocKey = (k) => {
                const s = String(k || '').trim();
                // Reject empty, pure-numeric indices, and obvious non-abbreviation junk
                if (!s) return false;
                if (/^\d+$/.test(s)) return false;
                return true;
            };
            const getDisciplineAssocIds = (d) => {
                const ids = new Set();
                if (isValidAssocKey(d.association_id)) ids.add(String(d.association_id).toUpperCase());
                if (d.selectedAssociations && typeof d.selectedAssociations === 'object') {
                    Object.keys(d.selectedAssociations).forEach(k => {
                        if (d.selectedAssociations[k] && isValidAssocKey(k)) ids.add(String(k).toUpperCase());
                    });
                }
                if (d.associations && typeof d.associations === 'object' && !Array.isArray(d.associations)) {
                    Object.keys(d.associations).forEach(k => {
                        if (d.associations[k] && isValidAssocKey(k)) ids.add(String(k).toUpperCase());
                    });
                }
                // If the discipline only has 0-1 explicit associations but the show is affiliated
                // with multiple, expand to all show-level associations so dual-affiliation shows
                // (APHA + AQHA) generate score sheets for every association the show supports.
                if (ids.size <= 1 && projectAssocIds.length > 1) {
                    projectAssocIds.forEach(a => ids.add(a));
                }
                return [...ids];
            };

            // Determine selected disciplines (empty = all), then filter by association
            let selectedDisciplines = filterDisciplines.size > 0
                ? disciplines.filter(d => filterDisciplines.has((d.name || '').trim()))
                : disciplines;

            // Apply association filter: include disciplines that belong to ANY selected association
            if (filterAssociations.size > 0) {
                selectedDisciplines = selectedDisciplines.filter(d => {
                    const aids = getDisciplineAssocIds(d);
                    if (aids.length === 0) return false;
                    return aids.some(a => filterAssociations.has(a));
                });
            }

            // Determine selected divisions (empty = all available)
            const selectedDivisionsList = filterDivisions.size > 0
                ? [...filterDivisions]
                : allDivisionNamesFromProjectData;

            // Determine selected judges — scoped to selected associations when applicable
            let selectedJudgesList;
            if (filterJudges.size > 0) {
                selectedJudgesList = [...filterJudges];
            } else if (filterAssociations.size > 0) {
                // No explicit judge filter, but association is selected:
                // only use judges assigned to those associations
                const assocJudges = new Set();
                filterAssociations.forEach(assocId => {
                    const judges = judgesByAssociation[assocId.toUpperCase()];
                    if (judges) judges.forEach(j => assocJudges.add(j));
                });
                selectedJudgesList = assocJudges.size > 0 ? [...assocJudges] : allJudgesFromProjectData;
            } else {
                selectedJudgesList = allJudgesFromProjectData;
            }

            // For each discipline, look up the base scoresheet image and cross-product
            for (const discipline of selectedDisciplines) {
                // Check if discipline explicitly has scoresheet flag, OR if it has pattern selections
                // (pattern disciplines may have linked scoresheets in tbl_scoresheet via pattern_id)
                const hasExplicitScoresheet = discipline.scoresheet || discipline.pattern_type === 'scoresheet_only' || (!discipline.pattern && discipline.scoresheet);
                const hasPatternSelections = !!(patternSelections[discipline.id] || patternSelections[disciplines.indexOf(discipline)]);
                if (!hasExplicitScoresheet && !hasPatternSelections) continue;

                const disciplineName = (discipline.name || 'Unknown Discipline').trim();
                const disciplineAssocIds = getDisciplineAssocIds(discipline);

                // Each class (discipline) may belong to multiple associations (e.g. APHA + AQHA).
                // Generate score sheets independently per association so judges/score-sheets are
                // scoped correctly (APHA judges → APHA sheets, AQHA judges → AQHA sheets).
                let activeAssocIds = filterAssociations.size > 0
                    ? disciplineAssocIds.filter(a => filterAssociations.has(a))
                    : disciplineAssocIds;
                if (activeAssocIds.length === 0) activeAssocIds = [null];

                const groups = discipline.patternGroups || [];

                // Forced-association rule is evaluated per-division below, not per-discipline,
                // so a Level 1 group doesn't contaminate sibling groups (Amateur, Select, etc.).
                const iterationAssocIds = activeAssocIds;

                // Iterate per association so each association gets its own score sheets & judges
                for (const associationId of iterationAssocIds) {
                    const assocNormForDiv = associationId ? String(associationId).toUpperCase() : null;

                    // Collect divisions scoped to THIS association. A division in the pattern
                    // group may carry its own assocId / association_id; if it matches the
                    // current iteration's association (or has no assoc tag — treat as shared),
                    // include it. Without this, APHA-only divisions would bleed into AQHA rows.
                    const disciplineDivisions = [];
                    const divisionDateMap = {};
                    for (const group of groups) {
                        (group.divisions || []).forEach(div => {
                            const divName = extractDivisionName(div);
                            const divId = typeof div === 'string' ? div : div?.id;
                            const divAssoc = typeof div === 'object' && div
                                ? (div.assocId || div.association_id || div.association || '')
                                : '';
                            const divAssocNorm = divAssoc ? String(divAssoc).toUpperCase() : '';
                            if (assocNormForDiv && divAssocNorm && divAssocNorm !== assocNormForDiv) return;
                            if (divName.trim()) {
                                disciplineDivisions.push(divName.trim());
                                if (divId && discipline.divisionDates?.[divId]) {
                                    divisionDateMap[divName.trim()] = discipline.divisionDates[divId];
                                }
                            }
                        });
                    }
                    const uniqueDisciplineDivisions = [...new Set(disciplineDivisions)];

                    let matchingDivisions = uniqueDisciplineDivisions.filter(d =>
                        selectedDivisionsList.some(sel => sel.toLowerCase() === d.toLowerCase())
                    );
                    if (filterDates.size > 0) {
                        matchingDivisions = matchingDivisions.filter(d => {
                            const divDate = divisionDateMap[d];
                            return divDate && filterDates.has(divDate);
                        });
                    }
                    if (matchingDivisions.length === 0) continue;

                    let baseScoresheetData = null;

                    // Try to find pattern selection keyed by discipline (fallback uses association name in key)
                    let disciplineSelections = patternSelections[discipline.id];
                    if (!disciplineSelections) {
                        const dIdx = disciplines.indexOf(discipline);
                        disciplineSelections = patternSelections[dIdx]
                            || patternSelections[`${dIdx}`]
                            || patternSelections[discipline.name];
                    }
                    if (!disciplineSelections && disciplineName && associationId) {
                        const disciplineNameNormalized = disciplineName.replace(/\s+/g, '-');
                        const matchingKey = Object.keys(patternSelections).find(key => {
                            if (!isNaN(parseInt(key))) return false;
                            return key.toLowerCase().includes(disciplineNameNormalized.toLowerCase()) &&
                                   key.toLowerCase().includes((associationId || '').toLowerCase());
                        });
                        if (matchingKey) disciplineSelections = patternSelections[matchingKey];
                    }

                    let firstPatternId = null;
                    let firstPatternSelection = null;
                    for (const group of groups) {
                        const groupId = group.id || `pattern-group-${groups.indexOf(group)}`;
                        const gIdx = groups.indexOf(group);
                        let patternSelection = disciplineSelections
                            ? (getPatternSelectionForAssoc(disciplineSelections, gIdx, assocNormForDiv)
                                || getPatternSelectionForAssoc(disciplineSelections, `${gIdx}`, assocNormForDiv)
                                || getPatternSelectionForAssoc(disciplineSelections, groupId, assocNormForDiv)
                                || getPatternSelectionForAssoc(disciplineSelections, group.id, assocNormForDiv))
                            : null;
                        if (!patternSelection && disciplineSelections && groupId) {
                            const matchingGroupKey = Object.keys(disciplineSelections).find(key => {
                                return key === groupId || key.includes('pattern-group');
                            });
                            if (matchingGroupKey) patternSelection = getPatternSelectionForAssoc(disciplineSelections, matchingGroupKey, assocNormForDiv);
                        }
                        if (patternSelection) {
                            const patternId = typeof patternSelection === 'object'
                                ? (patternSelection.patternId || patternSelection.id || patternSelection.pattern_id)
                                : patternSelection;
                            if (patternId) {
                                let numericId = null;
                                if (typeof patternId === 'string' && patternId.includes('-')) {
                                    const match = patternId.match(/\d+/);
                                    if (match) numericId = parseInt(match[0]);
                                } else if (!isNaN(parseInt(patternId))) {
                                    numericId = parseInt(patternId);
                                }
                                if (numericId) {
                                    firstPatternId = numericId;
                                    firstPatternSelection = patternSelection;
                                    break;
                                }
                            }
                        }
                    }

                    const association = associationId ? associationsMap[associationId] : null;
                    // Source-of-truth for scoresheet lookup: the pattern's own stored
                    // association, falling back to the iteration's association. Never
                    // overwritten later by the discipline/class association.
                    const patternOwnAbbrev = (() => {
                        if (!firstPatternSelection || typeof firstPatternSelection !== 'object') return null;
                        const raw = firstPatternSelection.association_abbrev
                            || firstPatternSelection.associationAbbrev
                            || firstPatternSelection.association_name
                            || firstPatternSelection.associationName;
                        return raw ? String(raw).trim().toUpperCase() : null;
                    })();
                    const abbrev = patternOwnAbbrev
                        || association?.abbreviation
                        || (associationId || '').toString();

                    // Fetch base scoresheet STRICTLY by association abbrev. The previous
                    // pattern_id-only fallback was the "AQHA class → APHA sheet" bug —
                    // removed. If no exact match, leave it unresolved and warn.
                    if (firstPatternId && abbrev) {
                        try {
                            const { data: ssData } = await supabase
                                .from('tbl_scoresheet')
                                .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev, city_state')
                                .eq('pattern_id', firstPatternId)
                                .eq('association_abbrev', abbrev)
                                .limit(1)
                                .maybeSingle();
                            if (ssData) baseScoresheetData = ssData;
                        } catch (err) {
                            console.error('Error fetching scoresheet by pattern_id+abbrev:', err);
                        }
                    }
                    if (!baseScoresheetData && abbrev && disciplineName) {
                        try {
                            const { data: ssData } = await supabase
                                .from('tbl_scoresheet')
                                .select('id, pattern_id, image_url, storage_path, discipline, file_name, association_abbrev, city_state')
                                .eq('association_abbrev', abbrev)
                                .ilike('discipline', `%${disciplineName}%`)
                                .limit(1)
                                .maybeSingle();
                            if (ssData) baseScoresheetData = ssData;
                        } catch (err) {
                            console.error(`Error fetching scoresheet for ${disciplineName}:`, err);
                        }
                    }

                    // Pre-PDF validation: pattern.association must equal scoresheet.association.
                    // On mismatch skip this association's rows and record the error.
                    if (baseScoresheetData && patternOwnAbbrev) {
                        const ssAbbrev = String(baseScoresheetData.association_abbrev || '').toUpperCase();
                        if (ssAbbrev && ssAbbrev !== patternOwnAbbrev) {
                            console.warn(`Association mismatch: pattern ${firstPatternId} is ${patternOwnAbbrev} but scoresheet is ${ssAbbrev} — skipping ${disciplineName}`);
                            validationErrors.push({
                                disciplineName,
                                patternId: firstPatternId,
                                patternAssoc: patternOwnAbbrev,
                                scoresheetAssoc: ssAbbrev,
                            });
                            continue;
                        }
                    }
                    if (!baseScoresheetData && firstPatternId) {
                        console.warn(`No scoresheet found for pattern ${firstPatternId} in association ${abbrev} — leaving row unresolved`);
                    }

                    // Judges scoped to THIS association (APHA judges → APHA sheets, etc.)
                    let disciplineJudges = selectedJudgesList;
                    if (associationId) {
                        const assocJudgeSet = judgesByAssociation[associationId.toUpperCase()];
                        if (assocJudgeSet && assocJudgeSet.size > 0) {
                            disciplineJudges = filterJudges.size > 0
                                ? selectedJudgesList.filter(j => assocJudgeSet.has(j))
                                : [...assocJudgeSet];
                        } else if (filterAssociations.size > 0) {
                            // Association is explicitly selected but no judges mapped → no sheets for this assoc
                            disciplineJudges = [];
                        }
                    }
                    const judgesList = disciplineJudges.length > 0 ? disciplineJudges : [''];

                    for (const divisionName of matchingDivisions) {
                        const forcedForDivision = getForcedAssocForDivision(divisionName);
                        if (forcedForDivision && assocNormForDiv && forcedForDivision !== assocNormForDiv) {
                            continue;
                        }
                        if (forcedForDivision && filterAssociations.size > 0 && !filterAssociations.has(forcedForDivision)) {
                            continue;
                        }
                        for (const judgeName of judgesList) {
                            const assocKey = (associationId || '').toString().toUpperCase();
                            const uniqueKey = `${assocKey}-${disciplineName}-${divisionName}-${judgeName}`;
                            result.push({
                                ...(baseScoresheetData || {}),
                                uniqueKey,
                                id: baseScoresheetData?.id ? `${baseScoresheetData.id}-${assocKey}-${divisionName}-${judgeName}` : `gen-${uniqueKey}`,
                                numericId: baseScoresheetData?.id || null,
                                disciplineName,
                                disciplineIndex: disciplines.indexOf(discipline),
                                associationId: assocKey,
                                association_abbrev: baseScoresheetData?.association_abbrev || abbrev || assocKey,
                                divisionName,
                                judgeName,
                                classDate: divisionDateMap[divisionName] || projectData.startDate || null,
                                displayName: `${disciplineName} Scoresheet`,
                                image_url: baseScoresheetData?.image_url || null,
                                generatedAt: new Date().toISOString(),
                            });
                        }
                    }
                }
            }

            setGeneratedScoresheets(result);

            toast({
                title: `Generated ${result.length} Score Sheet(s)`,
                description: result.length > 0
                    ? `${new Set(result.map(r => r.divisionName)).size} division(s) x ${new Set(result.map(r => r.judgeName)).size} judge(s)`
                    : 'No matching combinations found. Check your filter selections.'
            });

            if (validationErrors.length > 0) {
                toast({
                    title: `${validationErrors.length} row(s) skipped: association mismatch`,
                    description: validationErrors.slice(0, 3).map(v => `${v.disciplineName}: pattern ${v.patternAssoc} vs sheet ${v.scoresheetAssoc}`).join('; '),
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Error generating scoresheets:', error);
            toast({
                title: "Generation failed",
                description: error.message || "Failed to generate scoresheets",
                variant: "destructive"
            });
        } finally {
            setIsGeneratingScoresheets(false);
        }
    };

    // Get people data
    const getPeopleData = () => {
        // adminOwner / secondAdmin can be a string or an object like
        // { adminName, ownerName, adminEmail, ... }. Normalize to string.
        const ownerRaw = projectData.adminOwner;
        const ownerFromObject = ownerRaw && typeof ownerRaw === 'object'
            ? (ownerRaw.ownerName || ownerRaw.adminName || '')
            : '';
        const owner = (typeof ownerRaw === 'string' ? ownerRaw : ownerFromObject)
            || profile?.full_name || user?.email || 'Not set';

        // Get admin - check secondAdmin or officials with admin role
        const secondAdminRaw = projectData.secondAdmin;
        const adminFromObject = secondAdminRaw && typeof secondAdminRaw === 'object'
            ? (secondAdminRaw.adminName || secondAdminRaw.name || '')
            : '';
        let admin = (typeof secondAdminRaw === 'string' ? secondAdminRaw : adminFromObject) || 'Not set';
        if (admin === 'Not set') {
            const adminOfficial = projectData.officials?.find(o => o.role === 'admin');
            admin = adminOfficial?.name || 'Not set';
        }
        
        // Collect judges from every source the PBB may have stored them in.
        const judgesList = [];
        const addJudge = (value) => {
            if (!value) return;
            const name = typeof value === 'string' ? value : (value.name || value.email);
            if (!name) return;
            const key = String(name).trim().toLowerCase();
            if (!key) return;
            if (!judgesList.some(j => j.toLowerCase() === key)) judgesList.push(String(name).trim());
        };

        // 1. associationJudges { [assocId]: { judges: [...] } } or { [assocId]: [...] }
        Object.values(projectData.associationJudges || {}).forEach(assocData => {
            const judges = assocData?.judges || (Array.isArray(assocData) ? assocData : []);
            if (Array.isArray(judges)) judges.forEach(addJudge);
        });

        // 2. officials with role === 'judge'
        const officials = projectData.officials || [];
        officials.filter(o => o.role === 'judge').forEach(addJudge);

        // 3. showDetails.judges — Number-of-Judges UI (Step 4)
        const showDetailsJudges = projectData.showDetails?.judges || {};
        Object.values(showDetailsJudges).forEach(entry => {
            if (Array.isArray(entry)) entry.forEach(addJudge);
            else addJudge(entry);
        });

        // 4. groupJudges[discIndex][groupIndex]
        Object.values(projectData.groupJudges || {}).forEach(group => {
            if (typeof group === 'object' && group) Object.values(group).forEach(addJudge);
            else addJudge(group);
        });

        // 5. patternSelections[disc][group].judgeName (per-group overrides)
        Object.values(projectData.patternSelections || {}).forEach(disc => {
            if (!disc || typeof disc !== 'object') return;
            forEachPatternSelection(disc, (_g, _a, sel) => {
                if (sel && sel.judgeName) addJudge(sel.judgeName);
            });
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
                folders: updatedFolders,
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

    const handleResultsSave = async (updatedProjectData) => {
        try {
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedProjectData })
                .eq('id', project.id);
            if (error) throw error;
            if (onRefresh) onRefresh();
        } catch (error) {
            toast({
                title: "Error",
                description: error?.message || "Failed to save results data",
                variant: "destructive",
            });
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
    
    // Handle opening Move to Folder dialog
    const handleOpenMoveToFolder = (itemType, itemData) => {
        setItemToMove({ type: itemType, data: itemData });
        setMoveToFolderDialogOpen(true);
    };
    
    // Handle moving item to folder from dialog
    const handleMoveToFolderConfirm = async (folderId) => {
        if (!itemToMove || !folderId) return;
        
        const itemId = itemToMove.data.id || itemToMove.data.numericId || `${itemToMove.type}-${Date.now()}`;
        await handleAddToFolder(itemId, itemToMove.type, folderId, itemToMove.data);
        
        setMoveToFolderDialogOpen(false);
        setItemToMove(null);
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
        //test
        
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
                foundItemData = generatedScoresheets.find(s => {
                    const sId = s.id || s.numericId || s.uniqueKey;
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
                    for (let i = 0; i < folderData.items.length; i++) {
                        const item = folderData.items[i];
                        
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
                                    // Try multiple URL sources
                                    fileUrl = patternData.pdf_url || 
                                             patternData.download_url || 
                                             patternData.image_url ||
                                             patternData.url;
                                    fileName = patternData.patternName || 
                                              patternData.name || 
                                              patternData.pdf_file_name ||
                                              `pattern_${item.id}.pdf`;
                                    
                                    
                                    // If still no URL, try to fetch from database using pattern ID
                                    // Check multiple ID sources: numericId, originalPatternId, id
                                    const possibleIds = [
                                        patternData.numericId,
                                        patternData.originalPatternId,
                                        patternData.id,
                                        patternData.patternId
                                    ].filter(Boolean);
                                    
                                    
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
                                                    const { data: patternDetail, error: patternError } = await supabase
                                                        .from('tbl_pattern_media')
                                                        .select('image_url, file_url, storage_path')
                                                        .eq('pattern_id', numericId)
                                                        .maybeSingle();
                                                    
                                                    
                                                    if (!patternError && patternDetail) {
                                                        fileUrl = patternDetail.image_url || patternDetail.file_url;
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
                                const scoresheetData = item.data || generatedScoresheets.find(s => {
                                    const sId = s.id || s.numericId || s.uniqueKey;
                                    return (item.id === sId || item.id === String(sId));
                                });
                                
                                if (scoresheetData) {
                                    fileUrl = scoresheetData.image_url || scoresheetData.download_url;
                                    fileName = scoresheetData.displayName || scoresheetData.file_name || scoresheetData.disciplineName || `scoresheet_${item.id}.pdf`;
                                }
                            }
                            
                            if (fileUrl) {
                                try {
                                    const response = await fetch(fileUrl);
                                    if (response.ok) {
                                        const blob = await response.blob();
                                        // Sanitize filename
                                        const sanitizedFileName = fileName.replace(/[^a-z0-9._-]/gi, '_');
                                        zipFolder.file(sanitizedFileName, blob);
                                        downloadedCount++;
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
                    <div className="flex items-center gap-4 mr-10">
                        <Select
                            value={displayStatus}
                            onValueChange={handleStatusChange}
                            disabled={isUpdatingStatus}
                        >
                            <SelectTrigger className="w-36 h-9 text-sm">
                                <SelectValue>
                                    {displayStatus === 'Lock & Approve Mode' ? 'Apprvd & Locked' : displayStatus === 'Publication' ? 'Published' : displayStatus}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {(() => {
                                    const dbSt = project.status || 'Draft';
                                    const isPublished = dbSt === 'Final' || dbSt === 'Publication';
                                    return (
                                        <>
                                            <SelectItem value="Draft" disabled={isPublished}>
                                                Draft
                                            </SelectItem>
                                            <SelectItem value="Lock & Approve Mode" disabled={isPublished}>
                                                Apprvd & Locked
                                            </SelectItem>
                                            <SelectItem value="Publication">
                                                Published
                                            </SelectItem>
                                        </>
                                    );
                                })()}
                            </SelectContent>
                        </Select>
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
                        Pattern Books & Score Sheets
                    </button>
                    <button
                        onClick={() => setActiveTab('results')}
                        className={`px-4 py-2 rounded-full text-sm font-medium ${
                            activeTab === 'results' 
                                ? 'bg-primary text-white' 
                                : 'bg-transparent text-muted-foreground hover:bg-primary/10'
                        }`}
                    >
                        Results
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
                            <button
                                onClick={() => setSelectedSidebarItem('assignedToMe')}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${
                                    selectedSidebarItem === 'assignedToMe' ? 'bg-primary text-white' : 'hover:bg-muted'
                                }`}
                            >
                                Assigned to My Judge
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
                                                    const FolderItem = () => {
                                                        
                                                        return (
                                                            <div 
                                                                className={cn(
                                                                    "flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors relative",
                                                                    selectedFolderId === folder.id ? "bg-primary text-white" : "hover:bg-muted"
                                                                )}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedSidebarItem('folder');
                                                                    setSelectedFolderId(folder.id);
                                                                }}
                                                                style={{ marginLeft }}
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
                                                    
                                                    return <FolderItem key={folder.id} />;
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
                        View/Download Pattern Books & Score Sheets
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
                                            onClick={() => setActiveSubTab('scoreSheets')}
                                            className={`px-4 py-2 border-b-2 font-medium ${
                                                activeSubTab === 'scoreSheets' 
                                                    ? 'border-primary text-primary' 
                                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Score Sheets
                                        </button>
                                        <button 
                                            onClick={() => setActiveSubTab('accessory')}
                                            className={`px-4 py-2 border-b-2 font-medium ${
                                                activeSubTab === 'accessory' 
                                                    ? 'border-primary text-primary' 
                                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Accessory Documents
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
                                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                                        {/* 1. Association Filter (FIRST) - Show for Patterns and Score Sheets tabs */}
                                        {(activeSubTab === 'patterns' || activeSubTab === 'scoreSheets') && uniqueAssociations.length > 0 && (
                                            <Popover open={associationFilterOpen} onOpenChange={(open) => { setAssociationFilterOpen(open); if (!open) setAssociationSearch(''); }}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-36 justify-between">
                                                        <span className="truncate">
                                                            {filterAssociations.size === 0
                                                                ? 'Associations'
                                                                : filterAssociations.size === 1
                                                                    ? Array.from(filterAssociations)[0]
                                                                    : `${filterAssociations.size} Selected`}
                                                        </span>
                                                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-56 p-0 bg-popover text-popover-foreground border border-border z-50" align="start">
                                                    <div className="p-2 border-b flex items-center justify-between">
                                                        <span className="text-sm font-medium">Association</span>
                                                        {filterAssociations.size > 0 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs"
                                                                onClick={() => { setFilterAssociations(new Set()); setFilterDisciplines(new Set()); setFilterDivisions(new Set()); setFilterJudges(new Set()); }}
                                                            >
                                                                Clear
                                                            </Button>
                                                        )}
                                                    </div>
                                                    {uniqueAssociations.length > 5 && (
                                                        <div className="p-2 border-b">
                                                            <input
                                                                type="text"
                                                                placeholder="Search associations..."
                                                                value={associationSearch}
                                                                onChange={(e) => setAssociationSearch(e.target.value)}
                                                                className="w-full px-2 py-1 text-sm border rounded outline-none focus:ring-1 focus:ring-primary"
                                                            />
                                                        </div>
                                                    )}
                                                    <div
                                                        className="max-h-[240px] overflow-y-auto overscroll-contain"
                                                        onWheel={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="p-2 space-y-1">
                                                            {uniqueAssociations
                                                                .filter(a => a.toLowerCase().includes(associationSearch.toLowerCase()))
                                                                .map(assoc => (
                                                                <div
                                                                    key={assoc}
                                                                    className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                                                                    onClick={() => {
                                                                        setFilterAssociations(prev => {
                                                                            const newSet = new Set(prev);
                                                                            if (newSet.has(assoc)) {
                                                                                newSet.delete(assoc);
                                                                            } else {
                                                                                newSet.add(assoc);
                                                                            }
                                                                            return newSet;
                                                                        });
                                                                        // Clear downstream filters when association changes
                                                                        setFilterDisciplines(new Set());
                                                                        setFilterDivisions(new Set());
                                                                        setFilterJudges(new Set());
                                                                    }}
                                                                >
                                                                    <Checkbox checked={filterAssociations.has(assoc)} />
                                                                    <span className="text-sm">{assoc}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        )}

                                        {/* 2. Discipline Filter - Show for Patterns and Score Sheets tabs */}
                                        {(activeSubTab === 'patterns' || activeSubTab === 'scoreSheets') && (
                                            <Popover open={disciplineFilterOpen} onOpenChange={(open) => { setDisciplineFilterOpen(open); if (!open) setDisciplineSearch(''); }}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-36 justify-between">
                                                        <span className="truncate">
                                                            {filterDisciplines.size === 0
                                                                ? 'Disciplines'
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
                                                    <div className="p-2 border-b">
                                                        <input
                                                            type="text"
                                                            placeholder="Search disciplines..."
                                                            value={disciplineSearch}
                                                            onChange={(e) => setDisciplineSearch(e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border rounded outline-none focus:ring-1 focus:ring-primary"
                                                        />
                                                    </div>
                                                    <div
                                                        className="max-h-[240px] overflow-y-auto overscroll-contain"
                                                        onWheel={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="p-2 space-y-1">
                                                            {disciplineOptions
                                                                .filter(discipline => discipline.toLowerCase().includes(disciplineSearch.toLowerCase()))
                                                                .map(discipline => (
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
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        )}

                                        {/* 3. Division Filter - Show for Patterns and Score Sheets tabs, grouped by association */}
                                        {(activeSubTab === 'patterns' || activeSubTab === 'scoreSheets') && (
                                            <Popover open={divisionFilterOpen} onOpenChange={(open) => { setDivisionFilterOpen(open); if (!open) setDivisionSearch(''); }}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-36 justify-between">
                                                        <span className="truncate">
                                                            {filterDivisions.size === 0
                                                                ? 'Divisions'
                                                                : filterDivisions.size === 1
                                                                    ? Array.from(filterDivisions)[0]
                                                                    : `${filterDivisions.size} Selected`}
                                                        </span>
                                                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-0 bg-popover text-popover-foreground border border-border z-50" align="start">
                                                    <div className="p-2 border-b flex items-center justify-between">
                                                        <span className="text-sm font-medium">Divisions</span>
                                                        {filterDivisions.size > 0 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs"
                                                                onClick={() => setFilterDivisions(new Set())}
                                                            >
                                                                Clear
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <div className="p-2 border-b">
                                                        <input
                                                            type="text"
                                                            placeholder="Search divisions..."
                                                            value={divisionSearch}
                                                            onChange={(e) => setDivisionSearch(e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border rounded outline-none focus:ring-1 focus:ring-primary"
                                                        />
                                                    </div>
                                                    <div
                                                        className="max-h-[300px] overflow-y-auto overscroll-contain"
                                                        onWheel={(e) => e.stopPropagation()}
                                                    >
                                                        {/* Group divisions by association when multiple associations exist */}
                                                        {uniqueAssociations.length > 1 ? (
                                                            <div className="p-2 space-y-2">
                                                                {/* Select All */}
                                                                <div
                                                                    className="flex items-center space-x-2 p-1 rounded hover:bg-muted cursor-pointer border-b pb-2"
                                                                    onClick={() => {
                                                                        if (filterDivisions.size === uniqueDivisions.length) {
                                                                            setFilterDivisions(new Set());
                                                                        } else {
                                                                            setFilterDivisions(new Set(uniqueDivisions));
                                                                        }
                                                                    }}
                                                                >
                                                                    <Checkbox checked={filterDivisions.size === uniqueDivisions.length && uniqueDivisions.length > 0} />
                                                                    <span className="text-sm font-medium">Select All</span>
                                                                </div>
                                                                {uniqueAssociations.map(assocId => {
                                                                    const assocDivs = (divisionsByAssociation[assocId] ? [...divisionsByAssociation[assocId]] : [])
                                                                        .filter(d => uniqueDivisions.includes(d))
                                                                        .filter(d => d.toLowerCase().includes(divisionSearch.toLowerCase()))
                                                                        .sort();
                                                                    if (assocDivs.length === 0) return null;
                                                                    return (
                                                                        <div key={assocId}>
                                                                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1 bg-muted/50 rounded">
                                                                                {assocId}
                                                                            </div>
                                                                            <div className="space-y-0.5 mt-1">
                                                                                {assocDivs.map(divisionName => (
                                                                                    <div
                                                                                        key={`${assocId}-${divisionName}`}
                                                                                        className="flex items-center space-x-2 p-1.5 pl-4 rounded hover:bg-muted cursor-pointer"
                                                                                        onClick={() => {
                                                                                            setFilterDivisions(prev => {
                                                                                                const newSet = new Set(prev);
                                                                                                if (newSet.has(divisionName)) newSet.delete(divisionName);
                                                                                                else newSet.add(divisionName);
                                                                                                return newSet;
                                                                                            });
                                                                                        }}
                                                                                    >
                                                                                        <Checkbox checked={filterDivisions.has(divisionName)} />
                                                                                        <span className="text-sm">{divisionName}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="p-2 space-y-1">
                                                                {uniqueDivisions
                                                                    .filter(divisionName => divisionName.toLowerCase().includes(divisionSearch.toLowerCase()))
                                                                    .map(divisionName => (
                                                                    <div
                                                                        key={divisionName}
                                                                        className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                                                                        onClick={() => {
                                                                            setFilterDivisions(prev => {
                                                                                const newSet = new Set(prev);
                                                                                if (newSet.has(divisionName)) newSet.delete(divisionName);
                                                                                else newSet.add(divisionName);
                                                                                return newSet;
                                                                            });
                                                                        }}
                                                                    >
                                                                        <Checkbox checked={filterDivisions.has(divisionName)} />
                                                                        <span className="text-sm">{divisionName}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        )}

                                        {/* 4. Judge Filter - Show for Score Sheets tab */}
                                        {activeSubTab === 'scoreSheets' && (
                                            <Popover open={judgeFilterOpen} onOpenChange={(open) => { setJudgeFilterOpen(open); if (!open) setJudgeSearch(''); }}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-36 justify-between">
                                                        <span className="truncate">
                                                            {filterJudges.size === 0
                                                                ? 'Judges'
                                                                : filterJudges.size === 1
                                                                    ? Array.from(filterJudges)[0]
                                                                    : `${filterJudges.size} Selected`}
                                                        </span>
                                                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-56 p-0 bg-popover text-popover-foreground border border-border z-50" align="start">
                                                    <div className="p-2 border-b flex items-center justify-between">
                                                        <span className="text-sm font-medium">Judges</span>
                                                        {filterJudges.size > 0 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs"
                                                                onClick={() => setFilterJudges(new Set())}
                                                            >
                                                                Clear
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <div className="p-2 border-b">
                                                        <input
                                                            type="text"
                                                            placeholder="Search judges..."
                                                            value={judgeSearch}
                                                            onChange={(e) => setJudgeSearch(e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border rounded outline-none focus:ring-1 focus:ring-primary"
                                                        />
                                                    </div>
                                                    <div
                                                        className="max-h-[240px] overflow-y-auto overscroll-contain"
                                                        onWheel={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="p-2 space-y-1">
                                                            {filteredJudgeOptions
                                                                .filter(judge => judge.toLowerCase().includes(judgeSearch.toLowerCase()))
                                                                .map(judge => (
                                                                <div
                                                                    key={judge}
                                                                    className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                                                                    onClick={() => {
                                                                        setFilterJudges(prev => {
                                                                            const newSet = new Set(prev);
                                                                            if (newSet.has(judge)) {
                                                                                newSet.delete(judge);
                                                                            } else {
                                                                                newSet.add(judge);
                                                                            }
                                                                            return newSet;
                                                                        });
                                                                    }}
                                                                >
                                                                    <Checkbox checked={filterJudges.has(judge)} />
                                                                    <span className="text-sm">{judge}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        )}

                                        {/* 5. Date Filter - Show for Score Sheets tab only */}
                                        {activeSubTab === 'scoreSheets' && uniqueDates.length > 0 && (
                                            <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-36 justify-between">
                                                        <span className="truncate">
                                                            {filterDates.size === 0
                                                                ? 'Dates'
                                                                : filterDates.size === 1
                                                                    ? format(parseLocalDate(Array.from(filterDates)[0]), 'EEE, MMM d')
                                                                    : `${filterDates.size} Dates`}
                                                        </span>
                                                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-56 p-0 bg-popover text-popover-foreground border border-border z-50" align="start">
                                                    <div className="p-2 border-b flex items-center justify-between">
                                                        <span className="text-sm font-medium">Dates</span>
                                                        {filterDates.size > 0 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs"
                                                                onClick={() => setFilterDates(new Set())}
                                                            >
                                                                Clear
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <div
                                                        className="max-h-[240px] overflow-y-auto overscroll-contain"
                                                        onWheel={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="p-2 space-y-1">
                                                            {uniqueDates.map(dateVal => (
                                                                <div
                                                                    key={dateVal}
                                                                    className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                                                                    onClick={() => {
                                                                        setFilterDates(prev => {
                                                                            const newSet = new Set(prev);
                                                                            if (newSet.has(dateVal)) {
                                                                                newSet.delete(dateVal);
                                                                            } else {
                                                                                newSet.add(dateVal);
                                                                            }
                                                                            return newSet;
                                                                        });
                                                                    }}
                                                                >
                                                                    <Checkbox checked={filterDates.has(dateVal)} />
                                                                    <span className="text-sm">{format(parseLocalDate(dateVal), 'EEE, MMM d, yyyy')}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        )}

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
                                            const found = generatedScoresheets.find(s => {
                                                const sId = s.id || s.numericId || s.uniqueKey;
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
                                                    {/* Bulk selection toolbar */}
                                                    <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                id="select-all-patterns"
                                                                checked={selectedPatternIds.size === filteredPatterns.length && filteredPatterns.length > 0}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) {
                                                                        setSelectedPatternIds(new Set(filteredPatterns.map((p, i) => p.uniqueKey || p.id || p.numericId || `pattern-${i}`)));
                                                                    } else {
                                                                        setSelectedPatternIds(new Set());
                                                                    }
                                                                }}
                                                            />
                                                            <Label htmlFor="select-all-patterns" className="text-xs font-normal cursor-pointer">
                                                                {selectedPatternIds.size > 0 ? `${selectedPatternIds.size} selected` : 'Select All'}
                                                            </Label>
                                                            {selectedPatternIds.size > 0 && (
                                                                <div className="flex items-center gap-2 ml-2">
                                                                    {folders.length > 0 && (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button variant="outline" size="sm" className="h-7 text-xs">
                                                                                    <Folder className="h-3.5 w-3.5 mr-1.5" />
                                                                                    Move to Folder
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent>
                                                                                {folders.map(folder => (
                                                                                    <DropdownMenuItem key={folder.id} onClick={() => handleBulkMovePatternsToFolder(folder.id)}>
                                                                                        <Folder className="h-4 w-4 mr-2" />
                                                                                        {folder.name}
                                                                                    </DropdownMenuItem>
                                                                                ))}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
                                                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedPatternIds(new Set())}>
                                                                        Clear
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {(() => {
                                                        const showAssocAbbrevs = detectShowAssociations(projectData);
                                                        const multiBreed = showAssocAbbrevs.length > 1;
                                                        const getPatternAssocKey = (p) => {
                                                            const raw = p?.association_name || p?.associationName || p?.association_abbrev || p?.associationAbbrev || p?.associationId;
                                                            if (!raw) return 'OTHER';
                                                            const upper = String(raw).toUpperCase();
                                                            if (upper.includes('PAINT')) return 'APHA';
                                                            if (upper.includes('QUARTER')) return 'AQHA';
                                                            return upper;
                                                        };
                                                        const renderRow = (pattern, index) => {
                                                        const selKey = pattern.uniqueKey || pattern.id || pattern.numericId || `pattern-${index}`;
                                                        return (
                                                        <div
                                                            key={pattern.uniqueKey || pattern.id || index}
                                                            className="flex items-center gap-4 p-3 border rounded hover:bg-muted/50"
                                                        >
                                                        <Checkbox
                                                            checked={selectedPatternIds.has(selKey)}
                                                            onCheckedChange={(checked) => {
                                                                setSelectedPatternIds(prev => {
                                                                    const next = new Set(prev);
                                                                    if (checked) next.add(selKey);
                                                                    else next.delete(selKey);
                                                                    return next;
                                                                });
                                                            }}
                                                        />
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
                                                            <div className="text-sm text-muted-foreground space-y-0.5">
                                                                <div>
                                                                    <span className="font-medium">Discipline:</span> {pattern.discipline || pattern.disciplineName}
                                                                    {pattern.associationId && (
                                                                        <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">{String(pattern.associationId).toUpperCase()}</span>
                                                                    )}
                                                                </div>
                                                                {pattern.divisionNames && (
                                                                    <div>
                                                                        <span className="font-medium">Division:</span> ({pattern.divisionNames})
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <span className="font-medium">Pattern No:</span> {
                                                                        (() => {
                                                                            // Extract the last 4 digits from patternName or name
                                                                            // e.g., "VRH&RHCRanchReining0002" -> "0002"
                                                                            // e.g., "VRH&RHCRanchReining0007" -> "0007"
                                            
                                                                            let patternNumStr = null;
                                                                            
                                                                            // Extract the last 4-digit run from patternName / name.
                                                                            // Names like "WesternRiding0002.Gr_N" end with a variant
                                                                            // suffix, so we can't anchor to end-of-string.
                                                                            const extractPatternNum = (s) => {
                                                                                if (!s) return null;
                                                                                const all = s.match(/\d{4}/g);
                                                                                if (all && all.length) return all[all.length - 1];
                                                                                const any = s.match(/\d+/g);
                                                                                if (any && any.length) return any[any.length - 1].padStart(4, '0');
                                                                                return null;
                                                                            };
                                                                            patternNumStr = extractPatternNum(pattern.patternName) || extractPatternNum(pattern.name);
                                                                            
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
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        title="More options"
                                                                    >
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const patternUrl = pattern.image_url || pattern.pdf_url || pattern.download_url;
                                                                            if (patternUrl) {
                                                                                navigator.clipboard.writeText(patternUrl).then(() => {
                                                                                    toast({
                                                                                        title: "Link copied",
                                                                                        description: "Pattern link copied to clipboard"
                                                                                    });
                                                                                }).catch(() => {
                                                                                    toast({
                                                                                        title: "Share failed",
                                                                                        description: "Could not copy link to clipboard",
                                                                                        variant: "destructive"
                                                                                    });
                                                                                });
                                                                            } else {
                                                                                toast({
                                                                                    title: "Share not available",
                                                                                    description: "No shareable link available for this pattern",
                                                                                    variant: "destructive"
                                                                                });
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Share2 className="h-4 w-4 mr-2" />
                                                                        Share
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                        );
                                                        };
                                                        if (!multiBreed) {
                                                            return filteredPatterns.map((p, i) => renderRow(p, i));
                                                        }
                                                        const groups = {};
                                                        filteredPatterns.forEach((p, i) => {
                                                            const k = getPatternAssocKey(p);
                                                            if (!groups[k]) groups[k] = [];
                                                            groups[k].push({ p, i });
                                                        });
                                                        return Object.keys(groups).sort().map(assocKey => (
                                                            <div key={`assoc-${assocKey}`} className="space-y-2">
                                                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-2">{assocKey}</div>
                                                                {groups[assocKey].map(({ p, i }) => renderRow(p, i))}
                                                            </div>
                                                        ));
                                                    })()}
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
                                        {isGeneratingScoresheets ? (
                                            <div className="flex items-center justify-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <span className="ml-3 text-muted-foreground">Generating score sheets...</span>
                                            </div>
                                        ) : displayedScoresheets.length > 0 ? (
                                            <div className="space-y-2 overflow-y-auto pr-2 flex-1">
                                                {/* Bulk selection toolbar */}
                                                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id="select-all-scoresheets"
                                                            checked={selectedScoresheetIds.size === displayedScoresheets.length && displayedScoresheets.length > 0}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setSelectedScoresheetIds(new Set(displayedScoresheets.map(s => s.uniqueKey)));
                                                                } else {
                                                                    setSelectedScoresheetIds(new Set());
                                                                }
                                                            }}
                                                        />
                                                        <Label htmlFor="select-all-scoresheets" className="text-xs font-normal cursor-pointer">
                                                            {selectedScoresheetIds.size > 0 ? `${selectedScoresheetIds.size} selected` : 'Select All'}
                                                        </Label>
                                                        {selectedScoresheetIds.size > 0 && (
                                                            <div className="flex items-center gap-2 ml-2">
                                                                {bulkDownloadProgress ? (
                                                                    <div className="flex items-center gap-2 min-w-[280px]">
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                                                                        <div className="flex-1">
                                                                            <div className="text-xs text-muted-foreground mb-1">
                                                                                {bulkDownloadProgress.message}
                                                                            </div>
                                                                            <Progress
                                                                                value={bulkDownloadProgress.total > 0
                                                                                    ? (bulkDownloadProgress.current / bulkDownloadProgress.total) * 100
                                                                                    : 0
                                                                                }
                                                                                className="h-2"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleBulkDownloadScoresheets}>
                                                                        <Download className="h-3.5 w-3.5 mr-1.5" />
                                                                        Download ({selectedScoresheetIds.size})
                                                                    </Button>
                                                                )}
                                                                {folders.length > 0 && !bulkDownloadProgress && (
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                                                                <Folder className="h-3.5 w-3.5 mr-1.5" />
                                                                                Move to Folder
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent>
                                                                            {folders.map(folder => (
                                                                                <DropdownMenuItem key={folder.id} onClick={() => handleBulkMoveToFolder(folder.id)}>
                                                                                    <Folder className="h-4 w-4 mr-2" />
                                                                                    {folder.name}
                                                                                </DropdownMenuItem>
                                                                            ))}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Sort dropdown */}
                                                    <Select value={scoresheetSortBy} onValueChange={setScoresheetSortBy}>
                                                        <SelectTrigger className="h-7 w-32 text-xs">
                                                            <SelectValue placeholder="Sort by" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="association">By Association</SelectItem>
                                                            <SelectItem value="division">By Division</SelectItem>
                                                            <SelectItem value="discipline">By Discipline</SelectItem>
                                                            <SelectItem value="judge">By Judge</SelectItem>
                                                            <SelectItem value="name">By Name</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Scoresheet cards */}
                                                {displayedScoresheets.map((scoresheet, index) => (
                                                    <div
                                                        key={scoresheet.uniqueKey || scoresheet.id || index}
                                                        className="flex items-center gap-4 p-3 border rounded hover:bg-muted/50"
                                                    >
                                                        {/* Bulk selection checkbox */}
                                                        <Checkbox
                                                            checked={selectedScoresheetIds.has(scoresheet.uniqueKey)}
                                                            onCheckedChange={(checked) => {
                                                                setSelectedScoresheetIds(prev => {
                                                                    const next = new Set(prev);
                                                                    if (checked) next.add(scoresheet.uniqueKey);
                                                                    else next.delete(scoresheet.uniqueKey);
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                        <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center shrink-0">
                                                            <FileText className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium truncate">{scoresheet.displayName || scoresheet.disciplineName || 'Scoresheet'}</div>
                                                            <div className="text-sm text-muted-foreground space-y-0.5">
                                                                <div>
                                                                    <span className="font-medium">Discipline:</span> {scoresheet.disciplineName}
                                                                    {scoresheet.associationId && (
                                                                        <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">{scoresheet.associationId}</span>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium">Division:</span> {scoresheet.divisionName}
                                                                </div>
                                                                {scoresheet.judgeName && (
                                                                    <div>
                                                                        <span className="font-medium">Judge:</span> {scoresheet.judgeName}
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
                                                                                    handleAddToFolder(scoresheet.uniqueKey, 'scoresheet', folder.id, scoresheet);
                                                                                }}
                                                                            >
                                                                                <Folder className="h-4 w-4 mr-2" />
                                                                                {folder.name}
                                                                            </DropdownMenuItem>
                                                                        ))}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        title="More options"
                                                                    >
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const scoresheetUrl = scoresheet.image_url || scoresheet.storage_path;
                                                                            if (scoresheetUrl) {
                                                                                navigator.clipboard.writeText(scoresheetUrl).then(() => {
                                                                                    toast({
                                                                                        title: "Link copied",
                                                                                        description: "Scoresheet link copied to clipboard"
                                                                                    });
                                                                                }).catch(() => {
                                                                                    toast({
                                                                                        title: "Share failed",
                                                                                        description: "Could not copy link to clipboard",
                                                                                        variant: "destructive"
                                                                                    });
                                                                                });
                                                                            } else {
                                                                                toast({
                                                                                    title: "Share not available",
                                                                                    description: "No shareable link available for this scoresheet",
                                                                                    variant: "destructive"
                                                                                });
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Share2 className="h-4 w-4 mr-2" />
                                                                        Share
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            /* Empty state */
                                            <div className="text-center py-12 text-muted-foreground">
                                                {isGeneratingScoresheets ? (
                                                    <>
                                                        <Loader2 className="h-12 w-12 mx-auto mb-4 opacity-30 animate-spin" />
                                                        <p className="text-lg font-medium mb-2">Loading Score Sheets...</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                                        <p className="text-lg font-medium mb-2">No Score Sheets Available</p>
                                                        <p className="text-sm">Try adjusting your Discipline, Division, or Judge filters above.</p>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {activeSubTab === 'accessory' && (
                                    (() => {
                                        const accessoryDocs = [
                                            ...(projectData.showDocuments || []),
                                            ...(projectData.generalMarketing || []),
                                            ...(projectData.lessonPlans || []),
                                        ].filter(d => d && (d.fileUrl || d.url));
                                        if (accessoryDocs.length === 0) {
                                            return (
                                                <div className="text-center py-12 text-muted-foreground">
                                                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                                    <p className="text-lg font-medium mb-2">No Accessory Documents</p>
                                                    <p className="text-sm">Upload show schedules, bills, or related documents in the Pattern Book Builder (Step 6).</p>
                                                </div>
                                            );
                                        }
                                        const handleShare = async (doc) => {
                                            const url = doc.fileUrl || doc.url;
                                            const title = doc.customName || doc.fileName || 'Accessory Document';
                                            try {
                                                if (navigator.share) {
                                                    await navigator.share({ title, url });
                                                } else {
                                                    await navigator.clipboard.writeText(url);
                                                    toast({ title: 'Link copied', description: 'Document URL copied to clipboard.' });
                                                }
                                            } catch (e) {
                                                if (e?.name !== 'AbortError') {
                                                    toast({ variant: 'destructive', title: 'Share failed', description: e?.message || 'Unable to share document.' });
                                                }
                                            }
                                        };
                                        const handlePrint = (doc) => {
                                            const url = doc.fileUrl || doc.url;
                                            const w = window.open(url, '_blank');
                                            if (w) {
                                                w.addEventListener('load', () => { try { w.focus(); w.print(); } catch (_) {} });
                                            }
                                        };
                                        return (
                                            <TooltipProvider>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {accessoryDocs.map((doc, idx) => {
                                                    const url = doc.fileUrl || doc.url;
                                                    const name = doc.customName || doc.fileName || `Document ${idx + 1}`;
                                                    return (
                                                        <div key={(doc.filePath || url) + idx} className="flex items-center justify-between p-3 border rounded-md bg-card">
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <FileText className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                                                                <div className="overflow-hidden">
                                                                    <p className="text-sm font-medium truncate">{name}</p>
                                                                    {doc.tags?.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {doc.tags.map(t => <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                <Tooltip><TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" onClick={() => window.open(url, '_blank', 'noopener')}><Eye className="h-4 w-4" /></Button>
                                                                </TooltipTrigger><TooltipContent>View</TooltipContent></Tooltip>
                                                                <Tooltip><TooltipTrigger asChild>
                                                                    <a href={url} download={name}><Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button></a>
                                                                </TooltipTrigger><TooltipContent>Download</TooltipContent></Tooltip>
                                                                <Tooltip><TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" onClick={() => handleShare(doc)}><Share2 className="h-4 w-4" /></Button>
                                                                </TooltipTrigger><TooltipContent>Share</TooltipContent></Tooltip>
                                                                <Tooltip><TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" onClick={() => handlePrint(doc)}><Printer className="h-4 w-4" /></Button>
                                                                </TooltipTrigger><TooltipContent>Print</TooltipContent></Tooltip>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            </TooltipProvider>
                                        );
                                    })()
                                )}
                                {activeSubTab === 'complete' && (
                                    <div className="text-center py-12 text-muted-foreground">
                                        Coming soon
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {activeTab === 'results' && (
                            <ResultsTab
                                projectData={projectData}
                                projectId={project.id}
                                onSave={handleResultsSave}
                                toast={toast}
                                associationsData={associationsData}
                                affiliations={affiliations}
                            />
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
                                        {previewItem.groupName && <div><span className="font-medium">Discipline:</span> {previewItem.groupName}</div>}
                                        {previewItem.divisionNames && <div><span className="font-medium">Divisions:</span> {previewItem.divisionNames}</div>}
                                    </>
                                ) : (
                                    <>
                                        <div><span className="font-medium">Discipline:</span> {previewItem.disciplineName || previewItem.discipline}</div>
                                        {previewItem.groupName && <div><span className="font-medium">Discipline:</span> {previewItem.groupName}</div>}
                                        {previewItem.divisionNames && <div><span className="font-medium">Divisions:</span> {previewItem.divisionNames}</div>}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* Move to Folder Dialog */}
            <Dialog open={moveToFolderDialogOpen} onOpenChange={setMoveToFolderDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move to Folder</DialogTitle>
                        <DialogDescription>
                            Select a folder to move this {itemToMove?.type === 'pattern' ? 'pattern' : 'scoresheet'} to.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {folders.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No folders available. Create a folder first to organize your items.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {folders.map(folder => (
                                    <div
                                        key={folder.id}
                                        className="flex items-center gap-2 p-3 border rounded hover:bg-muted cursor-pointer"
                                        onClick={() => handleMoveToFolderConfirm(folder.id)}
                                    >
                                        <Folder className="h-4 w-4 text-yellow-500" />
                                        <span className="flex-1">{folder.name}</span>
                                        {folder.items && folder.items.length > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                                {folder.items.length}
                                            </Badge>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* View/Download Entire Pattern Book Dialog */}
            <PatternBookDownloadDialog
                open={viewDownloadDialogOpen}
                onOpenChange={setViewDownloadDialogOpen}
                project={dialogProject}
                setFormData={handleDialogFormDataChange}
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

// In Progress Card Component - matches the image design
const InProgressCard = ({ project, onRefresh }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const editPath = `/pattern-book-builder/${project.id}`;
    
    const handleContinueEditing = () => {
        navigate(editPath);
    };
    
    // Format status for display - supports both old and new status values
    const getDisplayStatus = () => {
        const status = (project.status || '').toString().trim();
        if (status.toLowerCase() === 'in progress') return 'In progress';
        if (status === 'Locked' || status === 'Lock & Approve Mode') return 'Locked';
        if (status === 'Final' || status === 'Publication') return 'Final';
        return status || 'Draft';
    };

    const displayStatus = getDisplayStatus();
    const isInProgress = displayStatus.toLowerCase() === 'in progress';
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="relative"
        >
            <Card className="bg-white border border-primary shadow-sm hover:shadow-md transition-all duration-300">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 mb-2">
                        <BookCopy className="h-5 w-5 text-primary shrink-0" />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <CardTitle className="text-lg font-bold text-foreground truncate cursor-pointer max-w-[150px]">
                                        {project.project_name || 'Untitled Project'}
                                    </CardTitle>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p>{project.project_name || 'Untitled Project'}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="mb-3">
                        <Badge className="bg-primary text-white text-xs font-medium px-2.5 py-0.5 rounded-full">
                            Pattern Book
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground pb-4">
                    <p>Last saved: {format(new Date(project.updated_at), "MMM d, yyyy")}</p>
                    <p>
                        Status: {' '}
                        <span className={`font-medium ${isInProgress ? 'text-green-500' : 'text-foreground'}`}>
                            {displayStatus}
                        </span>
                    </p>
                </CardContent>
                <CardFooter className="pt-4">
                    <Button 
                        onClick={handleContinueEditing} 
                        className="w-full bg-primary hover:bg-primary/90 text-white font-medium"
                    >
                        Continue Editing <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
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
    const editPath = isPatternBook
        ? `/pattern-book-builder/${project.id}`
        : isPatternFolder
        ? `/pattern-folder/${project.id}`
        : isPatternHub
        ? `/pattern-hub/${project.id}`
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
                            {isPatternHub ? 'Pattern' : isPatternBook ? 'Pattern Book' : 'Horse Show'}
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
const ContractCard = ({ project, onRefresh }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const projectData = project.project_data || {};
    const hasLinkedShow = !!projectData.linkedProjectId;
    const showName = projectData.showName || projectData.showDetails?.showName;
    const status = project.status || 'Draft';
    const createdAt = project.created_at ? format(new Date(project.created_at), 'MMM d, yyyy') : '—';

    const statusColor = {
        Draft: 'bg-gray-100 text-gray-700',
        'In progress': 'bg-blue-100 text-blue-700',
        Locked: 'bg-amber-100 text-amber-700',
        Final: 'bg-green-100 text-green-700',
    }[status] || 'bg-gray-100 text-gray-700';

    const handleDelete = async () => {
        const { error } = await supabase.from('projects').delete().eq('id', project.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Delete failed', description: error.message });
        } else {
            toast({ title: 'Contract deleted' });
            onRefresh?.();
        }
    };

    return (
        <Card className="group relative flex flex-col hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileSignature className="h-5 w-5 text-primary shrink-0" />
                        <CardTitle className="text-base truncate">{project.project_name || 'Untitled Contract'}</CardTitle>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/horse-show-manager/employee-management/contracts/${project.id}`)}>
                                <Eye className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/horse-show-manager/employee-management/contracts/${project.id}`)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <CardDescription className="text-xs mt-1">Created {createdAt}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-3">
                <div className="flex flex-wrap gap-1.5 mt-1">
                    <Badge variant="outline" className={statusColor}>{status}</Badge>
                    {hasLinkedShow ? (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">Linked to Show</Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">Unassigned</Badge>
                    )}
                </div>
                {showName && (
                    <p className="text-xs text-muted-foreground mt-2 truncate">Show: {showName}</p>
                )}
            </CardContent>
            <CardFooter className="pt-0">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/horse-show-manager/employee-management/contracts/${project.id}`)}
                >
                    <ArrowRight className="mr-2 h-4 w-4" /> Open Contract
                </Button>
            </CardFooter>
        </Card>
    );
};

const CustomerPortalPage = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProjects = async () => {
        if (!user) return;
        setIsLoading(true);
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
        setIsLoading(false);
    };

    useEffect(() => {
        fetchProjects();
    }, [user]);

    const patternBookProjects = projects.filter(p => p.project_type === 'pattern_book');
    const allShowProjects = projects.filter(p => {
        const mode = (p.mode || '').toString().trim();
        return p.project_type !== 'pattern_book' && p.project_type !== 'pattern_folder' && p.project_type !== 'pattern_hub' && p.project_type !== 'contract' && mode.toLowerCase() !== 'archived';
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
        horseShows: true
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
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default CustomerPortalPage;
