import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, QrCode, MapPin, Calendar, Link as LinkIcon, Upload, ShieldAlert, ShieldCheck, Palette, ArrowRight, AlertTriangle } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const CustomizePage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  
  const [form, setForm] = useState({
    eventName: '', classTitle: '', date: '', location: '', sponsorLink: '', branding: 'Light', customColor: '#3B82F6', prerollAsset: null
  });
  const [validationStatus, setValidationStatus] = useState('idle'); // idle, checking, valid, invalid

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setForm(prev => ({ ...prev, prerollAsset: e.target.files[0] }));
    }
  };

  const handleValidation = () => {
    if (!form.date || !form.location) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please provide a date and full show address for validation." });
      return;
    }
    setValidationStatus('checking');
    setTimeout(() => {
      // Simulate geocoding and distance check
      const isInvalid = Math.random() > 0.5; // 50% chance of being invalid
      setValidationStatus(isInvalid ? 'invalid' : 'valid');
      toast({
        title: isInvalid ? "Reuse Conflict Detected" : "Validation Successful",
        description: isInvalid ? "This pattern cannot be used at this location within 30 days of a prior event." : "This pattern is available for your event.",
        variant: isInvalid ? "destructive" : "default",
      });
    }, 1500);
  };

  const handlePurchase = () => {
    if (validationStatus !== 'valid') {
      toast({ variant: "destructive", title: "Validation Required", description: "Please validate availability before purchasing." });
      return;
    }
    toast({
      title: "Proceeding to Checkout...",
      description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  const renderValidationStatus = () => {
    switch (validationStatus) {
      case 'checking':
        return <div className="flex items-center text-yellow-500"><MapPin className="h-4 w-4 mr-2 animate-pulse" /> Checking availability...</div>;
      case 'valid':
        return <div className="flex items-center text-green-500"><ShieldCheck className="h-4 w-4 mr-2" /> Available for use</div>;
      case 'invalid':
        return (
          <div className="flex items-center text-red-500">
            <ShieldAlert className="h-4 w-4 mr-2" /> Conflict detected
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="link" className="text-primary h-auto p-0 ml-2">Show Alternatives</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Available Alternatives</DialogTitle>
                  <DialogDescription>These patterns are similar and available for your selected date and location.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Alternative Pattern 1 (AQHA, Intermediate)</p>
                  <p className="text-sm text-muted-foreground">Alternative Pattern 2 (AQHA, Intermediate)</p>
                  <p className="text-sm text-muted-foreground">Alternative Pattern 3 (NRHA, Intermediate)</p>
                </div>
                <DialogFooter>
                  <Button onClick={() => toast({title: "🚧 Feature not implemented"})}>Select Alternative</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );
      default:
        return <div className="flex items-center text-muted-foreground"><MapPin className="h-4 w-4 mr-2" /> Check availability</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Customize Pattern</h1>
          <p className="text-xl text-muted-foreground">Finalize your pattern with event details, branding, and sponsorship.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
                <CardDescription>This information will be rendered on the final PDF.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Event Name (required)" value={form.eventName} onChange={(e) => handleInputChange('eventName', e.target.value)} />
                <Input placeholder="Class Title (required)" value={form.classTitle} onChange={(e) => handleInputChange('classTitle', e.target.value)} />
                <Input type="date" value={form.date} onChange={(e) => handleInputChange('date', e.target.value)} />
                <Input placeholder="Full Show Address (required for validation)" value={form.location} onChange={(e) => handleInputChange('location', e.target.value)} />
                <Input placeholder="Optional Event/Sponsor Link (URL)" value={form.sponsorLink} onChange={(e) => handleInputChange('sponsorLink', e.target.value)} />
              </CardContent>
              <CardFooter className="flex-col items-start space-y-3">
                <Button onClick={handleValidation} variant="outline" className="w-full" disabled={validationStatus === 'checking'}>
                  {renderValidationStatus()}
                </Button>
                {validationStatus === 'idle' && <p className="text-xs text-muted-foreground">You must validate availability before purchasing.</p>}
              </CardFooter>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Branding & Sponsorship</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="font-semibold">Branding Mode</Label>
                  <RadioGroup defaultValue="Light" value={form.branding} onValueChange={(value) => handleInputChange('branding', value)} className="mt-2 grid grid-cols-3 gap-4">
                    <div><RadioGroupItem value="Light" id="r1" /><Label htmlFor="r1" className="ml-2">Default</Label></div>
                    <div className="flex items-center">
                      <RadioGroupItem value="Custom" id="r3" /><Label htmlFor="r3" className="ml-2">Custom</Label>
                      {form.branding === 'Custom' && <Input type="color" value={form.customColor} onChange={(e) => handleInputChange('customColor', e.target.value)} className="w-10 h-6 p-0.5 ml-2" />}
                    </div>
                  </RadioGroup>
                  {form.branding === 'Custom' && <p className="text-xs text-primary mt-2">Custom color branding is a paid add-on.</p>}
                </div>
                <div>
                  <Label htmlFor="preroll" className="font-semibold">3-Second Pre-roll Asset (Optional)</Label>
                  <Input id="preroll" type="file" onChange={handleFileChange} className="mt-2" accept="video/*,image/*" />
                  <p className="text-xs text-muted-foreground mt-1">Upload a short video clip or static image.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="sticky top-24">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Live Preview & Checkout</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-secondary rounded-lg p-4 space-y-3 border border-border">
                  <div className="text-center" style={{ color: form.branding === 'Custom' ? form.customColor : 'inherit' }}>
                    <h3 className="font-bold text-lg">{form.eventName || 'Event Name'}</h3>
                    <p>{form.classTitle || 'Class Title'}</p>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{form.date || 'Date'}</span>
                    <span>{form.location.split(',')[0] || 'Location'}</span>
                  </div>
                  <div className="aspect-[4/3] bg-background pattern-grid flex items-center justify-center relative">
                    <span className="text-muted-foreground">Pattern Preview</span>
                    <div className="absolute bottom-2 right-2 p-1 bg-card rounded-sm border border-border">
                      <QrCode className="h-8 w-8" />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handlePurchase} className="w-full" disabled={validationStatus !== 'valid'}>
                  Purchase & Download PDF <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
            {validationStatus !== 'valid' && (
              <div className="mt-4 p-3 rounded-md bg-yellow-400/20 text-yellow-700 border border-yellow-400/50 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm">Please validate the pattern's availability for your event date and location before you can proceed to checkout.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CustomizePage;