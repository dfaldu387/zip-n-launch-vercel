import React from 'react';
import { Wrench, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { statusLabel } from '@/lib/maintenanceRequests';

// Public "Grounds notices" card (Robert 2026-11-19). `notices` comes from
// get_public_maintenance_notices: only requests the office chose to publish, and only
// the problem, the place and the status. Nothing here says who reported it.
const STATUS_STYLE = {
  new: 'border-rose-300 text-rose-600',
  acknowledged: 'border-amber-300 text-amber-600',
  done: 'border-emerald-300 text-emerald-600',
};

const PublicMaintenanceCard = ({ notices }) => {
  if (!Array.isArray(notices) || notices.length === 0) return null;
  return (
    <Card className="bg-secondary border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Grounds notices</CardTitle>
        <CardDescription>Maintenance work the show office is aware of</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {notices.map((n) => (
          <div key={n.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-background/50 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{n.title}</p>
              {n.location && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3 shrink-0" /> {n.location}</p>}
            </div>
            <Badge variant="outline" className={`text-[11px] whitespace-nowrap ${STATUS_STYLE[n.status] || ''}`}>
              {n.status === 'new' ? 'Reported' : statusLabel(n.status)}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default PublicMaintenanceCard;
