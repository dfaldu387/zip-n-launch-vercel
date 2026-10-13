import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plane, Hotel, Car, MapPin, LayoutDashboard, Save, Loader2, Download } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabaseClient';
import { flattenPersonnel, isBudgetFrozen } from '@/lib/contractUtils';
import { BudgetFrozenBanner } from '@/components/contract-management/BudgetFrozenBanner';
import { exportTravelToExcel } from '@/lib/travelExport';

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

  const [contractProjects, setContractProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [contractSettings, setContractSettings] = useState({});
  const [travelData, setTravelData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showName, setShowName] = useState('');
  const [budgetFrozen, setBudgetFrozen] = useState(false);
  const [showProject, setShowProject] = useState(null); // the show, when opened from one

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
    setTravelData(mergeTravelDefaults(
      flatPersonnel,
      formData.travelData || {},
      formData.contractSettings?.effectiveDate || '',
      formData.contractSettings?.expirationDate || '',
    ));
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
    setTravelData(mergeTravelDefaults(people, pd.travelData || {}, settings.effectiveDate, settings.expirationDate));
  }, [showId, showProject]);

  // Save travel data back into the contract project
  const handleSave = useCallback(async () => {
    if (!user) return;

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
          toast({ title: 'Show Locked', description: 'Unlock the show to save travel data.', variant: 'destructive' });
          return;
        }
        const updatedProjectData = { ...latest, travelData };
        const { error } = await supabase
          .from('projects')
          .update({ project_data: updatedProjectData })
          .eq('id', showId);
        if (error) throw error;
        setShowProject((prev) => (prev ? { ...prev, project_data: updatedProjectData } : prev));
        toast({ title: 'Travel Data Saved', description: 'All travel information has been saved.' });
      } catch (error) {
        toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!selectedProjectId) return;

    setIsSaving(true);
    try {
      const project = contractProjects.find((p) => p.id === selectedProjectId);
      if (!project) throw new Error('Project not found');

      const updatedProjectData = {
        ...project.project_data,
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

      toast({ title: 'Travel Data Saved', description: 'All travel information has been saved.' });
    } catch (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [user, showId, showProject, selectedProjectId, travelData, contractProjects, toast]);

  // Travel is ready to edit once there is a show (show mode) or a contract project.
  const hasSource = showId ? !!showProject : !!selectedProjectId;

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
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={!hasSource || personnel.length === 0} onClick={() => exportTravelToExcel({ personnel, travelData, showName })}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
                <Button onClick={handleSave} disabled={isSaving || !hasSource}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Travel Data
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
              <Tabs defaultValue="overview">
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
                  />
                </TabsContent>

                <TabsContent value="flights">
                  <FlightsTab
                    personnel={personnel}
                    travelData={travelData}
                    setTravelData={setTravelData}
                    budgetFrozen={budgetFrozen}
                  />
                </TabsContent>

                <TabsContent value="hotels">
                  <HotelsTab
                    personnel={personnel}
                    travelData={travelData}
                    setTravelData={setTravelData}
                    budgetFrozen={budgetFrozen}
                  />
                </TabsContent>

                <TabsContent value="rental-cars">
                  <RentalCarsTab
                    personnel={personnel}
                    travelData={travelData}
                    setTravelData={setTravelData}
                    budgetFrozen={budgetFrozen}
                  />
                </TabsContent>

                <TabsContent value="mileage">
                  <MileageTab
                    personnel={personnel}
                    travelData={travelData}
                    setTravelData={setTravelData}
                    budgetFrozen={budgetFrozen}
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

/**
 * Start from the saved travel data and add a default entry for anyone new. Costs a
 * person already has as reimbursable expenses are copied in when the travel entry
 * has none yet. Same rules for a contract project and for a show's staff list.
 */
function mergeTravelDefaults(flatPersonnel, saved, eventStart, eventEnd) {
  const merged = { ...saved };

  for (const member of flatPersonnel) {
    const expenses = member.reimbursable_expenses || {};
    const airfareExp = expenses.airfare;
    const hotelExp = expenses.hotel;
    const rentalCarExp = expenses.rentalCar;
    const mileageExp = expenses.mileage;

    if (!merged[member.id]) {
      // New member: create entry with dates from the person, else from the event
      const start = airfareExp?.start_date || member.employment_start_date || eventStart;
      const end = airfareExp?.end_date || member.employment_end_date || eventEnd;
      merged[member.id] = {
        travelStart: start ? shiftDate(start, -1) : '',
        travelEnd: end ? shiftDate(end, 1) : '',
      };
    }

    // Sync expense data into the travel entry if not already set
    const entry = merged[member.id];
    if (!entry.flight?.cost && airfareExp?.reimbursed) {
      entry.flight = { ...entry.flight, cost: parseFloat(airfareExp.max_value) || 0 };
    }
    if (!entry.hotel?.cost && hotelExp?.reimbursed) {
      entry.hotel = {
        ...entry.hotel,
        cost: parseFloat(hotelExp.total) || parseFloat(hotelExp.max_value) || 0,
        checkIn: entry.hotel?.checkIn || hotelExp.start_date || '',
        checkOut: entry.hotel?.checkOut || hotelExp.end_date || '',
      };
    }
    if (!entry.rentalCar?.cost && rentalCarExp?.reimbursed) {
      entry.rentalCar = { ...entry.rentalCar, cost: parseFloat(rentalCarExp.total) || parseFloat(rentalCarExp.max_value) || 0 };
    }
    if (!entry.mileage?.cost && mileageExp?.reimbursed) {
      entry.mileage = { ...entry.mileage, cost: parseFloat(mileageExp.total) || 0 };
    }
  }

  return merged;
}

/** Shift an ISO date string by N days */
function shiftDate(dateStr, days) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export default TravelManagementPage;
