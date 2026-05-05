import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { 
  Users, 
  Search, 
  User,
  Mail,
  Calendar,
  Loader2,
  LogIn
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AdminUserManagementPage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const { hasPermission, user: adminUser } = useAuth();
  const [impersonatingUser, setImpersonatingUser] = useState(null);
  const [isImpersonateDialogOpen, setIsImpersonateDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('role_code, name')
        .order('name');
      
      if(rolesError) throw rolesError;
      setRoles(rolesData);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, role');

      if (profilesError) throw profilesError;

      // Get emails from auth.users via RPC, fallback to customers table
      const profileIds = profilesData.map(p => p.id);
      const [authResult, customersResult] = await Promise.all([
        supabase.rpc('get_auth_user_emails', { user_ids: profileIds }),
        supabase.from('customers').select('user_id, email, created_at').in('user_id', profileIds),
      ]);

      const authMap = new Map((authResult.data || []).map(u => [u.id, u]));
      const customersMap = new Map((customersResult.data || []).map(c => [c.user_id, c]));

      const combinedUsers = profilesData.map(profile => {
        const authUser = authMap.get(profile.id);
        const customer = customersMap.get(profile.id);
        return {
          ...profile,
          email: authUser?.email || customer?.email || 'N/A',
          created_at: authUser?.created_at || customer?.created_at,
        };
      });

      setUsers(combinedUsers);
    } catch (error) {
        console.error("Error loading data:", error);
      toast({
        title: 'Error loading data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRoleChange = async (userId, newRole) => {
    if (!hasPermission('users:manage')) {
        toast({ title: 'Permission Denied', description: 'You do not have permission to change user roles.', variant: 'destructive' });
        return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Role updated',
        description: `User role has been changed to ${newRole}.`,
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: 'Error updating role',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openImpersonateDialog = (user) => {
    setImpersonatingUser(user);
    setIsImpersonateDialogOpen(true);
  };

  const handleImpersonate = async () => {
    if (!impersonatingUser) return;

    try {
      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: { user_id: impersonatingUser.id },
      });

      if (error) throw error;

      const { session, error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) throw sessionError;
      
      localStorage.setItem('impersonator', JSON.stringify({ id: adminUser.id, email: adminUser.email }));

      toast({
        title: 'Impersonation Successful',
        description: `You are now logged in as ${impersonatingUser.full_name}.`,
      });

      window.location.href = '/dashboard';

    } catch (error) {
      toast({
        title: 'Impersonation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImpersonateDialogOpen(false);
      setImpersonatingUser(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const email = user.email || '';
    const fullName = user.full_name || '';
    
    const matchesSearch = 
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  return (
    <>
      <Helmet>
        <title>User Management - EquiPatterns Admin</title>
        <meta name="description" content="Manage user accounts, roles, and permissions." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-start justify-between mb-4">
              <AdminBackButton />
              <div className="text-center flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">User Management</h1>
                <p className="text-sm text-muted-foreground">
                  Manage user accounts and their assigned roles across the platform.
                </p>
              </div>
              <div className="w-[70px]" />
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map(role => (
                    <SelectItem key={role.role_code} value={role.role_code}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Users ({filteredUsers.length})</CardTitle>
                  <CardDescription>
                    Manage user accounts and their roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                  <User className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{user.full_name || 'Unknown User'}</p>
                                  <p className="text-sm text-muted-foreground">ID: {user.id.slice(0, 8)}...</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{user.email || 'No email'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={user.role || 'Customer'}
                                onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                                disabled={!hasPermission('users:manage')}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {roles.map(role => (
                                    <SelectItem key={role.role_code} value={role.role_code}>{role.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {adminUser?.id !== user.id && (
                                <Button variant="ghost" size="sm" onClick={() => openImpersonateDialog(user)} disabled={!hasPermission('users:impersonate')}>
                                  <LogIn className="h-4 w-4 mr-2" />
                                  Impersonate
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {filteredUsers.length === 0 && !isLoading && (
              <div className="text-center py-20 text-muted-foreground">
                <Users className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg">No users found</p>
                <p className="text-sm">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </motion.div>
        </main>
      </div>
      <AlertDialog open={isImpersonateDialogOpen} onOpenChange={setIsImpersonateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Impersonate User</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to impersonate {impersonatingUser?.full_name}. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImpersonatingUser(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImpersonate}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminUserManagementPage;