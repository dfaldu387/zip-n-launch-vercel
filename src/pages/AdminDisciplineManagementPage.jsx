import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { BookCopy, Loader2, PlusCircle, Edit, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import AdminBackButton from '@/components/admin/AdminBackButton';

const DisciplineForm = ({ discipline, onSave, onCancel, isSaving, associations }) => {
    const [formData, setFormData] = useState({ name: '', category: '', pattern_type: '', open_divisions: false, sort_order: 0, association_id: null, sub_association_type: null });

    useEffect(() => {
        setFormData(discipline || { name: '', category: '', pattern_type: '', open_divisions: false, sort_order: 0, association_id: null, sub_association_type: null });
    }, [discipline]);

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="name">Discipline Name</Label><Input id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="category">Category</Label><Select onValueChange={value => handleChange('category', value)} value={formData.category}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent><SelectItem value="pattern_and_scoresheet">Pattern & Score Sheet</SelectItem><SelectItem value="scoresheet_only">Score Sheet Only</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="pattern_type">Pattern Type</Label><Select onValueChange={value => handleChange('pattern_type', value)} value={formData.pattern_type}><SelectTrigger><SelectValue placeholder="Select pattern type" /></SelectTrigger><SelectContent><SelectItem value="custom">Custom</SelectItem><SelectItem value="rulebook">Rulebook</SelectItem><SelectItem value="none">None</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="association_id">Associated With</Label>
                    <Select onValueChange={value => handleChange('association_id', value)} value={formData.association_id}>
                        <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={null}>None</SelectItem>
                            {associations.map(assoc => <SelectItem key={assoc.id} value={assoc.id}>{assoc.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="sub_association_type">Sub-Type</Label>
                    <Input id="sub_association_type" value={formData.sub_association_type || ''} onChange={e => handleChange('sub_association_type', e.target.value)} placeholder="e.g., stock, pleasure" />
                </div>
            </div>
            <div className="space-y-2"><Label htmlFor="sort_order">Sort Order</Label><Input id="sort_order" type="number" value={formData.sort_order} onChange={e => handleChange('sort_order', parseInt(e.target.value, 10) || 0)} /></div>
            <div className="flex items-center space-x-2"><Checkbox id="open_divisions" checked={formData.open_divisions} onCheckedChange={checked => handleChange('open_divisions', checked)} /><Label htmlFor="open_divisions">Has Open Divisions</Label></div>
            <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button></DialogFooter>
        </form>
    );
};

const AdminDisciplineManagementPage = () => {
    const { toast } = useToast();
    const [disciplines, setDisciplines] = useState([]);
    const [associations, setAssociations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingDiscipline, setEditingDiscipline] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [page, setPage] = useState(0);
    const [count, setCount] = useState(0);
    const RPP = 10;

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const from = page * RPP;
        const to = from + RPP - 1;

        let query = supabase.from('disciplines').select('*', { count: 'exact' });
        if (searchTerm) { query = query.ilike('name', `%${searchTerm}%`); }
        query = query.order('sort_order').order('name').range(from, to);

        const { data, error, count } = await query;
        if (error) { toast({ title: 'Error fetching disciplines', description: error.message, variant: 'destructive' }); }
        else { setDisciplines(data); setCount(count); }

        const { data: associationsData, error: associationsError } = await supabase.from('associations').select('*').order('name');
        if (associationsError) { toast({ title: 'Error fetching associations', description: associationsError.message, variant: 'destructive' }); }
        else { setAssociations(associationsData); }

        setIsLoading(false);
    }, [toast, page, searchTerm]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (formData) => {
        setIsSaving(true);
        const { id, associations, ...upsertData } = formData;
        const { error } = await supabase.from('disciplines').upsert({ id, ...upsertData });

        if (error) { toast({ title: 'Error saving discipline', description: error.message, variant: 'destructive' }); }
        else { toast({ title: `Discipline ${id ? 'updated' : 'created'}!` }); setIsDialogOpen(false); setEditingDiscipline(null); fetchData(); }

        setIsSaving(false);
    };

    const handleDelete = async (disciplineId) => {
        const { error } = await supabase.from('disciplines').delete().match({ id: disciplineId });
        if (error) { toast({ title: 'Error deleting discipline', description: error.message, variant: 'destructive' }); }
        else { toast({ title: 'Discipline deleted!' }); fetchData(); }
    };

    const openForm = (discipline = null) => { 
        setEditingDiscipline(discipline); 
        setIsDialogOpen(true); 
    };
    const totalPages = Math.ceil(count / RPP);

    return (
        <>
            <Helmet><title>Discipline Management - Admin</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center justify-between mb-4">
                            <AdminBackButton />
                            <div className="text-center flex-1">
                                <h1 className="text-2xl md:text-3xl font-bold">Discipline Management</h1>
                                <p className="text-sm text-muted-foreground">Manage disciplines and their associations.</p>
                            </div>
                            <Button onClick={() => openForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add Discipline</Button>
                        </div>

                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>All Disciplines ({count})</CardTitle>
                                    <div className="relative w-full sm:max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Search disciplines..." className="pl-9" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }} />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div> : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Pattern Type</TableHead><TableHead>Association</TableHead><TableHead>Sub-Type</TableHead><TableHead>Sort</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {disciplines.map(d => (
                                                    <TableRow key={d.id}>
                                                        <TableCell className="font-medium">{d.name}</TableCell>
                                                        <TableCell>{d.category}</TableCell>
                                                        <TableCell>{d.pattern_type}</TableCell>
                                                        <TableCell>
                                                            {d.association_id ? <Badge variant="secondary">{associations.find(a => a.id === d.association_id)?.name || d.association_id}</Badge> : 'None'}
                                                        </TableCell>
                                                        <TableCell>{d.sub_association_type || 'N/A'}</TableCell>
                                                        <TableCell>{d.sort_order}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => openForm(d)}><Edit className="h-4 w-4" /></Button>
                                                            <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{d.name}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(d.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                {disciplines.length === 0 && !isLoading && <div className="text-center py-10 text-muted-foreground">No disciplines found.</div>}
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

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]"><DialogHeader><DialogTitle>{editingDiscipline?.id ? 'Edit' : 'Create'} Discipline</DialogTitle><DialogDescription>Fill in the discipline details.</DialogDescription></DialogHeader>
                    <DisciplineForm 
                        discipline={editingDiscipline} 
                        onSave={handleSave} 
                        onCancel={() => setIsDialogOpen(false)} 
                        isSaving={isSaving} 
                        associations={associations} 
                    />
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AdminDisciplineManagementPage;