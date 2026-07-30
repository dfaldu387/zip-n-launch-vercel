import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Standardized page header for Horse Show Manager pages.
 *
 * Layout: [ ← Back to Manager ]        Page Title (centered)
 *
 * @param {string} title - The page title
 * @param {string} [backTo="/horse-show-manager"] - Navigation target for back button
 * @param {string} [backLabel="Back to Manager"] - Label for the back button
 */
export function PageHeader({ title, subtitle, backTo = '/horse-show-manager', backLabel = 'Back to Manager' }) {
  const navigate = useNavigate();

  return (
    // The title used to be absolutely centred over the whole row, so on a phone
    // it printed straight across the Back button. It only overlays from md up,
    // where there is room for it; below that the two stack.
    <div className="mb-8 flex flex-col gap-3 md:relative md:min-h-[40px] md:flex-row md:items-center md:gap-0">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(backTo)}
        className="w-fit shrink-0 z-10"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
      </Button>
      <div className="flex flex-col md:pointer-events-none md:absolute md:inset-0 md:items-center md:justify-center">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
