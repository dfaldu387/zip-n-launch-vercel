import React from 'react';
import {
  Circle, Loader2, FileEdit, Lock, Check, ChevronDown, AlertTriangle,
} from 'lucide-react';
import {
  MODULE_STATUS,
  STATUS_META,
  getAvailableTransitions,
  validateTransitionWithShowLock,
} from '@/lib/moduleStatusService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ICON_MAP = {
  Circle,
  Loader2,
  FileEdit,
  Lock,
  Check,
};

const ALL_STATUSES = [
  MODULE_STATUS.NOT_STARTED,
  MODULE_STATUS.IN_PROGRESS,
  MODULE_STATUS.DRAFT,
  MODULE_STATUS.LOCKED,
  MODULE_STATUS.PUBLISHED,
];

/**
 * Renders a clickable status badge with a dropdown for status transitions.
 *
 * @param {Object} props
 * @param {string}   props.status        - Current module status
 * @param {string}   props.moduleKey     - Module identifier
 * @param {boolean}  props.isShowLocked  - Whether the show is globally locked
 * @param {Function} props.onStatusChange - (moduleKey, newStatus) => void
 * @param {boolean}  props.compact       - Smaller variant for tight spaces
 */
export const ModuleStatusBadge = ({
  status = MODULE_STATUS.NOT_STARTED,
  moduleKey,
  isShowLocked = false,
  onStatusChange,
  compact = false,
}) => {
  const meta = STATUS_META[status] || STATUS_META[MODULE_STATUS.NOT_STARTED];
  const IconComp = ICON_MAP[meta.icon] || Circle;
  const availableTransitions = getAvailableTransitions(status, isShowLocked);

  const badge = (
    <button
      className={cn(
        'flex items-center gap-1 font-medium rounded-md transition-colors',
        compact ? 'text-[10px] px-1 py-0.5' : 'text-[11px] px-1.5 py-0.5',
        meta.color,
        isShowLocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted cursor-pointer',
      )}
      onClick={(e) => e.preventDefault()}
    >
      <IconComp className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {meta.label}
      {!isShowLocked && availableTransitions.length > 0 && (
        <ChevronDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );

  // If show is locked, show tooltip instead of dropdown
  if (isShowLocked) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Unlock show to make changes
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // No transitions available (e.g. PUBLISHED)
  if (availableTransitions.length === 0) {
    return badge;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{badge}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {/* Current status header */}
        <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Current: {meta.label}
        </div>
        <DropdownMenuSeparator />

        {ALL_STATUSES.map((targetStatus) => {
          const targetMeta = STATUS_META[targetStatus];
          const TargetIcon = ICON_MAP[targetMeta.icon] || Circle;
          const isAvailable = availableTransitions.includes(targetStatus);
          const isCurrent = targetStatus === status;
          const result = validateTransitionWithShowLock(status, targetStatus, isShowLocked);

          return (
            <DropdownMenuItem
              key={targetStatus}
              disabled={!isAvailable || isCurrent}
              className={cn(
                'flex items-center gap-2 text-xs',
                targetMeta.color,
                isCurrent && 'bg-muted',
                !isAvailable && !isCurrent && 'opacity-40 cursor-not-allowed',
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isAvailable && !isCurrent && onStatusChange) {
                  onStatusChange(moduleKey, targetStatus);
                }
              }}
            >
              <TargetIcon className="h-3.5 w-3.5" />
              {targetMeta.label}
              {isCurrent && <Check className="h-3 w-3 ml-auto" />}
              {!isAvailable && !isCurrent && result.error && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle className="h-3 w-3 ml-auto text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[200px] text-xs">
                      {result.error}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * Inline status controls — action buttons for the most common transitions.
 * Shown inside module pages (not workspace cards).
 *
 * @param {Object} props
 * @param {string}   props.status
 * @param {string}   props.moduleKey
 * @param {boolean}  props.isShowLocked
 * @param {Function} props.onStatusChange
 */
export const ModuleStatusControls = ({
  status = MODULE_STATUS.NOT_STARTED,
  moduleKey,
  isShowLocked = false,
  onStatusChange,
}) => {
  const available = getAvailableTransitions(status, isShowLocked);

  if (available.length === 0 && !isShowLocked) return null;

  const actionConfigs = {
    [MODULE_STATUS.IN_PROGRESS]: { label: 'Start Working', variant: 'outline', icon: Loader2 },
    [MODULE_STATUS.DRAFT]:       { label: 'Save as Draft', variant: 'outline', icon: FileEdit },
    [MODULE_STATUS.LOCKED]:      { label: 'Lock Module', variant: 'default', icon: Lock },
    [MODULE_STATUS.PUBLISHED]:   { label: 'Publish', variant: 'default', icon: Check },
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {available.map((targetStatus) => {
        const config = actionConfigs[targetStatus];
        if (!config) return null;
        const ActionIcon = config.icon;

        return (
          <Button
            key={targetStatus}
            variant={config.variant}
            size="sm"
            disabled={isShowLocked}
            onClick={() => onStatusChange?.(moduleKey, targetStatus)}
          >
            <ActionIcon className="h-4 w-4 mr-1.5" />
            {config.label}
          </Button>
        );
      })}

      {/* Unlock hint if show is locked */}
      {isShowLocked && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" /> Show is locked
              </span>
            </TooltipTrigger>
            <TooltipContent>Unlock show to make changes</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};
