import { useEffect, useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { invokeAsUser } from '@/lib/edgeFunctions';

/**
 * Emails staff a no-login link asking for their travel details.
 * rows: [{ member, options: [{ type, label, checked }] }]. One row = "Request info" for a person;
 * several rows = "Request all". onSent(memberId, sentAt) is called for each email that went out.
 */
const RequestInfoDialog = ({ open, onOpenChange, rows, showId, onSent }) => {
  const { toast } = useToast();
  const [picked, setPicked] = useState({}); // `${memberId}:${type}` -> boolean
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = {};
    rows.forEach(({ member, options }) => options.forEach((o) => { start[`${member.id}:${o.type}`] = o.checked; }));
    setPicked(start);
  }, [open, rows]);

  const chosen = (member, options) => options.filter((o) => picked[`${member.id}:${o.type}`]).map((o) => o.type);
  const sendable = rows.filter(({ member, options }) => member.email && chosen(member, options).length > 0);

  const handleSend = async () => {
    setSending(true);
    let sent = 0;
    const failures = [];
    for (const { member, options } of sendable) {
      const { data, error } = await invokeAsUser('travel-info-request', {
        action: 'send',
        projectId: showId,
        memberId: member.id,
        items: chosen(member, options),
        origin: window.location.origin,
      });
      if (error || data?.error) {
        failures.push(`${member.name || 'Unnamed'}: ${data?.error || error?.message || 'failed'}`);
      } else {
        sent += 1;
        onSent?.(member.id, data.sentAt);
      }
    }
    setSending(false);
    if (sent > 0) toast({ title: `Request sent to ${sent} ${sent === 1 ? 'person' : 'people'}`, description: 'They get a link to enter their details. Answers appear here when you reopen this page.' });
    if (failures.length > 0) toast({ title: 'Some requests failed', description: failures.join(' • '), variant: 'destructive' });
    if (failures.length === 0) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request travel details</DialogTitle>
          <DialogDescription>
            Each person gets an email with a link (no login) to enter these items and upload receipts. Untick anything you do not need.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {rows.map(({ member, options }) => (
            <div key={member.id} className="rounded-md border px-3 py-2">
              <p className="text-sm font-medium">{member.name || 'Unnamed'} <span className="text-xs font-normal text-muted-foreground">{member.roleName}</span></p>
              {!member.email ? (
                <p className="text-xs text-amber-600">No email address. Add one on the Officials &amp; Staff page.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-1">{member.email}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {options.map((o) => (
                      <label key={o.type} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={!!picked[`${member.id}:${o.type}`]}
                          onChange={(e) => setPicked((p) => ({ ...p, [`${member.id}:${o.type}`]: e.target.checked }))}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || sendable.length === 0}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Send {sendable.length > 1 ? `to ${sendable.length} people` : 'email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestInfoDialog;
