import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Home, User, Mail, Phone, UserSquare } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn, parseLocalDate } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';
import { JudgesAndStaff } from '@/components/pbb/JudgesAndStaff';

const ArenaManager = ({ arenas, setFormData }) => {
    const handleArenaChange = (id, newName) => {
        setFormData(prev => ({
            ...prev,
            arenas: prev.arenas.map(arena => arena.id === id ? { ...arena, name: newName } : arena)
        }));
    };

    const addArena = () => {
        setFormData(prev => ({
            ...prev,
            arenas: [...(prev.arenas || []), { id: `arena-${Date.now()}`, name: '' }]
        }));
    };

    const removeArena = (id) => {
        setFormData(prev => ({
            ...prev,
            arenas: prev.arenas.filter(arena => arena.id !== id)
        }));
    };

    return (
        <div className="space-y-4 rounded-lg border p-4">
            <h4 className="font-semibold flex items-center"><Home className="mr-2 h-5 w-5 text-primary" /> Arenas / Rings</h4>
            <div className="space-y-2">
                {(arenas || []).map(arena => (
                    <div key={arena.id} className="flex items-center gap-2">
                        <Input
                            placeholder="E.g., Main Arena"
                            value={arena.name}
                            onChange={(e) => handleArenaChange(arena.id, e.target.value)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeArena(arena.id)} disabled={(arenas || []).length <= 1}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
            </div>
            <Button variant="outline" size="sm" onClick={addArena} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Arena
            </Button>
        </div>
    );
};

const SimpleStaffStep = ({ formData, setFormData }) => {
    
    const handleContactChange = (role, field, value) => {
        setFormData(prev => ({
            ...prev,
            showDetails: {
                ...prev.showDetails,
                [role]: {
                    ...(prev.showDetails?.[role] || {}),
                    [field]: value,
                }
            }
        }));
    };

    const selectedAssociationIds = Object.keys(formData.associations || {});

    return (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-background/50">
                <h4 className="font-semibold text-lg mb-4 flex items-center"><UserSquare className="mr-2 h-5 w-5 text-primary" /> Key Contacts</h4>
                <div className="space-y-4">
                    <div>
                        <Label>Show Manager</Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                            <Input value={formData.showDetails?.showManager?.name || ''} onChange={(e) => handleContactChange('showManager', 'name', e.target.value)} placeholder="Name" />
                            <Input type="tel" value={formData.showDetails?.showManager?.phone || ''} onChange={(e) => handleContactChange('showManager', 'phone', e.target.value)} placeholder="Phone" />
                            <Input type="email" value={formData.showDetails?.showManager?.email || ''} onChange={(e) => handleContactChange('showManager', 'email', e.target.value)} placeholder="Email" />
                        </div>
                    </div>
                     <div>
                        <Label>Show Secretary</Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                            <Input value={formData.showDetails?.showSecretary?.name || ''} onChange={(e) => handleContactChange('showSecretary', 'name', e.target.value)} placeholder="Name" />
                            <Input type="tel" value={formData.showDetails?.showSecretary?.phone || ''} onChange={(e) => handleContactChange('showSecretary', 'phone', e.target.value)} placeholder="Phone" />
                            <Input type="email" value={formData.showDetails?.showSecretary?.email || ''} onChange={(e) => handleContactChange('showSecretary', 'email', e.target.value)} placeholder="Email" />
                        </div>
                    </div>
                </div>
            </div>
            <JudgesAndStaff
                formData={formData}
                setFormData={setFormData}
                selectedAssociationIds={selectedAssociationIds}
                isClinicMode={false}
                isEducationMode={false}
            />
        </div>
    );
};

export const Step5_ShowDetails = ({ formData, setFormData }) => {
    const handleUpdate = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleDateChange = (field, date) => {
        if (date) {
            handleUpdate(field, format(date, 'yyyy-MM-dd'));
        }
    };
    
    return (
        <motion.div key="step4" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 4: Show Details</CardTitle>
                <CardDescription>Enter essential information, define venues, and assign staff for your event. This will be used to populate your show bill and configure the schedule builder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger className="text-lg font-semibold">Event Information</AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="showName">Show Name</Label>
                                    <Input id="showName" value={formData.showName || ''} onChange={(e) => handleUpdate('showName', e.target.value)} placeholder="E.g., Summer Sizzler" />
                                </div>
                                <div>
                                    <Label htmlFor="venueAddress">Venue Name & Address</Label>
                                    <Input id="venueAddress" value={formData.venueAddress || ''} onChange={(e) => handleUpdate('venueAddress', e.target.value)} placeholder="E.g., Grand Oak Arena, 123 Stable Rd" />
                                </div>
                                <div>
                                    <Label>Start Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                              variant={"outline"}
                                              className={cn("w-full justify-start text-left font-normal", !formData.startDate && "text-muted-foreground")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formData.startDate ? format(parseLocalDate(formData.startDate), "PPP") : <span>Pick a date</span>}
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
                                                {formData.endDate ? format(parseLocalDate(formData.endDate), "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                              mode="single"
                                              selected={formData.endDate ? parseLocalDate(formData.endDate) : undefined}
                                              onSelect={(date) => handleDateChange('endDate', date)}
                                              initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger className="text-lg font-semibold">Judges & Staff</AccordionTrigger>
                        <AccordionContent className="pt-4">
                            <SimpleStaffStep
                                formData={formData}
                                setFormData={setFormData}
                            />
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                        <AccordionTrigger className="text-lg font-semibold">Venue Setup</AccordionTrigger>
                        <AccordionContent className="pt-4">
                            <ArenaManager arenas={formData.arenas} setFormData={setFormData} />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </motion.div>
    );
};