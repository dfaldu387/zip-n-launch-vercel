import React, { useMemo, useState } from 'react';
import { Home, CheckCircle2, Loader2 } from 'lucide-react';
import { isItemDelivered } from '@/lib/supplyStatus';
import { cn } from '@/lib/utils';
import { PALETTE, groupNameOf } from '@/components/housing/AssignBoard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { buildLayerIndex, layerCell, beddingItemsOf, spread, stallsOfBooking } from '@/lib/stallLayers';
import { getRequestedStallCount } from '@/lib/stallAssignment';
import { gridCols, computeGridLabels, labelValue } from '@/lib/barnGrid';

// Read-only barn map for the Hay & Shavings tab (Robert: "turn this into an
// interactive map" for stall deliveries). Same colours as Assign Stalls — one
// colour per exhibitor, a coloured outline + name tag around each trainer /
// group block — but the boxes are plain buttons instead of drop targets.
// Each box shows the exhibitor and the stall number.

const CELL = 'h-14 w-16';
const LABEL_W = 'w-8';

const outlineShadow = (sides, color) => {
    if (!sides) return null;
    const p = [];
    if (sides.top) { p.push(`inset 0 3px 0 0 ${color}`); p.push('inset 0 4px 0 0 rgba(255,255,255,0.75)'); }
    if (sides.bottom) { p.push(`inset 0 -3px 0 0 ${color}`); p.push('inset 0 -4px 0 0 rgba(255,255,255,0.75)'); }
    if (sides.left) { p.push(`inset 3px 0 0 0 ${color}`); p.push('inset 4px 0 0 0 rgba(255,255,255,0.75)'); }
    if (sides.right) { p.push(`inset -3px 0 0 0 ${color}`); p.push('inset -4px 0 0 0 rgba(255,255,255,0.75)'); }
    return p.length ? p.join(', ') : null;
};

const isWalkwayRow = (row) => row.length > 0 && row.every(u => {
    const t = u.type || 'stall';
    return t === 'aisle' || t === 'empty';
});

