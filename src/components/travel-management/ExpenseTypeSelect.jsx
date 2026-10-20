import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Same Expense Type choice as Officials & Staff (Direct Show Expense / Reimbursement).
// It edits that shared value, so Staff, Contract, Budgeting and Travel always agree.
// When the expense switch is off for this person there is nothing to choose or save, so a small
// tag explains why instead of leaving the spot empty.
const ExpenseTypeSelect = ({ expense, onChange, disabled }) => {
  if (!expense?.reimbursed) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground"
        title="This item is switched off for this person in Officials & Staff. Switch it on there to choose who pays."
      >
        Not in contract <Info className="h-3 w-3" />
      </span>
    );
  }
  const value = expense.expense_type === 'direct' ? 'direct' : 'reimbursement';
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className="inline-flex items-center gap-1"
        title="Direct Show Expense: the show pays the vendor. Reimbursement: the staff member pays and is paid back."
      >
        Expense Type <Info className="h-3 w-3" />
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground',
          value === 'direct' && 'bg-blue-50 dark:bg-blue-950/30',
          disabled && 'bg-muted',
        )}
      >
        <option value="reimbursement">Reimbursement</option>
        <option value="direct">Direct Show Expense</option>
      </select>
    </label>
  );
};

export default ExpenseTypeSelect;
