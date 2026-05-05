import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';

const MembershipRoute = ({ children, requiredPermission }) => {
    const { user, loading, isSubscribed, isAdmin, hasPermission, openAuthModal, isAuthModalOpen } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const modalWasOpened = useRef(false);

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

    // Admins bypass membership check
    if (!isAdmin && !isSubscribed) {
        return <Navigate to="/membership" state={{ from: location }} replace />;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
        return <Navigate to="/not-authorized" state={{ from: location }} replace />;
    }

    return children;
};

export default MembershipRoute;
