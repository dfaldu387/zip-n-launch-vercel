import React, { useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, FileSignature, Users, Settings, Info, RotateCcw } from 'lucide-react';
import {
  DEFAULT_CONTRACT_TEMPLATE,
  PlaceholderToolbar,
  flattenPersonnel,
  countPlaceholders,
} from '@/lib/contractUtils';

export const Step3_ContractTemplate = ({ formData, setFormData }) => {
  const textareaRef = useRef(null);

  const contractBuilder = formData.contractBuilder || { globalTemplate: '', employeeOverrides: {} };
  const globalTemplate = contractBuilder.globalTemplate || '';
  const contractSettings = formData.contractSettings || {};

  // Lazily initialize template
  useEffect(() => {
    if (!formData.contractBuilder?.globalTemplate) {
      setFormData(prev => ({
        ...prev,
        contractBuilder: {
          ...prev.contractBuilder,
          globalTemplate: DEFAULT_CONTRACT_TEMPLATE,
        },
      }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const personnel = useMemo(() => flattenPersonnel(formData), [formData.showDetails?.officials]);
  const placeholderCount = useMemo(() => countPlaceholders(globalTemplate), [globalTemplate]);

  const updateGlobalTemplate = (text) => {
    setFormData(prev => ({
      ...prev,
      contractBuilder: { ...prev.contractBuilder, globalTemplate: text },
    }));
  };

  const resetGlobalTemplate = () => {
    setFormData(prev => ({
      ...prev,
      contractBuilder: { ...prev.contractBuilder, globalTemplate: DEFAULT_CONTRACT_TEMPLATE },
    }));
  };

  const insertPlaceholder = (tag) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = globalTemplate.substring(0, start) + tag + globalTemplate.substring(end);
    updateGlobalTemplate(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + tag.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleSettingChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      contractSettings: { ...prev.contractSettings, [field]: value },
    }));
  };

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-primary" />
          Step 3: Contract Template
        </CardTitle>
        <CardDescription>
          Create a reusable contract template with dynamic placeholders. This template will be used to generate individual contracts in the next step.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0 space-y-6">
        {/* Personnel Banner */}
        {personnel.length > 0 ? (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{personnel.length} Personnel from Step 2</p>
                <p className="text-sm text-muted-foreground">
                  Placeholders below will auto-populate with each employee's data when contracts are generated.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 bg-amber-500/10 border-amber-500/30">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-600">No Personnel Yet</p>
                <p className="text-sm text-muted-foreground">
                  Go back to Step 2 to add officials & staff. You can still build your template now.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Template Editor */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Contract Template</h4>
              <Badge variant="secondary" className="text-xs">
                {placeholderCount} placeholder{placeholderCount !== 1 ? 's' : ''} used
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={resetGlobalTemplate}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset to Default
            </Button>
          </div>

          <p className="text-sm text-muted-foreground -mt-2">
            Write your contract language below. Click placeholder tags to insert dynamic fields that auto-populate per employee.
          </p>

          <PlaceholderToolbar onInsert={insertPlaceholder} />

          <Textarea
            ref={textareaRef}
            value={globalTemplate}
            onChange={(e) => updateGlobalTemplate(e.target.value)}
            className="min-h-[500px] font-mono text-sm leading-relaxed"
            placeholder="Start writing your contract template..."
          />
        </Card>

        {/* Contract Settings */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">Contract Settings</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">Effective Date</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={contractSettings.effectiveDate || ''}
                onChange={(e) => handleSettingChange('effectiveDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expirationDate">Expiration Date</Label>
              <Input
                id="expirationDate"
                type="date"
                value={contractSettings.expirationDate || ''}
                onChange={(e) => handleSettingChange('expirationDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={contractSettings.paymentMethod || 'check'}
                onValueChange={(value) => handleSettingChange('paymentMethod', value)}
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="direct_deposit">Direct Deposit</SelectItem>
                  <SelectItem value="wire">Wire Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signingDeadline">Signing Deadline</Label>
              <Input
                id="signingDeadline"
                type="date"
                value={contractSettings.signingDeadline || ''}
                onChange={(e) => handleSettingChange('signingDeadline', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalTerms">Additional Terms & Conditions</Label>
            <Textarea
              id="additionalTerms"
              placeholder="Enter any additional terms or special conditions..."
              value={contractSettings.additionalTerms || ''}
              onChange={(e) => handleSettingChange('additionalTerms', e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </Card>

        {/* Summary */}
        <Card className="p-4 border-2 border-dashed">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">Template Summary</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {placeholderCount} placeholder{placeholderCount !== 1 ? 's' : ''} &bull; {personnel.length} employee{personnel.length !== 1 ? 's' : ''} ready
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{personnel.length}</p>
              <p className="text-xs text-muted-foreground">Contracts to generate</p>
            </div>
          </div>
        </Card>
      </CardContent>
    </motion.div>
  );
};
