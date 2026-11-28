import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { buildScoringClasses, buildShowExtraScoringClasses } from '@/lib/scoringClasses';

// Same link the Patterns & Scoresheets page uses: the book that belongs to this show.
const bookShowLink = (book) => {
  const bpd = book.project_data || {};
  return bpd.linkedShowProjectId || bpd.linkedProjectId || null;
};

/** Loads a show, its linked pattern book, and the class + judge rows for scoring. */
export function useShowScoringClasses(showId) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [show, setShow] = useState(null);
  const [book, setBook] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !showId) { setIsLoading(false); return; }
      const [showRes, booksRes] = await Promise.all([
        supabase.from('projects').select('id, project_name, project_data').eq('id', showId).single(),
        supabase.from('projects').select('*').eq('user_id', user.id).eq('project_type', 'pattern_book'),
      ]);
      if (cancelled) return;
      setShow(showRes.data || null);
      setBook((booksRes.data || []).find((b) => bookShowLink(b) === showId) || null);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
    // user?.id, not `user`: the user object is replaced whenever the browser tab is focused
    // again, but the person is the same, so there is nothing to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, showId]);

  // Pattern-book classes first, then the show's timed / additional performance classes.
  const rows = useMemo(() => {
    const fromBook = book ? buildScoringClasses(book.project_data) : [];
    const seen = new Set(fromBook.map((r) => r.key));
    const extra = buildShowExtraScoringClasses(show?.project_data).filter((r) => !seen.has(r.key));
    return [...fromBook, ...extra];
  }, [book, show]);
  return { isLoading, show, book, rows };
}
