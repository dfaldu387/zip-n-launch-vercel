import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Car } from 'lucide-react';
import DatesLockButton from './DatesLockButton';
import ReceiptsField from './ReceiptsField';
import { rentalFigures } from '@/lib/travelActuals';
import ExpenseTypeSelect from './ExpenseTypeSelect';
import { useTravelList, TravelListToolbar, CardToggle, NoMatches, ClearCardButton, CopyFromStaffButton } from './useTravelList';

const RentalCarsTab = ({ personnel, travelData, setTravelData, budgetFrozen, emptyMessage, storageKey, onExpenseTypeChange, expenseTypeLocked }) => {
  const list = useTravelList(personnel, (m) => {
    const r = travelData[m.id]?.rentalCar || {};
    return r.company || r.confirmation;
  });

  const updateRentalCar = (memberId, field, value) => {
    setTravelData((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        rentalCar: {
          ...(prev[memberId]?.rentalCar || {}),
          [field]: value,
        },
      },
    }));
  };

  // Several fields change together (e.g. a new actual rate clears an old typed total).
  const updateRentalCarFields = (memberId, patch) => {
    setTravelData((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        rentalCar: { ...(prev[memberId]?.rentalCar || {}), ...patch },
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
          const rental = travelData[member.id]?.rentalCar || {};
          const hasRental = rental.company || rental.confirmation;

          // Days, budget rate, actual total (rate x days unless a total was typed) and variance
          // come from one shared calculation, the same one the Overview uses.
          const { days, budgetRate, hasOverride, actual: actualTotal, variance } = rentalFigures(rental);
          const tone = variance === null || variance === 0 ? '' : variance < 0 ? 'text-green-600' : 'text-red-600';

          return (
            <Card key={member.id} className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardToggle open={open} onToggle={() => list.toggle(member.id)} label={member.name || 'staff member'} />
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Car className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{member.name || 'Unnamed'}</CardTitle>
                      <p className="text-xs text-muted-foreground">{member.roleName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExpenseTypeSelect expense={member.reimbursable_expenses?.rentalCar} disabled={budgetFrozen || expenseTypeLocked} onChange={(v) => onExpenseTypeChange?.(member.id, 'rentalCar', v)} />
                    <CopyFromStaffButton member={member} entry={travelData[member.id]} travelKey="rentalCar" expenseKey="rentalCar" setTravelData={setTravelData} budgetFrozen={budgetFrozen} />
                    <ClearCardButton entry={travelData[member.id]} memberId={member.id} travelKey="rentalCar" setTravelData={setTravelData} budgetFrozen={budgetFrozen} />
                    <DatesLockButton locked={!!rental.datesLocked} onToggle={() => updateRentalCar(member.id, 'datesLocked', !rental.datesLocked)} />
                    {hasRental ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Booked</Badge>

                    ) : (
                    <Badge variant="secondary">Not Set</Badge>

                    )}
                  </div>
                </div>
              </CardHeader>
              {open && <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rental Company</Label>
                    <Input
                      placeholder="e.g. Enterprise"
                      value={rental.company || ''}
                      onChange={(e) => updateRentalCar(member.id, 'company', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pickup Date/Time</Label>
                    <Input
                      type="datetime-local"
                      value={rental.pickupTime || ''}
                      onChange={(e) => updateRentalCar(member.id, 'pickupTime', e.target.value)}
                      disabled={!!rental.datesLocked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Return Date/Time</Label>
                    <Input
                      type="datetime-local"
                      value={rental.returnTime || ''}
                      onChange={(e) => updateRentalCar(member.id, 'returnTime', e.target.value)}
                      disabled={!!rental.datesLocked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pickup Location</Label>
                    <Input
                      placeholder="e.g. Denver International Airport"
                      value={rental.pickupLocation || ''}
                      onChange={(e) => updateRentalCar(member.id, 'pickupLocation', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Vehicle Type</Label>
                    <Input
                      placeholder="e.g. Intermediate SUV"
                      value={rental.vehicleType || ''}
                      onChange={(e) => updateRentalCar(member.id, 'vehicleType', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Days</Label>
                    <Input value={days > 0 ? days : ''} placeholder="—" readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rate/Day (Budget $)</Label>
                    <Input value={budgetRate === null ? '' : budgetRate.toFixed(2)} placeholder="—" readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rate/Day (Actual $)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={rental.actualRate ?? ''}
                      onChange={(e) => updateRentalCarFields(member.id, { actualRate: e.target.value, actualCost: '' })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Budget Total ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={rental.cost || ''}
                      onChange={(e) => updateRentalCar(member.id, 'cost', e.target.value)}
                      disabled={budgetFrozen}
                      className={budgetFrozen ? 'bg-muted' : ''}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Actual Expense ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={hasOverride ? rental.actualCost : actualTotal === null ? '' : actualTotal.toFixed(2)}
                      onChange={(e) => updateRentalCar(member.id, 'actualCost', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Variance ($)</Label>
                    <div className={`flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium ${tone}`}>
                      {variance === null ? '—' : `${variance < 0 ? '−' : ''}${Math.abs(variance).toFixed(2)} ${variance < 0 ? '↓' : variance > 0 ? '↑' : ''}`}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Confirmation #</Label>
                    <Input
                      placeholder="e.g. R5678901"
                      value={rental.confirmation || ''}
                      onChange={(e) => updateRentalCar(member.id, 'confirmation', e.target.value)}
                    />
                  </div>
                  <ReceiptsField
                    storageKey={storageKey}
                    receipts={rental.receipts || []}
                    onChange={(next) => updateRentalCar(member.id, 'receipts', next)}
                    notes={rental.notes}
                    onNotesChange={(v) => updateRentalCar(member.id, 'notes', v)}
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

export default RentalCarsTab;
