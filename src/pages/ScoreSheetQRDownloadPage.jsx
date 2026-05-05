import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, Download, AlertTriangle, FileText, Trophy, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { generateScoreSheetPdf } from '@/lib/pdfUtils';
import { applyTextOverlay } from '@/lib/scoresheetTextOverlay';

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

const ScoreSheetQRDownloadPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState(null);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('loading');
    const [isPrinting, setIsPrinting] = useState(false);

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
        };
        fetchRecord();
        return () => { cancelled = true; };
    }, [id]);

    const handlePrint = async () => {
        if (!record) return;
        setIsPrinting(true);
        try {
            const qrUrl = `${window.location.origin}/s/${record.id}`;
            if (record.image_url) {
                const blob = await applyTextOverlay(
                    record.image_url,
                    {
                        showName: record.show_name || '',
                        className: record.pattern_name || record.class_name || '',
                        date: record.show_date || '',
                        judgeName: record.judge_name || '',
                    },
                    qrUrl,
                );
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

                                <Button
                                    variant="outline"
                                    className="w-full justify-start h-14"
                                    disabled
                                >
                                    <Upload className="mr-3 h-5 w-5" />
                                    <div className="text-left">
                                        <div className="font-medium">Post Results</div>
                                        <div className="text-xs text-muted-foreground">Coming soon</div>
                                    </div>
                                </Button>

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
