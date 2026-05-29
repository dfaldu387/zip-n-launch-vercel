import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, Maximize, Info, Check, ChevronDown, ChevronUp, Pencil, AlertTriangle, CheckCircle2, X, ImageIcon, Scissors, Eye, EyeOff, Eraser } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { pdfjs } from 'react-pdf';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import ManeuverList from './ManeuverList';
import FreehandAnnotationCanvas from './FreehandAnnotationCanvas';
import FocusMode from './FocusMode';

// Ensure pdfjs worker is configured (needed for PDF rendering + text extraction)
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// Reconstruct a File from a data URL (for saved projects where .file is stripped).
// Returns null on any malformed input so the wizard can keep rendering.
const dataUrlToFile = (dataUrl, fileName = 'pattern.pdf') => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const header = dataUrl.slice(0, commaIdx);
  // Strip whitespace/newlines that can sneak in through JSON round-trips and
  // normalize URL-safe base64 variants (-_ → +/).
  const base64 = dataUrl.slice(commaIdx + 1).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const mime = header.match(/:(.*?);/)?.[1] || 'application/pdf';
  try {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new File([bytes], fileName, { type: mime });
  } catch (err) {
    console.warn('dataUrlToFile: failed to decode saved pattern dataUrl', err);
    return null;
  }
};

// Get the File object from a pattern, reconstructing from dataUrl if needed.
const getPatternFile = (pattern) => {
  if (!pattern) return null;
  if (pattern.file) return pattern.file;
  if (pattern.dataUrl) return dataUrlToFile(pattern.dataUrl, pattern.name || 'pattern.pdf');
  return null;
};

