import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plane, Hotel, Car, MapPin, LayoutDashboard, Save, Loader2, Download, CheckCircle2, CircleDashed, AlertCircle } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabaseClient';
import { flattenPersonnel, isBudgetFrozen } from '@/lib/contractUtils';
import { mergeTravelDefaults, applyExpenseType, hasEnteredTravel } from '@/lib/travelDefaults';
import { BudgetFrozenBanner } from '@/components/contract-management/BudgetFrozenBanner';
import { exportTravelToExcel } from '@/lib/travelExport';
import { applySubmissions } from '@/lib/travelRequests';

import OverviewTab from '@/components/travel-management/OverviewTab';
import FlightsTab from '@/components/travel-management/FlightsTab';
import HotelsTab from '@/components/travel-management/HotelsTab';
import RentalCarsTab from '@/components/travel-management/RentalCarsTab';
import MileageTab from '@/components/travel-management/MileageTab';

const TravelManagementPage = () => {
  const navigate = useNavigate();
  const { showId } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [contractProjects, setContractProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [contractSettings, setContractSettings] = useState({});
  const [travelData, setTravelData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [showName, setShowName] = useState('');
  const [budgetFrozen, setBudgetFrozen] = useState(false);
  const [showProject, setShowProject] = useState(null); // the show, when opened from one
  const failedSnapshotRef = useRef(null); // a failed auto-save is not retried until the data changes again
  const savedSnapshotRef = useRef(null); // JSON of travelData as last loaded or saved; edits differ from it

  // Load the show (when opened from one) or the contract projects from Supabase
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) { setIsLoading(false); return; }
      setIsLoading(true);
      try {
        if (showId) {
          const { data: showRow, error: showError } = await supabase
            .from('projects')
            .select('id, project_name, project_type, project_data')
            .eq('id', showId)
            .maybeSingle();
          if (showError) throw showError;
          setShowProject(showRow || null);
          return;
        }

        const { data, error } = await supabase
          .from('projects')
          .select('id, project_name, project_type, project_data, created_at')
          .eq('project_type', 'contract')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setContractProjects(data || []);

        // No show given: keep the old behaviour (first contract project).
        if (data?.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data[0].id);
        }
      } catch (error) {
        toast({ title: 'Error loading projects', description: error.message, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [user?.id, showId]);

  // When a project is selected, extract personnel and auto-initialize travel data
  useEffect(() => {
    if (showId) return; // show mode is handled by the effect below
    if (!selectedProjectId) {
      setPersonnel([]);
      setContractSettings({});
      setTravelData({});
      setShowName('');
      return;
    }

    const project = contractProjects.find((p) => p.id === selectedProjectId);
    if (!project?.project_data) return;

    const formData = project.project_data;
    const flatPersonnel = flattenPersonnel(formData);
    setPersonnel(flatPersonnel);
    setContractSettings(formData.contractSettings || {});
    setShowName(formData.showName || project.project_name || '');
    setBudgetFrozen(isBudgetFrozen(formData));

    // Load saved travel data, then auto-fill defaults for any new personnel
    const merged = mergeTravelDefaults(
      flatPersonnel,
      formData.travelData || {},
      formData.contractSettings?.effectiveDate || '',
      formData.contractSettings?.expirationDate || '',
    );
    savedSnapshotRef.current = JSON.stringify(merged);
    setTravelData(merged);
  }, [selectedProjectId, contractProjects, showId]);

  // Opened from a show: the people are the show's own Officials & Staff list (the same
  // one used by Show Structure, Budgeting and Employee Scheduling) plus any names added
  // by hand on the Employee Management page. No contract project is needed.
  useEffect(() => {
    if (!showId || !showProject) return;
    const pd = showProject.project_data || {};

    const fromOfficials = flattenPersonnel({ showDetails: { officials: pd.showDetails?.officials || {} } })
      .filter((m) => (m.name || '').trim());
    const seen = new Set(fromOfficials.map((m) => m.id));
    const manual = (pd.staffSchedule?.roster || [])
      .filter((e) => e && e.id && !seen.has(e.id) && (e.name || '').trim())
      .map((e) => ({ id: e.id, name: e.name, roleName: 'Added by hand', reimbursable_expenses: {} }));
    const people = [...fromOfficials, ...manual];

    const settings = { effectiveDate: pd.startDate || '', expirationDate: pd.endDate || '' };
    setPersonnel(people);
    setContractSettings(settings);
    setShowName(showProject.project_name || pd.showName || '');
    setBudgetFrozen(false);
    const merged = mergeTravelDefaults(people, pd.travelData || {}, settings.effectiveDate, settings.expirationDate);
    // Only the first load sets the baseline; a re-render after our own save must not reset it.
    if (savedSnapshotRef.current === null) savedSnapshotRef.current = JSON.stringify(merged);
    // Answers staff sent through the emailed link are folded in here; being different from the
    // baseline, they get saved by the normal auto-save.
    setTravelData(applySubmissions(merged, pd.travelSubmissions));
  }, [showId, showProject]);

  // Save travel data back into the contract project
  const handleSave = useCallback(async (opts) => {
    const silent = opts?.silent === true; // auto-save: no success toast, no locked-show toast
    if (!user) return;
    const snapshot = JSON.stringify(travelData);

    // Opened from a show: travel data lives on the show itself.
    if (showId) {
      if (!showProject) return;
      setIsSaving(true);
      try {
        // Build on the newest saved copy so staff, bookings or schedule saved by other
        // pages since this one loaded are not written back to their old values.
        const { data: latestRow, error: readError } = await supabase
          .from('projects')
          .select('project_data')
          .eq('id', showId)
          .maybeSingle();
        if (readError) throw readError;
        const latest = latestRow?.project_data || showProject.project_data || {};
        if (latest.isShowLocked === true) {
          if (silent) return;
          toast({ title: 'Show Locked', description: 'Unlock the show to save travel data.', variant: 'destructive' });
          return;
        }
        const updatedProjectData = { ...latest, travelData };
        const { error } = await supabase
          .from('projects')
          .update({ project_data: updatedProjectData })
          .eq('id', showId);
        if (error) throw error;
        savedSnapshotRef.current = snapshot;
        setLastSavedAt(new Date());
        setShowProject((prev) => (prev ? { ...prev, project_data: updatedProjectData } : prev));
        if (!silent) toast({ title: 'Travel Data Saved', description: 'All travel information has been saved.' });
      } catch (error) {
        failedSnapshotRef.current = snapshot;
        toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!selectedProjectId) return;

    setIsSaving(true);
    try {
      // Build on the newest saved copy of the contract project, not the one loaded
      // with this page, so contract changes saved since then are not written back.
      const { data: latestRow, error: readError } = await supabase
        .from('projects')
        .select('project_data')
        .eq('id', selectedProjectId)
        .maybeSingle();
      if (readError) throw readError;
      if (!latestRow?.project_data) throw new Error('Project not found');

      const updatedProjectData = {
        ...latestRow.project_data,
        travelData,
      };

      const { error } = await supabase
        .from('projects')
        .update({ project_data: updatedProjectData })
        .eq('id', selectedProjectId);

      if (error) throw error;

      // Update local cache
      setContractProjects((prev) =>
        prev.map((p) => (p.id === selectedProjectId ? { ...p, project_data: updatedProjectData } : p))
      );

      savedSnapshotRef.current = snapshot;
      setLastSavedAt(new Date());
      if (!silent) toast({ title: 'Travel Data Saved', description: 'All travel information has been saved.' });
    } catch (error) {
      failedSnapshotRef.current = snapshot;
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [user, showId, showProject, selectedProjectId, travelData, contractProjects, toast]);

  // Auto-save: one second after the last edit, save quietly. Only real edits differ from
  // the snapshot taken at load/save time, so just opening the page never writes anything.
  useEffect(() => {
    if (isLoading || isSaving || budgetFrozen) return;
    if (savedSnapshotRef.current === null) return;
    const current = JSON.stringify(travelData);
    if (current === savedSnapshotRef.current || current === failedSnapshotRef.current) return;
    const t = setTimeout(() => { handleSave({ silent: true }); }, 1000);
    return () => clearTimeout(t);
  }, [travelData, isLoading, isSaving, budgetFrozen, handleSave]);

  // What the header shows: saving, failed, waiting to save, or all saved.
  const currentSnapshot = JSON.stringify(travelData);
  const saveState = isSaving
    ? 'saving'
    : failedSnapshotRef.current !== null && currentSnapshot === failedSnapshotRef.current
      ? 'failed'
      : savedSnapshotRef.current !== null && currentSnapshot !== savedSnapshotRef.current
        ? 'pending'
        : 'saved';

  // Travel is ready to edit once there is a show (show mode) or a contract project.
  const hasSource = showId ? !!showProject : !!selectedProjectId;

  // Each travel tab lists only the people whose box for that need is checked in
  // Officials & Staff. Anyone who already has details saved for that need stays listed
  // so nothing already entered disappears.
  // Expense Type (Direct / Reimbursement) lives on the person in Officials & Staff, the same
  // value Contract and Budgeting read. Travel edits that value instead of keeping its own.
  const handleExpenseTypeChange = async (memberId, expenseKey, value) => {
    if (!user) return;
    const notFound = () => toast({ title: 'Could not change', description: 'This person is not on the Officials & Staff list.', variant: 'destructive' });
    try {
      if (showId) {
        const { data: row, error: readError } = await supabase.from('projects').select('project_data').eq('id', showId).maybeSingle();
        if (readError) throw readError;
        const latest = row?.project_data || showProject?.project_data || {};
        if (latest.isShowLocked === true) {
          toast({ title: 'Show Locked', description: 'Unlock the show to change the expense type.', variant: 'destructive' });
          return;
        }
        const next = applyExpenseType(latest, memberId, expenseKey, value);
        if (!next) return notFound();
        const updated = { ...next, travelData };
        const { error } = await supabase.from('projects').update({ project_data: updated }).eq('id', showId);
        if (error) throw error;
        setShowProject((prev) => (prev ? { ...prev, project_data: updated } : prev));
      } else if (selectedProjectId) {
        const { data: row, error: readError } = await supabase.from('projects').select('project_data').eq('id', selectedProjectId).maybeSingle();
        if (readError) throw readError;
        const next = applyExpenseType(row?.project_data, memberId, expenseKey, value);
        if (!next) return notFound();
        const updated = { ...next, travelData };
        const { error } = await supabase.from('projects').update({ project_data: updated }).eq('id', selectedProjectId);
        if (error) throw error;
        setContractProjects((prev) => prev.map((p) => (p.id === selectedProjectId ? { ...p, project_data: updated } : p)));
      }
    } catch (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    }
  };

  const forNeed = (expenseId, travelKey) =>
    personnel.filter((m) => {
      if (m.reimbursable_expenses?.[expenseId]?.reimbursed) return true;
      return hasEnteredTravel(travelData[m.id], travelKey);
    });
  const noNeedMessage = (label) =>
    personnel.length === 0
      ? undefined
      : `Nobody has ${label} checked in Officials & Staff. Check the box for a person there and they will appear here.`;

  return (
    <>
      <Helmet>
        <title>Travel Management - Horse Show Manager</title>
        <meta name="description" content="Manage flights, hotels, and rental cars for show personnel." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" onClick={() => navigate(`/horse-show-manager/employee-scheduling${showId ? `/${showId}` : ''}`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                {hasSource && (
                  <span
                    className={
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ' +
                      (saveState === 'saved' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : saveState === 'failed' ? 'border-destructive/30 bg-destructive/10 text-destructive'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400')
                    }
                    aria-live="polite"
                  >
                    {saveState === 'saving' && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>}
                    {saveState === 'pending' && <><CircleDashed className="h-3.5 w-3.5" /> Unsaved changes</>}
                    {saveState === 'failed' && <><AlertCircle className="h-3.5 w-3.5" /> Not saved. Click Save now</>}
                    {saveState === 'saved' && (
                      <><CheckCircle2 className="h-3.5 w-3.5" /> {lastSavedAt ? `Saved at ${lastSavedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'All changes saved'}</>
                    )}
                  </span>
                )}
                <Button variant="outline" disabled={!hasSource || personnel.length === 0} onClick={() => exportTravelToExcel({ personnel, travelData, showName })}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
                <Button variant="outline" onClick={() => handleSave()} disabled={isSaving || !hasSource}>
                  <Save className="mr-2 h-4 w-4" />
                  Save now
                </Button>
              </div>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight mb-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-sky-400">
              Travel Management
            </h1>
            <p className="text-muted-foreground">
              Manage flights, hotels, and rental cars for your show personnel.
            </p>
          </motion.div>

          {/* Project selector */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <label className="text-sm font-medium whitespace-nowrap">
                    {showId ? 'Show:' : 'Select Contract Project:'}
                  </label>
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  ) : showId ? (
                    showProject ? (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1">
                        <span className="text-sm font-semibold">{showName}</span>
                        <span className="text-xs text-muted-foreground">
                          {personnel.length} {personnel.length === 1 ? 'person' : 'people'} from Officials &amp; Staff
                        </span>
                        {personnel.length === 0 && (
                          <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate(`/horse-show-manager/employee-scheduling/assign/${showId}`)}>
                            Add staff first
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">This show could not be found.</p>
                    )
                  ) : contractProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No contract projects found.{' '}
                      <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/horse-show-manager/employee-management/contracts')}>
                        Create one first
                      </Button>
                    </p>
                  ) : (
                    <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
                      <SelectTrigger className="w-full sm:w-80">
                        <SelectValue placeholder="Choose a contract project..." />
                      </SelectTrigger>
                      <SelectContent>
                        {contractProjects.map((p) => {
                          const name = p.project_data?.showName || p.project_name || 'Untitled';
                          const date = p.project_data?.contractSettings?.effectiveDate?.slice(0, 4);
                          return (
                            <SelectItem key={p.id} value={p.id}>
                              {name}{date ? ` - ${date}` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {showName && (
                    <span className="text-sm text-muted-foreground ml-auto hidden sm:inline">
                      {personnel.length} personnel loaded
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tabs */}
          {hasSource && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {budgetFrozen && <div className="mb-4"><BudgetFrozenBanner /></div>}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="overview" className="gap-1.5">
                    <LayoutDashboard className="h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="flights" className="gap-1.5">
                    <Plane className="h-4 w-4" />
                    Flights
                  </TabsTrigger>
                  <TabsTrigger value="hotels" className="gap-1.5">
                    <Hotel className="h-4 w-4" />
                    Hotels
                  </TabsTrigger>
                  <TabsTrigger value="rental-cars" className="gap-1.5">
                    <Car className="h-4 w-4" />
                    Rental Cars
                  </TabsTrigger>
                  <TabsTrigger value="mileage" className="gap-1.5">
                    <MapPin className="h-4 w-4" />
                    Mileage
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <OverviewTab
                    personnel={personnel}
                    travelData={travelData}
                    setTravelData={setTravelData}
                    contractSettings={contractSettings}
                    onGoToTab={setActiveTab}
                    showId={showId}
                    travelRequests={showProject?.project_data?.travelRequests}
                    travelSubmissions={showProject?.project_data?.travelSubmissions}
                    travelActivity={showProject?.project_data?.travelActivity}
                  />
                </TabsContent>

                <TabsContent value="flights">
                  <FlightsTab
                    personnel={forNeed('airfare', 'flight')}
                    emptyMessage={noNeedMessage('Airfare')}
                    travelData={travelData}
                    setTravelData={setTravelData}
                    budgetFrozen={budgetFrozen}
                    storageKey={showId || selectedProjectId}
                    onExpenseTypeChange={handleExpenseTypeChange}
                    expenseTypeLocked={!!showProject?.project_data?.isShowLocked}
                  />
                </TabsContent>

                <TabsContent value="hotels">
                  <HotelsTab
                    personnel={forNeed('hotel', 'hotel')}
                    emptyMessage={noNeedMessage('Hotel')}
                    travelData={travelData}
                    setTravelData={setTravelData}
                    budgetFrozen={budgetFrozen}
                    storageKey={showId || selectedProjectId}
                    onExpenseTypeChange={handleExpenseTypeChange}
                    expenseTypeLocked={!!showProject?.project_data?.isShowLocked}
                  />
                </TabsContent>

                <TabsContent value="rental-cars">
                  <RentalCarsTab
                    personnel={forNeed('rentalCar', 'rentalCar')}
                    emptyMessage={noNeedMessage('Rental Car')}
                    travelData={travelData}
                    setTravelData={setTravelData}
                    budgetFrozen={budgetFrozen}
                    storageKey={showId || selectedProjectId}
                    onExpenseTypeChange={handleExpenseTypeChange}
                    expenseTypeLocked={!!showProject?.project_data?.isShowLocked}
                  />
                </TabsContent>

                <TabsContent value="mileage">
                  <MileageTab
                    personnel={forNeed('mileage', 'mileage')}
                    emptyMessage={noNeedMessage('Mileage')}
                    travelData={travelData}
                    setTravelData={setTravelData}
                    budgetFrozen={budgetFrozen}
                    storageKey={showId || selectedProjectId}
                    onExpenseTypeChange={handleExpenseTypeChange}
                    expenseTypeLocked={!!showProject?.project_data?.isShowLocked}
                  />
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </main>
      </div>
    </>
  );
};

export default TravelManagementPage;
