import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { JudgesAndStaff } from '@/components/pbb/JudgesAndStaff';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Home } from 'lucide-react';

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

export const Step3_ShowDetails = ({ formData, setFormData }) => {
  const handleUpdate = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const selectedAssociationIds = Object.keys(formData.associations);

  return (
    <motion.div key="step4" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader>
        <CardTitle>Step 4: Show Details</CardTitle>
        <CardDescription>Enter the essential information for your event. This will be used to populate your show bill and configure the schedule builder.</CardDescription>
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
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input id="startDate" type="date" value={formData.startDate || ''} onChange={(e) => handleUpdate('startDate', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="endDate">End Date</Label>
                            <Input id="endDate" type="date" value={formData.endDate || ''} onChange={(e) => handleUpdate('endDate', e.target.value)} />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
                 <AccordionTrigger className="text-lg font-semibold">Judges & Staff</AccordionTrigger>
                 <AccordionContent className="pt-4">
                    <JudgesAndStaff
                        formData={formData}
                        setFormData={setFormData}
                        selectedAssociationIds={selectedAssociationIds}
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