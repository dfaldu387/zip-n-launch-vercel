import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { getAssociationLogo, getDefaultAssociationIcon, addLogoToAssociations } from '@/lib/associationsData';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Discipline classification ──────────────────────────────────────────────────

// Single-select families: mutually exclusive. Selecting any one family disables
// all other families AND all multi-select disciplines.
// Within a family, variant names across associations are treated as the same discipline.
const SINGLE_SELECT_FAMILIES = [
  { id: 'showmanship', label: 'Showmanship', names: ['Showmanship at Halter'] },
  { id: 'horsemanship', label: 'Horsemanship', names: ['Horsemanship', 'Western Horsemanship', 'Bareback Horsemanship'] },
  { id: 'hse', label: 'Hunt Seat Equitation', names: ['Hunt Seat Equitation'] },
];

// Flat set of all single-select discipline names for quick lookup
const ALL_SINGLE_SELECT_NAMES = new Set(
  SINGLE_SELECT_FAMILIES.flatMap(f => f.names)
);

// Find which family a discipline name belongs to (or null)
const getFamilyForName = (name) =>
  SINGLE_SELECT_FAMILIES.find(f => f.names.includes(name)) || null;

// Display sections in the required order
const DISCIPLINE_SECTIONS = [
  {
    id: 'showmanship',
    label: 'Showmanship',
    sublabel: 'Exclusive — selecting locks all other disciplines',
    selectionMode: 'single',
    names: ['Showmanship at Halter'],
  },
  {
    id: 'horsemanship',
    label: 'Horsemanship',
    sublabel: 'Exclusive — selecting locks all other disciplines',
    selectionMode: 'single',
    names: ['Horsemanship', 'Western Horsemanship', 'Bareback Horsemanship'],
  },
  {
    id: 'hse',
    label: 'Hunt Seat Equitation',
    sublabel: 'Exclusive — selecting locks all other disciplines',
    selectionMode: 'single',
    names: ['Hunt Seat Equitation'],
  },
  {
    id: 'ranch',
    label: 'Ranch',
    sublabel: 'Select any within this group',
    selectionMode: 'multi',
    names: ['Ranch Trail', 'VRH-RHC Ranch Trail'],
  },
  {
    id: 'trail',
    label: 'Trail',
    sublabel: 'Select any within this group',
    selectionMode: 'multi',
    names: ['Trail', 'In-Hand Trail'],
  },
  {
    id: 'jumping',
    label: 'Jumping & Over Fences',
    sublabel: 'Select any within this group',
    selectionMode: 'multi',
    names: ['Hunter Hack', 'Working Hunter', 'Equitation Over Fences', 'Jumping'],
  },
  {
    id: 'versatility',
    label: 'Versatility',
    sublabel: 'Select any within this group',
    selectionMode: 'multi',
    names: ['English Versatility', 'Western Versatility'],
  },
];

// All names that appear in a predefined section
const ALL_SECTION_NAMES = new Set(DISCIPLINE_SECTIONS.flatMap(s => s.names));

// ── Sub-components ─────────────────────────────────────────────────────────────

