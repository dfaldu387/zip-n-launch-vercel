import React, { useState, useEffect } from 'react';
    import { useParams } from 'react-router-dom';
    import { Helmet } from 'react-helmet-async';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/supabaseClient';
    import { Loader2, Info, Users, DollarSign, Calendar, Download, FileText, Facebook, Instagram, Youtube } from 'lucide-react';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { format } from 'date-fns';
    import Navigation from '@/components/Navigation';

    const DetailItem = ({ icon: Icon, label, value }) => (
        <div className="flex items-start">
            <Icon className="h-5 w-5 text-primary mr-3 mt-1 flex-shrink-0" />
            <div>
                <p className="font-semibold text-foreground">{label}</p>
                <p className="text-muted-foreground">{value || 'N/A'}</p>
            </div>
        </div>
    );

    const PublicShowPage = () => {
        const { showId } = useParams();
        const { toast } = useToast();
        const [showData, setShowData] = useState(null);
        const [assets, setAssets] = useState([]);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            const fetchShowData = async () => {
                setIsLoading(true);
                try {
                    const { data: projectData, error: projectError } = await supabase
                        .from('projects')
                        .select('*, project_assets(*)')
                        .eq('id', showId)
                        .single();

                    if (projectError) throw projectError;
                    if (!projectData) throw new Error('Show not found.');

                    setShowData(projectData);
                    setAssets(projectData.project_assets || []);
                } catch (error) {
                    toast({
                        title: 'Error fetching show data',
                        description: error.message,
                        variant: 'destructive',
                    });
                } finally {
                    setIsLoading(false);
                }
            };

            if (showId) {
                fetchShowData();
            }
        }, [showId, toast]);

        const handleDownload = (fileUrl, fileName) => {
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        if (isLoading) {
            return (
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </div>
            );
        }

        if (!showData) {
            return (
                <div className="min-h-screen bg-background flex flex-col items-center justify-center">
                    <Navigation />
                    <main className="text-center">
                        <h1 className="text-4xl font-bold mb-4">Show Not Found</h1>
                        <p className="text-muted-foreground">The show you are looking for does not exist or may have been moved.</p>
                    </main>
                </div>
            );
        }

        const { project_name, project_data } = showData;
        const { showDetails = {} } = project_data || {};
        const { general = {}, venue = {}, officials = {}, fees = [], entry = {}, scheduling = {}, awards = {} } = showDetails;
        const marketing = project_data?.marketing || {};
        const socialLinks = [
            { url: marketing.facebook, icon: Facebook, label: 'Facebook' },
            { url: marketing.instagram, icon: Instagram, label: 'Instagram' },
            { url: marketing.youtube, icon: Youtube, label: 'YouTube' },
        ].filter(s => s.url && s.url.trim());

        return (
            <>
                <Helmet>
                    <title>{project_name || 'Show Details'} - EquiPatterns</title>
                    <meta name="description" content={`Public details for the horse show: ${project_name}.`} />
                </Helmet>
                <div className="min-h-screen bg-background">
                    <Navigation />
                    <main className="container mx-auto px-4 py-12">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                            <CardHeader className="text-center px-0 mb-8">
                                <CardTitle className="text-4xl md:text-5xl font-bold">{project_name}</CardTitle>
                                {general.eventHost && <CardDescription className="text-xl text-muted-foreground">Hosted by {general.eventHost}</CardDescription>}
                                {socialLinks.length > 0 && (
                                    <div className="flex items-center justify-center gap-3 mt-3">
                                        {socialLinks.map(({ url, icon: Icon, label }) => (
                                            <a key={label} href={url} target="_blank" rel="noopener noreferrer" title={label} className="text-muted-foreground hover:text-primary transition-colors">
                                                <Icon className="h-5 w-5" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </CardHeader>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-8">
                                    <Card>
                                        <CardHeader><CardTitle className="flex items-center"><Info className="mr-2" /> General Information</CardTitle></CardHeader>
                                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <DetailItem icon={Calendar} label="Show Dates" value={`${format(new Date(project_data.startDate), 'PPP')} to ${format(new Date(project_data.endDate), 'PPP')}`} />
                                            <DetailItem icon={Info} label="Venue" value={venue.facilityName} />
                                            <DetailItem icon={Users} label="Show Manager" value={`${general.managerName} (${general.managerContactEmail})`} />
                                            <DetailItem icon={Users} label="Show Secretary" value={`${general.secretaryName} (${general.secretaryContactEmail})`} />
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader><CardTitle className="flex items-center"><Users className="mr-2" /> Officials & Staff</CardTitle></CardHeader>
                                        <CardContent>
                                            {Object.keys(officials).length > 0 ? (
                                                Object.entries(officials).map(([assocId, roles]) => (
                                                    <div key={assocId} className="mb-4">
                                                        {Object.entries(roles).map(([roleId, members]) => (
                                                            <div key={roleId}>
                                                                <h4 className="font-semibold text-md mt-2">{roleId}</h4>
                                                                <ul className="list-disc list-inside text-muted-foreground">
                                                                    {members.map(member => <li key={member.id}>{member.name}</li>)}
                                                                </ul>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))
                                            ) : <p className="text-muted-foreground">Staff details not available.</p>}
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="space-y-8">
                                    <Card>
                                        <CardHeader><CardTitle className="flex items-center"><FileText className="mr-2" /> Show Assets</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            {assets.length > 0 ? (
                                                assets.map(asset => (
                                                    <div key={asset.id} className="flex items-center justify-between p-2 rounded-md bg-secondary">
                                                        <span className="font-medium text-sm">{asset.custom_name || asset.file_name}</span>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDownload(asset.file_url, asset.file_name)}>
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))
                                            ) : <p className="text-muted-foreground text-sm">No public assets available for this show.</p>}
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader><CardTitle className="flex items-center"><DollarSign className="mr-2" /> Fee Highlights</CardTitle></CardHeader>
                                        <CardContent>
                                            {fees.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {fees.slice(0, 5).map(fee => (
                                                        <li key={fee.id} className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">{fee.name}</span>
                                                            <span className="font-semibold">${parseFloat(fee.amount).toFixed(2)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p className="text-muted-foreground">Fee details not available.</p>}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </motion.div>
                    </main>
                </div>
            </>
        );
    };

    export default PublicShowPage;