import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { generatePatternBookPdf } from '@/lib/bookGenerator';
import { Loader2, Eye, Download, Sparkles, ExternalLink } from 'lucide-react';
import CustomLayoutBuilder from '@/components/pbb/CustomLayoutBuilder';
import { format } from 'date-fns';

/**
 * Convert a data URI string to a Blob.
 */
function dataUriToBlob(dataUri) {
    const [header, base64] = dataUri.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

// In-memory PDF blob cache — key: `${projectId}::${updatedAt}::${layout}`
// Prevents re-generating the same PDF when user clicks View/Download repeatedly.
const pdfBlobCache = new Map();
const PDF_CACHE_MAX = 20;

function getCacheKey(project, layout) {
    const id = project?.id || 'anon';
    const updated = project?.updated_at || project?.project_data?.updated_at || '0';
    // Layout C varies by the latest published snapshot — include its publishedAt
    // so a fresh publish busts the cache even if the project's updated_at hasn't
    // persisted yet.
    let layoutTag = layout;
    if (layout === 'layout-c') {
        const versions = project?.project_data?.customLayoutVersions || [];
        const latest = versions[versions.length - 1];
        if (latest) layoutTag = `layout-c::${latest.versionLabel}::${latest.publishedAt || ''}`;
    }
    return `${id}::${updated}::${layoutTag}`;
}

function putCache(key, blob) {
    if (pdfBlobCache.size >= PDF_CACHE_MAX) {
        const firstKey = pdfBlobCache.keys().next().value;
        pdfBlobCache.delete(firstKey);
    }
    pdfBlobCache.set(key, blob);
}

async function getOrGenerateBlob(project, layout, buildPbbData) {
    const key = getCacheKey(project, layout);
    const cached = pdfBlobCache.get(key);
    if (cached) return cached;
    const pbbData = buildPbbData(layout);
    const pdfDataUri = await generatePatternBookPdf(pbbData);
    const blob = dataUriToBlob(pdfDataUri);
    putCache(key, blob);
    return blob;
}

function triggerForceDownload(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

/**
 * Reusable Pattern Book Download Dialog
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange: (open: boolean) => void
 *  - project: { id, project_name, project_data }
 *  - setFormData: optional setter used by Layout C's builder to persist layout
 *    changes back onto the parent's formData. When omitted, Layout C only
 *    offers View/Download of the latest published version.
 */
const PatternBookDownloadDialog = ({ open, onOpenChange, project, setFormData }) => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [generatingAction, setGeneratingAction] = useState(null); // 'view-a' | 'download-a' | 'view-b' | 'download-b' | 'view-c' | 'download-c' | null
    const [builderOpen, setBuilderOpen] = useState(false);
    // URL of the generated PDF currently being previewed inline inside the
    // dialog. When set, the dialog shows an embedded iframe instead of the
    // layout buttons so the user never leaves the page.
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewLabel, setPreviewLabel] = useState('');
    const [previewBlob, setPreviewBlob] = useState(null);
    const [previewLayout, setPreviewLayout] = useState(null);

    const isGenerating = generatingAction !== null;

    // Revoke the blob URL when the preview is cleared or the dialog closes
    // so we don't leak memory.
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    useEffect(() => {
        if (!open && previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            setPreviewBlob(null);
            setPreviewLabel('');
            setPreviewLayout(null);
        }
    }, [open]);

    // Pick the latest published snapshot for Layout C so view/download can be
    // performed without opening the builder.
    const latestCustomVersion = useCallback(() => {
        const versions = project?.project_data?.customLayoutVersions || [];
        if (versions.length === 0) return null;
        return versions[versions.length - 1];
    }, [project]);

    const buildPbbData = useCallback((layout) => {
        const base = {
            ...project?.project_data,
            id: project?.id,
            layoutSelection: layout,
            // Pattern Book PDF must NOT include score sheets
            downloadIncludes: { scoresheet: false },
        };
        if (layout === 'layout-c') {
            const latest = latestCustomVersion();
            if (latest) {
                base.customLayout = latest.snapshot;
                base.customLayoutVersion = latest.versionLabel;
                base.customLayoutPublishedAt = latest.publishedAt;
            } else {
                // No published version — render the current draft (or fall back
                // to an auto-populated layout inside the renderer) so users can
                // always preview/download Layout C.
                base.customLayoutVersion = base.customLayout ? 'Draft' : 'Auto';
                base.customLayoutPublishedAt = new Date().toISOString();
            }
        }
        return base;
    }, [project, latestCustomVersion]);

    const layoutActionKey = (layout) => {
        if (layout === 'layout-a') return 'a';
        if (layout === 'layout-b') return 'b';
        return 'c';
    };

    const layoutFileLabel = (layout) => {
        if (layout === 'layout-a') return 'A';
        if (layout === 'layout-b') return 'B';
        return 'C';
    };

    const handleView = useCallback(async (layout) => {
        const actionKey = `view-${layoutActionKey(layout)}`;
        const layoutLabel = layout === 'layout-a'
            ? 'A - By Date'
            : layout === 'layout-b'
                ? 'B - By Discipline'
                : 'C - Custom Pattern Book';
        try {
            setGeneratingAction(actionKey);
            const blob = await getOrGenerateBlob(project, layout, buildPbbData);
            // Show the PDF inline inside the dialog using an iframe. This keeps
            // the user on the same page — no new tab, no download, no navigation.
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            const blobUrl = URL.createObjectURL(blob);
            setPreviewBlob(blob);
            setPreviewUrl(blobUrl);
            setPreviewLabel(`Layout ${layoutLabel}`);
            setPreviewLayout(layout);
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast({
                title: 'Error',
                description: 'Failed to generate pattern book.',
                variant: 'destructive',
            });
        } finally {
            setGeneratingAction(null);
        }
    }, [buildPbbData, project, previewUrl, toast]);

    const handleClosePreview = useCallback(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPreviewBlob(null);
        setPreviewLabel('');
        setPreviewLayout(null);
    }, [previewUrl]);

    const handleDownloadCurrentPreview = useCallback(() => {
        if (!previewBlob || !previewLayout) return;
        const layoutLabel = layoutFileLabel(previewLayout);
        const filename = `${project?.project_name || 'Pattern-Book'}_Layout-${layoutLabel}.pdf`;
        triggerForceDownload(previewBlob, filename);
        toast({
            title: 'Success',
            description: `Layout ${layoutLabel} PDF downloaded successfully.`,
        });
    }, [previewBlob, previewLayout, project, toast]);

    const handleDownload = useCallback(async (layout) => {
        const actionKey = `download-${layoutActionKey(layout)}`;
        const layoutLabel = layoutFileLabel(layout);
        try {
            setGeneratingAction(actionKey);
            const blob = await getOrGenerateBlob(project, layout, buildPbbData);
            const filename = `${project?.project_name || 'Pattern-Book'}_Layout-${layoutLabel}.pdf`;
            triggerForceDownload(blob, filename);

            toast({
                title: 'Success',
                description: `Layout ${layoutLabel} PDF downloaded successfully.`,
            });
            // Keep the dialog open so the user stays on the current page
            // instead of being bounced back to the project list.
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast({
                title: 'Error',
                description: 'Failed to generate pattern book.',
                variant: 'destructive',
            });
        } finally {
            setGeneratingAction(null);
        }
    }, [buildPbbData, project, toast]);

    const renderLayoutSection = (layout, label, color, description) => {
        const layoutKey = layoutActionKey(layout);
        const viewKey = `view-${layoutKey}`;
        const downloadKey = `download-${layoutKey}`;

        return (
            <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color}`}></div>
                    <h3 className="font-semibold text-lg">{label}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
                <div className="flex gap-3">
                    <Button
                        onClick={() => handleView(layout)}
                        className="flex-1"
                        variant="default"
                        disabled={isGenerating}
                    >
                        {generatingAction === viewKey ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Eye className="h-4 w-4 mr-2" />
                                View {label.split(' - ')[0]}
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={() => handleDownload(layout)}
                        className="flex-1"
                        variant="outline"
                        disabled={isGenerating}
                    >
                        {generatingAction === downloadKey ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4 mr-2" />
                                Download {label.split(' - ')[0]}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    };

    const goToBuilderInEditor = () => {
        if (!project?.id) {
            toast({
                title: 'Cannot navigate',
                description: 'Project ID not available.',
                variant: 'destructive',
            });
            return;
        }
        // Close the dialog first so React Router navigation isn't blocked by
        // the modal's focus trap.
        if (typeof onOpenChange === 'function') onOpenChange(false);
        navigate(`/pattern-book-builder/${project.id}?step=8`);
    };

    const renderLayoutCSection = () => {
        const latest = latestCustomVersion();
        const hasBuilder = typeof setFormData === 'function';
        const hasDraftLayout = (project?.project_data?.customLayout?.pages?.length || 0) > 0;
        const viewKey = 'view-c';
        const downloadKey = 'download-c';

        // Source-of-truth label for the status strip and button text.
        let sourceLabel = 'Auto-generated';
        let sourceNote = 'No custom layout yet — will auto-populate all patterns, one per page.';
        if (latest) {
            sourceLabel = latest.versionLabel;
            sourceNote = latest.publishedAt
                ? `Published ${format(new Date(latest.publishedAt), 'MMM d, yyyy • h:mm a')}`
                : 'Latest published version';
        } else if (hasDraftLayout) {
            sourceLabel = 'Draft';
            sourceNote = 'Unpublished draft — visible here, but not an official version until you publish.';
        }

        const viewLabel = latest ? 'View Latest' : hasDraftLayout ? 'View Draft' : 'Preview';
        const downloadLabel = latest ? 'Download Latest' : hasDraftLayout ? 'Download Draft' : 'Download';

        return (
            <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <h3 className="font-semibold text-lg">Layout C - Custom Pattern Book</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    Drag-and-drop builder with mixed page sizes, logo, and versioning.
                </p>
                <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
                    Source: <span className="font-semibold">{sourceLabel}</span> — {sourceNote}
                </div>
                <div className="flex flex-wrap gap-3">
                    {hasBuilder && (
                        <Button
                            onClick={() => setBuilderOpen(true)}
                            className="flex-1 min-w-[150px]"
                            variant="default"
                            disabled={isGenerating}
                        >
                            <Sparkles className="h-4 w-4 mr-2" />
                            {latest || hasDraftLayout ? 'Edit Layout' : 'Open Builder'}
                        </Button>
                    )}
                    <Button
                        onClick={() => handleView('layout-c')}
                        className="flex-1 min-w-[150px]"
                        variant={hasBuilder ? 'outline' : 'default'}
                        disabled={isGenerating}
                    >
                        {generatingAction === viewKey ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Eye className="h-4 w-4 mr-2" />
                                {viewLabel}
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={() => handleDownload('layout-c')}
                        className="flex-1 min-w-[150px]"
                        variant="outline"
                        disabled={isGenerating}
                    >
                        {generatingAction === downloadKey ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4 mr-2" />
                                {downloadLabel}
                            </>
                        )}
                    </Button>
                </div>
                {!hasBuilder && (
                    <div className="pt-1">
                        <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs text-primary"
                            onClick={goToBuilderInEditor}
                            disabled={!project?.id}
                        >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {latest || hasDraftLayout ? 'Edit in Pattern Book Builder' : 'Go to Pattern Book Builder to create a layout'}
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={previewUrl ? "max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col" : "max-w-4xl max-h-[90vh] overflow-y-auto"}>
                {previewUrl ? (
                    <>
                        <DialogHeader className="px-6 pt-6 pb-3 border-b">
                            <div className="flex items-center justify-between gap-3">
                                <DialogTitle>Preview — {previewLabel}</DialogTitle>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDownloadCurrentPreview}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClosePreview}
                                    >
                                        Back
                                    </Button>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="flex-1 min-h-0 bg-muted/20">
                            <iframe
                                title={`Pattern Book Preview ${previewLabel}`}
                                src={previewUrl}
                                className="w-full h-full border-0"
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>View/Download Pattern Books & Score Sheets</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            <p className="text-sm text-muted-foreground">
                                Choose a layout and action to view or download the entire pattern book.
                            </p>
                            {renderLayoutSection(
                                'layout-a',
                                'Layout A - By Date',
                                'bg-blue-500',
                                'Patterns organized by show date with clean, contemporary styling.'
                            )}
                            {renderLayoutSection(
                                'layout-b',
                                'Layout B - By Discipline',
                                'bg-green-500',
                                'Patterns organized by discipline with traditional, professional styling.'
                            )}
                            {renderLayoutCSection()}
                        </div>
                    </>
                )}
            </DialogContent>
            {typeof setFormData === 'function' && (
                <CustomLayoutBuilder
                    open={builderOpen}
                    onOpenChange={setBuilderOpen}
                    formData={project?.project_data || {}}
                    setFormData={setFormData}
                />
            )}
        </Dialog>
    );
};

export default PatternBookDownloadDialog;
