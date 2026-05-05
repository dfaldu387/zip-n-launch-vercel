import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, ListChecks, Upload, PenTool, Package } from 'lucide-react';

const SummarySection = ({ icon: Icon, title, children, onNavigate }) => (
  <div className="flex gap-3 p-3 rounded-md border bg-card">
    <div className="flex-shrink-0 mt-0.5">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="flex-grow min-w-0">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        {onNavigate && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onNavigate}>
            Edit
          </Button>
        )}
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  </div>
);

const SubmissionSummary = ({ formData, associationsData, uploadSlots, onGoToStep }) => {
  const selectedAssocNames = Object.keys(formData.associations || {})
    .filter(k => formData.associations[k])
    .map(id => {
      const assoc = (associationsData || []).find(a => a.id === id);
      return assoc?.abbreviation || assoc?.name || id;
    });

  const slots = uploadSlots || formData.hierarchyOrder;
  const uploadedPatterns = slots
    .filter(h => formData.patterns?.[h.id])
    .map(h => h.title);

  const totalManeuvers = Object.values(formData.patternManeuvers || {})
    .reduce((sum, list) => sum + (list?.length || 0), 0);

  const totalAnnotations = Object.values(formData.patternAnnotations || {})
    .filter(a => a?.imageDataUrl).length;

  const docCount = (formData.accessoryDocs || []).length;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm mb-3">Submission Summary</h3>

      <SummarySection icon={FileText} title="Pattern Set" onNavigate={() => onGoToStep(1)}>
        <p className="font-medium text-foreground">{formData.showName || 'Untitled'}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {selectedAssocNames.length > 0 ? (
            selectedAssocNames.map(name => (
              <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
            ))
          ) : (
            <span className="text-xs text-destructive">No associations selected</span>
          )}
        </div>
      </SummarySection>

      <SummarySection icon={ListChecks} title="Disciplines" onNavigate={() => onGoToStep(2)}>
        {formData.selectedClasses?.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {[...new Set(formData.selectedClasses.map(key =>
              key.includes('::') ? key.split('::')[1] : key
            ))].map(name => (
              <Badge key={name} variant="outline" className="text-xs">
                {name.replace(' at Halter', '')}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-destructive">No disciplines selected</span>
        )}
      </SummarySection>

      <SummarySection icon={Upload} title="Uploaded Patterns" onNavigate={() => onGoToStep(3)}>
        {uploadedPatterns.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {uploadedPatterns.map(title => (
              <Badge key={title} variant="outline" className="text-xs">{title}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-destructive">No patterns uploaded</span>
        )}
      </SummarySection>

      <SummarySection icon={PenTool} title="Maneuvers & Annotations" onNavigate={() => onGoToStep(4)}>
        <p className="text-xs">
          {totalManeuvers > 0 ? `${totalManeuvers} maneuver step${totalManeuvers !== 1 ? 's' : ''}` : 'No maneuvers'}{' '}
          &middot;{' '}
          {totalAnnotations > 0 ? `${totalAnnotations} annotated pattern${totalAnnotations !== 1 ? 's' : ''}` : 'No annotations'}
        </p>
      </SummarySection>

      <SummarySection icon={Package} title="Supporting Documents" onNavigate={() => onGoToStep(5)}>
        <p className="text-xs">
          {docCount > 0 ? `${docCount} document${docCount !== 1 ? 's' : ''} attached` : 'None'}
          {formData.equipmentNotes?.trim() && ' · Equipment notes added'}
        </p>
      </SummarySection>
    </div>
  );
};

export default SubmissionSummary;