const SupplyDeliveryMap = ({ bookings = [], barns = [], supplies = [], orders = [], onMarkDelivered, renderOrder }) => {
    // Same rules as Assign Stalls, so a person sees the same colours on both screens.
    const colorByBooking = useMemo(() => {
        const map = {};
        (bookings || []).filter(b => b && b.status !== 'cancelled')
            .forEach((b, i) => { map[b.id] = PALETTE[i % PALETTE.length]; });
        return map;
    }, [bookings]);

    const bookingById = useMemo(
        () => Object.fromEntries((bookings || []).map(b => [b.id, b])),
        [bookings]
    );

    const layerIndex = useMemo(
        () => buildLayerIndex({ bookings, barns, supplies }),
        [bookings, barns, supplies]
    );

    const { colorByGroup, groupNameByBooking } = useMemo(() => {
        const groupMap = new Map();
        (bookings || [])
            .filter(b => b && b.status !== 'cancelled' && b.orderType !== 'live-supply' && getRequestedStallCount(b) > 0)
            .forEach(b => {
                const name = groupNameOf(b);
                const key = name.toLowerCase();
                if (!key) return;
                if (!groupMap.has(key)) groupMap.set(key, { id: key, name, bookingIds: [] });
                groupMap.get(key).bookingIds.push(b.id);
            });
        const colors = {};
        const names = {};
        [...groupMap.values()].forEach((g, i) => {
            colors[g.id] = PALETTE[i % PALETTE.length];
            g.bookingIds.forEach(id => { names[id] = { id: g.id, name: g.name }; });
        });
        return { colorByGroup: colors, groupNameByBooking: names };
    }, [bookings]);

    // What each stall has to receive, per product. One product per supply item
    // (Shavings, Hay (Grass), Hay (Alfalfa)…) because that is how deliveries are
    // tracked. An exhibitor's quantity is spread evenly over the stalls they hold —
    // the same rule the Assign Stalls layers use, so 10 bags over 2 stalls is 5 + 5.
    const { options, amountByStall, ownersByProduct } = useMemo(() => {
        const opts = new Map();
        const byStall = {};
        const owners = {}; // product key → ids of the bookings that have it to be delivered
        (bookings || [])
            .filter(b => b && b.status !== 'cancelled' && b.orderType !== 'live-supply')
            .forEach(b => {
                const stallIds = stallsOfBooking(barns, b.id);
                beddingItemsOf(b, supplies).forEach(it => {
                    const key = it.refId || it.name;
                    const qty = Number(it.qty) || 0;
                    if (!key || qty <= 0) return;
                    if (!opts.has(key)) opts.set(key, { key, label: it.name || 'Item', unit: it.isHay ? 'bale' : 'bag', isHay: it.isHay });
                    if (stallIds.length) {
                        if (!owners[key]) owners[key] = new Set();
                        owners[key].add(b.id);
                    }
                    spread(qty, stallIds.length).forEach((n, i) => {
                        const id = stallIds[i];
                        byStall[id] = { ...(byStall[id] || {}), [key]: ((byStall[id] || {})[key] || 0) + n };
                    });
                });
            });
        // Shavings first, then hay, each alphabetical.
        const list = [...opts.values()].sort((a, z) => (a.isHay - z.isHay) || a.label.localeCompare(z.label));
        return { options: list, amountByStall: byStall, ownersByProduct: owners };
    }, [bookings, barns, supplies]);

    const [pickedKey, setPickedKey] = useState(null);
    const product = options.find(o => o.key === pickedKey) || options[0] || null;

    const totals = useMemo(() => {
        if (!product) return { qty: 0, stalls: 0 };
        const vals = Object.values(amountByStall).map(m => m[product.key] || 0).filter(n => n > 0);
        return { qty: vals.reduce((s, n) => s + n, 0), stalls: vals.length };
    }, [amountByStall, product]);

    // Which exhibitors already have the picked product delivered — drives the "D"
    // on their tiles and the popup's button. Read from the same per-item status the
    // order card uses, so the map and the list can't disagree.
    const itemOf = (order) => order?.items?.find(it => (it.refId || it.name) === product?.key) || null;
    const deliveredBookingIds = useMemo(() => {
        const set = new Set();
        if (!product) return set;
        orders.forEach(o => {
            const it = o.items?.find(x => (x.refId || x.name) === product.key);
            if (it?.refId && isItemDelivered(o, it.refId)) set.add(o.id);
        });
        return set;
    }, [orders, product]);

    // "Delivered 3 of 8 exhibitors" — how much of the picked product is left to walk out.
    const progress = useMemo(() => {
        const ids = product ? [...(ownersByProduct[product.key] || [])] : [];
        return { total: ids.length, done: ids.filter(id => deliveredBookingIds.has(id)).length };
    }, [product, ownersByProduct, deliveredBookingIds]);

    const [delivering, setDelivering] = useState(false);
    const markDelivered = async (order, item) => {
        setDelivering(true);
        try {
            await onMarkDelivered?.(order, item);
            setOpenBookingId(null); // done here — back to the map, where the tiles now carry a "D"
        } finally {
            setDelivering(false);
        }
    };

    // Click a stall → everything that exhibitor is owed for the picked product:
    // each stall they hold and the amount, plus the total to load on the cart.
    const [openBookingId, setOpenBookingId] = useState(null);
    const popup = useMemo(() => {
        if (!openBookingId || !product) return null;
        const numberById = {};
        barns.forEach(barn => (barn.stalls || []).forEach(s => { numberById[s.id] = s.number; }));
        const rows = stallsOfBooking(barns, openBookingId).map(id => ({
            id, number: numberById[id] || '', amount: amountByStall[id]?.[product.key] || 0,
        }));
        return {
            booking: bookingById[openBookingId],
            rows,
            total: rows.reduce((s, r) => s + r.amount, 0),
        };
    }, [openBookingId, product, barns, amountByStall, bookingById]);

    if (!barns.length) {
        return (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                No barns yet. Add a barn in the Inventory tab, then assign stalls to see the map.
            </div>
        );
    }

    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

    return (
        <div className="space-y-4">
            {/* Which product the map is showing — one at a time, so each stall reads as
                "what do I carry to this stall". */}
            <div className="space-y-1.5">
                {options.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay or shavings have been ordered for stalls yet.</p>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">Show</span>
                            {options.map(o => (
                                <Button
                                    key={o.key}
                                    size="sm"
                                    variant={product?.key === o.key ? 'default' : 'outline'}
                                    className="h-8 text-xs"
                                    onClick={() => setPickedKey(o.key)}
                                >
                                    {o.label}
                                </Button>
                            ))}
                        </div>
                        {product && (
                            <p className="text-xs text-muted-foreground">
                                {product.label}: <span className="font-semibold text-foreground">{plural(totals.qty, product.unit)}</span> across {plural(totals.stalls, 'stall')}
                                {' · '}
                                <span className={cn('font-semibold', progress.total > 0 && progress.done === progress.total ? 'text-emerald-600' : 'text-foreground')}>
                                    Delivered {progress.done} of {plural(progress.total, 'exhibitor')}
                                </span>
                            </p>
                        )}
                    </>
                )}
            </div>
            {barns.map(barn => (
                <BarnMap
                    key={barn.id}
                    barn={barn}
                    product={product}
                    amountByStall={amountByStall}
                    layerIndex={layerIndex}
                    bookingById={bookingById}
                    colorByBooking={colorByBooking}
                    colorByGroup={colorByGroup}
                    groupNameByBooking={groupNameByBooking}
                    onOpenBooking={setOpenBookingId}
                    deliveredBookingIds={deliveredBookingIds}
                />
            ))}

            <Dialog open={!!popup} onOpenChange={(open) => { if (!open) setOpenBookingId(null); }}>
                {/* grid-cols-1 lets the single column shrink to the screen (the base dialog's
                    auto column grew to fit the order card and pushed the right edge off a
                    phone); p-4 on a phone gives the card the room it needs. */}
                <DialogContent className="max-w-2xl max-h-[90vh] grid-cols-1 p-4 sm:p-6">
                    {popup && (
                        <>
                            <DialogHeader className="pr-10">
                                <DialogTitle>{popup.booking?.exhibitorName || 'Exhibitor'} · {product.label}</DialogTitle>
                                <DialogDescription>
                                    {popup.booking?.trainerName ? `Stabled with ${popup.booking.trainerName}. ` : ''}
                                    Everything to deliver to this exhibitor's stalls.
                                </DialogDescription>
                            </DialogHeader>
                            {popup.total === 0 ? (
                                <div className="space-y-2 py-2">
                                    <p className="text-sm text-muted-foreground">
                                        No {product.label.toLowerCase()} ordered for this exhibitor.
                                    </p>
                                    {/* Say what they DID order, and let the person jump straight to it. */}
                                    {options.filter(o => o.key !== product.key && ownersByProduct[o.key]?.has(openBookingId)).length > 0 && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm text-muted-foreground">They ordered:</span>
                                            {options
                                                .filter(o => o.key !== product.key && ownersByProduct[o.key]?.has(openBookingId))
                                                .map(o => (
                                                    <Button key={o.key} size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPickedKey(o.key)}>
                                                        Show {o.label}
                                                    </Button>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        {popup.rows.map(r => (
                                            <div key={r.id} className={cn(
                                                'rounded-md border px-2 py-1 text-center min-w-[3.5rem]',
                                                r.amount === 0 && 'opacity-40'
                                            )}>
                                                <p className="text-xs font-mono font-semibold">{r.number}</p>
                                                <p className="text-[11px] text-muted-foreground">{r.amount} {product.unit}{r.amount === 1 ? '' : 's'}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-baseline justify-between rounded-md bg-muted/50 px-3 py-2">
                                        <span className="text-xs font-semibold uppercase text-muted-foreground">Total to deliver</span>
                                        <span className="text-lg font-bold tabular-nums">{plural(popup.total, product.unit)}</span>
                                    </div>
                                </div>
                            )}
                            {/* One tap once the product is on the ground. Marks only the picked product
                                (Shavings, not the Hay), same save + customer email as the status dropdown. */}
                            {(() => {
                                const order = orders.find(o => o.id === openBookingId);
                                const item = itemOf(order);
                                if (!order || !item || popup.total === 0) return null;
                                if (deliveredBookingIds.has(openBookingId)) {
                                    return (
                                        <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                                            <CheckCircle2 className="h-4 w-4" /> {product.label} delivered
                                        </div>
                                    );
                                }
                                return (
                                    <Button
                                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                                        disabled={delivering || !item.refId}
                                        onClick={() => markDelivered(order, item)}
                                    >
                                        {delivering
                                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                                            : <><CheckCircle2 className="h-4 w-4 mr-2" /> Mark {product.label} delivered · {plural(popup.total, product.unit)}</>}
                                    </Button>
                                );
                            })()}
                            {/* The exhibitor's actual order — the same card as the List view, so
                                status, contact and every item are one click away from the map. */}
                            {renderOrder?.(openBookingId)}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

const BarnMap = ({ barn, product, amountByStall, onOpenBooking, deliveredBookingIds, layerIndex, bookingById, colorByBooking, colorByGroup, groupNameByBooking }) => {
    const units = barn.stalls || [];
    const c = Math.max(1, gridCols(barn));
    const rowCount = Math.ceil(units.length / c);
    const grid = useMemo(
        () => Array.from({ length: rowCount }, (_, r) => units.slice(r * c, r * c + c)),
        [units, c, rowCount]
    );
    const { rowLabels: defRowLabels, colLabels: defColLabels } = useMemo(
        () => computeGridLabels(units, c), [units, c]
    );

    const groupIdAt = (i) => (i >= 0 && i < units.length && units[i]?.bookingId) ? groupNameByBooking[units[i].bookingId]?.id : null;

    return (
        <div className="rounded-lg border p-3 bg-background/60">
            <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Home className="h-4 w-4 text-primary" /> {barn.name}
                </p>
            </div>
            <div className="overflow-x-auto">
                <div className="inline-flex flex-col gap-0">
                    <div className="flex gap-0">
                        <div className={cn('h-6 shrink-0', LABEL_W)} />
                        {Array.from({ length: c }).map((_, ci) => (
                            <div key={ci} className={cn('h-6 w-16 flex items-center justify-center text-[10px] font-semibold text-muted-foreground', ci > 0 && '-ml-px')}>
                                {labelValue(barn.colLabels, defColLabels, ci)}
                            </div>
                        ))}
                    </div>
                    {grid.map((rowUnits, ri) => {
                        const rowLabel = labelValue(barn.rowLabels, defRowLabels, ri);
                        if (isWalkwayRow(rowUnits)) {
                            return (
                                <div key={ri} className="flex gap-0 items-center">
                                    <div className={cn('shrink-0 text-center text-[10px] font-semibold text-muted-foreground', LABEL_W)}>{rowLabel}</div>
                                    <div className="h-2 my-px rounded-sm bg-muted-foreground/10 border border-dashed border-muted-foreground/20"
                                        style={{ width: c * 64 - (c - 1) }} title="Aisle / walkway" />
                                </div>
                            );
                        }
                        return (
                            <div key={ri} className="flex gap-0 items-stretch">
                                <div className={cn('shrink-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground', LABEL_W, ri > 0 && '-mt-px')}>
                                    {rowLabel}
                                </div>
                                {rowUnits.map((unit, ci) => {
                                    const idx = ri * c + ci;
                                    const type = unit.type || 'stall';
                                    if (type !== 'stall') {
                                        const quiet = type === 'aisle' || type === 'empty';
                                        return (
                                            <div key={unit.id} className={cn(
                                                'flex items-center justify-center border -ml-px -mt-px select-none font-mono text-[8px] text-muted-foreground/60',
                                                CELL, quiet ? 'bg-muted/30 border-dashed border-muted-foreground/20' : 'bg-muted/40'
                                            )}>
                                                {quiet ? '' : (type === 'blocked' ? unit.number : type.slice(0, 4))}
                                            </div>
                                        );
                                    }
                                    const taken = !!unit.bookingId;
                                    const owner = taken ? bookingById[unit.bookingId] : null;
                                    const color = taken ? (colorByBooking[unit.bookingId] || '#2563eb') : null;
                                    const gid = taken ? groupNameByBooking[unit.bookingId]?.id : null;
                                    const gName = gid ? groupNameByBooking[unit.bookingId].name : '';
                                    const gColor = gid ? colorByGroup[gid] : null;
                                    let sides = null;
                                    if (gid) {
                                        sides = {
                                            top: groupIdAt(idx - c) !== gid,
                                            bottom: groupIdAt(idx + c) !== gid,
                                            left: ci === 0 || groupIdAt(idx - 1) !== gid,
                                            right: ci === c - 1 || groupIdAt(idx + 1) !== gid,
                                        };
                                    }
                                    const shadow = sides && gColor ? outlineShadow(sides, gColor) : null;
                                    const cell = layerCell(['number', 'name'], { unit, index: layerIndex });
                                    const showTag = !!(sides && sides.top && sides.left && gName);
                                    // Nothing to carry to this stall for the picked product → fade the
                                    // owner's colour instead of hiding who holds it (same idea as Assign Stalls).
                                    const amount = product && taken ? (amountByStall[unit.id]?.[product.key] || 0) : 0;
                                    const faded = taken && !!product && amount === 0;
                                    // Delivered → a small "D" in the corner; the colour is left alone so
                                    // the group / exhibitor colouring still reads (Robert's ask).
                                    const showDelivered = amount > 0 && deliveredBookingIds.has(unit.bookingId);
                                    return (
                                        <div
                                            key={unit.id}
                                            title={taken
                                                ? `${unit.number} · ${owner?.exhibitorName || 'Booked'}${gName ? ` · ${gName}` : ''}`
                                                : `${unit.number} · available`}
                                            onClick={taken && product ? () => onOpenBooking(unit.bookingId) : undefined}
                                            className={cn(
                                                'relative flex flex-col items-center justify-center border -ml-px -mt-px font-mono font-semibold select-none overflow-hidden text-[10px]',
                                                CELL,
                                                shadow && 'z-10',
                                                !taken && 'bg-background',
                                                taken && product && 'cursor-pointer hover:brightness-95'
                                            )}
                                            style={{
                                                ...(taken ? { backgroundColor: faded ? `${color}55` : color, color: faded ? '#0f172a' : '#fff', borderColor: faded ? `${color}55` : color } : {}),
                                                ...(shadow ? { boxShadow: shadow, borderColor: gColor } : {}),
                                            }}
                                        >
                                            {showDelivered && (
                                                <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-white text-emerald-700 text-[9px] leading-[14px] font-sans font-extrabold text-center shadow"
                                                    title="Delivered">
                                                    D
                                                </span>
                                            )}
                                            {showTag && (
                                                <span className="absolute top-0 left-0 px-1 text-[7px] font-sans font-bold uppercase tracking-wide text-white rounded-br-sm max-w-full truncate"
                                                    style={{ background: gColor }}>
                                                    {gName}
                                                </span>
                                            )}
                                            <span className={cn('px-0.5 text-center leading-tight truncate max-w-full', showTag && 'mt-2', amount > 0 ? 'text-[8px] opacity-90' : 'text-[10px]')}>
                                                {taken ? (cell.lines[0]?.text || unit.number) : unit.number}
                                            </span>
                                            {amount > 0 && (
                                                <span className="text-[11px] font-bold leading-tight whitespace-nowrap">
                                                    {amount} {product.unit}{amount === 1 ? '' : 's'}
                                                </span>
                                            )}
                                            {taken && cell.num && (
                                                <span className="text-[8px] opacity-70 leading-none">{cell.num}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SupplyDeliveryMap;
