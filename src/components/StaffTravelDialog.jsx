import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertCircle } from 'lucide-react';
import { invokeAsUser } from '@/lib/edgeFunctions';
import { notifyShowOwner } from '@/lib/notifications';
import { ItemForm, FIELDS, ICONS } from '@/pages/TravelInfoRequestPage';

const MODE_TAGS = {
    reimbursement: { text: 'Reimbursable — you pay, then enter the details and add your receipt.', className: 'bg-amber-500/10 text-amber-700 border-amber-600/30' },
    direct: { text: 'Direct show expense — the show books this for you. You do not need to enter anything.', className: 'bg-blue-500/10 text-blue-700 border-blue-600/30' },
    profile: { text: 'Direct show expense — please send your official information so the show can book your travel.', className: 'bg-blue-500/10 text-blue-700 border-blue-600/30' },
};

const ModeTag = ({ mode }) => {
    const tag = MODE_TAGS[mode];
    return tag ? <p className={`rounded-md border px-3 py-2 text-xs font-medium ${tag.className}`}>{tag.text}</p> : null;
};

// Direct items are filled in by the show; the person only sees what was booked.
const BookedView = ({ item }) => {
    const Icon = ICONS[item.type];
    const rows = (FIELDS[item.type] || [])
        .map(([name, label]) => [label, item.values?.[name]])
        .filter(([, value]) => value);
    return (
        <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-base font-semibold">
                {Icon && <Icon className="h-4 w-4 text-blue-500" />}
                {item.label}
            </div>
            <ModeTag mode="direct" />
            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">The show has not entered this yet. It will appear here once it is booked.</p>
            ) : (
                <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                    {rows.map(([label, value]) => (
                        <div key={label}>
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="font-medium">{String(value).replace('T', ' ')}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
};

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
                            {info.memberName}{info.role ? ` (${info.role})` : ''}. Only the items in your contract are listed.
                            <strong> Reimbursable:</strong> you enter the details and add receipts.
                            <strong> Direct show expense:</strong> the show books it and you see it here.
                        </p>
                        {info.items.length === 0 && (
                            <p className="rounded-lg border p-4 text-sm">Your contract has no travel items, so there is nothing to send here.</p>
                        )}
                        {info.items.map((item) => (
                            item.mode === 'direct' ? (
                                <BookedView key={item.type} item={item} />
                            ) : (
                                <div key={item.type} className="space-y-2">
                                    <ModeTag mode={item.mode} />
                                    <ItemForm item={item} projectId={projectId} onSaved={onSaved} />
                                </div>
                            )
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default StaffTravelDialog;
