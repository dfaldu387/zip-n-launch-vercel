import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ShoppingBag, ArrowRight, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  // If session_id is present, the user came from Stripe Checkout
  const isStripeCheckout = !!sessionId;

  return (
    <>
      <Helmet>
        <title>Payment Successful - EquiPatterns</title>
        <meta name="description" content="Your purchase was successful. Thank you!" />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="container mx-auto px-4 py-16 flex items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="max-w-md"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 20,
                delay: 0.2,
              }}
            >
              <CheckCircle className="mx-auto h-24 w-24 text-green-500" />
            </motion.div>
            <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Thank You!
            </h1>
            <p className="mt-4 text-xl text-muted-foreground">
              {isStripeCheckout
                ? 'Your payment was processed successfully. Your account has been updated.'
                : 'Your order has been placed successfully. A confirmation email is on its way to you.'}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              {isStripeCheckout ? (
                <>
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link to="/profile">
                      <Crown className="mr-2 h-5 w-5" />
                      View My Account
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                    <Link to="/">
                      Back to Homepage <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link to="/store">
                      <ShoppingBag className="mr-2 h-5 w-5" />
                      Continue Shopping
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                    <Link to="/">
                      Back to Homepage <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default SuccessPage;
