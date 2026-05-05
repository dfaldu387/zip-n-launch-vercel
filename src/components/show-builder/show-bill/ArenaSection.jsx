import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableShowBillItem from './SortableShowBillItem';
import InsertToolbar from './InsertToolbar';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ArenaDropZone = ({ arena, dayId, isClosed, onToggleClosed, onEditItem, onRemoveItem, onRemoveClassFromBox, onInsertItem, onBulkAdd, allClassItems, associationsData, selectedArenaItemIds, onToggleArenaItemSelection }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `droppable-${dayId}-${arena.id}`,
    data: { dayId, arenaId: arena.id, origin: 'arena-zone' },
  });

  return (
    <div className={cn(
      'border rounded-lg shadow-sm mb-4',
      isClosed ? 'bg-muted/50 opacity-60' : 'bg-white dark:bg-card'
    )}>
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <h4 className="font-bold text-base">{arena.name}</h4>
        <div className="flex items-center gap-2">
          {isClosed && (
            <Badge variant="secondary" className="text-xs">Closed</Badge>
          )}
          <Switch
            checked={!isClosed}
            onCheckedChange={onToggleClosed}
            className="scale-75"
          />
        </div>
      </div>

      {!isClosed ? (
        <div className="p-3">
          <SortableContext
            id={`${dayId}::${arena.id}`}
            items={arena.items.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              ref={setNodeRef}
              className={cn(
                'space-y-1 min-h-[60px] rounded-md transition-colors',
                isOver && 'bg-primary/5 ring-2 ring-primary/20',
                arena.items.length === 0 && 'border-2 border-dashed border-muted-foreground/20 flex items-center justify-center'
              )}
            >
              {arena.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6">
                  Drag classes here or use the buttons below to add items
                </p>
              ) : (
                arena.items.map(item => (
                  <SortableShowBillItem
                    key={item.id}
                    item={item}
                    onEdit={onEditItem}
                    onRemove={onRemoveItem}
                    onRemoveClassFromBox={onRemoveClassFromBox}
                    allClassItems={allClassItems}
                    associationsData={associationsData}
                    isSelected={selectedArenaItemIds?.has(item.id)}
                    onToggleSelection={onToggleArenaItemSelection}
                  />
                ))
              )}
            </div>
          </SortableContext>
          <InsertToolbar onInsert={(type) => onInsertItem(dayId, arena.id, type)} onBulkAdd={onBulkAdd ? () => onBulkAdd(dayId, arena.id) : undefined} />
        </div>
      ) : (
        <div className="p-3 text-center text-sm text-muted-foreground italic">
          Arena closed for this day
        </div>
      )}
    </div>
  );
};

const ArenaSection = ({ day, onEditItem, onRemoveItem, onRemoveClassFromBox, onInsertItem, onBulkAdd, allClassItems, associationsData, closedArenas, onToggleArenaClosed, selectedArenaItemIds, onToggleArenaItemSelection }) => {
  if (!day) return null;

  return (
    <div className="space-y-4">
      {day.arenas.length > 1 && (
        <h3 className="text-lg font-bold">{day.label}</h3>
      )}
      {day.arenas.map(arena => {
        const isClosed = !!closedArenas[`${day.id}::${arena.id}`];
        return (
          <ArenaDropZone
            key={arena.id}
            arena={arena}
            dayId={day.id}
            isClosed={isClosed}
            onToggleClosed={() => onToggleArenaClosed(day.id, arena.id)}
            onEditItem={onEditItem}
            onRemoveItem={onRemoveItem}
            onRemoveClassFromBox={onRemoveClassFromBox}
            onInsertItem={onInsertItem}
            onBulkAdd={onBulkAdd}
            allClassItems={allClassItems}
            associationsData={associationsData}
            selectedArenaItemIds={selectedArenaItemIds}
            onToggleArenaItemSelection={onToggleArenaItemSelection}
          />
        );
      })}
    </div>
  );
};

export default ArenaSection;
