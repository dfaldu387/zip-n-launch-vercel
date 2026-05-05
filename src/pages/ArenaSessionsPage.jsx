import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { CalendarDays, Loader2, PlusCircle, Edit, Trash2, ArrowLeft, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useArenaSessions, ARENA_TYPES } from '@/hooks/useArenaSessions';

// ---- Debounced quantity input ----
const DebouncedQuantityInput = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef(null);
  useEffect(() => { setLocalValue(value); }, [value]);
  const handleChange = (e) => {
    const v = parseInt(e.target.value, 10) || 1;
    setLocalValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 500);
  };
  return <Input type="number" min={1} value={localValue} onChange={handleChange} className="w-20 h-8 text-center" />;
};

// ---- Arena Form ----
const ArenaForm = ({ arena, onSave, onCancel, isSaving }) => {
  const [formData, setFormData] = useState({ name: '', arena_type: '' });
  useEffect(() => {
    setFormData(arena ? { ...arena, arena_type: arena.arena_type || '' } : { name: '', arena_type: '' });
  }, [arena]);
  const handleChange = (f, v) => setFormData(p => ({ ...p, [f]: v }));
  const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="arena-name">Arena Name *</Label>
        <Input id="arena-name" value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="e.g., Main Arena" required />
      </div>
      <div className="space-y-2">
        <Label>Arena Type</Label>
        <Select onValueChange={v => handleChange('arena_type', v)} value={formData.arena_type}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {ARENA_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSaving || !formData.name}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
        </Button>
      </DialogFooter>
    </form>
  );
};

