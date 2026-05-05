import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ClassConfiguration } from '@/components/pbb/ClassConfiguration';
import { useToast } from '@/components/ui/use-toast';

export const Step3_ConfigureClasses = ({ formData, setFormData }) => {
    const { toast } = useToast();
    const isOpenShowMode = formData.showType === 'open-unaffiliated' || !!formData.associations['open-show'];

    if (!formData || !formData.disciplines || formData.disciplines.length === 0) {
        return (
            <motion.div key="step3" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <CardHeader>
                    <CardTitle>Step 3: Configure Your Disciplines</CardTitle>
                    <CardDescription>Drag to reorder and expand to configure divisions, schedules, and patterns.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">No disciplines selected yet.</p>
                        <p className="text-sm text-muted-foreground mt-1">Go back to Step 2 to build your discipline list.</p>
                    </div>
                </CardContent>
            </motion.div>
        );
    }
    
    return (
        <motion.div key="step3" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 3: Configure Your Disciplines</CardTitle>
                <CardDescription>Drag to reorder and expand to configure divisions, schedules, and patterns.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <ClassConfiguration 
                    formData={formData} 
                    setFormData={setFormData} 
                    isOpenShowMode={isOpenShowMode} 
                    showScheduleOrganizer={true} 
                />
            </CardContent>
        </motion.div>
    );
};