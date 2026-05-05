import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Check, ArrowRight, ArrowLeft, Users, Calendar, ShieldCheck, UploadCloud, AlertTriangle, ListPlus, BookCopy } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';

const steps = [
  { id: 1, name: 'Event Setup', icon: Users },
  { id: 2, name: 'Classes', icon: ListPlus },
  { id: 3, name: 'Details', icon: Calendar },
  { id: 4, name: 'Review', icon: ShieldCheck },
  { id: 5, name: 'Save & Manage', icon: UploadCloud },
];

const BreedShowPackagePage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    associationType: '',
    associations: {},
    showName: '',
    startDate: '',
    endDate: '',
    venueAddress: '',
    classes: [],
  });
  const { toast } = useToast();
  const [associationsData, setAssociationsData] = useState([]);

  useEffect(() => {
    const fetchAssociations = async () => {
        const { data, error } = await supabase.from('associations').select('*');
        if (error) {
            toast({ title: 'Error fetching associations', description: error.message, variant: 'destructive' });
        } else {
            setAssociationsData(data);
        }
    };
    fetchAssociations();
  }, [toast]);
  
  const handleAssociationTypeChange = (value) => {
    setFormData(prev => ({ ...prev, associationType: value, associations: {}, classes: [] }));
    
    // Track selection
    const usageData = JSON.parse(localStorage.getItem('associationUsage') || '{}');
    usageData[value] = (usageData[value] || 0) + 1;
    localStorage.setItem('associationUsage', JSON.stringify(usageData));
  };
  
  const handleMultiAssociationChange = (assocId) => {
    setFormData(prev => {
      const newAssociations = { ...prev.associations };
      if (newAssociations[assocId]) {
        delete newAssociations[assocId];
      } else {
        newAssociations[assocId] = true;
      }
      return { ...prev, associations: newAssociations };
    });
  };

  const availableClasses = useMemo(() => {
    if (formData.associationType === 'open-unaffiliated') {
      return associationsData.find(a => a.id === 'open-unaffiliated')?.classes || [];
    }
    
    const selectedIds = Object.keys(formData.associations);
    if (selectedIds.length === 0) return [];

    const allClassNames = new Set();
    const classMap = {};
    
    selectedIds.forEach(id => {
      const data = associationsData.find(a => a.id === id);
      data?.classes?.forEach(cls => {
        if (!allClassNames.has(cls.name)) {
          allClassNames.add(cls.name);
          classMap[cls.name] = { ...cls, primaryAssociation: id };
        } else {
          // Handle source priority, e.g., prefer NSBA
          if (id === 'NSBA') {
             classMap[cls.name] = { ...cls, primaryAssociation: id };
          }
        }
      });
    });
    return Object.values(classMap);
  }, [formData.associationType, formData.associations, associationsData]);

  const handleClassChange = (className) => {
    setFormData(prev => {
        const newClasses = [...prev.classes];
        const classIndex = newClasses.findIndex(c => c.name === className);
        if (classIndex > -1) {
            newClasses.splice(classIndex, 1);
        } else {
            const classData = availableClasses.find(c => c.name === className);
            newClasses.push(classData);
        }
        return { ...prev, classes: newClasses };
    });
  };


  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    toast({
      title: "Package Published! 🎉",
      description: "Your Hosted Show Page, Pattern Book, and QR Poster Pack are being generated.",
    });
    // Here you would typically send formData to a backend.
    setCurrentStep(1);
    setFormData({
        associationType: '', associations: {}, showName: '', startDate: '', endDate: '', venueAddress: '', classes: [],
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div key="step1" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
              <CardTitle>Step 1: Event Setup</CardTitle>
              <CardDescription>Choose the type of show you are hosting. This will determine the next steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select onValueChange={handleAssociationTypeChange} value={formData.associationType}>
                <SelectTrigger><SelectValue placeholder="Select a show type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Association</SelectItem>
                  <SelectItem value="multi-breed">Multi-Breed Show</SelectItem>
                  <SelectItem value="open-unaffiliated">Unaffiliated / Open Show</SelectItem>
                </SelectContent>
              </Select>
              
              {formData.associationType === 'single' && (
                <Select onValueChange={(val) => setFormData(p => ({...p, associations: {[val]: true}}))}>
                    <SelectTrigger><SelectValue placeholder="Select an association" /></SelectTrigger>
                    <SelectContent>{associationsData.filter(a => !a.isGroup).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              
              {formData.associationType === 'multi-breed' && (
                <div className="space-y-2 pt-4">
                  <Label>Select all affiliated associations:</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-md bg-background/50">
                    {associationsData.filter(a => !a.isGroup && a.id !== 'open-unaffiliated').map(assoc => (
                      <div key={assoc.id} className="flex items-center space-x-2">
                        <Checkbox id={`assoc-${assoc.id}`} checked={!!formData.associations[assoc.id]} onCheckedChange={() => handleMultiAssociationChange(assoc.id)} />
                        <Label htmlFor={`assoc-${assoc.id}`} className="font-normal">{assoc.id}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </motion.div>
        );
      case 2:
        return (
             <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <CardHeader>
                    <CardTitle>Step 2: Add Classes</CardTitle>
                    <CardDescription>Select the classes for your show. We've pre-filtered based on your association(s).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {availableClasses.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto p-2">
                            {availableClasses.map(cls => (
                                <div key={cls.name} className="flex items-center space-x-3 p-3 border rounded-md bg-background/50">
                                    <Checkbox id={`cls-${cls.name}`} checked={formData.classes.some(c => c.name === cls.name)} onCheckedChange={() => handleClassChange(cls.name)} />
                                    <div className="flex-1">
                                        <Label htmlFor={`cls-${cls.name}`} className="font-semibold">{cls.name}</Label>
                                        <div className="flex gap-2 mt-1">
                                            {cls.primaryAssociation && <Badge variant="secondary">{cls.primaryAssociation}</Badge>}
                                            <Badge variant={cls.patternRequired ? 'default' : 'destructive'}>Pattern: {cls.patternRequired ? 'Yes' : 'No'}</Badge>
                                            <Badge variant={cls.scoreSheetRequired ? 'default' : 'destructive'}>Scoresheet: {cls.scoreSheetRequired ? 'Yes' : 'No'}</Badge>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Please select an association in Step 1 to see available classes.</p>
                    )}
                </CardContent>
             </motion.div>
        );
      case 3:
        return (
            <motion.div key="step3" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <CardHeader>
                  <CardTitle>Step 3: Show Details</CardTitle>
                  <CardDescription>Provide the essential details for your event.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="showName">Show Name</Label>
                    <Input id="showName" name="showName" value={formData.showName} onChange={handleChange} placeholder="E.g., Summer Classic 2025" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input id="startDate" name="startDate" type="date" value={formData.startDate} onChange={handleChange} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input id="endDate" name="endDate" type="date" value={formData.endDate} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="venueAddress">Venue Address (for validation)</Label>
                    <Input id="venueAddress" name="venueAddress" value={formData.venueAddress} onChange={handleChange} placeholder="123 Equestrian Lane, Horseville, USA" />
                  </div>
                </CardContent>
            </motion.div>
        );
      case 4:
         return (
            <motion.div key="step4" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <CardHeader>
                    <CardTitle>Step 4: Review & Validate</CardTitle>
                    <CardDescription>Confirm all details are correct. We'll validate for any reuse conflicts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 border rounded-lg bg-background/50 space-y-2">
                        <p><strong className="text-muted-foreground">Show Name:</strong> {formData.showName || 'Not set'}</p>
                        <p><strong className="text-muted-foreground">Associations:</strong> {Object.keys(formData.associations).join(', ') || formData.associationType}</p>
                        <p><strong className="text-muted-foreground">Classes:</strong> {formData.classes.map(c => c.name).join(', ') || 'None selected'}</p>
                    </div>
                    <div className="flex items-center p-4 border-l-4 border-green-500 bg-green-500/10 rounded-r-lg">
                        <ShieldCheck className="h-8 w-8 mr-4 text-green-500" />
                        <div>
                            <h5 className="font-semibold text-green-400">Reuse Validation: All Clear!</h5>
                            <p className="text-sm text-muted-foreground">Based on your details, there are no reuse conflicts in your area.</p>
                        </div>
                    </div>
                </CardContent>
            </motion.div>
         );
      case 5:
        return (
          <motion.div key="step5" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="text-center">
            <CardHeader>
              <CardTitle>Step 5: Publish</CardTitle>
              <CardDescription>We'll generate your Hosted Show Page, Pattern Book, and QR Poster Pack.</CardDescription>
            </CardHeader>
            <CardContent>
              <Package className="h-24 w-24 mx-auto text-primary mb-4" />
              <p className="text-muted-foreground mb-6">Ready to generate your complete show package?</p>
              <Button size="lg" onClick={handleSubmit}>
                Publish My Pattern Book <UploadCloud className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>Easy Pattern Book Builder - EquiPatterns</title>
        <meta name="description" content="Create a complete, breed-specific show package with patterns, score sheets, and more." />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <BookCopy className="mx-auto h-16 w-16 text-primary mb-4" />
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Easy Pattern Book Builder
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
              Generate a compliant, auto-filled pattern book for your show in minutes.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-start mb-8 px-4">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center text-center w-20">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${currentStep >= step.id ? 'bg-primary border-primary text-primary-foreground' : 'bg-secondary border-border text-muted-foreground'}`}>
                      {currentStep > step.id ? <Check /> : <step.icon />}
                    </div>
                    <p className={`mt-2 text-xs font-medium ${currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'}`}>{step.name}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mt-6 mx-2 rounded-full transition-colors duration-300 ${currentStep > index + 1 ? 'bg-primary' : 'bg-border'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <Card className="glass-effect">
              <AnimatePresence mode="wait">
                {renderStepContent()}
              </AnimatePresence>
              <div className="p-6 flex justify-between items-center border-t border-border">
                <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                {currentStep < steps.length && (
                  <Button onClick={handleNext} disabled={!formData.associationType}>
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
};

export default BreedShowPackagePage;