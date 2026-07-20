import React, { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const DueDateDialog = ({ open, onClose, currentDate, onSaveDate }) => {
    const [selectedDate, setSelectedDate] = useState(currentDate ? new Date(currentDate) : undefined);

    const handleSave = () => {
        onSaveDate(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[320px]">
                <DialogHeader>
                    <DialogTitle>Edit Due Date</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">Due Date</p>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !selectedDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    initialFocus
                                    className={cn("p-3 pointer-events-auto")}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setSelectedDate(undefined)}>
                            Clear
                        </Button>
                        <Button className="flex-1" onClick={handleSave}>
                            Save
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DueDateDialog;
