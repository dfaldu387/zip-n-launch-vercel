import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, UploadCloud, BarChart2, PlusCircle, AlertCircle, LogIn, DollarSign, Share2, Eye, MessageCircle, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import Navigation from '@/components/Navigation';
import { supabase } from '@/lib/supabaseClient';
import PatternPreviewModal from '@/components/pattern-upload/PatternPreviewModal';
import { buildPatternId } from '@/lib/patternIdFormatter';

const ContributorPortalPage = () => {
    const { user, loading: authLoading, openAuthModal } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [patterns, setPatterns] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState(null);
    const [previewPattern, setPreviewPattern] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;
    const totalPages = Math.max(1, Math.ceil(patterns.length / PAGE_SIZE));
    const paginatedPatterns = patterns.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const fetchPatterns = useCallback(async () => {
        if (!user) {
            setLoadingData(false);
            return;
        }

        try {
            setLoadingData(true);
            setError(null);
            const { data, error: fetchError } = await supabase
                .from('patterns')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (fetchError) {
                throw fetchError;
            }
            
            setPatterns(data || []);
        } catch (err) {
            setError('Failed to fetch your patterns. Please try again later.');
            toast({
                title: 'Error',
                description: err.message || 'Could not load your patterns.',
                variant: 'destructive',
            });
            console.error(err);
        } finally {
            setLoadingData(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (!authLoading) {
            fetchPatterns();
        }
    }, [user, authLoading, fetchPatterns]);

    const getStatusVariant = (status) => {
        switch (status) {
            case 'approved': return 'success';
            case 'pending': return 'secondary';
            case 'rejected': return 'destructive';
            default: return 'outline';
        }
    };

    const getPatternDisplayName = (pattern) => {
        const parts = [pattern.name];
        if (pattern.division) parts.push(pattern.division);
        if (pattern.level) parts.push(pattern.level);
        return parts.filter(Boolean).join(' · ');
    };

    const handleViewPattern = (pattern) => {
        setPreviewPattern({
            name: getPatternDisplayName(pattern),
            // Show extracted diagram image if available, otherwise show original PDF
            file_url: pattern.preview_image_url || pattern.file_url || pattern.pdf_url || pattern.image_url,
        });
    };

    const [isCreatingEdit, setIsCreatingEdit] = useState(null);

    const handleEditAndResubmit = async (pattern) => {
        setIsCreatingEdit(pattern.id);
        try {
            // Fetch the pattern's associations
            const { data: assocData } = await supabase
                .from('pattern_associations')
                .select('association_id, difficulty')
                .eq('pattern_id', pattern.id);

            // Build wizard formData from the rejected pattern
            const associations = {};
            const associationDifficulties = {};
            (assocData || []).forEach(pa => {
                associations[pa.association_id] = true;
                associationDifficulties[pa.association_id] = pa.difficulty || 'Intermediate';
            });

            // Determine the slot ID for the pattern
            const slotId = 'level-1'; // Default to first hierarchy slot
            const wizardFormData = {
                showName: pattern.pattern_set_name || '',
                associations,
                primaryAffiliates: [],
                subAssociationSelections: {},
                associationDifficulties,
                selectedDiscipline: pattern.class_name || '',
                selectedClasses: pattern.class_name
                    ? Object.keys(associations).map(assocId => `${assocId}::${pattern.class_name}`)
                    : [],
                hierarchyOrder: [
                    { id: 'level-1', title: 'Championship', description: 'Pinnacle difficulty, finals-style patterns' },
                    { id: 'level-2', title: 'Skilled', description: 'Polished, technical riding' },
                    { id: 'level-3', title: 'Intermediate', description: 'Standard, reliable proficiency' },
                    { id: 'level-4', title: 'Novice', description: 'Basic, learning stage' },
                    { id: 'level-5', title: 'Walk-Trot', description: 'Entry, foundation patterns' },
                ],
                patterns: {
                    [slotId]: {
                        id: slotId,
                        name: pattern.name || 'pattern.pdf',
                        dataUrl: pattern.file_url,
                    },
                },
                patternManeuvers: {},
                patternAnnotations: {},
                patternVerbiage: { [slotId]: pattern.verbiage || '' },
                patternDivisions: {},
                accessoryDocs: [],
                equipmentNotes: '',
                agreedToTerms: false,
                stagedPdfs: [],
                // Track which rejected pattern this is editing
                resubmitPatternId: pattern.id,
                rejectionReason: pattern.rejection_reason,
                currentStep: 1,
                completedSteps: [],
            };

            // Create a project for the wizard
            const projectId = uuidv4();
            const { error } = await supabase.from('projects').insert([{
                id: projectId,
                project_name: pattern.pattern_set_name || pattern.name || 'Resubmit Pattern',
                project_type: 'pattern_upload',
                project_data: wizardFormData,
                status: 'In progress',
                user_id: user.id,
            }]);

            if (error) throw error;

            navigate(`/upload-patterns/edit/${projectId}`);
        } catch (err) {
            toast({
                title: 'Error',
                description: err.message || 'Failed to open editor.',
                variant: 'destructive',
            });
        } finally {
            setIsCreatingEdit(null);
        }
    };

    
    const LoggedOutView = () => (
        <div className="text-center py-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <h2 className="text-3xl font-bold tracking-tight">Unlock Your Potential as a Pattern Contributor</h2>
                <p className="mt-4 text-lg text-muted-foreground">Join our community of designers to monetize your creativity and shape the future of horse show events.</p>
                <div className="mt-8 flex justify-center gap-4">
                    <Button size="lg" onClick={() => openAuthModal('sign_up')}>
                        <UploadCloud className="mr-2 h-5 w-5" /> Become a Contributor
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => openAuthModal('login')}>
                        <LogIn className="mr-2 h-5 w-5" /> Contributor Login
                    </Button>
                </div>
            </motion.div>
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="text-primary"/>Monetize Your Work</CardTitle></CardHeader>
                    <CardContent>Earn royalties every time your patterns are used in a show. Get detailed analytics on your top-performing designs.</CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Share2 className="text-primary"/>Reach a Wider Audience</CardTitle></CardHeader>
                    <CardContent>Showcase your patterns to thousands of show managers, trainers, and riders across multiple associations.</CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle className="text-primary"/>Simple & Powerful Tools</CardTitle></CardHeader>
                    <CardContent>Our easy-to-use uploader and management dashboard make it simple to license and track your creative assets.</CardContent>
                </Card>
            </div>
        </div>
    );

    const LoggedInView = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Link to="/upload-patterns/new">
                    <Card className="hover:shadow-lg hover:border-primary/50 transition-all duration-300">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Upload New Pattern</CardTitle>
                            <UploadCloud className="h-5 w-5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary">Get Started</div>
                            <p className="text-xs text-muted-foreground">Submit a new pattern set for review.</p>
                        </CardContent>
                    </Card>
                </Link>
                <Card className="hover:shadow-lg transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Analytics</CardTitle>
                        <BarChart2 className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Coming Soon</div>
                        <p className="text-xs text-muted-foreground">Track your patterns' performance.</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-lg transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">New Pattern Book</CardTitle>
                        <PlusCircle className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <Link to="/pattern-book-builder">
                            <div className="text-2xl font-bold text-primary">Build Now</div>
                        </Link>
                        <p className="text-xs text-muted-foreground">Use our guided pattern book builder.</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>My Submitted Patterns</CardTitle>
                    <CardDescription>A history of all the patterns you've submitted.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingData ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-4 text-muted-foreground">Loading your patterns...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-10 text-destructive-foreground bg-destructive/20 rounded-lg">
                            <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                            <p>{error}</p>
                        </div>
                    ) : patterns.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed rounded-lg">
                            <h3 className="text-lg font-semibold">No patterns found</h3>
                            <p className="text-muted-foreground mt-1 mb-4">You haven't uploaded any patterns yet.</p>
                            <Link to="/upload-patterns/new">
                                <Button><UploadCloud className="mr-2 h-4 w-4" /> Upload Your First Pattern</Button>
                            </Link>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name / Set</TableHead>
                                    <TableHead>Class</TableHead>
                                    <TableHead>Date Submitted</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedPatterns.map((pattern) => {
                                    const isCapo = Array.isArray(pattern.tags) && pattern.tags.includes('CAPO');
                                    const structuredId = buildPatternId({
                                        discipline: pattern.class_name,
                                        number: pattern.pattern_number,
                                        level: pattern.level,
                                        fileType: 'pattern',
                                        useAsOriginal: !!pattern.use_as_original,
                                        isCapo,
                                    });
                                    return (
                                    <TableRow key={pattern.id}>
                                        <TableCell className="font-medium">
                                            <div>{pattern.name}</div>
                                            <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded inline-block mt-0.5">
                                                {structuredId}
                                            </code>
                                            {pattern.pattern_set_name && (
                                                <div className="text-xs text-muted-foreground mt-0.5">{pattern.pattern_set_name}</div>
                                            )}
                                            {(pattern.division || pattern.level) && (
                                                <div className="text-xs text-primary/70 mt-0.5">
                                                    {[pattern.division, pattern.level].filter(Boolean).join(' · ')}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>{pattern.class_name}</TableCell>
                                        <TableCell>{format(new Date(pattern.created_at), 'MMM d, yyyy')}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusVariant(pattern.review_status)}>
                                                {pattern.review_status}
                                            </Badge>
                                            {pattern.review_status === 'rejected' && pattern.rejection_reason && (
                                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
                                                    <div className="flex items-center gap-1 font-medium mb-1">
                                                        <MessageCircle className="h-3 w-3" /> Admin Feedback
                                                    </div>
                                                    <p className="whitespace-pre-line">{pattern.rejection_reason}</p>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleViewPattern(pattern)}
                                                >
                                                    <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                                                </Button>
                                                {pattern.review_status === 'rejected' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-primary border-primary hover:bg-primary hover:text-white"
                                                        onClick={() => handleEditAndResubmit(pattern)}
                                                        disabled={isCreatingEdit === pattern.id}
                                                    >
                                                        {isCreatingEdit === pattern.id ? (
                                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                                        )}
                                                        Edit & Resubmit
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
                {!loadingData && !error && patterns.length > PAGE_SIZE && (
                    <CardFooter className="flex items-center justify-between border-t pt-4">
                        <div className="text-sm text-muted-foreground">
                            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, patterns.length)} of {patterns.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </>
    );

    return (
        <>
            <Helmet>
                <title>Contributor Portal - EquiPatterns</title>
                <meta name="description" content="Manage your submitted patterns, view their status, and access contributor tools." />
            </Helmet>
            <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
                <Navigation />
                <main className="container mx-auto p-4 md:p-8">
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ duration: 0.6 }}
                        className="mb-8"
                    >
                        <CardHeader className="text-center px-0">
                            <CardTitle className="text-4xl md:text-5xl font-bold">Contributor Portal</CardTitle>
                            <CardDescription className="text-xl text-muted-foreground">
                                {user ? "Your hub for creating and managing horse show patterns." : "Monetize your creativity. Join the community."}
                            </CardDescription>
                        </CardHeader>
                    </motion.div>
                    
                    {authLoading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        </div>
                    ) : user ? <LoggedInView /> : <LoggedOutView />}
                </main>
            </div>

            <PatternPreviewModal
                isOpen={!!previewPattern}
                onClose={() => setPreviewPattern(null)}
                pattern={previewPattern}
            />

        </>
    );
};

export default ContributorPortalPage;
