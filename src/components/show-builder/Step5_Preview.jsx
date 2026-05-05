import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Eye } from 'lucide-react';

export const Step5_Preview = ({ formData }) => {
  return (
    <motion.div key="step5" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader>
        <CardTitle>Step 7: Save & Manage</CardTitle>
        <CardDescription>Review a preview of your generated show bill before finalizing.</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertTitle>Coming Soon!</AlertTitle>
          <AlertDescription>
            A live preview of your show bill will be available here.
          </AlertDescription>
        </Alert>
        <div className="mt-4 p-4 border rounded-lg bg-secondary/30">
            <h3 className="font-bold text-lg">{formData.showName || "Your Show Name"}</h3>
            <p className="text-sm text-muted-foreground">{formData.venueAddress || "Venue Address"}</p>
            <p className="text-sm text-muted-foreground">Dates: {formData.startDate} to {formData.endDate || formData.startDate}</p>
            <div className="mt-4">
                <h4 className="font-semibold">Classes:</h4>
                <ul className="list-disc pl-5 text-sm">
                    {formData.classes.map(c => <li key={c.id}>{c.name}</li>)}
                </ul>
            </div>
        </div>
      </CardContent>
    </motion.div>
  );
};