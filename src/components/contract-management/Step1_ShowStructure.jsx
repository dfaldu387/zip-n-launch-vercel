import React, { useMemo, useState } from 'react';
import { AssociationSelection } from '@/components/shared/AssociationSelection';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Link2 } from 'lucide-react';
import { applyLinkedProjectData } from '@/lib/contractUtils';

export const Step1_ShowStructure = ({ formData, setFormData, associationsData = [], existingProjects = [] }) => {
  // Only show-type projects in the "Link to Existing Show" dropdown, deduplicated by name
  const linkableProjects = useMemo(() => {
    const seen = new Set();
    return existingProjects.filter((p) => {
      const name = (p.project_name || '').trim().toLowerCase();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [existingProjects]);
  // Check for duplicate show name (skip when linked to an existing project)
  const duplicateNameWarning = useMemo(() => {
    if (formData.linkedProjectId) return null;
    const name = (formData.showName || '').trim().toLowerCase();
    if (!name) return null;
    const match = existingProjects.find(
      (p) => {
        const pName = (p.project_data?.showName || p.project_name || '').trim().toLowerCase();
        return pName === name && p.id !== formData.id;
      }
    );
    return match ? `A project named "${match.project_data?.showName || match.project_name}" already exists.` : null;
  }, [formData.showName, existingProjects, formData.id, formData.linkedProjectId]);

  // Check for duplicate show number (skip when linked to an existing project)
  const duplicateNumberWarning = useMemo(() => {
    if (formData.linkedProjectId) return null;
    const num = (formData.showNumber || '').trim().toLowerCase();
    if (!num) return null;
    const match = existingProjects.find((p) => {
      const pNum = (p.project_data?.showNumber || '').trim().toLowerCase();
      return pNum === num && p.id !== formData.id;
    });
    return match ? `Show number already used by "${match.project_name}".` : null;
  }, [formData.showNumber, existingProjects, formData.id, formData.linkedProjectId]);

  const handleLinkProject = (projectId) => {
    if (projectId === 'none') {
      setFormData((prev) => ({
        ...prev,
        linkedProjectId: null,
        showName: '',
        showNumber: '',
        associations: {},
        subAssociationSelections: {},
        primaryAffiliates: [],
        customAssociations: [],
        showDetails: { ...prev.showDetails, officials: {} },
        contractSettings: {
          ...prev.contractSettings,
          effectiveDate: '',
          expirationDate: '',
        },
      }));
      return;
    }
    const project = existingProjects.find((p) => p.id === projectId);
    if (project) {
      setFormData((prev) => applyLinkedProjectData(prev, project));
    }
  };

  return (
    <div className="space-y-4">
      {/* Link to Existing Show */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <Label className="font-semibold">Link to Existing Show (Optional)</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Link this contract to an existing show or pattern book project to auto-fill show details.
        </p>
        <Select
          value={formData.linkedProjectId || 'none'}
          onValueChange={handleLinkProject}
        >
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Select a project..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No linked project</SelectItem>
            {linkableProjects.map((p) => {
              const year = p.project_data?.startDate?.slice(0, 4);
              return (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_name || 'Untitled'}{year ? ` - ${year}` : ''} ({p.project_type})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {formData.linkedProjectId && (
          <Badge variant="secondary" className="text-xs">
            <Link2 className="h-3 w-3 mr-1" />
            Linked to project
          </Badge>
        )}
      </Card>

      {/* Validation Warnings */}
      {duplicateNameWarning && (
        <Card className="p-3 bg-red-500/10 border-red-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-600 font-medium">{duplicateNameWarning} Please use a different name.</p>
          </div>
        </Card>
      )}
      {duplicateNumberWarning && (
        <Card className="p-3 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-600">{duplicateNumberWarning}</p>
          </div>
        </Card>
      )}

      {/* Existing Association Selection */}
      <AssociationSelection
        formData={formData}
        setFormData={setFormData}
        associationsData={associationsData}
        context="contract"
      />
    </div>
  );
};
