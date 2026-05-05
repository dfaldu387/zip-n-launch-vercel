import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Send, Paperclip, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const approvalSubject = (setName) =>
  `Your Pattern Set "${setName}" Has Been Approved`;

const approvalBody = (setName, userName, patternNames) =>
  `Hello ${userName || 'Contributor'},

We are pleased to let you know that your pattern set "${setName}" has been reviewed and approved.

Approved patterns:
${patternNames.map(n => `  - ${n}`).join('\n')}

Your patterns are now live and available for the community to use. Thank you for your contribution!

Best regards,
The EquiPatterns Team`;

const rejectionSubject = (setName) =>
  `Your Pattern Set "${setName}" Requires Changes`;

const rejectionBody = (setName, userName, patternNames, reason) =>
  `Hello ${userName || 'Contributor'},

Thank you for submitting the pattern set "${setName}". After reviewing your submission, we are unable to approve it in its current form.

Patterns reviewed:
${patternNames.map(n => `  - ${n}`).join('\n')}

Please review the notes below and resubmit with the necessary corrections.

Admin Notes:
${reason || '[Please add specific feedback here — what needs to be fixed or changed]'}

If you have any questions, please reply to this email or contact us through the platform.

Best regards,
The EquiPatterns Team`;

export const ReviewEmailModal = ({ isOpen, onClose, patternSet, reviewType, onConfirm }) => {
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSending, setIsSending] = useState(false);

  const isApproval = reviewType === 'approved';

  useEffect(() => {
    if (patternSet && isOpen) {
      const patternNames = patternSet.patterns.map(p => p.name);
      const userName = patternSet.user?.full_name || patternSet.user?.email || 'Contributor';

      setTo(patternSet.user?.email || '');
      setRejectionReason('');
      if (isApproval) {
        setSubject(approvalSubject(patternSet.setName));
        setBody(approvalBody(patternSet.setName, userName, patternNames));
      } else {
        setSubject(rejectionSubject(patternSet.setName));
        setBody(rejectionBody(patternSet.setName, userName, patternNames, ''));
      }
    }
  }, [patternSet, isOpen, isApproval]);

  // Auto-update email body when rejection reason changes
  useEffect(() => {
    if (!isApproval && patternSet && isOpen) {
      const patternNames = patternSet.patterns.map(p => p.name);
      const userName = patternSet.user?.full_name || patternSet.user?.email || 'Contributor';
      setBody(rejectionBody(patternSet.setName, userName, patternNames, rejectionReason));
    }
  }, [rejectionReason]);

  const handleSendAndConfirm = async () => {
    if (!isApproval && !rejectionReason.trim()) {
      toast({ title: 'Rejection reason required', description: 'Please provide a reason so the contributor knows what to fix.', variant: 'destructive' });
      return;
    }
    setIsSending(true);

    // Send the email if recipient is provided
    if (to && to.trim()) {
      const recipients = to.split(',').map(email => email.trim()).filter(email => email);

      if (recipients.length > 0) {
        try {
          const { data, error } = await supabase.functions.invoke('send-email-with-attachments', {
            body: {
              to: recipients,
              subject,
              body,
              patternIds: patternSet.patterns.map(p => p.id),
            },
          });

          if (error) throw new Error(`Function invocation failed: ${error.message}`);

          if (data.error) {
            toast({ title: 'Failed to Send Email', description: `The server responded with: ${data.error}`, variant: 'destructive' });
            setIsSending(false);
            return;
          }

          toast({ title: 'Email Sent!', description: `Notification sent to ${recipients.join(', ')}.` });
        } catch (error) {
          toast({ title: 'Error Sending Email', description: error.message, variant: 'destructive' });
          setIsSending(false);
          return;
        }
      }
    }

    // Proceed with the approve/reject action, passing rejection reason if rejecting
    if (onConfirm) {
      await onConfirm(!isApproval ? rejectionReason : null);
    }

    setIsSending(false);
    onClose();
  };

  const handleSkipEmail = async () => {
    if (!isApproval && !rejectionReason.trim()) {
      toast({ title: 'Rejection reason required', description: 'Please provide a reason so the contributor knows what to fix.', variant: 'destructive' });
      return;
    }
    setIsSending(true);
    if (onConfirm) {
      await onConfirm(!isApproval ? rejectionReason : null);
    }
    setIsSending(false);
    onClose();
  };

  if (!patternSet) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {isApproval ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            {isApproval ? 'Approve' : 'Reject'} Pattern Set & Notify
          </DialogTitle>
          <DialogDescription>
            {isApproval
              ? `Approve "${patternSet.setName}" and send a notification to the contributor.`
              : `Reject "${patternSet.setName}" and let the contributor know what needs to be fixed.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 flex-1 overflow-y-auto">
          {/* Status banner */}
          <div className={`rounded-md p-3 ${isApproval ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2">
              <Badge variant={isApproval ? 'default' : 'destructive'} className={isApproval ? 'bg-green-600' : ''}>
                {isApproval ? 'APPROVING' : 'REJECTING'}
              </Badge>
              <span className="font-medium text-sm">{patternSet.setName}</span>
              <span className="text-xs text-muted-foreground">({patternSet.patterns.length} pattern{patternSet.patterns.length !== 1 ? 's' : ''})</span>
            </div>
          </div>

          {!isApproval && (
            <div className="space-y-1.5">
              <Label htmlFor="rejection-reason" className="text-red-700 font-semibold">Rejection Reason (visible to contributor) *</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this pattern set is being rejected and what the contributor should fix..."
                rows={3}
                className="border-red-300 focus:border-red-500"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="review-to">To</Label>
            <Input
              id="review-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="contributor@example.com"
            />
            {!to && <p className="text-xs text-amber-600">No email on file. Enter an address or skip email to proceed.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-subject">Subject</Label>
            <Input id="review-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-body">Message</Label>
            <Textarea
              id="review-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="resize-none font-mono text-sm"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-1.5">
            <Label>Attachments (auto-included)</Label>
            <div className="p-2.5 border rounded-md bg-secondary/50 space-y-1.5">
              {patternSet.patterns.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{p.name}.pdf</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={handleSkipEmail} disabled={isSending}>
            {isApproval ? 'Approve' : 'Reject'} Without Email
          </Button>
          <Button
            onClick={handleSendAndConfirm}
            disabled={isSending}
            className={isApproval ? 'bg-green-600 hover:bg-green-700' : ''}
            variant={isApproval ? 'default' : 'destructive'}
          >
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isApproval ? 'Approve & Send' : 'Reject & Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
