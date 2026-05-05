import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, CheckCircle, FileText, Users, Calendar, LayoutTemplate } from 'lucide-react';

export const Step6_Review = ({ formData, pricing, handlePurchase }) => {
  return (
    <motion.div key="step6" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader>
        <CardTitle>Step 6: Review & Purchase</CardTitle>
        <CardDescription>Confirm your selections. Your complete package is ready to be generated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 p-4 border rounded-lg bg-background/50">
            <h4 className="font-semibold text-lg flex items-center"><Calendar className="mr-2 h-5 w-5 text-primary" /> Show Details</h4>
            <p><strong className="text-muted-foreground">Name:</strong> {formData.showName || 'N/A'}</p>
            <p><strong className="text-muted-foreground">Dates:</strong> {formData.startDate || 'N/A'} to {formData.endDate || 'N/A'}</p>
            <p><strong className="text-muted-foreground">Venue:</strong> {formData.venueAddress || 'N/A'}</p>
          </div>
          <div className="space-y-4 p-4 border rounded-lg bg-background/50">
            <h4 className="font-semibold text-lg flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Associations & Classes</h4>
            <p><strong className="text-muted-foreground">Show Type:</strong> {formData.showType}</p>
            <p><strong className="text-muted-foreground">Associations:</strong> {Object.keys(formData.associations).join(', ') || 'N/A'}</p>
            <p><strong className="text-muted-foreground">Classes:</strong> {formData.classes.length} selected</p>
          </div>
        </div>
        <div className="space-y-4 p-4 border rounded-lg bg-background/50">
          <h4 className="font-semibold text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" /> Package Summary</h4>
          <div className="flex justify-between items-center">
            <span>{pricing.type}</span>
            <span>${(pricing.price / 100).toFixed(2)}</span>
          </div>
          {formData.officePackageUpgrade && (
            <div className="flex justify-between items-center text-primary">
              <span>Office Pro Package Upgrade</span>
              <span>Included</span>
            </div>
          )}
          <div className="flex justify-between items-center border-t pt-2 mt-2 font-bold text-xl">
            <span>Total</span>
            <span>${(pricing.price / 100).toFixed(2)}</span>
          </div>
        </div>
        <div className="space-y-4 p-4 border rounded-lg bg-background/50">
            <h4 className="font-semibold text-lg flex items-center"><LayoutTemplate className="mr-2 h-5 w-5 text-primary" /> Final Touches</h4>
            <p><strong className="text-muted-foreground">Layout Style:</strong> {formData.layoutSelection === 'layout-a' ? 'By Date' : 'By Discipline'}</p>
            <p><strong className="text-muted-foreground">Cover Page:</strong> {formData.coverPageOption === 'generate' ? 'Auto-Generated' : 'Custom Upload'}</p>
        </div>
        <div className="flex items-center p-4 border-l-4 border-green-500 bg-green-500/10 rounded-r-lg">
          <CheckCircle className="h-8 w-8 mr-4 text-green-500" />
          <div>
            <h5 className="font-semibold text-green-400">Ready to Go!</h5>
            <p className="text-sm text-muted-foreground">All selections are validated. Click below to add to cart and proceed to checkout.</p>
          </div>
        </div>
        <Button size="lg" className="w-full" onClick={handlePurchase}>
          <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart & Finalize - ${(pricing.price / 100).toFixed(2)}
        </Button>
      </CardContent>
    </motion.div>
  );
};