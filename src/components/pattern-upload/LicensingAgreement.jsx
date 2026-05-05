import React from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
const LicensingAgreement = ({
  agreedToTerms,
  setAgreedToTerms
}) => {
  return <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><FileText className="mr-2 h-6 w-6 text-primary" /> Licensing & Agreement</CardTitle>
        <CardDescription>Please review and agree to the terms before submitting.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-background/50 border p-4 rounded-lg text-xs text-muted-foreground max-h-40 overflow-y-auto mb-4">
          <p>By submitting content, you confirm that you are the original creator of the submitted materials ("Creator Content") and that you have the legal right to grant this license. You retain ownership of your Creator Content.</p>
          <p className="mt-2">You grant EquiPatterns a non-exclusive, worldwide license to host, display, distribute, and incorporate your Creator Content within the EquiPatterns platform, including use in pattern books, events, and platform tools, subject to applicable policies.</p>
          <p className="mt-2">Creators may be eligible for Creator Benefits, which may include platform credits, membership discounts, promotional placement, analytics access, early feature access, or other non-monetary incentives, as described in the Creator Content & Benefits Policy.</p>
          <p className="mt-2">Submission of Creator Content does not guarantee financial compensation. Any future revenue participation or royalty programs, if offered, will apply only to paid transactions and will be governed by separate terms.</p>
          <p className="mt-2">EquiPatterns reserves the right to review, approve, reject, or remove submissions at its discretion.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="terms" checked={agreedToTerms} onCheckedChange={setAgreedToTerms} />
          <label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            I have read and agree to the licensing terms.
          </label>
        </div>
      </CardContent>
    </Card>;
};
export default LicensingAgreement;