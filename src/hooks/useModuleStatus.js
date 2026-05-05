import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
  MODULE_STATUS,
  STATUS_META,
  validateTransitionWithShowLock,
  getAvailableTransitions,
  isModuleEditable,
  canGeneratePdf,
  autoAdvanceOnInteraction,
  migrateLegacyStatus,
  migrateAllModuleStatuses,
} from '@/lib/moduleStatusService';

/**
 * Hook for managing module statuses on a show.
 *
 * @param {Object} options
 * @param {Object}  options.projectData    - The show's project_data object
 * @param {string}  options.showId         - The show's project ID
 * @param {Function} options.onProjectDataChange - Callback to update local project_data state
 * @returns {Object}
 */
export function useModuleStatus({ projectData, showId, onProjectDataChange }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // ── Derived state ──

  const isShowLocked = projectData?.isShowLocked === true;

  const moduleStatuses = useMemo(() => {
    return migrateAllModuleStatuses(projectData?.moduleStatuses || {});
  }, [projectData?.moduleStatuses]);

  // ── Core: persist status change ──

  const persistStatusChange = useCallback(async (updatedModuleStatuses, updatedProjectData) => {
    if (!showId) return false;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ project_data: updatedProjectData })
        .eq('id', showId);

      if (error) {
        toast({ title: 'Error saving status', description: error.message, variant: 'destructive' });
        return false;
      }
      return true;
    } catch (err) {
      toast({ title: 'Error saving status', description: err.message, variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [showId, toast]);

  // ── Change a module's status ──

  const changeModuleStatus = useCallback(async (moduleKey, newStatus) => {
    const currentStatus = migrateLegacyStatus(moduleStatuses[moduleKey] || MODULE_STATUS.NOT_STARTED);

    // Validate transition
    const result = validateTransitionWithShowLock(currentStatus, newStatus, isShowLocked);
    if (!result.allowed) {
      toast({ title: 'Status Change Blocked', description: result.error, variant: 'destructive' });
      return false;
    }

    // Build updated data
    const updatedModuleStatuses = { ...moduleStatuses, [moduleKey]: newStatus };
    const updatedProjectData = {
      ...projectData,
      moduleStatuses: updatedModuleStatuses,
    };

    // Optimistic update
    onProjectDataChange(updatedProjectData);

    // Persist
    const success = await persistStatusChange(updatedModuleStatuses, updatedProjectData);
    if (!success) {
      // Revert on failure
      onProjectDataChange(projectData);
    } else {
      const meta = STATUS_META[newStatus];
      toast({ title: `Module ${meta?.label || newStatus}`, description: `Status changed to "${meta?.label || newStatus}".` });
    }
    return success;
  }, [moduleStatuses, isShowLocked, projectData, onProjectDataChange, persistStatusChange, toast]);

  // ── Auto-advance on interaction (NOT_STARTED → IN_PROGRESS) ──

  const markModuleStarted = useCallback(async (moduleKey) => {
    const currentStatus = migrateLegacyStatus(moduleStatuses[moduleKey] || MODULE_STATUS.NOT_STARTED);
    const advanced = autoAdvanceOnInteraction(currentStatus);
    if (!advanced) return; // Already past NOT_STARTED

    const updatedModuleStatuses = { ...moduleStatuses, [moduleKey]: advanced };
    const updatedProjectData = { ...projectData, moduleStatuses: updatedModuleStatuses };

    onProjectDataChange(updatedProjectData);
    await persistStatusChange(updatedModuleStatuses, updatedProjectData);
  }, [moduleStatuses, projectData, onProjectDataChange, persistStatusChange]);

  // ── Show-level lock/unlock ──

  const lockShow = useCallback(async () => {
    const updatedProjectData = { ...projectData, isShowLocked: true };
    onProjectDataChange(updatedProjectData);

    const success = await persistStatusChange(moduleStatuses, updatedProjectData);
    if (success) {
      toast({ title: 'Show Locked', description: 'All modules are now read-only. Unlock the show to make changes.' });
    } else {
      onProjectDataChange(projectData);
    }
    return success;
  }, [projectData, moduleStatuses, onProjectDataChange, persistStatusChange, toast]);

  const unlockShow = useCallback(async () => {
    const updatedProjectData = { ...projectData, isShowLocked: false };
    onProjectDataChange(updatedProjectData);

    const success = await persistStatusChange(moduleStatuses, updatedProjectData);
    if (success) {
      toast({ title: 'Show Unlocked', description: 'Modules can now be edited.' });
    } else {
      onProjectDataChange(projectData);
    }
    return success;
  }, [projectData, moduleStatuses, onProjectDataChange, persistStatusChange, toast]);

  // ── Query helpers ──

  const getModuleStatus = useCallback((moduleKey) => {
    return migrateLegacyStatus(moduleStatuses[moduleKey] || MODULE_STATUS.NOT_STARTED);
  }, [moduleStatuses]);

  const getModuleEditable = useCallback((moduleKey) => {
    const status = migrateLegacyStatus(moduleStatuses[moduleKey] || MODULE_STATUS.NOT_STARTED);
    return isModuleEditable(status, isShowLocked);
  }, [moduleStatuses, isShowLocked]);

  const getModulePdfAllowed = useCallback((moduleKey) => {
    const status = migrateLegacyStatus(moduleStatuses[moduleKey] || MODULE_STATUS.NOT_STARTED);
    return canGeneratePdf(status);
  }, [moduleStatuses]);

  const getAvailableActions = useCallback((moduleKey) => {
    const status = migrateLegacyStatus(moduleStatuses[moduleKey] || MODULE_STATUS.NOT_STARTED);
    return getAvailableTransitions(status, isShowLocked);
  }, [moduleStatuses, isShowLocked]);

  return {
    // State
    moduleStatuses,
    isShowLocked,
    isSaving,

    // Actions
    changeModuleStatus,
    markModuleStarted,
    lockShow,
    unlockShow,

    // Queries
    getModuleStatus,
    getModuleEditable,
    getModulePdfAllowed,
    getAvailableActions,
  };
}
