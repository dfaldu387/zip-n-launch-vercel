import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabaseClient';
import { notifyShowOwner } from '@/lib/notifications';
import { Calendar, MapPin, Briefcase, FileText, ExternalLink, Upload, Loader2, CheckCircle, Trash2, Plane } from 'lucide-react';
import StaffTravelDialog from '@/components/StaffTravelDialog';
import { format } from 'date-fns';

// Private bucket + table: see supabase/migrations/20261028120000_staff_contract_documents.sql
const BUCKET = 'contract-documents';
const MAX_MB = 10;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const DOCS = [
    { id: 'signed_contract', label: 'Signed contract' },
    { id: 'w9_form', label: 'W-9 form' },
];

const STATUS_STYLES = {
    sent: { label: 'Sent', className: 'bg-blue-500/10 text-blue-600 border-blue-600/30' },
    viewed: { label: 'Sent', className: 'bg-blue-500/10 text-blue-600 border-blue-600/30' },
    signed: { label: 'Signed', className: 'bg-amber-500/10 text-amber-600 border-amber-600/30' },
    approved: { label: 'Approved', className: 'bg-green-500/10 text-green-600 border-green-600/30' },
    declined: { label: 'Declined', className: 'bg-red-500/10 text-red-600 border-red-600/30' },
};

const formatDay =(value) => {
    if (!value) return null;
    const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(d.getTime()) ? null : format(d, 'MMM d, yyyy');
};

/**
 * What a contracted staff member sees for a show: only their own role,
 * the contract state, their document uploads, and a link to the public event
 * page. It never links to the manager's editor (staff have no access to it).
 */
