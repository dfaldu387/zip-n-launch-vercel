import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Info, CalendarDays, FileText,
  DollarSign, LayoutGrid, Building2, Radio, Award,
  Plus, Loader2, FolderOpen, Hash, Calendar, ChevronRight,
  Search, MapPin, Trash2, Shield, Crown, ArrowLeft,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Navigation from '@/components/Navigation';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { useUsageGate } from '@/hooks/useUsageGate';

/* ── Custom folder SVG icons ── */

const FolderCreateIcon = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 16C4 13.79 5.79 12 8 12H20L24 8H44C46.21 8 48 9.79 48 12V16H4Z" fill="#5B9BF5" />
    <rect x="4" y="16" width="48" height="30" rx="3" fill="#4A8AF4" />
    <rect x="4" y="16" width="48" height="30" rx="3" fill="url(#folderGrad1)" />
    <circle cx="40" cy="38" r="10" fill="#3B7AE8" stroke="white" strokeWidth="2" />
    <path d="M40 33V43M35 38H45" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <defs>
      <linearGradient id="folderGrad1" x1="28" y1="16" x2="28" y2="46" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6BA5F7" />
        <stop offset="1" stopColor="#4A8AF4" />
      </linearGradient>
    </defs>
  </svg>
);

const FolderEmployeeIcon = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 16C4 13.79 5.79 12 8 12H20L24 8H44C46.21 8 48 9.79 48 12V16H4Z" fill="#5B9BF5" />
    <rect x="4" y="16" width="48" height="30" rx="3" fill="#4A8AF4" />
    <rect x="4" y="16" width="48" height="30" rx="3" fill="url(#folderGrad2)" />
    <rect x="18" y="23" width="20" height="18" rx="1.5" fill="white" fillOpacity="0.9" />
    <rect x="22" y="27" width="4" height="3" rx="0.5" fill="#4A8AF4" />
    <rect x="30" y="27" width="4" height="3" rx="0.5" fill="#4A8AF4" />
    <rect x="22" y="33" width="4" height="3" rx="0.5" fill="#4A8AF4" />
    <rect x="30" y="33" width="4" height="3" rx="0.5" fill="#4A8AF4" />
    <rect x="26" y="37" width="4" height="4" rx="0.5" fill="#4A8AF4" />
    <defs>
      <linearGradient id="folderGrad2" x1="28" y1="16" x2="28" y2="46" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6BA5F7" />
        <stop offset="1" stopColor="#4A8AF4" />
      </linearGradient>
    </defs>
  </svg>
);

const FolderManagementIcon = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 16C4 13.79 5.79 12 8 12H20L24 8H44C46.21 8 48 9.79 48 12V16H4Z" fill="#5B9BF5" />
    <rect x="4" y="16" width="48" height="30" rx="3" fill="#4A8AF4" />
    <rect x="4" y="16" width="48" height="30" rx="3" fill="url(#folderGrad3)" />
    <rect x="18" y="22" width="20" height="20" rx="2" fill="white" fillOpacity="0.9" />
    <rect x="22" y="26" width="3" height="3" rx="0.5" fill="#4A8AF4" />
    <rect x="28" y="27" width="7" height="1.5" rx="0.75" fill="#4A8AF4" />
    <rect x="22" y="31.5" width="3" height="3" rx="0.5" fill="#4A8AF4" />
    <rect x="28" y="32.5" width="7" height="1.5" rx="0.75" fill="#4A8AF4" />
    <rect x="22" y="37" width="3" height="3" rx="0.5" fill="#4A8AF4" />
    <rect x="28" y="38" width="7" height="1.5" rx="0.75" fill="#4A8AF4" />
    <defs>
      <linearGradient id="folderGrad3" x1="28" y1="16" x2="28" y2="46" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6BA5F7" />
        <stop offset="1" stopColor="#4A8AF4" />
      </linearGradient>
    </defs>
  </svg>
);

/* ── Show folder icon (for individual show cards) ── */

const ShowFolderIcon = ({ className }) => (
  <svg width="40" height="40" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M4 16C4 13.79 5.79 12 8 12H20L24 8H44C46.21 8 48 9.79 48 12V16H4Z" fill="#93B8F7" />
    <rect x="4" y="16" width="48" height="30" rx="3" fill="#5B9BF5" />
    <rect x="4" y="16" width="48" height="30" rx="3" fill="url(#showFolderGrad)" />
    <defs>
      <linearGradient id="showFolderGrad" x1="28" y1="16" x2="28" y2="46" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7ABAFF" />
        <stop offset="1" stopColor="#5B9BF5" />
      </linearGradient>
    </defs>
  </svg>
);

