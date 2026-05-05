import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import Navigation from '@/components/Navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Loader2, Calendar, MapPin,
  CalendarDays, FileText, DollarSign, LayoutGrid, Building2,
  Radio, Award, Edit, ChevronRight, Users, ClipboardList,
  BarChart3, Warehouse, Check, Lock, Circle, ChevronDown, BookOpen,
  Download, Unlock, ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { generateShowPacketPdf } from '@/lib/showPacketPdfGenerator';
import { getAllClassItems } from '@/lib/showBillUtils';
import { useModuleStatus } from '@/hooks/useModuleStatus';
import { MODULE_STATUS, STATUS_META, migrateLegacyStatus, canGeneratePdf } from '@/lib/moduleStatusService';
import { ModuleStatusBadge } from '@/components/show-builder/ModuleStatusBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/* ── Module card ── */

const ModuleCard = ({ icon: Icon, title, description, to, color = 'blue', status, moduleKey, onStatusChange, comingSoon, isShowLocked }) => {
  const { toast } = useToast();
  const colorMap = {
    blue: 'bg-blue-100 dark:bg-blue-950/40 text-blue-600',
    emerald: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600',
    amber: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600',
    violet: 'bg-violet-100 dark:bg-violet-950/40 text-violet-600',
    rose: 'bg-rose-100 dark:bg-rose-950/40 text-rose-600',
    sky: 'bg-sky-100 dark:bg-sky-950/40 text-sky-600',
    indigo: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600',
  };

  const meta = STATUS_META[status] || STATUS_META[MODULE_STATUS.NOT_STARTED];
  const borderClass = meta.borderColor || '';

  const handleClick = (e) => {
    if (comingSoon) {
      e.preventDefault();
      toast({ title: 'Coming Soon!', description: "This feature isn't implemented yet — stay tuned!" });
    } else if (isShowLocked) {
      e.preventDefault();
      toast({ title: 'Show Locked', description: 'Unlock the show to access this module.', variant: 'destructive' });
    }
  };

  const isClickable = !comingSoon && !isShowLocked;
  const Wrapper = isClickable ? Link : 'div';
  const wrapperProps = isClickable ? { to } : { onClick: handleClick };

  return (
    <Wrapper {...wrapperProps}>
      <motion.div whileHover={{ y: isClickable ? -2 : 0 }} className="h-full">
        <Card className={cn(
          'h-full transition-all',
          isClickable ? 'cursor-pointer hover:border-blue-300 hover:shadow-md' : 'cursor-not-allowed',
          comingSoon && 'hover:border-amber-300 hover:shadow-md cursor-pointer',
          borderClass,
          isShowLocked && !comingSoon && 'opacity-75',
        )}>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className={cn('p-2.5 rounded-lg shrink-0', colorMap[color] || colorMap.blue)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-sm text-foreground">{title}</h3>
                  {!comingSoon && (
                    <ModuleStatusBadge
                      status={status}
                      moduleKey={moduleKey}
                      isShowLocked={isShowLocked}
                      onStatusChange={onStatusChange}
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
              </div>
              <ChevronRight className={cn('h-4 w-4 shrink-0 mt-1', isShowLocked ? 'text-muted-foreground/30' : 'text-muted-foreground')} />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Wrapper>
  );
};

/* ── Overall progress bar ── */

const OverallProgress = ({ modules }) => {
  const allItems = modules.flatMap(s => s.items);
  const total = allItems.length;
  const published = allItems.filter(m => m.status === MODULE_STATUS.PUBLISHED).length;
  const locked = allItems.filter(m => m.status === MODULE_STATUS.LOCKED).length;
  const draft = allItems.filter(m => m.status === MODULE_STATUS.DRAFT).length;
  const inProgress = allItems.filter(m => m.status === MODULE_STATUS.IN_PROGRESS).length;
  const pct = total > 0 ? Math.round(((published + locked) / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Show Progress</span>
        <span className="text-muted-foreground text-xs">
          {published} published
          {locked > 0 && ` · ${locked} locked`}
          {draft > 0 && ` · ${draft} draft`}
          {inProgress > 0 && ` · ${inProgress} in progress`}
        </span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
        {published > 0 && (
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(published / total) * 100}%` }}
          />
        )}
        {locked > 0 && (
          <div
            className="h-full bg-amber-400 transition-all duration-500"
            style={{ width: `${(locked / total) * 100}%` }}
          />
        )}
        {draft > 0 && (
          <div
            className="h-full bg-orange-300 transition-all duration-500"
            style={{ width: `${(draft / total) * 100}%` }}
          />
        )}
        {inProgress > 0 && (
          <div
            className="h-full bg-blue-300 transition-all duration-500"
            style={{ width: `${(inProgress / total) * 100}%` }}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{pct}% finalized ({published + locked}/{total})</p>
    </div>
  );
};

/* ── Page ── */

const ShowWorkspacePage = () => {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [show, setShow] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkedContracts, setLinkedContracts] = useState([]);
  const [associationsData, setAssociationsData] = useState([]);
  const [isGeneratingPacket, setIsGeneratingPacket] = useState(false);

  useEffect(() => {
    const fetchShow = async () => {
      if (!user || !showId) { setIsLoading(false); return; }

      const [showRes, contractsRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, project_name, project_data, status, created_at')
          .eq('id', showId)
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('projects')
          .select('id, project_data, status')
          .eq('user_id', user.id)
          .eq('project_type', 'contract')
          .filter('project_data->>linkedProjectId', 'eq', showId),
      ]);

      if (!showRes.error && showRes.data) {
        setShow(showRes.data);
      }
      setLinkedContracts(contractsRes.data || []);

      // Fetch associations for packet generator
      const { data: assocs } = await supabase.from('associations').select('*');
      if (assocs) setAssociationsData(assocs);

      setIsLoading(false);
    };
    fetchShow();
  }, [user, showId]);

  // ── Module status system (hooks must be before early returns) ──
  const handleProjectDataChange = useCallback((updatedProjectData) => {
    setShow(prev => ({ ...prev, project_data: updatedProjectData }));
  }, []);

  const {
    moduleStatuses,
    isShowLocked,
    isSaving: isStatusSaving,
    changeModuleStatus,
    lockShow,
    unlockShow,
    getModuleStatus: getStatus,
    getModulePdfAllowed,
  } = useModuleStatus({
    projectData: show?.project_data,
    showId,
    onProjectDataChange: handleProjectDataChange,
  });

  const handleGeneratePacket = useCallback(async () => {
    if (!show?.project_data) return;
    setIsGeneratingPacket(true);
    try {
      const pd = show.project_data;
      const allClassItems = getAllClassItems(pd);
      await generateShowPacketPdf(pd, { allClassItems, associationsData });
      toast({ title: 'Show Packet Generated', description: 'Your PDF has been downloaded.' });
    } catch (err) {
      console.error('Failed to generate show packet:', err);
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingPacket(false);
    }
  }, [show, associationsData, toast]);

  if (isLoading) {
    return (
      <>
        <Navigation />
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      </>
    );
  }

  if (!show) {
    return (
      <>
        <Navigation />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-lg text-muted-foreground">Show not found.</p>
          <Button variant="outline" onClick={() => navigate('/horse-show-manager')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shows
          </Button>
        </div>
      </>
    );
  }

  const pd = show.project_data || {};
  const showName = show.project_name || 'Untitled Show';
  const showNumber = pd.showNumber;
  const displayName = `${showName}${showNumber ? ` #${showNumber}` : ''}`;

  const modules = [
    {
      section: 'Show Setup',
      items: [
        { key: 'editWizard', icon: Edit, title: 'Edit Show Wizard', description: 'Edit associations, disciplines, classes, details, arenas, schedule, and show bill.', to: `/horse-show-manager/edit/${showId}`, color: 'blue' },
        { key: 'showStructure', icon: DollarSign, title: 'Show Structure & Expenses', description: 'Manage show expenses, fee structures, and sponsors.', to: `/horse-show-manager/show-structure-expenses/${showId}`, color: 'blue' },
        { key: 'feeStructure', icon: DollarSign, title: 'Fee Structure & Sponsors', description: 'Configure entry fees, stall fees, and sponsor levels.', to: `/horse-show-manager/fee-structure/${showId}`, color: 'blue' },
        { key: 'contracts', icon: FileText, title: 'Contract Management', description: 'Create and manage employee contracts for this show.', to: `/horse-show-manager/employee-management/contracts?showId=${showId}`, color: 'blue' },
        { key: 'patternBook', icon: BookOpen, title: 'Pattern Book', description: 'Access pattern PDFs and score sheets for this show.', to: pd.linkedProjectId ? `/pattern-book-builder/${pd.linkedProjectId}` : '/pattern-book-builder', color: 'indigo' },
      ],
    },
    {
      section: 'Employee Management',
      items: [
        { key: 'budgeting', icon: DollarSign, title: 'Employee Budgeting Tool', description: 'Plan and track employee budgets and compensation.', to: `/horse-show-manager/employee-budgeting/${showId}`, color: 'emerald' },
        { key: 'employeeScheduling', icon: LayoutGrid, title: 'Employee / Arena Scheduling', description: 'Assign employees to arenas and time slots.', to: `/horse-show-manager/employee-scheduling/${showId}`, color: 'emerald' },
      ],
    },
    {
      section: 'Show Management',
      items: [
        { key: 'equipment', icon: Radio, title: 'Equipment Management', description: 'Plan and track equipment needs across arenas.', to: `/horse-show-manager/equipment-planning/${showId}`, color: 'amber' },
        { key: 'results', icon: ClipboardList, title: 'Results Entry', description: 'Enter class results, placings, and scores from the schedule.', to: `/horse-show-manager/results-management/${showId}`, color: 'amber' },
        { key: 'awards', icon: Award, title: 'Awards Management', description: 'Configure awards, ribbons, and trophies.', to: `/horse-show-manager/awards-management/${showId}`, color: 'violet' },
        { key: 'financials', icon: BarChart3, title: 'Financials & Analytics', description: 'View financial projections, revenue, and analytics.', to: `/horse-show-manager/financials/${showId}`, color: 'rose' },
        { key: 'stalling', icon: Warehouse, title: 'Stalling Service', description: 'Manage stall assignments and barn configurations.', to: `/horse-show-manager/stalling-service-manager/${showId}`, color: 'sky', comingSoon: true },
      ],
    },
  ];

  // Compute status for each module (using new 5-status system with migration)
  const modulesWithStatus = modules.map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      status: getStatus(item.key),
    })),
  }));

  return (
    <>
      <Helmet>
        <title>{displayName} - Show Workspace</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Back + header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/horse-show-manager')}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              All Shows
            </Button>

            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
                  {displayName}
                </h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                  {pd.startDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {pd.startDate}{pd.endDate && pd.endDate !== pd.startDate ? ` — ${pd.endDate}` : ''}
                    </span>
                  )}
                  {pd.venueName && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {pd.venueName}
                    </span>
                  )}
                  {isShowLocked && (
                    <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      Show Locked
                    </Badge>
                  )}
                  {!isShowLocked && (
                    <Badge
                      variant="outline"
                      className={cn('text-xs',
                        show.status === 'published' && 'bg-emerald-50 text-emerald-700 border-emerald-300',
                        show.status === 'locked' && 'bg-amber-50 text-amber-700 border-amber-300',
                        (!show.status || show.status === 'draft') && 'bg-blue-50 text-blue-700 border-blue-300'
                      )}
                    >
                      {show.status || 'draft'}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Show Lock/Unlock Toggle */}
                {isShowLocked ? (
                  <Button
                    variant="outline"
                    onClick={unlockShow}
                    disabled={isStatusSaving}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <Unlock className="mr-2 h-4 w-4" />
                    Unlock Show
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={lockShow}
                          disabled={isStatusSaving}
                          className="border-amber-300 text-amber-600 hover:bg-amber-50"
                        >
                          <Lock className="mr-2 h-4 w-4" />
                          Lock Show
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Lock all modules to prevent edits</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Show Packet PDF */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={handleGeneratePacket}
                        disabled={isGeneratingPacket}
                        className="border-blue-300 text-blue-600 hover:bg-blue-50"
                      >
                        {isGeneratingPacket ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        {isGeneratingPacket ? 'Generating...' : 'Show Packet'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate a comprehensive PDF of all show data</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Edit Show */}
                <Button
                  onClick={() => {
                    if (isShowLocked) {
                      toast({ title: 'Show Locked', description: 'Unlock the show to edit.', variant: 'destructive' });
                      return;
                    }
                    navigate(`/horse-show-manager/edit/${showId}`);
                  }}
                  disabled={isShowLocked}
                  className={cn('text-white', isShowLocked ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600')}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Show
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Show stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          >
            {[
              { label: 'Disciplines', value: (pd.disciplines || []).length, icon: ClipboardList },
              { label: 'Arenas', value: (pd.arenas || []).length, icon: Building2 },
              { label: 'Officials', value: (pd.officials || []).length, icon: Users },
              { label: 'Staff', value: (pd.staff || []).length, icon: Users },
            ].map((stat) => {
              const StatIcon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <StatIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>

          {/* Overall progress */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mb-10"
          >
            <Card>
              <CardContent className="p-4">
                <OverallProgress modules={modulesWithStatus} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Show-level lock banner */}
          {isShowLocked && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.09 }}
              className="mb-6"
            >
              <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800">
                <CardContent className="p-4 flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">Show is Globally Locked</p>
                    <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">All modules are read-only. No edits or status changes are allowed until the show is unlocked.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={unlockShow} disabled={isStatusSaving} className="border-red-300 text-red-600 hover:bg-red-100 shrink-0">
                    <Unlock className="h-3.5 w-3.5 mr-1.5" />
                    Unlock
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Module sections */}
          {modulesWithStatus.map((section, sIdx) => (
            <motion.div
              key={section.section}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + sIdx * 0.08 }}
              className="mb-8"
            >
              <h2 className="text-lg font-bold text-foreground mb-4">{section.section}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.items.map((mod) => (
                  <ModuleCard key={mod.title} {...mod} moduleKey={mod.key} onStatusChange={changeModuleStatus} isShowLocked={isShowLocked} />
                ))}
              </div>
            </motion.div>
          ))}
        </main>
      </div>
    </>
  );
};

export default ShowWorkspacePage;
