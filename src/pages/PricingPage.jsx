import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Check, Crown, Star, Zap, Loader2, BookOpen, Gift, CalendarRange } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/components/ui/use-toast';

const membershipTiers = [
  {
    key: 'membership_founding_insider',
    name: 'Founding Insider',
    price: '$59',
    period: '/first year',
    renewalNote: 'Then $79/year after first year',
    badge: 'Limited — First 50',
    icon: Crown,
    highlighted: true,
    features: [
      'Unlimited access to patterns across all major disciplines',
      'Access to Horse Show Management features',
      '2 free Pattern Book Builder tools per year',
      '2 free Horse Show Management Events per year',
      'Unlimited, free Horse Show Schedule Builder',
      'Unlimited Pattern Uploads with membership perks',
      'Access to new features',
      'Priority support',
    ],
  },
  {
    key: 'membership_standard',
    name: 'Standard',
    price: '$99.99',
    period: '/year',
    renewalNote: '$99.99/year',
    badge: null,
    icon: Zap,
    highlighted: false,
    features: [
      'Unlimited access to patterns across all major disciplines',
      'Access to Horse Show Management features',
      '1 free Pattern Book Builder tool per year',
      '1 free Horse Show Management Event per year',
      'Unlimited, free Horse Show Schedule Builder',
      'Unlimited Pattern Uploads with membership perks',
      'Priority support',
    ],
  },
];

const aLaCarteProducts = [
  {
    key: 'pattern_book_basic',
    name: 'Pattern Book — 4-H/Open',
    subtitle: 'Essential pattern book creation tools',
    price: '$39',
    period: '/per show',
    icon: BookOpen,
  },
  {
    key: 'pattern_book_full',
    name: 'Pattern Book — Association Based',
    subtitle: 'Complete pattern book with all features',
    price: '$79',
    period: '/per show',
    icon: BookOpen,
  },
  {
    key: 'horse_show_manager_basic',
    name: 'Horse Show Manager — 4-H/Open',
    subtitle: 'Single Judge',
    price: '$99',
    period: '/per show',
    icon: CalendarRange,
  },
  {
    key: 'horse_show_manager_full',
    name: 'Horse Show Manager — Association Based',
    subtitle: 'Association Based Patterns and Score Sheets',
    price: '$149',
    period: '/per show',
    icon: CalendarRange,
  },
];

