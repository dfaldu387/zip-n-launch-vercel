import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Layers, Loader2, PlusCircle, Edit, Trash2, Search, ChevronLeft, ChevronRight, Download, File as FileIcon, UploadCloud } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDropzone } from 'react-dropzone';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AdminBackButton from '@/components/admin/AdminBackButton';

const DivisionLevelForm = ({ level, onSave, onCancel, isSaving, divisions, associations = [], availableMedia }) => {
    const [formData, setFormData] = useState({ name: '', sort_order: 0, division_id: '', pattern_media: null });
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);

    useEffect(() => {
        if (level) {
            setFormData({ ...level });
        } else {
            setFormData({ name: '', sort_order: 0, division_id: '', pattern_media: null });
        }
    }, [level]);

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

    const handleMediaSelect = (media) => {
        handleChange('pattern_media', media.file_url);
    };

    const handleUploadComplete = (newMediaUrl) => {
        handleChange('pattern_media', newMediaUrl);
        setIsUploaderOpen(false);
    };

    const currentMediaName = () => {
        if (!formData.pattern_media) return "Select Media...";
        const media = availableMedia.find(m => m.file_url === formData.pattern_media);
        return media ? media.file_name : formData.pattern_media.split('/').pop();
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="name">Level Name</Label><Input id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="division_id">Division</Label><Select onValueChange={value => handleChange('division_id', value)} value={formData.division_id}><SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger><SelectContent>{divisions.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({associations.find(a => a.id === d.association_id)?.name || 'N/A'})</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="sort_order">Sort Order</Label><Input id="sort_order" type="number" value={formData.sort_order} onChange={e => handleChange('sort_order', parseInt(e.target.value, 10) || 0)} /></div>
                
                <div className="space-y-2">
                    <Label>Pattern Media</Label>
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal truncate">
                                    <FileIcon className="mr-2 h-4 w-4" />
                                    <span className="truncate">{currentMediaName()}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0" align="start">
                                <div className="p-2">
                                    <Input placeholder="Search media..." className="mb-2" />
                                </div>
                                <ScrollArea className="h-60">
                                    <div className="p-2 space-y-1">
                                        {availableMedia.map(media => (
                                            <Button key={media.id} variant="ghost" className="w-full justify-start" onClick={() => handleMediaSelect(media)}>
                                                {media.file_name}
                                            </Button>
                                        ))}
                                        {availableMedia.length === 0 && <p className="p-2 text-sm text-muted-foreground">No media found.</p>}
                                    </div>
                                </ScrollArea>
                            </PopoverContent>
                        </Popover>
                        <Button type="button" variant="secondary" onClick={() => setIsUploaderOpen(true)}><UploadCloud className="h-4 w-4" /></Button>
                    </div>
                    {formData.pattern_media && <div className="text-sm text-muted-foreground">Current: <a href={formData.pattern_media} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{formData.pattern_media.split('/').pop()}</a></div>}
                </div>

                <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button></DialogFooter>
            </form>
            <MediaUploaderDialog 
                isOpen={isUploaderOpen} 
                onClose={() => setIsUploaderOpen(false)} 
                onUploadComplete={handleUploadComplete}
                divisionId={formData.division_id}
            />
        </>
    );
};

