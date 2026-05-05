import { Lock } from 'lucide-react';

export const BudgetFrozenBanner = () => (
  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
    <Lock className="h-4 w-4 text-amber-600 shrink-0" />
    <p className="text-xs text-muted-foreground">
      <strong className="text-amber-600">Budget Locked</strong> — Compensation and expense values cannot be changed because one or more contracts have been sent.
    </p>
  </div>
);
