import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Palette, FileUp, QrCode, Zap, PlusCircle, Trash2, Image } from 'lucide-react';
import { LogoUploader } from '@/components/show-structure/LogoUploader';
import { v4 as uuidv4 } from 'uuid';

const MultiLogoSection = ({ title, description, logos = [], field, formData, setFormData }) => {
  const addLogo = () => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), { id: uuidv4(), name: '', url: '' }]
    }));
  };

  const updateLogo = (id, key, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || []).map(l => l.id === id ? { ...l, [key]: value } : l)
    }));
  };

  const removeLogo = (id) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter(l => l.id !== id)
    }));
  };

  return (
    <div>
      <Label className="text-lg font-semibold flex items-center gap-2"><Image className="w-5 h-5 text-violet-500" />{title}</Label>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      <div className="space-y-3">
        {logos.map((logo) => (
          <div key={logo.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
            <div className="flex-1">
              <Input
                placeholder="Name (e.g. AQHA, Sponsor Brand)"
                value={logo.name}
                onChange={(e) => updateLogo(logo.id, 'name', e.target.value)}
                className="h-8 text-sm mb-1"
              />
              <LogoUploader
                fieldId={`${field}_${logo.id}`}
                currentLogoUrl={logo.url}
                onUploadComplete={(url) => updateLogo(logo.id, 'url', url)}
                showId={formData.id || 'temp'}
              />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeLogo(logo.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full" onClick={addLogo}>
          <PlusCircle className="h-4 w-4 mr-2" />Add Another
        </Button>
      </div>
    </div>
  );
};

export const Step5_Uploads = ({ formData, setFormData }) => {
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, [e.target.name]: e.target.files[0] }));
    }
  };

  const handleValueChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Migrate legacy single-logo fields to arrays on first render
  React.useEffect(() => {
    setFormData(prev => {
      let updated = false;
      const next = { ...prev };
      if (prev.showLogoUrl && !prev.showLogos?.length) {
        next.showLogos = [{ id: uuidv4(), name: 'Show Logo', url: prev.showLogoUrl }];
        delete next.showLogoUrl;
        updated = true;
      }
      if (prev.sponsorLogoUrl && !prev.sponsorLogos?.length) {
        next.sponsorLogos = [{ id: uuidv4(), name: 'Sponsor', url: prev.sponsorLogoUrl }];
        delete next.sponsorLogoUrl;
        updated = true;
      }
      if (!next.showLogos) { next.showLogos = []; updated = true; }
      if (!next.sponsorLogos) { next.sponsorLogos = []; updated = true; }
      return updated ? next : prev;
    });
  }, []);

  return (
    <motion.div key="step5-uploads" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader>
        <CardTitle>Step 6: Uploads & Media</CardTitle>
        <CardDescription>Customize the look of your pattern book and add media assets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">

        {/* Layout Style - full width */}
        <div>
          <Label className="text-lg font-semibold">Layout Style</Label>
          <p className="text-sm text-muted-foreground mb-3">Choose the visual theme for your generated documents.</p>
          <RadioGroup value={formData.layoutStyle} onValueChange={(v) => handleValueChange('layoutStyle', v)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Label htmlFor="styleA" className="flex flex-col items-center p-4 border rounded-lg cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <RadioGroupItem value="styleA" id="styleA" className="sr-only" />
              <Palette className="w-8 h-8 mb-2" />
              <span className="font-semibold">Style A (By Date)</span>
              <span className="text-xs text-muted-foreground text-center">Clean, minimalist design with a focus on readability.</span>
            </Label>
            <Label htmlFor="styleB" className="flex flex-col items-center p-4 border rounded-lg cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <RadioGroupItem value="styleB" id="styleB" className="sr-only" />
              <Palette className="w-8 h-8 mb-2" />
              <span className="font-semibold">Style B (By Discipline)</span>
              <span className="text-xs text-muted-foreground text-center">Traditional layout with elegant typography and borders.</span>
            </Label>
          </RadioGroup>
        </div>

        {/* Two-column: Documents + Logos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="p-5 border rounded-lg space-y-4">
              <div>
                <Label htmlFor="showSchedule" className="text-lg font-semibold flex items-center gap-2"><FileUp className="w-5 h-5 text-blue-500" />Upload Schedule</Label>
                <p className="text-sm text-muted-foreground mb-3">Upload the show schedule document.</p>
                <Input id="showSchedule" name="showSchedule" type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
              </div>
              <div>
                <Label htmlFor="showBill" className="text-lg font-semibold flex items-center gap-2"><FileUp className="w-5 h-5 text-blue-500" />Upload Show Bill</Label>
                <p className="text-sm text-muted-foreground mb-3">Upload the show bill document.</p>
                <Input id="showBill" name="showBill" type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
              </div>
              <div>
                <Label htmlFor="eventThumbnail" className="text-lg font-semibold flex items-center gap-2"><FileUp className="w-5 h-5 text-blue-500" />Event Page Thumbnail</Label>
                <p className="text-sm text-muted-foreground mb-3">This image will be used on the main Events page.</p>
                <Input id="eventThumbnail" name="eventThumbnail" type="file" accept="image/*" onChange={handleFileChange} />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="p-5 border rounded-lg space-y-5">
              <MultiLogoSection
                title="Show Logos (optional)"
                description="Upload logos for your pattern book cover page."
                logos={formData.showLogos || []}
                field="showLogos"
                formData={formData}
                setFormData={setFormData}
              />
              <div className="border-t pt-5">
                <MultiLogoSection
                  title="Sponsor Logos (optional)"
                  description="Upload sponsor logos to display in your pattern book."
                  logos={formData.sponsorLogos || []}
                  field="sponsorLogos"
                  formData={formData}
                  setFormData={setFormData}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Office Pro Package - full width */}
        <div className="p-6 border rounded-lg bg-primary/10 border-primary/30 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="officePackageUpgrade" className="text-lg font-semibold flex items-center"><Zap className="w-5 h-5 mr-2 text-primary"/>Office Pro Package</Label>
              <p className="text-sm text-muted-foreground">Auto-publish, QR codes, and office-ready PDFs.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-lg text-primary">+$150.00</span>
              <Switch id="officePackageUpgrade" checked={formData.officePackageUpgrade} onCheckedChange={(c) => handleValueChange('officePackageUpgrade', c)} />
            </div>
          </div>
          {formData.officePackageUpgrade && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 pt-4 border-t border-primary/20">
              <div>
                <Label htmlFor="publishDate">Scheduled Publish Date</Label>
                <p className="text-xs text-muted-foreground mb-2">Patterns will become public on this date.</p>
                <Input id="publishDate" name="publishDate" type="date" value={formData.publishDate} onChange={(e) => handleValueChange('publishDate', e.target.value)} />
              </div>
              <div className="flex items-start space-x-3 p-3 bg-background/50 rounded-md">
                <QrCode className="w-5 h-5 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold">What's Included?</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                    <li>Automatic posting to your event page.</li>
                    <li>Print-ready QR codes for each pattern.</li>
                    <li>A separate package of documents for office use.</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </div>

      </CardContent>
    </motion.div>
  );
};