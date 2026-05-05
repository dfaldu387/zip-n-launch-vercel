import React, { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle, DollarSign, Save, Link2, Download, Send,
  AlertTriangle, ShieldCheck, Archive, CalendarCheck, FolderOpen, FileText,
  PlayCircle, Loader2, ArrowRight,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { flattenPersonnel } from '@/lib/contractUtils';

const REQUIRED_DOC_IDS = ['signed_contract', 'w9_form', 'association_member_id', 'emergency_contact'];

const closeOutItems = [
  { id: 'all_signed', label: 'All contracts signed and approved', required: true, icon: ShieldCheck },
  { id: 'all_docs_collected', label: 'All required documents collected from employees', required: true, icon: FileText },
  { id: 'payment_confirmed', label: 'Payment terms confirmed and payment received/scheduled', required: true, icon: DollarSign },
  { id: 'copies_distributed', label: 'Copies distributed to all parties', required: true, icon: Send },
  { id: 'saved_to_project', label: 'Finalized contracts saved within the Horse Show project', required: true, icon: Save },
  { id: 'linked_to_personnel', label: 'Contracts linked to personnel records', required: true, icon: Link2 },
  { id: 'schedule_confirmed', label: 'Schedules confirmed with all personnel', required: false, icon: CalendarCheck },
  { id: 'archived', label: 'Original documents archived for records', required: false, icon: Archive },
];

const PAYMENT_STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', className: 'bg-red-500/10 text-red-600 border-red-600/30', icon: AlertTriangle },
  partial: { label: 'Partial', className: 'bg-amber-500/10 text-amber-600 border-amber-600/30', icon: DollarSign },
  confirmed: { label: 'Confirmed', className: 'bg-green-500/10 text-green-600 border-green-600/30', icon: ShieldCheck },
};

