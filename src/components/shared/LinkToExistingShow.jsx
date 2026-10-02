import React, { useMemo, useState } from 'react';
import { groupShowRecords } from '@/lib/showGrouping';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Link2, Copy, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';

// A record that is only a pattern book, with no show behind it, is tagged; a real
// show has no tag.
const optionLabel = (p, hideProjectType) => {
  const tag = hideProjectType
    ? (p.project_type === 'pattern_book' ? ' · Pattern book only' : '')
    : ` (${p.project_type})`;
  return `${p.project_name || 'Untitled'}${tag}`;
};

/**
 * Reusable "Link to Existing Show" card.
 *
 * Props:
 *  - existingProjects: array of project rows from Supabase
 *  - linkedProjectId: currently linked project id (or null)
 *  - onLink(projectId): called with 'none' or a project id
 *  - onDuplicated(newProject): optional callback after duplication
 *  - description: optional override for the helper text
 */
export const LinkToExistingShow = ({
  existingProjects = [],
  linkedProjectId,
  onLink,
  onDuplicated,
  hideProjectType = true,
  disabled = false,
  description = 'Link this to an existing show or pattern book project to auto-fill show details.',
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDuplicating, setIsDuplicating] = useState(false);

  // One entry per real show. A show and its pattern book are separate saved rows, so
  // every page that listed them raw showed the same show 2-3 times. Pages may also
  // pass in rows already grouped; grouping those again changes nothing.
  const groups = useMemo(() => groupShowRecords(existingProjects), [existingProjects]);
  const options = groups.map((g) => g.primary);
  const shownLinkedId = linkedProjectId
    ? (groups.find((g) => g.members.some((m) => m.id === linkedProjectId))?.primary.id || linkedProjectId)
    : null;

  const selectedProject = shownLinkedId
    ? existingProjects.find((p) => p.id === shownLinkedId)
    : null;

  const handleDuplicate = async () => {
    if (!selectedProject || !user) return;
    setIsDuplicating(true);
    try {
      const sourcePd = selectedProject.project_data || {};
      const sourceYear = sourcePd.startDate?.slice(0, 4);
      const nextYear = sourceYear ? String(Number(sourceYear) + 1) : '';

      // Build new name: append next year or "(Copy)"
      const baseName = selectedProject.project_name || 'Untitled';
      const newName = nextYear
        ? baseName.replace(new RegExp(`\\s*-?\\s*${sourceYear}$`), '').trim() + ` - ${nextYear}`
        : `${baseName} (Copy)`;

      // Copy project_data but clear date-specific and transient fields
      const newPd = {
        ...sourcePd,
        showName: newName.replace(/ \(show\)$/, ''),
        startDate: null,
        endDate: null,
        showBill: null,
        layoutSettings: null,
        showStatus: 'draft',
        linkedProjectId: null,
        lockedSections: { step1: false, structure: false },
        // Clear arena dates but keep arena names
        arenas: (sourcePd.arenas || []).map((a) => ({ ...a, dates: [] })),
        // Clear pattern selections (user needs to re-pick for new year)
        patternSelections: {},
        disciplinePatterns: {},
      };

      // Get next show number
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('project_type', selectedProject.project_type);
      const showNumber = (count || 0) + 1;

      const newId = uuidv4();
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          id: newId,
          project_name: newName,
          project_type: selectedProject.project_type,
          project_data: { ...newPd, showNumber },
          status: 'draft',
          user_id: user.id,
        }])
        .select('id, project_name, project_type, project_data, status')
        .single();

      if (error) throw error;

      toast({
        title: 'Show Duplicated',
        description: `"${newName}" created with schedule, structure, fees & sponsors copied.`,
      });

      if (onDuplicated) onDuplicated(data);
    } catch (err) {
      toast({ title: 'Error duplicating show', description: err.message, variant: 'destructive' });
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <Label className="font-semibold">Link to Existing Show (Optional)</Label>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-center gap-2">
        <Select value={shownLinkedId || 'none'} onValueChange={onLink} disabled={disabled}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Select a project..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No linked project</SelectItem>
            {options.map((p) => {
              return (
                <SelectItem key={p.id} value={p.id}>
                  {optionLabel(p, hideProjectType)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {linkedProjectId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={isDuplicating}
            title="Duplicate this show for next year"
          >
            {isDuplicating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            Duplicate Show
          </Button>
        )}
      </div>
      {linkedProjectId && (
        <Badge variant="secondary" className="text-xs">
          <Link2 className="h-3 w-3 mr-1" />
          Linked to project
        </Badge>
      )}
    </Card>
  );
};