export const Step4_ManeuverAnnotation = ({ formData, setFormData, uploadSlots }) => {
  const { toast } = useToast();

  // Get uploaded patterns (uses uploadSlots which adapts to discipline/hierarchy mode)
  const slots = uploadSlots || formData.hierarchyOrder;
  const uploadedPatterns = useMemo(() => {
    return slots
      .filter(h => formData.patterns[h.id])
      .map(h => ({
        levelId: h.id,
        title: h.title,
        pattern: formData.patterns[h.id],
      }));
  }, [slots, formData.patterns]);

  const [activePatternId, setActivePatternId] = useState(
    uploadedPatterns[0]?.levelId || null
  );

  const activePatternFile = useMemo(
    () => getPatternFile(formData.patterns[activePatternId]),
    [formData.patterns, activePatternId]
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(null);
  const [pdfImageUrls, setPdfImageUrls] = useState({});
/*  */  // Auto-detected key (legend) bounding boxes per pattern slot. Each entry is
  // { x, y, w, h } normalized 0–1 in image coords, or null if no key found.
  const [keyHighlights, setKeyHighlights] = useState({});
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  // Text extraction pipeline state
  const [extractedVerbiage, setExtractedVerbiage] = useState(null); // { raw, steps, warnings }
  const [isEditingRaw, setIsEditingRaw] = useState(false);
  const [editableRawText, setEditableRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);

  // Pattern image extraction state
  const [isExtractingImage, setIsExtractingImage] = useState(false);
  const [showDiagramPreview, setShowDiagramPreview] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropSelection, setCropSelection] = useState(null); // { startY, endY } normalized 0-1
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const cropImageRef = React.useRef(null);

  // Whiteout (erase) tool state — paint white rectangles over the extracted pattern
  const [isWhiteoutMode, setIsWhiteoutMode] = useState(false);
  const [whiteoutRects, setWhiteoutRects] = useState([]); // [{ x, y, w, h }] normalized 0-1
  const [currentWhiteout, setCurrentWhiteout] = useState(null); // in-progress drag rect
  const [isDraggingWhiteout, setIsDraggingWhiteout] = useState(false);
  const [isApplyingWhiteout, setIsApplyingWhiteout] = useState(false);
  const whiteoutImageRef = React.useRef(null);

  // Set active pattern when patterns change
  useEffect(() => {
    if (!activePatternId && uploadedPatterns.length > 0) {
      setActivePatternId(uploadedPatterns[0].levelId);
    }
  }, [uploadedPatterns, activePatternId]);

  // Clear extraction state when switching patterns
  useEffect(() => {
    setExtractedVerbiage(null);
    setIsEditingRaw(false);
    setShowRawText(false);
  }, [activePatternId]);

  // Render PDF pages to images for annotation canvas
  useEffect(() => {
    const renderPdfImages = async () => {
      for (const { levelId, pattern } of uploadedPatterns) {
        if (pdfImageUrls[levelId]) continue;
        if (!pattern?.dataUrl) continue;

        try {
          const binaryStr = atob(pattern.dataUrl.split(',')[1]);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const loadingTask = pdfjs.getDocument({ data: bytes });
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2 });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');

          await page.render({ canvasContext: ctx, viewport }).promise;
          const imageUrl = canvas.toDataURL('image/png');

          setPdfImageUrls(prev => ({ ...prev, [levelId]: imageUrl }));

          // Auto-detect the Key/Legend region. Image-based scan of the
          // bottom-right corner only — the previous text-based path kept
          // mis-matching the maneuver list, since both use the same words.
          try {
            const { detectKeyFromImage } = await import('@/lib/pdfUtils');
            const rect = await detectKeyFromImage(imageUrl);
            if (rect) {
              setKeyHighlights(prev => ({ ...prev, [levelId]: rect }));
            }
          } catch (keyErr) {
            console.warn('Key auto-detect failed (non-fatal):', keyErr);
          }
        } catch (error) {
          console.error(`Error rendering PDF for ${levelId}:`, error);
        }
      }
    };

    renderPdfImages();
  }, [uploadedPatterns, pdfImageUrls]);

  // Extract maneuvers from PDF (numbered steps only — legacy button)
  const handleExtractManeuvers = useCallback(async (levelId) => {
    const pattern = formData.patterns[levelId];
    const file = getPatternFile(pattern);
    if (!file) {
      toast({ title: 'No file available', description: 'Pattern file is required for extraction.', variant: 'destructive' });
      return;
    }

    setIsExtracting(true);
    setExtractionProgress(null);
    try {
      const { extractPatternStepsWithProgress } = await import('@/lib/pdfUtils');
      const stepMap = await extractPatternStepsWithProgress(file, (progress) => {
        setExtractionProgress(progress);
      });

      const maneuvers = Object.entries(stepMap).map(([stepNum, instruction]) => ({
        id: uuidv4(),
        stepNumber: parseInt(stepNum),
        instruction,
        isOptional: false,
      }));

      if (maneuvers.length === 0) {
        toast({
          title: 'No Maneuvers Found',
          description: 'Could not extract numbered steps from this PDF. Try using Focus Mode → "Select Text Area" or "Extract All Text" for better results.',
          variant: 'default',
          duration: 8000,
        });
        return;
      }

      // Also synthesize verbiage from maneuvers so DB `verbiage` column saves.
      // Without this, Auto-Extract populates patternManeuvers only and the
      // patterns row gets verbiage=null at INSERT (patternUploadUtils.js).
      const rawText = maneuvers
        .map(m => `${m.stepNumber}. ${m.instruction}`)
        .join('\n');

      let templateReady = null;
      try {
        const { toPatternBookFormat } = await import('@/lib/patternTextFormatter');
        const activePattern = uploadedPatterns.find(p => p.levelId === levelId);
        templateReady = toPatternBookFormat(maneuvers, {
          levelTitle: activePattern?.title || '',
        });
      } catch (e) {
        // Non-critical — template format is a bonus
      }

      setFormData(prev => ({
        ...prev,
        patternManeuvers: {
          ...prev.patternManeuvers,
          [levelId]: maneuvers,
        },
        patternVerbiage: {
          ...prev.patternVerbiage,
          [levelId]: {
            raw: rawText,
            formatted: maneuvers,
            templateReady,
            extractedAt: new Date().toISOString(),
            source: 'auto-extract',
          },
        },
      }));

      toast({ title: 'Maneuvers Extracted', description: `Found ${maneuvers.length} maneuver steps. Language saved.` });
    } catch (error) {
      toast({
        title: 'Extraction Failed',
        description: 'Could not read text from this PDF. Try using Focus Mode → "Extract All Text" for a more thorough extraction.',
        variant: 'destructive',
        duration: 8000,
      });
    } finally {
      setIsExtracting(false);
      setExtractionProgress(null);
    }
  }, [formData.patterns, setFormData, toast]);

  // Full text extraction from FocusMode (region or full-page)
  const handleExtractText = useCallback(async (bounds) => {
    const pattern = formData.patterns[activePatternId];
    const file = getPatternFile(pattern);
    if (!file) {
      toast({ title: 'No file available', description: 'Pattern file is required for extraction.', variant: 'destructive' });
      return;
    }

    try {
      const { extractAllTextFromRegion } = await import('@/lib/pdfUtils');
      const { formatPatternVerbiage } = await import('@/lib/patternTextFormatter');

      const { rawText, lines } = await extractAllTextFromRegion(file, bounds);

      if (!rawText || rawText.trim().length === 0) {
        toast({
          title: 'No Text Found',
          description: bounds
            ? 'No text was found in the selected area. Try selecting a larger region or use "Extract All Text".'
            : 'No text layer found in this PDF. The pattern may be an image-based PDF.',
          variant: 'default',
          duration: 6000,
        });
        return;
      }

      const { steps, warnings } = formatPatternVerbiage(rawText, lines);

      setExtractedVerbiage({ raw: rawText, steps, warnings });
      setEditableRawText(rawText);
      setIsEditingRaw(false);
      setShowRawText(false);
      setFocusModeOpen(false);

      if (steps.length > 0) {
        toast({ title: 'Text Extracted', description: `Found ${steps.length} maneuver steps. Review below.` });
      } else {
        toast({
          title: 'Text Extracted',
          description: 'Text was found but no maneuver steps could be parsed. You can edit the raw text and re-format.',
          variant: 'default',
          duration: 6000,
        });
      }
    } catch (error) {
      console.error('Text extraction error:', error);
      toast({
        title: 'Extraction Failed',
        description: 'Could not extract text from this PDF.',
        variant: 'destructive',
      });
    }
  }, [activePatternId, formData.patterns, toast]);

  // Accept extracted verbiage → populate ManeuverList + save raw + template-ready format
  const handleAcceptVerbiage = useCallback(async () => {
    if (!extractedVerbiage || !activePatternId) return;

    // Generate Pattern Book template-ready format
    let templateReady = null;
    try {
      const { toPatternBookFormat } = await import('@/lib/patternTextFormatter');
      const activePattern = uploadedPatterns.find(p => p.levelId === activePatternId);
      templateReady = toPatternBookFormat(extractedVerbiage.steps, {
        levelTitle: activePattern?.title || '',
      });
    } catch (e) {
      // Non-critical — template format is a bonus
    }

    setFormData(prev => ({
      ...prev,
      patternManeuvers: {
        ...prev.patternManeuvers,
        [activePatternId]: extractedVerbiage.steps,
      },
      patternVerbiage: {
        ...prev.patternVerbiage,
        [activePatternId]: {
          raw: extractedVerbiage.raw,
          formatted: extractedVerbiage.steps,
          templateReady,
          extractedAt: new Date().toISOString(),
        },
      },
    }));

    toast({
      title: 'Pattern formatted and saved successfully',
      description: `${extractedVerbiage.steps.length} maneuver steps — template-ready for Pattern Book.`,
    });
    setExtractedVerbiage(null);
    setIsEditingRaw(false);
    setShowRawText(false);
  }, [extractedVerbiage, activePatternId, uploadedPatterns, setFormData, toast]);

  // Re-format edited raw text
  const handleReformat = useCallback(async () => {
    try {
      const { formatPatternVerbiage } = await import('@/lib/patternTextFormatter');
      const { steps, warnings } = formatPatternVerbiage(editableRawText);
      setExtractedVerbiage(prev => ({ ...prev, raw: editableRawText, steps, warnings }));
      setIsEditingRaw(false);
      toast({ title: 'Re-formatted', description: `Parsed ${steps.length} maneuver steps from edited text.` });
    } catch (error) {
      toast({ title: 'Format Error', description: 'Could not parse the edited text.', variant: 'destructive' });
    }
  }, [editableRawText, toast]);

  // Open crop mode — shows the full image and lets user drag to select diagram area
  const handleStartCrop = useCallback(() => {
    setIsCropMode(true);
    setCropSelection(null);
    setShowDiagramPreview(true);
  }, []);

  // Mouse handlers for crop selection on the image
  const handleCropMouseDown = useCallback((e) => {
    if (!cropImageRef.current) return;
    const rect = cropImageRef.current.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    setCropSelection({ startY: Math.max(0, Math.min(1, y)), endY: Math.max(0, Math.min(1, y)) });
    setIsDraggingCrop(true);
  }, []);

  const handleCropMouseMove = useCallback((e) => {
    if (!isDraggingCrop || !cropImageRef.current) return;
    const rect = cropImageRef.current.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    setCropSelection(prev => prev ? { ...prev, endY: Math.max(0, Math.min(1, y)) } : null);
  }, [isDraggingCrop]);

  const handleCropMouseUp = useCallback(() => {
    setIsDraggingCrop(false);
  }, []);

  // Apply the crop selection
  const handleApplyCrop = useCallback(async (levelId) => {
    if (!cropSelection) return;
    const fullImage = pdfImageUrls[levelId];
    if (!fullImage) return;

    const top = Math.min(cropSelection.startY, cropSelection.endY);
    const bottom = Math.max(cropSelection.startY, cropSelection.endY);

    if (bottom - top < 0.05) {
      toast({ title: 'Selection too small', description: 'Please drag a larger area on the image.', variant: 'destructive' });
      return;
    }

    setIsExtractingImage(true);
    try {
      const { cropImageWithBounds } = await import('@/lib/patternImageExtractor');
      const diagramDataUrl = await cropImageWithBounds(fullImage, { top, bottom });

      setFormData(prev => ({
        ...prev,
        patternImages: {
          ...prev.patternImages,
          [levelId]: {
            diagramDataUrl,
            fullImageDataUrl: fullImage,
            cropped: true,
            cropBounds: { top, bottom, heightRatio: bottom - top },
            extractedAt: new Date().toISOString(),
          },
        },
      }));

      setIsCropMode(false);
      setCropSelection(null);
      toast({ title: 'Pattern extracted', description: `Kept ${Math.round((bottom - top) * 100)}% of the page — pattern only.` });
    } catch (error) {
      console.error('Crop error:', error);
      toast({ title: 'Crop failed', variant: 'destructive' });
    } finally {
      setIsExtractingImage(false);
    }
  }, [cropSelection, pdfImageUrls, setFormData, toast]);

  // ──────────────────────────────────────────────────────────────────────
  // Whiteout (Erase) tool — paint white rectangles to cover unwanted text
  // or markings on the extracted pattern image.
  // ──────────────────────────────────────────────────────────────────────
  const handleStartWhiteout = useCallback(() => {
    setIsWhiteoutMode(true);
    setWhiteoutRects([]);
    setCurrentWhiteout(null);
  }, []);

  const handleCancelWhiteout = useCallback(() => {
    setIsWhiteoutMode(false);
    setWhiteoutRects([]);
    setCurrentWhiteout(null);
    setIsDraggingWhiteout(false);
  }, []);

  const handleWhiteoutMouseDown = useCallback((e) => {
    if (!whiteoutImageRef.current) return;
    const rect = whiteoutImageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentWhiteout({
      startX: Math.max(0, Math.min(1, x)),
      startY: Math.max(0, Math.min(1, y)),
      endX: Math.max(0, Math.min(1, x)),
      endY: Math.max(0, Math.min(1, y)),
    });
    setIsDraggingWhiteout(true);
  }, []);

  const handleWhiteoutMouseMove = useCallback((e) => {
    if (!isDraggingWhiteout || !whiteoutImageRef.current) return;
    const rect = whiteoutImageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentWhiteout((prev) =>
      prev
        ? { ...prev, endX: Math.max(0, Math.min(1, x)), endY: Math.max(0, Math.min(1, y)) }
        : null
    );
  }, [isDraggingWhiteout]);

  const handleWhiteoutMouseUp = useCallback(() => {
    if (!isDraggingWhiteout) return;
    setIsDraggingWhiteout(false);
    setCurrentWhiteout((cw) => {
      if (!cw) return null;
      const x = Math.min(cw.startX, cw.endX);
      const y = Math.min(cw.startY, cw.endY);
      const w = Math.abs(cw.endX - cw.startX);
      const h = Math.abs(cw.endY - cw.startY);
      // ignore tiny accidental clicks
      if (w >= 0.005 && h >= 0.005) {
        setWhiteoutRects((prev) => [...prev, { x, y, w, h }]);
      }
      return null;
    });
  }, [isDraggingWhiteout]);

  const handleRemoveWhiteoutRect = useCallback((idx) => {
    setWhiteoutRects((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleApplyWhiteout = useCallback(async (levelId) => {
    if (whiteoutRects.length === 0) {
      toast({ title: 'No areas selected', description: 'Drag on the image to mark areas to whiteout.', variant: 'destructive' });
      return;
    }
    const current = formData.patternImages?.[levelId];
    if (!current?.diagramDataUrl) return;

    setIsApplyingWhiteout(true);
    try {
      const { applyWhiteoutsToImage } = await import('@/lib/patternImageExtractor');
      const newDataUrl = await applyWhiteoutsToImage(current.diagramDataUrl, whiteoutRects);

      setFormData((prev) => ({
        ...prev,
        patternImages: {
          ...prev.patternImages,
          [levelId]: {
            ...prev.patternImages[levelId],
            diagramDataUrl: newDataUrl,
            whiteoutAppliedAt: new Date().toISOString(),
          },
        },
      }));

      setIsWhiteoutMode(false);
      setWhiteoutRects([]);
      setCurrentWhiteout(null);
      toast({ title: 'Whiteout applied', description: `Covered ${whiteoutRects.length} area${whiteoutRects.length === 1 ? '' : 's'}.` });
    } catch (error) {
      console.error('Whiteout error:', error);
      toast({ title: 'Whiteout failed', variant: 'destructive' });
    } finally {
      setIsApplyingWhiteout(false);
    }
  }, [whiteoutRects, formData.patternImages, setFormData, toast]);

  // Clear extracted pattern image
  const handleClearPatternImage = useCallback((levelId) => {
    setFormData(prev => {
      const updated = { ...prev.patternImages };
      delete updated[levelId];
      return { ...prev, patternImages: updated };
    });
    setShowDiagramPreview(false);
    setIsCropMode(false);
    setCropSelection(null);
    toast({ title: 'Extracted image removed' });
  }, [setFormData, toast]);

  const handleManeuversChange = useCallback((levelId, maneuvers) => {
    setFormData(prev => ({
      ...prev,
      patternManeuvers: {
        ...prev.patternManeuvers,
        [levelId]: maneuvers,
      },
    }));
  }, [setFormData]);

  const handleAnnotationChange = useCallback((levelId, annotation) => {
    setFormData(prev => ({
      ...prev,
      patternAnnotations: {
        ...prev.patternAnnotations,
        [levelId]: annotation,
      },
    }));
  }, [setFormData]);

  // Template validation for active maneuvers
  const validationResult = useMemo(() => {
    const maneuvers = formData.patternManeuvers[activePatternId];
    if (!maneuvers || maneuvers.length === 0) return null;
    // Lazy import result — compute synchronously with inline check
    const issues = [];
    if (maneuvers.some(s => !s.instruction?.trim())) {
      issues.push('Some steps have empty instructions.');
    }
    const KNOWN_VERBS = [
      'walk', 'trot', 'jog', 'lope', 'canter', 'gallop', 'back', 'stop', 'halt', 'whoa',
      'turn', 'pivot', 'spin', 'reverse', 'rollback', 'side', 'sidepass',
      'circle', 'lead', 'change', 'extend', 'collect', 'square', 'set', 'pick',
      'drop', 'settle', 'continue', 'proceed', 'begin', 'start', 'finish', 'complete',
      'cross', 'pass', 'round', 'ride', 'execute', 'perform',
    ];
    const firstWord = (maneuvers[0]?.instruction || '').split(/\s+/)[0].toLowerCase();
    if (firstWord && !KNOWN_VERBS.includes(firstWord)) {
      issues.push(`First step doesn't start with a recognized action verb.`);
    }
    return { isValid: issues.length === 0, issues };
  }, [formData.patternManeuvers, activePatternId]);

  if (uploadedPatterns.length === 0) {
    return (
      <motion.div
        key="step-4"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.3 }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Step 4: Maneuver Editing & Annotation</CardTitle>
          <CardDescription className="text-sm">
            Extract and edit maneuver lists, and annotate your pattern images.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 rounded-md border border-dashed bg-muted/30">
            <p className="text-sm text-muted-foreground">
              No patterns uploaded yet. Go back to Step 3 to upload patterns first.
            </p>
          </div>
        </CardContent>
      </motion.div>
    );
  }

  const activeManeuvers = formData.patternManeuvers[activePatternId] || [];
  const activeAnnotation = formData.patternAnnotations[activePatternId] || null;

  return (
    <motion.div
      key="step-4"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Step 4: Maneuver Editing & Annotation</CardTitle>
        <CardDescription className="text-sm">
          Extract and edit maneuver lists from your patterns, and draw annotations directly on pattern images. This step is optional.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pattern tabs */}
        {uploadedPatterns.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {uploadedPatterns.map(({ levelId, title }) => (
              <Button
                key={levelId}
                variant={activePatternId === levelId ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActivePatternId(levelId)}
              >
                {title}
                {formData.patternManeuvers[levelId]?.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {formData.patternManeuvers[levelId].length}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        )}

        {activePatternId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Maneuver List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Maneuver List</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFocusModeOpen(true)}
                    disabled={!pdfImageUrls[activePatternId]}
                  >
                    <Maximize className="mr-2 h-3.5 w-3.5" />
                    Focus on Pattern
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExtractManeuvers(activePatternId)}
                    disabled={isExtracting}
                  >
                    {isExtracting ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-3.5 w-3.5" />
                    )}
                    Auto-Extract from PDF
                  </Button>
                </div>
              </div>

              {/* Extraction progress */}
              {extractionProgress && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{extractionProgress.message}</span>
                </div>
              )}

              {/* Captured image action banner */}
              {capturedImage && !extractedVerbiage && (
                <div className="flex items-center gap-2 p-3 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">Cleaned image captured.</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => {
                      handleExtractManeuvers(activePatternId);
                      setCapturedImage(null);
                    }}
                  >
                    <Wand2 className="mr-1.5 h-3 w-3" /> Extract Maneuvers
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCapturedImage(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              )}

              {/* Extracted verbiage review panel */}
              <AnimatePresence>
                {extractedVerbiage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">
                            Text Extracted — {extractedVerbiage.steps.length} maneuver step{extractedVerbiage.steps.length !== 1 ? 's' : ''} found
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setExtractedVerbiage(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Raw text toggle */}
                      <button
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowRawText(!showRawText)}
                      >
                        {showRawText ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Raw Text
                      </button>

                      {showRawText && (
                        <div className="rounded-md border bg-background p-3">
                          {isEditingRaw ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editableRawText}
                                onChange={(e) => setEditableRawText(e.target.value)}
                                className="min-h-[120px] text-xs font-mono"
                              />
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={handleReformat}>
                                  <Wand2 className="mr-1.5 h-3 w-3" /> Re-format
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setIsEditingRaw(false);
                                    setEditableRawText(extractedVerbiage.raw);
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-32 overflow-auto">
                                {extractedVerbiage.raw}
                              </pre>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setIsEditingRaw(true);
                                  setEditableRawText(extractedVerbiage.raw);
                                }}
                              >
                                <Pencil className="mr-1.5 h-3 w-3" /> Edit Raw Text
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Formatted steps preview — Template Preview */}
                      {extractedVerbiage.steps.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Template Preview</span>
                            <Badge variant="outline" className="text-[10px]">Pattern Book Ready</Badge>
                          </div>
                          <div className="rounded-md border bg-white dark:bg-gray-950 p-4 space-y-1.5 max-h-56 overflow-auto font-mono text-[13px]">
                            {extractedVerbiage.steps.map((step) => (
                              <div key={step.id} className="flex items-start gap-3">
                                <span className="font-semibold text-muted-foreground min-w-[24px] text-right shrink-0 tabular-nums">
                                  {step.stepNumber}.
                                </span>
                                <span className="text-foreground leading-snug">{step.instruction}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Warnings */}
                      {extractedVerbiage.warnings.length > 0 && (
                        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{extractedVerbiage.warnings.join(' ')}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={handleAcceptVerbiage}
                          disabled={extractedVerbiage.steps.length === 0}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" /> Accept & Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowRawText(true);
                            setIsEditingRaw(true);
                            setEditableRawText(extractedVerbiage.raw);
                          }}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Raw Text
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExtractedVerbiage(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {activeManeuvers.length === 0 && !extractedVerbiage ? (
                <div className="flex flex-col items-center justify-center h-32 rounded-md border border-dashed bg-muted/30 gap-2">
                  <p className="text-sm text-muted-foreground">No maneuvers yet</p>
                  <p className="text-xs text-muted-foreground">
                    {uploadedPatterns.some(p => slots.find(s => s.id === p.levelId)?.isDisciplineSlot)
                      ? 'Maneuvers are optional for jumping patterns — skip if not applicable.'
                      : 'Use Focus Mode → "Extract All Text" or "Auto-Extract from PDF"'}
                  </p>
                </div>
              ) : null}

              <ManeuverList
                maneuvers={activeManeuvers}
                onChange={(maneuvers) => handleManeuversChange(activePatternId, maneuvers)}
              />
            </div>

            {/* Right: Pattern Image + Annotation */}
            <div className="space-y-4">
              {/* Pattern Image Extraction */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-semibold text-sm">Pattern Image</h3>
                  <div className="flex items-center gap-2">
                    {formData.patternImages?.[activePatternId] ? (
                      <>
                        <Button variant="outline" size="sm" onClick={handleStartCrop}>
                          <Scissors className="mr-1.5 h-3.5 w-3.5" /> Re-crop
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleClearPatternImage(activePatternId)}
                        >
                          <X className="mr-1 h-3 w-3" /> Remove
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline" size="sm"
                        onClick={handleStartCrop}
                        disabled={!pdfImageUrls[activePatternId]}
                      >
                        <Scissors className="mr-1.5 h-3.5 w-3.5" /> Select Pattern Area
                      </Button>
                    )}
                  </div>
                </div>

                {/* CROP MODE: Drag on image to select diagram */}
                {isCropMode && pdfImageUrls[activePatternId] && (
                  <div className="rounded-lg border-2 border-blue-400 overflow-hidden">
                    <div className="bg-blue-50 dark:bg-blue-950/30 px-3 py-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                        Drag on the image to select the pattern area
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApplyCrop(activePatternId)}
                          disabled={!cropSelection || isExtractingImage || Math.abs((cropSelection?.endY || 0) - (cropSelection?.startY || 0)) < 0.05}
                          className="bg-blue-600 hover:bg-blue-700 text-white h-7"
                        >
                          {isExtractingImage ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                          Apply
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-7"
                          onClick={() => { setIsCropMode(false); setCropSelection(null); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                    <div
                      className="relative select-none cursor-crosshair"
                      ref={cropImageRef}
                      onMouseDown={handleCropMouseDown}
                      onMouseMove={handleCropMouseMove}
                      onMouseUp={handleCropMouseUp}
                      onMouseLeave={handleCropMouseUp}
                    >
                      <img
                        src={pdfImageUrls[activePatternId]}
                        alt="Pattern — drag to select pattern area"
                        className="w-full h-auto"
                        draggable={false}
                      />
                      {/* Dim everything OUTSIDE the selection */}
                      {cropSelection && (() => {
                        const top = Math.min(cropSelection.startY, cropSelection.endY);
                        const bottom = Math.max(cropSelection.startY, cropSelection.endY);
                        return (
                          <>
                            {/* Top dim */}
                            <div
                              className="absolute top-0 left-0 right-0 bg-black/40 pointer-events-none"
                              style={{ height: `${top * 100}%` }}
                            />
                            {/* Bottom dim */}
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-black/40 pointer-events-none"
                              style={{ height: `${(1 - bottom) * 100}%` }}
                            />
                            {/* Selection border */}
                            <div
                              className="absolute left-0 right-0 border-y-2 border-blue-500 pointer-events-none"
                              style={{ top: `${top * 100}%`, height: `${(bottom - top) * 100}%` }}
                            />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* RESULT: Show extracted diagram */}
                {!isCropMode && formData.patternImages?.[activePatternId] && !isWhiteoutMode && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-300">Pattern extracted</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleStartWhiteout}
                        title="Erase unwanted text or markings from the pattern image"
                      >
                        <Eraser className="mr-1.5 h-3.5 w-3.5" /> Whiteout
                      </Button>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-white overflow-hidden">
                      <img
                        src={formData.patternImages[activePatternId].diagramDataUrl}
                        alt="Extracted pattern"
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                )}

                {/* WHITEOUT MODE: Drag to mark areas to cover with white */}
                {isWhiteoutMode && formData.patternImages?.[activePatternId] && (
                  <div className="space-y-2">
                    <div className="rounded-lg border-2 border-amber-400 overflow-hidden">
                      <div className="bg-amber-50 dark:bg-amber-950/30 px-3 py-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          Drag rectangles to mark areas to whiteout ({whiteoutRects.length} marked)
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelWhiteout}
                            disabled={isApplyingWhiteout}
                          >
                            <X className="mr-1 h-3.5 w-3.5" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApplyWhiteout(activePatternId)}
                            disabled={isApplyingWhiteout || whiteoutRects.length === 0}
                          >
                            {isApplyingWhiteout ? (
                              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Applying...</>
                            ) : (
                              <><Check className="mr-1 h-3.5 w-3.5" /> Apply</>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div
                        ref={whiteoutImageRef}
                        className="relative cursor-crosshair select-none bg-white"
                        onMouseDown={handleWhiteoutMouseDown}
                        onMouseMove={handleWhiteoutMouseMove}
                        onMouseUp={handleWhiteoutMouseUp}
                        onMouseLeave={handleWhiteoutMouseUp}
                      >
                        <img
                          src={formData.patternImages[activePatternId].diagramDataUrl}
                          alt="Pattern — drag to whiteout"
                          className="w-full h-auto"
                          draggable={false}
                        />
                        {/* Persisted whiteout rects */}
                        {whiteoutRects.map((r, idx) => (
                          <div
                            key={idx}
                            className="absolute bg-white border-2 border-amber-500 group/wo"
                            style={{
                              left: `${r.x * 100}%`,
                              top: `${r.y * 100}%`,
                              width: `${r.w * 100}%`,
                              height: `${r.h * 100}%`,
                            }}
                          >
                            <button
                              type="button"
                              onMouseDown={(e) => { e.stopPropagation(); }}
                              onClick={(e) => { e.stopPropagation(); handleRemoveWhiteoutRect(idx); }}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow opacity-0 group-hover/wo:opacity-100 transition-opacity"
                              title="Remove"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {/* In-progress drag rect */}
                        {currentWhiteout && (() => {
                          const x = Math.min(currentWhiteout.startX, currentWhiteout.endX);
                          const y = Math.min(currentWhiteout.startY, currentWhiteout.endY);
                          const w = Math.abs(currentWhiteout.endX - currentWhiteout.startX);
                          const h = Math.abs(currentWhiteout.endY - currentWhiteout.startY);
                          return (
                            <div
                              className="absolute bg-white/80 border-2 border-amber-500 border-dashed pointer-events-none"
                              style={{
                                left: `${x * 100}%`,
                                top: `${y * 100}%`,
                                width: `${w * 100}%`,
                                height: `${h * 100}%`,
                              }}
                            />
                          );
                        })()}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tip: hover over a rectangle and click the × to remove it. Click <strong>Apply</strong> to bake the whiteouts into the pattern image.
                    </p>
                  </div>
                )}

                {/* No extraction yet and not in crop mode */}
                {!isCropMode && !formData.patternImages?.[activePatternId] && pdfImageUrls[activePatternId] && (
                  <p className="text-xs text-muted-foreground">
                    Click "Select Pattern Area" to crop the pattern from the PDF.
                  </p>
                )}
              </div>

              {/* Pattern Annotation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold text-sm">Pattern Annotation</h3>
                    <p className="text-xs text-muted-foreground">
                      Draw, circle, or highlight areas on the pattern image.
                    </p>
                  </div>
                  {keyHighlights[activePatternId] && (
                    <Badge variant="outline" className="text-[10px] border-red-500 text-red-600 dark:text-red-400">
                      Key auto-detected
                    </Badge>
                  )}
                </div>
                <div className="relative">
                  <FreehandAnnotationCanvas
                    backgroundImageUrl={pdfImageUrls[activePatternId]}
                    onAnnotationChange={(annotation) => handleAnnotationChange(activePatternId, annotation)}
                    initialAnnotation={activeAnnotation}
                  />
                  {/* Auto-detected Key highlight — pointer-events-none so it
                      never blocks the annotation drawing tools underneath. */}
                  {keyHighlights[activePatternId] && (() => {
                    const r = keyHighlights[activePatternId];
                    return (
                      <div
                        className="absolute border-[3px] border-red-500 rounded-sm pointer-events-none"
                        style={{
                          left: `${r.x * 100}%`,
                          top: `${r.y * 100}%`,
                          width: `${r.w * 100}%`,
                          height: `${r.h * 100}%`,
                          boxShadow: '0 0 0 1px rgba(255,255,255,0.6)',
                        }}
                        title="Auto-detected pattern key"
                      />
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <FocusMode
        isOpen={focusModeOpen}
        onClose={() => setFocusModeOpen(false)}
        imageUrl={pdfImageUrls[activePatternId]}
        pdfFile={activePatternFile}
        onCapture={(dataUrl) => {
          setCapturedImage(dataUrl);
          setFocusModeOpen(false);
        }}
        onExtractText={handleExtractText}
      />
    </motion.div>
  );
};
