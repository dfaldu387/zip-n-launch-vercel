import React from 'react';
import {
  FileText, Image as ImageIcon, Type, FilePlus2, Eye, Pencil,
  Download, Trash2, Loader2, Check, AlertCircle, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildPatternId, fileTypeToIdentifierCode } from '@/lib/patternIdFormatter';

/**
 * Structured pattern artifact card showing 4 artifacts:
 * Original, Language, Pattern Image, Final File
 */
const PatternArtifactCard = ({
  pattern,
  onGenerateFinal,
  onPreview,
  onEdit,
  onDownload,
  onDelete,
  isGenerating,
}) => {
  const identifier = pattern.pattern_identifier || pattern.display_name || pattern.name;

  // Structured pattern ID per client's naming scheme: (DISCIPLINE)NNNN.DIFF.IDENT
  // Built from existing columns — no new DB fields. See src/lib/patternIdFormatter.js.
  const isCapo = Array.isArray(pattern.tags) && pattern.tags.includes('CAPO');
  const structuredId = buildPatternId({
    discipline: pattern.class_name,
    number: pattern.pattern_number,
    level: pattern.level,
    fileType: 'pattern',
    useAsOriginal: !!pattern.use_as_original,
    isCapo,
  });

  const hasOriginal = !!pattern.file_url;
  const hasLanguage = !!(pattern.verbiage && pattern.verbiage.trim());
  const hasPatternImage = !!pattern.preview_image_url;
  const hasFinalFile = !!pattern.final_file_url;

  const artifactName = (suffix) => `${identifier} - ${suffix}`;

  return (
    <div className="border rounded-lg bg-background/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{identifier}</span>
          <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title="Structured Pattern ID">
            {structuredId}
          </code>
          {pattern.level && (
            <Badge variant="outline" className="text-[10px]">{pattern.level}</Badge>
          )}
          {hasFinalFile && (
            <Badge variant="default" className="text-[10px] bg-green-600">
              <Check className="h-2.5 w-2.5 mr-0.5" /> Final Ready
            </Badge>
          )}
          {!hasFinalFile && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
              <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Needs Generation
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(pattern)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(pattern)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 4 Artifact Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {/* 1. Original File */}
        <div className={`border rounded-md p-2 space-y-1.5 ${hasOriginal ? 'bg-slate-50 dark:bg-slate-950/20 border-slate-200' : 'bg-red-50 dark:bg-red-950/20 border-red-200'}`}>
          <div className="flex items-center gap-1 text-xs font-medium">
            <FileText className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-slate-700 dark:text-slate-400">Original</span>
            {hasOriginal && <Check className="h-3 w-3 text-green-600 ml-auto" />}
          </div>
          {hasOriginal ? (
            <div className="bg-white dark:bg-background rounded border p-1.5 min-h-[40px] flex flex-col justify-center gap-1">
              <p className="text-[10px] text-muted-foreground truncate" title={pattern.original_file_name}>
                {pattern.original_file_name || 'Uploaded PDF'}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onPreview(pattern)}>
                  <Eye className="h-3 w-3 mr-1" /> View
                </Button>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onDownload(pattern)}>
                  <Download className="h-3 w-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-red-100/50 dark:bg-red-900/20 rounded border border-red-200 p-1.5 min-h-[40px] flex items-center justify-center">
              <span className="text-xs text-red-500 italic">Missing</span>
            </div>
          )}
        </div>

        {/* 2. Language / Verbiage */}
        <div className={`border rounded-md p-2 space-y-1.5 ${hasLanguage ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200'}`}>
          <div className="flex items-center gap-1 text-xs font-medium">
            <Type className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-blue-700 dark:text-blue-400">Language</span>
            {hasLanguage && <Check className="h-3 w-3 text-green-600 ml-auto" />}
          </div>
          {hasLanguage ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-white dark:bg-background rounded border p-1.5 cursor-help min-h-[40px]">
                    <p className="text-xs text-foreground line-clamp-4 whitespace-pre-wrap">
                      {pattern.verbiage}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-md">
                  <p className="text-xs whitespace-pre-wrap">{pattern.verbiage}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="bg-amber-100/50 dark:bg-amber-900/20 rounded border border-amber-200 p-1.5 min-h-[40px] flex items-center justify-center">
              <span className="text-xs text-amber-600 italic">No verbiage</span>
            </div>
          )}
        </div>

        {/* 3. Pattern Image */}
        <div className={`border rounded-md p-2 space-y-1.5 ${hasPatternImage ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200'}`}>
          <div className="flex items-center gap-1 text-xs font-medium">
            <ImageIcon className="h-3.5 w-3.5 text-purple-600" />
            <span className="text-purple-700 dark:text-purple-400">Pattern</span>
            {hasPatternImage && <Check className="h-3 w-3 text-green-600 ml-auto" />}
          </div>
          {hasPatternImage ? (
            <div className="bg-white dark:bg-background rounded border p-1 flex items-center justify-center min-h-[60px]">
              <img
                src={pattern.preview_image_url}
                alt="Pattern diagram"
                className="max-h-[80px] w-auto object-contain rounded"
              />
            </div>
          ) : (
            <div className="bg-amber-100/50 dark:bg-amber-900/20 rounded border border-amber-200 p-1.5 min-h-[60px] flex items-center justify-center">
              <span className="text-xs text-amber-600 italic">No image</span>
            </div>
          )}
        </div>

        {/* 4. Final File */}
        <div className={`border rounded-md p-2 space-y-1.5 ${hasFinalFile ? 'bg-green-50 dark:bg-green-950/20 border-green-200' : 'bg-gray-50 dark:bg-gray-950/20 border-dashed border-gray-300'}`}>
          <div className="flex items-center gap-1 text-xs font-medium">
            <FilePlus2 className={`h-3.5 w-3.5 ${hasFinalFile ? 'text-green-600' : 'text-gray-400'}`} />
            <span className={hasFinalFile ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}>Final</span>
            {hasFinalFile && <Check className="h-3 w-3 text-green-600 ml-auto" />}
          </div>
          {hasFinalFile ? (
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => window.open(pattern.final_file_url, '_blank')}
              >
                <Eye className="h-2.5 w-2.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = pattern.final_file_url;
                  link.download = `${identifier}-Final.pdf`;
                  link.click();
                }}
              >
                <Download className="h-2.5 w-2.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => onGenerateFinal(pattern)}
                disabled={isGenerating}
              >
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                Regen
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="default"
              className="h-6 text-[10px] w-full"
              onClick={() => onGenerateFinal(pattern)}
              disabled={isGenerating || (!hasPatternImage && !hasLanguage)}
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              Generate Final
            </Button>
          )}
        </div>
      </div>

      {/* Original file name reference */}
      {pattern.original_file_name && (
        <p className="text-[10px] text-muted-foreground">
          Source: {pattern.original_file_name}
        </p>
      )}

      {/* Linked Files — all pattern_files rows under this pattern_number.
          Shows the client's "many files under one pattern set" grouping. */}
      {Array.isArray(pattern.pattern_files) && pattern.pattern_files.length > 0 && (
        <div className="border-t pt-2 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Linked Files ({pattern.pattern_files.length})
          </p>
          <ul className="space-y-0.5">
            {pattern.pattern_files
              .slice()
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map(pf => {
                const fileId = buildPatternId({
                  discipline: pattern.class_name,
                  number: pattern.pattern_number,
                  level: pattern.level,
                  fileType: pf.file_type,
                  useAsOriginal: !!pattern.use_as_original,
                  isCapo,
                });
                const code = fileTypeToIdentifierCode(pf.file_type, !!pattern.use_as_original, isCapo);
                return (
                  <li key={pf.id} className="flex items-center gap-2 text-[11px]">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">{code}</Badge>
                    <code className="font-mono text-muted-foreground">{fileId}</code>
                    <span className="truncate text-muted-foreground" title={pf.file_name}>{pf.file_name}</span>
                    {pf.file_url && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 ml-auto"
                        onClick={() => window.open(pf.file_url, '_blank')}
                      >
                        <Eye className="h-2.5 w-2.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PatternArtifactCard;
