import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, AlertTriangle, Trophy, ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { isShowPublished } from '@/lib/showPublishing';

const STATUS_BADGES = {
    pending: { label: 'Not yet started', variant: 'secondary' },
    'in-progress': { label: 'In progress', variant: 'default' },
    final: { label: 'Final', variant: 'default' },
};

const ScoreSheetResultsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState(null);
    const [classResult, setClassResult] = useState(null);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            // Through the RPC: reading the table directly let anyone list every
            // QR record for every show, not just the one they scanned.
            const { data: qr, error: qrError } = await supabase
                .rpc('get_score_sheet_qr', { p_id: id });
            if (cancelled) return;
            if (qrError) {
                setError(qrError.message);
                setStatus('error');
                return;
            }
            if (!qr) {
                setError('Score sheet not found.');
                setStatus('error');
                return;
            }
            setRecord(qr);

            if (!qr.project_id || !qr.class_item_id) {
                setStatus('not-linked');
                return;
            }

            // Via the RPC — the page reads one class out of project_data, but the
            // table read handed over the exhibitor bookings and staff list too.
            const { data: pub, error: projectError } = await supabase
                .rpc('get_public_project', { p_id: qr.project_id });
            const project = pub ? { project_data: pub.projectData || {} } : null;
            if (cancelled) return;
            if (projectError) {
                setError(projectError.message);
                setStatus('error');
                return;
            }
            if (!project) {
                setStatus('not-linked');
                return;
            }

            // Placings are only for the public once the office has published the
            // show. This page had no such check while the two other results
            // views did, so an exhibitor scanning the QR at the arena saw
            // placings before they were released — the one thing the publish
            // flag exists to prevent.
            //
            // Signed-in staff still see them, matching /s/:id, so the office can
            // check its own work before publishing.
            const { data: session } = await supabase.auth.getSession();
            const signedIn = !!session?.session?.user;
            if (!signedIn && !isShowPublished({ status: pub.status, project_data: pub.projectData })) {
                if (!cancelled) setStatus('unpublished');
                return;
            }

            const result = project.project_data?.results?.classResults?.[qr.class_item_id] || null;
            setClassResult(result);
            setStatus('ready');
        };
        load();
        return () => { cancelled = true; };
    }, [id]);

    const headerSubtitle = record
        ? [record.show_name, record.class_name, record.division, record.judge_name && `Judge ${record.judge_name}`]
            .filter(Boolean)
            .join(' • ')
        : '';

    const isFinal = classResult?.status === 'final';
    const visibleEntries = (classResult?.entries || [])
        .filter(e => e.riderName?.trim() || e.horseName?.trim())
        .sort((a, b) => (a.placing || 999) - (b.placing || 999));

    const renderBody = () => {
        if (status === 'loading') {
            return (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading results…
                </div>
            );
        }

        if (status === 'error') {
            return (
                <div className="text-center space-y-3 py-6">
                    <div className="mx-auto h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            );
        }

        if (status === 'unpublished') {
            return (
                <div className="text-center space-y-3 py-8">
                    <Lock className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
                    <div>
                        <p className="font-medium">Results are not published yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            The show office will release placings once the show is published.
                        </p>
                    </div>
                </div>
            );
        }

        if (status === 'not-linked') {
            return (
                <div className="text-center space-y-3 py-8">
                    <Trophy className="h-10 w-10 text-muted-foreground mx-auto" />
                    <div>
                        <p className="font-medium">Results not linked</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            This score sheet was generated before results tracking was enabled.
                        </p>
                    </div>
                </div>
            );
        }

        if (!classResult || visibleEntries.length === 0) {
            return (
                <div className="text-center space-y-3 py-8">
                    <Trophy className="h-10 w-10 text-muted-foreground mx-auto" />
                    <div>
                        <p className="font-medium">Results not posted yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Check back after the class is judged.
                        </p>
                    </div>
                </div>
            );
        }

        const statusBadge = STATUS_BADGES[classResult.status] || STATUS_BADGES.pending;
        const showsScore = classResult.scoringType === 'scored';
        const showsTime = classResult.scoringType === 'timed';

        return (
            <>
                <div className="flex items-center justify-between mb-4">
                    <Badge variant={statusBadge.variant} className="text-xs">
                        {isFinal && <Lock className="h-3 w-3 mr-1" />}
                        {statusBadge.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        {visibleEntries.length} {visibleEntries.length === 1 ? 'entry' : 'entries'}
                    </span>
                </div>

                <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium w-14">Place</th>
                                <th className="px-3 py-2 text-left text-xs font-medium">Rider</th>
                                <th className="px-3 py-2 text-left text-xs font-medium">Horse</th>
                                {showsScore && <th className="px-3 py-2 text-right text-xs font-medium w-20">Score</th>}
                                {showsTime && <th className="px-3 py-2 text-right text-xs font-medium w-24">Time</th>}
                                <th className="px-3 py-2 text-right text-xs font-medium w-16">Back #</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleEntries.map((entry, idx) => (
                                <tr key={entry.id || idx} className="border-t">
                                    <td className="px-3 py-2 font-mono font-bold">{entry.placing}</td>
                                    <td className="px-3 py-2">{entry.riderName || '—'}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{entry.horseName || '—'}</td>
                                    {showsScore && (
                                        <td className="px-3 py-2 text-right font-mono">{entry.score ?? '—'}</td>
                                    )}
                                    {showsTime && (
                                        <td className="px-3 py-2 text-right font-mono">{entry.time ?? '—'}</td>
                                    )}
                                    <td className="px-3 py-2 text-right text-muted-foreground">{entry.backNumber || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!isFinal && (
                    <p className="text-xs text-muted-foreground text-center pt-3">
                        These results are not yet finalized — placings may change.
                    </p>
                )}
            </>
        );
    };

    return (
        <>
            <Helmet>
                <title>Class Results — EquiPatterns</title>
            </Helmet>
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="w-full max-w-lg">
                    <CardHeader>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/s/${id}`)}
                            className="self-start mb-2 h-8 px-2 text-xs"
                        >
                            <ArrowLeft className="h-3 w-3 mr-1" /> Back
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Trophy className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <CardTitle>Class Results</CardTitle>
                                <CardDescription className="truncate">{headerSubtitle}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>{renderBody()}</CardContent>
                </Card>
            </div>
        </>
    );
};

export default ScoreSheetResultsPage;
