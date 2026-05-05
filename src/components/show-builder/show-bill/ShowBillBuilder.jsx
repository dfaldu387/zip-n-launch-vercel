import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, pointerWithin } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { GripVertical } from 'lucide-react';
import ShowBillToolbar from './ShowBillToolbar';
import ShowBillHeader from './ShowBillHeader';
import DayTabs from './DayTabs';
import ArenaSection from './ArenaSection';
import ClassPalette from './ClassPalette';
import ItemEditDialog from './ItemEditDialog';
import BulkAddDialog from './BulkAddDialog';
import {
  initializeShowBill,
  getAllClassItems,
  getUnplacedClasses,
  renumberShowBill,
  createShowBillItem,
  appendItem,
  findItemLocation,
  updateHeader,
  addClassToBox,
  removeClassFromBox,
} from '@/lib/showBillUtils';
import { generateShowBillPdf } from '@/lib/showBillPdfGenerator';

const MAX_UNDO = 50;

const ShowBillBuilder = ({ formData, setFormData, associationsData: propAssociationsData }) => {
  const { toast } = useToast();
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [activeDayId, setActiveDayId] = useState(null);
  const [activeDragData, setActiveDragData] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingDayId, setEditingDayId] = useState(null);
  const [editingArenaId, setEditingArenaId] = useState(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkAddTarget, setBulkAddTarget] = useState({ dayId: null, arenaId: null });

  // Multi-select state
  const [selectedPaletteIds, setSelectedPaletteIds] = useState(new Set());
  const [selectedArenaItemIds, setSelectedArenaItemIds] = useState(new Set());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const showBill = formData.showBill;

  // Initialize showBill on first mount if needed
  useEffect(() => {
    if (!formData.showBill) {
      const initial = initializeShowBill(formData);
      setFormData(prev => ({ ...prev, showBill: initial }));
    }
  }, [formData.showBill, formData, setFormData]);

  // Set active day tab
  useEffect(() => {
    if (showBill?.days?.length > 0 && !activeDayId) {
      setActiveDayId(showBill.days[0].id);
    }
  }, [showBill, activeDayId]);

  const allClassItems = useMemo(() => getAllClassItems(formData), [formData]);
  const unplacedClasses = useMemo(() => getUnplacedClasses(formData), [formData]);
  const activeDay = useMemo(() => showBill?.days?.find(d => d.id === activeDayId), [showBill, activeDayId]);

  // Prune stale palette selections when classes get placed
  useEffect(() => {
    if (selectedPaletteIds.size > 0) {
      const unplacedIds = new Set(unplacedClasses.map(c => c.id));
      const pruned = new Set([...selectedPaletteIds].filter(id => unplacedIds.has(id)));
      if (pruned.size !== selectedPaletteIds.size) setSelectedPaletteIds(pruned);
    }
  }, [unplacedClasses, selectedPaletteIds]);

  // Selection helpers
  const clearSelection = useCallback(() => {
    setSelectedPaletteIds(new Set());
    setSelectedArenaItemIds(new Set());
  }, []);

  const selectedCount = selectedPaletteIds.size + selectedArenaItemIds.size;

  const togglePaletteSelection = useCallback((classId) => {
    setSelectedArenaItemIds(new Set());
    setSelectedPaletteIds(prev => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }, []);

  const bulkTogglePaletteSelection = useCallback((classIds, selected) => {
    setSelectedArenaItemIds(new Set());
    if (selected) {
      setSelectedPaletteIds(new Set(classIds));
    } else {
      setSelectedPaletteIds(prev => {
        const next = new Set(prev);
        classIds.forEach(id => next.delete(id));
        return next;
      });
    }
  }, []);

  const toggleArenaItemSelection = useCallback((itemId) => {
    setSelectedPaletteIds(new Set());
    setSelectedArenaItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  // Wrapped setter that pushes to undo stack
  const setShowBill = useCallback((newShowBill) => {
    setUndoStack(prev => [...prev.slice(-(MAX_UNDO - 1)), formData.showBill]);
    setRedoStack([]);
    setFormData(prev => ({ ...prev, showBill: newShowBill }));
  }, [formData.showBill, setFormData]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, formData.showBill]);
    setUndoStack(prev => prev.slice(0, -1));
    setFormData(prev => ({ ...prev, showBill: previousState }));
  }, [undoStack, formData.showBill, setFormData]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, formData.showBill]);
    setRedoStack(prev => prev.slice(0, -1));
    setFormData(prev => ({ ...prev, showBill: nextState }));
  }, [redoStack, formData.showBill, setFormData]);

  const handleSave = () => {
    toast({ title: 'Schedule Saved', description: 'Your show bill changes are saved locally. Use "Save Progress" to persist.' });
  };

  const handleGeneratePdf = async () => {
    try {
      await generateShowBillPdf(showBill, allClassItems, propAssociationsData);
      toast({ title: 'PDF Generated', description: 'Your show bill PDF has been downloaded.' });
    } catch (err) {
      toast({ title: 'PDF Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateHeader = useCallback((field, value) => {
    setShowBill(updateHeader(showBill, field, value));
  }, [showBill, setShowBill]);

  // Toggle arena closed/open for a specific day
  const handleToggleArenaClosed = useCallback((dayId, arenaId) => {
    const key = `${dayId}::${arenaId}`;
    const sb = JSON.parse(JSON.stringify(showBill));
    if (!sb.closedArenas) sb.closedArenas = {};
    if (sb.closedArenas[key]) {
      delete sb.closedArenas[key];
    } else {
      sb.closedArenas[key] = true;
    }
    setShowBill(renumberShowBill(sb));
  }, [showBill, setShowBill]);

  // Insert item at end of an arena
  const handleInsertItem = useCallback((dayId, arenaId, type) => {
    if ((showBill.closedArenas || {})[`${dayId}::${arenaId}`]) return;
    const newItem = createShowBillItem(type);
    setShowBill(appendItem(showBill, dayId, arenaId, newItem));
  }, [showBill, setShowBill]);

  // Remove item
  const handleRemoveItem = useCallback((itemId) => {
    const loc = findItemLocation(showBill, itemId);
    if (!loc) return;
    const sb = JSON.parse(JSON.stringify(showBill));
    const day = sb.days.find(d => d.id === loc.dayId);
    const arena = day?.arenas.find(a => a.id === loc.arenaId);
    if (arena) {
      arena.items = arena.items.filter(i => i.id !== itemId);
    }
    setShowBill(renumberShowBill(sb));
  }, [showBill, setShowBill]);

  // Edit item
  const handleEditItem = useCallback((item) => {
    const loc = findItemLocation(showBill, item.id);
    if (loc) {
      setEditingItem(item);
      setEditingDayId(loc.dayId);
      setEditingArenaId(loc.arenaId);
    }
  }, [showBill]);

  const handleSaveEdit = useCallback((dayId, arenaId, itemId, updates) => {
    const sb = JSON.parse(JSON.stringify(showBill));
    const day = sb.days.find(d => d.id === dayId);
    const arena = day?.arenas.find(a => a.id === arenaId);
    if (arena) {
      const item = arena.items.find(i => i.id === itemId);
      if (item) {
        Object.assign(item, updates);
      }
    }
    setShowBill(renumberShowBill(sb));
  }, [showBill, setShowBill]);

  // Remove a class from a classBox
  const handleRemoveClassFromBox = useCallback((classBoxId, classId) => {
    const loc = findItemLocation(showBill, classBoxId);
    if (!loc) return;
    setShowBill(removeClassFromBox(showBill, loc.dayId, loc.arenaId, classBoxId, classId));
  }, [showBill, setShowBill]);

  // Bulk add classes to a specific arena
  const handleOpenBulkAdd = useCallback((dayId, arenaId) => {
    setBulkAddTarget({ dayId, arenaId });
    setBulkAddOpen(true);
  }, []);

  const handleBulkAdd = useCallback((classNames, options) => {
    const { dayId, arenaId } = bulkAddTarget;
    if (!dayId || !arenaId || !showBill) return;

    const sb = JSON.parse(JSON.stringify(showBill));
    const day = sb.days.find(d => d.id === dayId);
    const arena = day?.arenas.find(a => a.id === arenaId);
    if (!arena) return;

    const newItems = classNames.map(name => createShowBillItem('classBox', {
      title: name,
      classes: [],
      noPattern: options?.noPattern || false,
    }));
    arena.items.push(...newItems);

    setShowBill(renumberShowBill(sb));
    toast({
      title: 'Classes Added',
      description: `${classNames.length} class${classNames.length === 1 ? '' : 'es'} added to ${arena.name}.`,
    });
  }, [showBill, setShowBill, bulkAddTarget, toast]);

  // Custom collision detection: palette drags use pointerWithin to prevent
  // accidental placement when dragging within the palette list.
  const collisionDetection = useCallback((args) => {
    if (activeDragData?.origin === 'palette') {
      return pointerWithin(args);
    }
    return closestCenter(args);
  }, [activeDragData]);

  // --- DnD Handlers ---
  const handleDragStart = (event) => {
    const { active } = event;
    setActiveDragData(active.data.current);
  };

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveDragData(null);

    if (!over || !showBill) return;

    const activeData = active.data.current;

    // Case 1: Dragging from palette into an arena
    if (activeData?.origin === 'palette') {
      // Ignore drops back onto palette items (user was reordering within palette, not placing)
      const overId = String(over.id);
      if (overId.startsWith('palette-') || over.data.current?.origin === 'palette') {
        return;
      }

      const classItem = activeData.classItem;

      // Determine which classes to move (multi-select or single)
      const isMulti = selectedPaletteIds.has(classItem.id) && selectedPaletteIds.size > 1;
      const classesToMove = isMulti
        ? unplacedClasses.filter(c => selectedPaletteIds.has(c.id))
        : [classItem];

      // Case 1a: Dropped onto an existing classBox drop zone — add class(es) to that box
      if (over.data.current?.origin === 'classbox-drop') {
        const classBoxId = over.data.current.classBoxId;
        const loc = findItemLocation(showBill, classBoxId);
        if (loc) {
          const sb = JSON.parse(JSON.stringify(showBill));
          const arena = sb.days.find(d => d.id === loc.dayId)?.arenas.find(a => a.id === loc.arenaId);
          const box = arena?.items.find(i => i.id === classBoxId);
          if (box) {
            classesToMove.forEach(cls => {
              if (!box.classes.includes(cls.id)) box.classes.push(cls.id);
            });
          }
          setShowBill(sb);
        }
        clearSelection();
        return;
      }

      // Determine target arena
      let targetDayId, targetArenaId, targetIndex;

      if (over.data.current?.origin === 'arena-zone') {
        targetDayId = over.data.current.dayId;
        targetArenaId = over.data.current.arenaId;
        const day = showBill.days.find(d => d.id === targetDayId);
        const arena = day?.arenas.find(a => a.id === targetArenaId);
        targetIndex = arena?.items.length || 0;
      } else if (over.data.current?.sortable?.containerId) {
        const containerId = over.data.current.sortable.containerId;
        const [dayId, arenaId] = containerId.split('::');
        targetDayId = dayId;
        targetArenaId = arenaId;
        const day = showBill.days.find(d => d.id === dayId);
        const arena = day?.arenas.find(a => a.id === arenaId);
        targetIndex = arena?.items.findIndex(i => i.id === over.id);
        if (targetIndex === -1) targetIndex = arena?.items.length || 0;
      } else {
        return;
      }

      // Reject drops into closed arenas
      if ((showBill.closedArenas || {})[`${targetDayId}::${targetArenaId}`]) return;

      // Create classBox(es) — each class becomes its own classBox
      const sb = JSON.parse(JSON.stringify(showBill));
      const day = sb.days.find(d => d.id === targetDayId);
      const arena = day?.arenas.find(a => a.id === targetArenaId);
      if (arena) {
        const newItems = classesToMove.map(cls => createShowBillItem('classBox', {
          title: cls.name,
          classes: [cls.id],
        }));
        arena.items.splice(targetIndex, 0, ...newItems);
      }
      setShowBill(renumberShowBill(sb));
      clearSelection();
      return;
    }

    // Case 2: Reordering within or between arenas
    if (activeData?.origin === 'arena') {
      const activeContainerId = active.data.current?.sortable?.containerId;
      let overContainerId = over.data.current?.sortable?.containerId;

      // If dropped on an arena drop zone
      if (!overContainerId && over.data.current?.origin === 'arena-zone') {
        overContainerId = `${over.data.current.dayId}::${over.data.current.arenaId}`;
      }

      if (!activeContainerId || !overContainerId) return;

      const [srcDayId, srcArenaId] = activeContainerId.split('::');
      const [destDayId, destArenaId] = overContainerId.split('::');

      // Reject drops into closed arenas
      if ((showBill.closedArenas || {})[`${destDayId}::${destArenaId}`]) return;

      const isDraggedSelected = selectedArenaItemIds.has(active.id) && selectedArenaItemIds.size > 1;

      if (isDraggedSelected) {
        // Multi-move: collect all selected items, remove from sources, insert at drop position
        const sb = JSON.parse(JSON.stringify(showBill));

        // Find the original index of the over-item BEFORE removal to detect drag direction
        const destDayPre = sb.days.find(d => d.id === destDayId);
        const destArenaPre = destDayPre?.arenas.find(a => a.id === destArenaId);
        const overOriginalIdx = destArenaPre?.items.findIndex(i => i.id === over.id) ?? -1;
        let selectedBeforeOver = 0;
        if (destArenaPre) {
          for (let i = 0; i < overOriginalIdx; i++) {
            if (selectedArenaItemIds.has(destArenaPre.items[i].id)) selectedBeforeOver++;
          }
        }

        const collectedItems = [];

        // Remove selected items from their current positions (maintain relative order)
        for (const day of sb.days) {
          for (const arena of day.arenas) {
            const kept = [];
            for (const item of arena.items) {
              if (selectedArenaItemIds.has(item.id)) {
                collectedItems.push(item);
              } else {
                kept.push(item);
              }
            }
            arena.items = kept;
          }
        }

        // Find destination
        const destDay = sb.days.find(d => d.id === destDayId);
        const destArena = destDay?.arenas.find(a => a.id === destArenaId);
        if (!destArena) return;

        let destIndex = destArena.items.findIndex(i => i.id === over.id);
        if (destIndex === -1) {
          destIndex = destArena.items.length;
        } else if (selectedBeforeOver > 0) {
          // Items were dragged downward — insert AFTER the over-item
          destIndex += 1;
        }

        destArena.items.splice(destIndex, 0, ...collectedItems);
        setShowBill(renumberShowBill(sb));
        clearSelection();
        return;
      }

      // Single-item move (existing logic)
      const sb = JSON.parse(JSON.stringify(showBill));
      const srcDay = sb.days.find(d => d.id === srcDayId);
      const srcArena = srcDay?.arenas.find(a => a.id === srcArenaId);

      if (srcDayId === destDayId && srcArenaId === destArenaId) {
        // Same arena reorder
        if (!srcArena) return;
        const oldIndex = srcArena.items.findIndex(i => i.id === active.id);
        const newIndex = srcArena.items.findIndex(i => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        srcArena.items = arrayMove(srcArena.items, oldIndex, newIndex);
        setShowBill(renumberShowBill(sb));
      } else {
        // Cross-arena move
        const destDay = sb.days.find(d => d.id === destDayId);
        const destArena = destDay?.arenas.find(a => a.id === destArenaId);
        if (!srcArena || !destArena) return;

        const srcIndex = srcArena.items.findIndex(i => i.id === active.id);
        if (srcIndex === -1) return;
        const [movedItem] = srcArena.items.splice(srcIndex, 1);

        let destIndex = destArena.items.findIndex(i => i.id === over.id);
        if (destIndex === -1) destIndex = destArena.items.length;
        destArena.items.splice(destIndex, 0, movedItem);

        setShowBill(renumberShowBill(sb));
      }
    }
  }, [showBill, setShowBill, selectedPaletteIds, selectedArenaItemIds, unplacedClasses, clearSelection]);

  if (!showBill) {
    return <div className="text-center py-10 text-muted-foreground">Initializing show bill...</div>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <ShowBillToolbar
        showName={showBill.header?.showName}
        startDate={formData.startDate}
        endDate={formData.endDate}
        undoStack={undoStack}
        redoStack={redoStack}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSave}
        onGeneratePdf={handleGeneratePdf}
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        exportDisabled={formData.showStatus !== 'locked' && formData.showStatus !== 'published'}
      />

      <ShowBillHeader header={showBill.header} onUpdateHeader={handleUpdateHeader} />

      <DayTabs days={showBill.days} activeDayId={activeDayId} onChangeDay={setActiveDayId} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <ClassPalette
            allClassItems={allClassItems}
            unplacedClasses={unplacedClasses}
            associationsData={propAssociationsData}
            selectedIds={selectedPaletteIds}
            onToggleSelection={togglePaletteSelection}
            onBulkToggle={bulkTogglePaletteSelection}
            formData={formData}
          />
        </div>

        <div className="lg:col-span-9">
          <div className="bg-gray-50 dark:bg-muted/10 rounded-lg p-4 min-h-[500px] shadow-inner">
            {activeDay ? (
              <ArenaSection
                day={activeDay}
                onEditItem={handleEditItem}
                onRemoveItem={handleRemoveItem}
                onRemoveClassFromBox={handleRemoveClassFromBox}
                onInsertItem={handleInsertItem}
                onBulkAdd={handleOpenBulkAdd}
                allClassItems={allClassItems}
                associationsData={propAssociationsData}
                closedArenas={showBill.closedArenas || {}}
                onToggleArenaClosed={handleToggleArenaClosed}
                selectedArenaItemIds={selectedArenaItemIds}
                onToggleArenaItemSelection={toggleArenaItemSelection}
              />
            ) : (
              <p className="text-center text-muted-foreground py-10">Select a day to view the schedule</p>
            )}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragData?.origin === 'palette' && activeDragData.classItem && (
          <div className="p-2 border rounded-lg bg-background shadow-lg cursor-grabbing flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{activeDragData.classItem.name}</span>
            {selectedPaletteIds.has(activeDragData.classItem.id) && selectedPaletteIds.size > 1 && (
              <Badge className="ml-1">{selectedPaletteIds.size}</Badge>
            )}
          </div>
        )}
        {activeDragData?.origin === 'arena' && activeDragData.item && (
          <div className="p-2 border rounded-lg bg-background shadow-lg cursor-grabbing flex items-center gap-2 opacity-90">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{activeDragData.item.title || activeDragData.item.type}</span>
            {selectedArenaItemIds.has(activeDragData.item.id) && selectedArenaItemIds.size > 1 ? (
              <Badge className="ml-auto">{selectedArenaItemIds.size}</Badge>
            ) : (
              activeDragData.item.type === 'classBox' && activeDragData.item.number && (
                <Badge className="ml-auto">{activeDragData.item.number}</Badge>
              )
            )}
          </div>
        )}
      </DragOverlay>

      {/* Bulk add dialog */}
      <BulkAddDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        onBulkAdd={handleBulkAdd}
      />

      {/* Edit dialog */}
      {editingItem && (
        <ItemEditDialog
          item={editingItem}
          dayId={editingDayId}
          arenaId={editingArenaId}
          allClassItems={allClassItems}
          associationsData={propAssociationsData}
          unplacedClasses={unplacedClasses}
          onSave={handleSaveEdit}
          onClose={() => {
            setEditingItem(null);
            setEditingDayId(null);
            setEditingArenaId(null);
          }}
        />
      )}
    </DndContext>
  );
};

export default ShowBillBuilder;
