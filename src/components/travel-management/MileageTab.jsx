import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

const MileageTab = ({ personnel, travelData, setTravelData, budgetFrozen }) => {

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
          const mileage = travelData[member.id]?.mileage || {};
          const hasMileage = mileage.miles || mileage.origin;

          return (
            <Card key={member.id} className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <MapPin className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{member.name || 'Unnamed'}</CardTitle>
                      <p className="text-xs text-muted-foreground">{member.roleName}</p>
                    </div>
                  </div>
                  {hasMileage ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Logged</Badge>
                  ) : (
                    <Badge variant="secondary">Not Set</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <Label className="text-xs">Rate per Mile</Label>
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
                    <Label className="text-xs">Total Cost</Label>
                    <Input
                      type="number"
                      value={mileage.cost || '0.00'}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
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
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Date</Label>
                    <Input
                      type="date"
                      value={mileage.endDate || ''}
                      onChange={(e) => updateMileage(member.id, 'endDate', e.target.value)}
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

export default MileageTab;
