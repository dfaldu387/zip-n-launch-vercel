import React, { useState } from 'react';
import { UploadCloud, Sparkles, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';

export const ScheduleUploader = ({
  formData,
  setFormData,
  onSmartSuggestions
}) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Starting...');

  const handleFileChange = e => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleAiProcessing(file);
    }
  };

  const handleAiProcessing = async (file) => {
    setIsProcessing(true);
    setProgress(0);
    setStatusMessage("Uploading file...");

    try {
        const body = new FormData();
        body.append('schedule', file);
        
        setProgress(20);
        setStatusMessage("Invoking AI Assistant...");
        
        const { data, error } = await supabase.functions.invoke('schedule-parser', { body });
        
        setProgress(80);
        setStatusMessage("Finalizing analysis...");

        if (error) {
            let errorMessage = error.message;
            try {
                const errorJson = JSON.parse(error.message.substring(error.message.indexOf('{')));
                errorMessage = errorJson.error || error.message;
            } catch (e) {
                // Not a JSON error, use original message
            }
            throw new Error(errorMessage);
        }
        
        setProgress(100);
        const { associations, classes, unrecognizedCount } = data;

        setFormData(prev => ({
            ...prev,
            showScheduleFile: file,
            hasAiSuggestions: true,
            associations: associations.reduce((acc, assocId) => ({ ...acc, [assocId]: true }), prev.associations),
        }));

        toast({
            title: "AI Analysis Complete!",
            description: `Found ${associations.length} associations, ${classes.length} classes, and ${unrecognizedCount} unrecognized terms.`,
            variant: 'default'
        });

        if (onSmartSuggestions) onSmartSuggestions(data);

    } catch (error) {
        console.error('AI Processing Error:', error);
        toast({
            title: "AI Processing Failed",
            description: error.message || "Could not process the schedule file.",
            variant: 'destructive',
            duration: 8000
        });
    } finally {
        setIsProcessing(false);
        const fileInput = document.getElementById('schedule-upload');
        if (fileInput) fileInput.value = '';
    }
  };
  
  return (
    <div className="border-2 border-dashed rounded-lg p-6 bg-primary/5 border-primary/20 text-center">
      <Sparkles className="mx-auto h-10 w-10 text-primary mb-3" />
      <h3 className="text-xl font-bold tracking-tight">Let’s speed things up</h3>
      <p className="text-muted-foreground mb-4">Equipatterns.com will extract classes, dates, and details to pre-fill the builder. </p>
      {isProcessing ? (
        <div className="w-full max-w-sm mx-auto text-left">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm font-medium text-primary">{statusMessage}</p>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      ) : formData.showScheduleFile ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-3 text-green-600 font-semibold">
            <FileText className="h-5 w-5" />
            <span>{formData.showScheduleFile.name}</span>
            <Button variant="ghost" size="sm" onClick={() => {
              setFormData(p => ({ ...p, showScheduleFile: null, hasAiSuggestions: false }));
            }}>Change</Button>
          </div>
        </motion.div>
      ) : (
        <Button asChild>
          <Label htmlFor="schedule-upload" className="cursor-pointer">
            <UploadCloud className="mr-2 h-4 w-4" /> Upload Show Schedule (PDF/Excel)
            <Input id="schedule-upload" type="file" className="sr-only" accept=".pdf,.xlsx,.xls" onChange={handleFileChange} />
          </Label>
        </Button>
      )}

      <div className="mt-4 flex items-center justify-center space-x-2">
        <Checkbox id="include-schedule" checked={formData.includeScheduleInBook} onCheckedChange={c => setFormData(p => ({ ...p, includeScheduleInBook: c }))} />
        <Label htmlFor="include-schedule" className="text-sm font-medium text-muted-foreground">Include uploaded schedule in final pattern book</Label>
      </div>
    </div>
  );
};