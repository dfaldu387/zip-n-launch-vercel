import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [authModalState, setAuthModalState] = useState({ isOpen: false, initialTab: 'signin' });
  const skipAutoCloseRef = useRef(false);

  const fetchProfileAndPermissions = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      setPermissions([]);
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, role')
        .eq('id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      setProfile(data);
      const userRole = data?.role;
      const isAdminUser = userRole?.toLowerCase() === 'admin';
      setIsAdmin(isAdminUser);

      if (isAdminUser) {
        const { data: allPerms, error: permsError } = await supabase.from('permissions').select('code');
        if (permsError) throw permsError;
        setPermissions(allPerms.map(p => p.code));
      } else if (userRole) {
        const { data: rolePerms, error: rolePermsError } = await supabase
          .from('role_permissions')
          .select('permission_code')
          .eq('role_code', userRole); // Use role from profile
        if(rolePermsError) throw rolePermsError;
        setPermissions(rolePerms.map(p => p.permission_code));
      } else {
        setPermissions([]);
      }
      return data;
    } catch (e) {
      console.error('Error fetching profile & permissions:', e);
      setProfile(null);
      setIsAdmin(false);
      setPermissions([]);
      return null;
    }
  }, []);

  const handleSession = useCallback(async (currentSession) => {
    setSession(currentSession);
    const currentUser = currentSession?.user ?? null;
    setUser(currentUser);
    await fetchProfileAndPermissions(currentUser);
    setLoading(false);
  }, [fetchProfileAndPermissions]);

  useEffect(() => {
    const getSessionAndHandleUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      handleSession(session);
    };
    
    getSessionAndHandleUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        handleSession(session);
        if (event === "PASSWORD_RECOVERY" && session?.user) {
          // User clicked password reset link — redirect to update password page
          navigate('/update-password');
        } else if (event === "SIGNED_IN" && session?.user) {
          if (!skipAutoCloseRef.current) {
            closeAuthModal();
          }
        } else if (event === "USER_UPDATED") {
          setUser(session?.user ?? null);
          await fetchProfileAndPermissions(session?.user);
        } else if (event === "TOKEN_REFRESHED") {
          // Re-fetch profile on token refresh to get latest permissions
          if (session?.user) {
            await fetchProfileAndPermissions(session.user);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession, fetchProfileAndPermissions]);
  
  const signUp = useCallback(async (email, password, metadata) => {
    const { firstName, lastName, mobile } = metadata;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          mobile: mobile,
          full_name: `${firstName} ${lastName}`.trim(),
        },
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up Failed",
        description: error.message || "Something went wrong",
      });
    } else if (data.user) {
        // Create profile row with default 'Customer' role
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: `${firstName} ${lastName}`.trim(),
            role: 'Customer',
          }, { onConflict: 'id' });

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }

        if (!data.session) {
            toast({
                title: "Registration successful!",
                description: "Please check your email to confirm your account.",
            });
        }
        // Session exists = auto-confirmed, welcome handled by AuthModal
    }
    return { data, error };
  }, [toast]);
  
  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Sign in Failed",
        description: error.message || "Something went wrong",
      });
    }
    return { data, error };
  }, [toast]);

  const signOut = useCallback(async () => {
    let error = null;

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      error = signOutError;
    } catch (err) {
      // Network-level errors like "Failed to fetch" shouldn't block local sign-out
      error = err;
    }

    // Handle session not found error gracefully - this means session is already invalid
    const isSessionNotFoundError = error?.message?.includes('session_id') || 
                                   error?.message?.includes('Session not found') ||
                                   error?.message?.includes('JWT');

    if (error && error.message !== 'Failed to fetch' && !isSessionNotFoundError) {
      toast({
        variant: "destructive",
        title: "Sign out Failed",
        description: error.message || "Something went wrong",
      });
      return { error };
    }

    // Always clear local auth state even if network sign-out failed or session was already invalid
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setPermissions([]);

    toast({
      title: "Signed Out",
      description: "You have been logged out.",
    });
    navigate('/');

    return { error: null };
  }, [toast, navigate]);

  const sendPasswordResetEmail = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Password Reset Email Sent",
        description: "Please check your inbox for instructions to reset your password.",
      });
    }
    return { error };
  }, [toast]);

  const updatePassword = useCallback(async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({
        variant: "destructive",
        title: "Error updating password",
        description: error.message,
      });
    } else {
      toast({
        title: "Password updated successfully!",
        description: "Your password has been changed.",
      });
    }
    return { data, error };
  }, [toast]);

  const updateUserProfile = useCallback(async (metadata) => {
    const { data, error } = await supabase.auth.updateUser({ data: metadata });
    if (error) {
      toast({
        variant: "destructive",
        title: "Profile Update Failed",
        description: error.message,
      });
    } else {
      // Also update the customers table
      const { error: customerError } = await supabase
        .from('customers')
        .update({ 
          full_name: metadata.full_name,
          last_name: metadata.last_name,
        })
        .eq('user_id', data.user.id);

      if (customerError) {
        toast({
          variant: "destructive",
          title: "Profile Update Failed",
          description: `Could not update customer record: ${customerError.message}`,
        });
      } else {
        toast({
          title: "Profile Updated!",
          description: "Your information has been successfully updated.",
        });
      }
    }
    return { data, error };
  }, [toast]);
  
  const hasPermission = useCallback((permission) => {
    return permissions.includes(permission);
  }, [permissions]);

  const openAuthModal = (initialTab = 'signin') => {
    const validTab = (initialTab === 'sign_up' || initialTab === 'signup') ? 'signup' : 'signin';
    setAuthModalState({ isOpen: true, initialTab: validTab });
  };
  
  const closeAuthModal = () => {
    skipAutoCloseRef.current = false;
    setAuthModalState({ isOpen: false, initialTab: 'signin' });
  };

  const setSkipAutoClose = (value) => {
    skipAutoCloseRef.current = value;
  };

  const value = useMemo(() => ({
    user,
    profile,
    session,
    loading,
    isAdmin,
    permissions,
    hasPermission,
    signUp,
    signIn,
    signOut,
    sendPasswordResetEmail,
    updatePassword,
    updateUserProfile,
    isAuthModalOpen: authModalState.isOpen,
    authModalInitialTab: authModalState.initialTab,
    openAuthModal,
    closeAuthModal,
    setSkipAutoClose,
    // Subscription fields (synced from profiles table via Stripe webhook)
    subscriptionStatus: profile?.subscription_status || 'none',
    subscriptionTier: profile?.subscription_tier || null,
    isSubscribed: profile?.subscription_status === 'active',
    hasUsedFreePatternBook: profile?.free_pattern_book_used === true,
  }), [user, profile, session, loading, isAdmin, permissions, hasPermission, signUp, signIn, signOut, sendPasswordResetEmail, updatePassword, updateUserProfile, authModalState]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};