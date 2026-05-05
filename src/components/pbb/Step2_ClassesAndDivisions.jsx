import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PlusCircle, Lock, Search, Loader2, ListPlus, Construction } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getAssociationLogo, getDefaultAssociationIcon } from '@/lib/associationsData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';

const DisciplineCheckboxWithDualApproved = ({ disc, selectedDisciplineKeys, onDisciplineToggle, getDisciplineKey, dualApprovedAssociations, dualApprovedSelections, onDualApprovedToggle, displayName, vrhRanchCowWorkOptions, selectedVrhRanchCowWork, onVrhRanchCowWorkSelect, maxReached = false }) => {
    const isSelected = selectedDisciplineKeys.has(getDisciplineKey(disc));
    const disciplineKey = getDisciplineKey(disc);
    const isDisabled = !isSelected && maxReached;

    // Check if this is VRH-RHC Ranch CowWork for AQHA
    const showVrhRanchCowWorkDropdown = isSelected &&
        (disc.name === 'VRH-RHC Ranch CowWork' || disc.name === 'Ranch Cow Work') &&
        disc.association_id === 'AQHA' &&
        vrhRanchCowWorkOptions &&
        vrhRanchCowWorkOptions.length > 0;

    return (
        <div className="space-y-1">
            <div className="flex items-center space-x-2">
                <Checkbox
                    id={`disc-${disc.id}`}
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => onDisciplineToggle(disc, checked)}
                />
                <Label htmlFor={`disc-${disc.id}`} className="font-normal cursor-pointer text-sm">
                    {displayName || disc.name}
                </Label>
            </div>
            {/* VRH-RHC Ranch CowWork Multiple Selection */}
            {showVrhRanchCowWorkDropdown && (
                <div className="ml-6 mt-2 space-y-2">
                    <Label className="text-xs text-muted-foreground">Select Scoresheet</Label>
                    <div className="space-y-1.5">
                        {vrhRanchCowWorkOptions.map(option => {
                            const isSelected = Array.isArray(selectedVrhRanchCowWork) 
                                ? selectedVrhRanchCowWork.includes(option.value)
                                : selectedVrhRanchCowWork === option.value;
                            return (
                                <div key={option.value} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`vrh-${disciplineKey}-${option.value}`}
                                        checked={isSelected}
                                        onCheckedChange={(checked) => onVrhRanchCowWorkSelect(disciplineKey, option.value, checked)}
                                    />
                                    <Label 
                                        htmlFor={`vrh-${disciplineKey}-${option.value}`} 
                                        className="text-xs font-normal cursor-pointer"
                                    >
                                        {option.label}
                                    </Label>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {isSelected && dualApprovedAssociations && dualApprovedAssociations.length > 0 && (
                <div className="ml-6 mt-1 space-y-1">
                    <span className="text-xs text-muted-foreground">Dual-Approved With:</span>
                    {dualApprovedAssociations.map(assocId => (
                        <div key={assocId} className="flex items-center space-x-2 ml-2">
                            <Checkbox
                                id={`dual-${disc.id}-${assocId}`}
                                checked={dualApprovedSelections?.[disciplineKey]?.[assocId] || false}
                                onCheckedChange={(checked) => onDualApprovedToggle(disciplineKey, assocId, checked)}
                                className="h-3 w-3"
                            />
                            <Label htmlFor={`dual-${disc.id}-${assocId}`} className="font-normal cursor-pointer text-xs text-muted-foreground">
                                {assocId}
                            </Label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const AQHACustomPatternCategory = ({ title, disciplines, selectedDisciplineKeys, onDisciplineToggle, associationId, getDisciplineKey, dualApprovedAssociations, dualApprovedSelections, onDualApprovedToggle, vrhRanchCowWorkOptions, vrhRanchCowWorkSelections, onVrhRanchCowWorkSelect, onAddCustomDiscipline, maxReached = false, comingSoon = false }) => {
    // Define the custom 3-column layout based on association
    let leftColumn, middleColumn, rightColumn;
    
    if (associationId === 'ApHC') {
        leftColumn = ['Showmanship at Halter', 'Western Horsemanship', 'Bareback Horsemanship', 'Hunt Seat Equitation'];
        middleColumn = ['Trail', 'Ranch Trail'];
        rightColumn = ['Equitation Over Fences', 'Working Hunter', 'Hunter Hack', 'Jumping'];
    } else if (associationId === 'ABRA') {
        leftColumn = ['Showmanship at Halter', 'Western Horsemanship', 'Hunt Seat Equitation'];
        middleColumn = ['Trail', 'Ranch Trail'];
        rightColumn = ['Hunter Hack', 'Working Hunter', 'Equitation Over Fences', 'Jumping'];
    } else if (associationId === 'PtHA') {
        leftColumn = ['Showmanship at Halter', 'Western Horsemanship', 'Hunt Seat Equitation'];
        middleColumn = ['Trail', 'In-Hand Trail', 'Ranch Trail'];
        rightColumn = ['Hunter Hack', 'Working Hunter', 'Equitation Over Fences', 'Jumping'];
    } else {
        // AQHA/APHA layout
        leftColumn = ['Showmanship at Halter', 'Horsemanship', 'Hunt Seat Equitation'];
        middleColumn = ['Trail', 'In-Hand Trail', 'Ranch Trail', 'VRH-RHC Ranch Trail'];
        rightColumn = ['Hunter Hack', 'Working Hunter', 'Equitation Over Fences', 'Jumping', 'English Versatility', 'Western Versatility'];
    }

    const getDisciplinesByNames = (names) => {
        return names.map(name => disciplines.find(d => d.name === name)).filter(Boolean);
    };

    // Get custom disciplines (those not in predefined columns)
    const allPredefinedNames = [...leftColumn, ...middleColumn, ...rightColumn];
    const customDisciplines = disciplines.filter(d => !allPredefinedNames.includes(d.name));

    const leftDisciplines = getDisciplinesByNames(leftColumn);
    const middleDisciplines = getDisciplinesByNames(middleColumn);
    const rightDisciplines = getDisciplinesByNames(rightColumn);

    const renderDisc = (disc) => {
        const disciplineKey = getDisciplineKey(disc);
        const selectedVrhRanchCowWork = vrhRanchCowWorkSelections?.[disciplineKey];
        return (
            <DisciplineCheckboxWithDualApproved
                key={disc.id}
                disc={disc}
                selectedDisciplineKeys={selectedDisciplineKeys}
                onDisciplineToggle={onDisciplineToggle}
                getDisciplineKey={getDisciplineKey}
                dualApprovedAssociations={dualApprovedAssociations}
                dualApprovedSelections={dualApprovedSelections}
                onDualApprovedToggle={onDualApprovedToggle}
                displayName={disc.name.replace(' at Halter', '')}
                vrhRanchCowWorkOptions={vrhRanchCowWorkOptions}
                selectedVrhRanchCowWork={selectedVrhRanchCowWork}
                onVrhRanchCowWorkSelect={onVrhRanchCowWorkSelect}
                maxReached={maxReached}
            />
        );
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1.5">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    {title}
                    {comingSoon && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-300">
                            <Construction className="h-3 w-3 mr-0.5" />
                            Coming Soon
                        </Badge>
                    )}
                </h4>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onAddCustomDiscipline(associationId)}
                >
                    <PlusCircle className="mr-1 h-3 w-3" /> Add Custom
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-1.5">
                {/* Left Column */}
                <div className="space-y-2">
                    {leftDisciplines.map(renderDisc)}
                </div>

                {/* Middle Column */}
                <div className="space-y-2">
                    {middleDisciplines.map(renderDisc)}
                </div>

                {/* Right Column */}
                <div className="space-y-2">
                    {rightDisciplines.map(renderDisc)}
                </div>
            </div>
            {/* Custom Disciplines Row */}
            {customDisciplines.length > 0 && (
                <div className="mt-3 px-1.5">
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Custom Disciplines</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {customDisciplines.map(renderDisc)}
                    </div>
                </div>
            )}
        </div>
    );
};

const DisciplineCategory = ({ title, description, disciplines, selectedDisciplineKeys, onDisciplineToggle, getDisciplineKey, dualApprovedAssociations, dualApprovedSelections, onDualApprovedToggle, vrhRanchCowWorkOptions, vrhRanchCowWorkSelections, onVrhRanchCowWorkSelect, onAddCustomDiscipline, associationId, showAddButton, maxReached = false, addButtonLabel = 'Add Custom', disciplineGroup = 'custom_patterns', comingSoon = false }) => {
    const showEmptyWithButton = disciplines.length === 0 && showAddButton;
    if (disciplines.length === 0 && !showAddButton) return null;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1.5">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    {title}
                    {comingSoon && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-300">
                            <Construction className="h-3 w-3 mr-0.5" />
                            Coming Soon
                        </Badge>
                    )}
                </h4>
                {showAddButton && onAddCustomDiscipline && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onAddCustomDiscipline(associationId, disciplineGroup)}
                    >
                        <PlusCircle className="mr-1 h-3 w-3" /> {addButtonLabel}
                    </Button>
                )}
            </div>
            {showEmptyWithButton ? (
                <p className="text-xs text-muted-foreground px-1.5">No disciplines yet. Click "{addButtonLabel}" to create one.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-1.5">
                    {disciplines.map(disc => {
                        const disciplineKey = getDisciplineKey(disc);
                        const selectedVrhRanchCowWork = vrhRanchCowWorkSelections?.[disciplineKey];
                        return (
                            <DisciplineCheckboxWithDualApproved
                                key={disc.id}
                                disc={disc}
                                selectedDisciplineKeys={selectedDisciplineKeys}
                                onDisciplineToggle={onDisciplineToggle}
                                getDisciplineKey={getDisciplineKey}
                                dualApprovedAssociations={dualApprovedAssociations}
                                dualApprovedSelections={dualApprovedSelections}
                                onDualApprovedToggle={onDualApprovedToggle}
                                vrhRanchCowWorkOptions={vrhRanchCowWorkOptions}
                                selectedVrhRanchCowWork={selectedVrhRanchCowWork}
                                onVrhRanchCowWorkSelect={onVrhRanchCowWorkSelect}
                                maxReached={maxReached}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// 4-H City Selector Component
const FourHCitySelector = ({ availableCities, selectedCity, onCityChange, association }) => {
    const logoUrl = getAssociationLogo(association);
    const Icon = getDefaultAssociationIcon(association);
    
    return (
        <AccordionItem value="4-H" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="text-base font-semibold hover:no-underline px-3 py-2 bg-muted/50">
                <div className="flex items-center gap-3">
                    {logoUrl ? (
                        <img src={logoUrl} alt={`${association.name} logo`} className="h-8 object-contain" />
                    ) : (
                        <Icon className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div className="flex flex-col items-start">
                        <span className="block">{association.name}</span>
                        {selectedCity && (
                            <span className="text-sm font-normal text-muted-foreground bg-primary/10 px-2 py-0.5 rounded">
                                {selectedCity}
                            </span>
                        )}
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 space-y-4">
                <div className="space-y-2">
                    <Label className="text-sm font-medium">Select City/State</Label>
                    <p className="text-xs text-muted-foreground">
                        4-H disciplines vary by location. Please select your city/state to view available disciplines.
                    </p>
                    <Select value={selectedCity || ''} onValueChange={onCityChange}>
                        <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder="Select a city/state..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableCities.map(city => (
                                <SelectItem key={city} value={city}>
                                    {city}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
};

const AssociationDisciplineGroup = ({ association, disciplines, selectedDisciplineKeys, onDisciplineToggle, subAssociationType, groupKey, getDisciplineKey, dualApprovedAssociations, dualApprovedSelections, onDualApprovedToggle, vrhRanchCowWorkOptions, vrhRanchCowWorkSelections, onVrhRanchCowWorkSelect, isOpenShowMode, onAddCustomDiscipline, selected4HCity, maxReached = false, showTimedAdditional = false }) => {
    const logoUrl = getAssociationLogo(association);
    const Icon = getDefaultAssociationIcon(association);

    // Select All logic
    const allKeys = useMemo(() => disciplines.map(d => getDisciplineKey(d)), [disciplines, getDisciplineKey]);
    const selectedCount = useMemo(() => allKeys.filter(k => selectedDisciplineKeys.has(k)).length, [allKeys, selectedDisciplineKeys]);
    const allChecked = allKeys.length > 0 && selectedCount === allKeys.length;
    const someChecked = selectedCount > 0 && selectedCount < allKeys.length;

    const handleSelectAll = useCallback((checked) => {
        disciplines.forEach(disc => {
            const key = getDisciplineKey(disc);
            const isSelected = selectedDisciplineKeys.has(key);
            if (checked && !isSelected) {
                onDisciplineToggle(disc, true);
            } else if (!checked && isSelected) {
                onDisciplineToggle(disc, false);
            }
        });
    }, [disciplines, getDisciplineKey, selectedDisciplineKeys, onDisciplineToggle]);

    const categorized = useMemo(() => {
        // Use discipline_group when available (e.g., Colorado 4-H), fall back to pattern_type
        const hasGroups = disciplines.some(d => d.discipline_group);

        if (hasGroups) {
            const custom = disciplines.filter(d => d.discipline_group === 'custom_patterns');
            const rulebook = disciplines.filter(d => d.discipline_group === 'rulebook_patterns');
            const scoresheet = disciplines.filter(d => d.discipline_group === 'scoresheet_only');
            const timed = showTimedAdditional ? disciplines.filter(d => d.discipline_group === 'timed') : [];
            const additional = showTimedAdditional ? disciplines.filter(d => d.discipline_group === 'additional') : [];
            // Ungrouped fallback
            const pattern = disciplines.filter(d => !d.discipline_group && (d.pattern_type === 'pattern' || d.pattern_type === null));
            const ungroupedScoresheet = disciplines.filter(d => !d.discipline_group && (d.pattern_type === 'none' || d.pattern_type === 'scoresheet_only'));
            return { custom, rulebook, scoresheet: [...scoresheet, ...ungroupedScoresheet], timed, additional, pattern };
        }

        const custom = disciplines.filter(d => d.pattern_type === 'custom');
        const rulebook = disciplines.filter(d => d.pattern_type === 'rulebook');
        // Filter out VRH-RHC Ranch CowWork Rookie and Limited for AQHA (they will be shown via dropdown)
        const scoresheet = disciplines.filter(d => {
            if (d.pattern_type === 'none' || d.pattern_type === 'scoresheet_only') {
                // Hide VRH-RHC Ranch CowWork Rookie and Limited for AQHA
                if (association.id === 'AQHA' &&
                    (d.name === 'VRH-RHC Ranch CowWork Rookie' || d.name === 'VRH-RHC Ranch CowWork Limited')) {
                    return false;
                }
                return true;
            }
            return false;
        });
        // Handle disciplines with pattern_type: 'pattern' or pattern_type: null (for open-show disciplines)
        const pattern = disciplines.filter(d => {
            return d.pattern_type === 'pattern' || d.pattern_type === null;
        });
        return { custom, rulebook, scoresheet, timed: [], additional: [], pattern };
    }, [disciplines, association.id]);

    return (
        <AccordionItem value={groupKey} className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="text-base font-semibold hover:no-underline px-3 py-2 bg-muted/50">
                <div className="flex items-center gap-3">
                    {logoUrl ? (
                        <img src={logoUrl} alt={`${association.name} logo`} className="h-8 object-contain" />
                    ) : (
                        <Icon className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div className="flex flex-col items-start">
                        <span className="block">{association.name}</span>
                        {subAssociationType && (
                            <span className="text-sm font-normal text-muted-foreground bg-primary/10 px-2 py-0.5 rounded">
                                {subAssociationType.name}
                            </span>
                        )}
                        {association.id === '4-H' && selected4HCity && (
                            <span className="text-sm font-normal text-muted-foreground bg-primary/10 px-2 py-0.5 rounded">
                                {selected4HCity}
                            </span>
                        )}
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-3 space-y-3">
                {/* Select All checkbox */}
                {disciplines.length > 0 && (
                    <div className="flex items-center space-x-2 px-1.5 pb-1 border-b border-border/50">
                        <Checkbox
                            id={`select-all-${groupKey}`}
                            checked={allChecked}
                            onCheckedChange={handleSelectAll}
                            {...(someChecked ? { 'data-state': 'indeterminate' } : {})}
                        />
                        <Label htmlFor={`select-all-${groupKey}`} className="font-medium text-sm cursor-pointer">
                            Select All
                        </Label>
                        <span className="text-xs text-muted-foreground">({selectedCount}/{allKeys.length})</span>
                    </div>
                )}
                {/* Always show Custom Pattern section with Add button */}
                {(association.id === 'AQHA' || association.id === 'APHA' || association.id === 'ApHC' || association.id === 'ABRA' || association.id === 'PtHA') ?
                    <AQHACustomPatternCategory title="Custom Pattern" disciplines={categorized.custom} selectedDisciplineKeys={selectedDisciplineKeys} onDisciplineToggle={onDisciplineToggle} associationId={association.id} getDisciplineKey={getDisciplineKey} dualApprovedAssociations={dualApprovedAssociations} dualApprovedSelections={dualApprovedSelections} onDualApprovedToggle={onDualApprovedToggle} vrhRanchCowWorkOptions={vrhRanchCowWorkOptions} vrhRanchCowWorkSelections={vrhRanchCowWorkSelections} onVrhRanchCowWorkSelect={onVrhRanchCowWorkSelect} onAddCustomDiscipline={onAddCustomDiscipline} maxReached={maxReached} comingSoon /> :
                    <DisciplineCategory title="Custom Pattern" disciplines={categorized.custom} selectedDisciplineKeys={selectedDisciplineKeys} onDisciplineToggle={onDisciplineToggle} getDisciplineKey={getDisciplineKey} dualApprovedAssociations={dualApprovedAssociations} dualApprovedSelections={dualApprovedSelections} onDualApprovedToggle={onDualApprovedToggle} vrhRanchCowWorkOptions={vrhRanchCowWorkOptions} vrhRanchCowWorkSelections={vrhRanchCowWorkSelections} onVrhRanchCowWorkSelect={onVrhRanchCowWorkSelect} onAddCustomDiscipline={onAddCustomDiscipline} associationId={association.id} showAddButton={true} maxReached={maxReached} comingSoon />
                }
                {categorized.rulebook.length > 0 && <DisciplineCategory title="Rulebook Pattern" disciplines={categorized.rulebook} selectedDisciplineKeys={selectedDisciplineKeys} onDisciplineToggle={onDisciplineToggle} getDisciplineKey={getDisciplineKey} dualApprovedAssociations={dualApprovedAssociations} dualApprovedSelections={dualApprovedSelections} onDualApprovedToggle={onDualApprovedToggle} vrhRanchCowWorkOptions={vrhRanchCowWorkOptions} vrhRanchCowWorkSelections={vrhRanchCowWorkSelections} onVrhRanchCowWorkSelect={onVrhRanchCowWorkSelect} maxReached={maxReached} />}
                {categorized.pattern.length > 0 && <DisciplineCategory title="Pattern" disciplines={categorized.pattern} selectedDisciplineKeys={selectedDisciplineKeys} onDisciplineToggle={onDisciplineToggle} getDisciplineKey={getDisciplineKey} dualApprovedAssociations={dualApprovedAssociations} dualApprovedSelections={dualApprovedSelections} onDualApprovedToggle={onDualApprovedToggle} vrhRanchCowWorkOptions={vrhRanchCowWorkOptions} vrhRanchCowWorkSelections={vrhRanchCowWorkSelections} onVrhRanchCowWorkSelect={onVrhRanchCowWorkSelect} maxReached={maxReached} />}
                {categorized.scoresheet.length > 0 && <DisciplineCategory title="Scoresheet Only" disciplines={categorized.scoresheet} selectedDisciplineKeys={selectedDisciplineKeys} onDisciplineToggle={onDisciplineToggle} getDisciplineKey={getDisciplineKey} dualApprovedAssociations={dualApprovedAssociations} dualApprovedSelections={dualApprovedSelections} onDualApprovedToggle={onDualApprovedToggle} vrhRanchCowWorkOptions={vrhRanchCowWorkOptions} vrhRanchCowWorkSelections={vrhRanchCowWorkSelections} onVrhRanchCowWorkSelect={onVrhRanchCowWorkSelect} maxReached={maxReached} />}
                {categorized.timed.length > 0 && <DisciplineCategory title="Timed Classes" disciplines={categorized.timed} selectedDisciplineKeys={selectedDisciplineKeys} onDisciplineToggle={onDisciplineToggle} getDisciplineKey={getDisciplineKey} dualApprovedAssociations={dualApprovedAssociations} dualApprovedSelections={dualApprovedSelections} onDualApprovedToggle={onDualApprovedToggle} vrhRanchCowWorkOptions={vrhRanchCowWorkOptions} vrhRanchCowWorkSelections={vrhRanchCowWorkSelections} onVrhRanchCowWorkSelect={onVrhRanchCowWorkSelect} onAddCustomDiscipline={onAddCustomDiscipline} associationId={association.id} showAddButton={true} addButtonLabel="Add Timed Class" disciplineGroup="timed" maxReached={maxReached} />}
                {categorized.additional.length > 0 && <DisciplineCategory title="Additional Performance Classes" disciplines={categorized.additional} selectedDisciplineKeys={selectedDisciplineKeys} onDisciplineToggle={onDisciplineToggle} getDisciplineKey={getDisciplineKey} dualApprovedAssociations={dualApprovedAssociations} dualApprovedSelections={dualApprovedSelections} onDualApprovedToggle={onDualApprovedToggle} vrhRanchCowWorkOptions={vrhRanchCowWorkOptions} vrhRanchCowWorkSelections={vrhRanchCowWorkSelections} onVrhRanchCowWorkSelect={onVrhRanchCowWorkSelect} onAddCustomDiscipline={onAddCustomDiscipline} associationId={association.id} showAddButton={true} addButtonLabel="Add Additional Class" disciplineGroup="additional" maxReached={maxReached} />}
            </AccordionContent>
        </AccordionItem>
    );
};

export const Step2_ClassesAndDivisions = ({ formData, setFormData, disciplineLibrary, associationsData, onRefreshDisciplines, stepNumber = 2, isHubMode = false, maxDisciplines = 0, showTimedAdditional = false }) => {
    const { toast } = useToast();
    const [customDisciplineName, setCustomDisciplineName] = React.useState('');
    const [isCustomDisciplineModalOpen, setIsCustomDisciplineModalOpen] = React.useState(false);
    const [selectedAssociationForCustom, setSelectedAssociationForCustom] = useState('');
    const [selectedDisciplineGroup, setSelectedDisciplineGroup] = useState('custom_patterns');
    const [isSavingCustomDiscipline, setIsSavingCustomDiscipline] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
    const [bulkAddText, setBulkAddText] = useState('');
    const [bulkAddNoPattern, setBulkAddNoPattern] = useState(true);
    
    // 4-H City selection state - stored in formData for persistence
    const selected4HCity = formData.selected4HCity || '';
    
    // Check if 4-H is selected
    const is4HSelected = formData.associations?.['4-H'] === true;
    
    // Get available cities for 4-H from discipline library
    const available4HCities = useMemo(() => {
        if (!disciplineLibrary || !is4HSelected) return [];
        const cities = new Set(
            disciplineLibrary
                .filter(d => d.association_id === '4-H' && d.city)
                .map(d => d.city)
        );
        return Array.from(cities).sort();
    }, [disciplineLibrary, is4HSelected]);
    
    // Handle 4-H city selection
    const handle4HCityChange = (city) => {
        setFormData(prev => ({
            ...prev,
            selected4HCity: city,
            // Clear previously selected 4-H disciplines when city changes
            disciplines: (prev.disciplines || []).filter(d => d.association_id !== '4-H')
        }));
    };
    
    // VRH-RHC Ranch CowWork options
    const vrhRanchCowWorkOptions = [
        { value: 'open', label: 'VRH-RHC Ranch CowWork' },
        { value: 'rookie', label: 'VRH-RHC Ranch CowWork Rookie' },
        { value: 'limited', label: 'VRH-RHC Ranch CowWork Limited' }
    ];
    
    // Handler for VRH-RHC Ranch CowWork selection (multiple selection support)
    // Creates separate discipline entries for each selected scoresheet
    const handleVrhRanchCowWorkSelect = (disciplineKey, value, checked) => {
        setFormData(prev => {
            const currentSelection = prev.vrhRanchCowWorkSelections?.[disciplineKey];
            
            // Convert to array if it's a single value (for backward compatibility)
            const currentArray = Array.isArray(currentSelection) 
                ? currentSelection 
                : currentSelection ? [currentSelection] : [];
            
            let newSelection;
            if (checked) {
                // Add value if not already in array
                if (!currentArray.includes(value)) {
                    newSelection = [...currentArray, value];
                } else {
                    newSelection = currentArray;
                }
            } else {
                // Remove value from array
                newSelection = currentArray.filter(v => v !== value);
            }
            
            // Map values to discipline names
            const valueToName = {
                'open': 'VRH-RHC Ranch CowWork',
                'rookie': 'VRH-RHC Ranch CowWork Rookie',
                'limited': 'VRH-RHC Ranch CowWork Limited'
            };
            
            // Find the base discipline from the library
            const baseDiscipline = disciplineLibrary.find(d => 
                (d.name === 'VRH-RHC Ranch CowWork' || d.name === 'Ranch Cow Work') && 
                d.association_id === 'AQHA'
            );
            
            if (!baseDiscipline) {
                // If base discipline not found, just update selections
                const newSelections = { ...prev.vrhRanchCowWorkSelections };
                if (newSelection.length === 0) {
                    delete newSelections[disciplineKey];
                } else {
                    newSelections[disciplineKey] = newSelection;
                }
                return { ...prev, vrhRanchCowWorkSelections: newSelections };
            }
            
            // Update disciplines: remove old VRH-RHC entries and add new ones
            let newDisciplines = [...(prev.disciplines || [])];
            
            // Remove all existing VRH-RHC Ranch CowWork disciplines (all variants)
            newDisciplines = newDisciplines.filter(d => {
                const isVrhRanchCowWork = (d.name === 'VRH-RHC Ranch CowWork' || 
                    d.name === 'VRH-RHC Ranch CowWork Rookie' || 
                    d.name === 'VRH-RHC Ranch CowWork Limited') &&
                    d.association_id === 'AQHA';
                return !isVrhRanchCowWork;
            });
            
            // Add new discipline entries for each selected scoresheet
            const selectedAssocIds = Object.keys(prev.associations).filter(id => prev.associations[id]);
            
            newSelection.forEach(selectedValue => {
                const disciplineName = valueToName[selectedValue];
                if (!disciplineName) return;
                
                const newDiscipline = {
                    ...baseDiscipline,
                    name: disciplineName,
                    id: `${disciplineName.replace(/\s+/g, '-')}-${baseDiscipline.association_id}-${Date.now()}-${selectedValue}`,
                    pattern: baseDiscipline.pattern_type !== 'none' && baseDiscipline.pattern_type !== 'scoresheet_only',
                    scoresheet: baseDiscipline.category !== 'none',
                    isCustom: baseDiscipline.isCustom || false,
                    selectedAssociations: {},
                    divisions: {},
                    customDivisions: [],
                    patternGroups: [],
                    sub_association_type: baseDiscipline.sub_association_type,
                    pattern_type: baseDiscipline.pattern_type || 'none',
                    vrhRanchCowWorkType: selectedValue, // Store the type for reference
                };
                
                if (newDiscipline.pattern) {
                    newDiscipline.patternGroups.push({
                        id: `pattern-group-${Date.now()}-${selectedValue}`, 
                        name: 'Group 1', 
                        divisions: [], 
                        rulebookPatternId: '', 
                        competitionDate: null
                    });
                }
                
                if (baseDiscipline.association_id === 'open-show') {
                    newDiscipline.selectedAssociations['open-show'] = true;
                } else if (baseDiscipline.association_id && selectedAssocIds.includes(baseDiscipline.association_id)) {
                    newDiscipline.selectedAssociations[baseDiscipline.association_id] = true;
                }
                
                newDisciplines.push(newDiscipline);
            });
            
            // Update selections
            const newSelections = { ...prev.vrhRanchCowWorkSelections };
            if (newSelection.length === 0) {
                delete newSelections[disciplineKey];
            } else {
                newSelections[disciplineKey] = newSelection;
            }
            
            return {
                ...prev,
                disciplines: newDisciplines,
                vrhRanchCowWorkSelections: newSelections
            };
        });
    };

    const isOpenShowMode = formData.showType === 'open-unaffiliated' || !!formData.associations['open-show'];
    const isVrhMode = formData.showType === 'versatility-ranch';

    // Get dual-approved associations (when NSBA, NRHA, or NRCHA is selected with 'dual' or 'both' approval type)
    const dualApprovedAssociations = useMemo(() => {
        const result = [];
        const subSelections = formData.subAssociationSelections || {};
        
        // Check each association that supports dual-approval
        ['nsba', 'nrha', 'nrcha'].forEach(assocKey => {
            const approvalType = subSelections[assocKey]?.approvalType;
            const dualApprovedWith = subSelections[assocKey]?.dualApprovedWith || [];
            
            // Show checkbox for both 'dual' and 'both' approval types
            if ((approvalType === 'dual' || approvalType === 'both') && dualApprovedWith.length > 0) {
                result.push(assocKey.toUpperCase());
            }
        });
        
        return result;
    }, [formData.subAssociationSelections]);

    // Get dualApprovedWith associations from all supporting associations
    const dualApprovedWithAssociations = useMemo(() => {
        const subSelections = formData.subAssociationSelections || {};
        const allDualApprovedWith = [];
        
        ['nsba', 'nrha', 'nrcha'].forEach(assocKey => {
            const dualApprovedWith = subSelections[assocKey]?.dualApprovedWith || [];
            dualApprovedWith.forEach(assocId => {
                if (!allDualApprovedWith.includes(assocId)) {
                    allDualApprovedWith.push(assocId);
                }
            });
        });
        
        return allDualApprovedWith;
    }, [formData.subAssociationSelections]);

    const selectedDisciplineKeys = useMemo(() => 
        new Set((formData.disciplines || []).map(d => {
            // Include pattern_type in key to differentiate between same-name disciplines in different categories
            const patternType = d.pattern_type || 'none';
            return `${d.association_id}-${d.sub_association_type || 'none'}-${d.name}-${patternType}`;
        })), 
        [formData.disciplines]
    );
    
    const getDisciplineKey = (disc) => {
        // Include pattern_type in key to differentiate between same-name disciplines in different categories
        // This prevents auto-checking when same discipline name exists in multiple categories (Custom Pattern, Rulebook Pattern, Scoresheet Only)
        const patternType = disc.pattern_type || 'none';
        return `${disc.association_id}-${disc.sub_association_type || 'none'}-${disc.name}-${patternType}`;
    };

    // Handler for dual-approved checkbox toggle
    const handleDualApprovedToggle = (disciplineKey, assocId, isChecked) => {
        setFormData(prev => {
            const newDualApprovedSelections = { ...(prev.dualApprovedSelections || {}) };
            
            if (!newDualApprovedSelections[disciplineKey]) {
                newDualApprovedSelections[disciplineKey] = {};
            }
            
            newDualApprovedSelections[disciplineKey][assocId] = isChecked;
            
            return { ...prev, dualApprovedSelections: newDualApprovedSelections };
        });
    };
    
    const groupedDisciplines = useMemo(() => {
        if (!disciplineLibrary || !associationsData) return [];
        
        const selectedAssociationIds = Object.keys(formData.associations || {}).filter(id => formData.associations[id]);
        const hasOpenShow = selectedAssociationIds.includes('open-show');
        
        let relevantAssociationIds = [];
        if (isVrhMode) {
            relevantAssociationIds = ['versatility-ranch'];
        } else if (hasOpenShow && selectedAssociationIds.length === 1) {
            // Only "Open Shows" is selected - show only open-show disciplines
            relevantAssociationIds = ['open-show'];
        } else if (hasOpenShow) {
            // "Open Shows" is selected with other associations - show both
            relevantAssociationIds = selectedAssociationIds.filter(id => id !== 'open-show');
            // Add 'open-show' as a separate entry
            relevantAssociationIds.push('open-show');
        } else {
            relevantAssociationIds = selectedAssociationIds;
            
            // Hide NSBA/NRHA/NRCHA disciplines when they are selected with Dual-Approved type only
            const subSelections = formData.subAssociationSelections || {};
            ['NSBA', 'NRHA', 'NRCHA'].forEach(assocId => {
                const assocKey = assocId.toLowerCase();
                const approvalType = subSelections[assocKey]?.approvalType;
                if (relevantAssociationIds.includes(assocId) && approvalType === 'dual') {
                    relevantAssociationIds = relevantAssociationIds.filter(id => id !== assocId);
                }
            });
        }

        const subSelections = formData.subAssociationSelections || {};

        const groups = [];

        relevantAssociationIds.forEach(assocId => {
            // Handle 'open-show' association specially
            let association;
            if (assocId === 'open-show') {
                // Create a fallback association object for open-show
                association = {
                    id: 'open-show',
                    name: 'Open Shows',
                    abbreviation: 'Open',
                    sub_association_info: null
                };
            } else {
                association = associationsData.find(a => a.id === assocId);
            }
            
            if (!association) return;

            const selectedSubTypes = subSelections[assocId]?.types || [];
            
            // If association has sub-types and they are selected, create a group for each
            if (association.sub_association_info && selectedSubTypes.length > 0) {
                selectedSubTypes.forEach(subTypeId => {
                    const subAssociationType = association.sub_association_info.types.find(t => t.id === subTypeId);
                    
                    let disciplines = disciplineLibrary.filter(d => {
                        const matchesAssoc = d.association_id === assocId;
                        const matchesSearch = searchTerm ? d.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
                        const matchesSubType = d.sub_association_type === subTypeId;
                        return matchesAssoc && matchesSearch && matchesSubType;
                    });

                    disciplines.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name));

                    if (disciplines.length > 0 || !searchTerm) {
                        groups.push({ 
                            association, 
                            disciplines, 
                            subAssociationType,
                            groupKey: `${assocId}-${subTypeId}`
                        });
                    }
                });
            } else {
                // Special handling for 4-H - filter by selected city
                if (assocId === '4-H') {
                    // Only show 4-H disciplines if a city is selected
                    if (!selected4HCity) {
                        // Don't add group if no city selected - will show city selector instead
                        groups.push({ 
                            association, 
                            disciplines: [], 
                            subAssociationType: null,
                            groupKey: assocId,
                            requires4HCity: true
                        });
                        return;
                    }
                    
                    let disciplines = disciplineLibrary.filter(d => {
                        const matchesAssoc = d.association_id === '4-H';
                        const matchesCity = d.city === selected4HCity;
                        const matchesSearch = searchTerm ? d.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
                        return matchesAssoc && matchesCity && matchesSearch;
                    });

                    disciplines.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name));

                    groups.push({ 
                        association, 
                        disciplines, 
                        subAssociationType: null,
                        groupKey: assocId,
                        selected4HCity: selected4HCity
                    });
                    return;
                }
                
                // No sub-types or none selected - show all disciplines for this association
                let disciplines = disciplineLibrary.filter(d => {
                    // For 'open-show', filter by association_id = 'open-show'
                    const matchesAssoc = d.association_id === assocId;
                    const matchesSearch = searchTerm ? d.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
                    // Only include disciplines without sub-type requirement, or if no sub-types are defined
                    const matchesSubType = !d.sub_association_type || !association.sub_association_info;
                    // NSBA does not sanction Reining, Ranch Reining, Ranch
                    // Riding, or Western Riding — hide these only under the
                    // NSBA association (other associations still show them).
                    if (assocId === 'NSBA') {
                        const n = (d.name || '').toLowerCase().trim();
                        if (
                            n === 'reining' ||
                            n === 'ranch reining' ||
                            n === 'ranch riding' ||
                            n === 'western riding'
                        ) {
                            return false;
                        }
                    }
                    return matchesAssoc && matchesSearch && matchesSubType;
                });

                disciplines.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name));

                if (disciplines.length > 0 || !searchTerm) {
                    groups.push({ 
                        association, 
                        disciplines, 
                        subAssociationType: null,
                        groupKey: assocId
                    });
                }
            }
        });

        return groups;

    }, [formData.associations, formData.subAssociationSelections, isVrhMode, isOpenShowMode, disciplineLibrary, associationsData, searchTerm, selected4HCity]);

    const handleDisciplineToggle = (disc, isChecked) => {
        if (isVrhMode) {
            toast({ title: "Disciplines for Versatility Ranch Horse shows are fixed.", variant: "default" });
            return;
        }

        // Enforce max disciplines limit (hub mode)
        if (isChecked && maxDisciplines > 0 && (formData.disciplines || []).length >= maxDisciplines) {
            toast({ title: `Maximum ${maxDisciplines} disciplines allowed`, description: "Please deselect a discipline before adding another.", variant: "destructive" });
            return;
        }
        
        const disciplineKey = getDisciplineKey(disc);
        
        // Check if this is VRH-RHC Ranch CowWork for AQHA
        const isVrhRanchCowWork = (disc.name === 'VRH-RHC Ranch CowWork' || disc.name === 'Ranch Cow Work') && 
            disc.association_id === 'AQHA';
        
        if (isChecked && isVrhRanchCowWork) {
            // Auto-select 'open' (VRH-RHC Ranch CowWork) as default and create discipline
            setFormData(prev => {
                const newSelections = {
                    ...prev.vrhRanchCowWorkSelections,
                    [disciplineKey]: ['open']
                };
                
                // Map values to discipline names
                const valueToName = {
                    'open': 'VRH-RHC Ranch CowWork',
                    'rookie': 'VRH-RHC Ranch CowWork Rookie',
                    'limited': 'VRH-RHC Ranch CowWork Limited'
                };
                
                // Create discipline for 'open' (default selection)
                let newDisciplines = [...(prev.disciplines || [])];
                const disciplineName = valueToName['open'];
                
                // Check if discipline already exists
                const exists = newDisciplines.some(d => 
                    d.name === disciplineName && d.association_id === 'AQHA'
                );
                
                if (!exists) {
                    const newDiscipline = {
                        ...disc,
                        name: disciplineName,
                        id: `${disciplineName.replace(/\s+/g, '-')}-${disc.association_id}-${Date.now()}-open`,
                        pattern: disc.pattern_type !== 'none' && disc.pattern_type !== 'scoresheet_only',
                        scoresheet: disc.category !== 'none',
                        isCustom: disc.isCustom || false,
                        selectedAssociations: {},
                        divisions: {},
                        customDivisions: [],
                        patternGroups: [],
                        sub_association_type: disc.sub_association_type,
                        pattern_type: disc.pattern_type || 'none',
                        vrhRanchCowWorkType: 'open',
                    };
                    
                    if (newDiscipline.pattern) {
                        newDiscipline.patternGroups.push({
                            id: `pattern-group-${Date.now()}-open`, 
                            name: 'Group 1', 
                            divisions: [], 
                            rulebookPatternId: '', 
                            competitionDate: null
                        });
                    }
                    
                    const selectedAssocIds = Object.keys(prev.associations).filter(id => prev.associations[id]);
                    if (disc.association_id === 'open-show') {
                        newDiscipline.selectedAssociations['open-show'] = true;
                    } else if (disc.association_id && selectedAssocIds.includes(disc.association_id)) {
                        newDiscipline.selectedAssociations[disc.association_id] = true;
                    }
                    
                    newDisciplines.push(newDiscipline);
                }
                
                return {
                    ...prev,
                    disciplines: newDisciplines,
                    vrhRanchCowWorkSelections: newSelections
                };
            });
            return; // Don't proceed with normal discipline toggle
        } else if (!isChecked && isVrhRanchCowWork) {
            // Remove all VRH-RHC Ranch CowWork disciplines when unchecking
            setFormData(prev => {
                const newDisciplines = (prev.disciplines || []).filter(d => {
                    const isVrhRanchCowWork = (d.name === 'VRH-RHC Ranch CowWork' || 
                        d.name === 'VRH-RHC Ranch CowWork Rookie' || 
                        d.name === 'VRH-RHC Ranch CowWork Limited') &&
                        d.association_id === 'AQHA';
                    return !isVrhRanchCowWork;
                });
                
                const newSelections = { ...prev.vrhRanchCowWorkSelections };
                delete newSelections[disciplineKey];
                
                return {
                    ...prev,
                    disciplines: newDisciplines,
                    vrhRanchCowWorkSelections: newSelections
                };
            });
            return; // Don't proceed with normal discipline toggle
        }
        
        setFormData(prev => {
            let newDisciplines = [...(prev.disciplines || [])];
            const disciplineExistsIndex = newDisciplines.findIndex(c => 
                getDisciplineKey(c) === disciplineKey
            );

            if (isChecked) {
                // Skip adding discipline if it's VRH-RHC Ranch CowWork (handled separately)
                if (isVrhRanchCowWork) {
                    return; // Already handled above
                }
                
                if (disciplineExistsIndex === -1) {
                    const newDiscipline = {
                        ...disc,
                        id: `${disc.name.replace(/\s+/g, '-')}-${disc.association_id}-${Date.now()}`,
                        pattern: disc.pattern_type !== 'none' && disc.pattern_type !== 'scoresheet_only',
                        scoresheet: disc.category !== 'none',
                        isCustom: disc.isCustom || false,
                        selectedAssociations: {},
                        divisions: {},
                        customDivisions: [],
                        patternGroups: [],
                        sub_association_type: disc.sub_association_type, // Preserve sub-type
                        pattern_type: disc.pattern_type || 'none', // Preserve pattern_type for key matching
                    };
                    
                    if (newDiscipline.pattern) {
                        newDiscipline.patternGroups.push({id: `pattern-group-${Date.now()}`, name: 'Group 1', divisions: [], rulebookPatternId: '', competitionDate: null});
                    }

                    const selectedAssocIds = Object.keys(prev.associations).filter(id => prev.associations[id]);
                    // Set selectedAssociations based on the discipline's actual association_id
                    // Only set 'open-show' if the discipline actually has association_id = 'open-show'
                    if (disc.association_id === 'open-show') {
                        newDiscipline.selectedAssociations['open-show'] = true;
                    } else if (disc.association_id && selectedAssocIds.includes(disc.association_id)) {
                        newDiscipline.selectedAssociations[disc.association_id] = true;
                    }
                    newDisciplines.push(newDiscipline);
                }
            } else {
                // Find the discipline being removed to get its ID
                const disciplineToRemove = newDisciplines.find(c => getDisciplineKey(c) === disciplineKey);
                const disciplineIdToRemove = disciplineToRemove?.id;
                
                // Remove the discipline
                newDisciplines = newDisciplines.filter(c => 
                    getDisciplineKey(c) !== disciplineKey
                );
                
                // Clean up judge data for the removed discipline
                if (disciplineIdToRemove) {
                    // Find the discipline index before removal to clean up judge data
                    const oldDisciplines = prev.disciplines || [];
                    const disciplineIndex = oldDisciplines.findIndex(d => d.id === disciplineIdToRemove);
                    
                    if (disciplineIndex !== -1) {
                        // Clean up judgeSelections, groupJudges, and related data
                        const newJudgeSelections = [...(prev.judgeSelections || [])];
                        const newGroupJudges = { ...(prev.groupJudges || {}) };
                        const newDueDateSelections = [...(prev.dueDateSelections || [])];
                        const newDisciplineDueDates = { ...(prev.disciplineDueDates || {}) };
                        const newPatternSelections = { ...(prev.patternSelections || {}) };
                        const newGroupDueDates = { ...(prev.groupDueDates || {}) };
                        const newGroupStaff = { ...(prev.groupStaff || {}) };
                        
                        // Remove data at the discipline index
                        newJudgeSelections[disciplineIndex] = null;
                        delete newGroupJudges[disciplineIndex];
                        // Clear dueDateSelections for this discipline
                        newDueDateSelections[disciplineIndex] = null;
                        delete newDisciplineDueDates[disciplineIndex];
                        delete newPatternSelections[disciplineIndex];
                        delete newGroupDueDates[disciplineIndex];
                        delete newGroupStaff[disciplineIndex];
                        
                        // Also clean up by discipline ID (new format)
                        delete newPatternSelections[disciplineIdToRemove];
                        delete newGroupJudges[disciplineIdToRemove];
                        delete newDisciplineDueDates[disciplineIdToRemove];
                        delete newGroupDueDates[disciplineIdToRemove];
                        delete newGroupStaff[disciplineIdToRemove];
                        
                        return {
                            ...prev,
                            disciplines: newDisciplines,
                            judgeSelections: newJudgeSelections,
                            groupJudges: newGroupJudges,
                            dueDateSelections: newDueDateSelections, // Ensure dueDateSelections is included in cleanup
                            disciplineDueDates: newDisciplineDueDates,
                            patternSelections: newPatternSelections,
                            groupDueDates: newGroupDueDates,
                            groupStaff: newGroupStaff
                        };
                    }
                }
            }
            
            newDisciplines.sort((a, b) => {
                const aSort = disciplineLibrary.find(d => d.name === a.name)?.sort_order ?? 999;
                const bSort = disciplineLibrary.find(d => d.name === b.name)?.sort_order ?? 999;
                return aSort - bSort;
            });

            // If all disciplines are removed, clean up all judge and related data
            if (newDisciplines.length === 0) {
                return {
                    ...prev,
                    disciplines: newDisciplines,
                    judgeSelections: [],
                    groupJudges: {},
                    dueDateSelections: [],
                    disciplineDueDates: {},
                    patternSelections: {},
                    groupDueDates: {},
                    groupStaff: {}
                };
            }

            return { ...prev, disciplines: newDisciplines };
        });
    };

    // Open custom discipline modal for a specific association
    const handleOpenAddCustomModal = useCallback((associationId, disciplineGroup = 'custom_patterns') => {
        setSelectedAssociationForCustom(associationId);
        setSelectedDisciplineGroup(disciplineGroup);
        setCustomDisciplineName('');
        setIsCustomDisciplineModalOpen(true);
    }, []);

    // Bulk add classes
    const handleBulkAddClasses = () => {
        const lines = bulkAddText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) {
            toast({ title: 'No classes to add', description: 'Please enter at least one class name.', variant: 'destructive' });
            return;
        }

        // Determine association — use the first selected association or 'open-show'
        const selectedAssocIds = Object.keys(formData.associations || {}).filter(id => formData.associations[id]);
        const assocId = selectedAssocIds[0] || 'open-show';

        setFormData(prev => {
            const newDisciplines = [...(prev.disciplines || [])];
            let added = 0;

            for (const className of lines) {
                // Check for duplicates
                const exists = newDisciplines.some(d =>
                    d.name === className && d.association_id === assocId
                );
                if (exists) continue;

                const timestamp = Date.now() + added;
                const newDiscipline = {
                    id: `${className.replace(/\s+/g, '-')}-${assocId}-${timestamp}`,
                    name: className,
                    association_id: assocId,
                    pattern_type: bulkAddNoPattern ? 'none' : 'custom',
                    pattern: !bulkAddNoPattern,
                    scoresheet: false,
                    isCustom: true,
                    isBulkAdded: true,
                    selectedAssociations: { [assocId]: true },
                    divisions: {},
                    divisionOrder: [],
                    customDivisions: [],
                    patternGroups: [],
                    sub_association_type: null,
                };

                if (!bulkAddNoPattern) {
                    newDiscipline.patternGroups.push({
                        id: `pattern-group-${timestamp}`,
                        name: 'Group 1',
                        divisions: [],
                        rulebookPatternId: '',
                        competitionDate: null,
                    });
                }

                newDisciplines.push(newDiscipline);
                added++;
            }

            return { ...prev, disciplines: newDisciplines };
        });

        toast({
            title: `${lines.length} class${lines.length === 1 ? '' : 'es'} added`,
            description: 'Classes have been added to your disciplines list.',
        });

        setBulkAddText('');
        setIsBulkAddOpen(false);
    };

    // Save custom discipline to database
    const handleSaveCustomDisciplineToDb = async () => {
        if (!customDisciplineName.trim()) {
            toast({ title: "Custom discipline name cannot be empty.", variant: "destructive" });
            return;
        }
        
        if (!selectedAssociationForCustom) {
            toast({ title: "Please select an association.", variant: "destructive" });
            return;
        }

        setIsSavingCustomDiscipline(true);

        try {
            // Get the max sort_order for this association's custom disciplines
            const { data: existingDisciplines, error: fetchError } = await supabase
                .from('disciplines')
                .select('sort_order')
                .eq('association_id', selectedAssociationForCustom)
                .eq('pattern_type', 'custom')
                .order('sort_order', { ascending: false })
                .limit(1);

            if (fetchError) throw fetchError;

            const newSortOrder = (existingDisciplines?.[0]?.sort_order ?? 0) + 100;

            // Determine category and pattern_type based on discipline group
            const groupConfig = {
                custom_patterns: { category: 'pattern_and_scoresheet', pattern_type: 'custom' },
                timed: { category: 'none', pattern_type: 'none' },
                additional: { category: 'none', pattern_type: 'none' },
            };
            const config = groupConfig[selectedDisciplineGroup] || groupConfig.custom_patterns;

            // Insert the new discipline
            const insertData = {
                name: customDisciplineName.trim(),
                association_id: selectedAssociationForCustom,
                category: config.category,
                pattern_type: config.pattern_type,
                open_divisions: false,
                sort_order: newSortOrder,
                discipline_group: selectedDisciplineGroup,
            };
            // For 4-H, include the selected city so the discipline appears in the filtered list
            if (selectedAssociationForCustom === '4-H' && formData.selected4HCity) {
                insertData.city = formData.selected4HCity;
            }
            const { data: newDiscipline, error: insertError } = await supabase
                .from('disciplines')
                .insert(insertData)
                .select()
                .single();

            if (insertError) throw insertError;

            toast({ 
                title: "Custom Discipline Added!", 
                description: `"${customDisciplineName}" has been saved to ${selectedAssociationForCustom}.` 
            });

            // Refresh the discipline library if callback provided
            if (onRefreshDisciplines) {
                await onRefreshDisciplines();
            }

            setCustomDisciplineName('');
            setIsCustomDisciplineModalOpen(false);
            setSelectedAssociationForCustom('');

        } catch (error) {
            console.error('Error saving custom discipline:', error);
            toast({ 
                title: "Error saving discipline", 
                description: error.message || "Failed to save custom discipline. Please try again.", 
                variant: "destructive" 
            });
        } finally {
            setIsSavingCustomDiscipline(false);
        }
    };

    const handleAddCustomDiscipline = () => {
        if (!customDisciplineName.trim()) {
            toast({ title: "Custom discipline name cannot be empty.", variant: "destructive" });
            return;
        }
        const newDiscipline = {
            name: customDisciplineName,
            category: 'pattern_and_scoresheet',
            pattern_type: 'custom',
            isCustom: true,
            associations: [],
            association_id: 'open-show' // Assign a special ID for custom
        };
        handleDisciplineToggle(newDiscipline, true);
        setCustomDisciplineName('');
        setIsCustomDisciplineModalOpen(false);
    };
    
    const needsDisciplineSelection = Object.keys(formData.associations).length > 0 && (formData.disciplines ? formData.disciplines.length === 0 : true);

    // Get association name for display
    const getAssociationName = (assocId) => {
        const assoc = associationsData?.find(a => a.id === assocId);
        return assoc?.name || assocId;
    };

    return (
        <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader className="pb-3">
                <CardTitle className="text-xl">Step {stepNumber}: Select Disciplines</CardTitle>
                <CardDescription className="text-sm">{ isVrhMode ? "The required disciplines for a Versatility Ranch Horse show have been automatically selected." : "Select disciplines from the library, or add custom disciplines for open shows." }</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className={cn("space-y-3 p-3 rounded-lg border", needsDisciplineSelection && "highlight-next-step border-primary")}>
                    <div className="flex justify-between items-center mb-2 flex-wrap gap-3">
                        <h3 className="text-lg font-bold tracking-tight">Available Disciplines</h3>
                         <div className="flex items-center gap-2">
                             {!isHubMode && (
                             <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsBulkAddOpen(true)}
                             >
                                <ListPlus className="mr-1.5 h-4 w-4" />
                                Bulk Add Classes
                             </Button>
                             )}
                             <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search disciplines..."
                                    className="pl-9 w-48"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                         </div>
                        {isVrhMode && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Lock className="h-4 w-4" />
                                <span>Disciplines Locked</span>
                            </div>
                        )}
                    </div>
                    
                    <Accordion type="multiple" defaultValue={groupedDisciplines.map(g => g.groupKey)} className="w-full space-y-4">
                        {groupedDisciplines.map(group => {
                            // Handle 4-H with city selection
                            if (group.association.id === '4-H' && group.requires4HCity) {
                                return (
                                    <FourHCitySelector
                                        key={group.groupKey}
                                        availableCities={available4HCities}
                                        selectedCity={selected4HCity}
                                        onCityChange={handle4HCityChange}
                                        association={group.association}
                                    />
                                );
                            }
                            
                            // Only show dual-approved checkbox if current association is in the dualApprovedWith list
                            const showDualApproved = dualApprovedWithAssociations.includes(group.association.id);
                            
                            return (
                                <AssociationDisciplineGroup
                                    key={group.groupKey}
                                    groupKey={group.groupKey}
                                    association={group.association}
                                    disciplines={group.disciplines}
                                    selectedDisciplineKeys={selectedDisciplineKeys}
                                    onDisciplineToggle={handleDisciplineToggle}
                                    subAssociationType={group.subAssociationType}
                                    getDisciplineKey={getDisciplineKey}
                                    dualApprovedAssociations={showDualApproved ? dualApprovedAssociations : []}
                                    dualApprovedSelections={formData.dualApprovedSelections || {}}
                                    onDualApprovedToggle={handleDualApprovedToggle}
                                    vrhRanchCowWorkOptions={vrhRanchCowWorkOptions}
                                    vrhRanchCowWorkSelections={formData.vrhRanchCowWorkSelections || {}}
                                    onVrhRanchCowWorkSelect={handleVrhRanchCowWorkSelect}
                                    isOpenShowMode={isOpenShowMode}
                                    onAddCustomDiscipline={handleOpenAddCustomModal}
                                    selected4HCity={group.selected4HCity}
                                    maxReached={maxDisciplines > 0 && (formData.disciplines || []).length >= maxDisciplines}
                                    showTimedAdditional={showTimedAdditional}
                                />
                            );
                        })}
                    </Accordion>
                </div>

                {/* Add Custom Discipline Modal */}
                <Dialog open={isCustomDisciplineModalOpen} onOpenChange={setIsCustomDisciplineModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {selectedDisciplineGroup === 'timed' ? 'Add Timed Class' :
                                 selectedDisciplineGroup === 'additional' ? 'Add Additional Class' :
                                 'Add Custom Discipline'}
                            </DialogTitle>
                            <DialogDescription>
                                Create a new {selectedDisciplineGroup === 'timed' ? 'timed class' : selectedDisciplineGroup === 'additional' ? 'additional class' : 'custom discipline'} for {getAssociationName(selectedAssociationForCustom)}.
                                This will be saved to the database and available for future use.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="disciplineName">Discipline Name</Label>
                                <Input 
                                    id="disciplineName"
                                    value={customDisciplineName} 
                                    onChange={(e) => setCustomDisciplineName(e.target.value)} 
                                    placeholder="E.g., Costume Class, Lead Line" 
                                />
                            </div>
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">
                                    <strong>Association:</strong> {getAssociationName(selectedAssociationForCustom)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    This discipline will be added to the {selectedDisciplineGroup === 'timed' ? 'Timed Classes' : selectedDisciplineGroup === 'additional' ? 'Additional Performance Classes' : 'Custom Pattern'} category.
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button 
                                variant="outline" 
                                onClick={() => setIsCustomDisciplineModalOpen(false)}
                                disabled={isSavingCustomDiscipline}
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSaveCustomDisciplineToDb}
                                disabled={isSavingCustomDiscipline || !customDisciplineName.trim()}
                            >
                                {isSavingCustomDiscipline ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Discipline'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Bulk Add Classes Modal */}
                <Dialog open={isBulkAddOpen} onOpenChange={setIsBulkAddOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Bulk Add Classes</DialogTitle>
                            <DialogDescription>
                                Paste or type class names below, one per line. Each line will be added as a separate class.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <Textarea
                                placeholder={"Ranch Riding Junior 8-13 Intro\nRanch Riding Senior 14-18 Intro\nShow Hack\nPleasure Driving"}
                                value={bulkAddText}
                                onChange={(e) => setBulkAddText(e.target.value)}
                                rows={8}
                                className="font-mono text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                {bulkAddText.split('\n').filter(l => l.trim()).length} class{bulkAddText.split('\n').filter(l => l.trim()).length === 1 ? '' : 'es'} detected
                            </p>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="bulkNoPattern"
                                    checked={bulkAddNoPattern}
                                    onCheckedChange={(checked) => setBulkAddNoPattern(!!checked)}
                                />
                                <Label htmlFor="bulkNoPattern" className="text-sm cursor-pointer">
                                    Non-pattern classes (no pattern configuration required)
                                </Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsBulkAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleBulkAddClasses}
                                disabled={!bulkAddText.trim()}
                            >
                                <ListPlus className="mr-2 h-4 w-4" />
                                Add Classes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </motion.div>
    );
};