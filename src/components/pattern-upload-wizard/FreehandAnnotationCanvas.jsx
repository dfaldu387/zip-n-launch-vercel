import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Undo2, Trash2, Pen, Highlighter, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOOLS = {
  PEN: 'pen',
  HIGHLIGHT: 'highlight',
  WHITEOUT: 'whiteout',
};

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#000000'];

const FreehandAnnotationCanvas = ({ backgroundImageUrl, onAnnotationChange, initialAnnotation }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(3);
  const [undoStack, setUndoStack] = useState([]);
  const [bgImage, setBgImage] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 800 });

  // Load background image
  useEffect(() => {
    if (!backgroundImageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setBgImage(img);
      // Scale to fit container while maintaining aspect ratio
      const containerWidth = containerRef.current?.clientWidth || 600;
      const scale = containerWidth / img.width;
      const scaledHeight = img.height * scale;
      setCanvasSize({ width: containerWidth, height: scaledHeight });
    };
    img.src = backgroundImageUrl;
  }, [backgroundImageUrl]);

  // Redraw canvas when background or size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImage) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(bgImage, 0, 0, canvasSize.width, canvasSize.height);

    // Restore annotations from initial data
    if (initialAnnotation?.imageDataUrl) {
      const annotImg = new Image();
      annotImg.onload = () => {
        ctx.drawImage(annotImg, 0, 0, canvasSize.width, canvasSize.height);
      };
      annotImg.src = initialAnnotation.imageDataUrl;
    }
  }, [bgImage, canvasSize, initialAnnotation]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setUndoStack(prev => [...prev.slice(-19), dataUrl]);
  }, []);

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);

    saveSnapshot();

    ctx.beginPath();
    ctx.moveTo(x, y);

    if (tool === TOOLS.HIGHLIGHT) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = brushSize * 6;
    } else if (tool === TOOLS.WHITEOUT) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = brushSize * 3;
    } else {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.closePath();
    ctx.globalAlpha = 1;
    setIsDrawing(false);

    // Export annotation
    if (onAnnotationChange) {
      onAnnotationChange({ imageDataUrl: canvas.toDataURL('image/png') });
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const lastSnapshot = undoStack[undoStack.length - 1];

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (onAnnotationChange) {
        onAnnotationChange({ imageDataUrl: canvas.toDataURL('image/png') });
      }
    };
    img.src = lastSnapshot;
    setUndoStack(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImage) return;
    saveSnapshot();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgImage, 0, 0, canvasSize.width, canvasSize.height);
    if (onAnnotationChange) {
      onAnnotationChange({ imageDataUrl: null });
    }
  };

  if (!backgroundImageUrl) {
    return (
      <div className="flex items-center justify-center h-64 rounded-md border border-dashed bg-muted/30">
        <p className="text-sm text-muted-foreground">No pattern image to annotate</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-md border bg-muted/30">
        <div className="flex items-center gap-1">
          <Button
            variant={tool === TOOLS.PEN ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool(TOOLS.PEN)}
          >
            <Pen className="h-3.5 w-3.5 mr-1" /> Pen
          </Button>
          <Button
            variant={tool === TOOLS.HIGHLIGHT ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool(TOOLS.HIGHLIGHT)}
          >
            <Highlighter className="h-3.5 w-3.5 mr-1" /> Highlight
          </Button>
          <Button
            variant={tool === TOOLS.WHITEOUT ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool(TOOLS.WHITEOUT)}
          >
            <Eraser className="h-3.5 w-3.5 mr-1" /> White-out
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        {tool === TOOLS.PEN && (
          <div className="flex items-center gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-all',
                  color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        )}

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Size:</Label>
          <input
            type="range"
            min="1"
            max="10"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-20 h-1.5"
          />
        </div>

        <div className="flex-grow" />

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
          >
            <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="rounded-md border overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height: canvasSize.height * (containerRef.current?.clientWidth || 600) / canvasSize.width || 'auto' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
};

export default FreehandAnnotationCanvas;
