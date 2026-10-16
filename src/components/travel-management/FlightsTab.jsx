import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plane } from 'lucide-react';
import { currency } from '@/lib/contractUtils';
import DatesLockButton from './DatesLockButton';
import ReceiptsField from './ReceiptsField';
import ExpenseTypeSelect from './ExpenseTypeSelect';

const FlightsTab = ({ personnel, travelData, setTravelData, budgetFrozen, emptyMessage, storageKey, onExpenseTypeChange, expenseTypeLocked }) => {

  const updateFlight = (memberId, field, value) => {
    setTravelData((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        flight: {
          ...(prev[memberId]?.flight || {}),
          [field]: value,
        },
      },
    }));
  };

  return (
    <div className="space-y-4">
      {personnel.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {emptyMessage || 'No personnel found. Add staff in Contract Management first.'}
          </CardContent>
        </Card>
      ) : (
        personnel.map((member) => {
          const flight = travelData[member.id]?.flight || {};
          const hasFlight = flight.airline || flight.flightNumber;

          return (
            <Card key={member.id} className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Plane className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{member.name || 'Unnamed'}</CardTitle>
                      <p className="text-xs text-muted-foreground">{member.roleName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExpenseTypeSelect expense={member.reimbursable_expenses?.airfare} disabled={budgetFrozen || expenseTypeLocked} onChange={(v) => onExpenseTypeChange?.(member.id, 'airfare', v)} />
                    <DatesLockButton locked={!!flight.datesLocked} onToggle={() => updateFlight(member.id, 'datesLocked', !flight.datesLocked)} />
                    {hasFlight ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Booked</Badge>

                    ) : (
                    <Badge variant="secondary">Not Set</Badge>

                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Airline</Label>
                    <Input
                      placeholder="e.g. Delta"
                      value={flight.airline || ''}
                      onChange={(e) => updateFlight(member.id, 'airline', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Flight Number</Label>
                    <Input
                      placeholder="e.g. DL1234"
                      value={flight.flightNumber || ''}
                      onChange={(e) => updateFlight(member.id, 'flightNumber', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Departure Airport</Label>
                    <Input
                      placeholder="e.g. LAX"
                      value={flight.departureAirport || ''}
                      onChange={(e) => updateFlight(member.id, 'departureAirport', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Arrival Airport</Label>
                    <Input
                      placeholder="e.g. DFW"
                      value={flight.arrivalAirport || ''}
                      onChange={(e) => updateFlight(member.id, 'arrivalAirport', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Departure Date/Time</Label>
                    <Input
                      type="datetime-local"
                      value={flight.departureTime || ''}
                      onChange={(e) => updateFlight(member.id, 'departureTime', e.target.value)}
                      disabled={!!flight.datesLocked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Arrival Date/Time</Label>
                    <Input
                      type="datetime-local"
                      value={flight.arrivalTime || ''}
                      onChange={(e) => updateFlight(member.id, 'arrivalTime', e.target.value)}
                      disabled={!!flight.datesLocked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Budget ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={flight.cost || ''}
                      onChange={(e) => updateFlight(member.id, 'cost', e.target.value)}
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
                      value={flight.actualCost ?? ''}
                      onChange={(e) => updateFlight(member.id, 'actualCost', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Variance ($)</Label>
                    {(() => {
                      const hasActual = flight.actualCost !== undefined && flight.actualCost !== '' && flight.actualCost !== null;
                      const variance = hasActual ? (parseFloat(flight.actualCost) || 0) - (parseFloat(flight.cost) || 0) : null;
                      const tone = variance === null || variance === 0 ? '' : variance < 0 ? 'text-green-600' : 'text-red-600';
                      return (
                        <div className={`flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium ${tone}`}>
                          {variance === null ? '—' : `${variance < 0 ? '−' : ''}${Math.abs(variance).toFixed(2)} ${variance < 0 ? '↓' : variance > 0 ? '↑' : ''}`}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Confirmation #</Label>
                    <Input
                      placeholder="e.g. ABC123"
                      value={flight.confirmation || ''}
                      onChange={(e) => updateFlight(member.id, 'confirmation', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Return Departure Date/Time</Label>
                    <Input
                      type="datetime-local"
                      value={flight.returnDepartureTime || ''}
                      onChange={(e) => updateFlight(member.id, 'returnDepartureTime', e.target.value)}
                      disabled={!!flight.datesLocked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Return Arrival Date/Time</Label>
                    <Input
                      type="datetime-local"
                      value={flight.returnArrivalTime || ''}
                      onChange={(e) => updateFlight(member.id, 'returnArrivalTime', e.target.value)}
                      disabled={!!flight.datesLocked}
                    />
                  </div>
                  <ReceiptsField
                    storageKey={storageKey}
                    receipts={flight.receipts || []}
                    onChange={(next) => updateFlight(member.id, 'receipts', next)}
                    notes={flight.notes}
                    onNotesChange={(v) => updateFlight(member.id, 'notes', v)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default FlightsTab;
