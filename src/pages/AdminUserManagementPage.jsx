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
  Eye
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 10;

const AdminUserManagementPage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const { hasPermission } = useAuth();
  const [viewingUser, setViewingUser] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

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
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select('id, role');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: 'Update blocked',
          description: 'No rows were updated. The profiles table is likely missing an UPDATE RLS policy for admins.',
          variant: 'destructive',
        });
        return;
      }

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

  const openViewDialog = (user) => {
    setViewingUser(user);
    setIsViewDialogOpen(true);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * PAGE_SIZE;
  const pagedUsers = filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);

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
                      {pagedUsers.map((user) => (
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
                              <Button
                                variant="ghost"
                                size="icon"
                                title="View details"
                                onClick={() => openViewDialog(user)}
                              >
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View details</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>

                  {filteredUsers.length > 0 && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {page} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
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
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Account information for this user.
            </DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{viewingUser.full_name || 'Unknown User'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium break-all">{viewingUser.email || 'No email'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Role</p>
                  <p className="font-medium">
                    {roles.find(r => r.role_code === viewingUser.role)?.name || viewingUser.role || 'Customer'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Joined</p>
                  <p className="font-medium">
                    {viewingUser.created_at ? new Date(viewingUser.created_at).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">User ID</p>
                  <p className="font-medium break-all">{viewingUser.id}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminUserManagementPage;