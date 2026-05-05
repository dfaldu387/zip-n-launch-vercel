import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Archive, Calendar, RotateCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const ArchivePatternsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [archivedProjects, setArchivedProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchArchivedProjects();
        }
    }, [user]);

    const fetchArchivedProjects = async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id)
            .eq('mode', 'archived')
            .order('updated_at', { ascending: false });

        if (!error && data) {
            setArchivedProjects(data);
        }
        setLoading(false);
    };

    const handleRestore = async (projectId) => {
        const { error } = await supabase
            .from('projects')
            .update({ mode: null })
            .eq('id', projectId);

        if (!error) {
            toast({ title: "Project restored", description: "Project has been restored successfully" });
            fetchArchivedProjects();
        }
    };

    const handlePermanentDelete = async (projectId) => {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (!error) {
            toast({ title: "Project deleted", description: "Project has been permanently deleted" });
            fetchArchivedProjects();
        } else {
            toast({
                title: "Error",
                description: "Failed to delete project",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Navigation />
            <main className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Archive className="h-8 w-8 text-muted-foreground" />
                        Archive Pattern
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        View and manage your archived projects. Restore or permanently delete them.
                    </p>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">Loading...</div>
                ) : archivedProjects.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No archived pattern books</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {archivedProjects.map((project) => (
                                <Card key={project.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg">
                                                    {project.project_name || 'Untitled Project'}
                                                </h3>
                                                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-4 w-4" />
                                                        Archived: {format(new Date(project.updated_at), 'MMM d, yyyy')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleRestore(project.id)}
                                                >
                                                    <RotateCcw className="h-4 w-4 mr-2" />
                                                    Restore
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handlePermanentDelete(project.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                        ))}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
};

export default ArchivePatternsPage;
