import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';

const SortableManeuverItem = ({ maneuver, index, onUpdate, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: maneuver.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-md border bg-card group"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="text-sm font-mono font-semibold text-muted-foreground min-w-[28px] text-right">
        {index + 1}.
      </span>

      <Input
        value={maneuver.instruction}
        onChange={(e) => onUpdate(maneuver.id, { instruction: e.target.value })}
        className="flex-grow text-sm h-8"
        placeholder="Enter maneuver instruction..."
      />

      <div className="flex items-center gap-1">
        <Checkbox
          id={`optional-${maneuver.id}`}
          checked={maneuver.isOptional}
          onCheckedChange={(checked) => onUpdate(maneuver.id, { isOptional: !!checked })}
        />
        <Label htmlFor={`optional-${maneuver.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
          Optional
        </Label>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(maneuver.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

const ManeuverList = ({ maneuvers = [], onChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = maneuvers.findIndex(m => m.id === active.id);
    const newIndex = maneuvers.findIndex(m => m.id === over.id);
    const reordered = arrayMove(maneuvers, oldIndex, newIndex).map((m, i) => ({
      ...m,
      stepNumber: i + 1,
    }));
    onChange(reordered);
  };

  const handleUpdate = (id, updates) => {
    onChange(maneuvers.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleDelete = (id) => {
    const filtered = maneuvers.filter(m => m.id !== id).map((m, i) => ({
      ...m,
      stepNumber: i + 1,
    }));
    onChange(filtered);
  };

  const handleAdd = () => {
    const newManeuver = {
      id: uuidv4(),
      stepNumber: maneuvers.length + 1,
      instruction: '',
      isOptional: false,
    };
    onChange([...maneuvers, newManeuver]);
  };

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={maneuvers.map(m => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {maneuvers.map((maneuver, index) => (
            <SortableManeuverItem
              key={maneuver.id}
              maneuver={maneuver}
              index={index}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="mr-2 h-3.5 w-3.5" /> Add Maneuver
      </Button>
    </div>
  );
};

export default ManeuverList;
