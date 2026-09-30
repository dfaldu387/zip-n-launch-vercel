import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn, parseLocalDate } from '@/lib/utils';
import { Calendar as CalendarIcon, ArrowRight, Loader2 } from 'lucide-react';
import { validateShowDetails } from '@/lib/housingNewShow';

const DatePickerField = ({ label, value, onChange, disabledBefore, error }) => (
    <div>
        <Label>{label}</Label>
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground', error && 'border-destructive')}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value ? format(parseLocalDate(value), 'MMMM do, yyyy') : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={value ? parseLocalDate(value) : undefined}
                    onSelect={(date) => date && onChange(format(date, 'yyyy-MM-dd'))}
                    disabled={disabledBefore ? { before: parseLocalDate(disabledBefore) } : undefined}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
);

// First page of Housing & Grounds when no existing show is linked: just the
// basic show details. Next creates the show and opens the housing setup.
export const HousingShowDetailsStep = ({ onCreate, isCreating }) => {
    const [details, setDetails] = useState({ showName: '', startDate: '', endDate: '', venueName: '', venueAddress: '' });
    const [showErrors, setShowErrors] = useState(false);
    const errors = validateShowDetails(details);
    const set = (key, value) => setDetails(prev => ({ ...prev, [key]: value }));

    const handleNext = () => {
        if (Object.keys(errors).length > 0) { setShowErrors(true); return; }
        onCreate(details);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Show Details</CardTitle>
                <CardDescription>
                    Enter the basic details of your event to start building housing and grounds. You can also link an existing show above instead.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="hg-showName">Show Name</Label>
                        <Input
                            id="hg-showName"
                            value={details.showName}
                            onChange={(e) => set('showName', e.target.value)}
                            placeholder="E.g., Summer Sizzler"
                            className={cn(showErrors && errors.showName && 'border-destructive')}
                        />
                        {showErrors && errors.showName && <p className="text-xs text-destructive mt-1">{errors.showName}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <DatePickerField label="Start Date" value={details.startDate} onChange={(v) => set('startDate', v)} error={showErrors ? errors.startDate : null} />
                        <DatePickerField label="End Date" value={details.endDate} onChange={(v) => set('endDate', v)} disabledBefore={details.startDate} error={showErrors ? errors.endDate : null} />
                    </div>
                    <div>
                        <Label htmlFor="hg-venueName">Venue Name</Label>
                        <Input id="hg-venueName" value={details.venueName} onChange={(e) => set('venueName', e.target.value)} placeholder="E.g., Grand Oak Arena" />
                    </div>
                    <div>
                        <Label htmlFor="hg-venueAddress">Venue Address</Label>
                        <Input id="hg-venueAddress" value={details.venueAddress} onChange={(e) => set('venueAddress', e.target.value)} placeholder="E.g., 123 Stable Rd, City, State" />
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button type="button" onClick={handleNext} disabled={isCreating}>
                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default HousingShowDetailsStep;
