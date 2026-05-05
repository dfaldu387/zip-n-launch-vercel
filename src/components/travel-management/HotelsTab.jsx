import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Hotel } from 'lucide-react';

const HotelsTab = ({ personnel, travelData, setTravelData, budgetFrozen }) => {

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
          const hotel = travelData[member.id]?.hotel || {};
          const hasHotel = hotel.hotelName || hotel.confirmation;

          return (
            <Card key={member.id} className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <Hotel className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{member.name || 'Unnamed'}</CardTitle>
                      <p className="text-xs text-muted-foreground">{member.roleName}</p>
                    </div>
                  </div>
                  {hasHotel ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Booked</Badge>
                  ) : (
                    <Badge variant="secondary">Not Set</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
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
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Check-out Date</Label>
                    <Input
                      type="date"
                      value={hotel.checkOut || ''}
                      onChange={(e) => updateHotel(member.id, 'checkOut', e.target.value)}
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
                    <Label className="text-xs">Cost (Total)</Label>
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
                    <Label className="text-xs">Room Type</Label>
                    <Input
                      placeholder="e.g. King, Double Queen"
                      value={hotel.roomType || ''}
                      onChange={(e) => updateHotel(member.id, 'roomType', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      placeholder="Special requests, amenities, etc."
                      rows={2}
                      value={hotel.notes || ''}
                      onChange={(e) => updateHotel(member.id, 'notes', e.target.value)}
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

export default HotelsTab;
