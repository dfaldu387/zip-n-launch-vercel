import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// Palette offered for a pattern book cover.
const COVER_COLORS = [
    '#4BCE97', '#F5CD47', '#FEA362', '#F87168', '#E774BB', '#C59CDF',
    '#579DFF', '#6CC3E0', '#94C748', '#E388A3'
];

const CoverColorDialog = ({ open, onClose, currentColor, onSelectColor, onRemoveCover }) => {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[320px]">
                <DialogHeader>
                    <DialogTitle>Cover</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">Size</p>
                        <div className="flex gap-2">
                            <div className="flex-1 h-12 bg-muted rounded border-2 border-primary flex items-center justify-center">
                                <div className="w-full h-2 bg-primary/30 mx-4 rounded" />
                            </div>
                            <div className="flex-1 h-12 bg-muted rounded border flex items-center justify-center">
                                <div className="w-full h-full bg-primary/20 rounded" />
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" className="w-full" onClick={onRemoveCover}>
                        Remove cover
                    </Button>
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">Colors</p>
                        <div className="grid grid-cols-5 gap-2">
                            {COVER_COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => onSelectColor(color)}
                                    className={`w-10 h-8 rounded cursor-pointer transition-all hover:scale-110 ${currentColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CoverColorDialog;
