import React from 'react';
import { Hourglass } from 'lucide-react';

// Shown for a class whose score sheet type has no screen yet.
// Each type below gets replaced by its real screen as it is built.
const ScoringTypeComingSoon = ({ typeLabel, help }) => (
  <div className="rounded-lg border border-dashed p-8 text-center">
    <Hourglass className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
    <h2 className="text-lg font-semibold">{typeLabel}</h2>
    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{help}</p>
    <p className="mt-4 text-sm font-medium">This screen is being built. Please check back soon.</p>
  </div>
);

export default ScoringTypeComingSoon;
