import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Menu, X, User, LogOut, LayoutDashboard, UserPlus, UploadCloud, Library, Edit, Archive, Activity, Shield, Gavel, Briefcase, Receipt, Palette } from 'lucide-react';
import logoImage from '@/assets/logo.png';
import { useSiteBranding } from '@/contexts/SiteBrandingContext';

import JudgeNotificationPanel from '@/components/JudgeNotificationPanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MEMBERSHIP_REQUIRED_PATHS = [
    '/pattern-hub',
    '/pattern-book-builder',
    '/horse-show-manager',
    '/upload-patterns',
];

const Navigation = () => {
    const { user, signOut, isAdmin, isSubscribed, openAuthModal } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { branding } = useSiteBranding();
    const logoSrc = branding?.logo_url || logoImage;

    const hasMembership = isAdmin || isSubscribed;

    const isStaffPortal = location.pathname === '/staff-portal';

    const navItems = [
        { name: 'Home', path: '/', show: 'always' },
        { name: 'Choose A Pattern', path: '/pattern-hub', show: 'always', hideOnStaffPortal: true },
        { name: 'Pattern Book Builder', path: '/pattern-book-builder', show: 'always' },
        { name: 'Horse Show Manager', path: '/horse-show-manager', show: 'always' },
        { name: 'Events', path: '/events', show: 'always' },
        { name: 'Upload Pattern', path: '/upload-patterns', show: 'always' },
        { name: 'Pricing', path: '/pricing', show: 'always' },
        { name: 'Admin Portal', path: '/admin', show: 'admin' },
    ];

    const getVisibleNavItems = () => {
        return navItems.filter(item => {
            if (isStaffPortal && item.hideOnStaffPortal) return false;
            if (item.show === 'always') return true;
            if (item.show === 'loggedIn' && user) return true;
            if (item.show === 'admin' && isAdmin) return true;
            if (item.show === 'contributor' && user) return true;
            return false;
        });
    };
    
    const UserMenu = () => {
        const userName = user?.user_metadata?.full_name || user?.email;
        const userInitials = (user?.user_metadata?.first_name?.[0] || '') + (user?.user_metadata?.last_name?.[0] || '');

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                        <Avatar>
                            <AvatarImage src={user?.user_metadata?.avatar_url} alt={userName} />
                            <AvatarFallback>{userInitials || <User/>}</AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    {user ? (
                        <>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{userName}</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {user.email}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {isAdmin && (
                                <DropdownMenuItem asChild>
                                    <Link to="/admin" className="w-full">
                                        <LayoutDashboard className="mr-2 h-4 w-4" />
                                        <span>Admin Dashboard</span>
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            {/* Dashboard temporarily removed */}
                            <DropdownMenuItem asChild>
                                <Link to={hasMembership ? "/customer-portal" : "/membership"} className="w-full">
                                    <Library className="mr-2 h-4 w-4" />
                                    <span>My Projects</span>
                                </Link>
                            </DropdownMenuItem>
                            {isAdmin && (
                                <DropdownMenuItem asChild>
                                    <Link to="/admin/tracking-user" className="w-full">
                                        <Activity className="mr-2 h-4 w-4" />
                                        <span>Tracking User</span>
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            {!isAdmin && (
                                <DropdownMenuItem asChild>
                                    <Link to="/contributor-portal" className="w-full">
                                        <Palette className="mr-2 h-4 w-4" />
                                        <span>Contributor Portal</span>
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                                <Link to={hasMembership ? "/archive-patterns" : "/membership"} className="w-full">
                                    <Archive className="mr-2 h-4 w-4" />
                                    <span>Archive Pattern</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/judges-portal" className="w-full">
                                    <Gavel className="mr-2 h-4 w-4" />
                                    <span>Judges Portal</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/staff-portal" className="w-full">
                                    <Briefcase className="mr-2 h-4 w-4" />
                                    <span>Staff Portal</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link to="/profile" className="w-full">
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Edit Profile</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/account-security" className="w-full">
                                    <Shield className="mr-2 h-4 w-4" />
                                    <span>Account & Security</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/billing-history" className="w-full">
                                    <Receipt className="mr-2 h-4 w-4" />
                                    <span>Billing & History</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={signOut}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </>
                    ) : (
                        <>
                           <DropdownMenuItem onSelect={() => openAuthModal('login')}>
                               <User className="mr-2 h-4 w-4" />
                               <span>Login</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onSelect={() => openAuthModal('sign_up')}>
                               <UserPlus className="mr-2 h-4 w-4" />
                               <span>Sign Up</span>
                           </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    const navClass = "bg-background/80 backdrop-blur-md";

    return (
        <header className={`sticky top-0 z-50 w-full transition-colors duration-300 ${navClass}`}>
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <Link to="/" className="flex-shrink-0">
                        <motion.div whileHover={{ scale: 1.05 }} className="flex items-center">
                            <img className="h-12 w-auto max-w-[140px] object-contain" alt="EquiPatterns Logo" src={logoSrc} />
                        </motion.div>
                    </Link>

                    <div className="hidden md:flex items-center flex-1 ml-6">
                        <div className="flex items-center space-x-1">
                            {getVisibleNavItems().map((item) => {
                                const needsMembership = user && !hasMembership && MEMBERSHIP_REQUIRED_PATHS.some(p => item.path.startsWith(p));
                                return (
                                    <Link
                                        key={item.name}
                                        to={needsMembership ? '/membership' : item.path}
                                    >
                                        <Button
                                            variant={item.highlight ? 'default' : (location.pathname === item.path ? 'secondary' : 'ghost')}
                                            className="font-medium"
                                        >
                                            {item.name}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                            {user ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium hidden lg:inline">{user.user_metadata?.full_name || user.email}</span>
                                        <UserMenu />
                                    </div>
                                    <JudgeNotificationPanel userEmail={user?.email} />
                                </>
                            ) : (
                               <Button onClick={() => openAuthModal('login')}>
                                    Login / Sign Up
                                </Button>
                            )}
                            <ThemeToggle />
                        </div>
                    </div>

                    <div className="md:hidden flex items-center">
                        <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </Button>
                    </div>
                </div>
            </nav>

            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden bg-background/95 backdrop-blur-lg border-t border-border"
                    >
                        <div className="pt-4 pb-3 border-b border-border px-5">
                            {user ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <User className="h-8 w-8 text-muted-foreground"/>
                                        <div className="ml-3">
                                            <p className="text-base font-medium text-foreground">{user.user_metadata?.full_name || user.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <JudgeNotificationPanel userEmail={user?.email} />
                                        <ThemeToggle />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <Button className="flex-grow" onClick={() => { openAuthModal('login'); setIsMenuOpen(false); }}>Login / Sign Up</Button>
                                    <div className="ml-2">
                                        <ThemeToggle />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                            {getVisibleNavItems().map((item) => {
                                const needsMembership = user && !hasMembership && MEMBERSHIP_REQUIRED_PATHS.some(p => item.path.startsWith(p));
                                return (
                                    <Link
                                        key={item.name}
                                        to={needsMembership ? '/membership' : item.path}
                                        className={`block px-3 py-2 rounded-md text-base font-medium ${item.highlight ? 'bg-primary text-primary-foreground' : (location.pathname === item.path ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50')}`}
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </div>
                         {user && (
                            <div className="pt-4 pb-3 border-t border-border px-5 space-y-1">
                                {isAdmin && <Link to="/admin" className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50" onClick={() => setIsMenuOpen(false)}><LayoutDashboard className="inline-block mr-2 h-4 w-4"/>Admin</Link>}
                                {isAdmin && <Link to="/admin/tracking-user" className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50" onClick={() => setIsMenuOpen(false)}><Activity className="inline-block mr-2 h-4 w-4"/>Tracking User</Link>}
                                <Link to={hasMembership ? "/customer-portal" : "/membership"} className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50" onClick={() => setIsMenuOpen(false)}><Library className="inline-block mr-2 h-4 w-4"/>My Projects</Link>
                                {!isAdmin && <Link to="/contributor-portal" className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50" onClick={() => setIsMenuOpen(false)}><Palette className="inline-block mr-2 h-4 w-4"/>Contributor Portal</Link>}
                                <Link to={hasMembership ? "/archive-patterns" : "/membership"} className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50" onClick={() => setIsMenuOpen(false)}><Archive className="inline-block mr-2 h-4 w-4"/>Archive Pattern</Link>
                                <Link to="/judges-portal" className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50" onClick={() => setIsMenuOpen(false)}><Gavel className="inline-block mr-2 h-4 w-4"/>Judges Portal</Link>
                                <Link to="/staff-portal" className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50" onClick={() => setIsMenuOpen(false)}><Briefcase className="inline-block mr-2 h-4 w-4"/>Staff Portal</Link>
                                <Link to="/profile" className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50" onClick={() => setIsMenuOpen(false)}><Edit className="inline-block mr-2 h-4 w-4"/>Edit Profile</Link>
                                <Link to="/account-security" className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50" onClick={() => setIsMenuOpen(false)}><Shield className="inline-block mr-2 h-4 w-4"/>Account & Security</Link>
                                <Link to="/billing-history" className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50" onClick={() => setIsMenuOpen(false)}><Receipt className="inline-block mr-2 h-4 w-4"/>Billing & History</Link>
                                <a href="#" onClick={() => { signOut(); setIsMenuOpen(false); }} className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/50"><LogOut className="inline-block mr-2 h-4 w-4" />Logout</a>
                            </div>
                         )}
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
};

export default Navigation;