const MediaUploaderDialog = ({ isOpen, onClose, onUploadComplete, divisionId }) => {
    const { toast } = useToast();
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

    const handleUpload = async () => {
        if (!file) {
            toast({ title: 'Upload Failed', description: 'Please select a file.', variant: 'destructive' });
            return;
        }
        if (!divisionId) {
            toast({ title: 'Upload Failed', description: 'Please select a division first.', variant: 'destructive' });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        const fileName = `division_levels/${divisionId}/${uuidv4()}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('association_assets')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            toast({ title: 'Storage Upload Failed', description: uploadError.message, variant: 'destructive' });
            setIsUploading(false);
            return;
        }

        const { data: urlData } = supabase.storage.from('association_assets').getPublicUrl(uploadData.path);
        
        toast({ title: 'Upload Successful', description: `${file.name} has been uploaded.` });
        onUploadComplete(urlData.publicUrl);
        handleClose();
    };

    const handleClose = () => {
        setFile(null);
        setIsUploading(false);
        setUploadProgress(0);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload New Pattern Media</DialogTitle>
                    <DialogDescription>Upload a new file to be used as pattern media.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div {...getRootProps()} className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                        <input {...getInputProps()} />
                        <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                        {file ? (
                            <p className="mt-4 font-semibold">{file.name}</p>
                        ) : (
                            <p className="mt-4 text-muted-foreground">Drag & drop a file here, or click to select</p>
                        )}
                    </div>
                    {isUploading && <Progress value={uploadProgress} className="w-full" />}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isUploading}>Cancel</Button>
                    <Button onClick={handleUpload} disabled={!file || isUploading}>
                        {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : 'Upload & Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const AdminDivisionLevelManagementPage = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [levels, setLevels] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [associations, setAssociations] = useState([]);
    const [availableMedia, setAvailableMedia] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingLevel, setEditingLevel] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLevelFormOpen, setIsLevelFormOpen] = useState(false);
    const [page, setPage] = useState(0);
    const [count, setCount] = useState(0);
    const RPP = 10;

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const from = page * RPP;
        const to = from + RPP - 1;

        let query = supabase.from('division_levels').select('*, divisions(*)', { count: 'exact' });
        if (searchTerm) { query = query.or(`name.ilike.%${searchTerm}%`); }
        query = query.order('sort_order').order('name').range(from, to);

        const { data, error, count } = await query;
        if (error) { toast({ title: 'Error fetching levels', description: error.message, variant: 'destructive' }); }
        else { setLevels(data); setCount(count); }

        const { data: divisionsData, error: divisionsError } = await supabase.from('divisions').select('*').order('name');
        if (divisionsError) { toast({ title: 'Error fetching divisions', description: divisionsError.message, variant: 'destructive' }); }
        else { setDivisions(divisionsData); }

        const { data: assocData } = await supabase.from('associations').select('id, name').order('name');
        if (assocData) { setAssociations(assocData); }

        const { data: mediaData, error: mediaError } = await supabase.from('association_assets').select('id, file_name, file_url').limit(1000);
        if (mediaError) { toast({ title: 'Error fetching media', description: mediaError.message, variant: 'destructive' }); }
        else { setAvailableMedia(mediaData); }

        setIsLoading(false);
    }, [toast, page, searchTerm]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveLevel = async (formData) => {
        setIsSaving(true);
        const { error } = await supabase.from('division_levels').upsert(formData);
        if (error) { toast({ title: 'Error saving level', description: error.message, variant: 'destructive' }); }
        else { toast({ title: 'Level saved!' }); setIsLevelFormOpen(false); setEditingLevel(null); fetchData(); }
        setIsSaving(false);
    };

    const handleDeleteLevel = async (level) => {
        const { error } = await supabase.from('division_levels').delete().match({ id: level.id });
        if (error) {
            toast({ title: 'Error deleting level', description: error.message, variant: 'destructive' });
        } else {
            const { error: auditError } = await supabase.from('ep_audit_logs').insert({
                actor_id: user?.id,
                action: 'delete',
                entity_type: 'division_level',
                entity_id: level.id,
                payload: { name: level.name, division: level.divisions?.name }
            });
            if (auditError) {
                toast({ title: 'Error writing to audit log', description: auditError.message, variant: 'warning' });
            }
            toast({ title: 'Level deleted!' });
            fetchData();
        }
    };

    const openLevelForm = (level = null) => { setEditingLevel(level); setIsLevelFormOpen(true); };
    const totalPages = Math.ceil(count / RPP);

    return (
        <>
            <Helmet><title>Division Level Management - Admin</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center justify-between mb-4">
                            <AdminBackButton />
                            <div className="text-center flex-1">
                                <h1 className="text-2xl md:text-3xl font-bold">Division Level Management</h1>
                                <p className="text-sm text-muted-foreground">Manage all levels within divisions.</p>
                            </div>
                            <Button onClick={() => openLevelForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add Level</Button>
                        </div>

                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>All Levels ({count})</CardTitle>
                                    <div className="relative w-full sm:max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Search levels..." className="pl-9" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }} />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div> : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Division</TableHead><TableHead>Association</TableHead><TableHead>Sort Order</TableHead><TableHead>Pattern Media</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {levels.map(level => (
                                                    <TableRow key={level.id}>
                                                        <TableCell className="font-medium">{level.name}</TableCell>
                                                        <TableCell><Badge variant="outline">{level.divisions?.name || 'N/A'}</Badge></TableCell>
                                                        <TableCell><Badge variant="secondary">{associations.find(a => a.id === level.divisions?.association_id)?.name || 'N/A'}</Badge></TableCell>
                                                        <TableCell>{level.sort_order}</TableCell>
                                                        <TableCell>
                                                            {level.pattern_media ? (
                                                                <a href={level.pattern_media} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                                                                    <FileIcon className="h-4 w-4" />
                                                                    <span>View</span>
                                                                </a>
                                                            ) : 'None'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {level.pattern_media && <Button asChild variant="ghost" size="icon"><a href={level.pattern_media} download><Download className="h-4 w-4" /></a></Button>}
                                                            <Button variant="ghost" size="icon" onClick={() => openLevelForm(level)}><Edit className="h-4 w-4" /></Button>
                                                            <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will delete the level "{level.name}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteLevel(level)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                {levels.length === 0 && !isLoading && <div className="text-center py-10 text-muted-foreground">No levels found.</div>}
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

            <Dialog open={isLevelFormOpen} onOpenChange={setIsLevelFormOpen}>
                <DialogContent><DialogHeader><DialogTitle>{editingLevel?.id ? 'Edit' : 'Create'} Level</DialogTitle></DialogHeader><DivisionLevelForm level={editingLevel} onSave={handleSaveLevel} onCancel={() => setIsLevelFormOpen(false)} isSaving={isSaving} divisions={divisions} associations={associations} availableMedia={availableMedia} /></DialogContent>
            </Dialog>
        </>
    );
};

export default AdminDivisionLevelManagementPage;