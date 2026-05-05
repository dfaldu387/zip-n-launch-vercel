import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { GitBranch, Loader2, PlusCircle, Edit, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AdminBackButton from '@/components/admin/AdminBackButton';

const DivisionForm = ({ division, onSave, onCancel, isSaving, associations }) => {
    const [formData, setFormData] = useState({ name: '', sort_order: 0, association_id: '' });
    useEffect(() => { setFormData(division || { name: '', sort_order: 0, association_id: '' }); }, [division]);
    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="name">Division Name</Label><Input id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="association_id">Association</Label><Select onValueChange={value => handleChange('association_id', value)} value={formData.association_id}><SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger><SelectContent>{associations.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="sort_order">Sort Order</Label><Input id="sort_order" type="number" value={formData.sort_order} onChange={e => handleChange('sort_order', parseInt(e.target.value, 10) || 0)} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button></DialogFooter>
        </form>
    );
};

const AdminDivisionManagementPage = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [divisions, setDivisions] = useState([]);
    const [associations, setAssociations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingDivision, setEditingDivision] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDivisionFormOpen, setIsDivisionFormOpen] = useState(false);
    const [page, setPage] = useState(0);
    const [count, setCount] = useState(0);
    const RPP = 10;

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const from = page * RPP;
        const to = from + RPP - 1;

        let query = supabase.from('divisions').select('*, associations(name)', { count: 'exact' });
        if (searchTerm) { query = query.or(`name.ilike.%${searchTerm}%,associations.name.ilike.%${searchTerm}%`); }
        query = query.order('associations(name)').order('sort_order').order('name').range(from, to);

        const { data, error, count } = await query;
        if (error) { toast({ title: 'Error fetching divisions', description: error.message, variant: 'destructive' }); }
        else { setDivisions(data); setCount(count); }

        const { data: associationsData, error: associationsError } = await supabase.from('associations').select('*').order('name');
        if (associationsError) { toast({ title: 'Error fetching associations', description: associationsError.message, variant: 'destructive' }); }
        else { setAssociations(associationsData); }

        setIsLoading(false);
    }, [toast, page, searchTerm]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveDivision = async (formData) => {
        setIsSaving(true);
        const { error } = await supabase.from('divisions').upsert(formData);
        if (error) { toast({ title: 'Error saving division', description: error.message, variant: 'destructive' }); }
        else { toast({ title: 'Division saved!' }); setIsDivisionFormOpen(false); setEditingDivision(null); fetchData(); }
        setIsSaving(false);
    };

    const handleDeleteDivision = async (division) => {
        const { error } = await supabase.from('divisions').delete().match({ id: division.id });
        if (error) {
            toast({ title: 'Error deleting division', description: error.message, variant: 'destructive' });
        } else {
            const { error: auditError } = await supabase.from('ep_audit_logs').insert({
                actor_id: user?.id,
                action: 'delete',
                entity_type: 'division',
                entity_id: division.id,
                payload: { name: division.name, association: division.associations?.name }
            });
            if (auditError) {
                toast({ title: 'Error writing to audit log', description: auditError.message, variant: 'warning' });
            }
            toast({ title: 'Division deleted!' });
            fetchData();
        }
    };

    const openDivisionForm = (div = null) => { setEditingDivision(div); setIsDivisionFormOpen(true); };
    const totalPages = Math.ceil(count / RPP);

    return (
        <>
            <Helmet><title>Division Management - Admin</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center justify-between mb-4">
                            <AdminBackButton />
                            <div className="text-center flex-1">
                                <h1 className="text-2xl md:text-3xl font-bold">Division Management</h1>
                                <p className="text-sm text-muted-foreground">Manage all divisions across associations.</p>
                            </div>
                            <Button onClick={() => openDivisionForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add Division</Button>
                        </div>

                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>All Divisions ({count})</CardTitle>
                                    <div className="relative w-full sm:max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Search divisions..." className="pl-9" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }} />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div> : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Association</TableHead><TableHead>Sort Order</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {divisions.map(div => (
                                                    <TableRow key={div.id}>
                                                        <TableCell className="font-medium">{div.name}</TableCell>
                                                        <TableCell><Badge variant="secondary">{div.associations?.name || 'N/A'}</Badge></TableCell>
                                                        <TableCell>{div.sort_order}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => openDivisionForm(div)}><Edit className="h-4 w-4" /></Button>
                                                            <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will delete "{div.name}" and all its levels. This is irreversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDivision(div)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                {divisions.length === 0 && !isLoading && <div className="text-center py-10 text-muted-foreground">No divisions found.</div>}
                            </CardContent>
                            <div className="flex items-center justify-end space-x-2 p-4 border-t">
                                <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
                                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft className="h-4 w-4" /></Button>
                                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </Card>
                    </motion.div>
                </main>
            </div>

            <Dialog open={isDivisionFormOpen} onOpenChange={setIsDivisionFormOpen}>
                <DialogContent><DialogHeader><DialogTitle>{editingDivision ? 'Edit' : 'Create'} Division</DialogTitle></DialogHeader><DivisionForm division={editingDivision} onSave={handleSaveDivision} onCancel={() => setIsDivisionFormOpen(false)} isSaving={isSaving} associations={associations} /></DialogContent>
            </Dialog>
        </>
    );
};

export default AdminDivisionManagementPage;