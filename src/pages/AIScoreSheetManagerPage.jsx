import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Bot, CheckCircle, Clock, AlertTriangle, BookOpen, Loader2, RefreshCw, FileText, ServerCrash, ShieldAlert } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const LogIcon = ({ status }) => {
    switch (status) {
        case 'SUCCESS': return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'WARNING': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
        case 'ERROR': return <ServerCrash className="h-4 w-4 text-red-500" />;
        default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
};

const AIScoreSheetManagerPage = () => {
    const { toast } = useToast();
    const { session } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [isChecking, setIsChecking] = useState(false);
    const [lastRun, setLastRun] = useState(null);
    const [isFetching, setIsFetching] = useState(true);
    const [logs, setLogs] = useState([]);

    const fetchTemplates = useCallback(async () => {
        setIsFetching(true);
        const { data, error } = await supabase
            .from('scoresheet_templates')
            .select('*')
            .order('year', { ascending: false })
            .order('association_id', { ascending: true })
            .order('class_name', { ascending: true });

        if (error) {
            toast({ title: 'Error Fetching Templates', description: error.message, variant: 'destructive' });
            setTemplates([]);
        } else {
            setTemplates(data);
        }
        setIsFetching(false);
    }, [toast]);

    const fetchLastRun = useCallback(async () => {
        const { data, error } = await supabase
            .from('crawler_logs')
            .select('created_at, run_id')
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (data && data.length > 0) {
            setLastRun({ date: new Date(data[0].created_at), runId: data[0].run_id });
        }
    }, []);

    const fetchLogs = useCallback(async (runId) => {
        if (!runId) return;
        const { data, error } = await supabase
            .from('crawler_logs')
            .select('*')
            .eq('run_id', runId)
            .order('created_at', { ascending: true });
        
        if (error) {
            toast({ title: 'Error Fetching Logs', description: error.message, variant: 'destructive' });
        } else {
            setLogs(data);
        }
    }, [toast]);

    useEffect(() => {
        fetchTemplates();
        fetchLastRun();
    }, [fetchTemplates, fetchLastRun]);

    useEffect(() => {
        if (lastRun?.runId) {
            fetchLogs(lastRun.runId);
        }
    }, [lastRun, fetchLogs]);

    const handleCheckForUpdates = async () => {
        setIsChecking(true);
        setLogs([]);
        toast({
            title: "Checking for updates...",
            description: "AI crawler is scanning association websites for new assets.",
        });

        try {
            if (!session || !session.access_token) {
              throw new Error("Authentication error: No active session found. Please log in again.");
            }
            const { data, error } = await supabase.functions.invoke('scoresheet-crawler', {
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });

            if (error) throw error;

            const newRunId = data.runId;
            const now = new Date();
            setLastRun({ date: now, runId: newRunId });
            
            toast({
                title: "Update Check Complete!",
                description: data.message,
                duration: 6000,
            });
            
            await fetchLogs(newRunId);
            await fetchTemplates();

        } catch (error) {
            toast({
                title: 'Update Check Failed',
                description: error.message || "Could not connect to the AI crawler service.",
                variant: 'destructive',
            });
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <>
            <Helmet>
                <title>AI Asset Manager - EquiPatterns</title>
                <meta name="description" content="Manage and update the AI-powered library of official score sheet templates and rulebooks." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-12">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <CardHeader className="text-center px-0 mb-8">
                            <CardTitle className="text-4xl md:text-5xl font-bold flex items-center justify-center">
                                <Bot className="mr-4 h-12 w-12" /> AI Asset Manager
                            </CardTitle>
                            <CardDescription className="text-xl text-muted-foreground max-w-3xl mx-auto">
                                Manage the central library of score sheets and check for yearly updates to templates & rulebooks.
                            </CardDescription>
                        </CardHeader>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1 flex flex-col gap-8">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><RefreshCw />Automated Content Updates</CardTitle>
                                        <CardDescription>Trigger the AI crawler to scan for new assets.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                           This process invokes a secure backend function that crawls official association websites for new or updated documents.
                                        </p>
                                        <Button onClick={handleCheckForUpdates} disabled={isChecking || !session} className="w-full">
                                            {isChecking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking...</> : "Check for Updates Now"}
                                        </Button>
                                         {lastRun && (
                                            <p className="text-xs text-muted-foreground text-center">
                                                <Clock className="inline-block mr-1 h-3 w-3" />
                                                Last run: {formatDistanceToNow(lastRun.date, { addSuffix: true })}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Last Run Log</CardTitle>
                                        <CardDescription>Detailed log of the most recent crawler activity.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                                            {logs.length === 0 && !isChecking && <p className="text-sm text-muted-foreground text-center py-4">No logs for the last run.</p>}
                                            {isChecking && logs.length === 0 && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
                                            {logs.map(log => (
                                                <div key={log.id} className="flex items-start gap-3 text-xs">
                                                    <LogIcon status={log.status} />
                                                    <div className="flex-1">
                                                        <p className="font-medium">{log.message}</p>
                                                        <p className="text-muted-foreground">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="lg:col-span-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Score Sheet Template Library</CardTitle>
                                        <CardDescription>Currently available templates in the database.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="max-h-[600px] overflow-y-auto">
                                            <Table>
                                                <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm">
                                                    <TableRow>
                                                        <TableHead>Association</TableHead>
                                                        <TableHead>Class</TableHead>
                                                        <TableHead>Year</TableHead>
                                                        <TableHead>Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isFetching ? (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-8">
                                                                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : templates.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No templates found.</TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        templates.map(template => (
                                                            <TableRow key={template.id}>
                                                                <TableCell><Badge variant="secondary">{template.association_id}</Badge></TableCell>
                                                                <TableCell>{template.class_name}</TableCell>
                                                                <TableCell>{template.year}</TableCell>
                                                                <TableCell>
                                                                    <span className="flex items-center text-green-600">
                                                                        <CheckCircle className="mr-2 h-4 w-4" /> Active
                                                                    </span>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
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

export default AIScoreSheetManagerPage;