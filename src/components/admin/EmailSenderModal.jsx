import React, { useState, useEffect } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/supabaseClient';
    import { Loader2, Send, Paperclip } from 'lucide-react';

    const defaultSubject = (setName) => `Regarding Your Pattern Set: ${setName}`;
    const defaultBody = (setName, userName) => `Hello ${userName || 'Contributor'},

Thank you for your submission of the pattern set "${setName}".

The patterns you submitted are attached to this email for your reference.

[Add your message here]

Best regards,
The EquiPatterns Team`;

    export const EmailSenderModal = ({ isOpen, onClose, patternSet }) => {
        const { toast } = useToast();
        const [to, setTo] = useState('');
        const [subject, setSubject] = useState('');
        const [body, setBody] = useState('');
        const [isSending, setIsSending] = useState(false);

        useEffect(() => {
            if (patternSet) {
                setTo(patternSet.user?.email || '');
                setSubject(defaultSubject(patternSet.setName));
                setBody(defaultBody(patternSet.setName, patternSet.user?.full_name));
            }
        }, [patternSet]);

        const handleSendEmail = async () => {
            if (!to) {
                toast({ title: 'Error', description: 'Recipient email address cannot be empty.', variant: 'destructive' });
                return;
            }

            setIsSending(true);
            const recipients = to.split(',').map(email => email.trim()).filter(email => email);

            if (recipients.length === 0) {
                toast({ title: 'Error', description: 'Please provide at least one valid email address.', variant: 'destructive' });
                setIsSending(false);
                return;
            }

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
                } else {
                    toast({ title: 'Email Sent!', description: `An email has been sent to ${recipients.join(', ')}.` });
                    onClose();
                }

            } catch (error) {
                toast({ title: 'Error Sending Email', description: error.message, variant: 'destructive' });
            } finally {
                setIsSending(false);
            }
        };

        if (!patternSet) return null;

        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>Send Email to Contributor(s)</DialogTitle>
                        <DialogDescription>
                            Compose and send an email regarding the pattern set: "{patternSet.setName}".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2 flex-1 overflow-y-auto">
                        <div className="space-y-1.5">
                            <Label htmlFor="to">To</Label>
                            <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="contributor@example.com, another@example.com" />
                            <p className="text-xs text-muted-foreground">Separate multiple email addresses with a comma.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="body">Body</Label>
                            <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="resize-none" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Attachments</Label>
                            <div className="p-2.5 border rounded-md bg-secondary/50 space-y-1.5">
                                {patternSet.patterns.map(p => (
                                    <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            <span className="font-medium truncate">{p.name}.pdf</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground flex-shrink-0">(Auto-attached)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
                        <Button variant="outline" onClick={onClose} disabled={isSending}>Cancel</Button>
                        <Button onClick={handleSendEmail} disabled={isSending}>
                            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Send Email
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };