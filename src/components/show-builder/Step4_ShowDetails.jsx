import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn, parseLocalDate } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';

// ─── Main Component ──────────────────────────────────────────────
export const Step4_ShowDetails = ({ formData, setFormData }) => {
    const handleUpdate = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleDateChange = (field, date) => {
        if (date) {
            handleUpdate(field, format(date, 'yyyy-MM-dd'));
        }
    };

    return (
        <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 4: Show Details</CardTitle>
                <CardDescription>Enter essential information and define venues for your event. This will be used to populate your show bill and configure the schedule builder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="showName">Show Name</Label>
                        <Input id="showName" value={formData.showName || ''} onChange={(e) => handleUpdate('showName', e.target.value)} placeholder="E.g., Summer Sizzler" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Start Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-left font-normal", !formData.startDate && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.startDate ? format(parseLocalDate(formData.startDate), "MMMM do, yyyy") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={formData.startDate ? parseLocalDate(formData.startDate) : undefined}
                                        onSelect={(date) => handleDateChange('startDate', date)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div>
                            <Label>End Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-left font-normal", !formData.endDate && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.endDate ? format(parseLocalDate(formData.endDate), "MMMM do, yyyy") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={formData.endDate ? parseLocalDate(formData.endDate) : undefined}
                                        onSelect={(date) => handleDateChange('endDate', date)}
                                        disabled={{ before: formData.startDate ? parseLocalDate(formData.startDate) : undefined }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="venueName">Venue Name</Label>
                        <Input id="venueName" value={formData.venueName || ''} onChange={(e) => handleUpdate('venueName', e.target.value)} placeholder="E.g., Grand Oak Arena" />
                    </div>
                    <div>
                        <Label htmlFor="venueAddress">Venue Address</Label>
                        <Input id="venueAddress" value={formData.venueAddress || ''} onChange={(e) => handleUpdate('venueAddress', e.target.value)} placeholder="E.g., 123 Stable Rd, City, State" />
                    </div>
                </div>
            </CardContent>
        </motion.div>
    );
};
