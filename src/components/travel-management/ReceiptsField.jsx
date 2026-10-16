import React, { useRef, useState } from 'react';
import { Paperclip, X, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Receipts are financial records, so they go to a private bucket and open through a
// short-lived signed link (see supabase/migrations/20261016120000_travel_receipts_bucket.sql).
const BUCKET = 'travel-receipts';
const MAX_MB = 10;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * "Notes / Receipts" row for a travel card.
 * receipts: [{ id, name, path }]; onChange(nextReceipts). notes/onNotesChange are optional
 * (Hotels and Mileage already have their own notes box).
 */
const ReceiptsField = ({ storageKey, receipts = [], onChange, notes, onNotesChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (fileList) => {
    const file = fileList?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!user || !storageKey) {
      toast({ title: 'Upload failed', description: 'Please sign in and open a show first.', variant: 'destructive' });
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast({ title: 'Wrong file type', description: 'Please use a PDF, JPG, PNG or WEBP file.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: 'File too large', description: `Please use a file under ${MAX_MB} MB.`, variant: 'destructive' });
      return;
    }
    setUploading(true);
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
    const path = `${user.id}/${storageKey}/receipts/${uuidv4()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
    setUploading(false);
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      return;
    }
    onChange([...receipts, { id: uuidv4(), name: file.name, path }]);
  };

  const open = async (receipt) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(receipt.path, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not open receipt', description: error?.message || 'Try again.', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const remove = async (receipt) => {
    const { error } = await supabase.storage.from(BUCKET).remove([receipt.path]);
    if (error) {
      toast({ title: 'Could not remove receipt', description: error.message, variant: 'destructive' });
      return;
    }
    onChange(receipts.filter((r) => r.id !== receipt.id));
  };

  return (
    <div className="col-span-2 md:col-span-4 space-y-1.5">
      <Label className="text-xs">Notes / Receipts</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-blue-600 hover:bg-muted disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Add Receipt'}
        </button>
        {onNotesChange && (
          <Input
            className="flex-1 min-w-[200px]"
            placeholder="Add notes (optional)"
            value={notes || ''}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        )}
      </div>
      {receipts.length > 0 && (
        <ul className="space-y-1">
          {receipts.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <button type="button" onClick={() => open(r)} className="text-blue-600 hover:underline text-left">
                {r.name}
              </button>
              <button
                type="button"
                onClick={() => remove(r)}
                aria-label={`Remove ${r.name}`}
                className="text-muted-foreground hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReceiptsField;
