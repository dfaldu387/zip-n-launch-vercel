import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Warehouse, DollarSign } from 'lucide-react';
import HousingCalendarPanel from './HousingCalendarPanel';
import HousingFinancialCalendar from './HousingFinancialCalendar';

// Robert 2026-11-16: two calendars under one Calendar tab —
// "Operations" (what is on the grounds) and "Orders & Financial" (orders, sales, payments).
// Operations + Orders & Financial calendars.

const CALENDARS = [
    { id: 'operations', label: 'Operations', icon: Warehouse },
    { id: 'financial', label: 'Orders & Financial', icon: DollarSign },
];

const STORAGE_KEY = 'housing-calendar-kind';

const readSaved = () => {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return CALENDARS.some((c) => c.id === v) ? v : 'operations';
    } catch { return 'operations'; }
};

export default function HousingCalendarSwitch(props) {
    const [kind, setKind] = useState(readSaved);

    const choose = (id) => {
        setKind(id);
        try { localStorage.setItem(STORAGE_KEY, id); } catch { /* per-viewer convenience only */ }
    };

    return (
        <div className="space-y-4">
            <div className="inline-flex rounded-md border p-0.5 bg-muted/40 print:hidden" role="tablist" aria-label="Calendar type">
                {CALENDARS.map(({ id, label, icon: Icon }) => (
                    <Button
                        key={id}
                        size="sm"
                        role="tab"
                        aria-selected={kind === id}
                        variant={kind === id ? 'default' : 'ghost'}
                        className="h-9 text-sm"
                        onClick={() => choose(id)}
                    >
                        <Icon className="h-4 w-4 mr-1.5" /> {label}
                    </Button>
                ))}
            </div>

            {kind === 'operations' ? (
                <HousingCalendarPanel {...props} />
            ) : (
                <HousingFinancialCalendar {...props} />
            )}
        </div>
    );
}
