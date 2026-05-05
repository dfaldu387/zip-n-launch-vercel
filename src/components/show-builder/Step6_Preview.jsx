import { useMemo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { parseLocalDate } from '@/lib/utils';
import { Download, Save, Lock, Loader2, CheckCircle2, Info, Globe, Facebook, Crown, UserCog, Mail, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAllClassItems } from '@/lib/showBillUtils';
import { generateShowBillPdf } from '@/lib/showBillPdfGenerator';

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-800 border-gray-300',        dotColor: 'bg-gray-500' },
  locked:    { label: 'Locked',    color: 'bg-amber-100 text-amber-800 border-amber-300',     dotColor: 'bg-amber-600' },
  published: { label: 'Published', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotColor: 'bg-emerald-600' },
};

// --- Left Panel: Project Info ---
const ProjectInfoCard = ({ formData, user, setFormData, moduleStatus }) => {
  const status = moduleStatus || 'draft';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  return (
    <div className="border rounded-lg bg-card p-5 space-y-4">
      <h3 className="text-base font-semibold">Project Info</h3>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Show Name</p>
          <p className="text-sm font-medium">{formData.showName || 'Untitled Show'}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Owner</p>
          <p className="text-sm font-medium">{user?.user_metadata?.full_name || user?.email || 'Unknown'}</p>
        </div>

        {formData.startDate && (
          <div>
            <p className="text-xs text-muted-foreground">Show Dates</p>
            <p className="text-sm">
              {parseLocalDate(formData.startDate).toLocaleDateString()}
              {formData.endDate && ` — ${parseLocalDate(formData.endDate).toLocaleDateString()}`}
            </p>
          </div>
        )}

        {formData.venueAddress && (
          <div>
            <p className="text-xs text-muted-foreground">Venue</p>
            <p className="text-sm">{formData.venueAddress}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-1">Current Status</p>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${cfg.color}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="pt-3 border-t space-y-1.5">
        <p className="text-xs text-muted-foreground">
          {formData.disciplines?.length || 0} discipline(s) &middot; {formData.arenas?.length || 0} arena(s)
        </p>
        {formData.showBill && (
          <p className="text-xs text-muted-foreground">
            {formData.showBill.days?.length || 0} day(s) &middot;{' '}
            {formData.showBill.days?.reduce((sum, d) => sum + d.arenas.reduce((s, a) => s + a.items.filter(i => i.type === 'classBox').length, 0), 0) || 0} class(es) scheduled
          </p>
        )}
      </div>

      {/* Publish Info — website & Facebook */}
      <div className="pt-3 border-t space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Publish Info (shown on Events page)</p>
        <div className="space-y-1.5">
          <Label htmlFor="showWebsite" className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Website URL</Label>
          <Input
            id="showWebsite"
            placeholder="https://yourshow.com"
            value={formData.showWebsite || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, showWebsite: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="showFacebook" className="text-xs flex items-center gap-1"><Facebook className="h-3 w-3" /> Facebook Event URL</Label>
          <Input
            id="showFacebook"
            placeholder="https://facebook.com/events/..."
            value={formData.showFacebook || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, showFacebook: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
};

// --- Center Panel: Action Buttons ---
const ActionPanel = ({ formData, currentStatus, onStatusChange, onExportPdf, isSaving }) => {
  const isPublished = currentStatus === 'published';
  const isLocked = currentStatus === 'locked';

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold mb-1">Manage Status</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Save, lock, and publish your show when ready.
      </p>

      {/* Save as Draft */}
      <Button
        variant="outline"
        size="lg"
        className="w-full justify-start text-sm h-12"
        onClick={() => onStatusChange('draft')}
        disabled={isSaving || isLocked || isPublished}
      >
        {isSaving ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />}
        <div className="text-left">
          <span className="font-semibold">Draft</span>
          <span className="block text-xs text-muted-foreground">Save to My Projects as draft</span>
        </div>
      </Button>

      {/* Lock */}
      <Button
        variant="outline"
        size="lg"
        className="w-full justify-start text-sm h-12 border-amber-200 hover:bg-amber-50 hover:border-amber-300"
        onClick={() => onStatusChange('locked')}
        disabled={isSaving || isPublished}
      >
        {isSaving ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Lock className="mr-3 h-5 w-5 text-amber-600" />}
        <div className="text-left">
          <span className="font-semibold text-amber-700">Locked</span>
          <span className="block text-xs text-muted-foreground">Lock all editing — export & view only</span>
        </div>
      </Button>

      {/* Publish */}
      <Button
        size="lg"
        className="w-full justify-start text-sm h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={() => onStatusChange('published')}
        disabled={isSaving || isPublished}
      >
        {isSaving ? <Loader2 className="mr-3 h-5 w-5 animate-spin text-white" /> : <CheckCircle2 className="mr-3 h-5 w-5" />}
        <div className="text-left">
          <span className="font-semibold">Published</span>
          <span className="block text-xs text-emerald-200">Publish official show bill — visible to exhibitors</span>
        </div>
      </Button>

      {/* Divider */}
      <hr className="my-2 border-border" />

      {/* Export PDF — only enabled after Lock or Publish */}
      <div>
        <Button
          size="lg"
          className="w-full text-sm font-semibold h-12"
          onClick={onExportPdf}
          disabled={isSaving || !(isLocked || isPublished)}
        >
          <Download className="mr-2 h-5 w-5" /> Export Final PDF
        </Button>
        {!isLocked && (
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Lock or Publish your show to enable export.
          </p>
        )}
      </div>
    </div>
  );
};

// --- Right Panel: Licensing & Ownership ---
const LicensingCard = () => (
  <div className="border rounded-lg bg-card p-5 space-y-4">
    <h3 className="text-base font-semibold flex items-center gap-2">
      <Info className="h-4 w-4 text-primary" />
      Project Ownership & Licensing
    </h3>

    <div className="space-y-2.5">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm">Ownership retained by creator</p>
      </div>
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm">Stored in your My Projects folder</p>
      </div>
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm">Admin access assigned</p>
      </div>
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm">Can be edited until locked</p>
      </div>
    </div>

    <hr className="border-border" />

    <div className="bg-muted/50 rounded-md p-3">
      <p className="text-sm font-medium">Pricing Notice</p>
      <p className="text-xs text-muted-foreground mt-1">
        Building a show is free for members. Licensing applies only when publishing or exporting the final show bill.
      </p>
    </div>
  </div>
);

// --- Admin & Owner Assignment Section ---
const AdminOwnerSection = ({ formData, setFormData, user, profile, isLocked: isLockedProp }) => {
  const loggedInUserName = profile?.full_name || user?.user_metadata?.full_name || '';
  const loggedInUserEmail = user?.email || '';
  const loggedInUserPhone = user?.user_metadata?.phone || user?.user_metadata?.mobile || profile?.phone || profile?.mobile || '';

  const defaultAdminOwner = {
    adminName: loggedInUserName,
    adminEmail: loggedInUserEmail,
    adminPhone: loggedInUserPhone,
    ownerName: loggedInUserName,
    ownerEmail: loggedInUserEmail,
    ownerPhone: loggedInUserPhone,
  };
  const adminOwner = { ...defaultAdminOwner, ...(formData.adminOwner || {}) };

  const handleUpdate = (field, value) => {
    setFormData(prev => ({
      ...prev,
      adminOwner: {
        ...(prev.adminOwner || {}),
        [field]: value
      }
    }));
  };

  const isLocked = isLockedProp;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Crown className="h-5 w-5 text-red-600" />
          Admin & Owner Assignment
        </h3>
      </div>
      <p className="text-sm text-muted-foreground">Must assign Admin and Owner (EquiPatterns members). Both default to creator but can be delegated.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Admin Assignment */}
        <div className="space-y-3 p-3 bg-background rounded-md border">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" />
            <Label className="font-semibold">Admin (Required)</Label>
          </div>
          <Input
            placeholder="Admin Name"
            value={adminOwner.adminName || ''}
            onChange={(e) => handleUpdate('adminName', e.target.value)}
            disabled={isLocked}
          />
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Email"
                className="pl-9"
                value={adminOwner.adminEmail || ''}
                onChange={(e) => handleUpdate('adminEmail', e.target.value)}
                disabled={isLocked}
              />
            </div>
            <div className="flex-1 relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Phone"
                className="pl-9"
                value={adminOwner.adminPhone || ''}
                onChange={(e) => handleUpdate('adminPhone', e.target.value)}
                disabled={isLocked}
              />
            </div>
          </div>
        </div>

        {/* Owner Assignment */}
        <div className="space-y-3 p-3 bg-background rounded-md border">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <Label className="font-semibold">Owner (Required)</Label>
          </div>
          <Input
            placeholder="Owner Name"
            value={adminOwner.ownerName || ''}
            onChange={(e) => handleUpdate('ownerName', e.target.value)}
            disabled={isLocked}
          />
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Email"
                className="pl-9"
                value={adminOwner.ownerEmail || ''}
                onChange={(e) => handleUpdate('ownerEmail', e.target.value)}
                disabled={isLocked}
              />
            </div>
            <div className="flex-1 relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Phone"
                className="pl-9"
                value={adminOwner.ownerPhone || ''}
                onChange={(e) => handleUpdate('ownerPhone', e.target.value)}
                disabled={isLocked}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Optional Second Admin */}
      <div className="space-y-3 p-3 bg-background rounded-md border">
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium text-muted-foreground">Second Admin (Optional)</Label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            placeholder="Name"
            value={adminOwner.secondAdminName || ''}
            onChange={(e) => handleUpdate('secondAdminName', e.target.value)}
            disabled={isLocked}
          />
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Email"
              className="pl-9"
              value={adminOwner.secondAdminEmail || ''}
              onChange={(e) => handleUpdate('secondAdminEmail', e.target.value)}
              disabled={isLocked}
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Phone"
              className="pl-9"
              value={adminOwner.secondAdminPhone || ''}
              onChange={(e) => handleUpdate('secondAdminPhone', e.target.value)}
              disabled={isLocked}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Step Component ---
export const Step6_Preview = ({ formData, setFormData, associationsData, createOrUpdateShow, stepNumber = 7, stepTitle = 'Save & Manage Your Show' }) => {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const allClassItems = useMemo(() => getAllClassItems(formData), [formData]);

  const handleStatusChange = useCallback(async (newStatus) => {
    setIsSaving(true);
    try {
      setFormData(prev => ({
        ...prev,
        moduleStatuses: {
          ...(prev.moduleStatuses || {}),
          editWizard: newStatus,
        },
      }));
      const project = await createOrUpdateShow(null, 'editWizard', newStatus);
      if (project) {
        const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
        toast({
          title: `Show ${statusLabel}!`,
          description: newStatus === 'published'
            ? 'Your show has been published — visible to exhibitors.'
            : newStatus === 'locked'
            ? 'Show is now locked. Editing is disabled — export and view only.'
            : `Your show has been saved as ${statusLabel}.`,
        });
      }
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Could not save show. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [createOrUpdateShow, setFormData, toast]);

  const handleExportPdf = useCallback(async () => {
    if (!formData.showBill) {
      toast({
        title: 'No Show Bill Data',
        description: 'Please build your schedule in the previous step before exporting.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await generateShowBillPdf(formData.showBill, allClassItems, associationsData, formData.layoutSettings);
      toast({ title: 'PDF Generated', description: 'Your show bill PDF has been downloaded.' });
    } catch (err) {
      toast({ title: 'PDF Error', description: err.message, variant: 'destructive' });
    }
  }, [formData.showBill, formData.layoutSettings, allClassItems, associationsData, toast]);

  const currentStatus = (formData.moduleStatuses || {}).editWizard || 'draft';

  return (
    <motion.div key="step7" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader>
        <CardTitle>{`${stepNumber}. ${stepTitle}`}</CardTitle>
        <CardDescription>
          Save your show, manage status, and publish when ready.
          <span className="block mt-1 text-xs text-muted-foreground/70">
            Building a show is free — licensing applies only when publishing/exporting.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Admin & Owner Assignment */}
        <AdminOwnerSection formData={formData} setFormData={setFormData} user={user} profile={profile} isLocked={currentStatus === 'locked' || currentStatus === 'published'} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Project Info */}
          <div className="lg:col-span-3">
            <ProjectInfoCard formData={formData} user={user} setFormData={setFormData} moduleStatus={currentStatus} />
          </div>

          {/* Center Panel: Action Buttons */}
          <div className="lg:col-span-5">
            <ActionPanel
              formData={formData}
              currentStatus={currentStatus}
              onStatusChange={handleStatusChange}
              onExportPdf={handleExportPdf}
              isSaving={isSaving}
            />
          </div>

          {/* Right Panel: Licensing */}
          <div className="lg:col-span-4">
            <LicensingCard />
          </div>
        </div>
      </CardContent>
    </motion.div>
  );
};
