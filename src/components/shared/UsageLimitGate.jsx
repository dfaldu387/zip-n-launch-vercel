import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Crown, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Navigation from '@/components/Navigation';
import { useUsageGate } from '@/hooks/useUsageGate';

const TYPE_LABELS = {
  show: { singular: 'show', plural: 'shows' },
  pattern_book: { singular: 'pattern book', plural: 'pattern books' },
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
