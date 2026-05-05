import React from 'react';
import { Lock, ShieldAlert, Unlock } from 'lucide-react';
import { isModuleEditable, MODULE_STATUS, STATUS_META } from '@/lib/moduleStatusService';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Wraps module content and overlays a read-only barrier when the module
 * or show is locked. Children are rendered but pointer-events are disabled.
 *
 * @param {Object} props
 * @param {string}   props.moduleStatus  - Current module status
 * @param {boolean}  props.isShowLocked  - Whether the show is globally locked
 * @param {Function} props.onRequestUnlock - Called when user clicks "Unlock" (optional)
 * @param {string}   props.moduleKey     - Module identifier (for unlock action)
 * @param {Function} props.onStatusChange - Status change handler (for unlock action)
 * @param {React.ReactNode} props.children
 * @param {string}   props.className
 */
export const ModuleStatusGuard = ({
  moduleStatus = MODULE_STATUS.NOT_STARTED,
  isShowLocked = false,
  onRequestUnlock,
  moduleKey,
  onStatusChange,
  children,
  className,
}) => {
  const { editable, reason } = isModuleEditable(moduleStatus, isShowLocked);

  if (editable) {
    return <div className={className}>{children}</div>;
  }

  const isShowLevel = isShowLocked;
  const meta = STATUS_META[moduleStatus] || STATUS_META[MODULE_STATUS.NOT_STARTED];

  const handleUnlock = () => {
    if (isShowLevel && onRequestUnlock) {
      onRequestUnlock();
    } else if (!isShowLevel && onStatusChange && moduleKey) {
      // Unlock module: LOCKED → DRAFT
      onStatusChange(moduleKey, MODULE_STATUS.DRAFT);
    }
  };

  const canUnlock = isShowLevel ? !!onRequestUnlock : (moduleStatus === MODULE_STATUS.LOCKED && !!onStatusChange);

  return (
    <div className={cn('relative', className)}>
      {/* Content rendered but non-interactive */}
      <div className="pointer-events-none select-none opacity-60" aria-hidden="true">
        {children}
      </div>

      {/* Overlay banner */}
      <div className="absolute inset-0 flex items-start justify-center pt-8 z-30">
        <div className={cn(
          'flex items-center gap-3 px-5 py-3 rounded-lg border shadow-lg backdrop-blur-sm',
          'bg-background/95',
          isShowLevel ? 'border-red-300' : meta.borderColor,
        )}>
          {isShowLevel ? (
            <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
          ) : (
            <Lock className="h-5 w-5 text-amber-500 shrink-0" />
          )}
          <div className="text-sm">
            <p className="font-semibold text-foreground">
              {isShowLevel ? 'Show Locked' : `Module ${meta.label}`}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">{reason}</p>
          </div>
          {canUnlock && (
            <Button variant="outline" size="sm" onClick={handleUnlock} className="ml-2 shrink-0">
              <Unlock className="h-3.5 w-3.5 mr-1.5" />
              Unlock
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
