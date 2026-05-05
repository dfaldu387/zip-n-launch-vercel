import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { KeyRound, Loader2, PlusCircle, Edit, Trash2, Search } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import AdminBackButton from '@/components/admin/AdminBackButton';

const RoleForm = ({ role, onSave, onCancel, isSaving }) => {
    const [formData, setFormData] = useState(role || { role_code: '', name: '', min_call_time_minutes: 0 });

    useEffect(() => {
        setFormData(role || { role_code: '', name: '', min_call_time_minutes: 0 });
    }, [role]);

    const handleChange = (field, value) => {
        if (field === 'role_code') {
            value = value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
        }
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="role_code">Role Code</Label>
                <Input id="role_code" value={formData.role_code} onChange={e => handleChange('role_code', e.target.value)} required disabled={!!role?.role_code} placeholder="e.g., SHOW_MANAGER" />
                <p className="text-sm text-muted-foreground">Unique identifier. Use uppercase letters, numbers, and underscores only.</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} required placeholder="e.g., Show Manager" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="min_call_time_minutes">Min Call Time (minutes)</Label>
                <Input id="min_call_time_minutes" type="number" value={formData.min_call_time_minutes || 0} onChange={e => handleChange('min_call_time_minutes', parseInt(e.target.value, 10) || 0)} />
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
            </DialogFooter>
        </form>
    );
};

