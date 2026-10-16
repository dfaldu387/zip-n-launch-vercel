import React, { useMemo, useRef, useState } from 'react';
import { ClipboardCheck, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { summarizeCloseout } from '@/lib/employeeCloseout';

const money = (v) =>
  v === null || v === undefined
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

// Over budget is red, under budget is green.
const Difference = ({ value, pill = false }) => {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (Math.abs(value) < 0.005) return <span className="text-muted-foreground">On budget</span>;
  const over = value > 0;
  const text = `${over ? '+' : '−'}${money(Math.abs(value))} ${over ? '↑' : '↓'}`;
  return (
    <span className={cn(pill && 'inline-block rounded-full px-2 py-0.5 text-xs font-semibold', over ? 'text-red-600' : 'text-green-600', pill && (over ? 'bg-red-500/10' : 'bg-green-500/10'))}>
      {text}
    </span>
  );
};

const Tile = ({ label, children, hint }) => (
  <div className="rounded-xl border p-4">
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    <div className="mt-1 text-2xl font-bold">{children}</div>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

/**
 * Employee Closeout: for each person, the Budget row on top and the Actual row below.
 * Travel actuals come from Travel Management; Day Pay, Overtime and Other are typed here and
 * saved on the show (project_data.closeout). The budget is never changed by this section.
 */
export const EmployeeCloseout = ({ show, personnel, readOnly }) => {
  const { toast } = useToast();
  const [typed, setTyped] = useState(() => show.project_data?.closeout || {});
  const typedRef = useRef(typed);
  const [status, setStatus] = useState('idle'); // idle | saving | saved
  const travelData = show.project_data?.travelData || {};

  const { perPerson, total } = useMemo(
    () => summarizeCloseout(personnel, travelData, typed),
    [personnel, travelData, typed]
  );

  const setField = (memberId, field, value) => {
    const next = { ...typedRef.current, [memberId]: { ...(typedRef.current[memberId] || {}), [field]: value } };
    typedRef.current = next;
    setTyped(next);
    setStatus('idle');
  };

  // Saved when a box loses focus, building on the newest copy of the show so nothing saved
  // elsewhere in the meantime (staff, travel) is written back to an old value.
  const save = async () => {
    setStatus('saving');
    try {
      const { data: row, error: readError } = await supabase.from('projects').select('project_data').eq('id', show.id).maybeSingle();
      if (readError) throw readError;
      const latest = row?.project_data || show.project_data || {};
      if (latest.isShowLocked === true) {
        setStatus('idle');
        toast({ title: 'Show Locked', description: 'Unlock the show to save closeout numbers.', variant: 'destructive' });
        return;
      }
      const { error } = await supabase.from('projects').update({ project_data: { ...latest, closeout: typedRef.current } }).eq('id', show.id);
      if (error) throw error;
      setStatus('saved');
    } catch (error) {
      setStatus('idle');
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    }
  };

  if (personnel.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-600" /> Employee Closeout
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'All changes saved' : ''}
          </span>
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Use this when the show is over. The budget stays as planned. Flight, Hotel, Rental Car and Mileage actuals come from
            Travel Management. Type the real Day Pay, Overtime and Other below.
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tile label="Budget">{money(total.budget)}</Tile>
          <Tile label="Actual so far" hint={total.actual === null ? 'Nothing entered yet' : undefined}>{money(total.actual)}</Tile>
          <Tile label="Difference" hint="Actual minus budget, for lines with an actual">
            <Difference value={total.variance} />
          </Tile>
          <Tile label="Actuals entered" hint={total.total > 0 ? `${total.counted} of ${total.total} lines` : undefined}>
            {total.total > 0 ? `${Math.round((total.counted / total.total) * 100)}%` : '—'}
          </Tile>
        </div>

        {perPerson.map(({ member, cells, total: personTotal }) => (
          <div key={member.id} className="rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
              <div>
                <p className="font-semibold">{member.name || 'Unnamed'}</p>
                <p className="text-xs text-muted-foreground">{member.roleName}</p>
              </div>
              <div className="text-right text-sm">
                <span className="text-muted-foreground">Difference </span>
                <Difference value={personTotal.variance} pill />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium w-28" />
                    {cells.map((c) => (
                      <th key={c.key} className="px-3 py-2 text-right font-medium whitespace-nowrap">{c.label}</th>
                    ))}
                    <th className="px-4 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-medium">Budget</td>
                    {cells.map((c) => (
                      <td key={c.key} className="px-3 py-2 text-right">{money(c.budget)}</td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold">{money(personTotal.budget)}</td>
                  </tr>
                  <tr className="border-b bg-emerald-500/5">
                    <td className="px-4 py-2 font-medium">Actual</td>
                    {cells.map((c) => (
                      <td key={c.key} className="px-3 py-2 text-right">
                        {c.typedField ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            aria-label={`${member.name || 'Staff'} actual ${c.label}`}
                            className="h-8 w-28 ml-auto text-right"
                            disabled={readOnly}
                            value={typed[member.id]?.[c.typedField] ?? ''}
                            onChange={(e) => setField(member.id, c.typedField, e.target.value)}
                            onBlur={save}
                          />
                        ) : (
                          money(c.actual)
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold">{money(personTotal.actual)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">Difference</td>
                    {cells.map((c) => (
                      <td key={c.key} className="px-3 py-2 text-right">
                        <Difference value={c.actual === null ? null : c.actual - c.budget} />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold"><Difference value={personTotal.variance} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default EmployeeCloseout;
