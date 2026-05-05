import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDraggable } from '@dnd-kit/core';
import { Document, Page } from 'react-pdf';
import { Upload, X, GripVertical, Loader2, Pencil, Check, ArrowRightToLine, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const StagedPdfItem = ({ pdf, onRemove, onRename, onAssign, availableSlots }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(pdf.displayName || '');
    const [previewOpen, setPreviewOpen] = useState(false);

    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `staged-${pdf.id}`,
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
        position: 'relative',
    } : undefined;

    const handleRenameConfirm = () => {
        const trimmed = editName.trim();
        if (trimmed && trimmed !== pdf.displayName) {
            onRename(pdf.id, trimmed);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleRenameConfirm();
        if (e.key === 'Escape') {
            setEditName(pdf.displayName || '');
            setIsEditing(false);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="relative group"
        >
            <div className="p-2 border rounded-lg bg-background space-y-1.5">
                <div className="flex items-center gap-2">
                    <div {...listeners} {...attributes} className="cursor-grab touch-none">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        title="Click to preview full size"
                        className="w-12 h-16 bg-secondary rounded-sm overflow-hidden flex items-center justify-center flex-shrink-0 relative group/thumb hover:ring-2 hover:ring-primary transition-all cursor-zoom-in"
                    >
                        <Document file={pdf.dataUrl} loading={<Loader2 className="h-4 w-4 animate-spin" />}>
                            <Page pageNumber={1} width={48} height={64} renderAnnotationLayer={false} renderTextLayer={false} />
                        </Document>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className="h-4 w-4 text-white" />
                        </div>
                    </button>
                    <div className="flex-1 overflow-hidden min-w-0">
                        {isEditing ? (
                            <div className="flex items-center gap-1">
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={handleRenameConfirm}
                                    onKeyDown={handleKeyDown}
                                    className="h-6 text-xs px-1"
                                    autoFocus
                                />
                                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={handleRenameConfirm}>
                                    <Check className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <p className="text-xs font-medium truncate">{pdf.displayName || pdf.originalFileName}</p>
                        )}
                        <Badge variant="outline" className="mt-0.5">Page {pdf.pageNumber}</Badge>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {!isEditing && (
                            <>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewOpen(true)} title="Preview">
                                    <Eye className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditName(pdf.displayName || ''); setIsEditing(true); }} title="Rename">
                                    <Pencil className="h-3 w-3" />
                                </Button>
                            </>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(pdf.id)} title="Remove">
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
                {availableSlots && availableSlots.length > 0 && (
                    <div className="flex items-center gap-1.5 pl-7">
                        <ArrowRightToLine className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <Select onValueChange={(slotId) => onAssign(pdf.id, slotId)}>
                            <SelectTrigger className="h-6 text-xs flex-1">
                                <SelectValue placeholder="Assign to slot..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableSlots.map((slot) => (
                                    <SelectItem key={slot.id} value={slot.id} className="text-xs">
                                        {slot.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="truncate">{pdf.displayName || pdf.originalFileName}</span>
                            <Badge variant="outline" className="ml-2 flex-shrink-0">Page {pdf.pageNumber}</Badge>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center bg-secondary/40 rounded-md p-3">
                        <Document file={pdf.dataUrl} loading={<Loader2 className="h-6 w-6 animate-spin" />}>
                            <Page
                                pageNumber={1}
                                width={720}
                                renderAnnotationLayer={false}
                                renderTextLayer={false}
                            />
                        </Document>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const PdfStagingArea = ({ stagedPdfs, onPdfSplit, onRemove, onRename, onAssign, availableSlots }) => {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: acceptedFiles => acceptedFiles.forEach(onPdfSplit),
        accept: { 'application/pdf': ['.pdf'] },
    });

    return (
        <div className="space-y-2">
            <div
                {...getRootProps()}
                className={cn(
                    "p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all duration-200",
                    isDragActive
                        ? "border-primary bg-gradient-to-b from-primary/10 to-primary/5 scale-[1.01]"
                        : "border-muted-foreground/30 hover:border-primary/60 hover:bg-gradient-to-b hover:from-primary/5 hover:to-transparent"
                )}
            >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                    {isDragActive ? 'Drop PDF here' : 'Drop multi-page PDF here'}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">or click to browse — max 5 pages per PDF</p>
            </div>
            <ScrollArea className="h-96">
                <div className="space-y-2 pr-3">
                    {stagedPdfs.map(pdf => (
                        <StagedPdfItem
                            key={pdf.id}
                            pdf={pdf}
                            onRemove={onRemove}
                            onRename={onRename}
                            onAssign={onAssign}
                            availableSlots={availableSlots}
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};

export default PdfStagingArea;
