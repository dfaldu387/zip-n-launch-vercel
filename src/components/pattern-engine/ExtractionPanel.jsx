import { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UploadCloud, FileText, X, Loader2, CheckCircle2, AlertTriangle, ImageIcon } from 'lucide-react';
import { extractFromPdf, saveExtractedPattern } from '@/lib/patternExtractionService';
import ManeuverEditor from './ManeuverEditor';

/**
 * ExtractionPanel — handles PDF upload, client-side extraction, preview, and save.
 *
 * Props:
 *   associations: string[]
 *   disciplines: string[]
 *   userId: string
 *   onComplete: () => void — called after successful save
 *   onCancel: () => void
 */
const ExtractionPanel = ({ associations = [], disciplines = [], userId, onComplete, onCancel }) => {
  const [formData, setFormData] = useState({ patternName: '', association: '', discipline: '', division: '', divisionLevel: '' });
  const [file, setFile] = useState(null);
  const [extractionResult, setExtractionResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const [stage, setStage] = useState('upload'); // upload | extracting | preview | saving | done
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setExtractionResult(null);
      setError(null);
      setStage('upload');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const handleExtract = async () => {
    if (!file) return;
    setStage('extracting');
    setError(null);

    try {
      const result = await extractFromPdf(file, (p) => {
        setProgress(p);
      });
      setExtractionResult(result);
      setStage('preview');
    } catch (err) {
      console.error('Extraction failed:', err);
      setError(err.message || 'Extraction failed');
      setStage('upload');
    }
  };

  const handleStepsChange = (updatedSteps) => {
    setExtractionResult(prev => ({ ...prev, steps: updatedSteps }));
  };

  const handleSave = async () => {
    if (!extractionResult || !userId) return;
    setStage('saving');
    setError(null);

    try {
      await saveExtractedPattern({
        formData,
        extractionResult,
        originalFile: file,
        userId,
        onProgress: (p) => setProgress(p),
      });
      setStage('done');
      setTimeout(() => onComplete?.(), 1500);
    } catch (err) {
      console.error('Save failed:', err);
      setError(err.message || 'Failed to save pattern');
      setStage('preview');
    }
  };

  const handleReset = () => {
    setFile(null);
    setExtractionResult(null);
    setProgress(null);
    setStage('upload');
    setError(null);
    setFormData({ patternName: '', association: '', discipline: '', division: '', divisionLevel: '' });
  };

  const filePreview = useMemo(() => {
    if (!file) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border rounded-lg p-3 flex items-center justify-between bg-muted/50"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary" />
          <div>
            <p className="font-medium text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        {stage === 'upload' && (
          <Button variant="ghost" size="icon" onClick={() => { setFile(null); setExtractionResult(null); }}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </motion.div>
    );
  }, [file, stage]);

  return (
    <div className="space-y-6">
      {/* Metadata inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="patternName">Pattern Name</Label>
          <Input
            id="patternName"
            value={formData.patternName}
            onChange={(e) => setFormData(prev => ({ ...prev, patternName: e.target.value }))}
            placeholder="e.g., 2026 Nationals Trail Book"
            disabled={stage === 'extracting' || stage === 'saving'}
          />
        </div>
        <div>
          <Label htmlFor="association">Association</Label>
          <Select
            value={formData.association}
            onValueChange={(value) => setFormData(prev => ({ ...prev, association: value }))}
            disabled={stage === 'extracting' || stage === 'saving'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select association" />
            </SelectTrigger>
            <SelectContent>
              {associations.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="discipline">Discipline</Label>
          <Select
            value={formData.discipline}
            onValueChange={(value) => setFormData(prev => ({ ...prev, discipline: value }))}
            disabled={stage === 'extracting' || stage === 'saving'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select discipline" />
            </SelectTrigger>
            <SelectContent>
              {disciplines.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="division">Division</Label>
          <Input
            id="division"
            value={formData.division}
            onChange={(e) => setFormData(prev => ({ ...prev, division: e.target.value }))}
            placeholder="e.g., Open, Youth, Amateur"
            disabled={stage === 'extracting' || stage === 'saving'}
          />
        </div>
        <div>
          <Label htmlFor="divisionLevel">Division Level</Label>
          <Input
            id="divisionLevel"
            value={formData.divisionLevel}
            onChange={(e) => setFormData(prev => ({ ...prev, divisionLevel: e.target.value }))}
            placeholder="e.g., Beginner, Intermediate, Advanced"
            disabled={stage === 'extracting' || stage === 'saving'}
          />
        </div>
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          {...getRootProps()}
          className={`p-12 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <UploadCloud className="w-12 h-12" />
            {isDragActive ? (
              <p className="font-medium">Drop the PDF here...</p>
            ) : (
              <>
                <p className="font-medium">Drag & drop a pattern PDF here</p>
                <p className="text-sm">or click to browse</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* File preview */}
      {filePreview}

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extraction progress */}
      {stage === 'extracting' && progress && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">{progress.message}</span>
          </div>
          <Progress value={progress.percent} className="h-2" />
        </motion.div>
      )}

      {/* Saving progress */}
      {stage === 'saving' && progress && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">{progress.message}</span>
          </div>
          <Progress value={progress.percent} className="h-2" />
        </motion.div>
      )}

      {/* Done state */}
      {stage === 'done' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-6"
        >
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-700 dark:text-green-400">Pattern saved successfully!</p>
        </motion.div>
      )}

      {/* Extraction preview */}
      {stage === 'preview' && extractionResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{extractionResult.numPages}</p>
                <p className="text-xs text-muted-foreground">Pages</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{extractionResult.steps.length}</p>
                <p className="text-xs text-muted-foreground">Steps Found</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{extractionResult.rawText.length}</p>
                <p className="text-xs text-muted-foreground">Characters</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">
                  {extractionResult.diagramDataUrl ? 'Yes' : 'No'}
                </p>
                <p className="text-xs text-muted-foreground">Diagram Found</p>
              </CardContent>
            </Card>
          </div>

          {/* Warnings */}
          {extractionResult.warnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">Extraction Warnings:</p>
              {extractionResult.warnings.map((w, i) => (
                <p key={i} className="text-sm text-yellow-700 dark:text-yellow-300">- {w}</p>
              ))}
            </div>
          )}

          {/* Two-column: Image + Maneuvers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Diagram image */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Extracted Diagram
              </h3>
              {extractionResult.diagramDataUrl ? (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img
                    src={extractionResult.diagramDataUrl}
                    alt="Extracted pattern diagram"
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No diagram could be extracted</p>
                </div>
              )}
              {extractionResult.cropped && (
                <Badge variant="secondary" className="mt-2">Auto-cropped</Badge>
              )}
            </div>

            {/* Maneuver editor */}
            <div>
              <ManeuverEditor
                steps={extractionResult.steps}
                onChange={handleStepsChange}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t">
        {stage === 'upload' && (
          <>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={handleExtract} disabled={!file}>
              <FileText className="mr-2 h-4 w-4" /> Extract Content
            </Button>
          </>
        )}
        {stage === 'preview' && (
          <>
            <Button variant="outline" onClick={handleReset}>Start Over</Button>
            <Button onClick={handleSave} disabled={!extractionResult?.steps?.length}>
              Save Pattern
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ExtractionPanel;
