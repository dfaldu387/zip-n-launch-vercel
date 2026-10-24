import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * A Card whose body opens and closes from the title bar.
 * `summary` stays visible on the right while closed (e.g. a total).
 * `action` sits beside the title bar (e.g. a lock button) and does not toggle the card.
 */
export const CollapsibleCard = ({ title, description, icon, summary, action, defaultOpen = true, className, contentClassName = 'space-y-4', children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="flex flex-1 items-start justify-between gap-2 text-left"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <div>
              <CardTitle className="text-base flex items-center gap-2">{icon} {title}</CardTitle>
              {description && <CardDescription className="text-xs mt-1.5">{description}</CardDescription>}
            </div>
            <span className="flex items-center gap-3">
              {summary && <span className="text-sm text-muted-foreground">{summary}</span>}
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </span>
          </button>
          {action}
        </div>
      </CardHeader>
      {open && <CardContent className={contentClassName}>{children}</CardContent>}
    </Card>
  );
};

export default CollapsibleCard;