export const StaffShowDialog = ({ open, onClose, project, userEmail }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const inputRef = useRef(null);
    const pendingDoc = useRef(null);
    const [uploads, setUploads] = useState([]);
    const [busyDoc, setBusyDoc] = useState(null);
    const [travelOpen, setTravelOpen] = useState(false);
    const [status, setStatus] = useState('sent');

    const showId = project?.id;
    const email = (userEmail || '').toLowerCase();

    const loadUploads = useCallback(async () => {
        if (!showId || !email) return;
        const { data, error } = await supabase
            .from('staff_contract_documents')
            .select('id, doc_id, file_name, file_size, storage_path, created_at')
            .eq('show_id', showId)
            .eq('member_email', email)
            .order('created_at', { ascending: false });
        if (error) {
            console.warn('staff documents load failed:', error.message);
            setUploads([]);
            return;
        }
        setUploads(data || []);
    }, [showId, email]);

    // The manager's page keeps this copy up to date; before it exists the contract is simply "Sent".
    const loadStatus = useCallback(async () => {
        if (!showId || !email) return;
        const { data } = await supabase
            .from('staff_contract_status')
            .select('status')
            .eq('show_id', showId)
            .eq('member_email', email)
            .maybeSingle();
        setStatus(data?.status || 'sent');
    }, [showId, email]);

    useEffect(() => {
        if (open) {
            loadUploads();
            loadStatus();
        }
    }, [open, loadUploads, loadStatus]);

    if (!project) return null;

    const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.sent;
    const data = project.project_data || {};
    const me = (data.officials || []).find(o => o.email?.toLowerCase() === email);
    const role = me?.role || me?.position || me?.roleName || null;

    const start = formatDay(data.startDate);
    const end = formatDay(data.endDate);
    const dates = start && end && start !== end ? `${start} – ${end}` : start || end;
    const venue = data.venueName || data.venueAddress || null;

    const rows = [
        { icon: Briefcase, label: 'Your role', value: role },
        { icon: Calendar, label: 'Dates', value: dates },
        { icon: MapPin, label: 'Venue', value: venue },
    ].filter(r => r.value);

    const latestFor = (docId) => uploads.find(u => u.doc_id === docId);

    const pickFile = (docId) => {
        pendingDoc.current = docId;
        inputRef.current?.click();
    };

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        const docId = pendingDoc.current;
        if (inputRef.current) inputRef.current.value = '';
        if (!file || !docId || !user) return;
        if (!ALLOWED.includes(file.type)) {
            toast({ title: 'Wrong file type', description: 'Please use a PDF, JPG, PNG or WEBP file.', variant: 'destructive' });
            return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            toast({ title: 'File too large', description: `Please use a file under ${MAX_MB} MB.`, variant: 'destructive' });
            return;
        }
        setBusyDoc(docId);
        const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
        const path = `${user.id}/${showId}/${docId}/${uuidv4()}.${ext}`;
        const { error: upError } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
        if (upError) {
            setBusyDoc(null);
            toast({ title: 'Upload failed', description: upError.message, variant: 'destructive' });
            return;
        }
        const { error: rowError } = await supabase.from('staff_contract_documents').insert({
            show_id: showId,
            member_email: email,
            doc_id: docId,
            file_name: file.name,
            file_size: file.size,
            storage_path: path,
        });
        setBusyDoc(null);
        if (rowError) {
            await supabase.storage.from(BUCKET).remove([path]);
            toast({ title: 'Upload failed', description: rowError.message, variant: 'destructive' });
            return;
        }
        toast({ title: 'Uploaded', description: `${file.name} was sent to the show manager.` });
        const docLabel = DOCS.find(d => d.id === docId)?.label || 'a document';
        notifyShowOwner({
            showId,
            message: `${me?.name || email} uploaded ${docLabel} for "${project.project_name || 'your show'}".`,
        });
        loadUploads();
    };

    const openFile = async (upload) => {
        const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(upload.storage_path, 3600);
        if (error || !signed?.signedUrl) {
            toast({ title: 'Could not open file', description: error?.message || 'Try again.', variant: 'destructive' });
            return;
        }
        window.open(signed.signedUrl, '_blank', 'noopener');
    };

    const removeFile = async (upload) => {
        const { error } = await supabase.from('staff_contract_documents').delete().eq('id', upload.id);
        if (error) {
            toast({ title: 'Could not remove file', description: error.message, variant: 'destructive' });
            return;
        }
        await supabase.storage.from(BUCKET).remove([upload.storage_path]);
        loadUploads();
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl">{project.project_name || 'Horse Show'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Your contract:</span>
                        <Badge className={`border ${statusStyle.className}`}>{statusStyle.label}</Badge>
                    </div>

                    {rows.length > 0 && (
                        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                            {rows.map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex items-center gap-2 text-sm">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">{label}:</span>
                                    <span className="font-medium">{value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Your documents</p>
                        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={handleFile} />
                        {DOCS.map(({ id, label }) => {
                            const upload = latestFor(id);
                            const busy = busyDoc === id;
                            return (
                                <div key={id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            {upload
                                                ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                                                : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                                            {label}
                                        </div>
                                        {upload ? (
                                            <button
                                                type="button"
                                                onClick={() => openFile(upload)}
                                                className="mt-0.5 block max-w-[220px] truncate text-xs text-primary hover:underline"
                                            >
                                                {upload.file_name}
                                            </button>
                                        ) : (
                                            <p className="mt-0.5 text-xs text-muted-foreground">Not uploaded yet</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {upload && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFile(upload)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" disabled={busy} onClick={() => pickFile(id)}>
                                            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                                            {upload ? 'Replace' : 'Upload'}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <Button variant="outline" className="w-full" onClick={() => setTravelOpen(true)}>
                        <Plane className="mr-2 h-4 w-4" />
                        Travel details &amp; receipts
                    </Button>

                    <StaffTravelDialog open={travelOpen} onClose={() => setTravelOpen(false)} project={project} />

                    <Button
                        className="w-full"
                        onClick={() => { onClose(); navigate(`/event-detail/${project.id}`); }}
                    >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open event page
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default StaffShowDialog;
