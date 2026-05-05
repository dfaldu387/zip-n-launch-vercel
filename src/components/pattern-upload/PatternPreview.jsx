import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, Pin, AlertTriangle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const PatternPreview = ({ previewItem, hierarchyOrder, onAssign, isStaged, onPin, isPinned }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reset loading/error state when previewItem changes
  React.useEffect(() => {
    if (previewItem) {
      setLoading(true);
      setError(null);
      setPageNumber(1);
    }
  }, [previewItem?.id, previewItem?.dataUrl]);

  const handleAssign = (slotId) => {
    if (previewItem && slotId) {
      onAssign(previewItem.id, slotId);
    }
  };

  const onDocumentLoadSuccess = ({ numPages: nextNumPages }) => {
    setNumPages(nextNumPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err) => {
    setError('Failed to load PDF preview');
    setLoading(false);
    console.error('PDF Load Error:', err);
  };

  // Prefer File object (most reliable for react-pdf), then dataUrl, then file_url
  const hasValidFile = previewItem && (previewItem.file || previewItem.dataUrl || previewItem.file_url);
  const fileSource = previewItem?.file || previewItem?.dataUrl || previewItem?.file_url;

  return (
    <AnimatePresence>
      {previewItem && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => isPinned && onPin(null)}
          />
          {/* Centered preview card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <Card className="shadow-2xl border-2 border-primary/50 w-[520px] max-w-[90vw] pointer-events-auto">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg truncate">{previewItem?.name || 'Pattern Preview'}</CardTitle>
                    <CardDescription className="text-xs">
                      {isStaged ? `Page ${previewItem.pageNumber}` : 'Pattern assigned'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <Button
                      variant={isPinned ? "default" : "outline"}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onPin(previewItem)}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </Button>
                    {isPinned && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onPin(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="h-[450px] bg-muted rounded-md overflow-hidden mb-3 flex items-center justify-center">
                  {hasValidFile ? (
                    <>
                      {loading && (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      )}
                      {error && (
                        <div className="flex flex-col items-center justify-center h-full text-destructive">
                          <AlertTriangle className="h-8 w-8 mb-2" />
                          <p className="text-sm text-center">{error}</p>
                        </div>
                      )}
                      {!error && (
                        <Document
                          file={fileSource}
                          onLoadSuccess={onDocumentLoadSuccess}
                          onLoadError={onDocumentLoadError}
                          loading={null}
                        >
                          <Page
                            pageNumber={pageNumber}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            height={440}
                          />
                        </Document>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p className="text-sm">No preview available</p>
                    </div>
                  )}
                </div>

                {isStaged && hierarchyOrder && (
                  <Select onValueChange={handleAssign}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Assign to slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {hierarchyOrder.map((slot) => (
                        <SelectItem key={slot.id} value={slot.id} className="text-sm">
                          {slot.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PatternPreview;
