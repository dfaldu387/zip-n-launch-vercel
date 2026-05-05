import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Save, Loader2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useMediaConfig } from '@/contexts/MediaConfigContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import MediaSelector from '@/components/MediaSelector';
import { pageConfig } from '@/lib/pageConfig';

const MediaAssignmentsPage = () => {
    const { toast } = useToast();
    const { config, updateConfig, loading: configLoading } = useMediaConfig();
    
    const [assignments, setAssignments] = useState({});
    const [availableMedia, setAvailableMedia] = useState({});
    const [mediaLoading, setMediaLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchMedia = useCallback(async () => {
        setMediaLoading(false);
        toast({ title: 'Supabase Disconnected', description: 'Cannot fetch media.', variant: 'destructive' });
    }, [toast]);

    useEffect(() => {
        fetchMedia();
    }, [fetchMedia]);

    useEffect(() => {
        if (!configLoading) {
            setAssignments(config);
        }
    }, [config, configLoading]);

    const handleAssignmentChange = (targetId, mediaItem) => {
        setAssignments(prev => ({
            ...prev,
            [targetId]: {
                url: mediaItem.file_url,
                id: mediaItem.id,
            },
        }));
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        toast({ title: 'Supabase Disconnected', description: 'Cannot save assignments.', variant: 'destructive' });
        setIsSaving(false);
    };

    const isLoading = configLoading || mediaLoading;
    const containerVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, staggerChildren: 0.1 } } };

    return (
        <>
            <Helmet>
                <title>Media Assignments - Admin Dashboard</title>
                <meta name="description" content="Assign media assets to different sections of the website." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible">
                        <CardHeader className="text-center mb-8 px-0">
                            <CardTitle className="text-4xl md:text-5xl font-bold">Media Assignments</CardTitle>
                            <CardDescription className="text-xl text-muted-foreground max-w-3xl mx-auto">
                                Define which images and videos appear on specific pages and components.
                            </CardDescription>
                        </CardHeader>
                        <Card>
                            <CardContent className="p-6">
                                {isLoading ? (
                                    <div className="flex justify-center items-center h-48">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : (
                                    <motion.div variants={containerVariants} className="space-y-4">
                                        <Accordion type="multiple" className="w-full space-y-4">
                                            {pageConfig.map((group) => (
                                                <AccordionItem value={group.category} key={group.category}>
                                                    <AccordionTrigger className="text-xl font-semibold bg-secondary/30 hover:bg-secondary/50 px-4 py-3 rounded-lg">
                                                        {group.category}
                                                    </AccordionTrigger>
                                                    <AccordionContent className="p-4 space-y-6">
                                                        {group.pages.map(page => (
                                                            <MediaSelector
                                                                key={page.targetId}
                                                                targetId={page.targetId}
                                                                label={page.label}
                                                                description={page.description}
                                                                currentAssignment={assignments[page.targetId]}
                                                                availableMedia={availableMedia}
                                                                onAssignmentChange={handleAssignmentChange}
                                                                defaultImage={page.defaultImage}
                                                            />
                                                        ))}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                        
                                        <div className="pt-6 border-t border-border">
                                            <Button onClick={handleSaveChanges} className="w-full" disabled={isSaving || isLoading}>
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                {isSaving ? 'Saving...' : 'Save All Assignments'}
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </main>
            </div>
        </>
    );
};
export default MediaAssignmentsPage;