import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2, Trophy, FileText, Eye, Search, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { resolvePostedSheetLink } from '@/lib/postedScoreSheets';

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
    const { toast } = useToast();
    const [project, setProject] = useState(null);
    const [sheets, setSheets] = useState([]);
    const [published, setPublished] = useState(false);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState(null);
    const [discipline, setDiscipline] = useState('');
    const [judge, setJudge] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            // Read through the RPC: this page needs nothing but the results, and
            // reading the table gave any visitor the exhibitor bookings too.
            const { data: pub, error: projError } = await supabase
                .rpc('get_public_project', { p_id: id });

            const proj = pub
                ? { id: pub.id, project_name: pub.name, status: pub.status, project_data: pub.projectData || {} }
                : null;

            if (cancelled) return;
            if (projError || !proj) {
                setError('Show not found.');
                setStatus('error');
                return;
            }
            setProject(proj);

            // The publish rule lives in list_posted_score_sheets now, not here.
            // Keeping a second copy on the page meant this view locked out signed-in
            // staff while /s/:id and /s/:id/results let them look — the office could
            // see a class but not the show it belonged to. One rule, one place.
            //
            // Through the RPC rather than the table. Reading score_sheet_qr_codes
            // from the browser meant an anonymous request with no filter returned
            // every row for every show — judge names and a link to each completed
            // sheet, published or not. The function does the same two-step match
            // (project id first, then show name, because a pattern-book record can
            // carry its own id) and applies the publish rule server-side.
            const { data: posted, error: postedError } = await supabase
                .rpc('list_posted_score_sheets', { p_project_id: id });
            if (cancelled) return;
            if (postedError) throw postedError;

            const sheets = posted?.sheets || [];

            // The function withholds the sheets from the public until the show is
            // published, so "not published and nothing to show" is the lock screen.
            // Signed-in staff get their sheets back and fall through to the list.
            if (!posted?.published && sheets.length === 0) {
                setStatus('unpublished');
                return;
            }

            setSheets(sheets);
            setPublished(!!posted?.published);
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

    // Official placings / scores typed into Results Entry. Shown only once the show
    // is published — the same gate the score sheets use.
    const finalResults = useMemo(() => {
        if (!published) return [];
        const all = project?.project_data?.results?.classResults;
        if (!all) return [];
        return Object.values(all)
            .filter(r => r.status === 'final')
            .sort((a, b) => (a.classNumber || 0) - (b.classNumber || 0));
    }, [published, project]);

    // Sheets posted since the private bucket went in have no permanent address, so
    // the link is fetched on click and expires afterwards. Older ones still carry
    // their original public address and open straight from it.
    const openSheet = async (sheet) => {
        const link = await resolvePostedSheetLink(sheet);
        if (!link) {
            toast({ title: 'Could not open that sheet', description: 'Please try again in a moment.', variant: 'destructive' });
            return;
        }
        window.open(link, '_blank', 'noopener');
    };

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

                    {status === 'ready' && sheets.length === 0 && finalResults.length === 0 && (
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

                    {status === 'ready' && finalResults.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Class Placings</CardTitle>
                                <CardDescription>Official results for {finalResults.length} class{finalResults.length !== 1 ? 'es' : ''}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {finalResults.map((result, idx) => (
                                    <div key={idx} className="rounded-lg border bg-background/50 overflow-hidden">
                                        <div className="px-4 py-2 bg-muted/50 font-medium text-sm flex items-center gap-2">
                                            <span className="font-mono text-muted-foreground">#{result.classNumber}</span>
                                            <span>{result.className}</span>
                                            {result.scoringType === 'timed' && <Badge variant="outline" className="text-[10px]">Timed</Badge>}
                                            {result.scoringType === 'scored' && <Badge variant="outline" className="text-[10px]">Scored</Badge>}
                                        </div>
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-xs text-muted-foreground border-b">
                                                    <th className="px-4 py-1 text-left w-14">Place</th>
                                                    <th className="px-4 py-1 text-left">Rider</th>
                                                    <th className="px-4 py-1 text-left">Horse</th>
                                                    {result.scoringType === 'scored' && <th className="px-4 py-1 text-left w-20">Score</th>}
                                                    {result.scoringType === 'timed' && <th className="px-4 py-1 text-left w-20">Time</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(result.entries || []).filter(e => e.riderName?.trim()).map((entry, eIdx) => (
                                                    <tr key={eIdx} className="border-b last:border-0">
                                                        <td className="px-4 py-1.5 font-bold text-muted-foreground">{entry.placing}</td>
                                                        <td className="px-4 py-1.5">{entry.riderName}</td>
                                                        <td className="px-4 py-1.5 text-muted-foreground">{entry.horseName || '—'}</td>
                                                        {result.scoringType === 'scored' && <td className="px-4 py-1.5 font-mono">{entry.score ?? '—'}</td>}
                                                        {result.scoringType === 'timed' && <td className="px-4 py-1.5 font-mono">{entry.time ?? '—'}</td>}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
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
                                                onClick={() => openSheet(sheet)}
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
