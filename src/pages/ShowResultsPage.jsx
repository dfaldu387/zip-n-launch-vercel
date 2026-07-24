import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2, Trophy, FileText, Eye, Search, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { isShowPublished } from '@/lib/showPublishing';

/**
 * The door Robert asked for: "exhibitors can see the score sheets online through
 * our website through the results button when the show is in publish mode."
 *
 * A rider who has walked away from the arena has no paper to scan, so this lists
 * every completed sheet posted for the show. Public, no login.
 */

const uniqueSorted = (rows, key) =>
    [...new Set(rows.map(r => (r[key] || '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }));

const ShowResultsPage = () => {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [sheets, setSheets] = useState([]);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState(null);
    const [discipline, setDiscipline] = useState('');
    const [judge, setJudge] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const { data: proj, error: projError } = await supabase
                .from('projects')
                .select('id, project_name, status, project_data')
                .eq('id', id)
                .maybeSingle();

            if (cancelled) return;
            if (projError || !proj) {
                setError('Show not found.');
                setStatus('error');
                return;
            }
            setProject(proj);

            if (!isShowPublished(proj)) {
                setStatus('unpublished');
                return;
            }

            // The QR record stores the show project id, but a pattern-book project
            // that never set linkedShowProjectId stores its own id — so fall back to
            // the show name, which every record carries.
            let rows = [];
            const byProject = await supabase
                .from('score_sheet_qr_codes')
                .select('id, class_name, division, judge_name, show_date, posted_sheet_url, posted_at, posted_by_name')
                .eq('project_id', proj.id)
                .not('posted_sheet_url', 'is', null);
            rows = byProject.data || [];

            if (rows.length === 0 && proj.project_name) {
                const byName = await supabase
                    .from('score_sheet_qr_codes')
                    .select('id, class_name, division, judge_name, show_date, posted_sheet_url, posted_at, posted_by_name')
                    .eq('show_name', proj.project_name)
                    .not('posted_sheet_url', 'is', null);
                rows = byName.data || [];
            }

            if (cancelled) return;
            setSheets(rows);
            setStatus('ready');
        };

        load().catch(e => {
            if (cancelled) return;
            console.error('Could not load posted score sheets:', e);
            setError(e.message || 'Could not load results.');
            setStatus('error');
        });

        return () => { cancelled = true; };
    }, [id]);

    const disciplines = useMemo(() => uniqueSorted(sheets, 'class_name'), [sheets]);
    const judges = useMemo(() => uniqueSorted(sheets, 'judge_name'), [sheets]);

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return sheets
            .filter(s => !discipline || (s.class_name || '').trim() === discipline)
            .filter(s => !judge || (s.judge_name || '').trim() === judge)
            .filter(s => !needle || [s.class_name, s.division, s.judge_name]
                .some(v => (v || '').toLowerCase().includes(needle)))
            .sort((a, b) =>
                (a.class_name || '').localeCompare(b.class_name || '', undefined, { numeric: true })
                || (a.division || '').localeCompare(b.division || '', undefined, { numeric: true })
                || (a.judge_name || '').localeCompare(b.judge_name || ''));
    }, [sheets, discipline, judge, search]);

    const showName = project?.project_name || 'Show';

    return (
        <>
            <Helmet>
                <title>{`Results — ${showName} — EquiPatterns`}</title>
            </Helmet>
            <div className="min-h-screen bg-background py-8 px-4">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Button asChild variant="ghost" size="sm">
                        <Link to={`/event-detail/${id}`}>
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back to show
                        </Link>
                    </Button>

                    <div className="flex items-start gap-3">
                        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Trophy className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Results</h1>
                            <p className="text-muted-foreground">{showName}</p>
                        </div>
                    </div>

                    {status === 'loading' && (
                        <div className="flex items-center justify-center py-16 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading results…
                        </div>
                    )}

                    {status === 'error' && (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">{error}</CardContent>
                        </Card>
                    )}

                    {status === 'unpublished' && (
                        <Card>
                            <CardContent className="py-12 text-center space-y-3">
                                <Lock className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
                                <p className="font-medium">Results are not published yet</p>
                                <p className="text-sm text-muted-foreground">
                                    The show office will post score sheets here once the show is published.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {status === 'ready' && sheets.length === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center space-y-3">
                                <FileText className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
                                <p className="font-medium">No score sheets posted yet</p>
                                <p className="text-sm text-muted-foreground">
                                    Check back once the classes have been judged.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {status === 'ready' && sheets.length > 0 && (
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative flex-1 min-w-[220px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search class, division or judge…"
                                        className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <select
                                    value={discipline}
                                    onChange={(e) => setDiscipline(e.target.value)}
                                    className="px-3 py-2 text-sm border rounded-md bg-background"
                                >
                                    <option value="">All disciplines</option>
                                    {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select
                                    value={judge}
                                    onChange={(e) => setJudge(e.target.value)}
                                    className="px-3 py-2 text-sm border rounded-md bg-background"
                                >
                                    <option value="">All judges</option>
                                    {judges.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                {visible.length} of {sheets.length} score sheet{sheets.length === 1 ? '' : 's'}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {visible.map(sheet => (
                                    <Card key={sheet.id} className="flex flex-col">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">{sheet.class_name || 'Class'}</CardTitle>
                                            <CardDescription>{sheet.division}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1 flex flex-col gap-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                {sheet.judge_name && <Badge variant="outline">Judge {sheet.judge_name}</Badge>}
                                                {sheet.show_date && <Badge variant="outline">{sheet.show_date}</Badge>}
                                            </div>
                                            <Button
                                                className="w-full mt-auto"
                                                onClick={() => window.open(sheet.posted_sheet_url, '_blank', 'noopener')}
                                            >
                                                <Eye className="h-4 w-4 mr-2" /> View Score Sheet
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {visible.length === 0 && (
                                <Card>
                                    <CardContent className="py-10 text-center text-muted-foreground text-sm">
                                        Nothing matches those filters.
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default ShowResultsPage;
