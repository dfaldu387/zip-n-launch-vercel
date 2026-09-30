import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { HOUSING_TERMS_SECTIONS } from '@/lib/housingTerms';

// Must be approved before anything is built. Cannot be dismissed — the only
// ways out are Approve or Decline (which leaves the page).
export const HousingTermsDialog = ({ open, isSaving, onApprove, onDecline }) => {
    const [agreed, setAgreed] = useState(false);

    return (
        <Dialog open={open} onOpenChange={() => { /* not dismissable */ }}>
            <DialogContent
                className="max-w-2xl [&>button]:hidden"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>Housing & Grounds Terms and Conditions</DialogTitle>
                    <DialogDescription>Please read and approve before building your housing and grounds. You only need to do this once.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[50vh] overflow-y-auto space-y-4 rounded-md border p-4 text-sm">
                    {HOUSING_TERMS_SECTIONS.map(s => (
                        <div key={s.title}>
                            <p className="font-semibold">{s.title}</p>
                            <p className="text-muted-foreground">{s.body}</p>
                        </div>
                    ))}
                </div>
                <div className="flex items-start gap-2">
                    <Checkbox id="housing-terms-agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
                    <Label htmlFor="housing-terms-agree" className="text-sm leading-snug cursor-pointer">
                        I have read and agree to the Housing & Grounds Terms and Conditions.
                    </Label>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onDecline} disabled={isSaving}>Decline</Button>
                    <Button type="button" onClick={onApprove} disabled={!agreed || isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Approve & Continue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default HousingTermsDialog;
