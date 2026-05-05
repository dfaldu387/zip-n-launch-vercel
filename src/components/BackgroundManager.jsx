import React, { useState, useRef } from 'react';
import { Check, Upload, Loader2, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

const PRESET_BACKGROUNDS = [
  { id: 'none', label: 'None', type: 'none', value: '', preview: 'bg-white border-2 border-dashed border-gray-300' },
  { id: 'white', label: 'White', type: 'solid', value: '#ffffff', preview: 'bg-white' },
  { id: 'cream', label: 'Cream', type: 'solid', value: '#FFFBEB', preview: 'bg-amber-50' },
  { id: 'light-gray', label: 'Light Gray', type: 'solid', value: '#F3F4F6', preview: 'bg-gray-100' },
  { id: 'light-blue', label: 'Light Blue', type: 'solid', value: '#EFF6FF', preview: 'bg-blue-50' },
  { id: 'light-green', label: 'Light Green', type: 'solid', value: '#F0FDF4', preview: 'bg-green-50' },
  { id: 'gradient-blue', label: 'Blue Gradient', type: 'gradient', value: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', preview: 'bg-gradient-to-br from-blue-50 to-blue-100' },
  { id: 'gradient-purple', label: 'Purple Gradient', type: 'gradient', value: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', preview: 'bg-gradient-to-br from-violet-50 to-violet-100' },
  { id: 'gradient-warm', label: 'Warm Gradient', type: 'gradient', value: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', preview: 'bg-gradient-to-br from-amber-50 to-amber-100' },
  { id: 'parchment', label: 'Parchment', type: 'solid', value: '#F5F0E8', preview: 'bg-[#F5F0E8]' },
  { id: 'slate', label: 'Slate', type: 'solid', value: '#F1F5F9', preview: 'bg-slate-100' },
  { id: 'rose', label: 'Rose', type: 'solid', value: '#FFF1F2', preview: 'bg-rose-50' },
];

/**
 * BackgroundManager — reusable background picker/uploader.
 *
 * Props:
 * - value: { type: 'none'|'solid'|'gradient'|'image', value: string, id?: string }
 * - onChange: (background) => void
 * - bucketPath?: string — Supabase storage path prefix (default: 'backgrounds')
 */
export default function BackgroundManager({ value, onChange, bucketPath = 'backgrounds' }) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const selectedId = value?.id || (value?.type === 'none' ? 'none' : '');

  const handlePresetSelect = (preset) => {
    onChange({
      id: preset.id,
      type: preset.type,
      value: preset.value,
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload a PNG, JPG, or WebP image.', variant: 'destructive' });
      return;
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 5MB.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${bucketPath}/${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('association_assets')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('association_assets')
        .getPublicUrl(fileName);

      onChange({
        id: 'custom-image',
        type: 'image',
        value: urlData.publicUrl,
      });

      toast({ title: 'Background uploaded', description: 'Your custom background has been uploaded.' });
    } catch (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Background</Label>
        <p className="text-xs text-muted-foreground mt-0.5">Choose a background for your document.</p>
      </div>

      {/* Preset Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {PRESET_BACKGROUNDS.map(preset => (
          <button
            key={preset.id}
            onClick={() => handlePresetSelect(preset)}
            className={cn(
              'relative aspect-square rounded-lg border-2 transition-all hover:scale-105',
              preset.preview,
              selectedId === preset.id ? 'border-primary ring-2 ring-primary/30' : 'border-border',
            )}
            title={preset.label}
          >
            {selectedId === preset.id && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Check className="h-5 w-5 text-primary" />
              </div>
            )}
            <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-background/80 rounded-b-lg py-0.5 truncate px-1">
              {preset.label}
            </span>
          </button>
        ))}

        {/* Custom Image Upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            'relative aspect-square rounded-lg border-2 border-dashed transition-all hover:border-primary flex flex-col items-center justify-center gap-1',
            selectedId === 'custom-image' ? 'border-primary ring-2 ring-primary/30' : 'border-border',
          )}
          title="Upload custom background"
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : selectedId === 'custom-image' && value?.value ? (
            <>
              <img src={value.value} alt="Custom" className="absolute inset-0 w-full h-full object-cover rounded-lg" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                <Check className="h-5 w-5 text-white" />
              </div>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">Upload</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Current selection display */}
      {value && value.type !== 'none' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Image className="h-3 w-3" />
          <span>
            Selected: {PRESET_BACKGROUNDS.find(p => p.id === selectedId)?.label || (value.type === 'image' ? 'Custom Image' : value.value)}
          </span>
          <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={() => onChange({ id: 'none', type: 'none', value: '' })}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

export { PRESET_BACKGROUNDS };
