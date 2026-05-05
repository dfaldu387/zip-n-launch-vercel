import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Send } from 'lucide-react';
import { generatePatternBookPdf } from '@/lib/bookGenerator';

export const SendPatternEmailDialog = ({ open, onOpenChange, projectData, patternName }) => {
    const { toast } = useToast();
    const [recipientEmail, setRecipientEmail] = useState('');
    const [senderName, setSenderName] = useState('');
    const [personalMessage, setPersonalMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!recipientEmail.trim()) {
            toast({ title: 'Email required', description: 'Please enter a recipient email address.', variant: 'destructive' });
            return;
        }

        // Basic email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
            toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
            return;
        }

        setIsSending(true);
        try {
            toast({ title: 'Generating pattern...', description: 'Preparing your pattern for email.' });

            const pdfDataUri = await generatePatternBookPdf(projectData, { skipCoverAndToc: true });
            const bookName = patternName || projectData?.showName || 'My Pattern';

            const { data, error } = await supabase.functions.invoke('send-pattern-book', {
                body: JSON.stringify({
                    email: recipientEmail.trim(),
                    pdfDataUri,
                    bookName,
                    senderName: senderName.trim() || undefined,
                    personalMessage: personalMessage.trim() || undefined,
                }),
            });

            if (error || data?.error) {
                throw new Error(error?.message || data?.error);
            }

            toast({ title: 'Email sent!', description: `Pattern sent to ${recipientEmail.trim()}.` });
            setRecipientEmail('');
            setSenderName('');
            setPersonalMessage('');
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to send pattern email:', error);
            toast({
                variant: 'destructive',
                title: 'Failed to send',
                description: error.message || 'There was a problem sending your pattern. Please try again.',
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Send Pattern via Email</DialogTitle>
                    <DialogDescription>
                        Send <strong>{patternName || 'your pattern'}</strong> as a PDF attachment.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="recipient-email">Recipient Email *</Label>
                        <Input
                            id="recipient-email"
                            type="email"
                            placeholder="judge@example.com"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            disabled={isSending}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="sender-name">Your Name (optional)</Label>
                        <Input
                            id="sender-name"
                            type="text"
                            placeholder="John Doe"
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                            disabled={isSending}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="personal-message">Personal Message (optional)</Label>
                        <Textarea
                            id="personal-message"
                            placeholder="Here's the pattern for the upcoming show..."
                            value={personalMessage}
                            onChange={(e) => setPersonalMessage(e.target.value)}
                            disabled={isSending}
                            rows={3}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
                        Cancel
                    </Button>
                    <Button onClick={handleSend} disabled={isSending} className="gap-2">
                        {isSending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                Send Email
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
