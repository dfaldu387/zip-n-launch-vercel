import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Crown, ArrowLeft, Loader2, FolderOpen, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Navigation from '@/components/Navigation';
import { useUsageGate } from '@/hooks/useUsageGate';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const TYPE_LABELS = {
  show: { singular: 'show', plural: 'shows' },
  pattern_book: { singular: 'pattern book', plural: 'pattern books' },
};

// Where "Open" sends the user for each project type.
const editPath = (projectType, id) =>
  projectType === 'pattern_book'
    ? `/pattern-book-builder/${id}`
    : `/horse-show-manager/show/${id}`;

/**
 * Lists the projects the user already owns so the limit screen is never a
 * dead end — editing existing work is always free.
 */
const ExistingProjects = ({ projectType, labels }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, status, created_at')
        .eq('user_id', user.id)
        .eq('project_type', projectType)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('Error loading existing projects:', error);
      setProjects(data || []);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user, projectType]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projects.length === 0) return null;

  return (
    <div className="text-left space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <FolderOpen className="h-4 w-4 text-primary" />
        Open one of your {labels.plural}
      </div>
      <p className="text-xs text-muted-foreground">
        Editing your existing {labels.plural} is always free — no upgrade needed.
      </p>
      <div className="space-y-2 pt-1">
        {projects.map((p) => (
          <Link
            key={p.id}
            to={editPath(projectType, p.id)}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-primary hover:bg-accent/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {p.project_name || `Untitled ${labels.singular}`}
              </span>
              {p.status && (
                <span className="block text-xs text-muted-foreground">{p.status}</span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
};

/**
 * Wraps a "create new" page. If the user has used all their free projects,
 * renders an upgrade prompt instead of children.
 *
 * Props:
 *  - children: the normal page content
 *  - toolName: display name ("Horse Show Manager" | "Pattern Book Builder")
 *  - projectType: "show" | "pattern_book" — which type to count
 *  - isEditing: if true, always allow (editing existing projects is free)
 */
export const UsageLimitGate = ({ children, toolName = 'this tool', projectType = 'show', isEditing = false }) => {
  const { canCreate, showCount, freeLimit, loading } = useUsageGate(projectType);
  const navigate = useNavigate();
  const labels = TYPE_LABELS[projectType] || TYPE_LABELS.show;

  // Always allow editing existing projects
  if (isEditing) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (canCreate) return <>{children}</>;

  // --- Upgrade Required ---
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-16 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-2 border-amber-300 dark:border-amber-600">
            <CardContent className="py-12 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Shield className="h-8 w-8 text-amber-600" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Free Limit Reached</h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You've created <strong>{showCount}</strong> of your <strong>{freeLimit} free {labels.plural}</strong>.
                  To create additional {labels.plural} using {toolName}, please upgrade to a membership plan.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 max-w-sm mx-auto">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{labels.plural} Created</span>
                  <span className="font-semibold">{showCount} / {freeLimit}</span>
                </div>
                <div className="mt-2 w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="max-w-sm mx-auto">
                <ExistingProjects projectType={projectType} labels={labels} />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button asChild size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                  <Link to="/pricing">
                    <Crown className="mr-2 h-4 w-4" />
                    View Membership Plans
                  </Link>
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate(-1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                You can still edit and manage your existing {labels.plural} at any time.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};
