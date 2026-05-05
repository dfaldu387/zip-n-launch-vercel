import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Upload, Trash2, Loader2, Image as ImageIcon, PlusCircle, Megaphone, AlertTriangle } from 'lucide-react';
import Navigation from '@/components/Navigation';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useMarketingContent } from '@/contexts/MarketingContentContext';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const BUCKET = 'association_assets';
const SLOT_LABELS = { ad_1: 'Ad Placement 1', ad_2: 'Ad Placement 2', ad_3: 'Ad Placement 3' };

const AdSlotCard = ({ slotData, onSave, onImageUpload, onImageRemove, isUploading }) => {
  const [title, setTitle] = useState(slotData?.title || '');
  const [description, setDescription] = useState(slotData?.description || '');
  const [linkUrl, setLinkUrl] = useState(slotData?.link_url || '');
  const [isActive, setIsActive] = useState(slotData?.is_active || false);

  const slotLabel = SLOT_LABELS[slotData?.slot] || slotData?.slot;

  const handleSave = () => {
    onSave({
      title,
      description,
      link_url: linkUrl,
      is_active: isActive,
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onImageUpload(file);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">{slotLabel}</h3>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-full sm:w-64 h-40 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
            {slotData?.image_url ? (
              <img src={slotData.image_url} alt={slotLabel} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No image uploaded</p>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Label
                htmlFor={`upload-${slotData?.slot}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors"
              >
                {isUploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4" /> {slotData?.image_url ? 'Replace' : 'Upload'}</>
                )}
              </Label>
              <input
                id={`upload-${slotData?.slot}`}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {slotData?.image_url && (
                <Button variant="outline" size="sm" onClick={onImageRemove} disabled={isUploading} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP, or SVG. Max 5MB.</p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor={`title-${slotData?.slot}`}>Title</Label>
            <Input id={`title-${slotData?.slot}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ad title" />
          </div>
          <div>
            <Label htmlFor={`desc-${slotData?.slot}`}>Description</Label>
            <Textarea id={`desc-${slotData?.slot}`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short promotional text" rows={2} />
          </div>
          <div>
            <Label htmlFor={`link-${slotData?.slot}`}>Link URL</Label>
            <Input id={`link-${slotData?.slot}`} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch id={`active-${slotData?.slot}`} checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor={`active-${slotData?.slot}`} className="cursor-pointer">Active</Label>
            </div>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AnnouncementCard = ({ announcement, onSave, onDelete }) => {
  const [title, setTitle] = useState(announcement?.title || '');
  const [description, setDescription] = useState(announcement?.description || '');
  const [isActive, setIsActive] = useState(announcement?.is_active || false);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Announcement text" rows={2} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="cursor-pointer">Active</Label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDelete(announcement.id)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <Button size="sm" onClick={() => onSave(announcement.id, { title, description, is_active: isActive })}>
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminMarketingContentPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { content, refreshContent, loading, tableMissing, markTableMissing } = useMarketingContent();
  const [uploading, setUploading] = useState({});

  const handleTableError = useCallback((error) => {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('could not find the table') || msg.includes('marketing_content')) {
      markTableMissing();
      toast({
        title: 'Table not configured',
        description: 'The "marketing_content" table does not exist in Supabase. Please create it first.',
        variant: 'destructive',
      });
      return true;
    }
    return false;
  }, [markTableMissing, toast]);

  const uploadImage = async (file, slot) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 5MB.', variant: 'destructive' });
      return;
    }

    setUploading(prev => ({ ...prev, [slot]: true }));

    try {
      const existingAd = content.ads.find(a => a.slot === slot);
      if (existingAd?.image_url) {
        const oldPath = existingAd.image_url.split(`/${BUCKET}/`).pop();
        if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `marketing/${slot}_${uuidv4()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        if (uploadError.message?.toLowerCase().includes('bucket not found')) {
          toast({ title: 'Upload failed', description: `Storage bucket "${BUCKET}" was not found.`, variant: 'destructive' });
          return;
        }
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('marketing_content')
        .update({
          image_url: publicUrlData.publicUrl,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('slot', slot);

      if (dbError) {
        if (handleTableError(dbError)) return;
        throw dbError;
      }

      await refreshContent();
      toast({ title: 'Image uploaded successfully' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }

    setUploading(prev => ({ ...prev, [slot]: false }));
  };

  const removeImage = async (slot) => {
    try {
      const existingAd = content.ads.find(a => a.slot === slot);
      if (existingAd?.image_url) {
        const oldPath = existingAd.image_url.split(`/${BUCKET}/`).pop();
        if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
      }

      const { error } = await supabase
        .from('marketing_content')
        .update({
          image_url: '',
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('slot', slot);

      if (error) {
        if (handleTableError(error)) return;
        throw error;
      }

      await refreshContent();
      toast({ title: 'Image removed' });
    } catch (err) {
      toast({ title: 'Remove failed', description: err.message, variant: 'destructive' });
    }
  };

  const saveSlot = async (slot, fields) => {
    try {
      const { error } = await supabase
        .from('marketing_content')
        .update({
          ...fields,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('slot', slot);

      if (error) {
        if (handleTableError(error)) return;
        throw error;
      }

      await refreshContent();
      toast({ title: 'Changes saved' });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
  };

  const addAnnouncement = async () => {
    try {
      const { error } = await supabase
        .from('marketing_content')
        .insert({
          slot: 'announcement',
          title: '',
          description: '',
          is_active: false,
          display_order: (content.announcements.length + 1) * 10,
          updated_by: user?.id,
        });

      if (error) {
        if (handleTableError(error)) return;
        throw error;
      }

      await refreshContent();
      toast({ title: 'Announcement added' });
    } catch (err) {
      toast({ title: 'Failed to add announcement', description: err.message, variant: 'destructive' });
    }
  };

  const saveAnnouncement = async (id, fields) => {
    try {
      const { error } = await supabase
        .from('marketing_content')
        .update({
          ...fields,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        if (handleTableError(error)) return;
        throw error;
      }

      await refreshContent();
      toast({ title: 'Announcement saved' });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
  };

  const deleteAnnouncement = async (id) => {
    try {
      const { error } = await supabase
        .from('marketing_content')
        .delete()
        .eq('id', id);

      if (error) {
        if (handleTableError(error)) return;
        throw error;
      }

      await refreshContent();
      toast({ title: 'Announcement deleted' });
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <>
      <Helmet>
        <title>Marketing Content - Admin Dashboard</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <div className="flex items-start justify-between mb-4">
              <AdminBackButton />
              <div className="text-center flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">Marketing Content</h1>
                <p className="text-sm text-muted-foreground">
                  Manage homepage ads, announcements, and promotional content.
                </p>
              </div>
              <div className="w-[70px]" />
            </div>

            {tableMissing && (
              <div className="mb-6 rounded-md border border-dashed border-yellow-400 bg-yellow-50 p-4 text-xs md:text-sm text-yellow-900">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="font-semibold">Marketing content storage is not configured yet.</p>
                </div>
                <p>
                  The Supabase table <code className="font-mono text-[0.75rem]">marketing_content</code> does not exist.
                  Until it is created, this page will use empty defaults and changes will not be saved.
                </p>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Tabs defaultValue="ads" className="w-full">
                <TabsList className="mb-6">
                  <TabsTrigger value="ads">Ad Placements</TabsTrigger>
                  <TabsTrigger value="announcements">
                    Announcements
                    {content.announcements.length > 0 && (
                      <span className="ml-2 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
                        {content.announcements.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ads" className="space-y-6">
                  {['ad_1', 'ad_2', 'ad_3'].map(slot => {
                    const slotData = content.ads.find(a => a.slot === slot) || { slot };
                    return (
                      <AdSlotCard
                        key={slot}
                        slotData={slotData}
                        onSave={(fields) => saveSlot(slot, fields)}
                        onImageUpload={(file) => uploadImage(file, slot)}
                        onImageRemove={() => removeImage(slot)}
                        isUploading={uploading[slot] || false}
                      />
                    );
                  })}
                </TabsContent>

                <TabsContent value="announcements" className="space-y-6">
                  <div className="flex justify-end">
                    <Button onClick={addAnnouncement} variant="outline">
                      <PlusCircle className="h-4 w-4 mr-2" /> Add Announcement
                    </Button>
                  </div>

                  {content.announcements.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p>No announcements yet. Click "Add Announcement" to create one.</p>
                    </div>
                  ) : (
                    content.announcements.map(ann => (
                      <AnnouncementCard
                        key={ann.id}
                        announcement={ann}
                        onSave={saveAnnouncement}
                        onDelete={deleteAnnouncement}
                      />
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </motion.div>
        </main>
      </div>
    </>
  );
};

export default AdminMarketingContentPage;
