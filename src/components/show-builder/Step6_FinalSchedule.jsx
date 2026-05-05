import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Step5_Schedule } from '@/components/show-builder/Step5_Schedule';

export const Step6_FinalSchedule = ({ formData, setFormData }) => {
    return (
        <motion.div key="step6" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 7: Save & Manage</CardTitle>
                <CardDescription>
                    Drag disciplines onto the schedule grid. You can also add breaks, drags, and other events. 
                    Click and drag the bottom edge of an event to resize it.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Step5_Schedule formData={formData} setFormData={setFormData} />
            </CardContent>
        </motion.div>
    );
};