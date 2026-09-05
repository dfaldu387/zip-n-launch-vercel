import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

const MembershipRoute = ({ children, requiredPermission }) => {
    const { user, loading, isSubscribed, isAdmin, hasPermission, openAuthModal, isAuthModalOpen } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const modalWasOpened = useRef(false);
    // Every horse-show-manager route that takes a specific show uses :showId —
    // present here only on those routes, undefined everywhere else.
    const { showId } = useParams();

    // A person granted Full/Section Admin on a show (Manage Access) shouldn't
    // need a paid membership just to do that job — only to own their own
    // shows. Checked against the `admins` column on that one project row,
    // which RLS already opens to its owner OR anyone listed as an admin.
    const [showAccessChecked, setShowAccessChecked] = useState(!showId);
    const [hasShowAccess, setHasShowAccess] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            openAuthModal('signin');
            modalWasOpened.current = true;
        }
    }, [loading, user, openAuthModal]);

    useEffect(() => {
        if (modalWasOpened.current && !isAuthModalOpen && !user && !loading) {
            modalWasOpened.current = false;
            navigate('/', { replace: true });
        }
    }, [isAuthModalOpen, user, loading, navigate]);

    useEffect(() => {
        if (!showId || !user || isAdmin || isSubscribed) {
            setShowAccessChecked(true);
            return;
        }
        let cancelled = false;
        setShowAccessChecked(false);
        supabase
            .from('projects')
            .select('user_id, admins')
            .eq('id', showId)
            .maybeSingle()
            .then(({ data }) => {
                if (cancelled) return;
                const admins = Array.isArray(data?.admins) ? data.admins : [];
                const isGrantedAdmin = data?.user_id === user.id || admins.some((a) =>
                    a.user_id === user.id || (a.email && a.email.toLowerCase() === (user.email || '').toLowerCase())
                );
                setHasShowAccess(isGrantedAdmin);
                setShowAccessChecked(true);
            });
        return () => { cancelled = true; };
    }, [showId, user, isAdmin, isSubscribed]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAdmin && !isSubscribed && !showAccessChecked) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    // Site admins and show-level admins (owner or Manage Access grant) bypass
    // the paid-membership check.
    if (!isAdmin && !isSubscribed && !hasShowAccess) {
        return <Navigate to="/membership" state={{ from: location }} replace />;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
        return <Navigate to="/not-authorized" state={{ from: location }} replace />;
    }

    return children;
};

export default MembershipRoute;
