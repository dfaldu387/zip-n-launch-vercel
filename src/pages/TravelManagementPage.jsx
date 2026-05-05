import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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

  // Load contract projects from Supabase
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, project_name, project_type, project_data, created_at')
          .eq('project_type', 'contract')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setContractProjects(data || []);

        // Auto-select first project if available
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
  }, []);

  // When a project is selected, extract personnel and auto-initialize travel data
  useEffect(() => {
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
    const saved = formData.travelData || {};
    const eventStart = formData.contractSettings?.effectiveDate || '';
    const eventEnd = formData.contractSettings?.expirationDate || '';
    const merged = { ...saved };

    for (const member of flatPersonnel) {
      const expenses = member.reimbursable_expenses || {};
      const airfareExp = expenses.airfare;
      const hotelExp = expenses.hotel;
      const rentalCarExp = expenses.rentalCar;
      const mileageExp = expenses.mileage;

      if (!merged[member.id]) {
        // New member: create entry with dates from contract
        const start = airfareExp?.start_date || member.employment_start_date || eventStart;
        const end = airfareExp?.end_date || member.employment_end_date || eventEnd;
        merged[member.id] = {
          travelStart: start ? shiftDate(start, -1) : '',
          travelEnd: end ? shiftDate(end, 1) : '',
        };
      }

      // Always sync contract expense data into travel entry if not already set
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

    setTravelData(merged);
  }, [selectedProjectId, contractProjects]);

  // Save travel data back into the contract project
  const handleSave = useCallback(async () => {
    if (!user || !selectedProjectId) return;

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
  }, [user, selectedProjectId, travelData, contractProjects, toast]);

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
              <Button variant="ghost" onClick={() => navigate('/horse-show-manager/employee-scheduling')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={!selectedProjectId || personnel.length === 0} onClick={() => exportTravelToExcel({ personnel, travelData, showName })}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
                <Button onClick={handleSave} disabled={isSaving || !selectedProjectId}>
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
                  <label className="text-sm font-medium whitespace-nowrap">Select Contract Project:</label>
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
                    </div>
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
          {selectedProjectId && (
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
