import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, GripVertical, FileText, Eye, Upload, ArrowRightLeft, Undo2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

// Mirrors PATTERN_LEVELS in src/lib/patternNumbering.js. Each option maps to
// one of the client's difficulty codes (C, S, I, B, WT, L1, GR_NOV, ALL) via
// src/lib/patternIdFormatter.js when building the structured pattern ID.
const SKILL_LEVELS = [
  'Championship',
  'Skilled',
  'L1 / Novice',
  'Green / Novice',
  'Intermediate',
  'Beginner',
  'Walk-Trot',
];

const SortablePatternSlot = ({
  id,
  level,
  pattern,
  onFileDrop,
  onRemove,
  onMovePattern,
  otherSlots,
  onPreview,
  isDisciplineSlot,
  onSkillLevelChange,
  isDraggingStaged,
  slotIndex,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `slot-${id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const onDrop = React.useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onFileDrop(id, acceptedFiles[0]);
    }
  }, [id, onFileDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const isEmpty = !pattern;
  const showDropHighlight = isEmpty && isDraggingStaged;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative border-2 transition-all duration-200",
        isDragging ? "border-primary shadow-lg" : "border-border",
        pattern ? "bg-card" : "bg-muted/20",
        showDropHighlight && "border-primary/60 bg-primary/5 ring-2 ring-primary/20"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between p-3 border-b">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-grab"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </Button>
          {typeof slotIndex === 'number' && (
            <span className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold flex-shrink-0",
              pattern ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {slotIndex + 1}
            </span>
          )}
          <CardTitle className="text-base font-semibold">{level.title}</CardTitle>
          <span className="text-sm text-muted-foreground ml-2">{level.description}</span>
        </div>
        {pattern && (
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPreview({ id, type: 'hierarchy', file: pattern?.file, dataUrl: pattern?.dataUrl, name: pattern?.name })} title="Preview">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove(id)} title="Unassign — return to staging">
              <Undo2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3">
        <div
          {...getRootProps()}
          className={cn(
            "flex items-center justify-center p-6 border-2 border-dashed rounded-md text-center transition-all duration-200 min-h-[100px]",
            isDragActive ? "border-primary bg-primary/10 ring-2 ring-primary/30 scale-[1.01]" : "border-border hover:border-primary/50",
            pattern && "border-transparent hover:border-transparent",
            showDropHighlight && !isDragActive && "border-primary/40 animate-pulse"
          )}
        >
          <input {...getInputProps()} />
          {pattern ? (
            <div className="flex items-center space-x-2 text-primary-foreground bg-primary/80 px-3 py-2 rounded-md">
              <FileText className="h-5 w-5" />
              <span className="text-sm font-medium">{pattern.file?.name || pattern.name || 'Uploaded Pattern'}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Upload className={cn("h-6 w-6", showDropHighlight ? "text-primary" : "text-muted-foreground/40")} />
              <p className={cn("text-sm", showDropHighlight ? "text-primary font-medium" : "text-muted-foreground")}>
                {isDragActive ? "Drop pattern here" : showDropHighlight ? "Drop here" : "Drag from staging or click to upload"}
              </p>
            </div>
          )}
        </div>
        {pattern && otherSlots && otherSlots.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <ArrowRightLeft className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <Select onValueChange={(toSlotId) => onMovePattern(id, toSlotId)}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Move to..." />
              </SelectTrigger>
              <SelectContent>
                {otherSlots.map((slot) => (
                  <SelectItem key={slot.id} value={slot.id} className="text-xs">
                    {slot.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
      {isDisciplineSlot && pattern && (
        <CardFooter className="p-3 pt-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Skill Level:</span>
            <Select
              value={pattern.skillLevel || ''}
              onValueChange={(val) => onSkillLevelChange?.(id, val === 'none' ? '' : val)}
            >
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {SKILL_LEVELS.map(sl => (
                  <SelectItem key={sl} value={sl}>{sl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default SortablePatternSlot;