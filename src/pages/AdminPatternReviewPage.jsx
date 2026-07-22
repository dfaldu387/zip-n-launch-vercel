import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, Eye, FileText, User, Loader2, Download, Trash2,
  Mail, ExternalLink, Pencil, ChevronDown, ChevronUp, Plus, Minus,
  History, Shield, Clock, Tag, Sparkles, Globe, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabaseClient';
import { preferBestScoresheet } from '@/lib/scoresheetLookup';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import PatternPreviewModal from '@/components/pattern-upload/PatternPreviewModal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { EmailSenderModal } from '@/components/admin/EmailSenderModal';
import { ReviewEmailModal } from '@/components/admin/ReviewEmailModal';
import { generateNextPatternNumber, assignPatternNumber, PATTERN_LEVELS, assignPatternDisplayName, updatePatternIdentifier, generateNextSharedPatternNumber, assignSharedPatternNumber } from '@/lib/patternNumbering';
import { generateFinalFilePdf, uploadFinalFile } from '@/lib/finalFileGenerator';
import { notifyPatternApproved, notifyPatternRejected, notifyPatternPublished } from '@/lib/notifications';
import PatternArtifactCard from '@/components/admin/PatternArtifactCard';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const AdminPatternReviewPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [pendingPatterns, setPendingPatterns] = useState([]);
  const [approvedPatterns, setApprovedPatterns] = useState([]);
  const [rejectedPatterns, setRejectedPatterns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewState, setPreviewState] = useState({ isOpen: false, pattern: null });
  const [deleteState, setDeleteState] = useState({ isOpen: false, pattern: null });
  const [emailState, setEmailState] = useState({ isOpen: false, patternSet: null });
  const [editState, setEditState] = useState({ isOpen: false, pattern: null, fields: {} });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isRegeneratingLanguage, setIsRegeneratingLanguage] = useState(false);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [selectedSets, setSelectedSets] = useState(new Set());
  const [allAssociations, setAllAssociations] = useState([]);
  const [historyState, setHistoryState] = useState({ isOpen: false, setName: null, history: [], isLoading: false });
  const [expandedSets, setExpandedSets] = useState(new Set());
  const [reviewEmailState, setReviewEmailState] = useState({ isOpen: false, patternSet: null, reviewType: null, onConfirm: null });
  const [generatingFinals, setGeneratingFinals] = useState(new Set());

  // Fetch all available associations for the multi-select
  useEffect(() => {
    const fetchAssociations = async () => {
      const { data, error } = await supabase
        .from('associations')
        .select('id, name')
        .order('name');
      if (!error && data) setAllAssociations(data);
    };
    fetchAssociations();
  }, []);

  const fetchPatterns = useCallback(async () => {
    setIsLoading(true);

    const { data: patternsData, error: patternsError } = await supabase
      .from('patterns')
      .select('*, pattern_associations(*), pattern_divisions(*), pattern_files(id, file_type, file_name, file_url, sort_order), projects(id, project_name)')
      .in('review_status', ['pending', 'approved', 'rejected']);

    if (patternsError) {
      toast({ title: 'Error fetching patterns', description: patternsError.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const userIds = [...new Set(patternsData.map(p => p.user_id))];
    if (userIds.length === 0) {
      setPendingPatterns([]);
      setApprovedPatterns([]);
      setRejectedPatterns([]);
      setIsLoading(false);
      return;
    }

    // Fetch names from profiles, emails from auth.users (via RPC) + customers fallback
    const [profilesResult, authResult, customersResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', userIds),
      supabase.rpc('get_auth_user_emails', { user_ids: userIds }),
      supabase.from('customers').select('user_id, email, full_name').in('user_id', userIds),
    ]);

    const profileMap = (profilesResult.data || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    const authMap = (authResult.data || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
    const customersMap = (customersResult.data || []).reduce((acc, c) => { acc[c.user_id] = c; return acc; }, {});

    // Merge: profiles for name, auth.users for email, customers as fallback
    const customerMap = {};
    userIds.forEach(uid => {
      const profile = profileMap[uid];
      const auth = authMap[uid];
      const customer = customersMap[uid];
      customerMap[uid] = {
        full_name: profile?.full_name || customer?.full_name || null,
        email: auth?.email || customer?.email || null,
      };
    });

    const patternsWithCustomer = patternsData.map(pattern => ({
      ...pattern,
      customer: customerMap[pattern.user_id] || { email: null, full_name: null },
    }));

    const pending = patternsWithCustomer.filter(p => p.review_status === 'pending');
    const approved = patternsWithCustomer.filter(p => p.review_status === 'approved');
    const rejected = patternsWithCustomer.filter(p => p.review_status === 'rejected');

    const groupPatterns = (patterns) => {
      const grouped = patterns.reduce((acc, pattern) => {
        const setName = pattern.pattern_set_name || 'Individual Pattern';
        const projectId = pattern.project_id;
        if (!acc[setName]) {
          acc[setName] = {
            setName,
            user: pattern.customer,
            patterns: [],
            className: pattern.class_name,
            createdAt: pattern.created_at,
            projectId: projectId,
          };
        }
        acc[setName].patterns.push(pattern);
        return acc;
      }, {});
      return Object.values(grouped).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    setPendingPatterns(groupPatterns(pending));
    setApprovedPatterns(groupPatterns(approved));
    setRejectedPatterns(groupPatterns(rejected));
    setSelectedSets(new Set());
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  // Get submitted associations for a pattern set (from pattern_associations table)
  const getSubmittedAssociations = (set) => {
    const assocIds = new Set();
    set.patterns.forEach(p => {
      (p.pattern_associations || []).forEach(pa => assocIds.add(pa.association_id));
    });
    return [...assocIds];
  };

  // Get approved associations for a pattern set (from approved_associations JSONB or fallback to submitted)
  const getApprovedAssociations = (set) => {
    // Use the first pattern's approved_associations field (set-level data stored per pattern)
    const firstWithApproved = set.patterns.find(p => p.approved_associations && p.approved_associations.length > 0);
    if (firstWithApproved) return firstWithApproved.approved_associations;
    return null; // null means not yet set by admin
  };

  // Get original submitted associations (preserved snapshot)
  const getOriginalAssociations = (set) => {
    const firstWithOriginal = set.patterns.find(p => p.original_associations && p.original_associations.length > 0);
    if (firstWithOriginal) return firstWithOriginal.original_associations;
    return getSubmittedAssociations(set);
  };

  // Resolve association ID to name
  const getAssociationName = (id) => {
    const assoc = allAssociations.find(a => a.id === id);
    return assoc ? assoc.name : id;
  };

  // Save approved associations for a pattern set
  const handleSaveApprovedAssociations = async (set, newApprovedIds) => {
    const patternIds = set.patterns.map(p => p.id);
    const submittedIds = getSubmittedAssociations(set);
    const previousApproved = getApprovedAssociations(set) || submittedIds;

    // Snapshot original associations if not already saved
    const needsOriginalSnapshot = !set.patterns.some(p => p.original_associations && p.original_associations.length > 0);

    const updateData = {
      approved_associations: newApprovedIds,
      last_modified_at: new Date().toISOString(),
      last_modified_by: user?.id || null,
    };

    if (needsOriginalSnapshot) {
      updateData.original_associations = submittedIds;
    }

    const { error } = await supabase
      .from('patterns')
      .update(updateData)
      .in('id', patternIds);

    if (error) {
      toast({ title: 'Failed to update associations', description: error.message, variant: 'destructive' });
      return;
    }

    // Log the change
    const added = newApprovedIds.filter(id => !previousApproved.includes(id));
    const removed = previousApproved.filter(id => !newApprovedIds.includes(id));

    await supabase.from('pattern_change_history').insert({
      pattern_set_name: set.setName,
      user_id: set.patterns[0]?.user_id,
      action: 'associations_updated',
      changes: {
        previous: previousApproved.map(id => ({ id, name: getAssociationName(id) })),
        current: newApprovedIds.map(id => ({ id, name: getAssociationName(id) })),
        added: added.map(id => ({ id, name: getAssociationName(id) })),
        removed: removed.map(id => ({ id, name: getAssociationName(id) })),
      },
      admin_id: user?.id || null,
      admin_email: user?.email || null,
    });

    toast({ title: 'Associations Updated', description: `Approved associations saved for "${set.setName}".` });
    fetchPatterns();
  };

  // Build a complete approved package for a pattern (Task 2 + 10)
  const buildApprovedPackage = async (patternId) => {
    const { data: pattern } = await supabase
      .from('patterns')
      .select('*, pattern_associations(*)')
      .eq('id', patternId)
      .single();

    if (!pattern) return null;

    // Fetch accessory documents
    const { data: accessories } = await supabase
      .from('pattern_accessory_documents')
      .select('id, document_type, file_name, file_url')
      .eq('pattern_id', patternId);

    // Auto-match scoresheet by association + discipline
    let scoresheetData = null;
    const associationIds = (pattern.approved_associations && pattern.approved_associations.length > 0)
      ? pattern.approved_associations
      : (pattern.pattern_associations || []).map(pa => pa.association_id);

    if (associationIds.length > 0 && pattern.class_name) {
      const { data: assocs } = await supabase
        .from('associations')
        .select('id, abbreviation, name')
        .in('id', associationIds);

      for (const assoc of (assocs || [])) {
        if (!assoc.abbreviation) continue;
        const { data: sheets } = await preferBestScoresheet(
          supabase
            .from('tbl_scoresheet')
            .select('id, image_url, storage_path, discipline, file_name, association_abbrev, city_state')
            .eq('association_abbrev', assoc.abbreviation)
            .ilike('discipline', pattern.class_name)
        );

        if (sheets?.length > 0) {
          const sheet = sheets.find(s => s.image_url) || sheets[0];
          scoresheetData = {
            id: sheet.id,
            file_name: sheet.file_name,
            image_url: sheet.image_url,
            discipline: sheet.discipline,
            association_abbrev: sheet.association_abbrev,
            match_method: 'association_discipline',
          };
          break;
        }
      }
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      generated_by: user?.id || null,
      submission: {
        file_url: pattern.file_url,
        original_file_name: pattern.original_file_name,
        submitted_at: pattern.created_at,
      },
      pattern: {
        display_name: pattern.display_name,
        pattern_identifier: pattern.pattern_identifier,
        pattern_set_number: pattern.pattern_set_number,
        class_name: pattern.class_name,
        level: pattern.level,
      },
      verbiage: pattern.verbiage || null,
      scoresheet: scoresheetData,
      accessory_documents: (accessories || []).map(a => ({
        id: a.id,
        document_type: a.document_type,
        file_name: a.file_name,
        file_url: a.file_url,
      })),
      associations: associationIds,
    };
  };

  const executeReview = async (patternIds, newStatus, discipline, setName, userId, rejectionReason = null, submitter = null) => {
    const now = new Date().toISOString();
    const updateData = {
      review_status: newStatus,
      last_modified_at: now,
      last_modified_by: user?.id || null,
    };
    if (newStatus === 'approved') {
      updateData.approved_at = now;
      updateData.approved_by = user?.id || null;
      updateData.rejected_at = null; // Clear rejection on re-approve
    }
    if (newStatus === 'rejected') {
      updateData.rejected_at = now;
      updateData.approved_at = null; // Clear approval on reject
      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }
    }

    const { error } = await supabase
      .from('patterns')
      .update(updateData)
      .in('id', patternIds);

    if (error) {
      toast({ title: `Failed to ${newStatus} set`, description: error.message, variant: 'destructive' });
      return;
    }

    if (newStatus === 'approved') {
      for (const patternId of patternIds) {
        try {
          const number = await generateNextPatternNumber(discipline || 'unknown');
          await assignPatternNumber(patternId, number);
        } catch (e) {
          console.warn('Failed to assign pattern number:', e);
        }
        // Assign shared 4-digit sequential pattern_number (used across all linked files).
        // Skip if one is already set (re-approval shouldn't renumber).
        try {
          const { data: existing } = await supabase
            .from('patterns')
            .select('pattern_number')
            .eq('id', patternId)
            .single();
          if (!existing?.pattern_number) {
            const sharedNumber = await generateNextSharedPatternNumber();
            await assignSharedPatternNumber(patternId, sharedNumber);
          }
        } catch (e) {
          console.warn('Failed to assign shared pattern_number:', e);
        }
        // Ensure display name is assigned (backfill for older patterns without one)
        try {
          const { data: pat } = await supabase.from('patterns').select('display_name, class_name, level').eq('id', patternId).single();
          if (pat && !pat.display_name) {
            await assignPatternDisplayName(patternId, pat.class_name || discipline || 'unknown', pat.level || null);
          }
        } catch (e) {
          console.warn('Failed to backfill display name:', e);
        }
      }

      // Build and store approved package for each pattern
      for (const patternId of patternIds) {
        try {
          const pkg = await buildApprovedPackage(patternId);
          if (pkg) {
            await supabase
              .from('patterns')
              .update({
                approved_package: pkg,
                scoresheet_id: pkg.scoresheet?.id || null,
              })
              .eq('id', patternId);
          }
        } catch (e) {
          console.warn('Failed to build approved package:', e);
        }
      }
    }

    // Log the status change
    await supabase.from('pattern_change_history').insert({
      pattern_set_name: setName || 'Unknown',
      user_id: userId || patternIds[0],
      action: newStatus,
      changes: { status: newStatus, pattern_count: patternIds.length, ...(rejectionReason ? { rejection_reason: rejectionReason } : {}) },
      admin_id: user?.id || null,
      admin_email: user?.email || null,
    });

    // In-app notification for the submitter (writes to existing
    // judge_notifications table, same bell as everywhere else).
    if (submitter?.email) {
      if (newStatus === 'approved') {
        await notifyPatternApproved({
          email: submitter.email,
          name: submitter.full_name,
          setName: setName || 'Pattern Set',
          patternCount: patternIds.length,
          createdBy: user?.id || null,
        });
      } else if (newStatus === 'rejected') {
        await notifyPatternRejected({
          email: submitter.email,
          name: submitter.full_name,
          setName: setName || 'Pattern Set',
          reason: rejectionReason,
          createdBy: user?.id || null,
        });
      }
    }

    toast({
      title: `Pattern Set ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
      description: `The pattern set has been updated successfully.${newStatus === 'approved' ? ' Pattern numbers assigned. Approved package generated.' : ''}`,
    });
    fetchPatterns();
  };

  // Open email modal before approve/reject
  const handleReviewWithEmail = (set, newStatus) => {
    const patternIds = set.patterns.map(p => p.id);
    setReviewEmailState({
      isOpen: true,
      patternSet: set,
      reviewType: newStatus,
      onConfirm: (rejectionReason) => executeReview(
        patternIds,
        newStatus,
        set.className,
        set.setName,
        set.patterns[0]?.user_id,
        rejectionReason,
        set.user, // { email, full_name } — used for in-app notification via judge_notifications
      ),
    });
  };

  const handleDeletePattern = async () => {
    if (!deleteState.pattern) return;

    try {
      if (deleteState.pattern.file_path) {
        const { error: storageError } = await supabase.storage
          .from('pattern_files')
          .remove([deleteState.pattern.file_path]);
        if (storageError) console.warn('Storage deletion failed:', storageError);
      }

      await supabase.from('pattern_associations').delete().eq('pattern_id', deleteState.pattern.id);
      await supabase.from('pattern_divisions').delete().eq('pattern_id', deleteState.pattern.id);

      const { error } = await supabase.from('patterns').delete().eq('id', deleteState.pattern.id);
      if (error) throw error;

      toast({ title: 'Pattern Deleted', description: 'The pattern has been permanently removed.' });
      fetchPatterns();
    } catch (error) {
      toast({ title: 'Error deleting pattern', description: error.message, variant: 'destructive' });
    }

    setDeleteState({ isOpen: false, pattern: null });
  };

  const handlePreviewPattern = (pattern) => {
    setPreviewState({
      isOpen: true,
      pattern: {
        id: pattern.id,
        name: pattern.display_name || pattern.name,
        display_name: pattern.display_name,
        file_url: pattern.file_url,
        fileUrl: pattern.file_url,
      },
    });
  };

  const handleDownloadPattern = async (pattern) => {
    if (!pattern.file_url) {
      toast({ title: 'Download Failed', description: 'No file URL available for this pattern.', variant: 'destructive' });
      return;
    }
    try {
      // Fetch the file as blob to force download (avoids CORS/navigation issues)
      const response = await fetch(pattern.file_url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pattern.original_file_name || pattern.name || 'pattern.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback: open in new tab
      window.open(pattern.file_url, '_blank');
    }
  };

  const handleOpenEmailModal = (patternSet) => {
    setEmailState({ isOpen: true, patternSet });
  };

  const handleGenerateFinalFile = async (pattern) => {
    if (!pattern.preview_image_url && !pattern.verbiage) {
      toast({ title: 'Cannot Generate', description: 'Pattern needs at least an image or verbiage text.', variant: 'destructive' });
      return;
    }

    setGeneratingFinals(prev => new Set(prev).add(pattern.id));
    try {
      const blob = await generateFinalFilePdf({
        patternImageUrl: pattern.preview_image_url,
        verbiageText: pattern.verbiage,
        patternName: pattern.display_name || pattern.name,
        discipline: pattern.class_name,
        level: pattern.level,
      });
      await uploadFinalFile(blob, pattern.id, pattern.user_id);
      toast({ title: 'Final File Generated', description: `Final file created for "${pattern.display_name || pattern.name}".` });
      fetchPatterns();
    } catch (error) {
      toast({ title: 'Generation Failed', description: error.message, variant: 'destructive' });
    } finally {
      setGeneratingFinals(prev => {
        const next = new Set(prev);
        next.delete(pattern.id);
        return next;
      });
    }
  };

  const handleGenerateAllFinals = async (set) => {
    const patternsToGenerate = set.patterns.filter(p => !p.final_file_url);
    if (patternsToGenerate.length === 0) {
      toast({ title: 'All Done', description: 'All patterns already have final files.' });
      return;
    }
    for (const pattern of patternsToGenerate) {
      await handleGenerateFinalFile(pattern);
    }
  };

  const handlePublish = async (set) => {
    const patternIds = set.patterns.map(p => p.id);
    const { error } = await supabase
      .from('patterns')
      .update({
        publication_status: 'published',
        last_modified_at: new Date().toISOString(),
        last_modified_by: user?.id || null,
      })
      .in('id', patternIds);

    if (error) {
      toast({ title: 'Publish Failed', description: error.message, variant: 'destructive' });
      return;
    }

    await supabase.from('pattern_change_history').insert({
      pattern_set_name: set.setName,
      user_id: set.patterns[0]?.user_id,
      action: 'published',
      changes: { status: 'published', pattern_count: patternIds.length },
      admin_id: user?.id || null,
      admin_email: user?.email || null,
    });

    // In-app notification for the submitter
    if (set.user?.email) {
      await notifyPatternPublished({
        email: set.user.email,
        name: set.user.full_name,
        setName: set.setName,
        patternCount: patternIds.length,
        createdBy: user?.id || null,
      });
    }

    toast({ title: 'Published', description: `"${set.setName}" is now available for system use.` });
    fetchPatterns();
  };

  // Re-run language extraction on the stored PDF and overwrite the textarea
  // value. Admin can then review + Save Changes to persist.
  const handleRegenerateLanguage = async () => {
    const pattern = editState.pattern;
    if (!pattern?.file_url) {
      toast({ title: 'No source PDF', description: 'This pattern has no stored file to re-extract from.', variant: 'destructive' });
      return;
    }
    setIsRegeneratingLanguage(true);
    try {
      const response = await fetch(pattern.file_url);
      if (!response.ok) throw new Error(`Could not download PDF (${response.status})`);
      const blob = await response.blob();
      const file = new File([blob], pattern.original_file_name || 'pattern.pdf', { type: 'application/pdf' });

      const { extractPatternStepsWithProgress } = await import('@/lib/pdfUtils');
      const stepMap = await extractPatternStepsWithProgress(file);
      const steps = Object.entries(stepMap)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([num, instruction]) => `${num}. ${instruction}`);

      if (steps.length === 0) {
        toast({
          title: 'No language found',
          description: 'Could not extract numbered steps from this PDF. You may need to edit manually.',
          variant: 'destructive',
        });
        return;
      }

      const newVerbiage = steps.join('\n');
      setEditState(prev => ({ ...prev, fields: { ...prev.fields, verbiage: newVerbiage } }));
      toast({ title: 'Language regenerated', description: `Found ${steps.length} steps. Click Save Changes to keep them.` });
    } catch (err) {
      toast({ title: 'Regeneration failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsRegeneratingLanguage(false);
    }
  };

  const handleOpenEditDialog = (pattern) => {
    setEditState({
      isOpen: true,
      pattern,
      fields: {
        name: pattern.name || '',
        class_name: pattern.class_name || '',
        pattern_set_name: pattern.pattern_set_name || '',
        level: pattern.level || '',
        verbiage: pattern.verbiage || '',
      },
    });
  };

  const handleSaveEdit = async () => {
    if (!editState.pattern) return;
    setIsSavingEdit(true);

    const updateData = {
      name: editState.fields.name,
      class_name: editState.fields.class_name,
      pattern_set_name: editState.fields.pattern_set_name,
      level: editState.fields.level || null,
      verbiage: editState.fields.verbiage || null,
      last_modified_at: new Date().toISOString(),
      last_modified_by: user?.id || null,
    };

    const { error } = await supabase
      .from('patterns')
      .update(updateData)
      .eq('id', editState.pattern.id);

    if (!error) {
      // If discipline or level changed, update the identifier and display name
      // but keep the sequence number persistent
      const disciplineChanged = editState.fields.class_name !== editState.pattern.class_name;
      const levelChanged = editState.fields.level !== (editState.pattern.level || '');

      if (disciplineChanged || levelChanged) {
        const seqNum = editState.pattern.discipline_sequence_number;
        if (seqNum) {
          await updatePatternIdentifier(
            editState.pattern.id,
            editState.fields.class_name,
            editState.fields.level || null,
            seqNum
          );
        }
      }

      // Log the change
      await supabase.from('pattern_change_history').insert({
        pattern_set_name: editState.fields.pattern_set_name || editState.pattern.pattern_set_name || 'Unknown',
        user_id: editState.pattern.user_id,
        action: 'edited',
        changes: {
          previous: {
            name: editState.pattern.name,
            class_name: editState.pattern.class_name,
            level: editState.pattern.level || null,
          },
          current: {
            name: editState.fields.name,
            class_name: editState.fields.class_name,
            level: editState.fields.level || null,
          },
        },
        admin_id: user?.id || null,
        admin_email: user?.email || null,
      });
    }

    setIsSavingEdit(false);
    if (error) {
      toast({ title: 'Failed to update pattern', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pattern Updated', description: `"${editState.fields.name}" saved successfully.` });
      // Warn if verbiage changed and a final file exists
      if (editState.pattern?.final_file_url && editState.fields.verbiage !== (editState.pattern.verbiage || '')) {
        // Clear final file since verbiage changed
        await supabase.from('patterns').update({ final_file_url: null }).eq('id', editState.pattern.id);
        toast({ title: 'Final File Cleared', description: 'Verbiage changed — please regenerate the final file.', variant: 'default' });
      }
      setEditState({ isOpen: false, pattern: null, fields: {} });
      fetchPatterns();
    }
  };

  const handleViewHistory = async (setName) => {
    setHistoryState({ isOpen: true, setName, history: [], isLoading: true });
    const { data, error } = await supabase
      .from('pattern_change_history')
      .select('*')
      .eq('pattern_set_name', setName)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast({ title: 'Error fetching history', description: error.message, variant: 'destructive' });
      setHistoryState(prev => ({ ...prev, isLoading: false }));
    } else {
      setHistoryState(prev => ({ ...prev, history: data || [], isLoading: false }));
    }
  };

  const filteredSets = useMemo(() => {
    switch (activeFilter) {
      case 'pending': return pendingPatterns;
      case 'approved': return approvedPatterns;
      case 'rejected': return rejectedPatterns;
      case 'all': return [...pendingPatterns, ...approvedPatterns, ...rejectedPatterns];
      default: return pendingPatterns;
    }
  }, [activeFilter, pendingPatterns, approvedPatterns, rejectedPatterns]);

  const toggleSetSelection = (setKey) => {
    setSelectedSets(prev => {
      const next = new Set(prev);
      if (next.has(setKey)) next.delete(setKey);
      else next.add(setKey);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSets.size === filteredSets.length) {
      setSelectedSets(new Set());
    } else {
      setSelectedSets(new Set(filteredSets.map((s, i) => `${s.setName}-${i}`)));
    }
  };

  const handleBulkAction = async (newStatus) => {
    const selectedPatternSets = filteredSets.filter((s, i) => selectedSets.has(`${s.setName}-${i}`));
    const allPatternIds = selectedPatternSets.flatMap(s => s.patterns.map(p => p.id));
    if (allPatternIds.length === 0) return;

    const now = new Date().toISOString();
    const updateData = {
      review_status: newStatus,
      last_modified_at: now,
      last_modified_by: user?.id || null,
    };
    if (newStatus === 'approved') {
      updateData.approved_at = now;
      updateData.approved_by = user?.id || null;
      updateData.rejected_at = null; // Clear rejection on re-approve
    }
    if (newStatus === 'rejected') {
      updateData.rejected_at = now;
      updateData.approved_at = null; // Clear approval on reject
    }

    const { error } = await supabase
      .from('patterns')
      .update(updateData)
      .in('id', allPatternIds);

    if (error) {
      toast({ title: `Bulk ${newStatus} failed`, description: error.message, variant: 'destructive' });
      return;
    }

    // On bulk approval, assign a shared sequential pattern_number to each
    // newly-approved pattern (one at a time to keep the sequence monotonic).
    if (newStatus === 'approved') {
      for (const patternId of allPatternIds) {
        try {
          const { data: existing } = await supabase
            .from('patterns')
            .select('pattern_number')
            .eq('id', patternId)
            .single();
          if (!existing?.pattern_number) {
            const sharedNumber = await generateNextSharedPatternNumber();
            await assignSharedPatternNumber(patternId, sharedNumber);
          }
        } catch (e) {
          console.warn('Failed to assign shared pattern_number (bulk):', e);
        }
      }
    }

    // In-app notification per set (each set may have a different submitter)
    for (const s of selectedPatternSets) {
      if (!s.user?.email) continue;
      if (newStatus === 'approved') {
        await notifyPatternApproved({
          email: s.user.email,
          name: s.user.full_name,
          setName: s.setName,
          patternCount: s.patterns.length,
          createdBy: user?.id || null,
        });
      } else if (newStatus === 'rejected') {
        await notifyPatternRejected({
          email: s.user.email,
          name: s.user.full_name,
          setName: s.setName,
          reason: null,
          createdBy: user?.id || null,
        });
      }
    }

    toast({ title: `Bulk ${newStatus} complete`, description: `${selectedPatternSets.length} set(s) updated.` });
    fetchPatterns();
  };

  const toggleExpanded = (setKey) => {
    setExpandedSets(prev => {
      const next = new Set(prev);
      if (next.has(setKey)) next.delete(setKey);
      else next.add(setKey);
      return next;
    });
  };

  // ---- Association Editor Sub-component ----
  const AssociationEditor = ({ set }) => {
    const submittedIds = getSubmittedAssociations(set);
    const approvedIds = getApprovedAssociations(set);
    const originalIds = getOriginalAssociations(set);
    const [localApproved, setLocalApproved] = useState(approvedIds || submittedIds);
    const [isSaving, setIsSaving] = useState(false);

    const hasChanges = JSON.stringify([...localApproved].sort()) !== JSON.stringify([...(approvedIds || submittedIds)].sort());

    const toggleAssociation = (id) => {
      setLocalApproved(prev =>
        prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
      );
    };

    const handleSave = async () => {
      setIsSaving(true);
      await handleSaveApprovedAssociations(set, localApproved);
      setIsSaving(false);
    };

    return (
      <div className="space-y-3">
        {/* Submitted Associations (read-only) */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Tag className="h-3 w-3" /> Submitted Associations
          </p>
          <div className="flex flex-wrap gap-1">
            {submittedIds.length > 0 ? (
              submittedIds.map(id => (
                <Badge key={id} variant="outline" className="text-xs">
                  {getAssociationName(id)}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">None submitted</span>
            )}
          </div>
        </div>

        {/* Original vs Current comparison (only if admin has modified) */}
        {approvedIds && JSON.stringify([...originalIds].sort()) !== JSON.stringify([...approvedIds].sort()) && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Original Submitted</p>
            <div className="flex flex-wrap gap-1">
              {originalIds.map(id => (
                <Badge key={id} variant="outline" className="text-xs opacity-60 line-through">
                  {getAssociationName(id)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <hr className="border-border" />

        {/* Approved Associations (editable) */}
        <div>
          <p className="text-xs font-medium mb-1 flex items-center gap-1">
            <Shield className="h-3 w-3 text-green-600" /> Approved Associations
            {approvedIds ? (
              <Badge variant="secondary" className="text-[10px] ml-1">Admin Set</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] ml-1">Using Submitted</Badge>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {allAssociations.map(assoc => {
              const isChecked = localApproved.includes(assoc.id);
              return (
                <button
                  key={assoc.id}
                  type="button"
                  onClick={() => toggleAssociation(assoc.id)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-colors cursor-pointer
                    ${isChecked
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                    }`}
                >
                  {isChecked ? <Check className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                  {assoc.name}
                </button>
              );
            })}
          </div>
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-7 text-xs">
              {isSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
              Save Associations
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ---- Pattern Set Card ----
  const PatternSetCard = ({ set, isPendingReview, setKey }) => {
    const patternIds = set.patterns.map(p => p.id);
    const userName = set.user?.full_name || set.user?.email || 'Unknown User';
    const userEmail = set.user?.email || null;
    const projectId = set.projectId;
    const isSelected = selectedSets.has(setKey);
    const isExpanded = expandedSets.has(setKey);
    const submittedIds = getSubmittedAssociations(set);
    const approvedIds = getApprovedAssociations(set);
    const effectiveAssociations = approvedIds || submittedIds;

    // Audit timestamps
    const approvedAt = set.patterns.find(p => p.approved_at)?.approved_at;
    const rejectedAt = set.patterns.find(p => p.rejected_at)?.rejected_at;
    const lastModifiedAt = set.patterns.find(p => p.last_modified_at)?.last_modified_at;
    const daysUntilDeletion = rejectedAt ? Math.max(0, 90 - Math.floor((Date.now() - new Date(rejectedAt).getTime()) / (1000 * 60 * 60 * 24))) : null;

    return (
      <Card className={`bg-secondary/50 transition-colors ${isSelected ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSetSelection(setKey)}
                className="mt-1"
              />
              <div>
                <CardTitle>{set.setName}</CardTitle>
                <CardDescription>
                  <span className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" /> {userName}{userEmail && userName !== userEmail ? ` (${userEmail})` : ''}
                    </span>
                    <span className="text-muted-foreground/50">|</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Submitted: {new Date(set.createdAt).toLocaleDateString()}
                    </span>
                    {approvedAt && (
                      <>
                        <span className="text-muted-foreground/50">|</span>
                        <span className="flex items-center gap-1 text-green-600">
                          <Check className="h-3 w-3" /> Approved: {new Date(approvedAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                    {rejectedAt && (
                      <>
                        <span className="text-muted-foreground/50">|</span>
                        <span className="flex items-center gap-1 text-red-600">
                          <X className="h-3 w-3" /> Rejected: {new Date(rejectedAt).toLocaleDateString()}
                        </span>
                        {daysUntilDeletion !== null && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                            {daysUntilDeletion}d until auto-delete
                          </Badge>
                        )}
                      </>
                    )}
                    {lastModifiedAt && (
                      <>
                        <span className="text-muted-foreground/50">|</span>
                        <span className="flex items-center gap-1 text-blue-600">
                          <Pencil className="h-3 w-3" /> Modified: {new Date(lastModifiedAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </span>
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Association badges in header */}
              <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                {effectiveAssociations.slice(0, 3).map(id => (
                  <Badge key={id} variant={approvedIds ? 'default' : 'outline'} className="text-xs">
                    {getAssociationName(id)}
                  </Badge>
                ))}
                {effectiveAssociations.length > 3 && (
                  <Badge variant="secondary" className="text-xs">+{effectiveAssociations.length - 3}</Badge>
                )}
              </div>
              <Badge variant={isPendingReview ? 'default' : set.patterns[0]?.review_status === 'rejected' ? 'destructive' : 'secondary'}>
                {isPendingReview ? 'Pending' : set.patterns[0]?.review_status || 'approved'}
              </Badge>
              {set.patterns[0]?.publication_status === 'published' && (
                <Badge variant="default" className="bg-blue-600 text-xs">
                  <Globe className="h-3 w-3 mr-1" /> Published
                </Badge>
              )}
              <Badge variant="secondary" className="text-base">{set.className}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Structured Pattern Artifacts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm">Patterns in this set:</p>
              {set.patterns.some(p => !p.final_file_url) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleGenerateAllFinals(set)}
                  disabled={set.patterns.some(p => generatingFinals.has(p.id))}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Generate All Finals ({set.patterns.filter(p => !p.final_file_url).length})
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {set.patterns.map(pattern => (
                <PatternArtifactCard
                  key={pattern.id}
                  pattern={pattern}
                  onGenerateFinal={handleGenerateFinalFile}
                  onPreview={handlePreviewPattern}
                  onEdit={handleOpenEditDialog}
                  onDownload={handleDownloadPattern}
                  onDelete={(p) => setDeleteState({ isOpen: true, pattern: p })}
                  isGenerating={generatingFinals.has(pattern.id)}
                />
              ))}
            </div>
          </div>

          {/* Expandable Associations Section */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleExpanded(setKey)}
              className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <span className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Associations
                <Badge variant="secondary" className="text-xs">{effectiveAssociations.length}</Badge>
              </span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3">
                    <AssociationEditor set={set} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => handleViewHistory(set.setName)}
            >
              <History className="mr-1 h-3 w-3" /> View History
            </Button>
            <div className="flex gap-2 flex-wrap justify-end">
              {projectId && (
                <Link to={`/show/${projectId}`} target="_blank">
                  <Button variant="outline">
                    <ExternalLink className="mr-2 h-4 w-4" /> Visit Show Page
                  </Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => handleOpenEmailModal(set)}>
                <Mail className="mr-2 h-4 w-4" /> Send Email
              </Button>
              {/* Approve: requires all final files generated */}
              {set.patterns[0]?.review_status !== 'approved' && (() => {
                const allHaveFinal = set.patterns.every(p => p.final_file_url);
                return (
                  <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleReviewWithEmail(set, 'approved')}
                    disabled={!allHaveFinal}
                    title={!allHaveFinal ? 'Generate all final files before approving' : ''}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {!allHaveFinal ? (
                      <span className="flex items-center gap-1">
                        Approve Set
                        <AlertCircle className="h-3 w-3 text-amber-300" />
                      </span>
                    ) : 'Approve Set'}
                  </Button>
                );
              })()}
              {set.patterns[0]?.review_status !== 'rejected' && (
                <Button
                  variant="destructive"
                  onClick={() => handleReviewWithEmail(set, 'rejected')}
                >
                  <X className="mr-2 h-4 w-4" /> Reject Set
                </Button>
              )}
              {/* Publish: only for approved sets with final files */}
              {set.patterns[0]?.review_status === 'approved' && set.patterns.every(p => p.final_file_url) && (
                <Button
                  variant="default"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => handlePublish(set)}
                  disabled={set.patterns.every(p => p.publication_status === 'published')}
                >
                  <Globe className="mr-2 h-4 w-4" />
                  {set.patterns.every(p => p.publication_status === 'published')
                    ? 'Published'
                    : 'Submit for Publication'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ---- Format history action ----
  const formatHistoryAction = (entry) => {
    switch (entry.action) {
      case 'associations_updated': {
        const added = entry.changes?.added || [];
        const removed = entry.changes?.removed || [];
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium">Associations Updated</p>
            {added.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Plus className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-600">Added:</span>
                {added.map(a => (
                  <Badge key={a.id} variant="outline" className="text-xs text-green-600 border-green-300">
                    {a.name}
                  </Badge>
                ))}
              </div>
            )}
            {removed.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Minus className="h-3 w-3 text-red-600" />
                <span className="text-xs text-red-600">Removed:</span>
                {removed.map(a => (
                  <Badge key={a.id} variant="outline" className="text-xs text-red-600 border-red-300">
                    {a.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'approved':
        return <p className="text-sm font-medium text-green-600">Pattern Set Approved</p>;
      case 'rejected':
        return <p className="text-sm font-medium text-red-600">Pattern Set Rejected</p>;
      case 'published':
        return <p className="text-sm font-medium text-blue-600">Pattern Set Published</p>;
      case 'edited':
        return <p className="text-sm font-medium text-blue-600">Pattern Details Edited</p>;
      default:
        return <p className="text-sm font-medium">{entry.action}</p>;
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin: Pattern Review - EquiPatterns</title>
        <meta name="description" content="Review and approve pending pattern submissions from contributors." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-start justify-between mb-4">
              <AdminBackButton />
              <div className="text-center flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">Pattern Review Queue</h1>
                <p className="text-sm text-muted-foreground">
                  Approve, reject, or delete pattern submissions from the community.
                </p>
              </div>
              <div className="w-[70px]" />
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Filter Tabs */}
                <Tabs value={activeFilter} onValueChange={(v) => { setActiveFilter(v); setSelectedSets(new Set()); }} className="mb-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all" className="flex items-center gap-2">
                      All <Badge variant="secondary" className="ml-1">{pendingPatterns.length + approvedPatterns.length + rejectedPatterns.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="flex items-center gap-2">
                      Pending <Badge variant="default" className="ml-1">{pendingPatterns.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="flex items-center gap-2">
                      Approved <Badge variant="secondary" className="ml-1">{approvedPatterns.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="rejected" className="flex items-center gap-2">
                      Rejected <Badge variant="destructive" className="ml-1">{rejectedPatterns.length}</Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Bulk Actions Bar */}
                {filteredSets.length > 0 && (
                  <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedSets.size === filteredSets.length && filteredSets.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedSets.size > 0 ? `${selectedSets.size} of ${filteredSets.length} selected` : `${filteredSets.length} set(s)`}
                      </span>
                    </div>
                    {selectedSets.size > 0 && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleBulkAction('approved')}>
                          <Check className="mr-1 h-3 w-3" /> Approve Selected
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleBulkAction('rejected')}>
                          <X className="mr-1 h-3 w-3" /> Reject Selected
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Filtered Pattern Sets */}
                <div className="space-y-6">
                  {filteredSets.length > 0 ? (
                    filteredSets.map((set, index) => (
                      <motion.div
                        key={`${activeFilter}-${set.setName}-${index}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <PatternSetCard
                          set={set}
                          isPendingReview={set.patterns[0]?.review_status === 'pending'}
                          setKey={`${set.setName}-${index}`}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-20 text-muted-foreground">
                      <FileText className="mx-auto h-12 w-12 mb-4" />
                      <p className="text-lg">
                        {activeFilter === 'pending' ? 'No pending patterns. Great job!' :
                         activeFilter === 'approved' ? 'No approved patterns yet.' :
                         activeFilter === 'rejected' ? 'No rejected patterns.' :
                         'No patterns found.'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </main>
      </div>

      {/* Pattern Preview Modal */}
      <PatternPreviewModal
        isOpen={previewState.isOpen}
        onClose={() => setPreviewState({ isOpen: false, pattern: null })}
        pattern={previewState.pattern}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteState.isOpen}
        onClose={() => setDeleteState({ isOpen: false, pattern: null })}
        onConfirm={handleDeletePattern}
        title="Delete Pattern Permanently?"
        description={`This will permanently delete "${deleteState.pattern?.name}" and remove it from storage. This action cannot be undone.`}
        confirmText="Delete"
      />

      {/* Email Modal */}
      {emailState.patternSet && (
        <EmailSenderModal
          isOpen={emailState.isOpen}
          onClose={() => setEmailState({ isOpen: false, patternSet: null })}
          patternSet={emailState.patternSet}
        />
      )}

      {/* Edit Pattern Dialog */}
      <Dialog open={editState.isOpen} onOpenChange={(open) => { if (!open) setEditState({ isOpen: false, pattern: null, fields: {} }); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Pattern Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Show original file name (read-only) for admin reference */}
            {editState.pattern?.original_file_name && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Original File Name</Label>
                <p className="text-sm bg-muted/50 px-3 py-1.5 rounded border text-muted-foreground">
                  {editState.pattern.original_file_name}
                </p>
              </div>
            )}
            {/* Show auto-generated display name (read-only) */}
            {editState.pattern?.display_name && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Auto-Generated Name (Public)</Label>
                <p className="text-sm bg-muted/50 px-3 py-1.5 rounded border font-medium">
                  {editState.pattern.display_name}
                </p>
              </div>
            )}
            {/* Show pattern identifier (read-only) */}
            {editState.pattern?.pattern_identifier && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Pattern Identifier</Label>
                <p className="text-sm bg-muted/50 px-3 py-1.5 rounded border font-mono text-xs">
                  {editState.pattern.pattern_identifier}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-name">Pattern Name (Internal)</Label>
              <Input
                id="edit-name"
                value={editState.fields.name || ''}
                onChange={(e) => setEditState(prev => ({ ...prev, fields: { ...prev.fields, name: e.target.value } }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-class">Discipline / Class</Label>
              <Input
                id="edit-class"
                value={editState.fields.class_name || ''}
                onChange={(e) => setEditState(prev => ({ ...prev, fields: { ...prev.fields, class_name: e.target.value } }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-level">Level</Label>
              <Select
                value={editState.fields.level || ''}
                onValueChange={(value) => setEditState(prev => ({ ...prev, fields: { ...prev.fields, level: value === 'none' ? '' : value } }))}
              >
                <SelectTrigger id="edit-level">
                  <SelectValue placeholder="Select a level (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Level</SelectItem>
                  {PATTERN_LEVELS.map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-set">Pattern Set Name</Label>
              <Input
                id="edit-set"
                value={editState.fields.pattern_set_name || ''}
                onChange={(e) => setEditState(prev => ({ ...prev, fields: { ...prev.fields, pattern_set_name: e.target.value } }))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-verbiage">Verbiage / Instructions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleRegenerateLanguage}
                  disabled={isRegeneratingLanguage || !editState.pattern?.file_url}
                  title={!editState.pattern?.file_url ? 'No source PDF available' : 'Re-run extraction on the stored PDF'}
                >
                  {isRegeneratingLanguage ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3 w-3" />
                  )}
                  Regenerate Language
                </Button>
              </div>
              <Textarea
                id="edit-verbiage"
                placeholder="Pattern description, maneuver instructions, or notes..."
                value={editState.fields.verbiage || ''}
                onChange={(e) => setEditState(prev => ({ ...prev, fields: { ...prev.fields, verbiage: e.target.value } }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditState({ isOpen: false, pattern: null, fields: {} })}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Email Modal (Approve/Reject) */}
      <ReviewEmailModal
        isOpen={reviewEmailState.isOpen}
        onClose={() => setReviewEmailState({ isOpen: false, patternSet: null, reviewType: null, onConfirm: null })}
        patternSet={reviewEmailState.patternSet}
        reviewType={reviewEmailState.reviewType}
        onConfirm={reviewEmailState.onConfirm}
      />

      {/* Change History Dialog */}
      <Dialog open={historyState.isOpen} onOpenChange={(open) => { if (!open) setHistoryState({ isOpen: false, setName: null, history: [], isLoading: false }); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Change History: {historyState.setName}
            </DialogTitle>
          </DialogHeader>
          {historyState.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : historyState.history.length > 0 ? (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3 pr-4">
                {historyState.history.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-3 bg-muted/20">
                    <div className="flex justify-between items-start mb-1">
                      {formatHistoryAction(entry)}
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                    {entry.admin_email && (
                      <p className="text-xs text-muted-foreground">
                        By: {entry.admin_email}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No change history found for this pattern set.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminPatternReviewPage;
