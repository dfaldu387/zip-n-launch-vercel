import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Car } from 'lucide-react';

const RentalCarsTab = ({ personnel, travelData, setTravelData, budgetFrozen }) => {

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

  return (
    <div className="space-y-4">
      {personnel.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No personnel found. Add staff in Contract Management first.
          </CardContent>
        </Card>
      ) : (
        personnel.map((member) => {
          const rental = travelData[member.id]?.rentalCar || {};
          const hasRental = rental.company || rental.confirmation;

          return (
            <Card key={member.id} className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Car className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{member.name || 'Unnamed'}</CardTitle>
                      <p className="text-xs text-muted-foreground">{member.roleName}</p>
                    </div>
                  </div>
                  {hasRental ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Booked</Badge>
                  ) : (
                    <Badge variant="secondary">Not Set</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
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
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Return Date/Time</Label>
                    <Input
                      type="datetime-local"
                      value={rental.returnTime || ''}
                      onChange={(e) => updateRentalCar(member.id, 'returnTime', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cost</Label>
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
                    <Label className="text-xs">Confirmation #</Label>
                    <Input
                      placeholder="e.g. R5678901"
                      value={rental.confirmation || ''}
                      onChange={(e) => updateRentalCar(member.id, 'confirmation', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default RentalCarsTab;
