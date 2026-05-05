import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CreditCard, Mail, Check, ArrowLeft, Building2, Lock } from 'lucide-react';
import { generatePatternBookPdf } from '@/lib/bookGenerator';
import { supabase } from '@/lib/supabaseClient';
import { useAnalytics } from '@/components/AnalyticsProvider';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const GenerateBookDialog = ({ open, onOpenChange, pbbData }) => {
  const [email, setEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [dialogStep, setDialogStep] = useState(1);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const { toast } = useToast();
  const { trackPatternEvent, trackBehaviorEvent } = useAnalytics();

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setDialogStep(1);
      setEmail('');
      setPaymentMethod('card');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setCardName('');
    }
    onOpenChange(isOpen);
  };

  const handlePayment = async () => {
    setIsProcessingPayment(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    trackBehaviorEvent('pbb_payment_processed', {
      showName: pbbData.showName,
      paymentMethod,
    });
    
    toast({
      title: 'Payment Successful',
      description: 'Your payment has been processed successfully.',
    });
    
    setIsProcessingPayment(false);
    setDialogStep(2);
  };

  const handleSend = async () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email required',
        description: 'Please enter an email address to send the book to.',
      });
      return;
    }

    setIsGenerating(true);
    const startTime = Date.now();
    
    try {
      toast({ title: 'Generating PDF...', description: 'Your pattern book is being created.' });

      const pdfDataUri = await generatePatternBookPdf(pbbData);

      trackPatternEvent('download', {
        patternId: pbbData.id,
        discipline: pbbData.disciplines?.map(d => d.name).join(', '),
        associationId: Object.keys(pbbData.associations || {}).filter(k => pbbData.associations[k]).join(', '),
        timeSpent: Math.round((Date.now() - startTime) / 1000),
      });

      const link = document.createElement('a');
      link.href = pdfDataUri;
      link.download = (pbbData.showName || 'Pattern-Book').replace(/ /g, '_') + '.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const { data, error } = await supabase.functions.invoke('send-pattern-book', {
        body: JSON.stringify({ email, pdfDataUri, bookName: pbbData.showName || 'My Pattern Book' }),
      });

      if (error || data?.error) throw new Error(error?.message || data?.error);

      toast({ title: 'Success!', description: `Pattern book sent to ${email} and downloaded.` });
      handleOpenChange(false);

    } catch (error) {
      console.error('Failed to generate or send book:', error);
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: error.message || 'There was a problem generating or sending your book.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const disciplineCount = (pbbData.disciplines || []).length;
  const customClassCount = (pbbData.disciplines || []).filter(d => d.isCustom).length;
  const basePrice = 49.99;
  const customFee = customClassCount * 50;
  const totalPrice = basePrice + customFee;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-2">
          <div className={`flex items-center gap-2 ${dialogStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${dialogStep > 1 ? 'bg-green-500 text-white' : dialogStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {dialogStep > 1 ? <Check className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            </div>
            <span className="text-sm font-medium">Payment</span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className={`flex items-center gap-2 ${dialogStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${dialogStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <Mail className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">Generate & Email</span>
          </div>
        </div>

        {dialogStep === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Complete Payment</DialogTitle>
              <DialogDescription>Choose your payment method and complete the purchase.</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pattern Book ({disciplineCount} disciplines)</span>
                    <span>${basePrice.toFixed(2)}</span>
                  </div>
                  {customClassCount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custom Classes ({customClassCount})</span>
                      <span>${customFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary">${totalPrice.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-3">
                <Label
                  htmlFor="card"
                  className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                >
                  <RadioGroupItem value="card" id="card" className="sr-only" />
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs font-medium">Card</span>
                </Label>
                <Label
                  htmlFor="bank"
                  className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${paymentMethod === 'bank' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                >
                  <RadioGroupItem value="bank" id="bank" className="sr-only" />
                  <Building2 className="h-5 w-5" />
                  <span className="text-xs font-medium">Bank</span>
                </Label>
              </RadioGroup>

              {paymentMethod === 'card' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="cardName" className="text-xs">Cardholder Name</Label>
                    <Input id="cardName" placeholder="John Doe" value={cardName} onChange={(e) => setCardName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="cardNumber" className="text-xs">Card Number</Label>
                    <Input id="cardNumber" placeholder="4242 4242 4242 4242" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} maxLength={19} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cardExpiry" className="text-xs">Expiry</Label>
                      <Input id="cardExpiry" placeholder="MM/YY" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} maxLength={5} />
                    </div>
                    <div>
                      <Label htmlFor="cardCvv" className="text-xs">CVV</Label>
                      <Input id="cardCvv" placeholder="123" type="password" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'bank' && (
                <div className="text-center py-4 border rounded-lg bg-muted/30">
                  <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">You will be redirected to your bank's secure payment page.</p>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Secured with 256-bit SSL encryption</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isProcessingPayment}>Cancel</Button>
              <Button onClick={handlePayment} disabled={isProcessingPayment}>
                {isProcessingPayment ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <>Pay ${totalPrice.toFixed(2)}</>}
              </Button>
            </DialogFooter>
          </>
        )}

        {dialogStep === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                Payment Complete
              </DialogTitle>
              <DialogDescription>Enter your email to receive the generated pattern book.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="email">Your Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={isGenerating}
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDialogStep(1)} disabled={isGenerating}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleSend} disabled={isGenerating || !email}>
                {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : 'Generate Pattern'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
    
export default GenerateBookDialog;
