import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn, parseLocalDate } from '@/lib/utils';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { OfficialsStaffSection } from '@/components/shared/OfficialsStaffSection';

export const Step3_Details = ({ formData, setFormData, isClinicMode = false, isEducationMode = false, purposeName = null, stepNumber = 4, isReadOnly = false }) => {
  const handleUpdate = (key, value) => {
    if (isReadOnly) return;
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Determine mode based on props
  const mode = purposeName ? 'custom' : isClinicMode ? 'clinic' : isEducationMode ? 'education' : 'show';

  // Dynamic title based on purposeName or mode
  const getTitle = () => {
    if (purposeName) return `${purposeName} Details`;
    return {
      show: 'Show Details',
      clinic: 'Clinic Details',
      education: 'Lesson Details'
    }[mode];
  };

  const descriptions = {
    show: "Enter the essential information for your event. This will be used to populate your pattern book.",
    clinic: "Enter the essential information for your clinic. This will be used to populate your materials.",
    education: "Enter details for your lesson plan or educational materials. This information is optional.",
    custom: "Enter the essential information for your event. This will be used to populate your materials."
  };

  const infoTriggers = {
    show: 'Event Information',
    clinic: 'Clinic Information',
    education: 'Lesson Information',
    custom: 'Event Information'
  };

  const nameLabels = {
    show: 'Show Name',
    clinic: 'Clinic Name',
    education: 'Lesson/Topic Name',
    custom: purposeName ? `${purposeName} Name` : 'Event Name'
  };
  
  const namePlaceholders = {
    show: "E.g., Summer Sizzler",
    clinic: "E.g., Summer Horsemanship Clinic",
    education: "E.g., Introduction to Showmanship",
    custom: "E.g., Summer Sizzler"
  };

  return (
    <motion.div key="step4" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Step {stepNumber}: {getTitle()}</CardTitle>
        <CardDescription className="text-sm">{descriptions[mode]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Accordion type="multiple" defaultValue={['item-1', 'item-2']} className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger className="text-base font-semibold">{infoTriggers[mode]}</AccordionTrigger>
                <AccordionContent className="pt-3 space-y-3">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="showName">{nameLabels[mode]}</Label>
                            <Input id="showName" value={formData.showName} onChange={(e) => handleUpdate('showName', e.target.value)} placeholder={namePlaceholders[mode]} disabled={isReadOnly} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="startDate">Start Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !formData.startDate && "text-muted-foreground"
                                            )}
                                            disabled={isReadOnly}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {formData.startDate ? format(parseLocalDate(formData.startDate), "MMMM do, yyyy") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    {!isReadOnly && (
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={formData.startDate ? parseLocalDate(formData.startDate) : null}
                                                onSelect={(date) => handleUpdate('startDate', date ? format(date, 'yyyy-MM-dd') : null)}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    )}
                                </Popover>
                            </div>
                            <div>
                                <Label htmlFor="endDate">End Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !formData.endDate && "text-muted-foreground"
                                            )}
                                            disabled={isReadOnly}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {formData.endDate ? format(parseLocalDate(formData.endDate), "MMMM do, yyyy") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    {!isReadOnly && (
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={formData.endDate ? parseLocalDate(formData.endDate) : null}
                                                onSelect={(date) => handleUpdate('endDate', date ? format(date, 'yyyy-MM-dd') : null)}
                                                disabled={{ before: formData.startDate ? parseLocalDate(formData.startDate) : null }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    )}
                                </Popover>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="venueName">Venue Name</Label>
                            <Input id="venueName" value={formData.venueName} onChange={(e) => handleUpdate('venueName', e.target.value)} placeholder="E.g., Grand Oak Arena" disabled={isReadOnly} />
                        </div>
                        <div>
                            <Label htmlFor="venueAddress">Venue Address</Label>
                            <Input id="venueAddress" value={formData.venueAddress} onChange={(e) => handleUpdate('venueAddress', e.target.value)} placeholder="E.g., 123 Stable Rd, City, State" disabled={isReadOnly} />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
                <AccordionTrigger className="text-base font-semibold">Officials & Staff</AccordionTrigger>
                <AccordionContent className="pt-3">
                    <OfficialsStaffSection
                        formData={formData}
                        setFormData={setFormData}
                    />
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </CardContent>
    </motion.div>
  );
};