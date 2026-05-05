import React, { useMemo, useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

export const PatternFilter = ({ filters, setFilters }) => {
    const { toast } = useToast();
    const [associationsData, setAssociationsData] = useState([]);
    const [disciplineLibrary, setDisciplineLibrary] = useState([]);
    const [divisionsData, setDivisionsData] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            const { data: assocData, error: assocError } = await supabase.from('associations').select('*').order('name');
            if (assocError) {
                toast({ title: 'Error fetching associations', description: assocError.message, variant: 'destructive' });
            } else {
                setAssociationsData(assocData);
            }

            const { data: discData, error: discError } = await supabase.from('disciplines').select('*, discipline_associations(association_id)').order('sort_order');
            if (discError) {
                toast({ title: 'Error fetching disciplines', description: discError.message, variant: 'destructive' });
            } else {
                setDisciplineLibrary(discData.map(d => ({...d, associations: d.discipline_associations.map(da => da.association_id)})));
            }

            const { data: divData, error: divError } = await supabase.from('divisions').select('*, division_levels(*)').order('sort_order');
            if (divError) {
                toast({ title: 'Error fetching divisions', description: divError.message, variant: 'destructive' });
            } else {
                const structuredDivs = divData.reduce((acc, div) => {
                    if (!acc[div.association_id]) acc[div.association_id] = [];
                    acc[div.association_id].push({
                        group: div.name,
                        levels: div.division_levels.map(dl => dl.name).sort((a,b) => a.sort_order - b.sort_order)
                    });
                    return acc;
                }, {});
                setDivisionsData(structuredDivs);
            }
        };
        fetchData();
    }, [toast]);

    const handleAssociationChange = (id, checked) => {
        setFilters(prev => {
            const newAssocs = checked ? [...prev.associations, id] : prev.associations.filter(a => a !== id);
            return { ...prev, associations: newAssocs, disciplines: [], divisions: {} };
        });
    };

    const handleDisciplineChange = (name, checked) => {
        setFilters(prev => {
            const newDisciplines = checked ? [...prev.disciplines, name] : prev.disciplines.filter(c => c !== name);
            return { ...prev, disciplines: newDisciplines };
        });
    };

    const handleDivisionChange = (assocId, groupName, level, checked) => {
        setFilters(prev => {
            const key = `${assocId}-${groupName}`;
            const newDivisions = { ...prev.divisions };
            if (!newDivisions[key]) newDivisions[key] = [];

            if (checked) {
                if (!newDivisions[key].includes(level)) {
                    newDivisions[key].push(level);
                }
            } else {
                newDivisions[key] = newDivisions[key].filter(l => l !== level);
            }
            return { ...prev, divisions: newDivisions };
        });
    };

    const availableDisciplines = useMemo(() => {
        if (filters.associations.length === 0) return disciplineLibrary;
        return disciplineLibrary.filter(disc => (disc.associations || []).some(assocId => filters.associations.includes(assocId)));
    }, [filters.associations, disciplineLibrary]);
    
    const availableDivisions = useMemo(() => {
        if (filters.associations.length === 0) return [];
        return filters.associations.map(id => {
            const assoc = associationsData.find(a => a.id === id);
            return assoc ? { ...assoc, divisions: divisionsData[id] || [] } : null;
        }).filter(Boolean);
    }, [filters.associations, associationsData, divisionsData]);

    const selectAll = (type, list) => {
        setFilters(prev => ({...prev, [type]: list.map(item => item.id || item.name)}));
    };

    const clearAll = (type) => {
        setFilters(prev => ({...prev, [type]: [], ...(type === 'associations' && { disciplines: [], divisions: {} })}));
    };
    
    return (
        <Accordion type="multiple" defaultValue={['associations', 'disciplines']} className="w-full">
            <AccordionItem value="associations">
                <AccordionTrigger className="text-lg font-semibold">Filter by Association</AccordionTrigger>
                <AccordionContent>
                    <div className="flex gap-2 mb-2">
                        <Button variant="link" size="sm" onClick={() => selectAll('associations', associationsData.filter(a => !a.is_group))}>Select All</Button>
                        <Button variant="link" size="sm" onClick={() => clearAll('associations')}>Clear All</Button>
                    </div>
                    <ScrollArea className="h-48">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 p-1">
                            {associationsData.filter(a => !a.is_group).map(assoc => (
                                <div key={assoc.id} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`assoc-filter-${assoc.id}`} 
                                        checked={filters.associations.includes(assoc.id)}
                                        onCheckedChange={c => handleAssociationChange(assoc.id, c)}
                                    />
                                    <Label htmlFor={`assoc-filter-${assoc.id}`} className="font-normal text-sm cursor-pointer">{assoc.name}</Label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="disciplines">
                <AccordionTrigger className="text-lg font-semibold">Filter by Discipline</AccordionTrigger>
                <AccordionContent>
                     <div className="flex gap-2 mb-2">
                        <Button variant="link" size="sm" onClick={() => selectAll('disciplines', availableDisciplines)}>Select All</Button>
                        <Button variant="link" size="sm" onClick={() => clearAll('disciplines')}>Clear All</Button>
                    </div>
                    <ScrollArea className="h-48">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 p-1">
                            {availableDisciplines.map(disc => (
                                <div key={disc.name} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`discipline-filter-${disc.name.replace(/\s/g, '-')}`} 
                                        checked={filters.disciplines.includes(disc.name)}
                                        onCheckedChange={c => handleDisciplineChange(disc.name, c)}
                                    />
                                    <Label htmlFor={`discipline-filter-${disc.name.replace(/\s/g, '-')}`} className="font-normal text-sm cursor-pointer">{disc.name}</Label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="divisions">
                <AccordionTrigger className="text-lg font-semibold">Filter by Division (Advanced)</AccordionTrigger>
                <AccordionContent>
                    {availableDivisions.length > 0 ? (
                        <ScrollArea className="h-48 space-y-4">
                            {availableDivisions.map(assoc => (
                                <div key={assoc.id} className="mb-3">
                                    <h4 className="font-medium mb-1">{assoc.name}</h4>
                                    {(assoc.divisions || []).map(group => (
                                        <div key={group.group} className="ml-2">
                                            <p className="text-sm text-muted-foreground mt-1">{group.group}</p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                                                {group.levels.map(level => {
                                                     const key = `${assoc.id}-${group.group}`;
                                                     return (
                                                        <div key={level} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`div-filter-${assoc.id}-${level}`}
                                                                checked={filters.divisions[key]?.includes(level) || false}
                                                                onCheckedChange={(c) => handleDivisionChange(assoc.id, group.group, level, c)}
                                                            />
                                                            <Label htmlFor={`div-filter-${assoc.id}-${level}`} className="font-normal text-xs">{level}</Label>
                                                        </div>
                                                     )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-muted-foreground">Select an association to see available divisions.</p>
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};