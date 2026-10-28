import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { invokeAsUser } from '@/lib/edgeFunctions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, AlertCircle, Paperclip, Plane, Hotel, Car, MapPin, User } from 'lucide-react';

// Fields each item asks for; the names match what the Travel Management tabs save.
const FIELDS = {
  flight: [
    ['airline', 'Airline', 'text', 'e.g. Delta'],
    ['flightNumber', 'Flight number', 'text', 'e.g. DL1234'],
    ['departureAirport', 'Departure airport', 'text', 'e.g. LAX'],
    ['arrivalAirport', 'Arrival airport', 'text', 'e.g. DFW'],
    ['departureTime', 'Departure date/time', 'datetime-local'],
    ['arrivalTime', 'Arrival date/time', 'datetime-local'],
    ['returnDepartureTime', 'Return departure date/time', 'datetime-local'],
    ['returnArrivalTime', 'Return arrival date/time', 'datetime-local'],
    ['confirmation', 'Confirmation #', 'text', 'e.g. ABC123'],
    ['actualCost', 'Total cost ($)', 'number', '0.00'],
  ],
  hotel: [
    ['hotelName', 'Hotel name', 'text'],
    ['checkIn', 'Check-in', 'date'],
    ['checkOut', 'Check-out', 'date'],
    ['confirmation', 'Confirmation #', 'text'],
    ['roomType', 'Room type', 'text', 'e.g. King'],
    ['actualCost', 'Total cost ($)', 'number', '0.00'],
  ],
  rentalCar: [
    ['company', 'Rental company', 'text', 'e.g. Hertz'],
    ['pickupTime', 'Pickup date/time', 'datetime-local'],
    ['returnTime', 'Return date/time', 'datetime-local'],
    ['pickupLocation', 'Pickup location', 'text', 'e.g. Denver International Airport'],
    ['vehicleType', 'Vehicle type', 'text', 'e.g. Intermediate SUV'],
    ['confirmation', 'Confirmation #', 'text'],
    ['actualCost', 'Total cost ($)', 'number', '0.00'],
  ],
  mileage: [
    ['origin', 'Starting from', 'text'],
    ['destination', 'Driving to', 'text'],
    ['startDate', 'Start date', 'date'],
    ['endDate', 'End date', 'date'],
    ['miles', 'Miles (round trip)', 'number', '0'],
    ['purpose', 'Purpose', 'text'],
  ],
  profile: [
    ['legalName', 'Legal name (as on your ID)', 'text', 'e.g. Jane Marie Smith'],
    ['email', 'Email', 'email', 'name@example.com'],
    ['mobile', 'Mobile number', 'tel', 'e.g. 555-123-4567'],
    ['homeAirport', 'Home airport', 'text', 'e.g. DEN'],
    ['knownTravelerNumber', 'Known Traveler Number (TSA PreCheck / Global Entry)', 'text'],
    ['frequentFlyers', 'Frequent flyer numbers', 'textarea', 'One per line, e.g.\nDelta: 1234567890\nSouthwest: 9876543'],
  ],
};
const ICONS = { flight: Plane, hotel: Hotel, rentalCar: Car, mileage: MapPin, profile: User };
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 10;

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// Used by the emailed link (token) and by the Staff Portal (projectId, signed in).
export const ItemForm = ({ item, token, projectId, onSaved }) => {
  const { toast } = useToast();
  const [values, setValues] = useState(item.values || {});
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const Icon = ICONS[item.type] || Plane;

  const addFiles = (list) => {
    const picked = Array.from(list || []);
    const bad = picked.find((f) => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_MB * 1024 * 1024);
    if (bad) {
      toast({ variant: 'destructive', title: 'Cannot use that file', description: `Use a PDF, JPG, PNG or WEBP under ${MAX_MB} MB.` });
      return;
    }
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
  };

  const save = async () => {
    setSaving(true);
    try {
      const encoded = await Promise.all(files.map(async (f) => ({ name: f.name, type: f.type, base64: await fileToBase64(f) })));
      const { data, error } = projectId
        ? await invokeAsUser('travel-info-request', { action: 'portal_submit', projectId, type: item.type, values, files: encoded })
        : await supabase.functions.invoke('travel-info-request', {
          body: { action: 'submit', token, type: item.type, values, files: encoded },
        });
      if (error || data?.error) throw new Error(data?.error || 'Could not save. Please try again.');
      setFiles([]);
      onSaved(item.type, data);
      toast({ title: `${item.label} saved`, description: 'Thank you. You can come back to this link to change it.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Not saved', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-blue-500" />
          {item.label}
          {item.submittedAt && (
            <span className="ml-auto flex items-center gap-1 text-xs font-normal text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Sent
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS[item.type].map(([name, label, kind, placeholder]) => {
            const dateLocked = item.datesLocked && (kind === 'date' || kind === 'datetime-local');
            return (
              <div key={name} className={`space-y-1.5 ${kind === 'textarea' ? 'sm:col-span-2' : ''}`}>
                <Label className="text-xs">{label}</Label>
                {kind === 'textarea' ? (
                  <textarea
                    rows={3}
                    placeholder={placeholder}
                    value={values[name] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                ) : (
                  <Input
                    type={kind}
                    min={kind === 'number' ? '0' : undefined}
                    step={kind === 'number' ? '0.01' : undefined}
                    placeholder={placeholder}
                    value={values[name] || ''}
                    disabled={dateLocked}
                    onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{item.type === 'profile' ? 'Driver license photo (for airline or rental car)' : 'Receipts (optional)'}</Label>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm text-blue-600 hover:bg-muted">
            <Paperclip className="h-4 w-4" /> {item.type === 'profile' ? 'Attach photo' : 'Add receipt'}
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <ul className="space-y-1 text-sm">
            {(item.receipts || []).map((r) => <li key={r.id} className="text-muted-foreground">✓ {r.name}</li>)}
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                {f.name}{' '}
                <button type="button" className="text-xs text-muted-foreground hover:text-red-600" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>remove</button>
              </li>
            ))}
          </ul>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {item.submittedAt ? `Update ${item.label}` : `Send ${item.label}`}
        </Button>
        {item.type === 'profile' && <p className="text-xs text-muted-foreground">Your ID details are used only to book your travel and are visible only to the show office.</p>}
      </CardContent>
    </Card>
  );
};

/**
 * Public, no-login page reached from the "Enter Travel Details" link in the travel request email.
 * The token carries the show, the person and a secret; the server checks all three.
 */
export default function TravelInfoRequestPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('travel-info-request', { body: { action: 'get', token } });
      if (fnError || data?.error) setError(data?.error || 'This link is invalid or has expired.');
      else setInfo(data);
    } catch {
      setError('Could not load this request. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onSaved = (type, data) =>
    setInfo((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.type === type ? { ...i, submittedAt: data.submittedAt, receipts: data.receipts } : i)),
    }));

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        {loading && <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
        {!loading && error && (
          <Card><CardContent className="flex items-start gap-3 pt-6"><AlertCircle className="mt-0.5 h-5 w-5 text-red-500" /><p>{error}</p></CardContent></Card>
        )}
        {!loading && info && (
          <>
            <div>
              <h1 className="text-2xl font-bold">Travel details</h1>
              <p className="text-muted-foreground">
                {info.showName}{info.memberName ? ` — ${info.memberName}` : ''}{info.role ? ` (${info.role})` : ''}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Fill in what you have and send each section. You can come back to this link to add or change details.</p>
            </div>
            {info.items.map((item) => <ItemForm key={item.type} item={item} token={token} onSaved={onSaved} />)}
          </>
        )}
      </div>
    </div>
  );
}
