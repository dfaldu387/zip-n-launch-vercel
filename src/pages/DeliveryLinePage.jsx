import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, Truck, CheckCircle2, MapPin, Users, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { parseDeliveryToken, parseItemsParam } from '@/lib/deliveryLink';
import { SUPPLY_STAGES } from '@/lib/supplyStatus';
import { cn } from '@/lib/utils';

// Opened by scanning the QR on a printed Load Sheet (Robert, 2026-10-30): one order
// line, no login — the driver may just be a facility employee. They type who they
// are, then mark the line Out for delivery / Delivered. The name goes into the
// booking's Activity Log. The link carries its own secret; see
// supabase/migrations/20261031120000_delivery_qr_rpcs.sql.

const NAME_KEY = 'equipatterns.deliveryDriverName';

const stageOf = (key) => SUPPLY_STAGES.find(s => s.key === key) || SUPPLY_STAGES[0];
const stageIndex = (key) => Math.max(0, SUPPLY_STAGES.findIndex(s => s.key === key));
const plural = (qty) => (Number(qty) === 1 ? '' : 's');

const fmtWhen = (iso) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
        return '';
    }
};

const DeliveryLinePage = () => {
    const { token } = useParams();
    const [search] = useSearchParams();
    const link = useMemo(() => parseDeliveryToken(token), [token]);
    const itemIds = useMemo(() => parseItemsParam(search.get('items')), [search]);

    const [line, setLine] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [driver, setDriver] = useState(() => {
        try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
    });
    const [busyStatus, setBusyStatus] = useState('');
    const [actionError, setActionError] = useState('');
    const [justDone, setJustDone] = useState('');

    useEffect(() => {
        const load = async () => {
            if (!link) {
                setLoadError('This delivery link is not valid.');
                setIsLoading(false);
                return;
            }
            const { data, error } = await supabase.rpc('get_delivery_line', {
                p_show_id: link.showId,
                p_booking_id: link.bookingId,
                p_secret: link.secret,
                p_item_ids: itemIds,
            });
            if (error || !data) setLoadError('This delivery link is not valid or is no longer active.');
            else setLine(data);
            setIsLoading(false);
        };
        load();
    }, [link, itemIds]);

    const items = line?.items || [];
    const allDelivered = items.length > 0 && items.every(it => it.status === 'delivered');
    const nameOk = driver.trim().length >= 2;

    // A button only appears when at least one item on this line can still move to it.
    const canMoveTo = (key) => items.some(it => stageIndex(it.status) < stageIndex(key));

    const apply = async (status) => {
        if (!nameOk || busyStatus) return;
        setBusyStatus(status);
        setActionError('');
        try {
            const { data, error } = await supabase.rpc('set_delivery_line_status', {
                p_show_id: link.showId,
                p_booking_id: link.bookingId,
                p_secret: link.secret,
                p_item_ids: itemIds,
                p_status: status,
                p_delivered_by: driver.trim(),
            });
            if (error) throw error;
            try { localStorage.setItem(NAME_KEY, driver.trim()); } catch { /* private mode */ }
            setLine(data);
            setJustDone(status);
        } catch (err) {
            setActionError(err?.message || 'Could not save. Please try again.');
        } finally {
            setBusyStatus('');
        }
    };

    return (
        <div className="min-h-screen bg-muted/30 flex justify-center px-4 py-6">
            <Helmet><title>Delivery — {line?.showName || 'EquiPatterns'}</title></Helmet>
            <div className="w-full max-w-md space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Truck className="h-4 w-4" /> Hay &amp; Shavings Delivery
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
                            <CardContent className="p-4 space-y-2">
                                <p className="text-xs text-muted-foreground">{line.showName} · Order #{line.orderRef}</p>
                                <p className="text-xl font-bold leading-tight">{line.customer}</p>
                                {line.stableWith && (
                                    <p className="text-sm flex items-start gap-2 text-muted-foreground">
                                        <Users className="h-4 w-4 mt-0.5 shrink-0" /> Stabling with/under: <span className="text-foreground">{line.stableWith}</span>
                                    </p>
                                )}
                                {(line.barn || line.stalls) && (
                                    <p className="text-sm flex items-start gap-2 text-muted-foreground">
                                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span className="text-foreground">
                                            {line.barn}{line.barn && line.stalls ? ' · ' : ''}{line.stalls && `Stall ${line.stalls}`}
                                        </span>
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-0 divide-y">
                                {items.map(it => {
                                    const stage = stageOf(it.status);
                                    return (
                                        <div key={it.refId} className="px-4 py-3 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold">{it.name}</p>
                                                <p className="text-sm text-muted-foreground">{it.qty} {it.unit}{plural(it.qty)}</p>
                                                {it.status === 'delivered' && it.deliveredBy && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Delivered by {it.deliveredBy}{it.deliveredAt ? ` · ${fmtWhen(it.deliveredAt)}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={cn('text-white text-xs font-medium rounded-full px-2.5 py-1 shrink-0', stage.color)}>
                                                {stage.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        {allDelivered ? (
                            <Card className="border-emerald-300">
                                <CardContent className="py-6 text-center space-y-1">
                                    <CheckCircle2 className="h-9 w-9 mx-auto text-emerald-600" />
                                    <p className="font-semibold">
                                        {justDone === 'delivered' ? 'Saved — marked Delivered' : 'Everything on this line is delivered'}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="p-4 space-y-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="driver">Delivered by <span className="text-rose-600">*</span></Label>
                                        <Input
                                            id="driver"
                                            value={driver}
                                            onChange={(e) => setDriver(e.target.value)}
                                            placeholder="Your name"
                                            maxLength={60}
                                            autoComplete="name"
                                            className="h-11 text-base"
                                        />
                                    </div>
                                    {actionError && <p className="text-sm text-rose-600">{actionError}</p>}
                                    {justDone === 'out_for_delivery' && (
                                        <p className="text-sm text-emerald-700">Saved — marked Out for delivery.</p>
                                    )}
                                    {canMoveTo('out_for_delivery') && (
                                        <Button
                                            variant="outline"
                                            className="w-full h-12 text-base"
                                            disabled={!nameOk || !!busyStatus}
                                            onClick={() => apply('out_for_delivery')}
                                        >
                                            {busyStatus === 'out_for_delivery' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
                                            Mark Out for Delivery
                                        </Button>
                                    )}
                                    <Button
                                        className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700"
                                        disabled={!nameOk || !!busyStatus}
                                        onClick={() => apply('delivered')}
                                    >
                                        {busyStatus === 'delivered' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                        Mark Delivered
                                    </Button>
                                    {!nameOk && <p className="text-xs text-muted-foreground text-center">Type your name to enable the buttons.</p>}
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DeliveryLinePage;
