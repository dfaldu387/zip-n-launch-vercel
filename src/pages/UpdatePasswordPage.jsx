import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';

const UpdatePasswordPage = () => {
    const { updatePassword, session, loading } = useAuth();
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [isMounted, setIsMounted] = useState(false);
    const [linkExpired, setLinkExpired] = useState(false);

    useEffect(() => {
      setIsMounted(true);
    }, []);

    // Supabase has to exchange the recovery token from the URL before a session
    // exists. This used to be a flat 3-second timer, so on a slow connection the
    // reset link simply bounced the user to the home page and looked broken.
    // Now the timer only starts once Supabase has finished loading and still has
    // no session, and it explains itself instead of redirecting silently.
    useEffect(() => {
      if (loading || session) {
        setLinkExpired(false);
        return;
      }
      const timeout = setTimeout(() => setLinkExpired(true), 8000);
      return () => clearTimeout(timeout);
    }, [session, loading]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        setIsUpdating(true);
        const { error: updateError } = await updatePassword(newPassword);
        setIsUpdating(false);
        if (!updateError) {
            setTimeout(() => {
                navigate('/');
            }, 2000);
        }
    };
    
    if (loading || !isMounted || (!session && !linkExpired)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Reset link expired</CardTitle>
                        <CardDescription>
                            This password reset link is no longer valid. Reset links can only be
                            used once, and they expire after a while.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate('/')}>Back to Home</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Update Password</title>
                <meta name="description" content="Update your account password." />
            </Helmet>
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="w-full max-w-md shadow-2xl">
                        <CardHeader className="text-center">
                            <CardTitle className="text-3xl font-bold">Set New Password</CardTitle>
                            <CardDescription>Please enter and confirm your new password.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">New Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="new-password"
                                            type={showPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            placeholder="••••••••"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="confirm-password"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            placeholder="••••••••"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                                {error && (
                                    <p className="text-sm text-destructive">{error}</p>
                                )}
                                <Button type="submit" className="w-full" disabled={isUpdating}>
                                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Update Password'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </>
    );
};

export default UpdatePasswordPage;