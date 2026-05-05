import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Users, Loader2, PlusCircle, Edit, Trash2, Search, Save, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AdminBackButton from '@/components/admin/AdminBackButton';

const AssociationForm = ({ association, onSave, onCancel, isSaving }) => {
    const [formData, setFormData] = useState(association || { id: '', name: '', is_group: false, is_open_show: false, logo: '', abbreviation: '', color: '#000000', position: 'right' });
    const [logoFile, setLogoFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    useEffect(() => {
        setFormData(association || { id: '', name: '', is_group: false, is_open_show: false, logo: '', abbreviation: '', color: '#000000', position: 'right' });
        setPreviewUrl(association?.logo || null);
        setLogoFile(null);
    }, [association]);

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = (e) => { e.preventDefault(); onSave(formData, logoFile); };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="id">Association ID (Abbreviation)</Label><Input id="id" value={formData.id} onChange={e => handleChange('id', e.target.value.toUpperCase())} required disabled={!!association?.id} /></div>
            <div className="space-y-2"><Label htmlFor="name">Full Name</Label><Input id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="abbreviation">Abbreviation</Label><Input id="abbreviation" value={formData.abbreviation} onChange={e => handleChange('abbreviation', e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="color">Color</Label><Input id="color" type="color" value={formData.color || '#000000'} onChange={e => handleChange('color', e.target.value)} /></div>
            <div className="space-y-2">
                <Label htmlFor="position">Display Position</Label>
                <Select value={formData.position} onValueChange={(value) => handleChange('position', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="left">Left Column</SelectItem>
                        <SelectItem value="right">Right Column</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={previewUrl} alt={formData.name} />
                        <AvatarFallback><Users /></AvatarFallback>
                    </Avatar>
                    <Input id="logo-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <Button type="button" variant="outline" onClick={() => document.getElementById('logo-upload').click()}><Upload className="mr-2 h-4 w-4" /> Upload</Button>
                </div>
            </div>
            <div className="flex items-center space-x-2"><Checkbox id="is_group" checked={formData.is_group} onCheckedChange={c => handleChange('is_group', c)} /><Label htmlFor="is_group">Is a Group</Label></div>
            <div className="flex items-center space-x-2"><Checkbox id="is_open_show" checked={formData.is_open_show} onCheckedChange={c => handleChange('is_open_show', c)} /><Label htmlFor="is_open_show">Is Open Show</Label></div>
            <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button></DialogFooter>
        </form>
    );
};

const DivisionLevelManager = ({ levels, onUpdate, divisionId }) => {
    const [localLevels, setLocalLevels] = useState(levels || []);
    const handleAdd = () => setLocalLevels([...localLevels, { id: uuidv4(), name: '', sort_order: localLevels.length, division_id: divisionId, isNew: true }]);
    const handleRemove = (id) => setLocalLevels(localLevels.filter(l => l.id !== id));
    const handleChange = (id, field, value) => setLocalLevels(localLevels.map(l => l.id === id ? { ...l, [field]: value } : l));
    const handleSave = () => onUpdate(localLevels);

    return (
        <div className="space-y-2 p-2 bg-muted/50 rounded-md">
            {localLevels.map((level, index) => (
                <div key={level.id} className="flex items-center gap-2">
                    <Input placeholder="Level Name" value={level.name} onChange={e => handleChange(level.id, 'name', e.target.value)} />
                    <Input type="number" placeholder="Sort" value={level.sort_order} onChange={e => handleChange(level.id, 'sort_order', parseInt(e.target.value, 10) || index)} className="w-20" />
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(level.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
            ))}
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={handleAdd}><PlusCircle className="h-4 w-4 mr-2" />Add Level</Button><Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-2" />Save Levels</Button></div>
        </div>
    );
};

const DivisionManager = ({ divisions, onUpdate, associationId }) => {
    const [localDivisions, setLocalDivisions] = useState(divisions || []);
    const handleAdd = () => setLocalDivisions([...localDivisions, { id: uuidv4(), name: '', sort_order: localDivisions.length, division_levels: [], association_id: associationId, isNew: true }]);
    const handleRemove = (id) => setLocalDivisions(localDivisions.filter(d => d.id !== id));
    const handleChange = (id, field, value) => setLocalDivisions(localDivisions.map(d => d.id === id ? { ...d, [field]: value } : d));
    const handleLevelUpdate = (divisionId, levels) => setLocalDivisions(localDivisions.map(d => d.id === divisionId ? { ...d, division_levels: levels } : d));
    const handleSave = () => onUpdate(localDivisions);

    return (
        <div className="space-y-4">
            <Accordion type="multiple">
                {localDivisions.map((division, index) => (
                    <AccordionItem key={division.id} value={division.id.toString()}>
                        <div className="flex items-center"><AccordionTrigger className="flex-grow hover:no-underline"><div className="flex items-center gap-2"><Input value={division.name} onChange={e => handleChange(division.id, 'name', e.target.value)} className="mr-2" onClick={e => e.stopPropagation()} /><Input type="number" value={division.sort_order} onChange={e => handleChange(division.id, 'sort_order', parseInt(e.target.value, 10) || index)} className="w-20" onClick={e => e.stopPropagation()} /></div></AccordionTrigger><Button variant="ghost" size="icon" onClick={() => handleRemove(division.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                        <AccordionContent><DivisionLevelManager levels={division.division_levels} onUpdate={(levels) => handleLevelUpdate(division.id, levels)} divisionId={division.id} /></AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
            <div className="flex gap-2 mt-4"><Button size="sm" variant="outline" onClick={handleAdd}><PlusCircle className="h-4 w-4 mr-2" />Add Division</Button><Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-2" />Save All Changes</Button></div>
        </div>
    );
};

const AdminAssociationManagementPage = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [associations, setAssociations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingAssociation, setEditingAssociation] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [page, setPage] = useState(0);
    const [count, setCount] = useState(0);
    const RPP = 10;

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const from = page * RPP;
        const to = from + RPP - 1;

        let assocQuery = supabase.from('associations').select('*', { count: 'exact' });
        if (searchTerm) { assocQuery = assocQuery.or(`name.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%`); }
        assocQuery = assocQuery.order('name').range(from, to);
        const { data: assocs, error: assocError, count: assocCount } = await assocQuery;

        if (assocError) { toast({ title: 'Error fetching associations', description: assocError.message, variant: 'destructive' }); setIsLoading(false); return; }

        const assocIds = assocs.map(a => a.id);
        const { data: divs, error: divError } = await supabase.from('divisions').select('*, division_levels(*)').in('association_id', assocIds).order('sort_order');
        if (divError) { toast({ title: 'Error fetching divisions', description: divError.message, variant: 'destructive' }); }

        const divisionsByAssoc = (divs || []).reduce((acc, div) => {
            if (!acc[div.association_id]) acc[div.association_id] = [];
            div.division_levels.sort((a, b) => a.sort_order - b.sort_order);
            acc[div.association_id].push(div);
            return acc;
        }, {});

        const fullData = assocs.map(assoc => ({ ...assoc, divisions: divisionsByAssoc[assoc.id] || [] }));
        setAssociations(fullData);
        setCount(assocCount);
        setIsLoading(false);
    }, [toast, page, searchTerm]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveAssociation = async (formData, logoFile) => {
        setIsSaving(true);
        let logoUrl = formData.logo;

        if (logoFile) {
            const fileName = `${formData.id.toLowerCase()}-logo-${Date.now()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('association_assets')
                .upload(fileName, logoFile, {
                    cacheControl: '3600',
                    upsert: true,
                });

            if (uploadError) {
                toast({ title: 'Error uploading logo', description: uploadError.message, variant: 'destructive' });
                setIsSaving(false);
                return;
            }
            
            const { data: urlData } = supabase.storage.from('association_assets').getPublicUrl(uploadData.path);
            logoUrl = urlData.publicUrl;
        }

        const { id, name, is_group, is_open_show, abbreviation, color, position } = formData;
        const { error } = await supabase.from('associations').upsert({ id, name, is_group, is_open_show, logo: logoUrl, abbreviation, color, position }, { onConflict: 'id' });
        
        if (error) { toast({ title: 'Error saving association', description: error.message, variant: 'destructive' }); }
        else { toast({ title: 'Association saved!' }); setIsFormOpen(false); setEditingAssociation(null); fetchData(); }
        setIsSaving(false);
    };

    const handleDeleteAssociation = async (id) => {
        const { error } = await supabase.from('associations').delete().match({ id });
        if (error) { toast({ title: 'Error deleting association', description: error.message, variant: 'destructive' }); }
        else { toast({ title: 'Association deleted!' }); fetchData(); }
    };

    const handleDivisionUpdate = async (assocId, updatedDivisions) => {
        setIsSaving(true);
        const originalDivisions = associations.find(a => a.id === assocId)?.divisions || [];
        const divisionsToUpsert = updatedDivisions.map(({ division_levels, isNew, ...div }) => ({ ...div, association_id: assocId }));
        const levelsToUpsert = updatedDivisions.flatMap(d => d.division_levels.map(({ isNew, ...level }) => level));
        const divisionIdsToDelete = originalDivisions.filter(od => !updatedDivisions.some(ud => ud.id === od.id)).map(d => d.id);
        const originalLevels = originalDivisions.flatMap(d => d.division_levels);
        const levelIdsToDelete = originalLevels.filter(ol => !levelsToUpsert.some(ul => ul.id === ol.id)).map(l => l.id);

        const auditLogs = [];
        const actorId = user?.id;

        divisionIdsToDelete.forEach(id => {
            const division = originalDivisions.find(d => d.id === id);
            auditLogs.push({ actor_id: actorId, action: 'delete', entity_type: 'division', entity_id: id, payload: { name: division.name } });
        });
        levelIdsToDelete.forEach(id => {
            const level = originalLevels.find(l => l.id === id);
            auditLogs.push({ actor_id: actorId, action: 'delete', entity_type: 'division_level', entity_id: id, payload: { name: level.name } });
        });

        if (auditLogs.length > 0) {
            const { error: auditError } = await supabase.from('ep_audit_logs').insert(auditLogs);
            if (auditError) {
                toast({ title: 'Error writing to audit log', description: auditError.message, variant: 'destructive' });
            }
        }

        if (levelIdsToDelete.length > 0) { const { error } = await supabase.from('division_levels').delete().in('id', levelIdsToDelete); if (error) { toast({ title: 'Error deleting old levels', description: error.message, variant: 'destructive' }); setIsSaving(false); return; } }
        if (divisionIdsToDelete.length > 0) { const { error } = await supabase.from('divisions').delete().in('id', divisionIdsToDelete); if (error) { toast({ title: 'Error deleting old divisions', description: error.message, variant: 'destructive' }); setIsSaving(false); return; } }
        if (divisionsToUpsert.length > 0) { const { error } = await supabase.from('divisions').upsert(divisionsToUpsert); if (error) { toast({ title: 'Error saving divisions', description: error.message, variant: 'destructive' }); setIsSaving(false); return; } }
        if (levelsToUpsert.length > 0) { const { error } = await supabase.from('division_levels').upsert(levelsToUpsert); if (error) { toast({ title: 'Error saving levels', description: error.message, variant: 'destructive' }); setIsSaving(false); return; } }

        toast({ title: 'Divisions updated!' });
        fetchData();
        setIsSaving(false);
    };

    const openForm = (assoc = null) => { setEditingAssociation(assoc); setIsFormOpen(true); };
    const totalPages = Math.ceil(count / RPP);

    return (
        <>
            <Helmet><title>Association Management - Admin</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center justify-between mb-4">
                            <AdminBackButton />
                            <div className="text-center flex-1">
                                <h1 className="text-2xl md:text-3xl font-bold">Association Management</h1>
                                <p className="text-sm text-muted-foreground">Manage associations, divisions, and levels.</p>
                            </div>
                            <Button onClick={() => openForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add Association</Button>
                        </div>

                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>All Associations ({count})</CardTitle>
                                    <div className="relative w-full sm:max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Search..." className="pl-9" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }} />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div> : (
                                    <Accordion type="single" collapsible className="w-full space-y-2">
                                        {associations.map(assoc => (
                                            <AccordionItem key={assoc.id} value={assoc.id} className="border rounded-lg bg-card">
                                                <div className="flex items-center px-4">
                                                    <AccordionTrigger className="text-lg font-semibold flex-grow hover:no-underline">
                                                        <div className="flex items-center gap-4">
                                                            <Avatar>
                                                                <AvatarImage src={assoc.logo} alt={assoc.name} />
                                                                <AvatarFallback>{assoc.abbreviation || assoc.name.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            {assoc.name} ({assoc.id})
                                                        </div>
                                                    </AccordionTrigger>
                                                    <Button variant="ghost" size="icon" onClick={() => openForm(assoc)}><Edit className="h-4 w-4" /></Button>
                                                    <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will delete "{assoc.name}" and all its divisions/levels. This is irreversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteAssociation(assoc.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                                </div>
                                                <AccordionContent className="p-4"><h4 className="font-semibold mb-2">Divisions & Levels</h4><DivisionManager divisions={assoc.divisions} onUpdate={(updatedDivs) => handleDivisionUpdate(assoc.id, updatedDivs)} associationId={assoc.id} /></AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                                {associations.length === 0 && !isLoading && <div className="text-center py-10 text-muted-foreground">No associations found.</div>}
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

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent><DialogHeader><DialogTitle>{editingAssociation ? 'Edit' : 'Create'} Association</DialogTitle><DialogDescription>Fill in the association details.</DialogDescription></DialogHeader><AssociationForm association={editingAssociation} onSave={handleSaveAssociation} onCancel={() => setIsFormOpen(false)} isSaving={isSaving} /></DialogContent>
            </Dialog>
        </>
    );
};

export default AdminAssociationManagementPage;