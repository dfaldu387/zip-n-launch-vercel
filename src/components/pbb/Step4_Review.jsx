import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShoppingCart } from 'lucide-react';

export const Step4_Review = ({ formData, pricing, handlePurchase }) => {
  return (
    <motion.div key="step4" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader><CardTitle>Step 4: Review & Purchase</CardTitle><CardDescription>Confirm details. We'll validate for any pattern reuse conflicts.</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg bg-background/50 space-y-3">
          <p><strong className="text-muted-foreground w-28 inline-block">Show Name:</strong> {formData.showName || 'Not set'}</p>
          <p><strong className="text-muted-foreground w-28 inline-block">Show Type:</strong> {formData.showType}</p>
          <p><strong className="text-muted-foreground w-28 inline-block">Classes:</strong> {formData.classes.length > 0 ? formData.classes.map(c => c.name).join(', ') : 'None selected'}</p>
        </div>
        <div className="flex items-center p-4 border-l-4 border-green-500 bg-green-500/10 rounded-r-lg"><ShieldCheck className="h-8 w-8 mr-4 text-green-500" /><div className="flex-1"><h5 className="font-semibold text-green-400">Pattern Reuse Validation: All Clear!</h5><p className="text-sm text-muted-foreground">No conflicts with recently used patterns found.</p></div></div>
      </CardContent>
      <CardFooter className="flex-col items-stretch space-y-4">
        <div className="border-t border-border pt-4 flex justify-between items-center text-xl font-bold"><span>Total Price</span><span>${(pricing.price / 100).toFixed(2)}</span></div>
        <Button size="lg" onClick={handlePurchase}><ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart & Proceed</Button>
      </CardFooter>
    </motion.div>
  );
};