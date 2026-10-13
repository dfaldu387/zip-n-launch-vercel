import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import PatternBookDialogContent from '@/components/customer-portal/PatternBookDialogContent';
import { supabase } from '@/lib/supabaseClient';
import { syncShowAndBook } from '@/lib/showBookSync';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// The link is stored on the BOOK (see ShowWorkspacePage): linkedShowProjectId is
// the workspace's own link, linkedProjectId is what the Pattern Book Builder's
// "Link to Existing Show" step writes. Both mean "this book belongs to that show".
const bookShowLink = (book) => {
  const bpd = book.project_data || {};
  return bpd.linkedShowProjectId || bpd.linkedProjectId || null;
};

/**
 * Patterns & Scoresheets inside a horse show: the same view the Customer Portal
 * opens for a pattern book (Patterns / Score Sheets / Accessory Documents /
 * Complete Pattern Books), reached from the show instead of the portal. It reads
 * the show's linked book directly — nothing is copied.
 */
const ShowPatternsScoresheetsPage = () => {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [show, setShow] = useState(null);
  const [book, setBook] = useState(null);
  const [associationsData, setAssociationsData] = useState([]);

  const backToShow = useCallback(() => navigate(`/horse-show-manager/show/${showId}`), [navigate, showId]);

  const load = useCallback(async () => {
    if (!user || !showId) { setIsLoading(false); return; }
    const [showRes, booksRes, assocRes] = await Promise.all([
      supabase.from('projects').select('id, project_name, project_data, user_id').eq('id', showId).single(),
      supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .eq('project_type', 'pattern_book')
        .order('created_at', { ascending: false }),
      supabase.from('associations').select('id, abbreviation, name, logo').order('name'),
    ]);
    let showRow = showRes.data || null;
    let bookRow = (booksRes.data || []).find((b) => bookShowLink(b) === showId) || null;
    // Same two-way sync as the show workspace, so opening this page directly
    // (a bookmark, a shared link) still shows the book up to date with the show.
    if (showRow && bookRow) {
      const synced = await syncShowAndBook(supabase, showRow, bookRow, user.id);
      showRow = synced.show;
      bookRow = synced.book;
    }
    setShow(showRow);
    setBook(bookRow);
    setAssociationsData(
      (assocRes.data || []).map((a) => ({
        ...a,
        logo_url: a.logo && typeof a.logo === 'string' && a.logo.startsWith('http') ? a.logo : null,
      }))
    );
    setIsLoading(false);
  }, [user, showId]);

  useEffect(() => { load(); }, [load]);

  const showName = show?.project_name || 'Show';

  return (
    <>
      <Helmet><title>{showName} - Patterns & Scoresheets</title></Helmet>
      {/* 100dvh, not 100vh: iPad Safari's 100vh ignores the browser chrome. */}
      <div className="flex h-[100dvh] flex-col bg-background">
        <Navigation />
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={backToShow}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to show
          </Button>
          <span className="truncate text-sm text-muted-foreground">{showName} · Patterns &amp; Scoresheets</span>
        </div>

        <div className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !book ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              <p className="text-lg font-medium">No pattern book is linked to this show yet.</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Pick the book once on the show page. After that, Patterns &amp; Scoresheets opens it here.
              </p>
              <Button onClick={backToShow}>Back to show</Button>
            </div>
          ) : (
            <PatternBookDialogContent
              project={book}
              profile={profile}
              user={user}
              associationsData={associationsData}
              onClose={backToShow}
              onRefresh={load}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default ShowPatternsScoresheetsPage;
