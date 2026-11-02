import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, Truck, CheckCircle2, MapPin, Users, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { parseSheetToken, buildDeliveryToken } from '@/lib/deliveryLink';
import { SUPPLY_STAGES } from '@/lib/supplyStatus';
import { cn } from '@/lib/utils';
import SupplyDeliveryMap from '@/components/housing/SupplyDeliveryMap';

// Opened by the QR at the top of a printed Load Sheet (Robert, 2026-11-01): every
// supply order in the show on one phone page, no login. The driver types their name
// once and taps Delivered on a line. Each tap uses the same saving + customer-email
// path as the per-line QR page (DeliveryLinePage), using that order's own secret.
// See supabase/migrations/20261102120000_delivery_sheet_rpc.sql.

const NAME_KEY = 'equipatterns.deliveryDriverName';

const stageOf = (key) => SUPPLY_STAGES.find(s => s.key === key) || SUPPLY_STAGES[0];
const plural = (qty) => (Number(qty) === 1 ? '' : 's');

const DeliverySheetPage = () => {
    const { token } = useParams();
    const sheet = useMemo(() => parseSheetToken(token), [token]);

    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [driver, setDriver] = useState(() => {
        try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
    });
    const [tab, setTab] = useState('todo');
    const [view, setView] = useState('list');
    const [busyKey, setBusyKey] = useState('');
    const [message, setMessage] = useState('');

    const load = useCallback(async () => {
        if (!sheet) {
            setLoadError('This delivery link is not valid.');
            setIsLoading(false);
            return;
        }
        const { data: res, error } = await supabase.rpc('get_delivery_sheet', {
            p_show_id: sheet.showId,
            p_secret: sheet.secret,
        });
        if (error || !res) setLoadError('This delivery link is not valid or is no longer active.');
        else { setData(res); setLoadError(''); }
        setIsLoading(false);
    }, [sheet]);

    useEffect(() => { load(); }, [load]);

    const nameOk = driver.trim().length >= 2;
    const lines = data?.lines || [];
    const isDone = (l) => l.items.length > 0 && l.items.every(it => it.status === 'delivered');
    const todo = lines.filter(l => !isDone(l));
    const done = lines.filter(isDone);
    const shown = tab === 'todo' ? todo : done;

    // Group by barn so the driver works through one barn at a time.
    const groups = useMemo(() => {
        const map = new Map();
        shown.forEach(l => {
            const key = l.barn || 'At-show orders (no stall)';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(l);
        });
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [shown]);

    const markDelivered = async (line, itemRefIds) => {
        if (!nameOk || busyKey) return;
        const key = `${line.bookingId}:${itemRefIds.join(',')}`;
        setBusyKey(key);
        setMessage('');
        try {
            const { data: after, error } = await supabase.rpc('set_delivery_line_status', {
                p_show_id: sheet.showId,
                p_booking_id: line.bookingId,
                p_secret: line.secret,
                p_item_ids: itemRefIds,
                p_status: 'delivered',
                p_delivered_by: driver.trim(),
            });
            if (error) throw error;
            try { localStorage.setItem(NAME_KEY, driver.trim()); } catch { /* private mode */ }

            // Same rule as the per-line page: email only lines that just became Delivered.
            const newly = (after?.items || []).filter(a => {
                const before = line.items.find(it => it.refId === a.refId);
                return a.status === 'delivered' && before && before.status !== 'delivered';
            }).map(it => it.refId);
            setData(prev => ({
                ...prev,
                lines: prev.lines.map(l => l.bookingId === line.bookingId ? { ...l, items: after.items } : l),
                // Keep the map's copy in step so its tiles get their "D" straight away.
                map: prev.map && {
                    ...prev.map,
                    bookings: prev.map.bookings.map(b => b.id !== line.bookingId ? b : {
                        ...b,
                        itemStatuses: {
                            ...(b.itemStatuses || {}),
                            ...Object.fromEntries(after.items.map(it => [it.refId, { ...(b.itemStatuses?.[it.refId] || {}), status: it.status }])),
                        },
                    }),
                },
            }));
            if (newly.length > 0) {
                const { error: mailError } = await supabase.functions.invoke('send-supply-order-email', {
                    body: { kind: 'delivered', bookingId: line.bookingId, deliverySecret: line.secret, itemRefIds: newly },
                });
                setMessage(mailError ? 'Saved. The customer email could not be sent.' : `Saved. ${line.customer} was emailed.`);
            }
        } catch (err) {
            setMessage(err?.message || 'Could not save. Please try again.');
        } finally {
            setBusyKey('');
        }
    };

    return (
        <div className="min-h-screen bg-muted/30 flex justify-center px-4 py-6">
            <Helmet><title>Delivery list — {data?.showName || 'EquiPatterns'}</title></Helmet>
            <div className={cn('w-full space-y-4', view === 'map' ? 'max-w-5xl' : 'max-w-md')}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <Truck className="h-4 w-4" /> Hay &amp; Shavings Delivery
                    </div>
                    {data && (
                        <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => { setIsLoading(true); load(); }}>
                            <RefreshCw className="h-3.5 w-3.5" /> Refresh
                        </Button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : loadError ? (
                    <Card>
                        <CardContent className="py-10 text-center space-y-2">
                            <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
                            <p className="font-medium">{loadError}</p>
                            <p className="text-sm text-muted-foreground">Ask the show office to print a new Load Sheet.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card>
                            <CardContent className="p-4 space-y-3">
                                <p className="text-lg font-bold leading-tight">{data.showName}</p>
                                <div className="space-y-1.5">
                                    <Label htmlFor="driver">Delivered by <span className="text-rose-600">*</span></Label>
                                    <Input
                                        id="driver" value={driver} maxLength={60} autoComplete="name"
                                        onChange={(e) => setDriver(e.target.value)}
                                        placeholder="Your name" className="h-11 text-base"
                                    />
                                    {!nameOk && <p className="text-xs text-muted-foreground">Type your name to enable the Delivered buttons.</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[['list', 'List'], ['map', 'Stalling map']].map(([k, label]) => (
                                        <Button key={k} variant={view === k ? 'default' : 'outline'} className="h-10" onClick={() => setView(k)}>{label}</Button>
                                    ))}
                                </div>
                                {view === 'list' && <div className="grid grid-cols-2 gap-2">
                                    {[['todo', `To deliver (${todo.length})`], ['done', `Delivered (${done.length})`]].map(([k, label]) => (
                                        <Button key={k} variant={tab === k ? 'default' : 'outline'} className="h-10" onClick={() => setTab(k)}>{label}</Button>
                                    ))}
                                </div>}
                            </CardContent>
                        </Card>

                        {message && (
                            <p className={cn('text-sm text-center', message.includes('could not') || message.startsWith('Could') ? 'text-amber-700' : 'text-emerald-700')}>{message}</p>
                        )}

                        {view === 'map' && (
                            <SupplyDeliveryMap
                                bookings={data.map?.bookings || []}
                                barns={data.map?.barns || []}
                                supplies={data.map?.supplies || []}
                                orders={data.map?.bookings || []}
                                onMarkDelivered={async (order, item) => {
                                    const line = lines.find(l => l.bookingId === order.id);
                                    if (!line) { setMessage('Could not save. This order has no delivery link yet.'); return; }
                                    if (!nameOk) { setMessage('Type your name first, then tap Delivered again.'); return; }
                                    await markDelivered(line, [item.refId]);
                                }}
                            />
                        )}

                        {view === 'list' && groups.length === 0 && (
                            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                                {tab === 'todo' ? 'Everything is delivered.' : 'Nothing delivered yet.'}
                            </CardContent></Card>
                        )}

                        {view === 'list' && groups.map(([barn, barnLines]) => (
                            <div key={barn} className="space-y-2">
                                <p className="text-sm font-semibold px-1">{barn}</p>
                                {barnLines.map(line => {
                                    const open = line.items.filter(it => it.status !== 'delivered');
                                    const lineKey = `${line.bookingId}:${open.map(it => it.refId).join(',')}`;
                                    return (
                                        <Card key={line.bookingId}>
                                            <CardContent className="p-0">
                                                <div className="p-4 space-y-1">
                                                    <p className="font-bold leading-tight">{line.customer}</p>
                                                    {line.stableWith && (
                                                        <p className="text-xs flex items-start gap-1.5 text-muted-foreground">
                                                            <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Stabling with/under: <span className="text-foreground">{line.stableWith}</span>
                                                        </p>
                                                    )}
                                                    {line.stalls && (
                                                        <p className="text-xs flex items-start gap-1.5 text-muted-foreground">
                                                            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span className="text-foreground">Stall {line.stalls}</span>
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="divide-y border-t">
                                                    {line.items.map(it => {
                                                        const stage = stageOf(it.status);
                                                        const itemKey = `${line.bookingId}:${it.refId}`;
                                                        return (
                                                            <div key={it.refId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold">{it.name}</p>
                                                                    <p className="text-xs text-muted-foreground">{it.qty} {it.unit}{plural(it.qty)}</p>
                                                                    {it.status === 'delivered' && it.deliveredBy && (
                                                                        <p className="text-xs text-muted-foreground">Delivered by {it.deliveredBy}</p>
                                                                    )}
                                                                </div>
                                                                {it.status === 'delivered' ? (
                                                                    <span className={cn('text-white text-xs font-medium rounded-full px-2.5 py-1 shrink-0', stage.color)}>{stage.label}</span>
                                                                ) : (
                                                                    <Button
                                                                        size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 shrink-0"
                                                                        disabled={!nameOk || !!busyKey}
                                                                        onClick={() => markDelivered(line, [it.refId])}
                                                                    >
                                                                        {busyKey === itemKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" /> Delivered</>}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="px-4 py-3 border-t flex items-center gap-2">
                                                    {open.length > 1 && (
                                                        <Button
                                                            className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700"
                                                            disabled={!nameOk || !!busyKey}
                                                            onClick={() => markDelivered(line, open.map(it => it.refId))}
                                                        >
                                                            {busyKey === lineKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deliver all'}
                                                        </Button>
                                                    )}
                                                    <a
                                                        className="text-xs text-primary underline flex items-center gap-1 ml-auto"
                                                        href={`/delivery/${buildDeliveryToken(sheet.showId, line.bookingId, line.secret)}`}
                                                    >
                                                        Photo / details <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};

export default DeliverySheetPage;
