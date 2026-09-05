import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { isRole, escapeLikePattern, ROLE } from '@/lib/roles';

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
  const [authModalState, setAuthModalState] = useState({ isOpen: false, initialTab: 'signin', prefillEmail: '' });
  const skipAutoCloseRef = useRef(false);
  // Set while the user is signing out on purpose, so losing the session then is
  // not reported back to them as an expiry.
  const deliberateSignOutRef = useRef(false);
  // Whether we currently believe somebody is signed in.
  const hadSessionRef = useRef(false);
  // The expiry can be spotted twice — once by the startup getSession and once by
  // the auth event that follows it — and the person only needs telling once.
  const expiryNotifiedRef = useRef(false);

  // Which account the profile and permissions currently in state belong to.
  //
  // Several auth events describe the same signed-in user, and each one used to
  // trigger its own round of profile + permission queries: the startup getSession
  // and the initial onAuthStateChange both fired, and TOKEN_REFRESHED and
  // USER_UPDATED each fetched twice (once through handleSession, once in their own
  // branch). That is four requests on every page load and two on every hourly token
  // refresh, all returning the same rows.
  const loadedProfileForRef = useRef(null);
  // The load that is currently running, so a second caller can wait for it
  // rather than carrying on as if the answer were already known.
  const inFlightProfileRef = useRef(null);

  const fetchProfileAndPermissions = useCallback(async (user, { force = false } = {}) => {
    if (!user) {
      loadedProfileForRef.current = null;
      inFlightProfileRef.current = null;
      setProfile(null);
      setIsAdmin(false);
      setPermissions([]);
      return null;
    }

    // Already loaded — or still loading — for this account. Only re-read when
    // something asks for fresh data (a token refresh or a profile update).
    //
    // This used to return straight away. On a page load both getSession() and
    // onAuthStateChange fire handleSession, so the second call hit this line
    // while the first was still fetching, returned, and let handleSession set
    // loading to false with isAdmin and permissions still empty — and every
    // guarded route bounced the user to /not-authorized. Intermittent by nature:
    // clicking through the app was fine, refreshing or typing the URL was not.
    // Waiting on the in-flight load instead keeps loading true until the answer
    // is actually known.
    if (!force && loadedProfileForRef.current === user.id) {
      return inFlightProfileRef.current ? await inFlightProfileRef.current : null;
    }
    loadedProfileForRef.current = user.id;

    const load = async () => {
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
      const isAdminUser = isRole(userRole, ROLE.ADMIN);
      setIsAdmin(isAdminUser);

      if (isAdminUser) {
        const { data: allPerms, error: permsError } = await supabase.from('permissions').select('code');
        if (permsError) throw permsError;
        setPermissions(allPerms.map(p => p.code));
      } else if (userRole) {
        // ilike is an exact match that ignores capitalisation, so a profile saved
        // as 'showmanager' still finds the 'SHOW_MANAGER' row instead of silently
        // ending up with zero permissions. The value has to be escaped first:
        // role codes contain underscores, and in SQL an unescaped '_' matches any
        // single character.
        const rolePattern = escapeLikePattern(userRole);
        const { data: rolePerms, error: rolePermsError } = await supabase
          .from('role_permissions')
          .select('permission_code')
          .ilike('role_code', rolePattern);
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
    };

    const promise = load();
    inFlightProfileRef.current = promise;
    try {
      return await promise;
    } finally {
      if (inFlightProfileRef.current === promise) inFlightProfileRef.current = null;
    }
  }, []);

  const notifyExpired = useCallback(() => {
    if (expiryNotifiedRef.current) return;
    expiryNotifiedRef.current = true;
    toast({
      title: 'Your session has expired',
      description: 'Please sign in again to continue.',
    });
  }, [toast]);

  const handleSession = useCallback(async (currentSession) => {
    setSession(currentSession);
    const currentUser = currentSession?.user ?? null;

    // A session that disappears without the user asking is an expiry: the stored
    // refresh token was rejected and supabase-js signed them out. It handles that
    // quietly — the only sign was an AuthApiError in the console — so the person
    // was simply logged out mid-task with no explanation, which reads as the site
    // breaking. Telling them once turns it into something they can act on.
    if (hadSessionRef.current && !currentUser && !deliberateSignOutRef.current) {
      notifyExpired();
    }
    hadSessionRef.current = !!currentUser;
    if (currentUser) expiryNotifiedRef.current = false;
    // Cleared once the sign-out has been seen, so the next unexpected loss of a
    // session is still reported.
    if (!currentUser) deliberateSignOutRef.current = false;

    setUser(currentUser);
    await fetchProfileAndPermissions(currentUser);
    setLoading(false);
  }, [fetchProfileAndPermissions, notifyExpired]);

  useEffect(() => {
    const getSessionAndHandleUser = async () => {
      // Read this BEFORE getSession: if the stored refresh token is rejected,
      // supabase-js clears the key on its way to returning null.
      //
      // The in-session check below only catches a session lost while the page is
      // open. The common case is the other one — somebody comes back the next
      // day, the refresh token has expired, and the app boots straight to signed
      // out with nothing but an AuthApiError in the console to explain it.
      const hadStoredSession = [localStorage, sessionStorage].some((store) => {
        try {
          return Object.keys(store).some((k) => k.startsWith('sb-') && k.includes('auth-token'));
        } catch {
          return false;   // storage blocked (private mode, blocked cookies)
        }
      });

      const { data: { session } } = await supabase.auth.getSession();

      if (hadStoredSession && !session) {
        notifyExpired();
      }

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
          // force: the account details just changed, so the cached copy is stale.
          await fetchProfileAndPermissions(session?.user, { force: true });
        } else if (event === "TOKEN_REFRESHED") {
          // force: picks up a role or permission change made since sign-in.
          if (session?.user) {
            await fetchProfileAndPermissions(session.user, { force: true });
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession, fetchProfileAndPermissions, notifyExpired]);
  
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
        // The profile row itself is created by the handle_new_user() database
        // trigger, which also sets role = 'Customer'. The browser must never send
        // `role` — that is how an account could ask to be created as an admin.
        // This only fills in the name, in case the trigger ran before the metadata
        // was available.
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: `${firstName} ${lastName}`.trim(),
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
    deliberateSignOutRef.current = true;

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
      // Keep the profiles table (canonical store, read by admin views & signup trigger) in sync.
      const profileUpdates = {};
      if (metadata.full_name !== undefined) profileUpdates.full_name = metadata.full_name;
      if (metadata.avatar_url !== undefined) profileUpdates.avatar_url = metadata.avatar_url;
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', data.user.id);
        if (profileError) {
          console.error('Error syncing profiles table:', profileError);
        }
      }

      // Also update the customers table
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          full_name: metadata.full_name,
          last_name: metadata.last_name,
        })
        .eq('user_id', data.user.id);

      // The profile itself has already saved by this point. A failure here only
      // means the secondary customers record did not sync, so saying "Profile
      // Update Failed" told the user their change was lost when it was not.
      if (customerError) {
        console.error('Error syncing customers table:', customerError);
      }

      // Read the profile back now that both writes are done. The USER_UPDATED event
      // fires as soon as the auth record changes, which can be before the profiles
      // row above has been written — so without this the name in the header could
      // still show the old value until the next page load.
      await fetchProfileAndPermissions(data.user, { force: true });

      toast({
        title: "Profile Updated!",
        description: "Your information has been successfully updated.",
      });
    }
    return { data, error };
  }, [toast, fetchProfileAndPermissions]);
  
  const hasPermission = useCallback((permission) => {
    return permissions.includes(permission);
  }, [permissions]);

  const openAuthModal = (initialTab = 'signin', prefillEmail = '') => {
    const validTab = (initialTab === 'sign_up' || initialTab === 'signup') ? 'signup' : 'signin';
    setAuthModalState({ isOpen: true, initialTab: validTab, prefillEmail });
  };

  const closeAuthModal = () => {
    skipAutoCloseRef.current = false;
    setAuthModalState({ isOpen: false, initialTab: 'signin', prefillEmail: '' });
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
    authModalPrefillEmail: authModalState.prefillEmail,
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