const PermissionManager = ({ role, permissions, onUpdate, isSaving }) => {
    const [selectedPermissions, setSelectedPermissions] = useState(role.permissions || []);

    const handleToggle = (permissionCode) => {
        setSelectedPermissions(prev =>
            prev.includes(permissionCode)
                ? prev.filter(p => p !== permissionCode)
                : [...prev, permissionCode]
        );
    };

    const handleSave = () => {
        onUpdate(role.role_code, selectedPermissions);
    };

    const groupedPermissions = permissions.reduce((acc, p) => {
        const category = p.category || 'General';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(p);
        return acc;
    }, {});

    return (
        <div className="space-y-4 p-4">
            <ScrollArea className="h-96">
                {Object.entries(groupedPermissions).sort(([a], [b]) => a.localeCompare(b)).map(([category, perms]) => (
                    <div key={category} className="mb-4">
                        <h4 className="font-semibold text-lg mb-2 border-b pb-1 capitalize">{category.replace(/_/g, ' ')}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {perms.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                                <div key={p.code} className="flex items-center space-x-2 p-1 rounded-md hover:bg-muted">
                                    <Checkbox
                                        id={`${role.role_code}-${p.code}`}
                                        checked={selectedPermissions.includes(p.code)}
                                        onCheckedChange={() => handleToggle(p.code)}
                                        disabled={role.role_code === 'ADMIN'}
                                    />
                                    <Label htmlFor={`${role.role_code}-${p.code}`} className="font-normal cursor-pointer flex-grow">{p.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </ScrollArea>
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving || role.role_code === 'ADMIN'}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Permissions for {role.name}
                </Button>
            </div>
        </div>
    );
};

const AdminRoleManagementPage = () => {
    const { toast } = useToast();
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingRole, setEditingRole] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);

        const { data: rolesData, error: rolesError } = await supabase.from('roles').select('*').order('name');
        if (rolesError) {
            toast({ title: 'Error fetching roles', description: rolesError.message, variant: 'destructive' });
        }

        const { data: permissionsData, error: permissionsError } = await supabase.from('permissions').select('*').order('category, name');
        if (permissionsError) {
            toast({ title: 'Error fetching permissions', description: permissionsError.message, variant: 'destructive' });
        } else {
            setPermissions(permissionsData || []);
        }

        const { data: rolePermsData, error: rolePermsError } = await supabase.from('role_permissions').select('role_code, permission_code');
        if (rolePermsError) {
            toast({ title: 'Error fetching role permissions', description: rolePermsError.message, variant: 'destructive' });
        }

        const rolesWithPerms = (rolesData || []).map(role => {
            const perms = (rolePermsData || [])
                .filter(rp => rp.role_code === role.role_code)
                .map(rp => rp.permission_code);
            return { ...role, permissions: perms };
        });

        setRoles(rolesWithPerms);
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveRole = async (formData) => {
        setIsSaving(true);
        const { id, permissions, ...upsertData } = formData;
        const { error } = await supabase.from('roles').upsert(upsertData, { onConflict: 'role_code' });
        
        if (error) {
            toast({ title: 'Error saving role', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Role saved!' });
            setIsFormOpen(false);
            setEditingRole(null);
            fetchData();
        }
        setIsSaving(false);
    };

    const handleDeleteRole = async (roleCode) => {
        if (roleCode === 'ADMIN') {
            toast({ title: 'Cannot Delete', description: 'The Admin role cannot be deleted.', variant: 'destructive' });
            return;
        }
        const { error: permError } = await supabase.from('role_permissions').delete().eq('role_code', roleCode);
        if (permError) {
            toast({ title: 'Error deleting role permissions', description: permError.message, variant: 'destructive' });
            return;
        }

        const { error } = await supabase.from('roles').delete().eq('role_code', roleCode);
        if (error) {
            toast({ title: 'Error deleting role', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Role deleted!' });
            fetchData();
        }
    };
    
    const handlePermissionUpdate = async (roleCode, updatedPermissions) => {
        setIsSaving(true);
        
        const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role_code', roleCode);
        if (deleteError) {
            toast({ title: 'Error clearing permissions', description: deleteError.message, variant: 'destructive' });
            setIsSaving(false);
            return;
        }
        
        if (updatedPermissions.length > 0) {
            const newPerms = updatedPermissions.map(pCode => ({ role_code: roleCode, permission_code: pCode }));
            const { error: insertError } = await supabase.from('role_permissions').insert(newPerms);
            if (insertError) {
                toast({ title: 'Error updating permissions', description: insertError.message, variant: 'destructive' });
                setIsSaving(false);
                return;
            }
        }
        
        toast({ title: 'Permissions updated successfully!' });
        fetchData();
        setIsSaving(false);
    };

    const openForm = (role = null) => {
        setEditingRole(role);
        setIsFormOpen(true);
    };

    const filteredRoles = roles.filter(role =>
        role.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <Helmet><title>Role & Permission Management - Admin</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center justify-between mb-4">
                            <AdminBackButton />
                            <div className="text-center flex-1">
                                <h1 className="text-2xl md:text-3xl font-bold">Roles & Permissions</h1>
                                <p className="text-sm text-muted-foreground">Define user roles and what they can access.</p>
                            </div>
                            <Button onClick={() => openForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add New Role</Button>
                        </div>

                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>All Roles ({roles.length})</CardTitle>
                                    <div className="relative w-full sm:max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Search roles..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center py-20"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                                ) : (
                                    <Accordion type="single" collapsible className="w-full space-y-2">
                                        {filteredRoles.map(role => (
                                            <AccordionItem key={role.role_code} value={role.role_code} className="border rounded-lg bg-card">
                                                <div className="flex items-center px-4">
                                                    <AccordionTrigger className="text-lg font-semibold flex-grow hover:no-underline">
                                                        <div className="flex items-center gap-4">
                                                            {role.name} <Badge variant="secondary">{role.role_code}</Badge>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <Button variant="ghost" size="icon" onClick={() => openForm(role)}><Edit className="h-4 w-4" /></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="text-destructive" disabled={role.role_code === 'ADMIN'}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This will permanently delete the "{role.name}" role. This cannot be undone.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteRole(role.role_code)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                                <AccordionContent>
                                                    <PermissionManager role={role} permissions={permissions} onUpdate={handlePermissionUpdate} isSaving={isSaving} />
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </main>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
                    </DialogHeader>
                    <RoleForm role={editingRole} onSave={handleSaveRole} onCancel={() => setIsFormOpen(false)} isSaving={isSaving} />
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AdminRoleManagementPage;