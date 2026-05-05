import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Upload, Trash2, Loader2, Image as ImageIcon, Sparkles } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { useSiteBranding } from '@/contexts/SiteBrandingContext';

// Reuse an existing bucket used throughout the app to avoid "Bucket not found" errors.
// Files are stored under the `site_branding/` prefix.
const BUCKET = 'association_assets';

const ImageUploadCard = ({ label, description, currentUrl, onUpload, onRemove, isUploading }) => {
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Preview */}
          <div className="w-full sm:w-64 h-40 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
            {currentUrl ? (
              <img src={currentUrl} alt={label} className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No image uploaded</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-lg font-semibold">{label}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            <div className="flex items-center gap-3">
              <Label
                htmlFor={`upload-${label}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors"
              >
                {isUploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4" /> {currentUrl ? 'Replace' : 'Upload'}</>
                )}
              </Label>
              <input
                id={`upload-${label}`}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />

              {currentUrl && (
                <Button variant="outline" size="sm" onClick={onRemove} disabled={isUploading} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">PNG, JPG, WebP, or SVG. Max 5MB.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminSiteBrandingPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploading, setUploading] = useState({ background: false, logo: false });
  const { branding, setBranding, loading: isLoading, tableMissing: isTableMissing, markTableMissing } = useSiteBranding();

  const uploadFile = async (file, field) => {
    const key = field === 'background_url' ? 'background' : 'logo';
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 5MB.', variant: 'destructive' });
      return;
    }

    setUploading(prev => ({ ...prev, [key]: true }));

    try {
      // Remove old file if exists
      if (branding[field]) {
        const oldPath = branding[field].split(`/${BUCKET}/`).pop();
        if (oldPath) {
          await supabase.storage.from(BUCKET).remove([oldPath]);
        }
      }

      // Upload new file
      const fileExt = file.name.split('.').pop();
      const filePath = `site_branding/${key}_${uuidv4()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        const msg = uploadError.message || '';
        if (msg.toLowerCase().includes('bucket not found')) {
          toast({
            title: 'Upload failed',
            description: `Storage bucket "${BUCKET}" was not found in Supabase. Please create it or update the bucket name in the app.`,
            variant: 'destructive',
          });
          return;
        }
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      // Upsert branding record
      const { error: dbError } = await supabase
        .from('site_branding')
        .upsert({
          id: 'main',
          [field]: publicUrl,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (dbError) {
        const msg = dbError.message || '';
        const tableMissing =
          msg.toLowerCase().includes('could not find the table') ||
          msg.toLowerCase().includes('site_branding');

        if (tableMissing) {
          markTableMissing();
          toast({
            title: 'Branding storage not set up',
            description: 'The Supabase table "site_branding" does not exist yet. Please run the migration to enable Site Branding uploads.',
            variant: 'destructive',
          });
          return;
        }

        throw dbError;
      }

      setBranding(prev => ({ ...prev, [field]: publicUrl }));
      toast({ title: `${key === 'background' ? 'Background image' : 'Logo'} updated` });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }

    setUploading(prev => ({ ...prev, [key]: false }));
  };

  const removeFile = async (field) => {
    const key = field === 'background_url' ? 'background' : 'logo';

    try {
      if (branding[field]) {
        const oldPath = branding[field].split(`/${BUCKET}/`).pop();
        if (oldPath) {
          await supabase.storage.from(BUCKET).remove([oldPath]);
        }
      }

      const { error } = await supabase
        .from('site_branding')
        .upsert({
          id: 'main',
          [field]: '',
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        const msg = error.message || '';
        const tableMissing =
          msg.toLowerCase().includes('could not find the table') ||
          msg.toLowerCase().includes('site_branding');

        if (tableMissing) {
          markTableMissing();
          toast({
            title: 'Branding storage not set up',
            description: 'The Supabase table "site_branding" does not exist yet. Please run the migration to enable Site Branding uploads.',
            variant: 'destructive',
          });
          return;
        }

        throw error;
      }

      setBranding(prev => ({ ...prev, [field]: '' }));
      toast({ title: `${key === 'background' ? 'Background image' : 'Logo'} removed` });
    } catch (err) {
      toast({ title: 'Remove failed', description: err.message, variant: 'destructive' });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <>
      <Helmet>
        <title>Site Branding - Admin Dashboard</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <div className="flex items-start justify-between mb-4">
              <AdminBackButton />
              <div className="text-center flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">Site Branding</h1>
                <p className="text-sm text-muted-foreground">
                  Upload the homepage background image and site logo.
                </p>
              </div>
              <div className="w-[70px]" />
            </div>

            {isTableMissing && (
              <div className="mb-6 rounded-md border border-dashed border-yellow-400 bg-yellow-50 p-4 text-xs md:text-sm text-yellow-900">
                <p className="font-semibold">Site branding storage is not configured yet.</p>
                <p className="mt-1">
                  The Supabase table <code className="font-mono text-[0.75rem]">site_branding</code> does not exist.
                  Until it is created, this page will use empty defaults and uploads will not be saved.
                </p>
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                <ImageUploadCard
                  label="Homepage Background"
                  description="The main background image displayed on the homepage hero section."
                  currentUrl={branding.background_url}
                  onUpload={(file) => uploadFile(file, 'background_url')}
                  onRemove={() => removeFile('background_url')}
                  isUploading={uploading.background}
                />

                <ImageUploadCard
                  label="Site Logo"
                  description="The logo displayed in the navigation bar and footer."
                  currentUrl={branding.logo_url}
                  onUpload={(file) => uploadFile(file, 'logo_url')}
                  onRemove={() => removeFile('logo_url')}
                  isUploading={uploading.logo}
                />
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </>
  );
};

export default AdminSiteBrandingPage;

