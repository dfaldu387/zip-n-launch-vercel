import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabaseClient';

// Confirmation for deleting a discipline, division, division level or
// association — the shared building blocks every customer's show is made from.
//
// The old dialogs said "this cannot be undone" and nothing else. But a show
// stores these by id inside its own project_data, not as a database link, so
// deleting one does not fail: the show is just left pointing at something that
// no longer exists, and it surfaces later as a blank discipline in the builder
// or an untitled section in the book PDF. This asks the database what is
// actually using the record and shows it before the admin commits.
//
// It warns, it does not block. An admin who knows what they are doing can still
// clean up old data; they just do it with the facts in front of them.
export const DeleteReferenceDialog = ({
  isOpen,
  onClose,
  onConfirm,
  kind,          // 'discipline' | 'division' | 'division_level' | 'association'
  id,
  name,
  typeLabel,     // what to call it in the title, e.g. "discipline"
  extraWarning,  // optional line for deletes that also remove children
}) => {
  const [usage, setUsage] = useState(null);   // null = still counting
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isOpen || !id) {
      setUsage(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('reference_usage', {
        p_kind: kind,
        p_id: String(id),
        p_name: name || null,
      });
      if (cancelled) return;
      // A failed count must not imply "nothing is using it" — say so instead.
      if (error) {
        setFailed(true);
        setUsage([]);
      } else {
        setUsage(Array.isArray(data) ? data : []);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, id, kind, name]);

  if (!isOpen) return null;

  const inUse = (usage || []).length > 0;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {typeLabel} &ldquo;{name}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {usage === null && (
                <p className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking what uses this…
                </p>
              )}

              {usage !== null && failed && (
                <p>Could not check what uses this. Delete with care.</p>
              )}

              {usage !== null && !failed && inUse && (
                <div className="rounded-md border border-amber-400 bg-amber-500/10 p-3">
                  <p className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" /> Currently in use by:
                  </p>
                  <ul className="mt-2 ml-6 list-disc space-y-0.5">
                    {usage.map((u) => (
                      <li key={u.label}>
                        <span className="font-semibold text-foreground">{u.count}</span> {u.label}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    Deleting leaves these pointing at a record that no longer exists.
                  </p>
                </div>
              )}

              {usage !== null && !failed && !inUse && (
                <p>Nothing is using this — safe to remove.</p>
              )}

              {extraWarning && <p className="font-medium">{extraWarning}</p>}

              <p>This cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={usage === null}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {inUse ? 'Delete anyway' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteReferenceDialog;
