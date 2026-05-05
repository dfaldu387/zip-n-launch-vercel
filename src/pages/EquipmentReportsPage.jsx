import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { FileBarChart, Loader2, ArrowLeft, ClipboardList, AlertTriangle, Truck, FileText, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useEquipmentReports } from '@/hooks/useEquipmentReports';

const reportTypes = [
  {
    id: 'arena-kit-list',
    title: 'Arena Kit List',
    description: 'Printable checklist of equipment needed per arena with checkboxes and setup notes.',
    icon: ClipboardList,
    countKey: 'arenaCount',
    countLabel: 'arenas',
  },
  {
    id: 'daily-summary',
    title: 'Daily Equipment Summary',
    description: 'Overview of all equipment: owned, planned, checked in/out, and available quantities grouped by category.',
    icon: FileText,
    countKey: 'dailyItems',
    countLabel: 'items',
  },
  {
    id: 'shortage',
    title: 'Shortage Report',
    description: 'Identifies equipment where required quantities exceed owned inventory.',
    icon: AlertTriangle,
    countKey: 'shortageCount',
    countLabel: 'shortages',
  },
  {
    id: 'distribution-by-location',
    title: 'Distribution by Location',
    description: 'Equipment assignments grouped by arena/location for logistics planning.',
    icon: Truck,
    countKey: 'arenaCount',
    countLabel: 'locations',
  },
];

const EquipmentReportsPage = () => {
  const navigate = useNavigate();
  const {
    shows, isShowsLoading, selectedShow,
    reportData, isLoading, isGenerating,
    fetchUserShows, selectShow, generateReport,
  } = useEquipmentReports();

  useEffect(() => { fetchUserShows(); }, [fetchUserShows]);

  const handleShowChange = (showId) => {
    const show = shows.find(s => s.id === showId);
    selectShow(show || null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Helmet><title>Equipment Reports - EquiPatterns</title></Helmet>
      <Navigation />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate('/horse-show-manager/equipment-planning')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Equipment Planning
          </Button>
        </div>

        <header className="mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <FileBarChart className="h-9 w-9 text-primary" /> Reports
          </h1>
          <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
            Generate printable PDF reports for equipment planning and operations.
          </p>
        </header>

        {/* Show Selector */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Select Show</label>
            <Select
              value={selectedShow?.id || ''}
              onValueChange={handleShowChange}
              disabled={isShowsLoading}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder={isShowsLoading ? 'Loading shows...' : 'Choose a show'} />
              </SelectTrigger>
              <SelectContent>
                {shows.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {!selectedShow ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileBarChart className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Select a show to view available reports.</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reportTypes.map((report, index) => {
              const ReportIcon = report.icon;
              const count = reportData?.counts?.[report.countKey] || 0;
              const hasData = count > 0 || report.id === 'shortage';

              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Card className="h-full flex flex-col">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-3 rounded-full">
                          <ReportIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{report.title}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            {count} {report.countLabel}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <CardDescription className="text-sm">{report.description}</CardDescription>
                    </CardContent>
                    <CardFooter>
                      <Button
                        onClick={() => generateReport(report.id)}
                        disabled={isGenerating || (!hasData && report.id !== 'shortage')}
                        className="w-full"
                      >
                        {isGenerating ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                        ) : (
                          <><Download className="mr-2 h-4 w-4" />Generate PDF</>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default EquipmentReportsPage;
