import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export const ARENA_TYPES = ['Indoor', 'Outdoor', 'Covered', 'Warm-Up', 'Other'];

export const useArenaSessions = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Shows
  const [shows, setShows] = useState([]);
  const [isShowsLoading, setIsShowsLoading] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  // Arenas
  const [arenas, setArenas] = useState([]);
  const [isArenasLoading, setIsArenasLoading] = useState(false);
  const [selectedArena, setSelectedArena] = useState(null);
  const [isArenaDialogOpen, setIsArenaDialogOpen] = useState(false);
  const [editingArena, setEditingArena] = useState(null);
  const [isSavingArena, setIsSavingArena] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [isSavingSession, setIsSavingSession] = useState(false);

  // Session Classes
  const [sessionClasses, setSessionClasses] = useState([]);
  const [isSessionClassesLoading, setIsSessionClassesLoading] = useState(false);

  // Class templates for picker
  const [classTemplatesForPicker, setClassTemplatesForPicker] = useState([]);

  // ---- SHOWS ----

  const fetchUserShows = useCallback(async () => {
    if (!user) return;
    setIsShowsLoading(true);

    const { data, error } = await supabase
      .from('projects')
      .select('id, project_name, project_data, status')
      .eq('user_id', user.id)
      .eq('project_type', 'show')
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching shows', description: error.message, variant: 'destructive' });
    } else {
      setShows(data || []);
    }
    setIsShowsLoading(false);
  }, [user, toast]);

  // ---- ARENAS ----

  const fetchArenas = useCallback(async (showId) => {
    if (!user || !showId) return;
    setIsArenasLoading(true);

    const { data, error } = await supabase
      .from('arenas')
      .select('*')
      .eq('user_id', user.id)
      .eq('show_id', showId)
      .order('name');

    if (error) {
      toast({ title: 'Error fetching arenas', description: error.message, variant: 'destructive' });
    } else {
      setArenas(data || []);
    }
    setIsArenasLoading(false);
  }, [user, toast]);

  const saveArena = useCallback(async (formData) => {
    if (!user || !selectedShow) return;
    setIsSavingArena(true);

    const { id, created_at, updated_at, ...payload } = formData;
    payload.user_id = user.id;
    payload.show_id = selectedShow.id;

    let result;
    if (id) {
      result = await supabase.from('arenas').update(payload).eq('id', id).eq('user_id', user.id).select().single();
    } else {
      result = await supabase.from('arenas').insert(payload).select().single();
    }

    if (result.error) {
      toast({ title: 'Error saving arena', description: result.error.message, variant: 'destructive' });
    } else {
      toast({ title: `Arena ${id ? 'updated' : 'created'}!` });
      setIsArenaDialogOpen(false);
      setEditingArena(null);
      fetchArenas(selectedShow.id);
    }
    setIsSavingArena(false);
  }, [user, selectedShow, toast, fetchArenas]);

  const deleteArena = useCallback(async (arenaId) => {
    if (!user) return;

    const { error } = await supabase.from('arenas').delete().eq('id', arenaId).eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error deleting arena', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Arena deleted.' });
      if (selectedArena?.id === arenaId) {
        setSelectedArena(null);
        setSessions([]);
        setSelectedSession(null);
        setSessionClasses([]);
      }
      if (selectedShow) fetchArenas(selectedShow.id);
    }
  }, [user, toast, selectedArena, selectedShow, fetchArenas]);

  // ---- SESSIONS ----

  const fetchSessions = useCallback(async (arenaId) => {
    if (!arenaId) return;
    setIsSessionsLoading(true);

    const { data, error } = await supabase
      .from('arena_sessions')
      .select('*')
      .eq('arena_id', arenaId)
      .order('date')
      .order('session_name');

    if (error) {
      toast({ title: 'Error fetching sessions', description: error.message, variant: 'destructive' });
    } else {
      setSessions(data || []);
    }
    setIsSessionsLoading(false);
  }, [toast]);

  const saveSession = useCallback(async (formData) => {
    if (!user || !selectedShow || !selectedArena) return;
    setIsSavingSession(true);

    const { id, created_at, updated_at, ...payload } = formData;
    payload.user_id = user.id;
    payload.show_id = selectedShow.id;
    payload.arena_id = selectedArena.id;

    let result;
    if (id) {
      result = await supabase.from('arena_sessions').update(payload).eq('id', id).eq('user_id', user.id).select().single();
    } else {
      result = await supabase.from('arena_sessions').insert(payload).select().single();
    }

    if (result.error) {
      toast({ title: 'Error saving session', description: result.error.message, variant: 'destructive' });
    } else {
      toast({ title: `Session ${id ? 'updated' : 'created'}!` });
      setIsSessionDialogOpen(false);
      setEditingSession(null);
      fetchSessions(selectedArena.id);
    }
    setIsSavingSession(false);
  }, [user, selectedShow, selectedArena, toast, fetchSessions]);

  const deleteSession = useCallback(async (sessionId) => {
    if (!user) return;

    const { error } = await supabase.from('arena_sessions').delete().eq('id', sessionId).eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error deleting session', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Session deleted.' });
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setSessionClasses([]);
      }
      if (selectedArena) fetchSessions(selectedArena.id);
    }
  }, [user, toast, selectedSession, selectedArena, fetchSessions]);

  // ---- SESSION CLASSES ----

  const fetchSessionClasses = useCallback(async (sessionId) => {
    if (!sessionId) return;
    setIsSessionClassesLoading(true);

    const { data, error } = await supabase
      .from('arena_session_classes')
      .select('*, class_templates(id, name, discipline_id)')
      .eq('arena_session_id', sessionId)
      .order('created_at');

    if (error) {
      toast({ title: 'Error fetching session classes', description: error.message, variant: 'destructive' });
      setIsSessionClassesLoading(false);
      return;
    }

    // Enrich with discipline names (no FK between class_templates and disciplines in Supabase schema cache)
    const disciplineIds = [...new Set((data || []).map(sc => sc.class_templates?.discipline_id).filter(Boolean))];
    let disciplineMap = {};
    if (disciplineIds.length > 0) {
      const { data: discs } = await supabase.from('disciplines').select('id, name').in('id', disciplineIds);
      (discs || []).forEach(d => { disciplineMap[d.id] = d.name; });
    }

    const enriched = (data || []).map(sc => ({
      ...sc,
      discipline_name: disciplineMap[sc.class_templates?.discipline_id] || 'Unknown',
    }));

    setSessionClasses(enriched);
    setIsSessionClassesLoading(false);
  }, [toast]);

  const addSessionClass = useCallback(async (sessionId, classTemplateId, quantity = 1, resetBetween = false) => {
    const { error } = await supabase
      .from('arena_session_classes')
      .insert({ arena_session_id: sessionId, class_template_id: classTemplateId, quantity, reset_between: resetBetween });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already assigned', description: 'This class template is already in this session.', variant: 'destructive' });
      } else {
        toast({ title: 'Error adding class', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Class added to session!' });
      fetchSessionClasses(sessionId);
    }
  }, [toast, fetchSessionClasses]);

  const updateSessionClass = useCallback(async (id, updates) => {
    const { error } = await supabase.from('arena_session_classes').update(updates).eq('id', id);

    if (error) {
      toast({ title: 'Error updating', description: error.message, variant: 'destructive' });
    }
  }, [toast]);

  const removeSessionClass = useCallback(async (id, sessionId) => {
    const { error } = await supabase.from('arena_session_classes').delete().eq('id', id);

    if (error) {
      toast({ title: 'Error removing class', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Class removed from session.' });
      fetchSessionClasses(sessionId);
    }
  }, [toast, fetchSessionClasses]);

  // ---- CLASS TEMPLATE PICKER ----

  const fetchClassTemplatesForPicker = useCallback(async (searchTerm = '') => {
    if (!user) return [];

    let query = supabase
      .from('class_templates')
      .select('id, name, discipline_id, default_arena_type')
      .eq('user_id', user.id);

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }

    query = query.order('name').limit(50);

    const { data, error } = await query;
    if (error) return [];

    // Enrich with discipline names
    const disciplineIds = [...new Set((data || []).map(t => t.discipline_id).filter(Boolean))];
    let disciplineMap = {};
    if (disciplineIds.length > 0) {
      const { data: discs } = await supabase.from('disciplines').select('id, name').in('id', disciplineIds);
      (discs || []).forEach(d => { disciplineMap[d.id] = d.name; });
    }

    return (data || []).map(t => ({
      ...t,
      discipline_name: disciplineMap[t.discipline_id] || 'Unknown',
    }));
  }, [user]);

  // ---- HELPERS ----

  const getShowDates = (show) => {
    if (!show?.project_data) return [];
    const { startDate, endDate } = show.project_data;
    if (!startDate || !endDate) return [];

    const dates = [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const current = new Date(start);

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  return {
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
  };
};
