import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ShieldAlert, Home, LogIn } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const NotAuthorizedPage = () => {
    const { user, openAuthModal } = useAuth();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    return (
        <>
            <Helmet>
                <title>Access Denied - EquiPatterns</title>
                <meta name="description" content="You are not authorized to view this page." />
            </Helmet>
            <div className="min-h-screen bg-background flex flex-col">
                <Navigation />
                <main className="flex-grow flex items-center justify-center container mx-auto px-4 py-8">
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                        <Card className="w-full max-w-md shadow-2xl border-destructive/50">
                            <CardHeader className="text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 20 }}
                                    className="mx-auto"
                                >
                                    <ShieldAlert className="h-16 w-16 text-destructive mx-auto" />
                                </motion.div>
                                <CardTitle className="text-3xl font-bold mt-4">Access Denied</CardTitle>
                                {user ? (
                                    <CardDescription>
                                        You do not have the necessary permissions to view this page.
                                    </CardDescription>
                                ) : (
                                    <CardDescription>
                                        You must be logged in to view this page.
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="text-center">
                                <p className="text-muted-foreground mb-6">
                                    {user 
                                        ? `Your current role does not grant access. If you believe this is an error, please contact support.`
                                        : `Please log in to continue.`
                                    }
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                                    {user ? (
                                        <Button asChild>
                                            <Link to="/">
                                                <Home className="mr-2 h-4 w-4" />
                                                Return to Homepage
                                            </Link>
                                        </Button>
                                    ) : (
                                        <>
                                            <Button onClick={() => openAuthModal('signin')}>
                                                <LogIn className="mr-2 h-4 w-4" />
                                                Log In
                                            </Button>
                                            <Button asChild variant="outline">
                                                <Link to={from}>
                                                    <Home className="mr-2 h-4 w-4" />
                                                     Go to Homepage
                                                </Link>
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </main>
            </div>
        </>
    );
};

export default NotAuthorizedPage;