/* ── Tool sections data ── */

const sections = [
  {
    icon: FolderCreateIcon,
    title: 'Create New Show',
    link: '/horse-show-manager/create',
    items: [
      { icon: CalendarDays, label: 'Horse Show Schedule Builder', link: '/horse-show-manager/create' },
      { icon: Info, label: 'Show Structure & Expenses', link: '/horse-show-manager/show-structure-expenses' },
      { icon: DollarSign, label: 'Fee Structure & Sponsors', link: '/horse-show-manager/fee-structure' },
    ],
  },
  {
    icon: FolderEmployeeIcon,
    title: 'Employee Management',
    link: '/horse-show-manager/employee-management',
    items: [
      { icon: DollarSign, label: 'Employee Budgeting Tool', link: '/horse-show-manager/employee-budgeting' },
      { icon: LayoutGrid, label: 'Employee / Arena Scheduling', link: '/horse-show-manager/employee-scheduling' },
      { icon: FileText, label: 'Contract Management Tool', link: '/horse-show-manager/employee-management/contracts' },
    ],
  },
  {
    icon: FolderManagementIcon,
    title: 'Horse Show Management',
    link: '/horse-show-manager/stalling-service-manager',
    items: [
      { icon: Radio, label: 'Equipment Management', link: '/horse-show-manager/equipment-planning', line: 1 },
      { icon: Award, label: 'Awards Management', link: '/horse-show-manager/awards-management', line: 2 },
      { icon: DollarSign, label: 'Horse Show Financials / Analytics', link: '/horse-show-manager/financials', line: 3 },
      { icon: Building2, label: 'Stalling Service', link: '/horse-show-manager/stalling-service-manager', line: 4, unimplemented: true },
    ],
  },
];

/* ── Section card component ── */

const SectionCard = ({ icon: Icon, title, link, items }) => {
  const { toast } = useToast();

  const handleUnimplemented = (e) => {
    e.preventDefault();
    toast({
      title: 'Coming Soon!',
      description: "This feature isn't implemented yet — stay tuned!",
    });
  };

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 8px 30px -6px rgba(0, 0, 0, 0.10)' }}
      className="h-full"
    >
      <div className="h-full flex flex-col bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Icon />
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        </div>

        <div className="flex-grow space-y-4 mb-7">
          {(() => {
            const groups = [];
            items.forEach((item) => {
              if (item.line != null) {
                const existing = groups.find(g => g.line === item.line);
                if (existing) { existing.items.push(item); }
                else { groups.push({ line: item.line, items: [item] }); }
              } else {
                groups.push({ line: null, items: [item] });
              }
            });

            const renderItem = (item) => {
              const ItemIcon = item.icon;
              return item.unimplemented ? (
                <a
                  key={item.label}
                  href="#"
                  onClick={handleUnimplemented}
                  className="flex items-center gap-3 text-gray-700 dark:text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <ItemIcon className="h-5 w-5 text-blue-500 shrink-0" />
                  <span className="text-[15px] font-semibold">{item.label}</span>
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.link}
                  className="flex items-center gap-3 text-gray-700 dark:text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <ItemIcon className="h-5 w-5 text-blue-500 shrink-0" />
                  <span className="text-[15px] font-semibold">{item.label}</span>
                </Link>
              );
            };

            return groups.map((group, gIdx) => (
              <React.Fragment key={group.line ?? `g-${gIdx}`}>
                {gIdx > 0 && group.line != null && <hr className="border-gray-200 dark:border-border" />}
                {group.items.map(renderItem)}
              </React.Fragment>
            ));
          })()}
        </div>

        <Button asChild className="w-fit bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6">
          <Link to={link}>Get Started</Link>
        </Button>
      </div>
    </motion.div>
  );
};

/* ── Page ── */

const HorseShowManagerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { canCreate, showCount, freeLimit } = useUsageGate();
  const [shows, setShows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleCreateNew = () => {
    if (canCreate) {
      navigate('/horse-show-manager/create');
    } else {
      setShowLimitModal(true);
    }
  };

  const handleDelete = async (e, show) => {
    e.stopPropagation();
    const name = show.project_name || 'Untitled Show';
    if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(show.id);
    const { error } = await supabase.from('projects').delete().eq('id', show.id).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      setShows((prev) => prev.filter((s) => s.id !== show.id));
      toast({ title: 'Show deleted', description: `"${name}" has been removed.` });
    }
    setDeletingId(null);
  };

  useEffect(() => {
    const fetchShows = async () => {
      if (!user) { setIsLoading(false); return; }
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, project_type, project_data, status, created_at')
        .eq('user_id', user.id)
        .not('project_type', 'in', '("pattern_book","pattern_folder","pattern_hub","pattern_upload","contract")')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setShows(data);
      }
      setIsLoading(false);
    };
    fetchShows();
  }, [user]);

  const filteredShows = shows.filter((show) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const pd = show.project_data || {};
    return (
      (show.project_name || '').toLowerCase().includes(q) ||
      String(pd.showNumber || '').includes(q) ||
      (pd.venueName || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Helmet>
        <title>Horse Show Manager - EquiPatterns</title>
        <meta name="description" content="Your all-in-one solution for seamless horse show administration." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="text-5xl font-extrabold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-sky-400">
              Horse Show Manager
            </h1>
            <p className="text-lg text-muted-foreground">
              Organize and manage all aspects of your horse shows.
            </p>
          </motion.div>

          {/* ── Your Horse Shows section ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-4xl mx-auto mb-16"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-foreground">Your Horse Shows</h2>
              <Button
                onClick={handleCreateNew}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Horse Show
              </Button>
            </div>

            {/* Search bar */}
            {shows.length > 0 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search shows by name, number, or venue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : shows.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Shows Yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Get started by creating your first horse show.
                  </p>
                  <Button
                    onClick={handleCreateNew}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Show
                  </Button>
                </CardContent>
              </Card>
            ) : filteredShows.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No shows match "{searchQuery}"
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredShows.map((show, index) => {
                  const pd = show.project_data || {};
                  const disciplineCount = (pd.disciplines || []).length;
                  const arenaCount = (pd.arenas || []).length;

                  return (
                    <motion.div
                      key={show.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => navigate(`/horse-show-manager/show/${show.id}`)}
                      >
                        <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                          <CardContent className="py-4 px-5">
                            <div className="flex items-center gap-4">
                              <ShowFolderIcon className="shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-base truncate">
                                    {show.project_name || 'Untitled Show'}
                                  </h3>
                                  {pd.showNumber && (
                                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                                      <Hash className="h-3 w-3 mr-0.5" />#{pd.showNumber}
                                    </Badge>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={cn('text-xs flex-shrink-0',
                                      show.status === 'published' && 'bg-emerald-50 text-emerald-700 border-emerald-300',
                                      show.status === 'locked' && 'bg-amber-50 text-amber-700 border-amber-300',
                                      (!show.status || show.status === 'draft') && 'bg-blue-50 text-blue-700 border-blue-300'
                                    )}
                                  >
                                    {show.status || 'draft'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                  {pd.startDate && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {pd.startDate}{pd.endDate && pd.endDate !== pd.startDate ? ` — ${pd.endDate}` : ''}
                                    </span>
                                  )}
                                  {pd.venueName && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {pd.venueName}
                                    </span>
                                  )}
                                  {disciplineCount > 0 && <span>{disciplineCount} disciplines</span>}
                                  {arenaCount > 0 && <span>{arenaCount} arenas</span>}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                                title="Delete show"
                                disabled={deletingId === show.id}
                                onClick={(e) => handleDelete(e, show)}
                              >
                                {deletingId === show.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />}
                              </button>
                              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* ── Tools & Management sections ── */}
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-bold text-foreground mb-6 text-center">Tools & Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 items-start gap-8">
              {sections.map((section, index) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  <SectionCard {...section} />
                </motion.div>
              ))}
            </div>
          </div>
        </main>

        {/* Free Limit Reached Modal */}
        <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
          <DialogContent className="max-w-md">
            <div className="py-6 text-center space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Shield className="h-7 w-7 text-amber-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">Free Limit Reached</h2>
                <p className="text-sm text-muted-foreground">
                  You've created <strong>{showCount}</strong> of your <strong>{freeLimit} free shows</strong>.
                  To create additional shows, please upgrade to a membership plan.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 max-w-xs mx-auto">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shows Created</span>
                  <span className="font-semibold">{showCount} / {freeLimit}</span>
                </div>
                <div className="mt-2 w-full bg-muted rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                  <Link to="/pricing">
                    <Crown className="mr-2 h-4 w-4" />
                    View Membership Plans
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => setShowLimitModal(false)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You can still edit and manage your existing shows at any time.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default HorseShowManagerPage;
