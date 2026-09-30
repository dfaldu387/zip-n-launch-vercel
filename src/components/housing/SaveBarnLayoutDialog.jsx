import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { extractBarnLayout, saveBarnLayout, countLayoutStalls } from '@/lib/savedBarnLayouts';

// Save this barn's shape to the shared catalog under Facility + Barn (+ an optional
// third label such as the show name). Only the layout is saved — never bookings,
// prices or dates.
export const SaveBarnLayoutDialog = ({ open, onOpenChange, barn, defaultFacility = '', defaultLabel = '' }) => {
    const { toast } = useToast();
    const { user, profile } = useAuth();
    const [facility, setFacility] = useState('');
    const [barnName, setBarnName] = useState('');
    const [showLabel, setShowLabel] = useState('');
    const [saving, setSaving] = useState(false);

    // Start from what we already know each time the dialog opens.
    useEffect(() => {
        if (!open) return;
        setFacility(defaultFacility || '');
        setBarnName(barn?.name || '');
        setShowLabel(defaultLabel || '');
    }, [open, barn?.name, defaultFacility, defaultLabel]);

    const layout = extractBarnLayout(barn);
    const canSave = facility.trim() && barnName.trim() && !saving;

    const handleSave = async () => {
        setSaving(true);
        try {
            const { updated } = await saveBarnLayout({
                facility, barnName, showLabel, layout,
                userId: user?.id,
                userName: profile?.full_name || user?.user_metadata?.full_name || null,
            });
            toast({
                title: updated ? 'Layout updated' : 'Layout saved',
                description: `${facility.trim()} · ${barnName.trim()}${showLabel.trim() ? ` · ${showLabel.trim()}` : ''}`,
            });
            onOpenChange(false);
        } catch (error) {
            toast({ title: 'Could not save layout', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Save barn layout</DialogTitle>
                    <DialogDescription>
                        Save this barn's shape so you and other show managers can reuse it. Bookings, prices and dates are not saved.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="sbl-facility" className="text-xs">Facility name</Label>
                        <Input id="sbl-facility" value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="E.g., Larimer County Fairgrounds" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sbl-barn" className="text-xs">Barn name</Label>
                        <Input id="sbl-barn" value={barnName} onChange={(e) => setBarnName(e.target.value)} placeholder="E.g., West Barn" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sbl-label" className="text-xs">Show name <span className="text-muted-foreground">(optional)</span></Label>
                        <Input id="sbl-label" value={showLabel} onChange={(e) => setShowLabel(e.target.value)} placeholder="E.g., Quarter Horse Show, or County Fair" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {layout.layoutRows} × {layout.layoutCols} boxes · {countLayoutStalls(layout)} stalls · {layout.numberingMode} numbering.
                        Saving the same facility, barn and show name again replaces your earlier copy.
                    </p>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                    <Button type="button" onClick={handleSave} disabled={!canSave}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save layout
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SaveBarnLayoutDialog;
