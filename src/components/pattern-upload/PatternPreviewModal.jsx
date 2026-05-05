import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PatternPreviewModal = ({ isOpen, onClose, pattern }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create a stable blob URL from File object if available
  const blobUrl = useMemo(() => {
    if (pattern?.file instanceof File || pattern?.file instanceof Blob) {
      return URL.createObjectURL(pattern.file);
    }
    return null;
  }, [pattern?.file]);

  // Clean up blob URL on unmount or pattern change
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Prefer blob URL (from File), then dataUrl, then remote URLs
  const displayUrl = blobUrl || pattern?.dataUrl || pattern?.file_url || pattern?.fileUrl;

  useEffect(() => {
    if (isOpen && displayUrl) {
      setLoading(true);
      setError(null);
      const timer = setTimeout(() => {
        setLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    } else if (isOpen && !displayUrl) {
      setError('No file available for preview');
      setLoading(false);
    }
  }, [isOpen, displayUrl]);

  const handleDownload = async () => {
    if (!displayUrl) return;
    try {
      const response = await fetch(displayUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pattern?.name || 'pattern.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(displayUrl, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-4 pr-12 border-b flex flex-row items-center justify-between">
          <DialogTitle>{pattern?.display_name || pattern?.name || 'Pattern Preview'}</DialogTitle>
          {displayUrl && (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          )}
        </DialogHeader>
        <div className="flex-grow overflow-hidden p-4 bg-secondary/30">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-full text-destructive">
              <AlertTriangle className="h-10 w-10 mb-2" />
              <p className="font-semibold">{error}</p>
            </div>
          )}
          {!loading && !error && displayUrl && (() => {
            // Detect if URL points to an image (PNG, JPG, etc.) vs a PDF
            const isImage = /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(displayUrl) || displayUrl.startsWith('data:image/');
            return isImage ? (
              <div className="flex items-center justify-center h-full overflow-auto bg-white rounded">
                <img
                  src={displayUrl}
                  alt={pattern?.name || 'Pattern Preview'}
                  className="max-w-full max-h-full object-contain"
                  onLoad={() => setLoading(false)}
                  onError={() => {
                    setError('Failed to load image.');
                    setLoading(false);
                  }}
                />
              </div>
            ) : (
              <iframe
                src={displayUrl}
                title={pattern?.name || 'Pattern Preview'}
                width="100%"
                height="100%"
                className="border-none"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setError('Failed to load PDF in iframe.');
                  setLoading(false);
                }}
              />
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatternPreviewModal;
