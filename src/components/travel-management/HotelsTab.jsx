import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Hotel } from 'lucide-react';
import DatesLockButton from './DatesLockButton';
import ReceiptsField from './ReceiptsField';
import { hotelFigures } from '@/lib/travelActuals';
import ExpenseTypeSelect from './ExpenseTypeSelect';
import { useTravelList, TravelListToolbar, CardToggle, NoMatches, ClearCardButton } from './useTravelList';

const HotelsTab = ({ personnel, travelData, setTravelData, budgetFrozen, emptyMessage, storageKey, onExpenseTypeChange, expenseTypeLocked }) => {
  const list = useTravelList(personnel, (m) => {
    const h = travelData[m.id]?.hotel || {};
    return h.hotelName || h.confirmation;
  });

  const updateHotel = (memberId, field, value) => {
    setTravelData((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        hotel: {
          ...(prev[memberId]?.hotel || {}),
          [field]: value,
        },
      },
    }));
  };

  // Several fields change together (e.g. a new actual rate clears an old typed total).
  const updateHotelFields = (memberId, patch) => {
    setTravelData((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        hotel: { ...(prev[memberId]?.hotel || {}), ...patch },
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
          const hotel = travelData[member.id]?.hotel || {};
          const hasHotel = hotel.hotelName || hotel.confirmation;

          // Nights, budget rate, actual total (rate x nights unless a total was typed) and variance
          // come from one shared calculation, the same one the Overview uses.
          const { nights, budgetRate, hasOverride, actual: actualTotal, variance } = hotelFigures(hotel);
          const tone = variance === null || variance === 0 ? '' : variance < 0 ? 'text-green-600' : 'text-red-600';

          return (
            <Card key={member.id} className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardToggle open={open} onToggle={() => list.toggle(member.id)} label={member.name || 'staff member'} />
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <Hotel className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{member.name || 'Unnamed'}</CardTitle>
                      <p className="text-xs text-muted-foreground">{member.roleName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExpenseTypeSelect expense={member.reimbursable_expenses?.hotel} disabled={budgetFrozen || expenseTypeLocked} onChange={(v) => onExpenseTypeChange?.(member.id, 'hotel', v)} />
                    <ClearCardButton entry={travelData[member.id]} memberId={member.id} travelKey="hotel" setTravelData={setTravelData} budgetFrozen={budgetFrozen} />
                    <DatesLockButton locked={!!hotel.datesLocked} onToggle={() => updateHotel(member.id, 'datesLocked', !hotel.datesLocked)} />
                    {hasHotel ? (
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
                    <Label className="text-xs">Hotel Name</Label>
                    <Input
                      placeholder="e.g. Hilton Garden Inn"
                      value={hotel.hotelName || ''}
                      onChange={(e) => updateHotel(member.id, 'hotelName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Check-in Date</Label>
                    <Input
                      type="date"
                      value={hotel.checkIn || ''}
                      onChange={(e) => updateHotel(member.id, 'checkIn', e.target.value)}
                      disabled={!!hotel.datesLocked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Check-out Date</Label>
                    <Input
                      type="date"
                      value={hotel.checkOut || ''}
                      onChange={(e) => updateHotel(member.id, 'checkOut', e.target.value)}
                      disabled={!!hotel.datesLocked}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Confirmation #</Label>
                    <Input
                      placeholder="e.g. H9876543"
                      value={hotel.confirmation || ''}
                      onChange={(e) => updateHotel(member.id, 'confirmation', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Room Type</Label>
                    <Input
                      placeholder="e.g. King, Double Queen"
                      value={hotel.roomType || ''}
                      onChange={(e) => updateHotel(member.id, 'roomType', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nights</Label>
                    <Input value={nights > 0 ? nights : ''} placeholder="—" readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rate/Night (Budget $)</Label>
                    <Input value={budgetRate === null ? '' : budgetRate.toFixed(2)} placeholder="—" readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rate/Night (Actual $)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={hotel.actualRate ?? ''}
                      onChange={(e) => updateHotelFields(member.id, { actualRate: e.target.value, actualCost: '' })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Budget Total ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={hotel.cost || ''}
                      onChange={(e) => updateHotel(member.id, 'cost', e.target.value)}
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
                      value={hasOverride ? hotel.actualCost : actualTotal === null ? '' : actualTotal.toFixed(2)}
                      onChange={(e) => updateHotel(member.id, 'actualCost', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Variance ($)</Label>
                    <div className={`flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium ${tone}`}>
                      {variance === null ? '—' : `${variance < 0 ? '−' : ''}${Math.abs(variance).toFixed(2)} ${variance < 0 ? '↓' : variance > 0 ? '↑' : ''}`}
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-4 space-y-1.5">
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      placeholder="Special requests, amenities, etc."
                      rows={2}
                      value={hotel.notes || ''}
                      onChange={(e) => updateHotel(member.id, 'notes', e.target.value)}
                    />
                  </div>
                  <ReceiptsField
                    storageKey={storageKey}
                    receipts={hotel.receipts || []}
                    onChange={(next) => updateHotel(member.id, 'receipts', next)}
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

export default HotelsTab;
