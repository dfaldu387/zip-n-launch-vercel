import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
    XCircle, Info, ShieldCheck, Wrench,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { detectConflicts, summarizeConflicts } from '@/lib/conflictDetection';

const SEVERITY_META = {
    error:   { label: 'Critical', icon: XCircle,        ring: 'border-red-300 dark:border-red-800',     bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-700 dark:text-red-300',       chip: 'bg-red-500'    },
    warning: { label: 'Warning',  icon: AlertTriangle,  ring: 'border-amber-300 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-300',   chip: 'bg-amber-500'  },
    info:    { label: 'Info',     icon: Info,           ring: 'border-blue-300 dark:border-blue-800',   bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-700 dark:text-blue-300',     chip: 'bg-blue-500'   },
};

const ConflictItem = ({ conflict }) => {
    const meta = SEVERITY_META[conflict.severity] || SEVERITY_META.info;
    const Icon = meta.icon;
    return (
        <div className={cn('rounded-lg border-2 p-3', meta.ring, meta.bg)}>
            <div className="flex items-start gap-3">
                <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', meta.text)} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn('font-semibold text-sm', meta.text)}>{conflict.title}</p>
                        <Badge variant="outline" className={cn('text-[10px] uppercase', meta.text)}>
                            {meta.label}
                        </Badge>
                    </div>
                    <p className="text-sm text-foreground/90 mt-1">{conflict.description}</p>
                    {conflict.fix && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
                            <Wrench className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span><span className="font-semibold">Fix:</span> {conflict.fix}</span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const ConflictAlertsPanel = ({ bookings = [], barns = [], rvAreas = [], showInfo }) => {
    const [open, setOpen] = useState(true);

    const conflicts = useMemo(
        () => detectConflicts({ bookings, barns, rvAreas, showInfo }),
        [bookings, barns, rvAreas, showInfo]
    );
    const counts = useMemo(() => summarizeConflicts(conflicts), [conflicts]);

    if (conflicts.length === 0) {
        return (
            <Card className="mb-6 border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                <CardContent className="p-4 flex items-center gap-3">
                    <ShieldCheck className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-300">All clear</p>
                        <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                            No conflicts or capacity issues detected. Bookings, stalls, and contacts look healthy.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const headerColor =
        counts.error > 0 ? 'border-red-300 bg-red-50 dark:bg-red-900/20' :
        counts.warning > 0 ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20' :
        'border-blue-300 bg-blue-50 dark:bg-blue-900/20';

    return (
        <Card className={cn('mb-6 border-2', headerColor)}>
            <CardContent className="p-4">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className="w-full flex items-center justify-between gap-3 text-left"
                >
                    <div className="flex items-center gap-3">
                        <AlertTriangle className={cn('h-5 w-5', counts.error > 0 ? 'text-red-600' : counts.warning > 0 ? 'text-amber-600' : 'text-blue-600')} />
                        <p className="font-semibold">
                            {counts.total} issue{counts.total !== 1 ? 's' : ''} detected
                        </p>
                        <div className="flex gap-1.5">
                            {counts.error > 0 && (
                                <Badge className="bg-red-500 text-white text-xs">{counts.error} critical</Badge>
                            )}
                            {counts.warning > 0 && (
                                <Badge className="bg-amber-500 text-white text-xs">{counts.warning} warning</Badge>
                            )}
                            {counts.info > 0 && (
                                <Badge className="bg-blue-500 text-white text-xs">{counts.info} info</Badge>
                            )}
                        </div>
                    </div>
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                <AnimatePresence initial={false}>
                    {open && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-3 space-y-2">
                                {conflicts.map(c => (
                                    <ConflictItem key={c.id} conflict={c} />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
};

export default ConflictAlertsPanel;
