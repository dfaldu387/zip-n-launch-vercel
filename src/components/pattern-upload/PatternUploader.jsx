import React, { useState, useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Tag, FileUp, Info, GripVertical, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import SortablePatternSlot from '@/components/pattern-upload/SortablePatternSlot';
import PdfStagingArea from '@/components/pattern-upload/PdfStagingArea';

const PatternUploader = ({
  hierarchyOrder,
  setHierarchyOrder,
  patterns,
  handleFileDrop,
  handleRemovePattern,
  handleMovePattern,
  onSkillLevelChange,
  onPreview,
  stagedPdfs,
  handlePdfSplit,
  assignStagedPdf,
  removeStagedPdf,
  renameStagedPdf,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const [activeDragItem, setActiveDragItem] = useState(null);
  const isDraggingStaged = activeDragItem?.type === 'staged';

  // Slots that don't have a pattern assigned yet (for quick-assign dropdowns)
  const availableSlots = useMemo(() =>
    hierarchyOrder.filter(h => !patterns[h.id]),
    [hierarchyOrder, patterns]
  );

  const handleDragStart = (event) => {
    const { active } = event;
    if (active.id.toString().startsWith('staged-')) {
      const pdf = stagedPdfs.find(p => `staged-${p.id}` === active.id);
      setActiveDragItem({ type: 'staged', data: pdf });
    } else if (active.id.toString().startsWith('slot-')) {
      const slotId = active.id.replace('slot-', '');
      const level = hierarchyOrder.find(h => h.id === slotId);
      setActiveDragItem({ type: 'slot', data: level });
    }
  };

  const handleDragEnd = (event) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;

    if (active.id.toString().startsWith('staged-') && over.id.toString().startsWith('slot-')) {
      const stagedPdfId = active.id.replace('staged-', '');
      const slotId = over.id.replace('slot-', '');
      assignStagedPdf(stagedPdfId, slotId);
      return;
    }

    if (active.id.toString().startsWith('slot-') && over.id.toString().startsWith('slot-')) {
      const activeId = active.id.replace('slot-', '');
      const overId = over.id.replace('slot-', '');
      if (activeId !== overId) {
        setHierarchyOrder((items) => {
          const oldIndex = items.findIndex((item) => item.id === activeId);
          const newIndex = items.findIndex((item) => item.id === overId);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
  };

  const handleDragCancel = () => {
    setActiveDragItem(null);
  };

  const hierarchyInfoText = "Group divisions/classes that will share the same pattern. The hierarchy order sets the pattern order in your book, and the division order within a group sets the title block display. This also helps generate correct score sheets.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
            <Tag className="mr-2 h-6 w-6 text-primary" /> 
            Upload Patterns & Tag Divisions/Levels
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-2">
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="text-sm w-80">{hierarchyInfoText}</PopoverContent>
            </Popover>
        </CardTitle>
        <CardDescription>Drag and drop your PDF patterns, then assign suitable divisions and levels for each one.</CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center text-lg"><FileUp className="mr-2 h-5 w-5" /> PDF Staging</CardTitle>
                  <CardDescription className="text-xs">Upload a multi-page PDF to split it into individual patterns.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <PdfStagingArea
                    stagedPdfs={stagedPdfs}
                    onPdfSplit={handlePdfSplit}
                    onRemove={removeStagedPdf}
                    onRename={renameStagedPdf}
                    onAssign={assignStagedPdf}
                    availableSlots={availableSlots}
                  />
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2 space-y-3">
              <SortableContext items={hierarchyOrder.map(h => `slot-${h.id}`)} strategy={verticalListSortingStrategy}>
                {hierarchyOrder.map((level, index) => (
                  <SortablePatternSlot
                    key={level.id}
                    id={level.id}
                    level={level}
                    pattern={patterns[level.id]}
                    onFileDrop={handleFileDrop}
                    onRemove={handleRemovePattern}
                    onMovePattern={handleMovePattern}
                    otherSlots={hierarchyOrder.filter(h => h.id !== level.id)}
                    onPreview={onPreview}
                    isDisciplineSlot={!!level.isDisciplineSlot}
                    onSkillLevelChange={onSkillLevelChange}
                    isDraggingStaged={isDraggingStaged}
                    slotIndex={index}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeDragItem?.type === 'staged' && activeDragItem.data && (
              <div className="p-3 border-2 border-primary rounded-lg bg-background shadow-xl flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{activeDragItem.data.displayName || activeDragItem.data.originalFileName}</span>
              </div>
            )}
            {activeDragItem?.type === 'slot' && activeDragItem.data && (
              <div className="p-3 border-2 border-primary rounded-lg bg-background shadow-xl flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{activeDragItem.data.title}</span>
                <span className="text-xs text-muted-foreground">{activeDragItem.data.description}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
};

export default PatternUploader;