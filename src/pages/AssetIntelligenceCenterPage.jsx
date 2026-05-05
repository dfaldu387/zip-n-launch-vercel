import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { PlayCircle, RefreshCw, ListChecks, AlertTriangle, CheckCircle, Info, Loader2, Bot, FileDown, DatabaseZap } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import Navigation from '@/components/Navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabaseClient';

const AssetIntelligenceCenterPage = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [configs, setConfigs] = useState([]);

  const fetchConfigs = useCallback(async () => {
    const { data, error } = await supabase.from('crawler_configs').select('*');
    if (error) {
      toast({ title: 'Error fetching configs', description: error.message, variant: 'destructive' });
    } else {
      setConfigs(data);
    }
  }, [toast]);

  const fetchLogs = useCallback(async () => {
    setIsFetchingLogs(true);
    const { data, error } = await supabase.from('crawler_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) {
      toast({ title: 'Error fetching logs', description: error.message, variant: 'destructive' });
    } else {
      setLogs(data);
    }
    setIsFetchingLogs(false);
  }, [toast]);

  useEffect(() => {
    fetchConfigs();
    fetchLogs();
  }, [fetchConfigs, fetchLogs]);

  const handleRunCrawler = async () => {
    setIsLoading(true);
    toast({ title: 'Starting AI Crawler...', description: 'This may take a few minutes.' });
    try {
      if (!session) throw new Error('You must be logged in to run the crawler.');
      const { error } = await supabase.functions.invoke('asset-crawler');
      if (error) throw error;
      toast({ title: 'Crawler finished successfully!', description: 'Check the logs for details.' });
      fetchLogs();
    } catch (error) {
      toast({ title: 'Crawler Error', description: error.message, variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ERROR': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'INFO': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <>
      <Helmet>
        <title>Asset Intelligence Center - EquiPatterns</title>
        <meta name="description" content="Manage and monitor the AI-powered asset crawler for automated document fetching." />
      </Helmet>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Navigation />
        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Asset Intelligence Center</h1>
                <p className="text-lg text-gray-600 mt-1">Your automated command center for managing official association assets.</p>
              </div>
              <Button onClick={handleRunCrawler} disabled={isLoading || !session} size="lg">
                {isLoading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Running Crawler</>
                ) : (
                  <><Bot className="mr-2 h-5 w-5" /> Run AI Crawler Now</>
                )}
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
                <CardDescription>This tool automates the process of keeping your asset library up-to-date.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div className="flex flex-col items-center p-4 bg-background/50 rounded-lg">
                    <div className="p-3 rounded-full bg-primary/20 mb-3"><Bot className="h-8 w-8 text-primary" /></div>
                    <h3 className="font-semibold mb-1">1. AI Visits Websites</h3>
                    <p className="text-sm text-muted-foreground">The AI uses the "Crawler Configurations" list to visit official association websites.</p>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-background/50 rounded-lg">
                    <div className="p-3 rounded-full bg-primary/20 mb-3"><FileDown className="h-8 w-8 text-primary" /></div>
                    <h3 className="font-semibold mb-1">2. Downloads New Assets</h3>
                    <p className="text-sm text-muted-foreground">It intelligently scans for new or updated PDFs like patterns and score sheets, then downloads them.</p>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-background/50 rounded-lg">
                    <div className="p-3 rounded-full bg-primary/20 mb-3"><DatabaseZap className="h-8 w-8 text-primary" /></div>
                    <h3 className="font-semibold mb-1">3. Updates Your Library</h3>
                    <p className="text-sm text-muted-foreground">Finally, it saves the new files directly into your Asset Library, ready for use.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center"><ListChecks className="mr-2" /> Crawler Configurations</CardTitle>
                  <CardDescription>These are the source URLs the crawler will visit.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {configs.map(config => (
                        <div key={config.id} className="p-3 border rounded-lg bg-gray-50">
                          <p className="font-semibold text-gray-800">{config.association_id}</p>
                          <p className="text-sm text-gray-600">Type: <Badge variant="secondary">{config.parser_type}</Badge></p>
                          <a href={config.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                            {config.source_url}
                          </a>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center"><RefreshCw className="mr-2" /> Live Logs</CardTitle>
                      <CardDescription>Real-time updates from the asset crawler.</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={isFetchingLogs}>
                      <RefreshCw className={cn("h-4 w-4", isFetchingLogs && "animate-spin")} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-3 font-mono text-xs">
                      {logs.length === 0 && <p className="text-center text-gray-500 py-8">No logs yet. Run the crawler to see output.</p>}
                      {logs.map(log => (
                        <div key={log.id} className="flex items-start gap-3 p-2 bg-gray-50 rounded-md">
                          <div className="flex-shrink-0 pt-0.5">{getStatusIcon(log.status)}</div>
                          <div className="flex-grow">
                            <p className="font-semibold">{log.message}</p>
                            <p className="text-gray-500">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
                            {log.association_id && <Badge variant="outline">{log.association_id}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </main>
      </div>
    </>
  );
};

export default AssetIntelligenceCenterPage;