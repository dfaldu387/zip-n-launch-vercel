import React from 'react';
import { cn } from '@/lib/utils';
import { formatCell, statusTone } from '@/lib/employeeReports';

// How a status pill is coloured. The same palette the Travel pages use, with dark-mode variants.
const PILL = {
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400',
  neutral: 'border-border bg-muted text-muted-foreground',
};

const TILE_VALUE = { good: 'text-emerald-600 dark:text-emerald-400', bad: 'text-red-600 dark:text-red-400' };

export const SummaryTiles = ({ tiles }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {tiles.map((t, i) => (
      <div key={t.label} className={cn('rounded-xl border p-4', i === 0 ? 'bg-primary/5 border-primary/20' : 'bg-card')}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</p>
        <p className={cn('mt-1 text-2xl font-semibold tabular-nums', TILE_VALUE[t.tone])}>{t.value}</p>
      </div>
    ))}
  </div>
);

const isNumeric = (c) => c.type === 'money' || c.type === 'count';

// Under budget reads green, over budget red, on the columns that say so.
const varianceClass = (col, value) => {
  if (col.tone !== 'variance' || typeof value !== 'number' || value === 0) return '';
  return value > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
};

const Cell = ({ col, value }) => {
  const text = formatCell(value, col.type);
  if (col.type === 'status' && value) {
    return (
      <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', PILL[statusTone(value)])}>
        {text}
      </span>
    );
  }
  return text;
};

export const ReportTable = ({ report, result }) => (
  <div className="overflow-auto rounded-xl border max-h-[34rem] print:max-h-none print:overflow-visible">
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur print:static">
        <tr>
          {report.columns.map((c) => (
            <th
              key={c.key}
              className={cn(
                'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap',
                isNumeric(c) ? 'text-right' : 'text-left'
              )}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {result.rows.map((row, i) => (
          <tr key={i} className="hover:bg-muted/40 even:bg-muted/20">
            {report.columns.map((c) => (
              <td
                key={c.key}
                className={cn(
                  // One line per row; a wide report scrolls sideways inside its box instead of growing tall.
                  'px-3 py-2.5 align-middle whitespace-nowrap',
                  isNumeric(c) && 'text-right tabular-nums',
                  c.key === 'name' && 'font-medium',
                  c.key === 'role' && 'text-muted-foreground',
                  varianceClass(c, row[c.key])
                )}
              >
                <Cell col={c} value={row[c.key]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {result.totals && (
        <tfoot className="bg-muted/50">
          <tr className="border-t-2 font-semibold">
            {report.columns.map((c, idx) => (
              <td key={c.key} className={cn('px-3 py-2.5', isNumeric(c) && 'text-right tabular-nums', varianceClass(c, result.totals[c.key]))}>
                {idx === 0 ? 'Total' : c.sum ? formatCell(result.totals[c.key], c.type) : ''}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);
