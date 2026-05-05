import React, { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, GripVertical, CalendarDays, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const DraggablePaletteClass = ({ classItem, associationsData, isSelected, onToggleSelection, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${classItem.id}`,
    data: { origin: 'palette', classItem },
  });

  const assoc = associationsData?.find(a => a.id === classItem.assocId);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'group/item flex items-center gap-1.5 px-2 py-1.5 rounded bg-background touch-none cursor-grab active:cursor-grabbing text-sm transition-colors',
        isDragging && 'opacity-50',
        isSelected
          ? 'bg-primary/10 border border-primary/30'
          : 'border border-transparent hover:bg-accent/40'
      )}
    >
      {onToggleSelection && (
        <div
          onClick={(e) => { e.stopPropagation(); onToggleSelection(classItem.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <Checkbox
            checked={!!isSelected}
            className="h-3.5 w-3.5 pointer-events-none"
          />
        </div>
      )}
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="flex-grow font-medium leading-snug break-words min-w-0">{classItem.name}</span>
      {assoc && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
          {assoc.abbreviation || assoc.name}
        </Badge>
      )}
      {(onMoveUp || onMoveDown) && (
        <div className="flex flex-col shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={isFirst}
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(classItem); }}
            className="h-3.5 w-3.5 flex items-center justify-center rounded hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(classItem); }}
            className="h-3.5 w-3.5 flex items-center justify-center rounded hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};

// Group header with select-all checkbox for a discipline
const DisciplineGroupHeader = ({ discipline, classes, selectedIds, onBulkToggle }) => {
  const classIds = classes.map(c => c.id);
  const selectedCount = classIds.filter(id => selectedIds?.has(id)).length;
  const allSelected = classIds.length > 0 && selectedCount === classIds.length;

  const handleToggle = () => {
    if (onBulkToggle) {
      onBulkToggle(classIds, !allSelected);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        'flex items-center gap-1.5 w-full px-2 py-1.5 rounded transition-colors',
        allSelected
          ? 'bg-primary/10 hover:bg-primary/15'
          : 'hover:bg-accent/50'
      )}
    >
      <Checkbox
        checked={allSelected}
        className="h-3.5 w-3.5 shrink-0 pointer-events-none"
      />
      <span className={cn(
        'text-xs font-semibold uppercase tracking-wider transition-colors',
        allSelected ? 'text-primary' : 'text-muted-foreground'
      )}>
        {discipline}
      </span>
      <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">{classes.length}</Badge>
    </button>
  );
};

// Get the assigned competition date for a class from formData disciplines
function getClassDate(classItem, formData) {
  const divId = classItem.divisionId || classItem.id;
  const discipline = (formData.disciplines || []).find(d =>
    d.id === classItem.disciplineId || (d.divisionOrder || []).includes(divId)
  );
  return discipline?.divisionDates?.[divId] || null;
}

function formatDateLabel(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Sub-group a flat list of classes by discipline name
function groupByDiscipline(classes) {
  const groups = {};
  classes.forEach(cls => {
    const key = cls.disciplineName || 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(cls);
  });
  return Object.entries(groups);
}

const ClassPalette = ({ allClassItems, unplacedClasses, associationsData, selectedIds, onToggleSelection, onBulkToggle, formData, activeDayDate, onReorderClass }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter by active day: only show classes assigned to this day, or unassigned classes
  const dayFilteredClasses = useMemo(() => {
    if (!activeDayDate) return unplacedClasses;
    return unplacedClasses.filter(cls => {
      const date = getClassDate(cls, formData);
      return !date || date === activeDayDate;
    });
  }, [unplacedClasses, activeDayDate, formData]);

  const filteredClasses = useMemo(() => {
    if (!searchTerm) return dayFilteredClasses;
    return dayFilteredClasses.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [dayFilteredClasses, searchTerm]);

  // Group by assigned date
  const groupedByDate = useMemo(() => {
    const dateGroups = {};
    const unassigned = [];

    filteredClasses.forEach(cls => {
      const date = getClassDate(cls, formData);
      if (date) {
        if (!dateGroups[date]) dateGroups[date] = [];
        dateGroups[date].push(cls);
      } else {
        unassigned.push(cls);
      }
    });

    const sortedDates = Object.keys(dateGroups).sort();
    const result = [];
    sortedDates.forEach(date => {
      result.push({ key: date, label: formatDateLabel(date), icon: true, classes: dateGroups[date] });
    });
    if (unassigned.length > 0) {
      result.push({ key: '_unassigned', label: 'Unassigned', icon: false, classes: unassigned });
    }
    return result;
  }, [filteredClasses, formData]);

  const hasAnyDates = groupedByDate.some(g => g.key !== '_unassigned');

  // Discipline-only groups (fallback when no dates assigned)
  const disciplineGroups = useMemo(() => {
    if (hasAnyDates) return null;
    return groupByDiscipline(filteredClasses);
  }, [filteredClasses, hasAnyDates]);

  const placedCount = allClassItems.length - unplacedClasses.length;
  const isEmpty = filteredClasses.length === 0;

  // Render a list of classes grouped by discipline with select-all headers
  const renderDisciplineClasses = (classes) => {
    const groups = groupByDiscipline(classes);
    return groups.map(([discipline, clsList]) => (
      <div key={discipline}>
        <DisciplineGroupHeader
          discipline={discipline}
          classes={clsList}
          selectedIds={selectedIds}
          onBulkToggle={onBulkToggle}
        />
        <div className="space-y-1 mt-1">
          {clsList.map((cls, idx) => (
            <DraggablePaletteClass
              key={cls.id}
              classItem={cls}
              associationsData={associationsData}
              isSelected={selectedIds?.has(cls.id)}
              onToggleSelection={onToggleSelection}
              onMoveUp={onReorderClass ? (c) => onReorderClass(c, 'up') : undefined}
              onMoveDown={onReorderClass ? (c) => onReorderClass(c, 'down') : undefined}
              isFirst={idx === 0}
              isLast={idx === clsList.length - 1}
            />
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-1">Class Palette</h3>
      <p className="text-xs text-muted-foreground mb-3">
        {placedCount} of {allClassItems.length} placed
      </p>

      <div className="relative mb-3">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search classes..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <Label className="text-sm font-medium text-muted-foreground mb-2">
        Unplaced Classes ({dayFilteredClasses.length})
      </Label>

      <ScrollArea className="flex-grow border rounded-lg p-2 bg-muted/30">
        {isEmpty && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {dayFilteredClasses.length === 0
              ? (unplacedClasses.length === 0 ? 'All classes placed!' : 'No classes for this day')
              : 'No matches found'}
          </p>
        )}

        <div className="space-y-3">
          {hasAnyDates ? (
            // Date-grouped view with discipline sub-groups
            groupedByDate.map(group => (
              <div key={group.key}>
                <div className="flex items-center gap-1.5 mb-1.5 px-1">
                  {group.icon && <CalendarDays className="h-3.5 w-3.5 text-primary" />}
                  <p className={cn(
                    'text-xs font-semibold uppercase tracking-wider',
                    group.key === '_unassigned' ? 'text-amber-600 dark:text-amber-400' : 'text-primary'
                  )}>
                    {group.label}
                  </p>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">{group.classes.length}</Badge>
                </div>
                <div className="space-y-2 pl-1">
                  {renderDisciplineClasses(group.classes)}
                </div>
              </div>
            ))
          ) : disciplineGroups ? (
            // Discipline-only fallback with select-all headers
            disciplineGroups.map(([discipline, classes]) => (
              <div key={discipline}>
                <DisciplineGroupHeader
                  discipline={discipline}
                  classes={classes}
                  selectedIds={selectedIds}
                  onBulkToggle={onBulkToggle}
                />
                <div className="space-y-1 mt-1">
                  {classes.map((cls, idx) => (
                    <DraggablePaletteClass
                      key={cls.id}
                      classItem={cls}
                      associationsData={associationsData}
                      isSelected={selectedIds?.has(cls.id)}
                      onToggleSelection={onToggleSelection}
                      onMoveUp={onReorderClass ? (c) => onReorderClass(c, 'up') : undefined}
                      onMoveDown={onReorderClass ? (c) => onReorderClass(c, 'down') : undefined}
                      isFirst={idx === 0}
                      isLast={idx === classes.length - 1}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ClassPalette;