export const Step6_CloseOut = ({ formData, setFormData, onSave, isSaving }) => {
  const { toast } = useToast();
  const [selectedPath, setSelectedPath] = useState(formData.projectStatus === 'live' ? 'live' : null);
  const [savingLive, setSavingLive] = useState(false);
  const checkedItems = formData.closeOutChecklist || [];
  const paymentStatus = formData.paymentStatus || 'unpaid';
  const isPaymentConfirmed = paymentStatus === 'confirmed';

  // Approval & document status from employee folders
  const approvalStats = useMemo(() => {
    const personnel = flattenPersonnel(formData);
    const folders = formData.employeeFolders || {};
    const total = personnel.length;
    const approved = personnel.filter(m => folders[m.id]?.signatureStatus === 'approved').length;
    const docsCollected = personnel.filter(m => {
      const docs = folders[m.id]?.documents;
      if (!docs) return false;
      return REQUIRED_DOC_IDS.every(id => docs[id]?.status === 'complete');
    }).length;
    return {
      total,
      approved,
      allApproved: total > 0 && approved === total,
      docsCollected,
      allDocsCollected: total > 0 && docsCollected === total,
    };
  }, [formData.showDetails?.officials, formData.employeeFolders]);

  const requiredItems = closeOutItems.filter(i => i.required);
  const allRequiredComplete = requiredItems.every(i => checkedItems.includes(i.id));
  const progress = closeOutItems.length > 0 ? (checkedItems.length / closeOutItems.length) * 100 : 0;

  // Auto-check all_signed when all contracts are approved
  useEffect(() => {
    if (approvalStats.allApproved && !checkedItems.includes('all_signed')) {
      setFormData(prev => ({
        ...prev,
        closeOutChecklist: [...(prev.closeOutChecklist || []), 'all_signed'],
      }));
    }
    if (!approvalStats.allApproved && checkedItems.includes('all_signed')) {
      setFormData(prev => ({
        ...prev,
        closeOutChecklist: (prev.closeOutChecklist || []).filter(id => id !== 'all_signed'),
      }));
    }
  }, [approvalStats.allApproved]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-check all_docs_collected when all documents are collected
  useEffect(() => {
    if (approvalStats.allDocsCollected && !checkedItems.includes('all_docs_collected')) {
      setFormData(prev => ({
        ...prev,
        closeOutChecklist: [...(prev.closeOutChecklist || []), 'all_docs_collected'],
      }));
    }
    if (!approvalStats.allDocsCollected && checkedItems.includes('all_docs_collected')) {
      setFormData(prev => ({
        ...prev,
        closeOutChecklist: (prev.closeOutChecklist || []).filter(id => id !== 'all_docs_collected'),
      }));
    }
  }, [approvalStats.allDocsCollected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-check payment_confirmed when payment status changes
  useEffect(() => {
    if (isPaymentConfirmed && !checkedItems.includes('payment_confirmed')) {
      setFormData(prev => ({
        ...prev,
        closeOutChecklist: [...(prev.closeOutChecklist || []), 'payment_confirmed'],
      }));
    }
    if (!isPaymentConfirmed && checkedItems.includes('payment_confirmed')) {
      setFormData(prev => ({
        ...prev,
        closeOutChecklist: (prev.closeOutChecklist || []).filter(id => id !== 'payment_confirmed'),
      }));
    }
  }, [isPaymentConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleItem = (itemId) => {
    // Don't allow manual toggle for auto-managed items
    if (itemId === 'all_signed' || itemId === 'all_docs_collected' || itemId === 'payment_confirmed' || itemId === 'saved_to_project' || itemId === 'linked_to_personnel') return;

    setFormData(prev => {
      const current = prev.closeOutChecklist || [];
      if (current.includes(itemId)) {
        return { ...prev, closeOutChecklist: current.filter(id => id !== itemId) };
      }
      return { ...prev, closeOutChecklist: [...current, itemId] };
    });
  };

  const handlePaymentStatusChange = (newStatus) => {
    if (newStatus === 'confirmed' && !approvalStats.allApproved) {
      toast({
        title: 'Cannot Confirm Payment',
        description: 'All contracts must be approved before confirming payment.',
        variant: 'destructive',
      });
      return;
    }
    setFormData(prev => ({
      ...prev,
      paymentStatus: newStatus,
      paymentConfirmedAt: newStatus === 'confirmed' ? new Date().toISOString() : prev.paymentConfirmedAt,
    }));
  };

  const handleSaveToProject = () => {
    setFormData(prev => {
      const newChecklist = prev.closeOutChecklist || [];
      return {
        ...prev,
        savedToProject: true,
        closeOutChecklist: newChecklist.includes('saved_to_project')
          ? newChecklist
          : [...newChecklist, 'saved_to_project'],
      };
    });
    toast({ title: 'Contracts Saved', description: 'Finalized contracts saved to the Horse Show project.' });
  };

  const handleLinkToPersonnel = () => {
    setFormData(prev => {
      const newChecklist = prev.closeOutChecklist || [];
      return {
        ...prev,
        linkedToPersonnel: true,
        closeOutChecklist: newChecklist.includes('linked_to_personnel')
          ? newChecklist
          : [...newChecklist, 'linked_to_personnel'],
      };
    });
    toast({ title: 'Contracts Linked', description: 'Contracts linked to personnel records.' });
  };

  const handleCompleteCloseOut = () => {
    setFormData(prev => ({ ...prev, projectStatus: 'closed' }));
    toast({ title: 'Close Out Complete', description: 'All contracts have been finalized and closed out successfully.' });
  };

  const handleSaveLive = async () => {
    if (!onSave) return;
    setSavingLive(true);
    try {
      setFormData(prev => ({ ...prev, projectStatus: 'live' }));
      await onSave({ silent: true });
      toast({
        title: 'Project Saved as Live',
        description: 'Your project is saved and active. You can return anytime to manage contracts, track sending, and resume where you left off.',
      });
      setSelectedPath('live');
    } finally {
      setSavingLive(false);
    }
  };

  const paymentCfg = PAYMENT_STATUS_CONFIG[paymentStatus] || PAYMENT_STATUS_CONFIG.unpaid;
  const PaymentIcon = paymentCfg.icon;

  return (
    <motion.div
      key="step6"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          Step 6: Save & Manage
        </CardTitle>
        <CardDescription>
          Choose how to proceed — keep your project active for ongoing management, or finalize everything and close out.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0 space-y-6">
        {/* Two-Path Choice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Save as Live */}
          <Card
            className={`p-5 cursor-pointer transition-all hover:shadow-md ${
              selectedPath === 'live'
                ? 'border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20'
                : 'hover:border-blue-500/50'
            }`}
            onClick={() => setSelectedPath('live')}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <PlayCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Save as Live Project</h4>
                  <p className="text-xs text-muted-foreground">Keep project active & ongoing</p>
                </div>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 pl-1">
                <li className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />Save progress and return anytime</li>
                <li className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />Continue sending & tracking contracts</li>
                <li className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />Manage documents and signatures</li>
                <li className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />Resume from where you left off</li>
              </ul>
              {selectedPath === 'live' && (
                <Button
                  className="w-full mt-2"
                  onClick={(e) => { e.stopPropagation(); handleSaveLive(); }}
                  disabled={savingLive || isSaving}
                >
                  {savingLive ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {formData.projectStatus === 'live' ? 'Saved as Live' : 'Save as Live Project'}
                </Button>
              )}
              {formData.projectStatus === 'live' && (
                <p className="text-xs text-blue-600 font-medium flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Project is currently live
                </p>
              )}
            </div>
          </Card>

          {/* Option 2: Complete Close Out */}
          <Card
            className={`p-5 cursor-pointer transition-all hover:shadow-md ${
              selectedPath === 'closeout'
                ? 'border-green-500 bg-green-500/5 ring-2 ring-green-500/20'
                : 'hover:border-green-500/50'
            }`}
            onClick={() => setSelectedPath('closeout')}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Complete Close Out</h4>
                  <p className="text-xs text-muted-foreground">Finalize & archive everything</p>
                </div>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 pl-1">
                <li className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />Confirm all payments are complete</li>
                <li className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />Verify all documents collected</li>
                <li className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />Save & link to personnel records</li>
                <li className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />Download final package & archive</li>
              </ul>
            </div>
          </Card>
        </div>

        {/* Close Out Details — only shown when Close Out path is selected */}
        {selectedPath === 'closeout' && (
        <>
        {/* Approval & Document Status Banners */}
        <div className="space-y-3">
          <Card className={`p-4 ${approvalStats.allApproved ? 'bg-green-500/5 border-green-500/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
            <div className="flex items-center gap-3">
              {approvalStats.allApproved ? (
                <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${approvalStats.allApproved ? 'text-green-600' : 'text-amber-600'}`}>
                  {approvalStats.allApproved
                    ? 'All Contracts Approved — Eligible for Payment'
                    : `${approvalStats.approved} of ${approvalStats.total} Contracts Approved`}
                </p>
                {!approvalStats.allApproved && (
                  <p className="text-sm text-muted-foreground">
                    All contracts must be approved in Step 4 before confirming payment.
                  </p>
                )}
              </div>
              <Badge className={approvalStats.allApproved
                ? 'bg-green-500/10 text-green-600 border-green-600/30'
                : 'bg-amber-500/10 text-amber-600 border-amber-600/30'}>
                {approvalStats.approved}/{approvalStats.total}
              </Badge>
            </div>
          </Card>

          <Card className={`p-4 ${approvalStats.allDocsCollected ? 'bg-green-500/5 border-green-500/30' : 'bg-blue-500/5 border-blue-500/30'}`}>
            <div className="flex items-center gap-3">
              {approvalStats.allDocsCollected ? (
                <FolderOpen className="h-5 w-5 text-green-500 shrink-0" />
              ) : (
                <FolderOpen className="h-5 w-5 text-blue-500 shrink-0" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${approvalStats.allDocsCollected ? 'text-green-600' : 'text-blue-600'}`}>
                  {approvalStats.allDocsCollected
                    ? 'All Documents Collected'
                    : `${approvalStats.docsCollected} of ${approvalStats.total} Personnel — Documents Complete`}
                </p>
                {!approvalStats.allDocsCollected && (
                  <p className="text-sm text-muted-foreground">
                    Collect remaining documents in Step 5 (Track & Documents).
                  </p>
                )}
              </div>
              <Badge className={approvalStats.allDocsCollected
                ? 'bg-green-500/10 text-green-600 border-green-600/30'
                : 'bg-blue-500/10 text-blue-600 border-blue-600/30'}>
                {approvalStats.docsCollected}/{approvalStats.total}
              </Badge>
            </div>
          </Card>
        </div>

        {/* Payment Status */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Payment Status</h4>
            </div>
            <Badge className={`${paymentCfg.className}`}>
              <PaymentIcon className="h-3 w-3 mr-1" />
              {paymentCfg.label}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={handlePaymentStatusChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial Payment</SelectItem>
                  <SelectItem value="confirmed" disabled={!approvalStats.allApproved}>
                    Payment Confirmed {!approvalStats.allApproved ? '(requires approval)' : ''}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Notes</Label>
              <Textarea
                value={formData.paymentNotes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentNotes: e.target.value }))}
                placeholder="Add payment notes or reference numbers..."
                className="min-h-[60px]"
              />
            </div>
          </div>

          {formData.paymentConfirmedAt && isPaymentConfirmed && (
            <p className="text-xs text-green-600">
              Payment confirmed on {new Date(formData.paymentConfirmedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}

          {!isPaymentConfirmed && (
            <Card className="p-3 bg-amber-500/10 border-amber-500/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {!approvalStats.allApproved
                    ? 'All contracts must be approved before payment can be confirmed. Go to Step 4 to approve contracts.'
                    : 'Download and sending features require payment confirmation. Update the payment status above to enable these actions.'}
                </p>
              </div>
            </Card>
          )}
        </Card>

        {/* Progress Bar */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Close Out Progress</h4>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {checkedItems.length} of {closeOutItems.length} items completed
          </p>
        </Card>

        {/* Checklist */}
        <Card className="p-5 space-y-3">
          <h4 className="font-semibold mb-2">Close Out Checklist</h4>
          <div className="space-y-2">
            {closeOutItems.map((item) => {
              const isChecked = checkedItems.includes(item.id);
              const isAutoManaged = ['all_signed', 'all_docs_collected', 'payment_confirmed', 'saved_to_project', 'linked_to_personnel'].includes(item.id);
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => !isAutoManaged && handleToggleItem(item.id)}
                  className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                    isAutoManaged ? 'cursor-default' : 'cursor-pointer hover:bg-muted/30'
                  } ${isChecked ? 'border-green-500/50 bg-green-500/5' : ''}`}
                >
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                    isChecked ? 'bg-green-500 text-white' : 'bg-muted'
                  }`}>
                    {isChecked ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm ${isChecked ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.required && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600/30">Required</Badge>
                    )}
                    {isAutoManaged && (
                      <Badge variant="secondary" className="text-[10px]">Auto</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Close Out Notes */}
        <Card className="p-5 space-y-3">
          <h4 className="font-semibold">Close Out Notes</h4>
          <Textarea
            value={formData.closeOutNotes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, closeOutNotes: e.target.value }))}
            placeholder="Add any final notes or comments about this contract cycle..."
            className="min-h-[80px]"
          />
        </Card>

        {/* Status Warning */}
        {!allRequiredComplete && (
          <Card className="p-4 bg-amber-500/10 border-amber-500/30">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium text-amber-600">Required Items Incomplete</p>
                <p className="text-sm text-muted-foreground">
                  Complete all required checklist items to finalize the close out.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleSaveToProject}
            disabled={formData.savedToProject}
          >
            <Save className="h-4 w-4 mr-2" />
            {formData.savedToProject ? 'Saved to Project' : 'Save to Project'}
          </Button>
          <Button
            variant="outline"
            onClick={handleLinkToPersonnel}
            disabled={formData.linkedToPersonnel}
          >
            <Link2 className="h-4 w-4 mr-2" />
            {formData.linkedToPersonnel ? 'Linked to Personnel' : 'Link to Personnel'}
          </Button>
          <Button
            variant="outline"
            disabled={!isPaymentConfirmed}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Final Package
          </Button>
          <Button
            variant="outline"
            disabled={!isPaymentConfirmed}
          >
            <Send className="h-4 w-4 mr-2" />
            Send Final Copies
          </Button>
          <Button
            onClick={handleCompleteCloseOut}
            disabled={!allRequiredComplete}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete Close Out
          </Button>
        </div>
        </>
        )}
      </CardContent>
    </motion.div>
  );
};
