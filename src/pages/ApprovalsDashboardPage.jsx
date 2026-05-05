import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, MessageSquare, AlertTriangle } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { format } from 'date-fns';

const ApprovalItem = ({ approval, onProcess }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleOpenDialog = (dec) => {
    setDecision(dec);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    await onProcess(approval.id, decision, notes);
    setIsProcessing(false);
    setIsDialogOpen(false);
    setNotes('');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <Badge variant="warning">Pending</Badge>;
      case 'approved': return <Badge variant="success">Approved</Badge>;
      case 'changes_requested': return <Badge variant="destructive">Changes Requested</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{approval.entity_type}</p>
            <h3 className="font-semibold text-lg">{approval.ep_patterns?.title || 'Untitled'} (v{approval.version})</h3>
            <p className="text-sm text-muted-foreground">
              Requested by: {approval.profiles?.full_name || 'Unknown User'} on {format(new Date(approval.created_at), 'PPP')}
            </p>
            <div className="mt-2">
              {getStatusBadge(approval.decision)}
            </div>
          </div>
          {approval.decision === 'pending' && (
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="success" onClick={() => handleOpenDialog('approved')}>
                <CheckCircle className="mr-2 h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="warning" onClick={() => handleOpenDialog('changes_requested')}>
                <MessageSquare className="mr-2 h-4 w-4" /> Request Changes
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleOpenDialog('rejected')}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Decision: {decision.replace('_', ' ')}</DialogTitle>
            <DialogDescription>
              Add optional notes for your decision. For "Changes Requested", notes are highly recommended.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Provide feedback or reasons for your decision..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ApprovalsDashboardPage = () => {
  const [approvals, setApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const fetchApprovals = useCallback(async () => {
    if (!profile?.role) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('ep_approvals')
      .select(`
        *,
        ep_patterns ( title ),
        profiles ( full_name )
      `)
      .contains('approver_roles', [profile.role])
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error fetching approvals',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setApprovals(data);
    }
    setIsLoading(false);
  }, [profile, toast]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleProcessApproval = async (approvalId, decision, notes) => {
    // Placeholder for AI validation
    const validationPassed = true; // await runAIValidators(approvalId);
    if (!validationPassed) {
        toast({
            title: 'Validation Failed',
            description: 'Automatic checks failed. Cannot approve at this time.',
            variant: 'destructive'
        });
        return;
    }

    const { error } = await supabase
      .from('ep_approvals')
      .update({
        decision: decision,
        notes: notes,
        decision_at: new Date().toISOString(),
      })
      .eq('id', approvalId);

    if (error) {
      toast({
        title: 'Failed to process approval',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: `Approval has been processed as "${decision.replace('_', ' ')}".`,
      });
      // On successful approval, offer to generate scoresheets
      if (decision === 'approved') {
        toast({
            title: 'Generate Score Sheets?',
            description: 'Pattern approved. You can now generate linked score sheets.',
            action: <Button onClick={() => toast({title: 'Coming soon!'})}>Generate</Button>
        })
      }
      fetchApprovals(); // Refresh the list
    }
  };

  return (
    <>
      <Helmet>
        <title>Approvals Dashboard - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-extrabold tracking-tight">Approvals Dashboard</h1>
            <p className="text-lg text-muted-foreground">Review and process items awaiting your approval.</p>
          </motion.div>

          <Card>
            <CardHeader>
              <CardTitle>Pending Items</CardTitle>
              <CardDescription>These items require your attention.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : approvals.length > 0 ? (
                <div className="space-y-4">
                  {approvals.map(approval => (
                    <ApprovalItem key={approval.id} approval={approval} onProcess={handleProcessApproval} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                  <h3 className="mt-2 text-lg font-medium">All caught up!</h3>
                  <p className="mt-1 text-sm text-muted-foreground">You have no pending approval requests.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
};

export default ApprovalsDashboardPage;