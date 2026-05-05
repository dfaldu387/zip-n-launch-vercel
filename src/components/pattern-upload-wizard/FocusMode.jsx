import { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Camera, ZoomIn, ZoomOut, RotateCcw, ScanText, FileText, Loader2 } from 'lucide-react';

const FocusMode = ({ isOpen, onClose, imageUrl, onCapture, onExtractText, pdfFile }) => {
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [selection, setSelection] = useState(null); // finalized { x, y, width, height } in normalized coords
  const [isExtracting, setIsExtracting] = useState(false);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selection || selectMode) {
          setSelection(null);
          setSelectMode(false);
          setSelectionStart(null);
          setSelectionEnd(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selection, selectMode]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setSelectMode(false);
      setSelection(null);
      setSelectionStart(null);
      setSelectionEnd(null);
      setIsExtracting(false);
    }
  }, [isOpen]);

  const handleCapture = useCallback(() => {
    if (!imageUrl) return;
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const capturedDataUrl = canvas.toDataURL('image/png');
      onCapture?.(capturedDataUrl);
    };
    img.src = imageUrl;
  }, [imageUrl, onCapture]);

  // Get mouse position relative to the image element
  const getImageRelativePos = useCallback((e) => {
    const imgEl = imageRef.current;
    if (!imgEl) return null;
    const rect = imgEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (!selectMode) return;
    e.preventDefault();
    const pos = getImageRelativePos(e);
    if (!pos) return;
    setIsSelecting(true);
    setSelectionStart(pos);
    setSelectionEnd(pos);
    setSelection(null);
  }, [selectMode, getImageRelativePos]);

  const handleMouseMove = useCallback((e) => {
    if (!isSelecting) return;
    e.preventDefault();
    const pos = getImageRelativePos(e);
    if (!pos) return;
    setSelectionEnd(pos);
  }, [isSelecting, getImageRelativePos]);

  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !selectionStart || !selectionEnd) return;
    setIsSelecting(false);

    // Compute normalized bounds
    const x = Math.min(selectionStart.x, selectionEnd.x);
    const y = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    // Only finalize if the selection is large enough (avoid accidental clicks)
    if (width > 0.02 && height > 0.02) {
      setSelection({ x, y, width, height });
    } else {
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  }, [isSelecting, selectionStart, selectionEnd]);

  const handleExtractFromSelection = useCallback(async () => {
    if (!selection || !onExtractText) return;
    setIsExtracting(true);
    try {
      await onExtractText(selection);
    } finally {
      setIsExtracting(false);
    }
  }, [selection, onExtractText]);

  const handleExtractAll = useCallback(async () => {
    if (!onExtractText) return;
    setIsExtracting(true);
    try {
      await onExtractText(null);
    } finally {
      setIsExtracting(false);
    }
  }, [onExtractText]);

  const clearSelection = () => {
    setSelection(null);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // Compute the visual selection rectangle (for rendering)
  const getSelectionStyle = () => {
    const start = isSelecting ? selectionStart : (selection ? { x: selection.x, y: selection.y } : null);
    const end = isSelecting ? selectionEnd : (selection ? { x: selection.x + selection.width, y: selection.y + selection.height } : null);
    if (!start || !end) return null;

    const left = Math.min(start.x, end.x) * 100;
    const top = Math.min(start.y, end.y) * 100;
    const width = Math.abs(end.x - start.x) * 100;
    const height = Math.abs(end.y - start.y) * 100;

    return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` };
  };

  const selectionStyle = getSelectionStyle();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex flex-col"
          ref={containerRef}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b bg-background shrink-0">
            <h2 className="text-lg font-semibold">Focus Mode</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
                disabled={zoom <= 0.25 || selectMode}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground w-12 text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(z => Math.min(4, z + 0.25))}
                disabled={zoom >= 4 || selectMode}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(1)}
                disabled={selectMode}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
              </Button>

              <div className="w-px h-6 bg-border mx-1" />

              {/* Text extraction tools */}
              {onExtractText && (
                <>
                  <Button
                    variant={selectMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectMode(!selectMode);
                      if (selectMode) clearSelection();
                      if (!selectMode) setZoom(1); // reset zoom for accurate selection
                    }}
                    disabled={isExtracting}
                  >
                    <ScanText className="mr-2 h-4 w-4" />
                    {selectMode ? 'Cancel Selection' : 'Select Text Area'}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleExtractAll}
                    disabled={!pdfFile || isExtracting}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isExtracting && !selection ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    Extract & Format All
                  </Button>
                </>
              )}

              <div className="w-px h-6 bg-border mx-1" />

              <Button
                variant="default"
                size="sm"
                onClick={handleCapture}
                disabled={!imageUrl}
              >
                <Camera className="mr-2 h-4 w-4" /> Capture Clean Image
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Pattern area */}
          <div className="flex-grow overflow-auto flex items-center justify-center p-8 bg-white dark:bg-gray-950">
            {imageUrl ? (
              <div
                className="relative inline-block"
                style={{ transform: `scale(${selectMode ? 1 : zoom})`, transformOrigin: 'center center' }}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Pattern in focus"
                  className={`max-w-full shadow-lg rounded-sm select-none ${selectMode ? 'cursor-crosshair' : ''}`}
                  draggable={false}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => { if (isSelecting) handleMouseUp(); }}
                />

                {/* Selection rectangle overlay */}
                {selectionStyle && (
                  <div
                    className="absolute pointer-events-none border-2 border-dashed border-blue-500 bg-blue-500/10 rounded-sm"
                    style={selectionStyle}
                  />
                )}

                {/* Selection action buttons (overlaid on image) */}
                {selection && !isSelecting && (
                  <div
                    className="absolute flex items-center gap-2 pointer-events-auto"
                    style={{
                      left: selectionStyle?.left,
                      top: `calc(${selectionStyle?.top} + ${selectionStyle?.height} + 8px)`,
                    }}
                  >
                    <Button
                      size="sm"
                      onClick={handleExtractFromSelection}
                      disabled={isExtracting}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isExtracting ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ScanText className="mr-2 h-3.5 w-3.5" />
                      )}
                      Submit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelection}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-muted-foreground">No pattern image available</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Upload a pattern in Step 3 first
                </p>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-6 py-2 border-t bg-background text-center shrink-0">
            <p className="text-xs text-muted-foreground">
              {selectMode ? (
                <>Draw a rectangle over the text area you want to extract, then click <strong>Submit</strong></>
              ) : (
                <>Press <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs">Esc</kbd> to exit focus mode</>
              )}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FocusMode;
