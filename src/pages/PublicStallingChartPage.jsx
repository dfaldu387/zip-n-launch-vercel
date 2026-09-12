import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Home, ArrowLeft, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { gridCols, computeGridLabels, labelValue } from '@/lib/barnGrid';

// Read-only public stalling / RV chart — a simplified, wayfinding-focused view of
// the same grid the organizer builds in Assign Stalls. What each box shows (and
// whether this page exists at all) is entirely decided by the organizer's Publish
// Chart settings; this page never receives anything beyond stall #, exhibitor and
// trainer/group — see get_public_stalling_chart().

// Same palette family used on the admin board/printout, so a returning organizer
// recognizes the colors, though exact matching isn't essential here.
const PALETTE = [
    '#2563eb', '#e11d48', '#16a34a', '#f59e0b', '#7c3aed',
    '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569',
    '#0d9488', '#a21caf', '#ca8a04', '#4f46e5', '#92400e',
];

const ROOM_LABELS = { office: 'Office', feed: 'Feed', wash: 'Wash', tack: 'Tack' };

const UnitGrid = ({ name, units, layoutCols, stallCount, rowLabels, colLabels, colorByGroup }) => {
    const cols = gridCols({ layoutCols, stallCount });
    const rowCount = Math.ceil(units.length / cols);
    const { rowLabels: defRows, colLabels: defCols } = computeGridLabels(units, cols);

    return (
        <Card className="bg-secondary border-border">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Home className="h-4 w-4 text-primary" /> {name}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="inline-grid gap-1" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(52px, 1fr))` }}>
                        <div />
                        {Array.from({ length: cols }, (_, ci) => (
                            <div key={ci} className="text-center text-[11px] font-semibold text-muted-foreground font-mono">
                                {labelValue(colLabels, defCols, ci)}
                            </div>
                        ))}
                        {Array.from({ length: rowCount }, (_, ri) => (
                            <React.Fragment key={ri}>
                                <div className="flex items-center justify-center text-[11px] font-semibold text-muted-foreground font-mono">
                                    {labelValue(rowLabels, defRows, ri)}
                                </div>
                                {Array.from({ length: cols }, (_, ci) => {
                                    const unit = units[ri * cols + ci];
                                    if (!unit) return <div key={ci} />;
                                    const type = unit.type || 'stall';
                                    if (type !== 'stall') {
                                        return (
                                            <div key={ci} className="h-14 w-full rounded-sm border border-dashed border-muted-foreground/20 bg-muted/30 flex items-center justify-center text-[9px] uppercase text-muted-foreground/60 font-mono">
                                                {type === 'blocked' ? unit.number : (ROOM_LABELS[type] || '')}
                                            </div>
                                        );
                                    }
                                    const color = unit.taken ? (colorByGroup[unit.groupKey || unit.id] || '#2563eb') : null;
                                    return (
                                        <div
                                            key={ci}
                                            title={`${unit.number}${unit.exhibitor ? ' · ' + unit.exhibitor : ''}${unit.trainer ? ' · ' + unit.trainer : ''}`}
                                            className="h-14 w-full rounded-sm border flex flex-col items-center justify-center overflow-hidden px-0.5 font-mono"
                                            style={color ? { background: color, borderColor: color, color: '#fff' } : { background: 'var(--background)' }}
                                        >
                                            {unit.trainer && <span className="text-[9px] font-semibold leading-tight truncate max-w-full">{unit.trainer}</span>}
                                            {unit.exhibitor && unit.exhibitor !== unit.trainer && (
                                                <span className="text-[8px] opacity-90 leading-tight truncate max-w-full">{unit.exhibitor}</span>
                                            )}
                                            <span className="text-[8px] opacity-80 leading-tight">{unit.number}</span>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const PublicStallingChartPage = () => {
    const { showId } = useParams();
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const { data: chart, error: err } = await supabase.rpc('get_public_stalling_chart', { p_show_id: showId });
                if (err) throw err;
                setData(chart);
            } catch (e) {
                setError(e.message || 'Could not load the stalling chart.');
            } finally {
                setIsLoading(false);
            }
        };
        if (showId) load();
    }, [showId]);

    // One color per group (trainer / exhibitor), stable across barns and RV areas.
    const colorByGroup = useMemo(() => {
        const keys = [];
        const collect = (units) => (units || []).forEach(u => {
            const k = u.groupKey || u.id;
            if (u.taken && k && !keys.includes(k)) keys.push(k);
        });
        (data?.barns || []).forEach(b => collect(b.stalls));
        (data?.rvAreas || []).forEach(a => collect(a.spots));
        const map = {};
        keys.forEach((k, i) => { map[k] = PALETTE[i % PALETTE.length]; });
        return map;
    }, [data]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !data?.enabled) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="text-center space-y-3">
                    <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">{error || 'This show has not published a stalling chart yet.'}</p>
                    <Button asChild variant="outline"><Link to={`/event-detail/${showId}`}><ArrowLeft className="h-4 w-4 mr-2" /> Back to event</Link></Button>
                </div>
            </div>
        );
    }

    const hasBarns = (data.barns || []).length > 0;
    const hasRv = (data.rvAreas || []).some(a => (a.spots || []).length > 0);

    return (
        <div className="min-h-screen py-10 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
                        <Link to={`/event-detail/${showId}`}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to event</Link>
                    </Button>
                    <h1 className="text-2xl font-bold">{data.showName} — Stalling Chart</h1>
                    <p className="text-sm text-muted-foreground">Find your stall below.</p>
                </div>

                {!hasBarns && !hasRv && (
                    <p className="text-muted-foreground">Nothing to show yet.</p>
                )}

                {(data.barns || []).map(barn => (
                    <motion.div key={barn.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <UnitGrid
                            name={barn.name}
                            units={barn.stalls || []}
                            layoutCols={barn.layoutCols}
                            stallCount={barn.stallCount}
                            rowLabels={barn.rowLabels}
                            colLabels={barn.colLabels}
                            colorByGroup={colorByGroup}
                        />
                    </motion.div>
                ))}

                {(data.rvAreas || []).filter(a => (a.spots || []).length > 0).map(area => (
                    <motion.div key={area.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <UnitGrid
                            name={`${area.name} (RV / Camping)`}
                            units={area.spots || []}
                            layoutCols={area.spotCount}
                            stallCount={area.spotCount}
                            rowLabels={area.rowLabels}
                            colLabels={area.colLabels}
                            colorByGroup={colorByGroup}
                        />
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default PublicStallingChartPage;
