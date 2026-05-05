import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card as UICard, CardContent as UICardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PatternGroupPreview = ({ group, patterns, selectedPatternId, selectedPatternDetail, onPatternSelect, primaryAffiliates = new Set() }) => {
    const [imageZoom, setImageZoom] = useState(1);
    const [hoveredPatternImage, setHoveredPatternImage] = useState(null);
    const [hoveredPatternId, setHoveredPatternId] = useState(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    
    useEffect(() => {
        if (patterns.length > 0 && !selectedPatternId) {
            onPatternSelect(patterns[0].id);
        }
    }, [patterns, selectedPatternId, onPatternSelect]);

    // Display empty state if no patterns
    if (!patterns || patterns.length === 0) {
        return (
            <div className="p-4 border rounded-lg bg-card">
                <div className="mb-3 relative">
                    {group.name === 'Group 1' ? (
                        <div className={`flex items-center gap-2`}>
                            {selectedPatternDetail && (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs hover:bg-green-200 hover:text-green-900">
                                    {(() => {
                                        const patternName = selectedPatternDetail.pdf_file_name || '';
                                        const match = patternName.match(/PATTERN\s*\d+/i);
                                        const shortName = match ? match[0].toUpperCase() : patternName;
                                        const version = selectedPatternDetail.pattern_version || 'ALL';
                                        return `${shortName} (${version})`;
                                    })()}
                                </Badge>
                            )}
                        </div>
                    ) : (
                        <div className={`flex items-center gap-2`}>
                            {selectedPatternDetail && (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs hover:bg-green-200 hover:text-green-900">
                                    {(() => {
                                        const patternName = selectedPatternDetail.pdf_file_name || '';
                                        const match = patternName.match(/PATTERN\s*\d+/i);
                                        const shortName = match ? match[0].toUpperCase() : patternName;
                                        const version = selectedPatternDetail.pattern_version || 'ALL';
                                        return `${shortName} (${version})`;
                                    })()}
                                </Badge>
                            )}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
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
                                <Badge key={`${div.assocId}-${div.division}`} variant="secondary" className="text-xs bg-slate-700 text-white">
                                    {displayName} - {div.level || div.divisionLevel || 'All'}
                                </Badge>
                            );
                        })}
                    </div>
                </div>
            
            {/* Selected Pattern Details (Media & Maneuvers) for Empty State */}
            {selectedPatternDetail && (
                <div className="mb-4 space-y-4">
                     {/* Media Section using Carousel Design */}
                     {selectedPatternDetail.media && selectedPatternDetail.media.length > 0 ? (
                        <Carousel 
                            opts={{ align: "center" }} 
                            className="w-full"
                            style={{ overflow: 'visible' }}
                        >
                            <CarouselContent className="flex items-center justify-center" style={{ overflow: 'visible' }}>
                                {selectedPatternDetail.media.map((mediaItem, idx) => (
                                    <CarouselItem key={idx} className="pl-2 md:pl-4 basis-full">
                                        <div className="p-1">
                                            <UICard className="bg-white dark:bg-slate-50 border-slate-300" style={{ overflow: 'visible' }}>
                                                <UICardContent className="flex items-center justify-center p-2 flex-col min-h-[520px]" style={{ overflow: 'visible' }}>
                                                    <div className="relative w-full h-full flex items-center justify-center bg-white border-2 border-dashed border-slate-300 rounded-sm m-2" style={{ overflow: 'visible' }}>
                                                        {mediaItem && (
                                                            <>
                                                                <div 
                                                                    className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                                                                    onMouseEnter={(e) => {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        setHoveredPatternImage(mediaItem.image_url || mediaItem.media_url);
                                                                        setHoveredPatternId(`${idx}-${mediaItem.id || idx}`);
                                                                        setImageZoom(1);
                                                                        // Position to the right of the image
                                                                        setHoverPosition({ 
                                                                            x: rect.right + 20, 
                                                                            y: rect.top + (rect.height / 2) 
                                                                        });
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        // Don't hide immediately - let the preview handle its own mouse leave
                                                                        const relatedTarget = e.relatedTarget;
                                                                        if (relatedTarget && relatedTarget.closest('.pattern-hover-preview')) {
                                                                            return; // Moving to preview, don't hide
                                                                        }
                                                                        setTimeout(() => {
                                                                            setHoveredPatternId(null);
                                                                        }, 100);
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={mediaItem.image_url || mediaItem.media_url}
                                                                        alt="Pattern Media"
                                                                        className="w-full h-auto max-h-[560px] object-contain border border-slate-300 rounded mx-auto bg-white"
                                                                    />
                                                                </div>
                                                                {/* Hover Preview - Rendered via portal at body level */}
                                                                {hoveredPatternId === `${idx}-${mediaItem.id || idx}` && typeof document !== 'undefined' && createPortal(
                                                                    <div
                                                                        className="pattern-hover-preview fixed z-[9999] bg-background border-2 border-dashed border-slate-700 rounded-lg shadow-lg p-4 w-[600px] max-w-[90vw] pointer-events-auto"
                                                                        style={{
                                                                            left: `${hoverPosition.x}px`,
                                                                            top: `${hoverPosition.y}px`,
                                                                            transform: 'translateY(-50%)',
                                                                            maxHeight: '75vh'
                                                                        }}
                                                                        onMouseEnter={() => {
                                                                            // Keep preview visible when hovering over it
                                                                            if (hoveredPatternId === `${idx}-${mediaItem.id || idx}`) {
                                                                                setHoveredPatternId(`${idx}-${mediaItem.id || idx}`);
                                                                            }
                                                                        }}
                                                                        onMouseLeave={() => {
                                                                            setHoveredPatternId(null);
                                                                        }}
                                                                    >
                                                                        <div className="space-y-2">
                                                                            <h4 className="font-medium text-sm mb-2">Pattern Image</h4>
                                                                            <div className="rounded-md border-2 border-dashed border-slate-700 bg-slate-900/50 p-4 relative" style={{ 
                                                                                overflow: 'auto',
                                                                                maxHeight: '65vh',
                                                                                display: 'flex',
                                                                                justifyContent: 'center',
                                                                                alignItems: 'flex-start'
                                                                            }}>
                                                                                {hoveredPatternImage ? (
                                                                                    <>
                                                                                        <img 
                                                                                            src={hoveredPatternImage} 
                                                                                            alt="Pattern Diagram - Zoomed" 
                                                                                            className="transition-transform duration-200 w-full h-auto object-contain"
                                                                                            loading="lazy"
                                                                                            style={{ 
                                                                                                transform: `scale(${imageZoom})`,
                                                                                                transformOrigin: 'center',
                                                                                                maxWidth: '100%',
                                                                                                maxHeight: '60vh',
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
                                                                                    </>
                                                                                ) : (
                                                                                    <div className="text-sm text-muted-foreground py-4">
                                                                                        No image available.
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>,
                                                                    document.body
                                                                )}
                                                            </>
                                                        )}

                                                        {/* Maneuvers Overlay */}
                                                        {selectedPatternDetail.maneuvers && selectedPatternDetail.maneuvers.length > 0 && (
                                                            <div className="absolute bottom-0 left-0 w-full bg-black/60 backdrop-blur-sm text-white transition-all duration-300 h-8 hover:h-[90%] overflow-hidden z-10 flex flex-col">
                                                                <div className="flex items-center justify-center h-8 flex-shrink-0 border-t border-white/10 bg-black/40 font-semibold text-xs uppercase tracking-wider cursor-pointer">
                                                                    Maneuvers
                                                                </div>
                                                                <div className="p-4 overflow-y-auto flex-1 text-left">
                                                                    <ol className="list-decimal list-inside space-y-2 text-xs text-slate-200">
                                                                        {selectedPatternDetail.maneuvers.map((step) => (
                                                                            <li key={step.id || step.step_no} className="pl-1 leading-relaxed">
                                                                                <span>{step.instruction}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ol>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </UICardContent>
                                                <div className="p-3 border-t border-slate-700 text-center space-y-2">
                                                    <p className="text-xs font-semibold text-foreground truncate">{selectedPatternDetail.pdf_file_name}</p>
                                                </div>
                                            </UICard>
                                        </div>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                        </Carousel>
                     ) : (
                        <div className="w-full h-48 flex items-center justify-center bg-slate-900 border-2 border-dashed border-slate-700 rounded-sm">
                            <span className="text-muted-foreground text-sm">No Preview Media Available</span>
                        </div>
                     )}
                </div>
            )}
            {!selectedPatternDetail && (
                <div className="text-center text-muted-foreground p-4 border border-dashed rounded-md">
                    No approved patterns found for this group.
                </div>
            )}
            </div>
        );
    }

    const initialSelectionIndex = Math.max(0, patterns.findIndex(p => p.id === selectedPatternId));

    return (
        <div className="p-4 border rounded-lg bg-card">
            {/* Group Header */}
      
        </div>
    );
};

export default PatternGroupPreview;