// ---- Session Form ----
const SessionForm = ({ session, showDates, onSave, onCancel, isSaving }) => {
  const [formData, setFormData] = useState({ session_name: '', date: '', calculation_mode: 'MAX' });
  useEffect(() => {
    if (session) {
      setFormData({ ...session, session_name: session.session_name || '', date: session.date || '', calculation_mode: session.calculation_mode || 'MAX' });
    } else {
      setFormData({ session_name: '', date: showDates[0] || '', calculation_mode: 'MAX' });
    }
  }, [session, showDates]);
  const handleChange = (f, v) => setFormData(p => ({ ...p, [f]: v }));
  const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="session-name">Session Name *</Label>
        <Input id="session-name" value={formData.session_name} onChange={e => handleChange('session_name', e.target.value)} placeholder="e.g., Morning Session" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date *</Label>
          <Select onValueChange={v => handleChange('date', v)} value={formData.date}>
            <SelectTrigger><SelectValue placeholder="Select date" /></SelectTrigger>
            <SelectContent>
              {showDates.map(d => <SelectItem key={d} value={d}>{new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Calculation Mode</Label>
          <Select onValueChange={v => handleChange('calculation_mode', v)} value={formData.calculation_mode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MAX">MAX (reuse between classes)</SelectItem>
              <SelectItem value="SUM">SUM (all needed at once)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSaving || !formData.session_name || !formData.date}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
        </Button>
      </DialogFooter>
    </form>
  );
};

// ---- Class Template Picker ----
const ClassTemplatePicker = ({ open, onOpenChange, onSelect, excludeIds = [], fetchTemplates }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      const results = await fetchTemplates(searchTerm);
      setItems(results || []);
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, open, fetchTemplates]);

  useEffect(() => { if (!open) { setSearchTerm(''); setItems([]); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select Class Template</DialogTitle>
          <DialogDescription>Choose a class template to assign to this session.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search templates..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <ScrollArea className="h-[300px] mt-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{searchTerm ? 'No templates match your search.' : 'No class templates yet.'}</p>
              <p className="text-sm mt-2">
                <Link to="/horse-show-manager/discipline-planner" className="text-primary underline" onClick={() => onOpenChange(false)}>Create templates first</Link>
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map(item => {
                const isExcluded = excludeIds.includes(item.id);
                return (
                  <button key={item.id} onClick={() => !isExcluded && (onSelect(item), onOpenChange(false))} disabled={isExcluded}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between transition-colors">
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.discipline_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.default_arena_type && <Badge variant="outline" className="text-xs">{item.default_arena_type}</Badge>}
                      {isExcluded && <Badge variant="secondary" className="text-xs">Added</Badge>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// ---- Main Page ----
const ArenaSessionsPage = () => {
  const navigate = useNavigate();
  const {
    shows, isShowsLoading, selectedShow, setSelectedShow, fetchUserShows, getShowDates,
    arenas, isArenasLoading, selectedArena, setSelectedArena,
    isArenaDialogOpen, setIsArenaDialogOpen, editingArena, setEditingArena, isSavingArena,
    fetchArenas, saveArena, deleteArena,
    sessions, isSessionsLoading, selectedSession, setSelectedSession,
    isSessionDialogOpen, setIsSessionDialogOpen, editingSession, setEditingSession, isSavingSession,
    fetchSessions, saveSession, deleteSession,
    sessionClasses, isSessionClassesLoading,
    fetchSessionClasses, addSessionClass, updateSessionClass, removeSessionClass,
    fetchClassTemplatesForPicker,
  } = useArenaSessions();

  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);

  useEffect(() => { fetchUserShows(); }, [fetchUserShows]);

  const handleSelectShow = (showId) => {
    const show = shows.find(s => s.id === showId);
    setSelectedShow(show || null);
    setSelectedArena(null);
    setSessions_([]);
    setSelectedSession(null);
    if (show) fetchArenas(show.id);
  };

  // Local wrapper since setSessions isn't exposed
  const setSessions_ = () => {};

  const handleSelectArena = (arena) => {
    setSelectedArena(arena);
    setSelectedSession(null);
    fetchSessions(arena.id);
  };

  const handleSelectSession = (session) => {
    if (selectedSession?.id === session.id) {
      setSelectedSession(null);
    } else {
      setSelectedSession(session);
      fetchSessionClasses(session.id);
    }
  };

  const handleAddClass = (template) => {
    if (selectedSession) {
      addSessionClass(selectedSession.id, template.id);
    }
  };

  const showDates = selectedShow ? getShowDates(selectedShow) : [];

  return (
    <>
      <Helmet><title>Arena Sessions - Admin</title></Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
              <Button variant="outline" onClick={() => navigate('/horse-show-manager/equipment-planning')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Equipment Planning
              </Button>
            </div>

            {/* Hero */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <CalendarDays className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Arena Sessions</h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Build arena sessions and assign class templates for equipment calculation.
              </p>
            </div>

            {/* Show Selector */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Label className="whitespace-nowrap font-semibold">Select Show:</Label>
                  {isShowsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : shows.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No shows found. <Link to="/horse-show-manager/create" className="text-primary underline">Create a show first</Link>.</p>
                  ) : (
                    <Select onValueChange={handleSelectShow} value={selectedShow?.id || ''}>
                      <SelectTrigger className="max-w-md">
                        <SelectValue placeholder="Choose a show..." />
                      </SelectTrigger>
                      <SelectContent>
                        {shows.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.project_name} {s.status && <span className="text-muted-foreground">({s.status})</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Main Content */}
            {selectedShow && (
              <div className="flex flex-col md:flex-row gap-6">

                {/* Left: Arena list */}
                <Card className="w-full md:w-1/3">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Arenas</CardTitle>
                      <Button size="sm" onClick={() => { setEditingArena(null); setIsArenaDialogOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      {isArenasLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                      ) : arenas.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">No arenas yet. Add one to get started.</p>
                      ) : (
                        arenas.map(arena => (
                          <div
                            key={arena.id}
                            className={`flex items-center justify-between px-4 py-3 border-b cursor-pointer transition-colors hover:bg-accent ${
                              selectedArena?.id === arena.id ? 'bg-accent border-l-2 border-l-primary' : ''
                            }`}
                            onClick={() => handleSelectArena(arena)}
                          >
                            <div>
                              <p className="font-medium text-sm">{arena.name}</p>
                              {arena.arena_type && <Badge variant="outline" className="text-xs mt-1">{arena.arena_type}</Badge>}
                            </div>
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingArena(arena); setIsArenaDialogOpen(true); }}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Arena</AlertDialogTitle>
                                    <AlertDialogDescription>Delete "{arena.name}" and all its sessions? This cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteArena(arena.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Right: Sessions */}
                <Card className="w-full md:w-2/3">
                  {!selectedArena ? (
                    <CardContent className="flex flex-col items-center justify-center py-20">
                      <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Select an Arena</h3>
                      <p className="text-muted-foreground text-sm">Choose an arena from the list to manage its sessions.</p>
                    </CardContent>
                  ) : (
                    <>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{selectedArena.name} - Sessions</CardTitle>
                            <CardDescription className="mt-1">
                              {showDates.length > 0 ? `Show dates: ${showDates[0]} to ${showDates[showDates.length - 1]}` : 'No dates configured for this show'}
                            </CardDescription>
                          </div>
                          <Button size="sm" onClick={() => { setEditingSession(null); setIsSessionDialogOpen(true); }}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Session
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isSessionsLoading ? (
                          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : sessions.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">No sessions yet for this arena.</p>
                            <p className="text-xs mt-1">Click "Add Session" to create one.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {sessions.map(session => (
                              <div key={session.id} className={`rounded-lg border transition-colors ${selectedSession?.id === session.id ? 'border-primary bg-accent/50' : ''}`}>
                                {/* Session header */}
                                <div
                                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                                  onClick={() => handleSelectSession(session)}
                                >
                                  <div className="flex items-center gap-3">
                                    {selectedSession?.id === session.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    <div>
                                      <p className="font-medium">{session.session_name}</p>
                                      <div className="flex gap-2 mt-1">
                                        <Badge variant="secondary" className="text-xs">
                                          {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </Badge>
                                        <Badge variant={session.calculation_mode === 'MAX' ? 'outline' : 'default'}
                                          className={`text-xs ${session.calculation_mode === 'SUM' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : ''}`}>
                                          {session.calculation_mode}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingSession(session); setIsSessionDialogOpen(true); }}>
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Session</AlertDialogTitle>
                                          <AlertDialogDescription>Delete "{session.session_name}" and all its assigned classes?</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteSession(session.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>

                                {/* Expanded: Session classes */}
                                {selectedSession?.id === session.id && (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border-t px-4 pb-4 pt-3">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="font-semibold text-sm">Assigned Classes ({sessionClasses.length})</h4>
                                      <Button size="sm" variant="outline" onClick={() => setIsClassPickerOpen(true)}>
                                        <PlusCircle className="mr-2 h-3 w-3" /> Add Class
                                      </Button>
                                    </div>

                                    {isSessionClassesLoading ? (
                                      <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                                    ) : sessionClasses.length === 0 ? (
                                      <p className="text-center text-muted-foreground text-sm py-4">No classes assigned. Add class templates to this session.</p>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Class Template</TableHead>
                                            <TableHead>Discipline</TableHead>
                                            <TableHead className="text-center">Qty</TableHead>
                                            <TableHead className="text-center">Reset Between</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {sessionClasses.map(sc => (
                                            <TableRow key={sc.id}>
                                              <TableCell className="font-medium text-sm">{sc.class_templates?.name}</TableCell>
                                              <TableCell><Badge variant="outline" className="text-xs">{sc.discipline_name}</Badge></TableCell>
                                              <TableCell className="text-center">
                                                <DebouncedQuantityInput value={sc.quantity} onChange={(v) => updateSessionClass(sc.id, { quantity: v })} />
                                              </TableCell>
                                              <TableCell className="text-center">
                                                <Switch checked={sc.reset_between} onCheckedChange={(checked) => updateSessionClass(sc.id, { reset_between: checked })} />
                                              </TableCell>
                                              <TableCell className="text-right">
                                                <AlertDialog>
                                                  <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-7 w-7">
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </AlertDialogTrigger>
                                                  <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                      <AlertDialogTitle>Remove Class</AlertDialogTitle>
                                                      <AlertDialogDescription>Remove "{sc.class_templates?.name}" from this session?</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                      <AlertDialogAction onClick={() => removeSessionClass(sc.id, session.id)} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                  </AlertDialogContent>
                                                </AlertDialog>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    )}
                                  </motion.div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </>
                  )}
                </Card>
              </div>
            )}

          </motion.div>
        </main>
      </div>

      {/* Arena Dialog */}
      <Dialog open={isArenaDialogOpen} onOpenChange={setIsArenaDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{editingArena?.id ? 'Edit' : 'Add'} Arena</DialogTitle>
            <DialogDescription>{editingArena?.id ? 'Update arena details.' : 'Add a new arena to this show.'}</DialogDescription>
          </DialogHeader>
          <ArenaForm arena={editingArena} onSave={saveArena} onCancel={() => setIsArenaDialogOpen(false)} isSaving={isSavingArena} />
        </DialogContent>
      </Dialog>

      {/* Session Dialog */}
      <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingSession?.id ? 'Edit' : 'Add'} Session</DialogTitle>
            <DialogDescription>{editingSession?.id ? 'Update session details.' : 'Create a new session for this arena.'}</DialogDescription>
          </DialogHeader>
          <SessionForm session={editingSession} showDates={showDates} onSave={saveSession} onCancel={() => setIsSessionDialogOpen(false)} isSaving={isSavingSession} />
        </DialogContent>
      </Dialog>

      {/* Class Template Picker */}
      <ClassTemplatePicker
        open={isClassPickerOpen}
        onOpenChange={setIsClassPickerOpen}
        onSelect={handleAddClass}
        excludeIds={sessionClasses.map(sc => sc.class_templates?.id).filter(Boolean)}
        fetchTemplates={fetchClassTemplatesForPicker}
      />
    </>
  );
};

export default ArenaSessionsPage;
