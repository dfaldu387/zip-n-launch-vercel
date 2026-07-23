import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, Download, AlertTriangle, FileText, Trophy, Upload, Eye, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { generateScoreSheetPdf } from '@/lib/pdfUtils';
import { applyTextOverlay } from '@/lib/scoresheetTextOverlay';
import { stampPdfWithTag } from '@/lib/scoresheetPdfStamp';
import { isPdfSource, findAccessoryDocUrl, mergePdfBlobs } from '@/lib/scoresheetLookup';
import { postScoredSheet, resolvePosterIdentity } from '@/lib/postedScoreSheets';
import { isShowPublished } from '@/lib/showPublishing';

const sanitizeFilenameSegment = (s) =>
    String(s || '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');

const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const buildFilename = (r, ext) => {
    const parts = [r.association, r.class_name, r.division, r.judge_name].filter(Boolean);
    const base = parts.length ? parts.map(sanitizeFilenameSegment).join('_') : 'Scoresheet';
    return `${base}.${ext}`;
};

// The tag printed from a QR must match the one the customer portal prints:
// discipline and division on their own lines, date and judge together.
const buildTagData = (r) => ({
    showName: r.show_name || '',
    disciplineName: r.class_name || '',
    className: r.division || r.pattern_name || '',
    date: r.show_date || '',
    judgeName: r.judge_name || '',
});

const ScoreSheetQRDownloadPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState(null);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('loading');
    const [isPrinting, setIsPrinting] = useState(false);
    const [user, setUser] = useState(null);
    const [published, setPublished] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [postNotice, setPostNotice] = useState(null);
    const fileInputRef = useRef(null);

    // Posting is staff-only, so we need to know whether anyone is signed in.
    useEffect(() => {
        let cancelled = false;
        supabase.auth.getSession().then(({ data }) => {
            if (!cancelled) setUser(data?.session?.user || null);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null);
        });
        return () => { cancelled = true; sub?.subscription?.unsubscribe(); };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const fetchRecord = async () => {
            const { data, error: fetchError } = await supabase
                .from('score_sheet_qr_codes')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            if (cancelled) return;
            if (fetchError) {
                setError(fetchError.message);
                setStatus('error');
                return;
            }
            if (!data) {
                setError('Score sheet not found. The QR code may be invalid or the record was removed.');
                setStatus('error');
                return;
            }
            setRecord(data);
            setStatus('ready');

            // Exhibitors only see a posted sheet once the show is published.
            if (data.project_id) {
                const { data: proj } = await supabase
                    .from('projects')
                    .select('status, project_data')
                    .eq('id', data.project_id)
                    .maybeSingle();
                if (!cancelled) setPublished(isShowPublished(proj));
            }
        };
        fetchRecord();
        return () => { cancelled = true; };
    }, [id]);

    const handlePostResults = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !record) return;

        setIsPosting(true);
        setError(null);
        setPostNotice(null);
        try {
            const poster = await resolvePosterIdentity(user);
            const posted = await postScoredSheet(file, record, user.id, Date.now(), poster);
            setRecord(prev => ({
                ...prev,
                posted_sheet_url: posted.url,
                posted_sheet_path: posted.path,
                posted_at: posted.postedAt,
                posted_by: user.id,
                posted_by_name: posted.name,
            }));
            setPostNotice(published
                ? 'Posted. Exhibitors scanning this sheet can see it now.'
                : 'Posted. Exhibitors will see it once the show is published.');
        } catch (e) {
            console.error('Posting the scored sheet failed:', e);
            setError(e.message || 'Could not post the completed score sheet.');
        } finally {
            setIsPosting(false);
        }
    };

    const handlePrint = async () => {
        if (!record) return;
        setIsPrinting(true);
        try {
            const qrUrl = `${window.location.origin}/s/${record.id}`;
            if (record.image_url && isPdfSource(record.image_url)) {
                // PDF sheets can't be drawn on a canvas. Rebuild the same packet the
                // customer portal produces: cheat sheet page first, then the tag on
                // every page. Saving a PDF under a .png name is what broke this before.
                const sheetBlob = await (await fetch(record.image_url)).blob();
                let packet = sheetBlob;
                try {
                    const cheatSheetUrl = await findAccessoryDocUrl(supabase, {
                        associationAbbrev: record.association,
                        discipline: record.class_name,
                    });
                    if (cheatSheetUrl && cheatSheetUrl !== record.image_url) {
                        const cheatBlob = await (await fetch(cheatSheetUrl)).blob();
                        packet = await mergePdfBlobs([cheatBlob, sheetBlob]);
                    }
                } catch (mergeError) {
                    console.warn('Could not attach the cheat sheet page:', mergeError);
                }
                const stamped = await stampPdfWithTag(packet, buildTagData(record), qrUrl);
                triggerDownload(stamped, buildFilename(record, 'pdf'));
            } else if (record.image_url) {
                const blob = await applyTextOverlay(record.image_url, buildTagData(record), qrUrl);
                triggerDownload(blob, buildFilename(record, 'png'));
            } else if (record.template_path) {
                const bytes = await generateScoreSheetPdf(
                    record.template_path,
                    record.extracted_steps || {},
                    {
                        association: record.association,
                        className: record.class_name,
                        patternName: record.pattern_name || '',
                        year: record.year || '',
                    },
                    qrUrl,
                );
                triggerDownload(new Blob([bytes], { type: 'application/pdf' }), buildFilename(record, 'pdf'));
            } else {
                throw new Error('Score sheet record is missing render data.');
            }
        } catch (e) {
            console.error('Score sheet rebuild failed:', e);
            setError(e.message || 'Failed to rebuild score sheet.');
        } finally {
            setIsPrinting(false);
        }
    };

    const headerSubtitle = record
        ? [record.show_name, record.class_name, record.division, record.judge_name && `Judge ${record.judge_name}`]
            .filter(Boolean)
            .join(' • ')
        : 'Loading score sheet…';

    return (
        <>
            <Helmet>
                <title>Score Sheet — EquiPatterns</title>
            </Helmet>
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle>Score Sheet</CardTitle>
                        <CardDescription>{headerSubtitle}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {status === 'loading' && (
                            <div className="flex items-center justify-center py-6 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Looking up score sheet…
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="text-center space-y-3 py-4">
                                <div className="mx-auto h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                </div>
                                <p className="text-sm text-destructive">{error}</p>
                            </div>
                        )}

                        {status === 'ready' && record && (
                            <>
                                <Button
                                    onClick={handlePrint}
                                    className="w-full justify-start h-14"
                                    disabled={isPrinting}
                                >
                                    {isPrinting ? (
                                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                    ) : (
                                        <Download className="mr-3 h-5 w-5" />
                                    )}
                                    <div className="text-left">
                                        <div className="font-medium">Print Score Sheet</div>
                                        <div className="text-xs opacity-80">Download a fresh copy of this sheet</div>
                                    </div>
                                </Button>

                                <Button
                                    onClick={() => navigate(`/s/${record.id}/results`)}
                                    variant="outline"
                                    className="w-full justify-start h-14"
                                >
                                    <Trophy className="mr-3 h-5 w-5" />
                                    <div className="text-left">
                                        <div className="font-medium">View Results</div>
                                        <div className="text-xs text-muted-foreground">See placings for this class</div>
                                    </div>
                                </Button>

                                {/* Exhibitors see the completed sheet once the show is published.
                                    Staff always see it, so they can check their own upload. */}
                                {record.posted_sheet_url && (published || user) && (
                                    <Button
                                        onClick={() => window.open(record.posted_sheet_url, '_blank', 'noopener')}
                                        className="w-full justify-start h-14"
                                    >
                                        <Eye className="mr-3 h-5 w-5" />
                                        <div className="text-left">
                                            <div className="font-medium">View Completed Score Sheet</div>
                                            <div className="text-xs opacity-80">
                                                {published ? 'Posted by the show office' : 'Not visible to exhibitors yet'}
                                            </div>
                                        </div>
                                    </Button>
                                )}

                                {/* Audit trail — Robert has to be able to see who posted a sheet. */}
                                {record.posted_at && (
                                    <p className="text-xs text-muted-foreground text-center">
                                        Posted by {record.posted_by_name || 'show staff'} on{' '}
                                        {new Date(record.posted_at).toLocaleString()}
                                    </p>
                                )}

                                {user ? (
                                    <>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*,application/pdf"
                                            capture="environment"
                                            className="hidden"
                                            onChange={handlePostResults}
                                        />
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start h-14"
                                            disabled={isPosting}
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            {isPosting ? (
                                                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                            ) : (
                                                <Upload className="mr-3 h-5 w-5" />
                                            )}
                                            <div className="text-left">
                                                <div className="font-medium">
                                                    {record.posted_sheet_url ? 'Replace Posted Sheet' : 'Post Results'}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {isPosting ? 'Uploading…' : 'Photograph or upload the completed sheet'}
                                                </div>
                                            </div>
                                        </Button>
                                    </>
                                ) : (
                                    <p className="text-xs text-muted-foreground text-center pt-1">
                                        Show staff: sign in to post the completed score sheet.
                                    </p>
                                )}

                                {postNotice && (
                                    <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5 pt-1">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                        {postNotice}
                                    </p>
                                )}

                                {error && (
                                    <p className="text-xs text-destructive text-center pt-2">{error}</p>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default ScoreSheetQRDownloadPage;
