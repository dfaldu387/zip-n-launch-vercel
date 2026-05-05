import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import {
  Users, CheckCircle, Send, FileText, Download, Printer, Clock,
  Mail, Settings, Info, FileSpreadsheet, FolderOpen, User, Shield,
  Upload, Trash2, File, Loader2,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import {
  flattenPersonnel,
  resolvePlaceholders,
  formatDate,
} from '@/lib/contractUtils';
import { sendContractEmail } from '@/lib/contractEmailService';
import * as XLSX from 'xlsx';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const REQUIRED_DOC_IDS = ['signed_contract', 'w9_form', 'association_member_id', 'emergency_contact'];

const DOC_LABELS = {
  signed_contract: 'Signed Contract',
  w9_form: 'W-9 Form',
  association_member_id: 'Association Membership',
  emergency_contact: 'Emergency Contact',
};

const countComplete = (docs) => {
  if (!docs) return 0;
  return REQUIRED_DOC_IDS.filter(id => docs[id]?.status === 'complete').length;
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DocUploadZone = ({ file, onDrop, onRemove, accept }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      if (accepted.length > 0) onDrop(accepted[0]);
    },
    accept: accept || {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  if (file) {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/30 border rounded-lg">
        <File className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove} className="shrink-0 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/20'
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">
        {isDragActive ? 'Drop file here...' : 'Click or drag to upload'}
      </span>
    </div>
  );
};

const SIGNATURE_LABELS = {
  not_sent: { label: 'Not Sent', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', className: 'bg-blue-500/10 text-blue-600 border-blue-600/30' },
  viewed: { label: 'Viewed', className: 'bg-amber-500/10 text-amber-600 border-amber-600/30' },
  signed: { label: 'Signed', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-600/30' },
  approved: { label: 'Approved', className: 'bg-green-500/10 text-green-600 border-green-600/30' },
  declined: { label: 'Declined', className: 'bg-red-500/10 text-red-600 border-red-600/30' },
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const Step5_PreviewReview = ({ formData, setFormData }) => {
  const { toast } = useToast();
  const [isBulkSending, setIsBulkSending] = useState(false);
  const personnel = useMemo(() => flattenPersonnel(formData), [formData.showDetails?.officials]);
  const employeeFolders = formData.employeeFolders || {};
  const contractSettings = formData.contractSettings || {};

  const stats = useMemo(() => {
    const folders = Object.values(employeeFolders);
    const docsPerPerson = REQUIRED_DOC_IDS.length;
    const totalDocs = folders.length * docsPerPerson;
    const completedDocs = folders.reduce((sum, f) => sum + countComplete(f.documents), 0);
    return {
      total: folders.length,
      signed: folders.filter(f => ['signed', 'approved'].includes(f.signatureStatus)).length,
      sent: folders.filter(f => ['sent', 'viewed'].includes(f.signatureStatus)).length,
      approved: folders.filter(f => f.signatureStatus === 'approved').length,
      totalDocs,
      completedDocs,
      allDocsComplete: folders.length > 0 && completedDocs === totalDocs,
    };
  }, [employeeFolders]);

  // ── Document Management Functions ──

  const updateDocument = (memberId, docId, field, value) => {
    setFormData(prev => {
      const folder = prev.employeeFolders?.[memberId];
      if (!folder) return prev;
      const currentDoc = folder.documents?.[docId] || {};
      const updatedDoc = { ...currentDoc, [field]: value };

      if (field === 'file') {
        updatedDoc.status = value ? 'complete' : 'pending';
      }

      return {
        ...prev,
        employeeFolders: {
          ...prev.employeeFolders,
          [memberId]: {
            ...folder,
            documents: {
              ...folder.documents,
              [docId]: updatedDoc,
            },
          },
        },
      };
    });
  };

  const updateEmergencyContact = (memberId, contactType, field, value) => {
    setFormData(prev => {
      const folder = prev.employeeFolders?.[memberId];
      if (!folder) return prev;
      const ec = folder.documents?.emergency_contact || {};
      return {
        ...prev,
        employeeFolders: {
          ...prev.employeeFolders,
          [memberId]: {
            ...folder,
            documents: {
              ...folder.documents,
              emergency_contact: {
                ...ec,
                [contactType]: {
                  ...ec[contactType],
                  [field]: value,
                },
              },
            },
          },
        },
      };
    });
  };

  const addOtherDocument = (memberId, file) => {
    setFormData(prev => {
      const folder = prev.employeeFolders?.[memberId];
      if (!folder) return prev;
      const others = folder.documents?.other_documents || [];
      return {
        ...prev,
        employeeFolders: {
          ...prev.employeeFolders,
          [memberId]: {
            ...folder,
            documents: {
              ...folder.documents,
              other_documents: [...others, { id: Date.now().toString(), file, name: file.name, uploadedAt: new Date().toISOString() }],
            },
          },
        },
      };
    });
  };

  const removeOtherDocument = (memberId, docId) => {
    setFormData(prev => {
      const folder = prev.employeeFolders?.[memberId];
      if (!folder) return prev;
      const others = folder.documents?.other_documents || [];
      return {
        ...prev,
        employeeFolders: {
          ...prev.employeeFolders,
          [memberId]: {
            ...folder,
            documents: {
              ...folder.documents,
              other_documents: others.filter(d => d.id !== docId),
            },
          },
        },
      };
    });
  };

  // ── Bulk Actions ──

  const handleSendAllUnsigned = async () => {
    const unsent = personnel.filter(m => {
      const folder = employeeFolders[m.id];
      return folder && folder.signatureStatus === 'not_sent' && m.email;
    });

    if (unsent.length === 0) {
      toast({ title: 'No Contracts to Send', description: 'All contracts have already been sent or are missing email addresses.', variant: 'destructive' });
      return;
    }

    setIsBulkSending(true);
    const now = new Date().toISOString();
    let sentCount = 0;
    let failedCount = 0;
    const activityEntries = [];

    for (const member of unsent) {
      const result = await sendContractEmail({ member, formData });
      if (result.success) {
        sentCount++;
        activityEntries.push({ memberId: member.id, memberName: member.name, email: member.email, timestamp: now, status: 'sent' });
        setFormData(prev => ({
          ...prev,
          employeeFolders: {
            ...prev.employeeFolders,
            [member.id]: {
              ...prev.employeeFolders[member.id],
              signatureStatus: 'sent',
              signatureSentAt: now,
            },
          },
        }));
      } else {
        failedCount++;
        activityEntries.push({ memberId: member.id, memberName: member.name, email: member.email, timestamp: now, status: 'failed', error: result.error });
      }
    }

    // Log all activity
    setFormData(prev => ({
      ...prev,
      emailActivity: [...(prev.emailActivity || []), ...activityEntries],
    }));

    setIsBulkSending(false);

    if (failedCount > 0) {
      toast({
        title: 'Sending Complete',
        description: `Sent ${sentCount}, failed ${failedCount}. Check email activity log for details.`,
        variant: failedCount === unsent.length ? 'destructive' : 'default',
      });
    } else {
      toast({
        title: 'All Contracts Sent',
        description: `Successfully sent ${sentCount} contract${sentCount !== 1 ? 's' : ''} for signature.`,
      });
    }
  };

  const handleDownloadAllZip = async () => {
    if (personnel.length === 0) {
      toast({ title: 'No Personnel', description: 'Add personnel in Step 2 first.', variant: 'destructive' });
      return;
    }

    try {
      const zip = new JSZip();
      const globalTemplate = formData.contractBuilder?.globalTemplate || '';
      const overrides = formData.contractBuilder?.employeeOverrides || {};

      for (const member of personnel) {
        const folder = employeeFolders[member.id];
        const contractText = folder?.editedContract ?? folder?.resolvedContract ?? '';

        if (!contractText) continue;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const maxWidth = pageWidth - margin * 2;
        const lines = doc.splitTextToSize(contractText, maxWidth);

        doc.setFont('courier', 'normal');
        doc.setFontSize(10);

        let y = margin;
        const lineHeight = 6;

        for (const line of lines) {
          if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += lineHeight;
        }

        const filename = `Contract_${(member.name || 'Employee').replace(/\s+/g, '_')}.pdf`;
        zip.file(filename, doc.output('blob'));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contracts_${(formData.showName || 'Project').replace(/\s+/g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: 'ZIP Downloaded', description: `${personnel.length} contract PDFs bundled and downloaded.` });
    } catch (err) {
      toast({ title: 'Download Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleExportContractsToExcel = () => {
    if (personnel.length === 0) {
      toast({ title: 'No Data', description: 'Add personnel in Step 2 before exporting.', variant: 'destructive' });
      return;
    }
    const rows = personnel.map((member) => {
      const folder = employeeFolders[member.id];
      const sigStatus = folder?.signatureStatus || 'not_sent';
      const docsComplete = countComplete(folder?.documents);
      return {
        Name: member.name || 'Unnamed',
        Role: member.roleName || '',
        Association: member.assocId || '',
        Email: member.email || '',
        'Contract Status': sigStatus === 'signed' ? 'Signed' : sigStatus === 'sent' ? 'Sent' : sigStatus === 'approved' ? 'Approved' : 'Not Sent',
        'Docs Collected': `${docsComplete}/${REQUIRED_DOC_IDS.length}`,
        'Employment Start': member.employment_start_date || '',
        'Employment End': member.employment_end_date || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contracts');
    const fileName = `${(formData.showName || 'Contracts').replace(/[^a-zA-Z0-9 ]/g, '').trim()} - Contracts.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({ title: 'Contracts Exported', description: 'Excel file downloaded successfully.' });
  };

  const handleExportStaffToExcel = () => {
    if (personnel.length === 0) {
      toast({ title: 'No Data', description: 'Add personnel in Step 2 before exporting.', variant: 'destructive' });
      return;
    }
    const rows = personnel.map((member) => ({
      Name: member.name || 'Unnamed',
      Role: member.roleName || '',
      Association: member.assocId || '',
      Email: member.email || '',
      Phone: member.phone || '',
      'Employment Start': member.employment_start_date || '',
      'Employment End': member.employment_end_date || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff');
    const fileName = `${(formData.showName || 'Staff').replace(/[^a-zA-Z0-9 ]/g, '').trim()} - Staff List.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({ title: 'Staff Exported', description: 'Excel file downloaded successfully.' });
  };

  const handlePrintAll = () => {
    if (personnel.length === 0) {
      toast({ title: 'No Contracts', description: 'No personnel to print contracts for.', variant: 'destructive' });
      return;
    }
    const doc = new jsPDF();
    personnel.forEach((member, idx) => {
      if (idx > 0) doc.addPage();
      const resolved = resolvePlaceholders(formData, member);
      const lines = doc.splitTextToSize(resolved, 170);
      doc.setFontSize(10);
      doc.text(lines, 20, 20);
    });
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const paymentMethodMap = { check: 'Check', direct_deposit: 'Direct Deposit', wire: 'Wire Transfer', paypal: 'PayPal' };

  return (
    <motion.div
      key="step5"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          Step 5: Track & Collect Documents
        </CardTitle>
        <CardDescription>
          Track contract status, collect required documents from signed employees, and export contracts.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-2xl font-bold mt-2">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Personnel</p>
          </Card>
          <Card className="p-4 text-center">
            <Send className="h-5 w-5 mx-auto text-blue-500" />
            <p className="text-2xl font-bold mt-2">{stats.sent}</p>
            <p className="text-xs text-muted-foreground">Awaiting Signature</p>
          </Card>
          <Card className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-emerald-500" />
            <p className="text-2xl font-bold mt-2">{stats.signed}</p>
            <p className="text-xs text-muted-foreground">Signed</p>
          </Card>
          <Card className="p-4 text-center">
            <FileText className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-2xl font-bold mt-2">{stats.completedDocs}/{stats.totalDocs}</p>
            <p className="text-xs text-muted-foreground">Docs Collected</p>
          </Card>
          <Card className={`p-4 text-center ${stats.allDocsComplete ? 'bg-green-500/5 border-green-500/20' : ''}`}>
            <FolderOpen className={`h-5 w-5 mx-auto ${stats.allDocsComplete ? 'text-green-500' : 'text-muted-foreground'}`} />
            <p className={`text-2xl font-bold mt-2 ${stats.allDocsComplete ? 'text-green-600' : ''}`}>{stats.approved}/{stats.total}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </Card>
        </div>

        {/* Contract & Document Status Table */}
        {personnel.length > 0 && (
          <Card className="p-5 space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Contract & Document Status
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-2 font-medium text-xs uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-xs uppercase tracking-wider">Role</th>
                    <th className="text-center px-4 py-2 font-medium text-xs uppercase tracking-wider">Contract</th>
                    <th className="text-center px-4 py-2 font-medium text-xs uppercase tracking-wider">Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {personnel.map((member) => {
                    const folder = employeeFolders[member.id];
                    if (!folder) return null;
                    const docsComplete = countComplete(folder.documents);
                    const sigCfg = SIGNATURE_LABELS[folder.signatureStatus] || SIGNATURE_LABELS.not_sent;

                    return (
                      <tr key={member.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <span className="cursor-help underline decoration-dotted underline-offset-4">
                                {member.name || 'Unnamed'}
                              </span>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-72" side="bottom" align="start">
                              <div className="space-y-2">
                                <p className="font-semibold text-sm">{member.name || 'Unnamed'}</p>
                                <div className="text-xs space-y-1 text-muted-foreground">
                                  <p><span className="font-medium text-foreground">Role:</span> {member.roleName}</p>
                                  <p><span className="font-medium text-foreground">Association:</span> {member.assocId}</p>
                                  {member.email && <p><span className="font-medium text-foreground">Email:</span> {member.email}</p>}
                                  {member.phone && <p><span className="font-medium text-foreground">Phone:</span> {member.phone}</p>}
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{member.roleName}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-[10px] ${sigCfg.className}`}>{sigCfg.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant={docsComplete === REQUIRED_DOC_IDS.length ? 'default' : 'secondary'}
                            className={`text-[10px] ${docsComplete === REQUIRED_DOC_IDS.length ? 'bg-green-500/10 text-green-600 border-green-600/30' : ''}`}
                          >
                            {docsComplete}/{REQUIRED_DOC_IDS.length} {docsComplete === REQUIRED_DOC_IDS.length ? 'Complete' : 'Pending'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── Document Collection Section ── */}
        {personnel.length > 0 && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                Document Collection
              </h4>
              <Badge variant="secondary" className="text-xs">
                {stats.completedDocs}/{stats.totalDocs} collected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Collect and manage required documents submitted by employees after contract signing. Upload documents as they are received.
            </p>

            <Accordion type="single" collapsible className="space-y-2">
              {personnel.map((member) => {
                const folder = employeeFolders[member.id];
                if (!folder) return null;
                const docsComplete = countComplete(folder.documents);

                return (
                  <AccordionItem key={member.id} value={member.id} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">{member.name || 'Unnamed'}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{member.roleName}</Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={docsComplete === REQUIRED_DOC_IDS.length ? 'default' : 'secondary'}
                            className={`text-[10px] ${docsComplete === REQUIRED_DOC_IDS.length ? 'bg-green-500/10 text-green-600 border-green-600/30' : ''}`}
                          >
                            {docsComplete}/{REQUIRED_DOC_IDS.length} docs
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 pb-4 space-y-3">
                      {/* Document Status Summary */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {REQUIRED_DOC_IDS.map(docId => {
                          const doc = folder.documents?.[docId];
                          const isComplete = doc?.status === 'complete';
                          return (
                            <div key={docId} className="flex items-center gap-1.5 text-xs">
                              {isComplete
                                ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                : <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              }
                              <span className={isComplete ? 'text-green-600' : 'text-muted-foreground'}>
                                {DOC_LABELS[docId]}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* 1. Signed Contract */}
                      <div className={`p-4 border rounded-lg transition-all ${folder.documents?.signed_contract?.status === 'complete' ? 'border-green-500/50 bg-green-500/5' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                              folder.documents?.signed_contract?.status === 'complete' ? 'bg-green-500 text-white' : 'bg-muted'
                            }`}>
                              {folder.documents?.signed_contract?.status === 'complete'
                                ? <CheckCircle className="h-3.5 w-3.5" />
                                : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                            <div>
                              <span className="font-medium text-sm">Signed Contract</span>
                              <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-600/30">Required</Badge>
                            </div>
                          </div>
                          {folder.documents?.signed_contract?.status === 'complete' && (
                            <Badge className="bg-green-500/10 text-green-600 border-green-600/30 text-[10px]">Uploaded</Badge>
                          )}
                        </div>
                        <div className="mt-3 ml-9">
                          <DocUploadZone
                            file={folder.documents?.signed_contract?.file}
                            onDrop={(file) => updateDocument(member.id, 'signed_contract', 'file', file)}
                            onRemove={() => updateDocument(member.id, 'signed_contract', 'file', null)}
                            accept={{ 'application/pdf': ['.pdf'] }}
                          />
                        </div>
                      </div>

                      {/* 2. W-9 Form (Email-based) */}
                      <div className={`p-4 border rounded-lg transition-all ${folder.documents?.w9_form?.status === 'complete' ? 'border-green-500/50 bg-green-500/5' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                              folder.documents?.w9_form?.status === 'complete' ? 'bg-green-500 text-white' : 'bg-muted'
                            }`}>
                              {folder.documents?.w9_form?.status === 'complete'
                                ? <CheckCircle className="h-3.5 w-3.5" />
                                : <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                            <div>
                              <span className="font-medium text-sm">W-9 Form (Tax Information)</span>
                              <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-600/30">Required</Badge>
                            </div>
                          </div>
                          <Badge className={`text-[10px] ${
                            folder.documents?.w9_form?.status === 'complete'
                              ? 'bg-green-500/10 text-green-600 border-green-600/30'
                              : folder.documents?.w9_form?.requestedAt
                                ? 'bg-blue-500/10 text-blue-600 border-blue-600/30'
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {folder.documents?.w9_form?.status === 'complete'
                              ? 'Received'
                              : folder.documents?.w9_form?.requestedAt
                                ? 'Requested'
                                : 'Not Requested'}
                          </Badge>
                        </div>
                        <div className="mt-3 ml-9 space-y-3">
                          <div className="flex items-center gap-3">
                            <Input
                              value={folder.documents?.w9_form?.destinationEmail || member.email || ''}
                              onChange={(e) => {
                                const doc = folder.documents?.w9_form || {};
                                updateDocument(member.id, 'w9_form', 'destinationEmail', e.target.value);
                              }}
                              placeholder="Employee email for W-9 request"
                              className="max-w-sm"
                            />
                            <Button
                              size="sm"
                              variant={folder.documents?.w9_form?.requestedAt ? 'outline' : 'default'}
                              onClick={() => {
                                updateDocument(member.id, 'w9_form', 'requestedAt', new Date().toISOString());
                                toast({
                                  title: 'W-9 Requested',
                                  description: `W-9 request sent to ${folder.documents?.w9_form?.destinationEmail || member.email || 'employee'}.`,
                                });
                              }}
                            >
                              <Mail className="h-3.5 w-3.5 mr-1.5" />
                              {folder.documents?.w9_form?.requestedAt ? 'Resend Request' : 'Request W-9 via Email'}
                            </Button>
                          </div>
                          {folder.documents?.w9_form?.requestedAt && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs text-muted-foreground">
                                {folder.documents.w9_form.sentWithContract
                                  ? `Sent with contract on ${new Date(folder.documents.w9_form.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                  : `Requested on ${new Date(folder.documents.w9_form.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-6"
                                onClick={() => updateDocument(member.id, 'w9_form', 'status', 'complete')}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Mark as Received
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 ml-9 flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          W-9 forms are handled via email and not stored on this platform.
                        </p>
                      </div>

                      {/* 3. Association Member ID */}
                      <div className={`p-4 border rounded-lg transition-all ${folder.documents?.association_member_id?.status === 'complete' ? 'border-green-500/50 bg-green-500/5' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                              folder.documents?.association_member_id?.status === 'complete' ? 'bg-green-500 text-white' : 'bg-muted'
                            }`}>
                              {folder.documents?.association_member_id?.status === 'complete'
                                ? <CheckCircle className="h-3.5 w-3.5" />
                                : <Upload className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                            <div>
                              <span className="font-medium text-sm">Association Membership</span>
                              <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-600/30">Required</Badge>
                            </div>
                          </div>
                          {folder.documents?.association_member_id?.status === 'complete' && (
                            <Badge className="bg-green-500/10 text-green-600 border-green-600/30 text-[10px]">Uploaded</Badge>
                          )}
                        </div>
                        <div className="mt-3 ml-9 space-y-3">
                          <div className="max-w-sm">
                            <Label className="text-xs">Membership Number</Label>
                            <Input
                              value={folder.documents?.association_member_id?.value || ''}
                              onChange={(e) => updateDocument(member.id, 'association_member_id', 'value', e.target.value)}
                              placeholder="e.g., AQHA-12345"
                              className="mt-1"
                            />
                          </div>
                          <DocUploadZone
                            file={folder.documents?.association_member_id?.file}
                            onDrop={(file) => updateDocument(member.id, 'association_member_id', 'file', file)}
                            onRemove={() => updateDocument(member.id, 'association_member_id', 'file', null)}
                          />
                        </div>
                      </div>

                      {/* 4. Emergency Contact */}
                      <div className={`p-4 border rounded-lg transition-all space-y-4 ${folder.documents?.emergency_contact?.status === 'complete' ? 'border-green-500/50 bg-green-500/5' : ''}`}>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={folder.documents?.emergency_contact?.status === 'complete'}
                            onCheckedChange={(checked) =>
                              updateDocument(member.id, 'emergency_contact', 'status', checked ? 'complete' : 'pending')
                            }
                          />
                          <div>
                            <span className="font-medium text-sm">Emergency Contact Information</span>
                            <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-600/30">Required</Badge>
                          </div>
                        </div>

                        <div className="ml-10 space-y-2">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primary Contact (Employee)</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Name</Label>
                              <Input
                                value={folder.documents?.emergency_contact?.primary?.name || ''}
                                onChange={(e) => updateEmergencyContact(member.id, 'primary', 'name', e.target.value)}
                                placeholder="Employee name"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Phone</Label>
                              <Input
                                value={folder.documents?.emergency_contact?.primary?.phone || ''}
                                onChange={(e) => updateEmergencyContact(member.id, 'primary', 'phone', e.target.value)}
                                placeholder="Phone number"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Email</Label>
                              <Input
                                value={folder.documents?.emergency_contact?.primary?.email || ''}
                                onChange={(e) => updateEmergencyContact(member.id, 'primary', 'email', e.target.value)}
                                placeholder="Email address"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="ml-10 space-y-2">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Secondary Emergency Contact</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Name</Label>
                              <Input
                                value={folder.documents?.emergency_contact?.secondary?.name || ''}
                                onChange={(e) => updateEmergencyContact(member.id, 'secondary', 'name', e.target.value)}
                                placeholder="Emergency contact name"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Phone</Label>
                              <Input
                                value={folder.documents?.emergency_contact?.secondary?.phone || ''}
                                onChange={(e) => updateEmergencyContact(member.id, 'secondary', 'phone', e.target.value)}
                                placeholder="Phone number"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Email</Label>
                              <Input
                                value={folder.documents?.emergency_contact?.secondary?.email || ''}
                                onChange={(e) => updateEmergencyContact(member.id, 'secondary', 'email', e.target.value)}
                                placeholder="Email (optional)"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="ml-10 space-y-2">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upload Signed Form (Optional)</h5>
                          <DocUploadZone
                            file={folder.documents?.emergency_contact?.file}
                            onDrop={(file) => updateDocument(member.id, 'emergency_contact', 'file', file)}
                            onRemove={() => updateDocument(member.id, 'emergency_contact', 'file', null)}
                          />
                        </div>
                      </div>

                      {/* 5. Other Documents */}
                      <div className="p-4 border rounded-lg transition-all space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-muted">
                            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <span className="font-medium text-sm">Other Documents</span>
                            <Badge variant="outline" className="ml-2 text-xs">Optional</Badge>
                          </div>
                        </div>
                        <div className="ml-9 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Upload any additional documents (insurance, certifications, travel receipts, etc.)
                          </p>
                          {(folder.documents?.other_documents || []).map((doc) => (
                            <div key={doc.id} className="flex items-center gap-3 p-3 bg-muted/30 border rounded-lg">
                              <File className="h-4 w-4 text-primary shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(doc.file?.size || 0)}</p>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => removeOtherDocument(member.id, doc.id)} className="shrink-0 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          <DocUploadZone
                            file={null}
                            onDrop={(file) => addOtherDocument(member.id, file)}
                            onRemove={() => {}}
                          />
                        </div>
                      </div>

                      {/* Document Summary */}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {docsComplete}/{REQUIRED_DOC_IDS.length} required documents completed
                          </p>
                          {(folder.documents?.other_documents || []).length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              + {folder.documents.other_documents.length} other document{folder.documents.other_documents.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </Card>
        )}

        {/* Contract Settings Summary */}
        <Card className="p-5 space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Contract Configuration
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Effective Date</p>
              <p className="font-medium mt-1">{formatDate(contractSettings.effectiveDate) || 'Not set'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Expiration Date</p>
              <p className="font-medium mt-1">{formatDate(contractSettings.expirationDate) || 'Not set'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Payment Method</p>
              <p className="font-medium mt-1">{paymentMethodMap[contractSettings.paymentMethod] || contractSettings.paymentMethod || 'Not set'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Signing Deadline</p>
              <p className="font-medium mt-1">{formatDate(contractSettings.signingDeadline) || 'Not set'}</p>
            </div>
          </div>
          {contractSettings.additionalTerms && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Additional Terms</p>
              <p className="text-sm whitespace-pre-wrap">{contractSettings.additionalTerms}</p>
            </div>
          )}
        </Card>

        {/* Bulk Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSendAllUnsigned} disabled={isBulkSending}>
            {isBulkSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {isBulkSending ? 'Sending...' : 'Send All Contracts'}
          </Button>
          <Button variant="outline" onClick={handleDownloadAllZip}>
            <Download className="h-4 w-4 mr-2" />
            Download All Contracts
          </Button>
          <Button variant="outline" onClick={handlePrintAll}>
            <Printer className="h-4 w-4 mr-2" />
            Print All Contracts
          </Button>
          <Button variant="outline" onClick={handleExportContractsToExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Contracts to Excel
          </Button>
          <Button variant="outline" onClick={handleExportStaffToExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Staff to Excel
          </Button>
        </div>

        {/* Email Activity Log */}
        {(formData.emailActivity || []).length > 0 && (
          <Card className="p-4 space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Email Activity Log
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...(formData.emailActivity || [])].reverse().map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${entry.status === 'sent' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <span className="font-medium">{entry.memberName || 'Unknown'}</span>
                      <span className="text-muted-foreground ml-1">({entry.email})</span>
                      {entry.error && <p className="text-xs text-red-500 mt-0.5">{entry.error}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-medium ${entry.status === 'sent' ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.status === 'sent' ? 'Sent' : 'Failed'}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </CardContent>
    </motion.div>
  );
};
