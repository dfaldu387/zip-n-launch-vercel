import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, AlertTriangle, Trophy, ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';

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
            const { data: qr, error: qrError } = await supabase
                .from('score_sheet_qr_codes')
                .select('*')
                .eq('id', id)
                .maybeSingle();
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

            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('project_data')
                .eq('id', qr.project_id)
                .maybeSingle();
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
