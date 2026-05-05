import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { updateManeuverSteps, updatePatternStatus } from '@/lib/patternExtractionService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  UploadCloud, Trash2, FileIcon, Loader2, Brain,
  CheckCircle2, Clock, Filter
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import ExtractionPanel from '@/components/pattern-engine/ExtractionPanel';
import ManeuverEditor from '@/components/pattern-engine/ManeuverEditor';

// ─── Status Helpers ────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: Brain },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle2 },
  locked: { label: 'Locked', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: CheckCircle2 },
  published: { label: 'Published', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', icon: CheckCircle2 },
};

const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────
const AdminPatternExtractorPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Data state
  const [patterns, setPatterns] = useState([]);
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(true);
  const [disciplines, setDisciplines] = useState([]);
  const [associations, setAssociations] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState('patterns');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editableSteps, setEditableSteps] = useState([]);

  // ─── Data Fetching ──────────────────────────────────────────────────
  useEffect(() => {
    fetchPatterns();
    fetchDisciplines();
    fetchAssociations();
  }, []);

  const fetchPatterns = async () => {
    setIsLoadingPatterns(true);
    const { data, error } = await supabase
      .from('tbl_patterns')
      .select(`*, maneuvers:tbl_maneuvers(*), media:tbl_pattern_media(*)`)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching patterns', description: error.message, variant: 'destructive' });
    } else {
      setPatterns(data || []);
    }
    setIsLoadingPatterns(false);
  };

  const fetchDisciplines = async () => {
    const { data } = await supabase.from('disciplines').select('name').order('name');
    if (data) setDisciplines(data.map(d => d.name));
  };

  const fetchAssociations = async () => {
    const { data } = await supabase.from('associations').select('name').order('name');
    if (data) setAssociations(data.map(a => a.name));
  };

  // ─── Pattern Actions ────────────────────────────────────────────────
  const openDetail = (pattern) => {
    setSelectedPattern(pattern);
    const steps = (pattern.maneuvers || [])
      .sort((a, b) => a.step_no - b.step_no)
      .map(m => ({ stepNumber: m.step_no, instruction: m.instruction }));
    setEditableSteps(steps);
    setIsDetailOpen(true);
  };

  const handleSaveManeuvers = async (steps) => {
    if (!selectedPattern) return;
    try {
      await updateManeuverSteps(selectedPattern.id, steps);
      toast({ title: 'Maneuvers updated', variant: 'success' });
      fetchPatterns();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeletePattern = async (patternId) => {
    if (!window.confirm('Delete this pattern and all associated data? This cannot be undone.')) return;

    const { error } = await supabase.from('tbl_patterns').delete().eq('id', patternId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pattern deleted', variant: 'success' });
      setPatterns(prev => prev.filter(p => p.id !== patternId));
      if (selectedPattern?.id === patternId) {
        setIsDetailOpen(false);
        setSelectedPattern(null);
      }
    }
  };

  const handleStatusChange = async (patternId, newStatus) => {
    try {
      await updatePatternStatus(patternId, newStatus);
      toast({ title: `Status updated to ${newStatus}` });
      fetchPatterns();
      if (selectedPattern?.id === patternId) {
        setSelectedPattern(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleExtractionComplete = () => {
    fetchPatterns();
    setActiveTab('patterns');
  };

  // ─── Filtered Patterns ──────────────────────────────────────────────
  const filteredPatterns = filterStatus === 'all'
    ? patterns
    : patterns.filter(p => (p.status || 'draft') === filterStatus);

  const statusCounts = {
    all: patterns.length,
    draft: patterns.filter(p => !p.status || p.status === 'draft').length,
    approved: patterns.filter(p => p.status === 'approved').length,
    locked: patterns.filter(p => p.status === 'locked').length,
  };

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <>
      <Helmet>
        <title>Pattern Intelligence Engine</title>
        <meta name="description" content="AI-powered pattern extraction, interpretation, and score sheet generation." />
      </Helmet>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />
        <main className="flex-grow p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                  <Brain className="w-7 h-7 text-primary" />
                  Pattern Intelligence Engine
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload, extract, interpret, and generate score sheets from pattern PDFs.
                </p>
              </div>
            </div>

            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="patterns">
                  <FileIcon className="w-4 h-4 mr-2" /> Patterns ({patterns.length})
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <UploadCloud className="w-4 h-4 mr-2" /> New Extraction
                </TabsTrigger>
              </TabsList>

              {/* ─── PATTERNS TAB ──────────────────────────────────── */}
              <TabsContent value="patterns">
                {/* Filter bar */}
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  {['all', 'draft', 'approved', 'locked'].map((status) => (
                    <Button
                      key={status}
                      variant={filterStatus === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterStatus(status)}
                    >
                      {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
                      <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                        {statusCounts[status] || 0}
                      </Badge>
                    </Button>
                  ))}
                </div>

                {/* Pattern Grid */}
                {isLoadingPatterns ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredPatterns.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <FileIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">
                      {filterStatus === 'all' ? 'No patterns extracted yet.' : `No ${filterStatus} patterns.`}
                    </p>
                    <Button variant="link" className="mt-2" onClick={() => setActiveTab('upload')}>
                      Start a new extraction
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    <AnimatePresence>
                      {filteredPatterns.map((pattern) => (
                        <motion.div
                          key={pattern.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="relative group cursor-pointer"
                          onClick={() => openDetail(pattern)}
                        >
                          <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-primary/20">
                            <CardContent className="p-0">
                              {/* Image or placeholder */}
                              <div className="w-full h-44 bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                                {pattern.media?.[0]?.image_url ? (
                                  <img
                                    src={pattern.media?.[0]?.image_url}
                                    alt={`${pattern.association_name} ${pattern.discipline}`}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <FileIcon className="w-14 h-14 text-gray-300 dark:text-gray-600" />
                                )}
                              </div>
                              <div className="p-3 space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-semibold text-sm truncate">{pattern.association_name || 'Unknown'}</p>
                                  <StatusBadge status={pattern.status || 'draft'} />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {pattern.discipline}{pattern.division ? ` - ${pattern.division}` : ''}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {pattern.maneuvers?.length || 0} steps
                                  {pattern.page_no ? ` | Page ${pattern.page_no}` : ''}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </TabsContent>

              {/* ─── UPLOAD / EXTRACTION TAB ────────────────────────── */}
              <TabsContent value="upload">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UploadCloud className="w-5 h-5" />
                      Extract Pattern from PDF
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ExtractionPanel
                      associations={associations}
                      disciplines={disciplines}
                      userId={user?.id}
                      onComplete={handleExtractionComplete}
                      onCancel={() => setActiveTab('patterns')}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* ─── PATTERN DETAIL DIALOG ──────────────────────────────────── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedPattern && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-xl">
                    {selectedPattern.association_name} — {selectedPattern.discipline}
                  </DialogTitle>
                  <StatusBadge status={selectedPattern.status || 'draft'} />
                </div>
                <DialogDescription>
                  {selectedPattern.division && `${selectedPattern.division} | `}
                  {selectedPattern.division_level && `${selectedPattern.division_level} | `}
                  {selectedPattern.page_no && `Page ${selectedPattern.page_no} | `}
                  {selectedPattern.pattern_date && new Date(selectedPattern.pattern_date).toLocaleDateString()}
                  {selectedPattern.pdf_file_name && ` | ${selectedPattern.pdf_file_name}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Two-column layout: Image + Maneuvers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Diagram image */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Pattern Diagram</h3>
                    {selectedPattern.media?.[0]?.image_url ? (
                      <div className="border rounded-lg overflow-hidden bg-white">
                        <img
                          src={selectedPattern.media[0].image_url}
                          alt="Pattern diagram"
                          className="w-full h-auto"
                        />
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-12 text-center">
                        <FileIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No diagram image available</p>
                      </div>
                    )}

                    {/* Raw text from maneuvers */}
                    {selectedPattern.maneuvers?.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-semibold mb-2">Extracted Text Summary</h3>
                        <div className="bg-muted rounded-lg p-3 max-h-40 overflow-y-auto">
                          <pre className="text-xs whitespace-pre-wrap font-mono">
                            {selectedPattern.maneuvers
                              .sort((a, b) => a.step_no - b.step_no)
                              .map(m => `${m.step_no}. ${m.instruction}`)
                              .join('\n')}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Maneuver editor */}
                  <div>
                    <ManeuverEditor
                      steps={editableSteps}
                      onChange={setEditableSteps}
                      onSave={handleSaveManeuvers}
                      readOnly={selectedPattern.status === 'locked' || selectedPattern.status === 'published'}
                    />
                  </div>
                </div>

                {/* Status actions */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Workflow Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {(!selectedPattern.status || selectedPattern.status === 'draft') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(selectedPattern.id, 'approved')}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                      </Button>
                    )}
                    {selectedPattern.status === 'approved' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(selectedPattern.id, 'locked')}
                        >
                          Lock Pattern
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(selectedPattern.id, 'draft')}
                        >
                          Revert to Draft
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="destructive" size="sm" onClick={() => handleDeletePattern(selectedPattern.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminPatternExtractorPage;
