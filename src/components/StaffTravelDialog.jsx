import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertCircle } from 'lucide-react';
import { invokeAsUser } from '@/lib/edgeFunctions';
import { notifyShowOwner } from '@/lib/notifications';
import { ItemForm } from '@/pages/TravelInfoRequestPage';

/**
 * Travel details for a signed-in staff member, entered in the Staff Portal. It saves through the same
 * function and into the same place as the emailed link, so the show manager's Travel page needs no change.
 */
export const StaffTravelDialog = ({ open, onClose, project }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState(null);
    const projectId = project?.id;

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        setError('');
        try {
            const { data, error: fnError } = await invokeAsUser('travel-info-request', { action: 'portal_get', projectId });
            if (fnError || data?.error) {
                // A non-2xx answer carries the server's plain-language reason in the response body
                let reason = data?.error;
                if (!reason && fnError?.context?.json) {
                    reason = await fnError.context.json().then((b) => b?.error).catch(() => null);
                }
                setError(reason || 'Could not load your travel details. Please try again.');
            } else setInfo(data);
        } catch {
            setError('Could not load your travel details. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (open) load();
    }, [open, load]);

    const onSaved = (type, data) => {
        const label = info?.items?.find((i) => i.type === type)?.label || 'travel details';
        notifyShowOwner({
            showId: projectId,
            message: `${info?.memberName || 'A staff member'} sent ${label} for "${project?.project_name || 'your show'}".`,
        });
        setInfo((prev) => ({
            ...prev,
            items: prev.items.map((i) => (i.type === type ? { ...i, submittedAt: data.submittedAt, receipts: data.receipts } : i)),
        }));
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">Travel details{project?.project_name ? ` — ${project.project_name}` : ''}</DialogTitle>
                </DialogHeader>

                {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
                {!loading && error && (
                    <div className="flex items-start gap-3 rounded-lg border p-4 text-sm">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
                        <p>{error}</p>
                    </div>
                )}
                {!loading && info && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            {info.memberName}{info.role ? ` (${info.role})` : ''}. Fill in what applies to you and send each section. You can come back to change it.
                        </p>
                        {info.items.map((item) => (
                            <ItemForm key={item.type} item={item} projectId={projectId} onSaved={onSaved} />
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default StaffTravelDialog;
