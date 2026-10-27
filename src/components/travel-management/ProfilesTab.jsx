import React from 'react';
import { User, Mail, Phone, Plane, ShieldCheck, Paperclip, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Driver license photos are ID documents, so they stay in the private bucket and open through a
// short-lived signed link, same as receipts.
const BUCKET = 'travel-receipts';

const hasProfile = (p) => !!p && Object.keys(p).some((k) => k !== 'receipts' && k !== 'datesLocked' && p[k]);

const Line = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-2 text-sm">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="break-words">{children || <span className="text-muted-foreground">—</span>}</div>
    </div>
  </div>
);

/**
 * Traveler Profiles: what each person sent through the "Traveler Profile" request (legal name, contact,
 * home airport, Known Traveler Number, frequent flyer numbers, driver license photo). Read-only; the
 * show office uses it to book flights and rental cars in the person's name.
 */
const ProfilesTab = ({ personnel, travelData }) => {
  const { toast } = useToast();

  const openPhoto = async (photo) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(photo.path, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not open photo', description: error?.message || 'Try again.', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const received = personnel.filter((m) => hasProfile(travelData?.[m.id]?.profile)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-green-600" />
        {received} of {personnel.length} profiles received. These details are private to the show office.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {personnel.map((member) => {
          const p = travelData?.[member.id]?.profile;
          const done = hasProfile(p);
          const photos = p?.receipts || [];
          return (
            <Card key={member.id} className={done ? '' : 'border-dashed'}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{member.name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground">{member.roleName}</p>
                  </div>
                  {done ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Received</span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <Clock className="h-3 w-3" /> Not received
                    </span>
                  )}
                </div>
                {done ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Line icon={User} label="Legal name">{p.legalName}</Line>
                    <Line icon={Mail} label="Email">{p.email}</Line>
                    <Line icon={Phone} label="Mobile">{p.mobile}</Line>
                    <Line icon={Plane} label="Home airport">{p.homeAirport}</Line>
                    <Line icon={ShieldCheck} label="Known Traveler Number">{p.knownTravelerNumber}</Line>
                    <Line icon={Plane} label="Frequent flyer numbers">
                      {p.frequentFlyers && <span className="whitespace-pre-line">{p.frequentFlyers}</span>}
                    </Line>
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-xs text-muted-foreground">Driver license photo</p>
                      {photos.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {photos.map((ph) => (
                            <Button key={ph.id} variant="outline" size="sm" onClick={() => openPhoto(ph)}>
                              <Paperclip className="mr-1.5 h-3.5 w-3.5" /> View photo
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing yet. Use Request info on the Overview tab and tick Traveler Profile.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProfilesTab;
