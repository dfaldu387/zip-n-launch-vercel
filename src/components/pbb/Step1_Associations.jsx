import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssociationSelection } from '@/components/shared/AssociationSelection';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { groupShowRecords } from '@/lib/showGrouping';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

export const Step1_Associations = ({ isHub, selectedPurposeName, isReadOnly = false, isLocked = false, onUnlock, existingProjects = [], formData, setFormData, ...props }) => {
  const effectiveReadOnly = isReadOnly || isLocked;
  const navigate = useNavigate();
  const { toast } = useToast();

  // One dropdown entry per real show; linking copies pattern selections, so the
  // pattern book record stands for the group.
  const showGroups = React.useMemo(
    () => groupShowRecords(existingProjects, { preferType: 'pattern_book' }),
    [existingProjects],
  );

  const handleLinkProject = (projectId) => {
    if (projectId === 'none') {
      setFormData((prev) => ({
        ...prev,
        linkedProjectId: null,
        showName: '',
        showNumber: '',
        associations: {},
        customAssociations: [],
        primaryAffiliates: [],
      }));
      return;
    }
    const project = existingProjects.find((p) => p.id === projectId);

    // A show has ONE pattern book. Picking a show that already has one, from a book
    // that has not been saved yet, opens that book. Linking used to copy it into a
    // brand-new row every time, which is how one show ended up with 3-4 books.
    // (To start next year's book from this one, use "Duplicate Show".)
    if (project?.project_type === 'pattern_book' && !formData?.id && projectId !== formData?.id) {
      toast({ title: 'Opened the existing pattern book', description: `"${project.project_name || 'This show'}" already has a pattern book, so it was opened instead of making a copy.` });
      navigate(`/pattern-book-builder/${projectId}`);
      return;
    }

    if (project?.project_data) {
      const pd = project.project_data;
      setFormData((prev) => ({
        ...prev,
        // Store reference to linked project (read-only — never use as save target)
        linkedProjectId: projectId,
        // Step 1: Associations & show info
        showName: pd.showName || prev.showName,
        showNumber: pd.showNumber || prev.showNumber,
        associations: pd.associations || prev.associations,
        customAssociations: pd.customAssociations || prev.customAssociations,
        primaryAffiliates: pd.primaryAffiliates || prev.primaryAffiliates,
        subAssociationSelections: pd.subAssociationSelections || prev.subAssociationSelections,
        selected4HCity: pd.selected4HCity || prev.selected4HCity,
        targetAudience: pd.targetAudience || prev.targetAudience,
        // Step 2: Disciplines
        disciplines: pd.disciplines || prev.disciplines,
        // Step 3: Class configuration (divisionOrder, patternGroups, etc. are inside disciplines)
        // Step 4: Show details - dates, venue, judges, staff
        startDate: pd.startDate || prev.startDate,
        endDate: pd.endDate || prev.endDate,
        venueName: pd.venueName || prev.venueName,
        venueAddress: pd.venueAddress || prev.venueAddress,
        officials: pd.officials || prev.officials,
        associationJudges: pd.associationJudges || prev.associationJudges,
        showDetails: pd.showDetails || prev.showDetails,
        staff: pd.staff || prev.staff,
        schedule: pd.schedule || prev.schedule,
        // Step 5: Pattern selections
        patternSelections: pd.patternSelections || prev.patternSelections,
        disciplinePatterns: pd.disciplinePatterns || prev.disciplinePatterns,
        // Other saved data
        groupDueDates: pd.groupDueDates || prev.groupDueDates,
        groupStaff: pd.groupStaff || prev.groupStaff,
        groupJudges: pd.groupJudges || prev.groupJudges,
        showClassNumbers: pd.showClassNumbers ?? prev.showClassNumbers,
      }));
    }
  };

  return (
    <>
      {!isHub && (
      <div className="mb-4">
        <LinkToExistingShow
          existingProjects={showGroups.map(g => g.primary)}
          linkedProjectId={showGroups.find(g => g.members.some(m => m.id === formData?.linkedProjectId))?.primary.id || formData?.linkedProjectId || null}
          hideProjectType
          // Linking copies another show's details over this book. Once the book is saved
          // that would overwrite its real content, so linking is for a new book only.
          disabled={!!formData?.id}
          onLink={handleLinkProject}
          description={formData?.id
            ? 'This pattern book is already saved, so it can no longer be linked. To link to a show, start a new pattern book.'
            : 'Link to an existing show or pattern book project to auto-fill show details.'}
        />
      </div>
      )}
      {isLocked && !isReadOnly && (
        <div className="flex items-center justify-between p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800 dark:text-amber-300">
              This section is locked after save to prevent accidental changes.
            </span>
          </div>
          {onUnlock && (
            <Button variant="outline" size="sm" onClick={onUnlock}>
              <Unlock className="h-3.5 w-3.5 mr-1" /> Unlock
            </Button>
          )}
        </div>
      )}
      <AssociationSelection {...props} formData={formData} setFormData={setFormData} context={isHub ? "hub" : "pbb"} selectedPurposeName={selectedPurposeName} isReadOnly={effectiveReadOnly} />
    </>
  );
};
