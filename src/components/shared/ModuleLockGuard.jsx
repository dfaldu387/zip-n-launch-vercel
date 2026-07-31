import React from 'react';
import { Lock } from 'lucide-react';

/**
 * Wraps the editable area of a module page.
 *
 * When the module is locked, shows an explanatory bar and disables every
 * control inside with a single fieldset, so a locked module can never be
 * half-editable. Nothing is exempt: the unlock control for these pages lives
 * on the show workspace card (the status badge dropdown), not here.
 *
 * Props:
 *  - isLocked:   result of isWizardReadOnly(show?.project_data, moduleKey)
 *  - moduleName: display name used in the message, e.g. "Awards Management"
 */
export const ModuleLockGuard = ({ isLocked, moduleName = 'this section', children }) => {
  if (!isLocked) return <>{children}</>;

  return (
    <>
      <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <Lock className="h-4 w-4 flex-shrink-0" />
        <span>
          This section is locked. Set <strong>{moduleName}</strong> back to Draft on the show page to make changes.
        </span>
      </div>
      <fieldset disabled className="min-w-0 m-0 border-0 p-0 opacity-75">
        {children}
      </fieldset>
    </>
  );
};
