import React, { useState, useEffect, useMemo } from 'react';
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
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);

      // The actor's name is fetched separately on purpose.
      //
      // This used to ask for `*, profiles(full_name)` in one query. There is no
      // foreign key from ep_audit_logs.actor_id to profiles.id, so the database
      // could not work out how the two tables relate and refused the whole query
      // with "Could not find a relationship between 'ep_audit_logs' and 'profiles'".
      // The page therefore showed nothing at all — for admins too.
      const { data, error } = await supabase
        .from('ep_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        toast({ title: 'Error fetching audit logs', description: error.message, variant: 'destructive' });
        setLogs([]);
        setIsLoading(false);
        return;
      }

      const rows = data || [];
      const actorIds = [...new Set(rows.map(r => r.actor_id).filter(Boolean))];
      let namesById = {};

      if (actorIds.length > 0) {
        const { data: people } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', actorIds);
        namesById = Object.fromEntries((people || []).map(p => [p.id, p.full_name]));
      }

      setLogs(rows.map(r => ({ ...r, actorName: namesById[r.actor_id] || 'System' })));
      setIsLoading(false);
    };
    fetchLogs();
  }, [toast]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(log =>
      [log.actorName, log.action, log.entity_type, log.entity_id, log.created_at]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }, [logs, search]);

  // The export buttons used to say "this feature will be available soon". The rows
  // are already in memory, so CSV needs no server work.
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      toast({ title: 'Nothing to export', description: 'There are no entries in the current view.' });
      return;
    }

    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Actor', 'Action', 'Entity type', 'Entity id', 'Timestamp'];
    const body = filteredLogs.map(log => [
      log.actorName,
      log.action,
      log.entity_type,
      log.entity_id,
      log.created_at,
    ].map(escape).join(','));

    const csv = [header.map(escape).join(','), ...body].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">Audit & Reports</h1>
            <p className="text-lg text-muted-foreground">Track all activity within the system.</p>
          </motion.div>

          <div className="flex justify-between items-center mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Filter by actor, action, entity..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
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
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                        {logs.length === 0 ? 'No activity recorded yet.' : 'No entries match your filter.'}
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>{log.actorName}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>
                        {/* entity_id can be empty on older rows; .substring on null
                            used to throw and blank the whole page. */}
                        {log.entity_type}
                        {log.entity_id ? ` (${String(log.entity_id).substring(0, 8)}…)` : ''}
                      </TableCell>
                      <TableCell>
                        {log.created_at ? format(new Date(log.created_at), 'Pp') : '—'}
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

export default AuditReportsPage;