import React, { useEffect, useState } from 'react';
import { Card as UICard, CardContent as UICardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { FileText } from 'lucide-react';

const ScoresheetGroupPreview = ({ group, scoresheets = [], selectedScoresheetId, onScoresheetSelect, primaryAffiliates = new Set(), scoresheetImage, hideGroupName = false }) => {
    const [imageZoom, setImageZoom] = useState(1);
    
    useEffect(() => {
        if (scoresheets.length > 0 && !selectedScoresheetId) {
            onScoresheetSelect(scoresheets[0].id);
        }
    }, [scoresheets, selectedScoresheetId, onScoresheetSelect]);

    // Always show the scoresheet if available, even without scoresheet data in the group
    return (
        <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/30">
            <div className="mb-2">
                {!hideGroupName && <p className="font-semibold">{group.name}</p>}
                <div className="flex flex-wrap gap-1 mt-1">
                    {(group.divisions || []).map(div => {
                        // Remove first word, "Pro", and "Non-Pro" from division name
                        const divisionName = div.division || '';
                        const removeFirstWord = (name) => {
                            if (!name) return name;
                            let cleaned = name;
                            
                            // Remove first word and any separator (dash, hyphen, etc.)
                            cleaned = cleaned.replace(/^[^\s-]+\s*[-–—]\s*/, '').trim();
                            
                            // Remove "Pro" or "Non-Pro" at the start
                            cleaned = cleaned.replace(/^(Pro|Non-Pro)\s*[-–—]?\s*/i, '').trim();
                            
                            // If no separator found and still original, try removing just the first word
                            if (cleaned === name) {
                                const parts = name.split(/\s+/);
                                // Skip first word if it's not "Pro" or "Non-Pro"
                                if (parts.length > 1 && !/^(Pro|Non-Pro)$/i.test(parts[0])) {
                                    cleaned = parts.slice(1).join(' ');
                                } else if (parts.length > 1) {
                                    // If first word is "Pro" or "Non-Pro", remove it and separator if present
                                    cleaned = parts.slice(1).join(' ').replace(/^\s*[-–—]\s*/, '').trim();
                                }
                            }
                            
                            return cleaned || name;
                        };
                        const displayName = removeFirstWord(divisionName);
                        
                        return (
                            <Badge key={`${div.assocId}-${div.division}`} variant="secondary" className="text-xs">{displayName}</Badge>
                        );
                    })}
                </div>
            </div>
            
            <div className="p-1 w-full mx-auto">
                <UICard className="overflow-hidden transition-all duration-300 bg-white dark:bg-slate-50 border-slate-300">
                    <UICardContent className="flex items-center justify-center p-2 flex-col min-h-[520px]">
                        {/* Scoresheet Preview Area */}
                        <div className="w-full h-full flex items-center justify-center bg-white border-2 border-dashed border-slate-300 rounded-sm m-2">
                            {scoresheetImage && scoresheetImage.image_url ? (
                                <HoverCard
                                    openDelay={200}
                                    closeDelay={100}
                                    onOpenChange={(open) => {
                                        if (open) {
                                            setImageZoom(1); // Reset zoom when opening
                                        }
                                    }}
                                >
                                    <HoverCardTrigger asChild>
                                        <div className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity">
                                            <img
                                                src={scoresheetImage.image_url}
                                                alt="Scoresheet"
                                                className="w-full h-auto max-h-[560px] object-contain border border-slate-300 rounded mx-auto bg-white"
                                            />
                                        </div>
                                    </HoverCardTrigger>
                                    <HoverCardContent 
                                        className="p-4 z-[9999] w-[600px] max-w-[90vw]" 
                                        align="center" 
                                        side="right" 
                                        sideOffset={10}
                                        style={{ 
                                            zIndex: 9999,
                                            maxHeight: '85vh'
                                        }}
                                    >
                                        <div className="space-y-2">
                                            <h4 className="font-medium text-sm mb-2">Scoresheet Image</h4>
                                            <div className="rounded-md border-2 border-dashed border-slate-700 bg-slate-900/50 p-4 relative" style={{ 
                                                overflow: 'auto',
                                                maxHeight: '75vh',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'flex-start'
                                            }}>
                                                <img 
                                                    src={scoresheetImage.image_url} 
                                                    alt="Scoresheet - Zoomed" 
                                                    className="transition-transform duration-200 w-full h-auto object-contain"
                                                    loading="lazy"
                                                    style={{ 
                                                        transform: `scale(${imageZoom})`,
                                                        transformOrigin: 'center',
                                                        maxWidth: '100%',
                                                        maxHeight: '70vh',
                                                        display: 'block'
                                                    }}
                                                />
                                                {/* Zoom Controls */}
                                                <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/95 backdrop-blur-sm rounded-md p-1 border shadow-lg z-10">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setImageZoom(prev => Math.min(prev + 0.25, 3));
                                                        }}
                                                        title="Zoom In"
                                                    >
                                                        <ZoomIn className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setImageZoom(prev => Math.max(prev - 0.25, 0.5));
                                                        }}
                                                        title="Zoom Out"
                                                    >
                                                        <ZoomOut className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setImageZoom(1);
                                                        }}
                                                        title="Reset Zoom"
                                                    >
                                                        <RotateCcw className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                {/* Zoom Level Indicator */}
                                                {imageZoom !== 1 && (
                                                    <div className="absolute bottom-2 left-2 bg-background/95 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium border shadow-lg z-10">
                                                        {Math.round(imageZoom * 100)}%
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </HoverCardContent>
                                </HoverCard>
                            ) : (
                                <span className="text-muted-foreground text-sm">No Scoresheet Available</span>
                            )}
                        </div>
                    </UICardContent>
                    {/* Scoresheet Info Footer */}
                    <div className="p-3 border-t border-slate-700 text-center space-y-2">
                        <p className="text-xs font-semibold text-foreground truncate">
                            {scoresheetImage ? 'Scoresheet' : 'No Scoresheet'}
                        </p>
                    </div>
                </UICard>
            </div>
        </div>
    );
};

export default ScoresheetGroupPreview;