const PricingPage = () => {
  const { user, openAuthModal, isSubscribed, subscriptionTier } = useAuth();
  const { createCheckoutSession, checkoutLoading } = useSubscription();
  const { toast } = useToast();
  const [loadingKey, setLoadingKey] = useState(null);

  const handleSubscribe = async (tierKey) => {
    if (!user) {
      openAuthModal('signup');
      return;
    }

    if (isSubscribed) {
      toast({
        title: 'Already Subscribed',
        description: 'You already have an active membership. Manage it from your profile.',
      });
      return;
    }

    setLoadingKey(tierKey);
    try {
      await createCheckoutSession(tierKey);
    } catch (error) {
      toast({
        title: 'Checkout Error',
        description: error.message,
        variant: 'destructive',
      });
      setLoadingKey(null);
    }
  };

  const handlePurchase = async (productKey) => {
    if (!user) {
      openAuthModal('signup');
      return;
    }

    setLoadingKey(productKey);
    try {
      await createCheckoutSession(productKey);
    } catch (error) {
      toast({
        title: 'Checkout Error',
        description: error.message,
        variant: 'destructive',
      });
      setLoadingKey(null);
    }
  };

  const getTierBadgeForUser = (tierKey) => {
    if (!isSubscribed) return null;
    const tierMap = {
      membership_founding_insider: 'founding_insider',
      membership_founding_member: 'founding_member',
      membership_standard: 'standard',
    };
    if (subscriptionTier === tierMap[tierKey]) {
      return <Badge className="bg-green-600">Your Current Plan</Badge>;
    }
    return null;
  };

  return (
    <>
      <Helmet>
        <title>Pricing & Membership - EquiPatterns</title>
        <meta name="description" content="Choose a membership plan to access the full EquiPatterns platform. Founding members get exclusive perks and introductory pricing." />
      </Helmet>

      <div className="bg-background text-foreground">
        <Navigation />

        <main className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">

            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
                Simple, Transparent Pricing
              </h1>
              <p className="mt-4 max-w-3xl mx-auto text-lg sm:text-xl text-muted-foreground">
                Join the EquiPatterns community. Every membership includes unlimited pattern access and Horse Show tools.
              </p>
            </motion.div>

            {/* Membership highlight */}
            <div className="py-6 px-4 bg-secondary/50 rounded-lg mb-16">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div>
                  <p className="text-3xl font-bold text-primary">2</p>
                  <p className="text-sm text-muted-foreground">Membership Tiers</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">
                    <Gift className="inline h-7 w-7" />
                  </p>
                  <p className="text-sm text-muted-foreground">Free Pattern Books Included</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">
                    <Star className="inline h-7 w-7" />
                  </p>
                  <p className="text-sm text-muted-foreground">Founding Member Perks</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">Annual</p>
                  <p className="text-sm text-muted-foreground">Billing Cycle</p>
                </div>
              </div>
            </div>

            {/* Membership Tiers */}
            <h2 className="text-3xl font-bold text-center mb-10">Membership Plans</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch mb-20 max-w-4xl mx-auto">
              {membershipTiers.map((tier, index) => {
                const Icon = tier.icon;
                const isLoading = loadingKey === tier.key && checkoutLoading;
                const userBadge = getTierBadgeForUser(tier.key);

                return (
                  <motion.div
                    key={tier.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex"
                  >
                    <Card className={`w-full flex flex-col relative bg-secondary/50 border-2 ${tier.highlighted ? 'border-primary' : 'border-transparent'}`}>
                      {tier.badge && (
                        <Badge
                          variant={tier.highlighted ? 'default' : 'secondary'}
                          className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap"
                        >
                          {tier.badge}
                        </Badge>
                      )}
                      <CardHeader className="text-center">
                        <Icon className="h-10 w-10 mx-auto text-primary mb-2" />
                        <CardTitle className="text-xl">{tier.name}</CardTitle>
                        {userBadge && <div className="mt-1">{userBadge}</div>}
                        <CardDescription className="text-4xl font-bold text-primary mt-2">
                          {tier.price}
                          <span className="text-sm font-normal text-muted-foreground">{tier.period}</span>
                        </CardDescription>
                        <p className="text-xs text-muted-foreground mt-1">{tier.renewalNote}</p>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <ul className="space-y-3">
                          {tier.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button
                          className="w-full"
                          variant="default"
                          disabled={isLoading || (isSubscribed && !!userBadge)}
                          onClick={() => handleSubscribe(tier.key)}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Redirecting...
                            </>
                          ) : isSubscribed && userBadge ? (
                            'Current Plan'
                          ) : (
                            'Get Started'
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* A La Carte Products */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <h2 className="text-3xl font-bold text-center mb-4">A La Carte Products</h2>
              <p className="text-center text-muted-foreground mb-10">
                Members get free tools included with their plan. Additional purchases available below.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {aLaCarteProducts.map((product) => {
                  const Icon = product.icon;
                  const isLoading = loadingKey === product.key && checkoutLoading;

                  return (
                    <Card key={product.key} className="bg-secondary/50">
                      <CardHeader className="text-center">
                        <Icon className="h-10 w-10 mx-auto text-primary mb-2" />
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription>{product.subtitle}</CardDescription>
                        <p className="text-3xl font-bold text-primary mt-2">
                          {product.price}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {product.period}
                          </span>
                        </p>
                      </CardHeader>
                      <CardFooter>
                        <Button
                          className="w-full"
                          variant="default"
                          disabled={isLoading}
                          onClick={() => handlePurchase(product.key)}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Redirecting...
                            </>
                          ) : (
                            'Purchase'
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </motion.div>

            {/* FAQ-style note */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-20 max-w-2xl mx-auto text-center"
            >
              <Card className="bg-secondary/50">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-semibold mb-3">Questions?</h3>
                  <p className="text-muted-foreground">
                    All memberships are billed annually and include unlimited pattern access, Horse Show tools, and the free Schedule Builder.
                    The Founding Insider plan offers a special first-year rate for our earliest members.
                    Cancel anytime from your profile.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default PricingPage;
