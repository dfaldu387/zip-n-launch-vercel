import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
    Plus,
    Trash2,
    Image as ImageIcon,
    X,
    Loader2,
    Download,
    Eye,
    History,
    Save,
    RotateCcw,
    Sparkles,
    FileText,
    Copyright as CopyrightIcon,
} from 'lucide-react';
import {
    PAGE_MODES,
    buildInitialCustomLayout,
    defaultCopyright,
    flattenPatternItems,
} from '@/lib/customLayoutRenderer';
import { generatePatternBookPdf } from '@/lib/bookGenerator';
import { format } from 'date-fns';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

const newPageId = () => `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const normalizePage = (page) => {
    const slotCount = PAGE_MODES[page.mode]?.slots || 1;
    const slots = Array.from({ length: slotCount }, (_, i) => page.slots?.[i] ?? null);
    return {
        ...page,
        slots,
        roundLabel: page.roundLabel ?? '',
    };
};

const normalizeLayout = (layout, pbbData) => {
    const fallbackCopyright = defaultCopyright(pbbData || {});
    if (!layout) {
        return {
            pages: [],
            logo: null,
            coverDescription: '',
            copyright: fallbackCopyright,
        };
    }
    return {
        ...layout,
        pages: (layout.pages || []).map(normalizePage),
        logo: layout.logo || null,
        coverDescription: layout.coverDescription ?? '',
        copyright: layout.copyright ?? fallbackCopyright,
    };
};

const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

const PatternCard = ({ item, compact }) => (
    <div
        className={`border rounded-md bg-white p-2 ${
            compact ? 'text-xs' : 'text-sm'
        } shadow-sm`}
    >
        <div className="font-semibold truncate">{item.patternName}</div>
        <div className="text-[11px] text-muted-foreground truncate">
            {item.disciplineName}
            {item.associationName ? ` • ${item.associationName}` : ''}
        </div>
        {item.division && (
            <div className="text-[10px] text-muted-foreground truncate italic">
                {item.division}
            </div>
        )}
    </div>
);

const DraggablePattern = ({ item, source, disabled }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `drag::${source}::${item.id}`,
        data: { itemId: item.id, source },
        disabled,
    });
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
        >
            <PatternCard item={item} compact />
        </div>
    );
};

const Slot = ({ pageId, slotIndex, item, onRemove }) => {
    const id = `slot::${pageId}::${slotIndex}`;
    const { isOver, setNodeRef } = useDroppable({ id, data: { pageId, slotIndex } });

    return (
        <div
            ref={setNodeRef}
            className={`relative border-2 border-dashed rounded-md p-2 transition-colors flex flex-col justify-center ${
                isOver ? 'border-primary bg-primary/10' : item ? 'border-muted bg-muted/30' : 'border-muted'
            }`}
            style={{ minHeight: 90 }}
        >
            {item ? (
                <>
                    <DraggablePattern item={item} source={`slot::${pageId}::${slotIndex}`} />
                    <button
                        onClick={() => onRemove(pageId, slotIndex)}
                        className="absolute top-1 right-1 p-1 rounded bg-white/90 hover:bg-red-50 text-red-600 border shadow-sm"
                        title="Remove from slot"
                        type="button"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </>
            ) : (
                <div className="text-[11px] text-muted-foreground text-center select-none">
                    Drop pattern here
                </div>
            )}
        </div>
    );
};

const PageCard = ({
    page,
    pageIndex,
    itemsById,
    onModeChange,
    onRemovePage,
    onRemoveSlot,
    onRoundLabelChange,
}) => {
    const mode = PAGE_MODES[page.mode] ? page.mode : 'full';
    const gridCols = PAGE_MODES[mode].cols;
    const gridRows = PAGE_MODES[mode].rows;

    return (
        <div className="border rounded-lg bg-background shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Page {pageIndex + 1}</span>
                    <span className="text-xs text-muted-foreground">
                        ({PAGE_MODES[mode].label})
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={mode} onValueChange={(v) => onModeChange(page.id, v)}>
                        <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(PAGE_MODES).map(([key, cfg]) => (
                                <SelectItem key={key} value={key}>
                                    {cfg.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onRemovePage(page.id)}
                        title="Delete page"
                    >
                        <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/10">
                <Label className="text-[11px] text-muted-foreground shrink-0">
                    Round / Date:
                </Label>
                <Input
                    value={page.roundLabel || ''}
                    onChange={(e) => onRoundLabelChange(page.id, e.target.value)}
                    placeholder='e.g. "Round 1" or "April 9"'
                    className="h-7 text-xs"
                />
            </div>
            <div
                className="grid gap-2 p-3"
                style={{
                    gridTemplateColumns: `repeat(${gridCols}, minmax(0,1fr))`,
                    gridTemplateRows: `repeat(${gridRows}, minmax(110px,auto))`,
                    aspectRatio: '8.5 / 11',
                }}
            >
                {page.slots.map((slotItemId, slotIndex) => (
                    <Slot
                        key={`${page.id}-${slotIndex}`}
                        pageId={page.id}
                        slotIndex={slotIndex}
                        item={slotItemId ? itemsById.get(slotItemId) : null}
                        onRemove={onRemoveSlot}
                    />
                ))}
            </div>
        </div>
    );
};

function dataUriToBlob(dataUri) {
    const [header, base64] = dataUri.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const CustomLayoutBuilder = ({ open, onOpenChange, formData, setFormData }) => {
    const { toast } = useToast();
    const allItems = useMemo(() => flattenPatternItems(formData || {}), [formData]);
    const itemsById = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);

    const [layout, setLayout] = useState(() =>
        normalizeLayout(formData?.customLayout || buildInitialCustomLayout(formData || {}), formData)
    );
    const [activeDrag, setActiveDrag] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [busyLabel, setBusyLabel] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewLabel, setPreviewLabel] = useState('');
    const previewBlobRef = useRef(null);

    // Reset state only on open transitions false → true. While the dialog is
    // open, incoming customLayout changes from the parent (e.g. our own
    // "publish" mutation) must NOT clobber the live preview or the local
    // editing state.
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (open && !wasOpenRef.current) {
            setLayout(
                normalizeLayout(formData?.customLayout || buildInitialCustomLayout(formData || {}), formData)
            );
            setPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
            previewBlobRef.current = null;
            setPreviewLabel('');
        }
        wasOpenRef.current = open;
    }, [open, formData]);

    useEffect(
        () => () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        },
        [previewUrl]
    );

    const versions = formData?.customLayoutVersions || [];
    const nextVersionNumber = (versions[versions.length - 1]?.version || 0) + 1;

    // Derive placed/unplaced pattern items from current layout state.
    const placedItemIds = useMemo(() => {
        const set = new Set();
        layout.pages.forEach((p) => p.slots.forEach((s) => s && set.add(s)));
        return set;
    }, [layout]);

    const unplacedItems = useMemo(
        () => allItems.filter((i) => !placedItemIds.has(i.id)),
        [allItems, placedItemIds]
    );

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

    // ---- Layout mutation helpers ----
    const removeItemFromSlot = useCallback((pageId, slotIndex) => {
        setLayout((prev) => ({
            ...prev,
            pages: prev.pages.map((p) =>
                p.id === pageId
                    ? { ...p, slots: p.slots.map((s, i) => (i === slotIndex ? null : s)) }
                    : p
            ),
        }));
    }, []);

    const placeItemInSlot = useCallback((itemId, targetPageId, targetSlotIndex) => {
        setLayout((prev) => {
            // Find where the item currently lives (if any) so we can clear it
            let sourcePageId = null;
            let sourceSlotIndex = -1;
            prev.pages.forEach((p) => {
                p.slots.forEach((s, i) => {
                    if (s === itemId) {
                        sourcePageId = p.id;
                        sourceSlotIndex = i;
                    }
                });
            });

            // Item currently in the target slot (may be null) — gets pushed to source
            // if we're doing a slot-to-slot swap, otherwise goes back to unplaced.
            const targetPage = prev.pages.find((p) => p.id === targetPageId);
            const displaced = targetPage ? targetPage.slots[targetSlotIndex] : null;

            return {
                ...prev,
                pages: prev.pages.map((p) => {
                    let slots = p.slots;
                    if (p.id === sourcePageId && sourcePageId !== null) {
                        slots = slots.map((s, i) =>
                            i === sourceSlotIndex ? (sourcePageId === targetPageId && i === targetSlotIndex ? s : displaced) : s
                        );
                    }
                    if (p.id === targetPageId) {
                        slots = slots.map((s, i) => (i === targetSlotIndex ? itemId : s));
                    }
                    return slots === p.slots ? p : { ...p, slots };
                }),
            };
        });
    }, []);

    const handleModeChange = useCallback((pageId, newMode) => {
        setLayout((prev) => ({
            ...prev,
            pages: prev.pages.map((p) => {
                if (p.id !== pageId) return p;
                const newCount = PAGE_MODES[newMode].slots;
                const currentFilled = p.slots.filter(Boolean);
                const newSlots = Array.from({ length: newCount }, (_, i) => currentFilled[i] ?? null);
                // Items that no longer fit become unplaced (they just vanish from
                // the layout; the derived unplacedItems will pick them back up).
                return { ...p, mode: newMode, slots: newSlots };
            }),
        }));
    }, []);

    const handleAddPage = useCallback(() => {
        setLayout((prev) => ({
            ...prev,
            pages: [...prev.pages, { id: newPageId(), mode: 'full', slots: [null] }],
        }));
    }, []);

    const handleRemovePage = useCallback((pageId) => {
        setLayout((prev) => ({ ...prev, pages: prev.pages.filter((p) => p.id !== pageId) }));
    }, []);

    const handleResetLayout = useCallback(() => {
        setLayout(normalizeLayout(buildInitialCustomLayout(formData || {}), formData));
        toast({ title: 'Layout reset', description: 'Auto-populated with all patterns.' });
    }, [formData, toast]);

    const handleLogoUpload = useCallback(
        async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                toast({
                    title: 'Invalid file',
                    description: 'Logo must be an image (PNG, JPG, or SVG).',
                    variant: 'destructive',
                });
                return;
            }
            if (file.size > MAX_LOGO_BYTES) {
                toast({
                    title: 'File too large',
                    description: 'Logo must be under 2MB.',
                    variant: 'destructive',
                });
                return;
            }
            try {
                const dataUrl = await fileToDataUrl(file);
                setLayout((prev) => ({ ...prev, logo: { dataUrl, name: file.name } }));
            } catch (err) {
                console.error(err);
                toast({
                    title: 'Failed to read file',
                    description: err?.message || 'Unknown error',
                    variant: 'destructive',
                });
            }
        },
        [toast]
    );

    const handleRemoveLogo = useCallback(() => {
        setLayout((prev) => ({ ...prev, logo: null }));
    }, []);

    const handleCoverDescriptionChange = useCallback((value) => {
        setLayout((prev) => ({ ...prev, coverDescription: value }));
    }, []);

    const handleCopyrightChange = useCallback((value) => {
        setLayout((prev) => ({ ...prev, copyright: value }));
    }, []);

    const handleRoundLabelChange = useCallback((pageId, value) => {
        setLayout((prev) => ({
            ...prev,
            pages: prev.pages.map((p) => (p.id === pageId ? { ...p, roundLabel: value } : p)),
        }));
    }, []);

    // ---- DnD handlers ----
    const handleDragStart = useCallback((event) => {
        const { active } = event;
        const itemId = active.data?.current?.itemId;
        if (itemId) setActiveDrag({ itemId, source: active.data.current.source });
    }, []);

    const handleDragEnd = useCallback(
        (event) => {
            const { active, over } = event;
            setActiveDrag(null);
            if (!over) return;
            const itemId = active.data?.current?.itemId;
            if (!itemId) return;

            const overData = over.data?.current;
            if (overData?.pageId != null && overData?.slotIndex != null) {
                placeItemInSlot(itemId, overData.pageId, overData.slotIndex);
            } else if (over.id === 'unplaced-dropzone') {
                // Dragging back to the sidebar = remove from layout
                setLayout((prev) => ({
                    ...prev,
                    pages: prev.pages.map((p) => ({
                        ...p,
                        slots: p.slots.map((s) => (s === itemId ? null : s)),
                    })),
                }));
            }
        },
        [placeItemInSlot]
    );

    // ---- Save + Publish ----
    const persistLayout = useCallback(
        (patch = {}) => {
            setFormData((prev) => ({
                ...prev,
                customLayout: layout,
                ...patch,
            }));
        },
        [layout, setFormData]
    );

    const handleSaveLayout = useCallback(() => {
        persistLayout();
        toast({ title: 'Layout saved', description: 'Your custom layout has been saved as a draft.' });
    }, [persistLayout, toast]);

    const handlePublishAndGenerate = useCallback(async () => {
        if (isBusy) return;
        if (layout.pages.length === 0) {
            toast({
                title: 'No pages',
                description: 'Add at least one page before publishing.',
                variant: 'destructive',
            });
            return;
        }
        setIsBusy(true);
        setBusyLabel('Publishing…');
        try {
            const versionLabel = `v${nextVersionNumber}`;
            const publishedAt = new Date().toISOString();
            const snapshot = {
                pages: layout.pages.map((p) => ({ ...p, slots: [...p.slots] })),
                logo: layout.logo ? { ...layout.logo } : null,
                coverDescription: layout.coverDescription || '',
                copyright: layout.copyright || defaultCopyright(formData || {}),
            };
            const newVersionEntry = {
                version: nextVersionNumber,
                versionLabel,
                publishedAt,
                snapshot,
            };
            const newVersions = [...versions, newVersionEntry];

            // Generate PDF from the just-snapshotted layout
            const pbbData = {
                ...formData,
                customLayout: snapshot,
                layoutSelection: 'layout-c',
                customLayoutVersion: versionLabel,
                customLayoutPublishedAt: publishedAt,
            };
            const dataUri = await generatePatternBookPdf(pbbData);
            const blob = dataUriToBlob(dataUri);

            // Accessory Documents entry (kept as a local project_data record;
            // downloads are regenerated on demand from the snapshot).
            const accessoryDoc = {
                id: `custom-pattern-book-${versionLabel}`,
                kind: 'custom_pattern_book',
                label: `Custom Pattern Book — ${versionLabel}`,
                version: nextVersionNumber,
                versionLabel,
                publishedAt,
            };
            const existingAccessory = (formData?.customPatternBookDocuments || []).filter(
                (d) => d.versionLabel !== versionLabel
            );
            const accessoryDocs = [...existingAccessory, accessoryDoc];

            setFormData((prev) => ({
                ...prev,
                customLayout: snapshot,
                customLayoutVersions: newVersions,
                customPatternBookDocuments: accessoryDocs,
                customLayoutLastPublishedAt: publishedAt,
            }));

            if (previewUrl) URL.revokeObjectURL(previewUrl);
            const blobUrl = URL.createObjectURL(blob);
            previewBlobRef.current = blob;
            setPreviewUrl(blobUrl);
            setPreviewLabel(`${versionLabel} — ${format(new Date(publishedAt), 'MMM d, yyyy • h:mm a')}`);

            toast({
                title: `Published ${versionLabel}`,
                description:
                    'Added to Accessory Documents. Remember to Save Draft to persist.',
            });
        } catch (err) {
            console.error(err);
            toast({
                title: 'Publish failed',
                description: err?.message || 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setIsBusy(false);
            setBusyLabel('');
        }
    }, [
        formData,
        isBusy,
        layout,
        nextVersionNumber,
        previewUrl,
        setFormData,
        toast,
        versions,
    ]);

    const handlePreviewVersion = useCallback(
        async (versionEntry) => {
            if (isBusy) return;
            setIsBusy(true);
            setBusyLabel(`Generating ${versionEntry.versionLabel}…`);
            try {
                const pbbData = {
                    ...formData,
                    customLayout: versionEntry.snapshot,
                    layoutSelection: 'layout-c',
                    customLayoutVersion: versionEntry.versionLabel,
                    customLayoutPublishedAt: versionEntry.publishedAt,
                };
                const dataUri = await generatePatternBookPdf(pbbData);
                const blob = dataUriToBlob(dataUri);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                const blobUrl = URL.createObjectURL(blob);
                previewBlobRef.current = blob;
                setPreviewUrl(blobUrl);
                setPreviewLabel(
                    `${versionEntry.versionLabel} — ${
                        versionEntry.publishedAt
                            ? format(new Date(versionEntry.publishedAt), 'MMM d, yyyy • h:mm a')
                            : ''
                    }`
                );
            } catch (err) {
                console.error(err);
                toast({
                    title: 'Preview failed',
                    description: err?.message || 'Unknown error',
                    variant: 'destructive',
                });
            } finally {
                setIsBusy(false);
                setBusyLabel('');
            }
        },
        [formData, isBusy, previewUrl, toast]
    );

    const handleDownloadCurrent = useCallback(() => {
        if (!previewBlobRef.current) return;
        const showName = formData?.showName || 'Pattern-Book';
        const name = `${showName}_Custom_${previewLabel.split(' — ')[0] || 'v'}.pdf`;
        triggerDownload(previewBlobRef.current, name);
    }, [formData?.showName, previewLabel]);

    const handleClosePreview = useCallback(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        previewBlobRef.current = null;
        setPreviewLabel('');
    }, [previewUrl]);

    const activeItem = activeDrag ? itemsById.get(activeDrag.itemId) : null;

    // ---- Render ----
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 flex flex-col">
                {previewUrl ? (
                    <>
                        <DialogHeader className="px-6 pt-5 pb-3 border-b">
                            <div className="flex items-center justify-between gap-3 pr-10">
                                <DialogTitle>Preview — {previewLabel}</DialogTitle>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" variant="outline" onClick={handleDownloadCurrent}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={handleClosePreview}>
                                        Back to Builder
                                    </Button>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="flex-1 min-h-0 bg-muted/20">
                            <iframe
                                title="Custom Layout Preview"
                                src={previewUrl}
                                className="w-full h-full border-0"
                            />
                        </div>
                    </>
                ) : (
                    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                        <DialogHeader className="px-6 pt-5 pb-3 border-b">
                            <div className="flex flex-wrap items-center justify-between gap-3 pr-10">
                                <div>
                                    <DialogTitle>Layout C — Custom Pattern Book</DialogTitle>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Drag patterns into slots. Choose a mode per page. Next version: v
                                        {nextVersionNumber}.
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleResetLayout}
                                        disabled={isBusy}
                                    >
                                        <RotateCcw className="h-4 w-4 mr-2" /> Reset
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleSaveLayout}
                                        disabled={isBusy}
                                    >
                                        <Save className="h-4 w-4 mr-2" /> Save Draft
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handlePublishAndGenerate}
                                        disabled={isBusy}
                                    >
                                        {isBusy ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                {busyLabel || 'Working…'}
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="h-4 w-4 mr-2" />
                                                Publish v{nextVersionNumber}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 min-h-0 grid grid-cols-[300px_1fr_280px]">
                            {/* Left: Unplaced patterns */}
                            <UnplacedPanel items={unplacedItems} totalCount={allItems.length} />

                            {/* Center: Pages */}
                            <div className="border-x min-h-0 flex flex-col">
                                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                                    <div className="text-sm font-semibold">
                                        Pages ({layout.pages.length})
                                    </div>
                                    <Button size="sm" variant="outline" onClick={handleAddPage}>
                                        <Plus className="h-4 w-4 mr-2" /> Add Page
                                    </Button>
                                </div>
                                <ScrollArea className="flex-1">
                                    <div className="p-4 space-y-4">
                                        {layout.pages.length === 0 ? (
                                            <div className="border-2 border-dashed rounded-lg p-10 text-center text-sm text-muted-foreground">
                                                No pages yet. Click "Add Page" to start.
                                            </div>
                                        ) : (
                                            layout.pages.map((page, idx) => (
                                                <PageCard
                                                    key={page.id}
                                                    page={page}
                                                    pageIndex={idx}
                                                    itemsById={itemsById}
                                                    onModeChange={handleModeChange}
                                                    onRemovePage={handleRemovePage}
                                                    onRemoveSlot={removeItemFromSlot}
                                                    onRoundLabelChange={handleRoundLabelChange}
                                                />
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Right: Logo + Cover text + Copyright + Versions */}
                            <RightPanel
                                layout={layout}
                                versions={versions}
                                onLogoUpload={handleLogoUpload}
                                onRemoveLogo={handleRemoveLogo}
                                onCoverDescriptionChange={handleCoverDescriptionChange}
                                onCopyrightChange={handleCopyrightChange}
                                onPreviewVersion={handlePreviewVersion}
                                isBusy={isBusy}
                            />
                        </div>

                        <DragOverlay>
                            {activeItem ? (
                                <div className="w-[260px]">
                                    <PatternCard item={activeItem} />
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </DialogContent>
        </Dialog>
    );
};

// ---- Left panel: unplaced patterns (also acts as a drop target to remove) ----
const UnplacedPanel = ({ items, totalCount }) => {
    const { isOver, setNodeRef } = useDroppable({ id: 'unplaced-dropzone' });
    return (
        <div ref={setNodeRef} className="min-h-0 flex flex-col bg-muted/20">
            <div className="px-4 py-2 border-b bg-muted/40">
                <div className="text-sm font-semibold">Unplaced Patterns</div>
                <div className="text-[11px] text-muted-foreground">
                    {items.length} of {totalCount} remaining
                </div>
            </div>
            <ScrollArea className="flex-1">
                <div
                    className={`p-3 space-y-2 transition-colors ${
                        isOver ? 'bg-primary/5' : ''
                    }`}
                >
                    {items.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">
                            All patterns are placed on pages.
                        </div>
                    ) : (
                        items.map((item) => (
                            <DraggablePattern key={item.id} item={item} source="unplaced" />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

// ---- Right panel: logo upload + cover text + copyright + version history ----
const RightPanel = ({
    layout,
    versions,
    onLogoUpload,
    onRemoveLogo,
    onCoverDescriptionChange,
    onCopyrightChange,
    onPreviewVersion,
    isBusy,
}) => (
    <div className="min-h-0 flex flex-col">
        <ScrollArea className="flex-1">
            <div>
                <div className="px-4 py-2 border-b bg-muted/30">
                    <div className="text-sm font-semibold flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" /> Logo
                    </div>
                </div>
                <div className="p-3 border-b space-y-2">
                    {layout.logo ? (
                        <div className="space-y-2">
                            <div className="border rounded-md bg-white p-2 flex items-center justify-center h-24">
                                <img
                                    src={layout.logo.dataUrl}
                                    alt="Logo preview"
                                    className="max-h-20 max-w-full object-contain"
                                />
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="truncate">{layout.logo.name}</span>
                                <Button size="sm" variant="ghost" onClick={onRemoveLogo}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Label className="border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/20">
                            <ImageIcon className="h-6 w-6 mb-1" />
                            Upload Logo (PNG/JPG, &lt; 2MB)
                            <Input type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />
                        </Label>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                        Large on the cover; top-right corner of every page.
                    </p>
                </div>

                <div className="px-4 py-2 border-b bg-muted/30">
                    <div className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Cover Description
                    </div>
                </div>
                <div className="p-3 border-b space-y-1">
                    <Textarea
                        value={layout.coverDescription || ''}
                        onChange={(e) => onCoverDescriptionChange(e.target.value)}
                        placeholder={`e.g. "Western Riding – both rounds dependent upon arena set up.\nRanch Riding Round 1 – all courses Pattern 7..."`}
                        rows={6}
                        className="text-xs resize-y"
                    />
                    <p className="text-[11px] text-muted-foreground">
                        Free-form paragraph shown under the title on the cover page.
                    </p>
                </div>

                <div className="px-4 py-2 border-b bg-muted/30">
                    <div className="text-sm font-semibold flex items-center gap-2">
                        <CopyrightIcon className="h-4 w-4" /> Copyright Footer
                    </div>
                </div>
                <div className="p-3 border-b space-y-1">
                    <Input
                        value={layout.copyright || ''}
                        onChange={(e) => onCopyrightChange(e.target.value)}
                        placeholder="© 2026 Show Name"
                        className="text-xs h-8"
                    />
                    <p className="text-[11px] text-muted-foreground">
                        Appears bottom-left on every pattern page.
                    </p>
                </div>

                <div className="px-4 py-2 border-b bg-muted/30">
                    <div className="text-sm font-semibold flex items-center gap-2">
                        <History className="h-4 w-4" /> Published Versions
                    </div>
                </div>
                <div className="p-3 space-y-2">
                    {versions.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">
                            No versions published yet.
                        </div>
                    ) : (
                        [...versions].reverse().map((v) => (
                            <div key={v.versionLabel} className="border rounded-md p-2 bg-white">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold">{v.versionLabel}</span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onPreviewVersion(v)}
                                        disabled={isBusy}
                                    >
                                        <Eye className="h-3 w-3 mr-1" /> View
                                    </Button>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    {v.publishedAt
                                        ? format(new Date(v.publishedAt), 'MMM d, yyyy • h:mm a')
                                        : ''}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    {v.snapshot?.pages?.length || 0} page(s)
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </ScrollArea>
    </div>
);

export default CustomLayoutBuilder;
