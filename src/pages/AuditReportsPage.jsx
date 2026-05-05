import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Search } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { format } from 'date-fns';

const AuditReportsPage = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ep_audit_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        toast({ title: 'Error fetching audit logs', description: error.message, variant: 'destructive' });
      } else {
        setLogs(data);
      }
      setIsLoading(false);
    };
    fetchLogs();
  }, [toast]);

  const handleExport = (format) => {
    toast({ title: `Exporting as ${format}`, description: 'This feature will be available soon.' });
  };

  return (
    <>
      <Helmet>
        <title>Audit & Reports - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight">Audit & Reports</h1>
            <p className="text-lg text-muted-foreground">Track all activity within the system.</p>
          </motion.div>

          <div className="flex justify-between items-center mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Filter by actor, date, entity..." className="pl-10" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleExport('CSV')}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
              <Button variant="outline" onClick={() => handleExport('PDF')}><Download className="mr-2 h-4 w-4" /> Export PDF</Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>{log.profiles?.full_name || 'System'}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>{log.entity_type} ({log.entity_id.substring(0, 8)}...)</TableCell>
                      <TableCell>{format(new Date(log.created_at), 'Pp')}</TableCell>
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

export default AuditReportsPage;