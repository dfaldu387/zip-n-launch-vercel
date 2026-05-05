import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssociationSelection } from '@/components/shared/AssociationSelection';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';

export const Step1_Associations = ({ isHub, selectedPurposeName, isReadOnly = false, isLocked = false, onUnlock, existingProjects = [], formData, setFormData, ...props }) => {
  const effectiveReadOnly = isReadOnly || isLocked;

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
          existingProjects={existingProjects}
          linkedProjectId={formData?.linkedProjectId || null}
          onLink={handleLinkProject}
          description="Link to an existing show or pattern book project to auto-fill show details."
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
