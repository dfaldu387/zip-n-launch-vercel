import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSignature } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAnalytics } from '@/components/AnalyticsProvider';

export const PatternResultCard = ({ item }) => {
    const { toast } = useToast();
    const { trackPatternEvent } = useAnalytics();
    const viewStartTimeRef = useRef(null);
    const hasTrackedViewRef = useRef(false);

    // Track when card becomes visible (view event)
    useEffect(() => {
        if (!hasTrackedViewRef.current && item?.id) {
            viewStartTimeRef.current = Date.now();
            hasTrackedViewRef.current = true;
            
            // Track view event
            trackPatternEvent('view', {
                patternId: item.id,
                discipline: item.class_name || item.class,
                difficultyLevel: item.difficulty,
                associationId: item.association_id || item.association,
            });
        }

        return () => {
            // Track time spent when unmounting
            if (viewStartTimeRef.current && item?.id) {
                const timeSpent = Math.round((Date.now() - viewStartTimeRef.current) / 1000);
                if (timeSpent > 0) {
                    trackPatternEvent('view_end', {
                        patternId: item.id,
                        discipline: item.class_name || item.class,
                        difficultyLevel: item.difficulty,
                        associationId: item.association_id || item.association,
                        timeSpent: timeSpent,
                    });
                }
            }
        };
    }, [item?.id, trackPatternEvent]);

    const handleDownload = async () => {
        if (!item.file_url && !item.pdf_url) {
            toast({
                title: "Download Not Available",
                description: "This item does not have a downloadable file.",
                variant: 'destructive'
            });
            return;
        }
        
        // Calculate time spent before download
        const timeSpent = viewStartTimeRef.current 
            ? Math.round((Date.now() - viewStartTimeRef.current) / 1000) 
            : 0;
        
        // Track download event with time spent
        trackPatternEvent('download', {
            patternId: item.id,
            discipline: item.class_name || item.class,
            difficultyLevel: item.difficulty,
            associationId: item.association_id || item.association,
            timeSpent: timeSpent,
        });
        
        // Use blob download to force file save instead of opening in browser
        const url = item.file_url || item.pdf_url;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = item.display_name || item.name || 'pattern.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch {
            window.open(url, '_blank');
        }
    };

    const handleAddToCart = () => {
        toast({
            title: "🚧 Feature Coming Soon!",
            description: "Adding items to the cart will be available shortly. 🚀",
        });
    }

    return (
        <Card className="flex flex-col h-full bg-secondary/50 hover:border-primary/50 transition-all duration-300 group">
            <CardHeader>
                <div className="aspect-[4/3] bg-background rounded-lg mb-4 flex items-center justify-center pattern-grid overflow-hidden relative">
                    {item.preview_image_url ? (
                        <img-replace src={item.preview_image_url} alt={item.display_name || item.name} className="w-full h-full object-contain rounded-lg p-2 opacity-90 group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                        <div className="text-muted-foreground/50">No Preview</div>
                    )}
                     <Badge variant="secondary" className="absolute top-2 left-2 capitalize">
                        {item.type === 'pattern' ? <FileText className="h-4 w-4 mr-1.5" /> : <FileSignature className="h-4 w-4 mr-1.5" />}
                        {item.type}
                    </Badge>
                </div>
                <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">{item.display_name || item.name}</CardTitle>
                <CardDescription className="text-xs">{item.class_name || item.class}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                 <div className="flex flex-wrap gap-1 text-xs">
                    {item.type === 'pattern' ? (
                        <>
                            <Badge variant="outline">{item.difficulty || 'N/A'}</Badge>
                            <Badge variant="outline">{item.pattern_type || 'Custom'}</Badge>
                        </>
                    ) : (
                         <Badge variant="outline">{item.association || 'General'}</Badge>
                    )}
                 </div>
            </CardContent>
            <CardFooter className="flex gap-2">
                <Button onClick={handleDownload} className="flex-1" disabled={!item.file_url && !item.pdf_url}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                </Button>
                {/* <Button variant="outline" onClick={handleAddToCart} className="flex-1">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart
                </Button> */}
            </CardFooter>
        </Card>
    );
};