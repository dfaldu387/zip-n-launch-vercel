import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Home, AlertCircle, MapPin, Building2, Award, Stethoscope, CircleDot, HeartHandshake, Plus, X, Clock } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { useState } from 'react';

const PRESET_LOCATIONS = [
    { id: 'show-office', name: 'Show Office', icon: Building2 },
    { id: 'awards-room', name: 'Awards Room', icon: Award },
    { id: 'vet-area', name: 'Vet Area', icon: Stethoscope },
    { id: 'warmup-ring', name: 'Warmup Ring', icon: CircleDot },
    { id: 'volunteer-desk', name: 'Volunteer Desk', icon: HeartHandshake },
];

function getDateRange(startDate, endDate) {
    if (!startDate) return [];
    const start = parseLocalDate(startDate);
    const end = endDate ? parseLocalDate(endDate) : start;
    const dates = [];
    let current = start;
    while (current <= end) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
    }
    return dates;
}

function formatShortDate(dateStr) {
    const d = parseLocalDate(dateStr);
    return format(d, 'EEE, MMM d');
}

// --- Locations Section ---
const LocationsSection = ({ formData, setFormData }) => {
    const [customName, setCustomName] = useState('');
    const locations = formData.locations || [];
    const competitionDates = getDateRange(formData.startDate, formData.endDate);

    const togglePreset = (preset) => {
        setFormData(prev => {
            const existing = prev.locations || [];
            const found = existing.find(l => l.id === preset.id);
            if (found) {
                return { ...prev, locations: existing.filter(l => l.id !== preset.id) };
            }
            // Initialize with default hours for each competition day
            const hours = {};
            competitionDates.forEach(d => {
                hours[d] = { open: '08:00', close: '18:00' };
            });
            return { ...prev, locations: [...existing, { id: preset.id, name: preset.name, type: 'preset', hours }] };
        });
    };

    const addCustomLocation = () => {
        const trimmed = customName.trim();
        if (!trimmed) return;
        const id = `loc-${Date.now()}`;
        const hours = {};
        competitionDates.forEach(d => {
            hours[d] = { open: '08:00', close: '18:00' };
        });
        setFormData(prev => ({
            ...prev,
            locations: [...(prev.locations || []), { id, name: trimmed, type: 'custom', hours }],
        }));
        setCustomName('');
    };

    const removeLocation = (id) => {
        setFormData(prev => ({
            ...prev,
            locations: (prev.locations || []).filter(l => l.id !== id),
        }));
    };

    const renameLocation = (id, name) => {
        setFormData(prev => ({
            ...prev,
            locations: (prev.locations || []).map(l => l.id === id ? { ...l, name } : l),
        }));
    };

    const updateLocationHours = (locId, dateStr, field, value) => {
        setFormData(prev => ({
            ...prev,
            locations: (prev.locations || []).map(l => {
                if (l.id !== locId) return l;
                const hours = { ...(l.hours || {}) };
                hours[dateStr] = { ...(hours[dateStr] || { open: '08:00', close: '18:00' }), [field]: value };
                return { ...l, hours };
            }),
        }));
    };

    const activePresetIds = new Set(locations.filter(l => l.type === 'preset').map(l => l.id));
    const customLocations = locations.filter(l => l.type === 'custom');
    const activeLocations = locations.filter(l => activePresetIds.has(l.id) || l.type === 'custom');

    return (
        <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Show Locations</h3>
            </div>
            <p className="text-sm text-muted-foreground">Add locations for staff assignment. These are non-competition areas like offices and support stations.</p>

            {/* Preset toggles */}
            <div className="flex flex-wrap gap-2">
                {PRESET_LOCATIONS.map(preset => {
                    const Icon = preset.icon;
                    const active = activePresetIds.has(preset.id);
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => togglePreset(preset)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                                ${active
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-foreground border-border hover:bg-accent'
                                }`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {preset.name}
                        </button>
                    );
                })}
            </div>

            {/* Active locations with hours */}
            {activeLocations.length > 0 && competitionDates.length > 0 && (
                <div className="space-y-3">
                    {activeLocations.map(loc => {
                        const preset = PRESET_LOCATIONS.find(p => p.id === loc.id);
                        const Icon = preset ? preset.icon : MapPin;
                        const locHours = loc.hours || {};
                        return (
                            <div key={loc.id} className="rounded-lg border bg-background p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-primary shrink-0" />
                                    {loc.type === 'custom' ? (
                                        <Input
                                            className="h-8 text-sm font-medium flex-1"
                                            value={loc.name}
                                            onChange={(e) => renameLocation(loc.id, e.target.value)}
                                        />
                                    ) : (
                                        <span className="text-sm font-medium flex-1">{loc.name}</span>
                                    )}
                                    {loc.type === 'custom' && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeLocation(loc.id)}>
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                                <div className="grid gap-2 pl-6">
                                    {competitionDates.map(dateStr => {
                                        const dayHours = locHours[dateStr] || { open: '08:00', close: '18:00' };
                                        return (
                                            <div key={dateStr} className="flex items-center gap-3 text-sm">
                                                <span className="text-muted-foreground w-28 shrink-0">{formatShortDate(dateStr)}</span>
                                                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                <div className="flex items-center gap-1.5">
                                                    <Label className="text-xs text-muted-foreground">Open</Label>
                                                    <Input
                                                        type="time"
                                                        className="h-7 w-28 text-xs"
                                                        value={dayHours.open}
                                                        onChange={(e) => updateLocationHours(loc.id, dateStr, 'open', e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Label className="text-xs text-muted-foreground">Close</Label>
                                                    <Input
                                                        type="time"
                                                        className="h-7 w-28 text-xs"
                                                        value={dayHours.close}
                                                        onChange={(e) => updateLocationHours(loc.id, dateStr, 'close', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add custom location */}
            <div className="flex gap-2">
                <Input
                    className="h-9 text-sm"
                    placeholder="Add custom location (e.g., Parking Lot, First Aid)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomLocation())}
                />
                <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={addCustomLocation} disabled={!customName.trim()}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
            </div>
        </div>
    );
};

export const Step3_ArenasAndDates = ({ formData, setFormData, stepNumber = 3, stepTitle = 'Arenas & Dates of Use' }) => {
    const competitionDates = getDateRange(formData.startDate, formData.endDate);
    const arenas = formData.arenas || [];

    const addArena = () => {
        setFormData(prev => ({
            ...prev,
            arenas: [...(prev.arenas || []), { id: `arena-${Date.now()}`, name: '', dates: [...competitionDates] }],
        }));
    };

    const removeArena = (id) => {
        setFormData(prev => ({
            ...prev,
            arenas: prev.arenas.filter(a => a.id !== id),
        }));
    };

    const handleNameChange = (id, name) => {
        setFormData(prev => ({
            ...prev,
            arenas: prev.arenas.map(a => a.id === id ? { ...a, name } : a),
        }));
    };

    const toggleDate = (arenaId, dateStr) => {
        setFormData(prev => ({
            ...prev,
            arenas: prev.arenas.map(a => {
                if (a.id !== arenaId) return a;
                const dates = a.dates || [];
                return {
                    ...a,
                    dates: dates.includes(dateStr)
                        ? dates.filter(d => d !== dateStr)
                        : [...dates, dateStr],
                };
            }),
        }));
    };

    // No dates set — show empty state
    if (competitionDates.length === 0) {
        return (
            <motion.div key="step3-arenas" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <CardHeader>
                    <CardTitle>{`Step ${stepNumber}: ${stepTitle}`}</CardTitle>
                    <CardDescription>Define which arenas are active on which competition days.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground font-medium">No competition dates set yet.</p>
                        <p className="text-sm text-muted-foreground mt-1">Go back to the previous step to set your start and end dates.</p>
                    </div>
                </CardContent>
            </motion.div>
        );
    }

    return (
        <motion.div key="step3-arenas" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>{`Step ${stepNumber}: ${stepTitle}`}</CardTitle>
                <CardDescription>Define which arenas are active on which competition days. This data will be used by the schedule builder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Competition dates summary */}
                <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-sm font-medium text-muted-foreground mr-1">Competition dates:</span>
                    {competitionDates.map(d => (
                        <Badge key={d} variant="secondary">{formatShortDate(d)}</Badge>
                    ))}
                </div>

                {/* Arena cards */}
                <div className="space-y-4">
                    {arenas.map((arena) => {
                        const arenaDates = arena.dates || [];
                        return (
                            <div key={arena.id} className="rounded-lg border bg-card p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Home className="h-5 w-5 text-primary shrink-0" />
                                    <Input
                                        className="font-semibold"
                                        placeholder="e.g., Main Arena"
                                        value={arena.name}
                                        onChange={(e) => handleNameChange(arena.id, e.target.value)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeArena(arena.id)}
                                        disabled={arenas.length <= 1}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-x-5 gap-y-2 pl-7">
                                    {competitionDates.map(dateStr => (
                                        <label key={dateStr} className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox
                                                checked={arenaDates.includes(dateStr)}
                                                onCheckedChange={() => toggleDate(arena.id, dateStr)}
                                            />
                                            <span className="text-sm">{formatShortDate(dateStr)}</span>
                                        </label>
                                    ))}
                                </div>
                                {arenaDates.length === 0 && (
                                    <p className="text-xs text-destructive pl-7 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" /> Select at least one date for this arena.
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Add arena button */}
                <Button variant="outline" onClick={addArena} className="w-full">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Arena
                </Button>

                {/* Show Locations for staff assignment */}
                <LocationsSection formData={formData} setFormData={setFormData} />
            </CardContent>
        </motion.div>
    );
};
