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
    <div className="flex items-center mb-8 relative min-h-[40px]">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(backTo)}
        className="shrink-0 z-10"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
      </Button>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
