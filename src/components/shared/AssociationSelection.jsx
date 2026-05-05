import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown, Info, Construction } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

// Associations that are fully built out — everything else shows "Coming Soon"
const READY_ASSOCIATIONS = ['aqha', 'apha', 'nsba', 'phba', '4-h', 'open-show'];
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const AssociationCheckbox = ({ association, isSelected, onSelect, formData, setFormData, allAssociations, isReadOnly = false, context = 'default' }) => {
  const { toast } = useToast();
  const isComingSoon = !READY_ASSOCIATIONS.includes(association.id.toLowerCase());

  const handleSelect = (assocId, checked) => {
    if (checked && isComingSoon) {
      toast({
        title: `${association.name} — Coming Soon`,
        description: 'This association is coming soon. Data may be incomplete.',
      });
    }
    onSelect(assocId, checked);
  };

  const handleSubAssociationChange = (assocId, key, value) => {
    setFormData(prev => ({
      ...prev,
      subAssociationSelections: {
        ...prev.subAssociationSelections,
        [assocId]: {
          ...prev.subAssociationSelections?.[assocId],
          [key]: value
        }
      }
    }));
  };
  
  // Reusable Dual-Approved With Selector for NSBA, NRHA, NRCHA
  const DualApprovedWithSelector = ({ assocKey }) => {
    const selectedOtherAssociations = Object.keys(formData.associations || {})
        .filter(key => key.toLowerCase() !== assocKey.toLowerCase() && formData.associations[key] && !formData.primaryAffiliates.includes(key))
        .map(key => allAssociations.find(a => a.id === key))
        .filter(Boolean);

    const selectedValues = formData.subAssociationSelections?.[assocKey]?.dualApprovedWith || [];
    
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={selectedOtherAssociations.length === 0}
                >
                    {selectedValues.length > 0 
                        ? selectedValues.map(val => allAssociations.find(a => a.id === val)?.abbreviation || val).join(', ')
                        : selectedOtherAssociations.length === 0 ? "No other associations selected" : "Select associations..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search associations..." />
                    <CommandEmpty>No associations found.</CommandEmpty>
                    <CommandGroup>
                        {selectedOtherAssociations.map((assoc) => (
                            <CommandItem
                                key={assoc.id}
                                value={assoc.id}
                                onSelect={(currentValue) => {
                                    const currentSelection = formData.subAssociationSelections?.[assocKey]?.dualApprovedWith || [];
                                    const newSelection = currentSelection.includes(currentValue)
                                        ? currentSelection.filter((item) => item !== currentValue)
                                        : [...currentSelection, currentValue];
                                    handleSubAssociationChange(assocKey, 'dualApprovedWith', newSelection);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        (formData.subAssociationSelections?.[assocKey]?.dualApprovedWith || []).includes(assoc.id) ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {assoc.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
  };

  const handleSetPrimary = (e, assocId) => {
    e.stopPropagation();
    setFormData(prev => {
        const currentPrimaries = prev.primaryAffiliates || [];
        const isPrimary = currentPrimaries.includes(assocId);
        const newPrimaries = isPrimary
            ? currentPrimaries.filter(id => id !== assocId)
            : [...currentPrimaries, assocId];

        return { ...prev, primaryAffiliates: newPrimaries };
    });
  };

  const renderSubOptions = () => {
    if (!isSelected) return null;
    if (context === 'pattern-upload') return null;
    const subSelections = formData.subAssociationSelections || {};
    
    if (association.sub_association_info) {
      const info = association.sub_association_info;
      const selectedTypes = subSelections[association.id]?.types || [];
      
      const handleSubTypeToggle = (typeId, checked) => {
        const currentTypes = selectedTypes;
        const newTypes = checked 
          ? [...currentTypes, typeId]
          : currentTypes.filter(t => t !== typeId);
        handleSubAssociationChange(association.id, 'types', newTypes);
      };
      
      return (
        <div className="mt-2 space-y-2 px-3 pb-2">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">{info.label}</Label>
            <div className="space-y-1.5">
              {info.types.map(type => (
                <div key={type.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`sub-type-${association.id}-${type.id}`}
                    checked={selectedTypes.includes(type.id)}
                    onCheckedChange={(checked) => handleSubTypeToggle(type.id, checked)}
                  />
                  <Label 
                    htmlFor={`sub-type-${association.id}-${type.id}`}
                    className="font-normal cursor-pointer"
                  >
                    {type.name}
                    {type.info && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="inline-block ml-1 h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{type.info}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    
    if (association.id.toLowerCase() === 'nsba') {
      const approvalType = subSelections.nsba?.approvalType;
      return (
        <div className="mt-2 space-y-2 px-3 pb-2">
          <div>
            <Label className="text-xs text-muted-foreground">NSBA Show Category</Label>
            <Select value={subSelections.nsba?.showCategory || ''} onValueChange={(value) => handleSubAssociationChange('nsba', 'showCategory', value)}>
              <SelectTrigger><SelectValue placeholder="Select show category..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cat1">Category I ($10k+ Added)</SelectItem>
                <SelectItem value="cat2">Category II (&lt;$10k Added)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">NSBA Approval Type</Label>
            <Select value={approvalType || ''} onValueChange={(value) => handleSubAssociationChange('nsba', 'approvalType', value)}>
              <SelectTrigger><SelectValue placeholder="Select approval type..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dual">Dual-Approved</SelectItem>
                <SelectItem value="standalone">Standalone (Special Event)</SelectItem>
                <SelectItem value="both">Both Dual-Approved & Standalone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(approvalType === 'dual' || approvalType === 'both') && (
            <div>
              <Label className="text-xs text-muted-foreground">Dual-Approved With</Label>
              <DualApprovedWithSelector assocKey="nsba" />
            </div>
          )}
        </div>
      );
    }

    // 4-H - State/City Selection (skip for showBuilder and pbb — handled in Step 2 FourHCitySelector)
    if (association.id === '4-H' && context !== 'showBuilder' && context !== 'pbb') {
      const selected4HCity = formData.selected4HCity || '';
      // Extract available cities from discipline library if provided
      const disciplineLib = allAssociations._disciplineLibrary || [];
      const availableCities = [...new Set(
        disciplineLib.filter(d => d.association_id === '4-H' && d.city).map(d => d.city)
      )].sort();

      // If no discipline library, use a fallback list of known states
      const cities = availableCities.length > 0 ? availableCities : ['Colorado', 'Texas', 'Ohio', 'California', 'Oklahoma'];

      return (
        <div className="mt-2 space-y-2 px-3 pb-2">
          <div>
            <Label className="text-xs text-muted-foreground">Select State</Label>
            <p className="text-xs text-muted-foreground/70 mb-1">
              4-H disciplines vary by state. Please select your state to view available disciplines.
            </p>
            <Select value={selected4HCity || ''} onValueChange={(value) => {
              setFormData(prev => ({
                ...prev,
                selected4HCity: value,
                // Clear previously selected 4-H disciplines when state changes
                disciplines: (prev.disciplines || []).filter(d => d.association_id !== '4-H')
              }));
            }}>
              <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select a state..." /></SelectTrigger>
              <SelectContent>
                {cities.map(city => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    // NRHA and NRCHA - Approval Type and Dual-Approved With (no Show Category)
    if (association.id.toLowerCase() === 'nrha' || association.id.toLowerCase() === 'nrcha') {
      const assocKey = association.id.toLowerCase();
      const approvalType = subSelections[assocKey]?.approvalType;
      return (
        <div className="mt-2 space-y-2 px-3 pb-2">
          <div>
            <Label className="text-xs text-muted-foreground">{association.abbreviation || association.id} Approval Type</Label>
            <Select value={approvalType || ''} onValueChange={(value) => handleSubAssociationChange(assocKey, 'approvalType', value)}>
              <SelectTrigger><SelectValue placeholder="Select approval type..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dual">Dual-Approved</SelectItem>
                <SelectItem value="standalone">Standalone (Special Event)</SelectItem>
                <SelectItem value="both">Both Dual-Approved & Standalone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(approvalType === 'dual' || approvalType === 'both') && (
            <div>
              <Label className="text-xs text-muted-foreground">Dual-Approved With</Label>
              <DualApprovedWithSelector assocKey={assocKey} />
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const isPrimary = (formData.primaryAffiliates || []).includes(association.id);

  return (
    <div 
      className={cn(
        "rounded-md border bg-card transition-all duration-200",
        isSelected ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted/50'
      )}
    >
      <div className="flex items-center space-x-3 p-3 cursor-pointer" onClick={() => handleSelect(association.id, !isSelected)}>
        <Checkbox id={`assoc-${association.id}`} checked={isSelected} onCheckedChange={(checked) => handleSelect(association.id, checked)} />
        <Label htmlFor={`assoc-${association.id}`} className="font-normal cursor-pointer flex-grow flex items-center gap-2">
          {association.name}
          {isComingSoon && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-300">
              <Construction className="h-3 w-3 mr-0.5" />
              Coming Soon
            </Badge>
          )}
        </Label>
        {isSelected && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
                variant={isPrimary ? "default" : "outline"}
                size="sm"
                onClick={(e) => handleSetPrimary(e, association.id)}
            >
              {isPrimary ? "Primary" : "Set Primary"}
            </Button>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Marking an association as 'Primary' indicates that its official score sheets<br />should be used for all applicable classes. You can select multiple primary associations.</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {renderSubOptions()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const AssociationSelection = ({ formData, setFormData, associationsData, onShowTypeChange, context = 'default', selectedPurposeName, isReadOnly = false, stepNumber = 1, disciplineLibrary }) => {
    
  const handleAssociationSelection = (assocId, isChecked) => {
    if (isReadOnly) return;
    setFormData(prev => {
        let newAssociations = { ...prev.associations };
        let newPrimaryAffiliates = [...(prev.primaryAffiliates || [])];
        const nsbaId = allAssociations.find(a => a.id.toLowerCase() === 'nsba')?.id;

        if (isChecked) {
            newAssociations[assocId] = true;
            if (nsbaId && assocId === nsbaId && !newPrimaryAffiliates.includes(nsbaId)) {
                newPrimaryAffiliates.push(nsbaId);
            }
        } else {
            delete newAssociations[assocId];
            newPrimaryAffiliates = newPrimaryAffiliates.filter(id => id !== assocId);
        }
        
        // Only reset disciplines if REMOVING an association (to clean up related data)
        // When ADDING a new association, preserve existing disciplines
        let newFormData = {
            ...prev,
            associations: newAssociations,
            primaryAffiliates: newPrimaryAffiliates,
        };
        
        // If unchecking an association, filter out disciplines that were ONLY for that association
        // and clean up association-specific data from remaining disciplines
        if (!isChecked) {
            const remainingAssocIds = Object.keys(newAssociations);
            newFormData.disciplines = (prev.disciplines || []).map(disc => {
                // Check if this discipline should be kept
                const discAssocIds = Object.keys(disc.selectedAssociations || {}).filter(
                    id => disc.selectedAssociations[id]
                );
                const shouldKeep = discAssocIds.some(id => remainingAssocIds.includes(id));
                
                // If discipline should be removed entirely, return null (will be filtered out)
                if (!shouldKeep) {
                    return null;
                }
                
                // Clean up data for the unchecked association from remaining disciplines
                const cleanedDiscipline = { ...disc };
                
                // Remove unchecked association from selectedAssociations
                if (cleanedDiscipline.selectedAssociations) {
                    delete cleanedDiscipline.selectedAssociations[assocId];
                }
                
                // Remove divisions for the unchecked association
                if (cleanedDiscipline.divisions && cleanedDiscipline.divisions[assocId]) {
                    const newDivisions = { ...cleanedDiscipline.divisions };
                    delete newDivisions[assocId];
                    cleanedDiscipline.divisions = newDivisions;
                }
                
                // Remove divisionOrder entries for the unchecked association
                if (cleanedDiscipline.divisionOrder) {
                    cleanedDiscipline.divisionOrder = cleanedDiscipline.divisionOrder.filter(
                        divId => !divId.startsWith(`${assocId}-`)
                    );
                }
                
                // Remove divisionDates for divisions from the unchecked association
                if (cleanedDiscipline.divisionDates) {
                    const newDivisionDates = { ...cleanedDiscipline.divisionDates };
                    Object.keys(newDivisionDates).forEach(divId => {
                        if (divId.startsWith(`${assocId}-`)) {
                            delete newDivisionDates[divId];
                        }
                    });
                    cleanedDiscipline.divisionDates = newDivisionDates;
                }
                
                // Remove divisionPrintTitles for divisions from the unchecked association
                if (cleanedDiscipline.divisionPrintTitles) {
                    const newDivisionPrintTitles = { ...cleanedDiscipline.divisionPrintTitles };
                    Object.keys(newDivisionPrintTitles).forEach(divId => {
                        if (divId.startsWith(`${assocId}-`)) {
                            delete newDivisionPrintTitles[divId];
                        }
                    });
                    cleanedDiscipline.divisionPrintTitles = newDivisionPrintTitles;
                }
                
                // Clean up patternGroups - remove groups that only contain divisions from unchecked association
                // or remove divisions from unchecked association from groups
                if (cleanedDiscipline.patternGroups) {
                    cleanedDiscipline.patternGroups = cleanedDiscipline.patternGroups
                        .map(group => {
                            // Filter out divisions from the unchecked association
                            const filteredDivisions = (group.divisions || []).filter(
                                div => div.assocId !== assocId
                            );
                            
                            // Only keep the group if it still has divisions
                            if (filteredDivisions.length > 0) {
                                return {
                                    ...group,
                                    divisions: filteredDivisions
                                };
                            }
                            // Return null to remove empty groups
                            return null;
                        })
                        .filter(group => group !== null); // Remove null groups
                }
                
                return cleanedDiscipline;
            }).filter(disc => disc !== null); // Remove disciplines that were marked for deletion
        }

        if (!isChecked) {
            if (newFormData.subAssociationSelections) {
                delete newFormData.subAssociationSelections[assocId];
                if (assocId.toLowerCase() === 'nsba' && newFormData.subAssociationSelections.nsba) {
                    delete newFormData.subAssociationSelections.nsba;
                }
                // Clean up NSBA dualApprovedWith when an association is deselected
                if (newFormData.subAssociationSelections.nsba?.dualApprovedWith) {
                    newFormData.subAssociationSelections = {
                        ...newFormData.subAssociationSelections,
                        nsba: {
                            ...newFormData.subAssociationSelections.nsba,
                            dualApprovedWith: newFormData.subAssociationSelections.nsba.dualApprovedWith.filter(
                                id => id !== assocId
                            )
                        }
                    };
                }
            }
        }
      
        const openShowId = allAssociations.find(a => a.id.toLowerCase() === 'open-show')?.id;
        if (openShowId && newAssociations[openShowId] && Object.keys(newAssociations).length > 1) {
            newFormData.showType = 'multi-breed';
        } else if (openShowId && newAssociations[openShowId]) {
            newFormData.showType = 'open-unaffiliated';
        } else if (Object.keys(newAssociations).length > 0) {
            newFormData.showType = 'multi-breed';
        } else {
            newFormData.showType = '';
        }

        if (onShowTypeChange) {
            onShowTypeChange();
        }

        return newFormData;
    });
  };

  const isClinic = context === 'hub' && formData.usageType === 'clinic';

  const getShowNameLabel = () => {
    if (isClinic) return "Clinic Name";
    if (context === 'hub' && selectedPurposeName) {
        return `${selectedPurposeName} Name`;
    }
    if (context === 'pattern-upload') return "Pattern Set Name";
    if (context === 'pbb') return "Horse Show Name";
    if (context === 'contract') return "Show Name";
    return "Show Name";
  };

  const getShowNamePlaceholder = () => {
     if (isClinic) return "E.g., Western Horsemanship Clinic";
     if (context === 'hub') {
        if (formData.usageType === 'just_for_fun') return "E.g., My Pattern Collection";
        return "E.g., Choose a Pattern";
    }
    if (context === 'pattern-upload') return "E.g., Championship Horsemanship Finals 2025";
    if (context === 'pbb') return "E.g., Summer Sizzler Pattern Book";
    if (context === 'contract') return "e.g., Summer Sizzle";
    return "e.g., Summer Sizzle";
  };

  const getTitle = () => {
    if (context === 'pattern-upload') return `Step ${stepNumber}: Pattern Set Name & Associations`;
    if (context === 'showInfo') return "Associations";
    return `Step ${stepNumber}: Event Setup`;
  };

  const getDescription = () => {
    if (isClinic) return "Enter your clinic name and number, then select which groups you're teaching.";
    if (context === 'pattern-upload') return "Name your pattern set and select all applicable legal associations. These will automatically apply to every pattern in this set.";
    if (context === 'hub') return "Choose which governing body's patterns you're looking for.";
    if (context === 'pbb') return "Name your pattern book and select the affiliated associations.";
    if (context === 'showInfo') return "Select all associations that are part of this show. This will help populate the class list.";
    if (context === 'contract') return "Select all associations that are part of this show. This will help populate the class list.";
    return "Start by giving your show a name, then choose the sanctioning bodies. This will help populate the class list.";
  };

  const allAssociations = associationsData || [];
  // Attach disciplineLibrary so sub-components can access it for 4-H city extraction
  allAssociations._disciplineLibrary = disciplineLibrary || [];
  const leftAssociations = allAssociations
    .filter(a => a.position === 'left')
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const rightAssociations = allAssociations
    .filter(a => a.position === 'right')
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <motion.div key="step1" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      {context !== 'showInfo' && (
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">{getTitle()}</CardTitle>
          <CardDescription className="text-sm">{getDescription()}</CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="showName" className="font-semibold">{getShowNameLabel()}</Label>
            <Input
                id="showName"
                placeholder={getShowNamePlaceholder()}
                value={formData.showName || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, showName: e.target.value }))}
                disabled={isReadOnly}
            />
          </div>
          
          {context !== 'pattern-upload' && (
            <div className="space-y-1.5">
              <Label htmlFor="showNumber" className="font-semibold">{isClinic ? 'Clinic Number' : 'Show Number'}</Label>
              <Input
                  id="showNumber"
                  placeholder={isClinic ? "E.g., C-2026-001" : "E.g., 2024-001"}
                  value={formData.showNumber || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, showNumber: e.target.value }))}
                  disabled={isReadOnly}
              />
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Label className="font-semibold">{isClinic ? 'Who are you teaching?' : 'Select all hosted associations:'}</Label>
          {isClinic && (
            <p className="text-xs text-muted-foreground">Select the groups or associations your clinic is intended for</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 border-l-4 border-red-500 pl-3">
              {leftAssociations.map(assoc => (
                <AssociationCheckbox
                  key={assoc.id}
                  association={assoc}
                  isSelected={!!formData.associations?.[assoc.id]}
                  onSelect={isReadOnly ? () => {} : handleAssociationSelection}
                  formData={formData}
                  setFormData={isReadOnly ? () => {} : setFormData}
                  allAssociations={allAssociations}
                  isReadOnly={isReadOnly}
                  context={context}
                />
              ))}
            </div>
            <div className="space-y-1.5 border-l-4 border-blue-500 pl-3">
              {rightAssociations.map(assoc => (
                <AssociationCheckbox
                  key={assoc.id}
                  association={assoc}
                  isSelected={!!formData.associations?.[assoc.id]}
                  onSelect={isReadOnly ? () => {} : handleAssociationSelection}
                  formData={formData}
                  setFormData={isReadOnly ? () => {} : setFormData}
                  allAssociations={allAssociations}
                  isReadOnly={isReadOnly}
                  context={context}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </motion.div>
  );
};