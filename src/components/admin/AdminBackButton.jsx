import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEFAULT_FALLBACK = '/admin';

/**
 * Consistent back button for all admin routes.
 * - Prefers browser history back when available (react-router sets history.state.idx)
 * - Falls back to a specific route (default: /admin)
 */
export default function AdminBackButton({
  to = DEFAULT_FALLBACK,
  label = 'Back',
  className,
  variant = 'outline',
  size = 'default',
  preferHistory = true,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (preferHistory) {
      const idx = window?.history?.state?.idx;
      if (typeof idx === 'number' && idx > 0) {
        navigate(-1);
        return;
      }
    }

    // Avoid navigating to the same page; use default fallback instead.
    if (location?.pathname === to) {
      navigate(DEFAULT_FALLBACK);
      return;
    }

    navigate(to);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleBack}
      className={cn(className)}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}


