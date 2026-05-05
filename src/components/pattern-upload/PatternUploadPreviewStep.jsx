import React, { useEffect, useState, useMemo } from 'react';
import { pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, CheckCircle, Loader2, FileText, Type, Image as ImageIcon,
} from 'lucide-react';

const rasterizeFirstPage = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas.toDataURL('image/png');
};

const ArtifactBox = ({ icon: Icon, label, color, children, filled }) => (
  <div
    className={`border rounded-md p-2 space-y-1.5 ${
      filled ? color.filled : color.empty
    }`}
  >
    <div className="flex items-center gap-1 text-xs font-medium">
      <Icon className={`h-3.5 w-3.5 ${color.icon}`} />
      <span className={color.text}>{label}</span>
    </div>
    {children}
  </div>
);

const PatternPreviewCard = ({ pattern, hierarchyItem }) => {
  const [imgUrl, setImgUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  const blobUrl = useMemo(() => URL.createObjectURL(pattern.file), [pattern.file]);
  useEffect(() => () => URL.revokeObjectURL(blobUrl), [blobUrl]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    rasterizeFirstPage(pattern.file)
      .then((url) => alive && setImgUrl(url))
      .catch(() => alive && setImgUrl(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [pattern.file]);

  return (
    <div className="border rounded-lg bg-background/50 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">{pattern.name}</span>
        {hierarchyItem?.title && (
          <Badge variant="outline" className="text-[10px]">
            {hierarchyItem.title}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <ArtifactBox
          icon={FileText}
          label="Original"
          filled
          color={{
            filled: 'bg-slate-50 dark:bg-slate-950/20 border-slate-200',
            empty: '',
            icon: 'text-slate-600',
            text: 'text-slate-700 dark:text-slate-400',
          }}
        >
          <div className="bg-white dark:bg-background rounded border overflow-hidden min-h-[80px]">
            <iframe
              src={blobUrl}
              title={pattern.name}
              className="w-full h-[80px] border-none pointer-events-none"
            />
          </div>
          <p className="text-[10px] text-muted-foreground truncate" title={pattern.name}>
            {pattern.name}
          </p>
        </ArtifactBox>

        <ArtifactBox
          icon={Type}
          label="Language"
          filled={false}
          color={{
            filled: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200',
            empty: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200',
            icon: 'text-amber-600',
            text: 'text-amber-700 dark:text-amber-400',
          }}
        >
          <div className="bg-amber-100/40 dark:bg-amber-900/20 rounded border border-amber-200 p-2 min-h-[80px] flex items-center justify-center">
            <span className="text-[11px] text-amber-700 italic text-center">
              Verbiage is added during admin review
            </span>
          </div>
        </ArtifactBox>

        <ArtifactBox
          icon={ImageIcon}
          label="Pattern"
          filled
          color={{
            filled: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200',
            empty: '',
            icon: 'text-purple-600',
            text: 'text-purple-700 dark:text-purple-400',
          }}
        >
          <div className="bg-white dark:bg-background rounded border flex items-center justify-center min-h-[80px] p-1">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : imgUrl ? (
              <img
                src={imgUrl}
                alt="Pattern preview"
                className="max-h-[80px] w-auto object-contain"
              />
            ) : (
              <span className="text-[11px] text-muted-foreground italic">Preview unavailable</span>
            )}
          </div>
        </ArtifactBox>

      </div>
    </div>
  );
};

const PatternUploadPreviewStep = ({
  patternSetName,
  patterns,
  hierarchyOrder,
  useAsOriginal,
  setUseAsOriginal,
  onBack,
  onSubmit,
  isSubmitting,
  agreedToTerms,
}) => {
  const patternEntries = hierarchyOrder
    .map((h) => ({ hierarchy: h, pattern: patterns[h.id] }))
    .filter((e) => e.pattern);

  const canSubmit =
    agreedToTerms && useAsOriginal !== null && patternEntries.length > 0 && !isSubmitting;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Preview Submission</CardTitle>
          <CardDescription>
            Review how your {patternSetName ? `"${patternSetName}"` : ''} submission will appear. Each
            pattern is shown as: Original / Language / Pattern.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {patternEntries.map(({ hierarchy, pattern }) => (
            <PatternPreviewCard
              key={hierarchy.id}
              pattern={pattern}
              hierarchyItem={hierarchy}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Original Pattern Usage</CardTitle>
          <CardDescription>
            Should the original uploaded pattern be available in <strong>Choose a Pattern</strong>?
            Selecting <em>Yes</em> tags this submission as an Original Pattern (OP).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={useAsOriginal === null ? '' : useAsOriginal ? 'yes' : 'no'}
            onValueChange={(v) => setUseAsOriginal(v === 'yes')}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="use-original-yes" />
              <Label htmlFor="use-original-yes" className="cursor-pointer">
                Yes — make available as Original Pattern
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="use-original-no" />
              <Label htmlFor="use-original-no" className="cursor-pointer">
                No — generated version only
              </Label>
            </div>
          </RadioGroup>
          {useAsOriginal === null && (
            <p className="text-xs text-amber-600 mt-2">Please select an option before submitting.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="lg" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Edit
        </Button>
        <Button size="lg" onClick={onSubmit} disabled={!canSubmit}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-5 w-5" /> Confirm &amp; Submit
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PatternUploadPreviewStep;
