import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';
import { Link } from 'react-router-dom';

const TIER_HIERARCHY = { founding_insider: 3, founding_member: 2, standard: 1 };

const SubscriptionGate = ({
  children,
  requiredTier = null,
  fallback = null,
}) => {
  const { isSubscribed, subscriptionTier } = useAuth();

  const hasAccess =
    isSubscribed &&
    (!requiredTier ||
      (TIER_HIERARCHY[subscriptionTier] || 0) >=
        (TIER_HIERARCHY[requiredTier] || 0));

  if (hasAccess) return children;

  if (fallback) return fallback;

  return (
    <Card className="max-w-md mx-auto text-center">
      <CardHeader>
        <Crown className="h-12 w-12 mx-auto text-primary mb-2" />
        <CardTitle>Membership Required</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          This feature requires an active membership. Upgrade to get access.
        </p>
        <Button asChild>
          <Link to="/pricing">View Plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default SubscriptionGate;
