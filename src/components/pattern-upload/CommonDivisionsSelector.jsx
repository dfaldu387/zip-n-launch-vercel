import React, { useMemo } from 'react';
    import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Label } from '@/components/ui/label';
    import { isWalkTrotDivision } from '@/lib/utils';
    
    const CommonDivisionsSelector = ({ divisionsByAssociation, onBulkDivisionChange, patternDivisions, hierarchyOrder, patterns }) => {
        const categorizedDivisions = useMemo(() => {
            const divisionCounts = {};
            const assocCount = Object.keys(divisionsByAssociation).length;
    
            if (assocCount < 1) return { openAdvanced: [], openBeginner: [], amateurAdvanced: [], amateurBeginner: [], youthAdvanced: [], youthBeginner: [], walkTrot: [], ewd: [] };
    
            Object.entries(divisionsByAssociation).forEach(([assocId, data]) => {
                data.divisions.forEach(group => {
                    group.levels.forEach(level => {
                        const key = `${group.group} - ${level}`;
                        if (!divisionCounts[key]) {
                            divisionCounts[key] = {
                                key,
                                group: group.group,
                                level,
                                associations: new Set(),
                            };
                        }
                        divisionCounts[key].associations.add(assocId);
                    });
                });
            });
    
            const allDivisions = Object.values(divisionCounts).sort((a, b) => a.key.localeCompare(b.key));
            
            const categories = {
                openAdvanced: [],
                openBeginner: [],
                amateurAdvanced: [],
                amateurBeginner: [],
                youthAdvanced: [],
                youthBeginner: [],
                walkTrot: [],
                ewd: [],
            };
            
            const beginnerKeywords = ['green', 'l1', 'rookie', 'limited', 'novice', 'small fry'];
    
            allDivisions.forEach(div => {
                const lowerKey = div.key.toLowerCase();
                if (lowerKey.includes('ewd')) {
                    categories.ewd.push(div);
                } else if (isWalkTrotDivision(div.key)) {
                    categories.walkTrot.push(div);
                } else if (lowerKey.includes('open')) {
                    if (beginnerKeywords.some(kw => lowerKey.includes(kw))) {
                        categories.openBeginner.push(div);
                    } else {
                        categories.openAdvanced.push(div);
                    }
                } else if (lowerKey.includes('amateur') || lowerKey.includes('non-pro') || lowerKey.includes('non pro')) {
                    if (beginnerKeywords.some(kw => lowerKey.includes(kw))) {
                        categories.amateurBeginner.push(div);
                    } else {
                        categories.amateurAdvanced.push(div);
                    }
                } else if (lowerKey.includes('youth') || lowerKey.includes('small fry')) {
                    if (beginnerKeywords.some(kw => lowerKey.includes(kw))) {
                        categories.youthBeginner.push(div);
                    } else {
                        categories.youthAdvanced.push(div);
                    }
                } else {
                    categories.openAdvanced.push(div);
                }
            });
    
            return categories;
        }, [divisionsByAssociation]);
    
        const uploadedPatternIds = hierarchyOrder.map(h => h.id).filter(id => patterns[id]);
    
        const isDivisionAppliedToAll = (division) => {
            if (uploadedPatternIds.length === 0) return false;
            return uploadedPatternIds.every(patternId => {
                const patternTags = patternDivisions[patternId] || {};
                return Array.from(division.associations).every(assocId => {
                    const divisionsForAssoc = patternTags[assocId] || [];
                    return Array.isArray(divisionsForAssoc) && divisionsForAssoc.includes(division.level);
                });
            });
        };
    
        const handleSelectAllForCategory = (divisions, isChecked) => {
            divisions.forEach(div => {
                onBulkDivisionChange(div, isChecked);
            });
        };
    
        const isCategorySelected = (divisions) => {
            if (divisions.length === 0 || uploadedPatternIds.length === 0) return false;
            return divisions.every(div => isDivisionAppliedToAll(div));
        };

        const isCategoryIndeterminate = (divisions) => {
            if (divisions.length === 0 || uploadedPatternIds.length === 0) return false;
            const appliedCount = divisions.filter(div => isDivisionAppliedToAll(div)).length;
            return appliedCount > 0 && appliedCount < divisions.length;
        };
    
        const renderColumn = (title, divisions) => (
            <div className="space-y-2">
                <div className="flex items-center space-x-2 border-b pb-1">
                    <Checkbox
                        id={`select-all-${title.replace(/\s/g, '-')}`}
                        checked={isCategorySelected(divisions)}
                        onCheckedChange={(c) => handleSelectAllForCategory(divisions, !!c)}
                        disabled={divisions.length === 0 || uploadedPatternIds.length === 0}
                        data-state={isCategoryIndeterminate(divisions) ? 'indeterminate' : (isCategorySelected(divisions) ? 'checked' : 'unchecked')}
                    />
                    <Label htmlFor={`select-all-${title.replace(/\s/g, '-')}`} className="font-semibold text-md text-foreground cursor-pointer">{title}</Label>
                </div>
                <div className="space-y-1.5">
                    {divisions.length > 0 ? divisions.map(div => {
                        const isChecked = isDivisionAppliedToAll(div);
                        return (
                           <div key={div.key} className="flex items-center space-x-2">
                               <Checkbox
                                   id={`common-div-select-${div.key.replace(/\s/g, '-')}`}
                                   checked={isChecked}
                                   onCheckedChange={c => onBulkDivisionChange(div, !!c)}
                                   disabled={uploadedPatternIds.length === 0}
                               />
                               <Label htmlFor={`common-div-select-${div.key.replace(/\s/g, '-')}`} className="font-normal text-sm cursor-pointer">{div.key}</Label>
                           </div>
                        )
                    }) : <p className="text-sm text-muted-foreground italic">None</p>}
                </div>
            </div>
        );
    
        const hasDivisions = Object.values(categorizedDivisions).some(arr => arr.length > 0);
        if (!hasDivisions) return null;
    
        return (
            <div className="p-4 border-2 border-primary/50 rounded-lg bg-primary/10 mb-6">
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="common-divisions" className="border-b-0">
                        <AccordionTrigger className="text-lg font-bold text-primary hover:no-underline">
                            <div className="flex flex-col text-left">
                                Quick Add Common Divisions
                                <p className="text-sm font-normal text-muted-foreground">Apply a division to all uploaded patterns at once.</p>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                               {renderColumn("Open", categorizedDivisions.openAdvanced)}
                               {renderColumn("Open - Beginner", categorizedDivisions.openBeginner)}
                               {renderColumn("Amateur / Non-Pro", categorizedDivisions.amateurAdvanced)}
                               {renderColumn("Amateur / Non-Pro - Beginner", categorizedDivisions.amateurBeginner)}
                               {renderColumn("Youth", categorizedDivisions.youthAdvanced)}
                               {renderColumn("Youth - Beginner", categorizedDivisions.youthBeginner)}
                               {renderColumn("Walk-Trot", categorizedDivisions.walkTrot)}
                               {renderColumn("EWD", categorizedDivisions.ewd)}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        );
    };
    
    export default CommonDivisionsSelector;