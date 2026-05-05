import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye } from 'lucide-react';
import Navigation from '@/components/Navigation';

const ScoreSheetLibraryPage = () => {
  const [scoreSheets, setScoreSheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchScoreSheets = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ep_scoresheets')
        .select(`
          *,
          ep_classes ( title, show_id ),
          ep_patterns ( title ),
          ep_scoresheet_templates ( discipline, version )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        toast({ title: 'Error fetching score sheets', description: error.message, variant: 'destructive' });
      } else {
        setScoreSheets(data);
      }
      setIsLoading(false);
    };
    fetchScoreSheets();
  }, [toast]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready': return <Badge variant="success">Ready</Badge>;
      case 'in_use': return <Badge variant="warning">In Use</Badge>;
      case 'archived': return <Badge variant="secondary">Archived</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <>
      <Helmet>
        <title>Score Sheet Library - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight">Score Sheet Library</h1>
            <p className="text-lg text-muted-foreground">View all generated score sheets and their status.</p>
          </motion.div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scoreSheets.map(sheet => (
                    <TableRow key={sheet.id}>
                      <TableCell>{sheet.ep_classes?.title || 'N/A'}</TableCell>
                      <TableCell>{sheet.ep_patterns?.title || 'N/A'}</TableCell>
                      <TableCell>{sheet.ep_scoresheet_templates?.discipline} v{sheet.ep_scoresheet_templates?.version}</TableCell>
                      <TableCell>{getStatusBadge(sheet.status)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => toast({ title: 'Preview coming soon!' })}>
                          <Eye className="h-4 w-4 mr-2" /> Preview
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default ScoreSheetLibraryPage;