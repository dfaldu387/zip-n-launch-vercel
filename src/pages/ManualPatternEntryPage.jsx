import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, X, Loader2, Eye, Trash2, PlusCircle, Pen, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import Navigation from '@/components/Navigation';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { useMemo } from 'react';

const ManualPatternEntryPage = () => {
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [patterns, setPatterns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPattern, setSelectedPattern] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [patternToDelete, setPatternToDelete] = useState(null);
    const [editingPatternId, setEditingPatternId] = useState(null);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // Filter state
    const [filterAssociation, setFilterAssociation] = useState('');
    const [filterDiscipline, setFilterDiscipline] = useState('');

    const [associations, setAssociations] = useState([]);
    const [disciplines, setDisciplines] = useState([]);

    const [formData, setFormData] = useState({
        association_name: '',
        discipline: '',
        division: '',
        division_level: '',
        pattern_version: '',
        maneuvers_range: '',
        pattern_date: null,
        pdf_file_name: '',
        page_no: '',
    });

    const maneuversRangeOptions = [
        { value: '1-9', label: '1-9' },
        { value: '1-15', label: '1-15' },
        { value: '1-20', label: '1-20' },
    ];

    const patternVersionOptions = [
        { value: 'ALL', label: 'ALL', color: 'bg-blue-100 text-blue-700' },
        { value: 'GR/NOV', label: 'GR/NOV', color: 'bg-green-100 text-green-700' },
        { value: 'L1', label: 'L1', color: 'bg-purple-100 text-purple-700' },
        { value: 'Championship', label: 'Championship', color: 'bg-yellow-100 text-yellow-700' },
        { value: 'Skilled', label: 'Skilled', color: 'bg-indigo-100 text-indigo-700' },
        { value: 'Intermediate', label: 'Intermediate', color: 'bg-blue-100 text-blue-700' },
        { value: 'Beginner', label: 'Beginner', color: 'bg-orange-100 text-orange-700' },
        { value: 'Walk-Trot', label: 'Walk-Trot', color: 'bg-pink-100 text-pink-700' },
    ];
    const [maneuvers, setManeuvers] = useState([{ step_no: 1, instruction: '' }]);
    const [images, setImages] = useState([]);

    const fetchDropdownData = useCallback(async () => {
        const { data: assocData, error: assocError } = await supabase.from('associations').select('id, name, abbreviation').order('name');
        if (assocError) toast({ title: 'Error fetching associations', description: assocError.message, variant: 'destructive' });
        else setAssociations(assocData);

        // Fetch disciplines with direct association_id
        const { data: discData, error: discError } = await supabase.from('disciplines').select('id, name, association_id').order('name');
        if (discError) {
            toast({ title: 'Error fetching disciplines', description: discError.message, variant: 'destructive' });
            return;
        }

        // Fetch discipline_associations separately
        const { data: discAssocData, error: discAssocError } = await supabase
            .from('discipline_associations')
            .select('discipline_id, association_id');
        
        if (discAssocError) {
            // If discipline_associations table doesn't exist or has issues, just use direct association_id
            console.warn('Could not fetch discipline_associations:', discAssocError.message);
        }

        // Map disciplines to include all association IDs
        const mappedDisciplines = discData.map(d => {
            const associationIds = [];
            // Add direct association_id if exists
            if (d.association_id) {
                associationIds.push(d.association_id);
            }
            // Add association_ids from junction table if available
            if (discAssocData) {
                discAssocData
                    .filter(da => da.discipline_id === d.id)
                    .forEach(da => {
                        if (da.association_id && !associationIds.includes(da.association_id)) {
                            associationIds.push(da.association_id);
                        }
                    });
            }
            return {
                ...d,
                association_ids: associationIds
            };
        });
        setDisciplines(mappedDisciplines);
    }, [toast]);

    const sortedDisciplineTypes = useMemo(() => {
        // Filter disciplines based on selected association
        let filtered = disciplines;
        if (formData.association_name) {
            // Find the selected association's ID (association_name now stores abbreviation)
            const selectedAssociation = associations.find(a => a.abbreviation === formData.association_name || a.name === formData.association_name);
            if (selectedAssociation) {
                filtered = disciplines.filter(d => 
                    d.association_ids && d.association_ids.includes(selectedAssociation.id)
                );
            } else {
                filtered = [];
            }
        }
        
        // Remove duplicates by name
        const unique = [];
        const seen = new Set();
        for (const item of filtered) {
            if (!seen.has(item.name)) {
                seen.add(item.name);
                unique.push(item);
            }
        }
        return unique.sort((a, b) => a.name.localeCompare(b.name));
    }, [disciplines, formData.association_name, associations]);

    // Filtered patterns for table display
    const filteredPatterns = useMemo(() => {
        return patterns.filter(p => {
            const matchesAssociation = !filterAssociation || p.association_name === filterAssociation;
            const matchesDiscipline = !filterDiscipline || p.discipline === filterDiscipline;
            return matchesAssociation && matchesDiscipline;
        });
    }, [patterns, filterAssociation, filterDiscipline]);

    // Get unique disciplines from patterns for the filter dropdown
    const uniqueDisciplinesInPatterns = useMemo(() => {
        let filtered = patterns;
        if (filterAssociation) {
            filtered = patterns.filter(p => p.association_name === filterAssociation);
        }
        const unique = [...new Set(filtered.map(p => p.discipline).filter(Boolean))];
        return unique.sort((a, b) => a.localeCompare(b));
    }, [patterns, filterAssociation]);

    // Get unique associations from patterns for the filter dropdown (with full names)
    const uniqueAssociationsInPatterns = useMemo(() => {
        const uniqueAbbrevs = [...new Set(patterns.map(p => p.association_name).filter(Boolean))];
        // Map to objects with abbreviation and full name for display
        return uniqueAbbrevs
            .map(abbrev => {
                const assoc = associations.find(a => a.abbreviation === abbrev || a.name === abbrev);
                return {
                    value: abbrev,
                    displayName: assoc?.name || abbrev
                };
            })
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [patterns, associations]);

    useEffect(() => {
        fetchPatterns();
        fetchDropdownData();
    }, [fetchDropdownData]);

    const fetchPatterns = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('tbl_patterns')
            .select(`*, maneuvers:tbl_maneuvers(id, step_no, instruction), media:tbl_pattern_media(id, image_url, storage_path)`)
            .order('created_at', { ascending: false });

        if (error) {
            toast({ title: 'Error fetching patterns', description: error.message, variant: 'destructive' });
        } else {
            setPatterns(data);
        }
        setIsLoading(false);
    };

    const resetForm = () => {
        setFormData({
            association_name: '', discipline: '', division: '', division_level: '',
            pattern_version: '', maneuvers_range: '', pattern_date: null, pdf_file_name: '', page_no: '',
        });
        setManeuvers([{ step_no: 1, instruction: '' }]);
        setImages([]);
        setEditingPatternId(null);
        setIsFormOpen(false);
        setIsSubmitting(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateSelect = (date) => {
        if (date) {
            setFormData(p => ({ ...p, pattern_date: format(date, 'yyyy-MM-dd') }));
        } else {
            setFormData(p => ({...p, pattern_date: null}));
        }
    };

    const handleManeuverChange = (index, field, value) => {
        const newManeuvers = [...maneuvers];
        newManeuvers[index][field] = value;
        setManeuvers(newManeuvers);
    };

    const addManeuver = () => {
        setManeuvers([...maneuvers, { step_no: maneuvers.length + 1, instruction: '' }]);
    };

    const removeManeuver = (index) => {
        setManeuvers(maneuvers.filter((_, i) => i !== index));
    };

    const onDrop = useCallback((acceptedFiles) => {
        const newImages = acceptedFiles.map(file => Object.assign(file, {
            preview: URL.createObjectURL(file),
            id: uuidv4()
        }));
        setImages(prev => [...prev, ...newImages]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });
    
    const removeImage = (id) => {
        setImages(images.filter(img => img.id !== id));
    };

    const handleSubmit = async () => {
        if (!formData.association_name || !formData.discipline || !formData.division) {
            toast({ title: "Missing required fields", description: "Association, Discipline, and Division are required.", variant: "destructive" });
            return;
        }
        if (formData.page_no && parseInt(formData.page_no, 10) <= 0) {
            toast({ title: "Invalid Page Number", description: "Page number must be greater than 0.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        
        try {
            const patternPayload = {
                ...formData,
                page_no: formData.page_no ? parseInt(formData.page_no, 10) : null,
            };

            let patternResponse;
            if (editingPatternId) {
                patternResponse = await supabase
                    .from('tbl_patterns')
                    .update(patternPayload)
                    .eq('id', editingPatternId)
                    .select('id')
                    .single();
            } else {
                patternResponse = await supabase
                    .from('tbl_patterns')
                    .insert([patternPayload])
                    .select('id')
                    .single();
            }

            const { data: patternData, error: patternError } = patternResponse;
            if (patternError) throw patternError;
            const patternId = patternData.id;

            if (editingPatternId) {
                await supabase.from('tbl_maneuvers').delete().eq('pattern_id', editingPatternId);
                const oldMedia = images.filter(img => !img.size);
                const oldMediaIds = oldMedia.map(m => m.id);
                const mediaToDelete = (patterns.find(p => p.id === editingPatternId)?.media || []).filter(m => !oldMediaIds.includes(m.id));

                for (const media of mediaToDelete) {
                    await supabase.from('tbl_pattern_media').delete().eq('id', media.id);
                    await supabase.storage.from('pattern_uploads').remove([media.storage_path]);
                }
            }
            
            const maneuverInserts = maneuvers.filter(m => m.instruction.trim() !== '').map(({ id, ...rest }) => ({ ...rest, pattern_id: patternId, step_no: parseInt(rest.step_no) }));
            if (maneuverInserts.length > 0) {
                const { error: maneuverError } = await supabase.from('tbl_maneuvers').insert(maneuverInserts);
                if (maneuverError) throw maneuverError;
            }

            const newImages = images.filter(img => img.size);
            for (const image of newImages) {
                const filePath = `public/${uuidv4()}-${image.name}`;
                const { error: uploadError } = await supabase.storage.from('pattern_uploads').upload(filePath, image);
                if (uploadError) throw uploadError;
                
                const { data: { publicUrl } } = supabase.storage.from('pattern_uploads').getPublicUrl(filePath);

                await supabase.from('tbl_pattern_media').insert([{
                    pattern_id: patternId,
                    image_url: publicUrl,
                    storage_path: filePath,
                    page_no: formData.page_no ? parseInt(formData.page_no) : null,
                }]);
            }
            
            toast({ title: "Success!", description: `Pattern ${editingPatternId ? 'updated' : 'created'} successfully.` });
            resetForm();
            fetchPatterns();

        } catch (error) {
            toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const openEditForm = (pattern) => {
        setEditingPatternId(pattern.id);
        setFormData({
            association_name: pattern.association_name,
            discipline: pattern.discipline,
            division: pattern.division,
            division_level: pattern.division_level || '',
            pattern_version: pattern.pattern_version || '',
            maneuvers_range: pattern.maneuvers_range || '',
            pattern_date: pattern.pattern_date,
            pdf_file_name: pattern.pdf_file_name || '',
            page_no: pattern.page_no || '',
        });
        setManeuvers(pattern.maneuvers.length > 0 ? pattern.maneuvers.sort((a,b) => a.step_no - b.step_no) : [{ step_no: 1, instruction: '' }]);
        setImages(pattern.media.map(m => ({ id: m.id, preview: m.image_url, name: m.storage_path.split('/').pop() })));
        setIsFormOpen(true);
    };

    const handleDelete = async () => {
        if (!patternToDelete) return;
        
        const { media } = patternToDelete;
        if(media && media.length > 0) {
            const filePaths = media.map(m => m.storage_path);
            await supabase.storage.from('pattern_uploads').remove(filePaths);
        }

        const { error } = await supabase.from('tbl_patterns').delete().eq('id', patternToDelete.id);

        if (error) {
            toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Pattern deleted successfully.' });
            fetchPatterns();
        }
        setIsDeleteDialogOpen(false);
        setPatternToDelete(null);
    };

    return (
        <>
            <Helmet>
                <title>Admin - Manual Pattern Entry</title>
            </Helmet>
            <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
                <Navigation />
                <main className="flex-grow p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center justify-between mb-4">
                            <AdminBackButton />
                            <div className="text-center flex-1">
                                <h1 className="text-2xl md:text-3xl font-bold">Manual Pattern Entry</h1>
                                <p className="text-sm text-muted-foreground">Manually input pattern data.</p>
                            </div>
                            <Button onClick={() => { resetForm(); setIsFormOpen(true); }}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add New Pattern
                            </Button>
                        </div>

                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <CardTitle>Existing Patterns ({filteredPatterns.length})</CardTitle>
                                    <div className="flex flex-wrap gap-2">
                                        <Select 
                                            value={filterAssociation} 
                                            onValueChange={(val) => {
                                                setFilterAssociation(val === 'all' ? '' : val);
                                                setFilterDiscipline('');
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="All Associations">
                                                    {filterAssociation 
                                                        ? (uniqueAssociationsInPatterns.find(a => a.value === filterAssociation)?.displayName || filterAssociation)
                                                        : "All Associations"}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Associations</SelectItem>
                                                {uniqueAssociationsInPatterns.map(a => (
                                                    <SelectItem key={a.value} value={a.value}>{a.displayName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select 
                                            value={filterDiscipline} 
                                            onValueChange={(val) => {
                                                setFilterDiscipline(val === 'all' ? '' : val);
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="All Disciplines" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Disciplines</SelectItem>
                                                {uniqueDisciplinesInPatterns.map(d => (
                                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {(filterAssociation || filterDiscipline) && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={() => {
                                                    setFilterAssociation('');
                                                    setFilterDiscipline('');
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                <X className="h-4 w-4 mr-1" /> Clear
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : (
                                    <>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Association</TableHead>
                                                    <TableHead>Discipline</TableHead>
                                                    <TableHead>PDF Name</TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredPatterns
                                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                                    .map(p => {
                                                        // Look up full name from abbreviation
                                                        const assoc = associations.find(a => a.abbreviation === p.association_name || a.name === p.association_name);
                                                        const displayName = assoc?.name || p.association_name;
                                                        return (
                                                    <TableRow key={p.id}>
                                                        <TableCell>{displayName}</TableCell>
                                                        <TableCell>{p.discipline}</TableCell>
                                                        <TableCell>{p.pdf_file_name || 'N/A'}</TableCell>
                                                        <TableCell>{p.pattern_date ? format(parseISO(p.pattern_date), 'PPP') : 'N/A'}</TableCell>
                                                        <TableCell className="space-x-2">
                                                            <Button variant="outline" size="sm" onClick={() => { setSelectedPattern(p); setIsDetailModalOpen(true); }}><Eye className="h-4 w-4" /></Button>
                                                            <Button variant="outline" size="sm" onClick={() => openEditForm(p)}><Pen className="h-4 w-4" /></Button>
                                                            <Button variant="destructive" size="sm" onClick={() => { setPatternToDelete(p); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                                                        </TableCell>
                                                    </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                        
                                        {/* Pagination Controls */}
                                        {filteredPatterns.length > itemsPerPage && (
                                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                                <p className="text-sm text-muted-foreground">
                                                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredPatterns.length)} of {filteredPatterns.length} entries
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                    >
                                                        <ChevronLeft className="h-4 w-4" />
                                                        Previous
                                                    </Button>
                                                    <span className="text-sm px-2">
                                                        Page {currentPage} of {Math.ceil(filteredPatterns.length / itemsPerPage)}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPatterns.length / itemsPerPage), p + 1))}
                                                        disabled={currentPage >= Math.ceil(filteredPatterns.length / itemsPerPage)}
                                                    >
                                                        Next
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                {!isLoading && patterns.length === 0 && <p className="text-center py-8">No patterns found.</p>}
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>

            <Dialog open={isFormOpen} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent className="max-w-4xl h-[90vh]">
                    <DialogHeader><DialogTitle>{editingPatternId ? 'Edit' : 'Add New'} Pattern</DialogTitle></DialogHeader>
                    <div className="grid gap-6 py-4 overflow-y-auto pr-6">
                        <Card>
                            <CardHeader><CardTitle>Pattern Info</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Select name="association_name" onValueChange={value => {
                                                    // Store abbreviation but use full name for discipline filtering
                                                    const selectedAssoc = associations.find(a => a.abbreviation === value);
                                                    setFormData(p => ({...p, association_name: value, discipline: ''}));
                                                }} value={formData.association_name}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Association*">
                                                            {formData.association_name && associations.find(a => a.abbreviation === formData.association_name)?.name}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>{associations.map(a => <SelectItem key={a.id} value={a.abbreviation || a.name}>{a.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                <Select name="discipline" onValueChange={value => setFormData(p => ({...p, discipline: value}))} value={formData.discipline} disabled={!formData.association_name}>
                                    <SelectTrigger><SelectValue placeholder={formData.association_name ? "Select Discipline*" : "Select Association first"} /></SelectTrigger>
                                    <SelectContent>{sortedDisciplineTypes.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Input name="division" placeholder="Division*" value={formData.division} onChange={handleInputChange} />
                                <Input name="division_level" placeholder="Division Level (Optional)" value={formData.division_level} onChange={handleInputChange} />
                                <Select name="pattern_version" onValueChange={value => setFormData(p => ({...p, pattern_version: value}))} value={formData.pattern_version}>
                                    <SelectTrigger><SelectValue placeholder="Select Pattern Version" /></SelectTrigger>
                                    <SelectContent>
                                        {patternVersionOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                <span className={cn("px-2 py-0.5 rounded text-xs font-medium", opt.color)}>{opt.label}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select name="maneuvers_range" onValueChange={value => setFormData(p => ({...p, maneuvers_range: value}))} value={formData.maneuvers_range}>
                                    <SelectTrigger><SelectValue placeholder="Select Maneuvers" /></SelectTrigger>
                                    <SelectContent>
                                        {maneuversRangeOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("justify-start text-left font-normal", !formData.pattern_date && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {formData.pattern_date ? format(parseISO(formData.pattern_date), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={formData.pattern_date ? parseISO(formData.pattern_date) : null}
                                            onSelect={handleDateSelect}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <Input name="pdf_file_name" placeholder="PDF File Name" value={formData.pdf_file_name} onChange={handleInputChange} />
                                <Input name="page_no" type="number" placeholder="Page Number" value={formData.page_no} onChange={handleInputChange} min="1" />
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader><CardTitle>Maneuvers</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                {maneuvers.map((m, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input type="number" value={m.step_no} onChange={e => handleManeuverChange(i, 'step_no', e.target.value)} className="w-20" placeholder="Step" min="1"/>
                                        <Input value={m.instruction} onChange={e => handleManeuverChange(i, 'instruction', e.target.value)} placeholder="Instruction" />
                                        <Button variant="ghost" size="icon" onClick={() => removeManeuver(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={addManeuver}><PlusCircle className="mr-2 h-4 w-4" /> Add Maneuver</Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Pattern Images</CardTitle></CardHeader>
                            <CardContent>
                                <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer ${isDragActive ? 'border-primary' : ''}`}>
                                    <input {...getInputProps()} />
                                    <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                                    <p>Drag 'n' drop some files here, or click to select files</p>
                                </div>
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {images.map(img => (
                                        <div key={img.id} className="relative group">
                                            <img src={img.preview} alt={img.name} className="w-full h-24 object-cover rounded-md" onLoad={() => { if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview); }} />
                                            <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeImage(img.id)}><X className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingPatternId ? 'Save Changes' : 'Create Pattern'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="max-w-3xl">
                    {selectedPattern && <>
                        <DialogHeader>
                            <DialogTitle>{selectedPattern.association_name} - {selectedPattern.discipline}</DialogTitle>
                            <DialogDescription>{selectedPattern.division} {selectedPattern.division_level && `- ${selectedPattern.division_level}`}</DialogDescription>
                        </DialogHeader>
                        <div className="max-h-[70vh] overflow-y-auto p-1 space-y-4">
                            <h3 className="font-semibold">Maneuvers</h3>
                            <Table>
                                <TableHeader><TableRow><TableHead>Step</TableHead><TableHead>Instruction</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {selectedPattern.maneuvers.sort((a,b)=>a.step_no - b.step_no).map(m => <TableRow key={m.id}><TableCell>{m.step_no}</TableCell><TableCell>{m.instruction}</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                            <h3 className="font-semibold">Images</h3>
                            <div className="grid grid-cols-3 gap-4">
                                {selectedPattern.media.map(m => <img key={m.id} src={m.image_url} alt="Pattern image" className="w-full h-auto rounded-md" />)}
                            </div>
                        </div>
                    </>}
                </DialogContent>
            </Dialog>

            <ConfirmationDialog 
                isOpen={isDeleteDialogOpen} 
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={handleDelete}
                title="Are you sure?"
                description="This will permanently delete the pattern and all its related maneuvers and images. This action cannot be undone."
            />
        </>
    );
};

export default ManualPatternEntryPage;