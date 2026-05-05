import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

import { fetchAssociations } from '@/lib/associationsData';

const initialFormData = {
    usageType: '',
    showType: '',
    associations: {},
    customAssociations: [],
    primaryAffiliates: [],
    nsbaApprovalType: '',
    nsbaCategory: '',
    nsbaDualApprovedWith: [],
    phbaHorseType: 'stock',
    pthaHorseType: 'stock',
    disciplines: [],
    showName: '',
    startDate: '',
    endDate: '',
    venueAddress: '',
    officials: [],
    staff: [],
    coverPageOption: 'none',
    patternSelections: {},
    scoresheetSelections: {},
    groupJudges: {},
    associationJudges: {},
    dueDateSelections: [],
    disciplineDueDates: {},
    groupDueDates: {},
    divisionDates: {},
    divisionOrder: [],
    schedule: [],
    judgeSelections: [],
    customDivisions: [],
    subAssociationSelections: {},
    disciplinePatterns: {},
    open_divisions: false,
    selectedAssociations: {},
    pattern_type: 'rulebook',
    category: 'pattern_and_scoresheet',
    isCustom: false,
    sort_order: 0,
    city: null,
    patternGroups: [],
    selectedDivisions: {},
    selectedLevels: {},
    downloadIncludes: { pattern: true, scoresheet: true },
    // Future-safe: accessory documents (cone spacing, arena setup, warm-up guides, etc.)
    // Each entry: { id, type, name, fileUrl?, patternId?, disciplineId? }
    // Types: 'cone_spacing', 'arena_setup', 'warmup_guide', 'custom'
    accessoryDocuments: [],
};

export const usePatternHub = (projectId) => {
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState(initialFormData);
    const [highestStepReached, setHighestStepReached] = useState(0);
    
    const [isLoading, setIsLoading] = useState(true);
    const [disciplineLibrary, setDisciplineLibrary] = useState([]);
    const [associationsData, setAssociationsData] = useState([]);
    const [divisionsData, setDivisionsData] = useState({});
    const [usagePurposes] = useState([
        { id: 'horse_show', name: 'Horse Show', sort_order: 1 },
        { id: 'clinic', name: 'Clinic / Practicing / Coaching', sort_order: 2 },
        { id: 'just_for_fun', name: 'Just for Fun', sort_order: 3 },
    ]);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const [disciplinesRes, associations, divisionsRes] = await Promise.all([
                    supabase.from('disciplines').select('*').order('sort_order'),
                    fetchAssociations(),
                    supabase.from('divisions').select('*, division_levels(*)').order('sort_order'),
                ]);

                if (disciplinesRes.error) throw disciplinesRes.error;
                if (divisionsRes.error) throw divisionsRes.error;
    
                const formattedDisciplines = disciplinesRes.data.map(d => ({
                  ...d,
                  associations: d.association_id ? [{ association_id: d.association_id, sub_association_type: d.sub_association_type }] : []
                }));
                setDisciplineLibrary(formattedDisciplines);
                setAssociationsData(associations);
                
                const divisionsByAssoc = (divisionsRes.data || []).reduce((acc, div) => {
                    const key = div.association_id;
                    if (!acc[key]) acc[key] = [];
                    
                    div.division_levels.sort((a, b) => a.sort_order - b.sort_order);
                    
                    acc[key].push({ 
                        group: div.name, 
                        levels: div.division_levels.map(l => l.name),
                        sub_association_type: div.sub_association_type
                    });
                    return acc;
                }, {});
                setDivisionsData(divisionsByAssoc);
                
                // Load existing project data if projectId is provided
                if (projectId && projectId !== 'undefined') {
                    const { data: projectData, error: projectError } = await supabase
                        .from('projects')
                        .select('id, project_name, project_data, status')
                        .eq('id', projectId)
                        .eq('project_type', 'pattern_hub')
                        .maybeSingle();
                    
                    if (projectError) {
                        console.error('Error fetching project:', projectError);
                        toast({
                            title: 'Error loading project',
                            description: projectError.message || 'Failed to load project data',
                            variant: 'destructive',
                        });
                    } else if (projectData && projectData.project_data) {
                        console.log('Loading project data:', projectData);
                        
                        // Extract project_data and merge with initialFormData to ensure all fields are present
                        const savedProjectData = projectData.project_data;
                        
                        // Load project data - merge with initialFormData to ensure all fields exist
                        setFormData(prev => {
                            const mergedData = {
                                ...initialFormData,
                                ...savedProjectData,
                                id: projectId, // Store projectId in formData for reference
                            };
                            console.log('Merged form data:', mergedData);
                            return mergedData;
                        });
                        
                        // Restore step and completed steps from project_data (not from separate columns)
                        // Restore step and completed steps; clamp to max step 7 (Generate)
                        let savedStep = savedProjectData.currentStep || 0;
                        if (savedStep > 7) savedStep = 7;
                        const savedCompleted = savedProjectData.completedSteps || [];
                        const maxCompleted = savedCompleted.length > 0 ? Math.max(...savedCompleted) : 0;
                        const maxStep = Math.max(savedStep, maxCompleted > 7 ? 7 : maxCompleted);
                        
                        console.log('Restoring step:', savedStep, 'completed steps:', savedCompleted, 'highest:', maxStep);
                        setCurrentStep(savedStep);
                        setHighestStepReached(maxStep);
                    } else {
                        console.log('No project data found, using defaults');
                        // Project not found or not a pattern_hub, use defaults
                        setFormData(prev => ({
                            ...prev,
                            startDate: new Date().toISOString().split('T')[0],
                            venueAddress: 'Digital Download',
                        }));
                    }
                } else {
                    // No projectId, use defaults
                    setFormData(prev => ({
                        ...prev,
                        startDate: new Date().toISOString().split('T')[0],
                        venueAddress: 'Digital Download',
                    }));
                }
    
            } catch (error) {
                toast({
                    title: 'Error fetching data',
                    description: error.message,
                    variant: 'destructive',
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [projectId, toast]);

    const resetDisciplines = useCallback(() => {
      setFormData(prev => ({ ...prev, disciplines: [] }));
    }, [setFormData]);

    return {
        currentStep, setCurrentStep,
        formData, setFormData,
        isLoading,
        disciplineLibrary,
        associationsData,
        divisionsData,
        usagePurposes,
        resetDisciplines,
        highestStepReached,
        setHighestStepReached,
    };
};