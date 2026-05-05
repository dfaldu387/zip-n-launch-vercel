import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { Package, Ruler, CalendarDays, Truck, MapPin, ClipboardCheck, RefreshCcw, FileBarChart, Calculator } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import Navigation from '@/components/Navigation';

const sections = [
  {
    name: 'Master Equipment List',
    path: '/horse-show-manager/equipment',
    icon: Package,
    description: 'Manage your complete equipment inventory. Add, edit, and track all items by category and condition.',
    step: '1',
  },
  {
    name: 'Discipline & Class Planner',
    path: '/horse-show-manager/discipline-planner',
    icon: Ruler,
    description: 'Define equipment profiles for disciplines and create reusable class templates.',
    step: '2',
  },
  {
    name: 'Arena Schedule & Equipment Needs',
    path: '/horse-show-manager/arena-sessions',
    icon: CalendarDays,
    description: 'Build arena sessions, assign class templates, and auto-calculate equipment requirements.',
    step: '3',
    subLink: { label: 'Equipment Requirements', path: '/horse-show-manager/equipment-requirements', icon: Calculator },
  },
  {
    name: 'Distribution Plan',
    path: '/horse-show-manager/distribution-plan',
    icon: Truck,
    description: 'Auto-generate equipment distribution to arenas based on calculated requirements.',
    step: '4',
  },
  {
    name: 'Locations',
    path: '/horse-show-manager/locations',
    icon: MapPin,
    description: 'Define locations where equipment is stored, staged, or used during shows.',
    step: '5',
  },
  {
    name: 'Check-In / Check-Out',
    path: '/horse-show-manager/equipment-check-in-out',
    icon: ClipboardCheck,
    description: 'Track equipment check-ins, check-outs, and transfers between arenas during events.',
    step: '6',
  },
  {
    name: 'Reconciliation / Clean-Up',
    path: '/horse-show-manager/reconciliation',
    icon: RefreshCcw,
    description: 'Compare planned vs actual, identify missing or damaged items, and reset for the next show.',
    step: '7',
  },
  {
    name: 'Reports',
    path: '/horse-show-manager/equipment-reports',
    icon: FileBarChart,
    description: 'Generate printable arena kit lists, daily summaries, shortage reports, and distribution reports.',
    step: '8',
  },
];

const EquipmentPlanningHubPage = () => {
  const { showId } = useParams();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Helmet><title>Equipment Planning - EquiPatterns</title></Helmet>
      <Navigation />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <PageHeader title="Equipment Planning" backTo={showId ? `/horse-show-manager/show/${showId}` : '/horse-show-manager'} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section, index) => (
            <motion.div
              key={section.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={section.path} className="block h-full">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 flex flex-col h-full border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary">
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-3 rounded-full mr-4">
                      <section.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Step {section.step}</span>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">{section.name}</h2>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm flex-grow">{section.description}</p>
                  {section.subLink && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <Link
                        to={section.subLink.path}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <section.subLink.icon className="h-3 w-3" />
                        {section.subLink.label}
                      </Link>
                    </div>
                  )}
                  <div className="mt-4 text-right">
                    <span className="text-primary font-semibold text-sm">Open &rarr;</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default EquipmentPlanningHubPage;