const DisciplineCheckbox = ({ disc, isSelected, isDisabled, onToggle }) => (
  <div className={cn('flex items-center space-x-2', isDisabled && 'opacity-40')}>
    <Checkbox
      id={`disc-${disc.id}`}
      checked={isSelected}
      disabled={isDisabled}
      onCheckedChange={(checked) => onToggle(disc, checked)}
    />
    <Label
      htmlFor={`disc-${disc.id}`}
      className={cn(
        'font-normal text-sm',
        isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      {disc.name.replace(' at Halter', '')}
    </Label>
  </div>
);

const DisciplineSectionGrid = ({
  disciplines,
  selectedKeys,
  onToggle,
  activeSectionId,
}) => {
  const renderSection = (section) => {
    const sectionDiscs = section.names
      .map(name => disciplines.find(d => d.name === name))
      .filter(Boolean);

    if (sectionDiscs.length === 0) return null;

    const isSectionLocked = activeSectionId && activeSectionId !== section.id;
    const isSingleSection = section.selectionMode === 'single';

    return (
      <div
        key={section.id}
        className={cn(
          'space-y-0.5 rounded-md border bg-card px-2 py-1.5',
          isSectionLocked ? 'border-border/50 opacity-50' : 'border-border',
        )}
      >
        <div className="flex items-center gap-2 px-1">
          <h5 className="text-sm font-semibold text-foreground">{section.label}</h5>
          {isSingleSection && (
            <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pl-2">
          {sectionDiscs.map(disc => {
            const key = `${disc.association_id}::${disc.name}`;
            const isSelected = selectedKeys.has(key);

            return (
              <DisciplineCheckbox
                key={disc.id}
                disc={disc}
                isSelected={isSelected}
                isDisabled={!!isSectionLocked}
                onToggle={onToggle}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // Catch-all for disciplines not in any predefined section (deduplicate by name)
  const uncategorized = disciplines.filter(d => !ALL_SECTION_NAMES.has(d.name))
    .filter((d, i, arr) => arr.findIndex(x => x.name === d.name) === i);
  const isOtherLocked = activeSectionId && activeSectionId !== 'other';

  return (
    <div className="space-y-2">
      {DISCIPLINE_SECTIONS.map(renderSection)}
      {uncategorized.length > 0 && (
        <div className={cn('space-y-1', isOtherLocked && 'opacity-50')}>
          <h5 className="text-sm font-semibold text-foreground px-1">Other Disciplines</h5>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pl-2">
            {uncategorized.map(disc => (
              <DisciplineCheckbox
                key={disc.id}
                disc={disc}
                isSelected={selectedKeys.has(`${disc.association_id}::${disc.name}`)}
                isDisabled={!!isOtherLocked}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AssociationDisciplineGroup = ({
  association,
  disciplines,
  selectedKeys,
  onToggle,
  activeSectionId,
}) => {
  const enriched = useMemo(() => addLogoToAssociations([association])[0], [association]);
  const logoUrl = getAssociationLogo(enriched);
  const Icon = getDefaultAssociationIcon(enriched);

  // Only show custom pattern type disciplines
  const customDisciplines = disciplines.filter(d => d.pattern_type === 'custom');
  if (customDisciplines.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-1 bg-muted/50">
        {logoUrl ? (
          <img src={logoUrl} alt={`${association.name} logo`} className="h-6 object-contain" />
        ) : (
          <Icon className="h-6 w-6 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold">{association.name || association.id}</span>
      </div>
      <div className="p-1.5">
        <DisciplineSectionGrid
          disciplines={customDisciplines}
          selectedKeys={selectedKeys}
          onToggle={onToggle}
          activeSectionId={activeSectionId}
        />
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

export const Step2_DisciplineAndClass = ({ formData, setFormData, disciplineLibrary, associationsData }) => {
  const selectedClasses = formData.selectedClasses || [];

  // Set of selected keys for quick lookup
  const selectedKeys = useMemo(() => new Set(selectedClasses), [selectedClasses]);

  // Associations chosen in Step 1
  const selectedAssocIds = useMemo(
    () => Object.keys(formData.associations || {}).filter(k => formData.associations[k]),
    [formData.associations],
  );

  // Group disciplines by association
  const groupedByAssociation = useMemo(() => {
    const groups = [];
    for (const assocId of selectedAssocIds) {
      const association = (associationsData || []).find(a => a.id === assocId);
      if (!association) continue;
      const disciplines = (disciplineLibrary || []).filter(d => d.association_id === assocId);
      if (disciplines.length > 0) {
        groups.push({ association, disciplines });
      }
    }
    return groups;
  }, [selectedAssocIds, disciplineLibrary, associationsData]);

  // Determine which discipline section is currently active (has selections)
  // Only one group can be active at a time — all others are frozen
  const activeSectionId = useMemo(() => {
    const selectedNames = selectedClasses.map(key =>
      key.includes('::') ? key.split('::')[1] : key,
    );
    if (selectedNames.length === 0) return null;

    for (const section of DISCIPLINE_SECTIONS) {
      if (selectedNames.some(name => section.names.includes(name))) {
        return section.id;
      }
    }
    // Selections exist but don't match any predefined section
    return 'other';
  }, [selectedClasses]);

  // All custom disciplines across selected associations (for global sync matching)
  const allCustomDisciplines = useMemo(
    () => (disciplineLibrary || []).filter(
      d => d.pattern_type === 'custom' && selectedAssocIds.includes(d.association_id),
    ),
    [disciplineLibrary, selectedAssocIds],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDisciplineToggle = useCallback((disc, checked) => {
    const disciplineName = disc.name;
    const isSingleGroup = ALL_SINGLE_SELECT_NAMES.has(disciplineName);

    setFormData(prev => {
      let current = [...(prev.selectedClasses || [])];
      const allAssocIds = Object.keys(prev.associations || {}).filter(k => prev.associations[k]);

      if (checked) {
        if (isSingleGroup) {
          // Single-select: clear ALL existing selections first
          current = [];

          // Find the family this discipline belongs to
          const family = getFamilyForName(disciplineName);
          if (family) {
            // Add all variant names from this family across all selected associations
            allCustomDisciplines
              .filter(d => family.names.includes(d.name) && allAssocIds.includes(d.association_id))
              .forEach(d => {
                const key = `${d.association_id}::${d.name}`;
                if (!current.includes(key)) current.push(key);
              });
          }
        } else {
          // Multi-select: add same-named discipline across all selected associations
          allCustomDisciplines
            .filter(d => d.name === disciplineName && allAssocIds.includes(d.association_id))
            .forEach(d => {
              const key = `${d.association_id}::${d.name}`;
              if (!current.includes(key)) current.push(key);
            });
        }
      } else {
        // Uncheck: remove this discipline (or family) from ALL associations
        if (isSingleGroup) {
          const family = getFamilyForName(disciplineName);
          const namesToRemove = new Set(family ? family.names : [disciplineName]);
          current = current.filter(c => {
            const name = c.includes('::') ? c.split('::')[1] : c;
            return !namesToRemove.has(name);
          });
        } else {
          current = current.filter(c => {
            const name = c.includes('::') ? c.split('::')[1] : c;
            return name !== disciplineName;
          });
        }
      }

      return {
        ...prev,
        selectedClasses: current,
        selectedDiscipline: current.length > 0 ? current[0].split('::')[1] : '',
      };
    });
  }, [allCustomDisciplines, setFormData]);

  const handleRemoveSelection = useCallback((disciplineName) => {
    // Remove by discipline name across all associations (global unsync)
    const isSingleGroup = ALL_SINGLE_SELECT_NAMES.has(disciplineName);

    setFormData(prev => {
      let updated;
      if (isSingleGroup) {
        const family = getFamilyForName(disciplineName);
        const namesToRemove = new Set(family ? family.names : [disciplineName]);
        updated = (prev.selectedClasses || []).filter(c => {
          const name = c.includes('::') ? c.split('::')[1] : c;
          return !namesToRemove.has(name);
        });
      } else {
        updated = (prev.selectedClasses || []).filter(c => {
          const name = c.includes('::') ? c.split('::')[1] : c;
          return name !== disciplineName;
        });
      }
      return {
        ...prev,
        selectedClasses: updated,
        selectedDiscipline: updated.length > 0 ? updated[0].split('::')[1] : '',
      };
    });
  }, [setFormData]);

  // ── Grouped summary: unique discipline names with their associations ──────

  const disciplineSummary = useMemo(() => {
    const map = new Map(); // name → Set of assocIds
    for (const key of selectedClasses) {
      if (!key.includes('::')) continue;
      const [assocId, name] = key.split('::');
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(assocId);
    }
    return Array.from(map.entries()).map(([name, assocs]) => ({
      name,
      assocIds: Array.from(assocs),
    }));
  }, [selectedClasses]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      key="step-2"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Step 2: Select Disciplines</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupedByAssociation.length === 0 ? (
          <div className="flex items-center justify-center h-40 rounded-md border border-dashed bg-muted/30">
            <p className="text-sm text-muted-foreground">
              No associations selected. Go back to Step 1 to select at least one association.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {groupedByAssociation.map(({ association, disciplines }) => (
              <AssociationDisciplineGroup
                key={association.id}
                association={association}
                disciplines={disciplines}
                selectedKeys={selectedKeys}
                onToggle={handleDisciplineToggle}
                activeSectionId={activeSectionId}
              />
            ))}
          </div>
        )}

        {/* Selected disciplines summary — grouped by discipline name */}
        {disciplineSummary.length > 0 && (
          <div className="pt-3 border-t">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Selected Disciplines ({disciplineSummary.length}) across {selectedAssocIds.length} association{selectedAssocIds.length !== 1 ? 's' : ''}:
            </Label>
            <div className="flex flex-wrap gap-2">
              {disciplineSummary.map(({ name, assocIds }) => (
                <Badge
                  key={name}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-destructive/20 gap-1.5 py-1"
                  onClick={() => handleRemoveSelection(name)}
                >
                  <span>{name.replace(' at Halter', '')}</span>
                  <span className="text-muted-foreground font-normal">
                    ({assocIds.join(', ')})
                  </span>
                  <span>&times;</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </motion.div>
  );
};
