import React from 'react';
import { Lock, Unlock } from 'lucide-react';

// Per-card lock for the travel dates. Only the date fields lock; costs and notes stay editable.
const DatesLockButton = ({ locked, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    title={locked ? 'Dates locked. Click to unlock.' : 'Click to lock these dates.'}
    aria-label={locked ? 'Unlock dates' : 'Lock dates'}
    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
      locked
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
        : 'text-muted-foreground hover:bg-muted'
    }`}
  >
    {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
    {locked ? 'Dates locked' : 'Lock dates'}
  </button>
);

export default DatesLockButton;
