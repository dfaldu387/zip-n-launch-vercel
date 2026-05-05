import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, Zap, Download, Search, Edit } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ScoreSheetsPage = () => {
  const [patternText, setPatternText] = useState('');
  const [selectedAssociation, setSelectedAssociation] = useState('');
  const [generatedSheet, setGeneratedSheet] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const associations = [
    { id: 'aqha', name: 'AQHA' }, { id: 'apha', name: 'APHA' }, { id: 'nsba', name: 'NSBA' }, { id: 'nrha', name: 'NRHA' }, { id: 'usef', name: 'USEF' }
  ];

  const handleParsePattern = () => {
    if (!patternText.trim() || !selectedAssociation) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please provide pattern text and select an association." });
      return;
    }
    const mockSheet = {
      association: associations.find(a => a.id === selectedAssociation),
      pattern: patternText,
      sections: [
        { name: 'Maneuver 1', description: 'Enter at walk, track left at jog', maxScore: 10 },
        { name: 'Maneuver 2', description: 'Lope left lead, continue around arena', maxScore: 10 },
        { name: 'Maneuver 3', description: 'Extend lope, return to normal', maxScore: 10 },
        { name: 'Maneuver 4', description: 'Simple change to right lead', maxScore: 10 },
        { name: 'Maneuver 5', description: 'Continue at lope', maxScore: 10 }
      ],
    };
    setGeneratedSheet(mockSheet);
    setIsEditing(false);
    toast({ title: "Score Sheet Generated!", description: `Successfully parsed pattern for ${mockSheet.association.name}` });
  };

  const handleDownloadSheet = () => {
    toast({ title: "🚧 Download feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀" });
  };

  const handleSectionChange = (index, field, value) => {
    const newSections = [...generatedSheet.sections];
    newSections[index][field] = value;
    setGeneratedSheet(prev => ({ ...prev, sections: newSections }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">AI Score Sheets</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Paste pattern instructions to auto-generate an official, editable score sheet for any association.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="space-y-6">
            <Card className="bg-secondary border-border">
              <CardHeader>
                <CardTitle>1. Input Pattern</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select onValueChange={setSelectedAssociation} value={selectedAssociation}>
                  <SelectTrigger><SelectValue placeholder="Select Association Format" /></SelectTrigger>
                  <SelectContent>{associations.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
                <Textarea placeholder="Paste complete pattern instructions here..." value={patternText} onChange={(e) => setPatternText(e.target.value)} className="min-h-[200px]" />
                <Button onClick={handleParsePattern} className="w-full" disabled={!patternText.trim() || !selectedAssociation}>
                  <Zap className="h-4 w-4 mr-2" /> Generate with AI
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="sticky top-24">
            <Card className="bg-secondary border-border">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>2. Review & Edit</CardTitle>
                  {generatedSheet && !isEditing && <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}><Edit className="h-4 w-4 mr-2" /> Edit</Button>}
                  {generatedSheet && isEditing && <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Done</Button>}
                </div>
                <CardDescription>AI-parsed score sheet. Edit if needed, then download.</CardDescription>
              </CardHeader>
              <CardContent>
                {!generatedSheet ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Your score sheet will appear here</h3>
                    <p className="text-sm">Input your pattern and select an association to begin.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center border-b border-border pb-4">
                      <h2 className="text-xl font-bold text-foreground">{generatedSheet.association.name} Score Sheet</h2>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                      {generatedSheet.sections.map((section, index) => (
                        <div key={index} className="p-3 bg-background rounded-lg border border-border">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input value={section.name} onChange={(e) => handleSectionChange(index, 'name', e.target.value)} className="text-sm font-semibold" />
                              <Textarea value={section.description} onChange={(e) => handleSectionChange(index, 'description', e.target.value)} className="text-xs" rows={2} />
                              <Input type="number" value={section.maxScore} onChange={(e) => handleSectionChange(index, 'maxScore', e.target.value)} className="w-20 text-sm" />
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-semibold">{section.name}</p>
                                <p className="text-sm text-muted-foreground">{section.description}</p>
                              </div>
                              <p className="font-semibold text-lg">/ {section.maxScore}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button onClick={handleDownloadSheet} className="w-full" disabled={isEditing}>
                      <Download className="h-4 w-4 mr-2" /> Download Fillable PDF
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ScoreSheetsPage;