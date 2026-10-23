import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import DatesLockButton from './DatesLockButton';
import ReceiptsField from './ReceiptsField';
import { mileageFigures } from '@/lib/travelActuals';
import ExpenseTypeSelect from './ExpenseTypeSelect';
import { useTravelList, TravelListToolbar, CardToggle, NoMatches, ClearCardButton, CopyFromStaffButton } from './useTravelList';

const MileageTab = ({ personnel, travelData, setTravelData, budgetFrozen, emptyMessage, storageKey, onExpenseTypeChange, expenseTypeLocked }) => {
  const list = useTravelList(personnel, (m) => {
    const mi = travelData[m.id]?.mileage || {};
    return mi.miles || mi.origin;
  });

  const updateMileage = (memberId, field, value) => {
    setTravelData((prev) => {
      const current = prev[memberId]?.mileage || {};
      const updated = { ...current, [field]: value };

      // Auto-calculate total = miles * rate_per_mile
      if (field === 'miles' || field === 'ratePerMile') {
        const miles = parseFloat(field === 'miles' ? value : updated.miles) || 0;
        const rate = parseFloat(field === 'ratePerMile' ? value : updated.ratePerMile) || 0;
        updated.cost = (miles * rate).toFixed(2);
      }

      return {
        ...prev,
        [memberId]: {
          ...prev[memberId],
          mileage: updated,
        },
      };
    });
  };

  // Several fields change together (e.g. a new actual rate clears an old typed total).
  const updateMileageFields = (memberId, patch) => {
    setTravelData((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        mileage: { ...(prev[memberId]?.mileage || {}), ...patch },
      },
    }));
  };

  return (
    <div className="space-y-4">
      <TravelListToolbar list={list} total={personnel.length} />
      {personnel.length > 0 && list.filtered.length === 0 && <NoMatches />}
      {personnel.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {emptyMessage || 'No personnel found. Add staff in Contract Management first.'}
          </CardContent>
        </Card>
      ) : (
        list.filtered.map((member) => {
          const open = list.isOpen(member.id);
          const mileage = travelData[member.id]?.mileage || {};
          const hasMileage = mileage.miles || mileage.origin;

          // Budget total (miles x budget rate) is kept in mileage.cost. Actual total = miles x
          // actual rate unless a total was typed. Same shared calculation the Overview uses.
          const { hasOverride, actual: actualTotal, variance } = mileageFigures(mileage);
          const tone = variance === null || variance === 0 ? '' : variance < 0 ? 'text-green-600' : 'text-red-600';

          return (
            <Card key={member.id} className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardToggle open={open} onToggle={() => list.toggle(member.id)} label={member.name || 'staff member'} />
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <MapPin className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{member.name || 'Unnamed'}</CardTitle>
                      <p className="text-xs text-muted-foreground">{member.roleName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExpenseTypeSelect expense={member.reimbursable_expenses?.mileage} disabled={budgetFrozen || expenseTypeLocked} onChange={(v) => onExpenseTypeChange?.(member.id, 'mileage', v)} />
                    <CopyFromStaffButton member={member} entry={travelData[member.id]} travelKey="mileage" expenseKey="mileage" setTravelData={setTravelData} budgetFrozen={budgetFrozen} />
                    <ClearCardButton entry={travelData[member.id]} memberId={member.id} travelKey="mileage" setTravelData={setTravelData} budgetFrozen={budgetFrozen} />
                    <DatesLockButton locked={!!mileage.datesLocked} onToggle={() => updateMileage(member.id, 'datesLocked', !mileage.datesLocked)} />
                    {hasMileage ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Logged</Badge>

                    ) : (
                    <Badge variant="secondary">Booking needed</Badge>

                    )}
                  </div>
                </div>
              </CardHeader>
              {open && <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Origin</Label>
                    <Input
                      placeholder="e.g. Dallas, TX"
                      value={mileage.origin || ''}
                      onChange={(e) => updateMileage(member.id, 'origin', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Destination</Label>
                    <Input
                      placeholder="e.g. Fort Worth, TX"
                      value={mileage.destination || ''}
                      onChange={(e) => updateMileage(member.id, 'destination', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Date</Label>
                    <Input
                      type="date"
                      value={mileage.startDate || ''}
                      onChange={(e) => updateMileage(member.id, 'startDate', e.target.value)}
                      disabled={!!mileage.datesLocked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Date</Label>
                    <Input
                      type="date"
                      value={mileage.endDate || ''}
                      onChange={(e) => updateMileage(member.id, 'endDate', e.target.value)}
                      disabled={!!mileage.datesLocked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Miles</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="e.g. 200"
                      value={mileage.miles || ''}
                      onChange={(e) => updateMileage(member.id, 'miles', e.target.value)}
                      disabled={budgetFrozen}
                      className={budgetFrozen ? 'bg-muted' : ''}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rate per Mile (Budget $)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 0.67"
                      value={mileage.ratePerMile || ''}
                      onChange={(e) => updateMileage(member.id, 'ratePerMile', e.target.value)}
                      disabled={budgetFrozen}
                      className={budgetFrozen ? 'bg-muted' : ''}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rate per Mile (Actual $)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 0.70"
                      value={mileage.actualRate ?? ''}
                      onChange={(e) => updateMileageFields(member.id, { actualRate: e.target.value, actualCost: '' })}
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 md:col-span-4">
                    <Label className="text-xs">Purpose / Notes</Label>
                    <Input
                      placeholder="e.g. Airport to Show Site"
                      value={mileage.purpose || ''}
                      onChange={(e) => updateMileage(member.id, 'purpose', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Budget Total ($)</Label>
                    <Input
                      type="number"
                      value={mileage.cost || '0.00'}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Actual Expense ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={hasOverride ? mileage.actualCost : actualTotal === null ? '' : actualTotal.toFixed(2)}
                      onChange={(e) => updateMileage(member.id, 'actualCost', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Variance ($)</Label>
                    <div className={`flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium ${tone}`}>
                      {variance === null ? '—' : `${variance < 0 ? '−' : ''}${Math.abs(variance).toFixed(2)} ${variance < 0 ? '↓' : variance > 0 ? '↑' : ''}`}
                    </div>
                  </div>
                  <ReceiptsField
                    storageKey={storageKey}
                    receipts={mileage.receipts || []}
                    onChange={(next) => updateMileage(member.id, 'receipts', next)}
                  />
                </div>
              </CardContent>}
            </Card>
          );
        })
      )}
    </div>
  );
};

export default MileageTab;
