import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Navigation from '@/components/Navigation';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { ResultsDashboard } from '@/components/show-builder/results/ResultsDashboard';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { stampModuleStatusOnSave, isWizardReadOnly } from '@/lib/moduleStatusService';
import { ModuleLockGuard } from '@/components/shared/ModuleLockGuard';

const ResultsManagementPage = () => {
    const { showId } = useParams();
    const { user } = useAuth();
    const { toast } = useToast();
    const [shows, setShows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedShow, setSelectedShow] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchShows = async () => {
            if (!user) { setIsLoading(false); return; }
            const { data, error } = await supabase
                .from('projects')
                .select('id, project_name, project_type, project_data, status, created_at')
                .not('project_type', 'in', '("pattern_folder","pattern_hub","pattern_upload","contract")')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            let combined = data || [];
            if (!error && showId && !combined.some(s => s.id === showId)) {
                // Not one of my own shows — I may still be a Full/Section Admin on
                // it via Manage Access. RLS on `projects` allows owner OR admin.
                const { data: adminShow } = await supabase
                    .from('projects')
                    .select('id, project_name, project_type, project_data, status, created_at, user_id, admins')
                    .eq('id', showId)
                    .maybeSingle();
                if (adminShow) combined = [...combined, adminShow];
            }
            if (!error) {
                setShows(combined);
                if (showId) {
                    const match = combined.find(s => s.id === showId);
                    if (match) setSelectedShow(match);
                }
            }
            setIsLoading(false);
        };
        fetchShows();
    }, [user, showId]);

    const isReadOnly = isWizardReadOnly(selectedShow?.project_data, 'results');

    const handleSave = async (updatedProjectData) => {
        if (!selectedShow || isReadOnly) return; // a locked section must never write back
        setIsSaving(true);
        try {
            const dataWithStatus = stampModuleStatusOnSave(updatedProjectData, 'results');
            const { error } = await supabase
                .from('projects')
                .update({ project_data: dataWithStatus })
                .eq('id', selectedShow.id);
            if (error) throw error;
            setSelectedShow(prev => ({ ...prev, project_data: dataWithStatus }));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: dataWithStatus } : s));
            toast({ title: 'Results Saved', description: 'All results data has been saved successfully.' });
        } catch (error) {
            toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Helmet><title>Results Entry - Horse Show Manager</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <PageHeader
                        title="Results Entry"
                        backTo={showId ? `/horse-show-manager/show/${showId}` : '/horse-show-manager'}
                    />

                    {!showId && (
                        <div className="mb-6">
                            <LinkToExistingShow
                                existingProjects={shows}
                                linkedProjectId={selectedShow?.id || null}
                                onLink={(projectId) => {
                                    if (projectId === 'none') { setSelectedShow(null); return; }
                                    const show = shows.find(s => s.id === projectId);
                                    if (show) setSelectedShow(show);
                                }}
                                description="Link to an existing show to enter results."
                            />
                        </div>
                    )}

                    {selectedShow && (
                        <ModuleLockGuard isLocked={isReadOnly} moduleName="Results Entry">
                            <ResultsDashboard show={selectedShow} onSave={handleSave} isSaving={isSaving} />
                        </ModuleLockGuard>
                    )}
                </main>
            </div>
        </>
    );
};

export default ResultsManagementPage;
