import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Loader2, Eye, Trash2, PlusCircle, Pen, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Navigation from '@/components/Navigation';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const ScoresheetUploadPage = () => {
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [scoresheets, setScoresheets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedScoresheet, setSelectedScoresheet] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [scoresheetToDelete, setScoresheetToDelete] = useState(null);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [editingScoresheetId, setEditingScoresheetId] = useState(null);

    // Filter states
    const [filterAssociation, setFilterAssociation] = useState('all');
    const [filterDiscipline, setFilterDiscipline] = useState('all');

    const [patterns, setPatterns] = useState([]);
    const [associations, setAssociations] = useState([]);
    const [disciplines, setDisciplines] = useState([]);
    const [image, setImage] = useState(null);

    const [selectionMode, setSelectionMode] = useState('pattern'); // 'pattern' or 'manual'
    const [formData, setFormData] = useState({
        pattern_id: '',
        association_abbrev: '',
        discipline: '',
        city_state: '',
    });

    useEffect(() => {
        fetchScoresheets();
        fetchPatterns();
        fetchAssociations();
        fetchDisciplines();
    }, []);

    const fetchPatterns = async () => {
        // Fetch all patterns
        const { data: allPatterns, error: patternsError } = await supabase
            .from('tbl_patterns')
            .select('id, pdf_file_name, association_name, discipline, division, division_level, pattern_version')
            .order('pdf_file_name');

        if (patternsError) {
            toast({ title: 'Error fetching patterns', description: patternsError.message, variant: 'destructive' });
            return;
        }

        // Fetch pattern IDs that already have scoresheets
        const { data: usedPatterns, error: usedError } = await supabase
            .from('tbl_scoresheet')
            .select('pattern_id')
            .not('pattern_id', 'is', null);

        if (usedError) {
            console.error('Error fetching used patterns:', usedError);
            setPatterns(allPatterns || []);
            return;
        }

        // Filter out patterns that already have scoresheets
        const usedPatternIds = new Set(usedPatterns?.map(s => s.pattern_id) || []);
        const availablePatterns = (allPatterns || []).filter(p => !usedPatternIds.has(p.id));
        setPatterns(availablePatterns);
    };

    const fetchAssociations = async () => {
        const { data, error } = await supabase
            .from('associations')
            .select('id, name, abbreviation')
            .order('name');

        if (error) {
            console.error('Error fetching associations:', error);
        } else {
            setAssociations(data || []);
        }
    };

    const fetchDisciplines = async () => {
        // Fetch disciplines with direct association_id and city
        const { data: discData, error: discError } = await supabase
            .from('disciplines')
            .select('id, name, association_id, city')
            .order('name');

        if (discError) {
            console.error('Error fetching disciplines:', discError);
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
        const mappedDisciplines = (discData || []).map(d => {
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
    };

    // Check if selected association is 4-H
    const is4HAssociation = useMemo(() => {
        if (!formData.association_abbrev) return false;
        const selectedAssociation = associations.find(a => 
            (a.abbreviation && a.abbreviation === formData.association_abbrev) || 
            a.name === formData.association_abbrev ||
            a.id === formData.association_abbrev
        );
        return selectedAssociation && (
            selectedAssociation.abbreviation === '4-H' || 
            selectedAssociation.name?.includes('4-H') ||
            selectedAssociation.id === '4-H'
        );
    }, [formData.association_abbrev, associations]);

    // Get unique cities for 4-H disciplines
    const availableCities = useMemo(() => {
        if (!is4HAssociation) return [];
        const selectedAssociation = associations.find(a => 
            (a.abbreviation && a.abbreviation === formData.association_abbrev) || 
            a.name === formData.association_abbrev ||
            a.id === formData.association_abbrev
        );
        if (!selectedAssociation) return [];
        
        const fourHDisciplines = disciplines.filter(d => 
            d.association_ids && d.association_ids.includes(selectedAssociation.id) && d.city
        );
        const cities = new Set();
        fourHDisciplines.forEach(d => {
            if (d.city) cities.add(d.city);
        });
        return Array.from(cities).sort();
    }, [disciplines, is4HAssociation, formData.association_abbrev, associations]);

    // Deduplicate and filter disciplines by name and selected association (when in manual mode)
    const sortedDisciplineTypes = useMemo(() => {
        // Filter disciplines based on selected association when in manual mode
        let filtered = disciplines;
        if (selectionMode === 'manual' && formData.association_abbrev) {
            // Find the selected association's ID by matching abbreviation or name
            const selectedAssociation = associations.find(a => 
                (a.abbreviation && a.abbreviation === formData.association_abbrev) || 
                a.name === formData.association_abbrev
            );
            if (selectedAssociation) {
                filtered = disciplines.filter(d => 
                    d.association_ids && d.association_ids.includes(selectedAssociation.id)
                );
                
                // If 4-H and city is selected, filter by city
                if (is4HAssociation && formData.city_state) {
                    filtered = filtered.filter(d => d.city === formData.city_state);
                }
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
    }, [disciplines, formData.association_abbrev, formData.city_state, selectionMode, associations, is4HAssociation]);

    // Get unique associations from existing scoresheets for filter (normalized to abbreviations)
    const uniqueAssociationsInScoresheets = useMemo(() => {
        const abbrevSet = new Set();
        scoresheets.forEach(s => {
            let assocValue = s.association_abbrev || s.pattern?.association_name;
            if (assocValue) {
                // Normalize: if it contains " - ", extract the abbreviation part
                if (assocValue.includes(' - ')) {
                    assocValue = assocValue.split(' - ')[0].trim();
                }
                // Try to find matching association to get canonical abbreviation
                const matchedAssoc = associations.find(a => 
                    a.abbreviation === assocValue || a.name === assocValue
                );
                abbrevSet.add(matchedAssoc?.abbreviation || assocValue);
            }
        });
        return Array.from(abbrevSet).sort();
    }, [scoresheets, associations]);

    // Get unique disciplines from existing scoresheets for filter
    const uniqueDisciplinesInScoresheets = useMemo(() => {
        const discs = new Set();
        scoresheets.forEach(s => {
            const disc = s.discipline || s.pattern?.discipline;
            if (disc) discs.add(disc);
        });
        return Array.from(discs).sort();
    }, [scoresheets]);

    // Filtered scoresheets based on selected filters
    const filteredScoresheets = useMemo(() => {
        return scoresheets.filter(s => {
            let assocValue = s.association_abbrev || s.pattern?.association_name;
            // Normalize the assoc value to abbreviation for consistent filtering
            if (assocValue && assocValue.includes(' - ')) {
                assocValue = assocValue.split(' - ')[0].trim();
            }
            const matchedAssoc = associations.find(a => 
                a.abbreviation === assocValue || a.name === assocValue
            );
            const normalizedAbbrev = matchedAssoc?.abbreviation || assocValue;
            
            const disc = s.discipline || s.pattern?.discipline;
            const matchAssoc = filterAssociation === 'all' || normalizedAbbrev === filterAssociation;
            const matchDisc = filterDiscipline === 'all' || disc === filterDiscipline;
            return matchAssoc && matchDisc;
        });
    }, [scoresheets, filterAssociation, filterDiscipline, associations]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterAssociation, filterDiscipline]);

    const fetchScoresheets = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('tbl_scoresheet')
            .select(`*, pattern:tbl_patterns(id, pdf_file_name, association_name, discipline)`)
            .order('created_at', { ascending: false });

        if (error) {
            toast({ title: 'Error fetching scoresheets', description: error.message, variant: 'destructive' });
        } else {
            setScoresheets(data || []);
        }
        setIsLoading(false);
    };

    const resetForm = () => {
        setFormData({
            pattern_id: '',
            association_abbrev: '',
            discipline: '',
            city_state: '',
        });
        setImage(null);
        setEditingScoresheetId(null);
        setSelectionMode('pattern');
        setIsFormOpen(false);
        setIsSubmitting(false);
    };



    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setImage(Object.assign(file, {
                preview: URL.createObjectURL(file),
                id: uuidv4()
            }));
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        maxFiles: 1
    });

    const removeImage = () => {
        if (image && image.preview && image.preview.startsWith('blob:')) {
            URL.revokeObjectURL(image.preview);
        }
        setImage(null);
    };

    const handleSubmit = async () => {
        // Validate based on selection mode
        if (selectionMode === 'pattern') {
            if (!formData.pattern_id) {
                toast({ title: "Missing required fields", description: "Please select a Pattern.", variant: "destructive" });
                return;
            }
        } else {
            if (!formData.association_abbrev || !formData.discipline) {
                toast({ title: "Missing required fields", description: "Please select both Association and Discipline.", variant: "destructive" });
                return;
            }
            // Check if 4-H association requires city
            const selectedAssociation = associations.find(a => 
                (a.abbreviation && a.abbreviation === formData.association_abbrev) || 
                a.name === formData.association_abbrev ||
                a.id === formData.association_abbrev
            );
            const is4H = selectedAssociation && (
                selectedAssociation.abbreviation === '4-H' || 
                selectedAssociation.name?.includes('4-H') ||
                selectedAssociation.id === '4-H'
            );
            if (is4H && !formData.city_state) {
                toast({ title: "Missing required fields", description: "Please select a City for 4-H association.", variant: "destructive" });
                return;
            }
        }

        if (!image && !editingScoresheetId) {
            toast({ title: "Missing image", description: "Please upload a scoresheet image.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);

        try {
            let imageUrl = null;
            let storagePath = null;

            // Upload new image if provided
            if (image && image.size) {
                const filePath = `scoresheets/${uuidv4()}-${image.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('pattern_uploads')
                    .upload(filePath, image);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('pattern_uploads')
                    .getPublicUrl(filePath);

                imageUrl = publicUrl;
                storagePath = filePath;
            }

            const scoresheetPayload = {
                pattern_id: selectionMode === 'pattern' ? parseInt(formData.pattern_id) : null,
                association_abbrev: formData.association_abbrev || null,
                discipline: formData.discipline || null,
                city_state: formData.city_state || null,
            };

            // Add image fields if new image was uploaded
            if (imageUrl) {
                scoresheetPayload.image_url = imageUrl;
                scoresheetPayload.storage_path = storagePath;
            }

            let scoresheetResponse;
            if (editingScoresheetId) {
                // If editing and there's an old image and a new image, delete the old one
                if (imageUrl) {
                    const oldScoresheet = scoresheets.find(s => s.id === editingScoresheetId);
                    if (oldScoresheet && oldScoresheet.storage_path) {
                        await supabase.storage
                            .from('pattern_uploads')
                            .remove([oldScoresheet.storage_path]);
                    }
                }

                scoresheetResponse = await supabase
                    .from('tbl_scoresheet')
                    .update(scoresheetPayload)
                    .eq('id', editingScoresheetId)
                    .select()
                    .single();
            } else {
                scoresheetResponse = await supabase
                    .from('tbl_scoresheet')
                    .insert([scoresheetPayload])
                    .select()
                    .single();
            }

            const { data: scoresheetData, error: scoresheetError } = scoresheetResponse;
            if (scoresheetError) throw scoresheetError;

            toast({
                title: "Success!",
                description: `Scoresheet ${editingScoresheetId ? 'updated' : 'created'} successfully.`
            });
            resetForm();
            fetchScoresheets();

        } catch (error) {
            toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditForm = (scoresheet) => {
        setEditingScoresheetId(scoresheet.id);
        // Determine selection mode based on existing data
        if (scoresheet.pattern_id) {
            setSelectionMode('pattern');
        } else {
            setSelectionMode('manual');
        }
        setFormData({
            pattern_id: scoresheet.pattern_id?.toString() || '',
            association_abbrev: scoresheet.association_abbrev || '',
            discipline: scoresheet.discipline || '',
            city_state: scoresheet.city_state || '',
        });
        if (scoresheet.image_url) {
            setImage({
                id: scoresheet.id,
                preview: scoresheet.image_url,
                name: scoresheet.storage_path?.split('/').pop() || 'existing-image'
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = async () => {
        if (!scoresheetToDelete) return;

        // Delete image from storage if it exists
        if (scoresheetToDelete.storage_path) {
            await supabase.storage
                .from('pattern_uploads')
                .remove([scoresheetToDelete.storage_path]);
        }

        const { error } = await supabase
            .from('tbl_scoresheet')
            .delete()
            .eq('id', scoresheetToDelete.id);

        if (error) {
            toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Scoresheet deleted successfully.' });
            fetchScoresheets();
        }
        setIsDeleteDialogOpen(false);
        setScoresheetToDelete(null);
    };

    return (
        <>
            <Helmet>
                <title>Admin - Scoresheet Upload</title>
            </Helmet>
            <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
                <Navigation />
                <main className="flex-grow p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center justify-between mb-4">
                            <AdminBackButton />
                            <div className="text-center flex-1">
                                <h1 className="text-2xl md:text-3xl font-bold">Scoresheet Upload</h1>
                                <p className="text-sm text-muted-foreground">Upload scoresheet images and associate them with patterns.</p>
                            </div>
                            <Button onClick={() => { resetForm(); setIsFormOpen(true); }}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add New Scoresheet
                            </Button>
                        </div>

                        <Card>
                            <CardHeader><CardTitle>Existing Scoresheets ({filteredScoresheets.length})</CardTitle></CardHeader>
                            <CardContent>
                                {/* Filters */}
                                <div className="flex flex-wrap gap-4 mb-4 items-end">
                                    <div className="w-48">
                                        <Label className="text-sm mb-1 block">Association</Label>
                                        <Select value={filterAssociation} onValueChange={setFilterAssociation}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="All Associations" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Associations</SelectItem>
                                                {uniqueAssociationsInScoresheets.map(abbrev => {
                                                    const assoc = associations.find(a => a.abbreviation === abbrev);
                                                    return (
                                                        <SelectItem key={abbrev} value={abbrev}>
                                                            {assoc?.name || abbrev}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-48">
                                        <Label className="text-sm mb-1 block">Discipline</Label>
                                        <Select value={filterDiscipline} onValueChange={setFilterDiscipline}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="All Disciplines" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Disciplines</SelectItem>
                                                {uniqueDisciplinesInScoresheets.map(disc => (
                                                    <SelectItem key={disc} value={disc}>{disc}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {(filterAssociation !== 'all' || filterDiscipline !== 'all') && (
                                        <Button variant="ghost" size="sm" onClick={() => { setFilterAssociation('all'); setFilterDiscipline('all'); }}>
                                            <X className="h-4 w-4 mr-1" /> Clear
                                        </Button>
                                    )}
                                </div>

                                {isLoading ? (
                                    <div className="flex justify-center items-center h-64">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : (
                                    <>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Association</TableHead>
                                                    <TableHead>Discipline</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredScoresheets
                                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                                    .map(s => (
                                                    <TableRow key={s.id}>
                                                        <TableCell>
                                                            {(() => {
                                                                const abbrev = s.association_abbrev || s.pattern?.association_name;
                                                                if (!abbrev) return 'N/A';
                                                                const assoc = associations.find(a => a.abbreviation === abbrev);
                                                                return assoc?.name || abbrev;
                                                            })()}
                                                        </TableCell>
                                                        <TableCell>{s.discipline || s.pattern?.discipline || 'N/A'}</TableCell>
                                                        <TableCell className="space-x-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => { setSelectedScoresheet(s); setIsDetailModalOpen(true); }}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openEditForm(s)}
                                                            >
                                                                <Pen className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => { setScoresheetToDelete(s); setIsDeleteDialogOpen(true); }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        
                                        {/* Pagination Controls */}
                                        {filteredScoresheets.length > itemsPerPage && (
                                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                                <p className="text-sm text-muted-foreground">
                                                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredScoresheets.length)} of {filteredScoresheets.length} entries
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
                                                        Page {currentPage} of {Math.ceil(filteredScoresheets.length / itemsPerPage)}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredScoresheets.length / itemsPerPage), p + 1))}
                                                        disabled={currentPage >= Math.ceil(filteredScoresheets.length / itemsPerPage)}
                                                    >
                                                        Next
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                {!isLoading && filteredScoresheets.length === 0 && (
                                    <p className="text-center py-8 text-muted-foreground">No scoresheets found.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>

            <Dialog open={isFormOpen} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent className="max-w-2xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>{editingScoresheetId ? 'Edit' : 'Add New'} Scoresheet</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-4 overflow-y-auto pr-2">
                        {/* Selection Mode Toggle */}
                        <div className="space-y-3">
                            <Label>Select Data Source *</Label>
                            <RadioGroup
                                value={selectionMode}
                                onValueChange={(value) => {
                                    setSelectionMode(value);
                                    // Clear opposite fields when switching
                                    if (value === 'pattern') {
                                        setFormData(prev => ({ ...prev, association_abbrev: '', discipline: '', city_state: '' }));
                                    } else {
                                        setFormData(prev => ({ ...prev, pattern_id: '' }));
                                    }
                                }}
                                className="flex gap-6"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="pattern" id="mode-pattern" />
                                    <Label htmlFor="mode-pattern" className="cursor-pointer font-normal">
                                        Select Pattern
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="manual" id="mode-manual" />
                                    <Label htmlFor="mode-manual" className="cursor-pointer font-normal">
                                        Select Association & Discipline
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* Pattern Selection (shown when mode is 'pattern') */}
                        {selectionMode === 'pattern' && (
                            <div>
                                <Label htmlFor="pattern_id">Pattern *</Label>
                                <Select
                                    name="pattern_id"
                                    onValueChange={value => {
                                        const selectedPattern = patterns.find(p => p.id.toString() === value);
                                        // Look up the abbreviation from associations table using the pattern's association_name
                                        const matchedAssoc = associations.find(a => 
                                            a.name === selectedPattern?.association_name || 
                                            a.abbreviation === selectedPattern?.association_name
                                        );
                                        setFormData(prev => ({
                                            ...prev,
                                            pattern_id: value,
                                            association_abbrev: matchedAssoc?.abbreviation || '',
                                            discipline: selectedPattern?.discipline || '',
                                        }));
                                    }}
                                    value={formData.pattern_id}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Pattern" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {patterns.map(p => (
                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                {p.pdf_file_name} - {p.association_name} ({p.discipline}) - {p.pattern_version}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Association & Discipline Selection (shown when mode is 'manual') */}
                        {selectionMode === 'manual' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="association_abbrev">Association *</Label>
                                        <Select
                                            value={formData.association_abbrev}
                                            onValueChange={value => {
                                                setFormData(p => ({ ...p, association_abbrev: value, discipline: '', city_state: '' }));
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Association" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {associations.filter(a => a.abbreviation).map(a => (
                                                    <SelectItem key={a.id} value={a.abbreviation}>
                                                        {a.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {is4HAssociation && (
                                        <div>
                                            <Label htmlFor="city_state">City *</Label>
                                            <Select
                                                value={formData.city_state}
                                                onValueChange={value => {
                                                    setFormData(p => ({ ...p, city_state: value, discipline: '' }));
                                                }}
                                                disabled={!formData.association_abbrev}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select City" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableCities.map(city => (
                                                        <SelectItem key={city} value={city}>
                                                            {city}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {!is4HAssociation && (
                                        <div>
                                            <Label htmlFor="discipline">Discipline *</Label>
                                            <Select
                                                value={formData.discipline}
                                                onValueChange={value => {
                                                    setFormData(p => ({ ...p, discipline: value }));
                                                }}
                                                disabled={!formData.association_abbrev}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={formData.association_abbrev ? "Select Discipline" : "Select Association first"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {sortedDisciplineTypes.map(d => (
                                                        <SelectItem key={d.id} value={d.name}>
                                                            {d.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                                {is4HAssociation && (
                                    <div>
                                        <Label htmlFor="discipline">Discipline *</Label>
                                        <Select
                                            value={formData.discipline}
                                            onValueChange={value => {
                                                setFormData(p => ({ ...p, discipline: value }));
                                            }}
                                            disabled={!formData.association_abbrev || !formData.city_state}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={formData.city_state ? "Select Discipline" : "Select City first"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sortedDisciplineTypes.map(d => (
                                                    <SelectItem key={d.id} value={d.name}>
                                                        {d.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </>
                        )}

                        <Card>
                            <CardHeader><CardTitle>Scoresheet Image</CardTitle></CardHeader>
                            <CardContent>
                                {!image ? (
                                    <div
                                        {...getRootProps()}
                                        className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                                            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                        }`}
                                    >
                                        <input {...getInputProps()} />
                                        <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">
                                            {isDragActive ? 'Drop the image here' : 'Drag & drop an image here, or click to select'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="relative group">
                                        <img
                                            src={image.preview}
                                            alt="Scoresheet preview"
                                            className="w-full max-h-96 object-contain rounded-md border"
                                        />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={removeImage}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingScoresheetId ? 'Save Changes' : 'Create Scoresheet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="max-w-3xl">
                    {selectedScoresheet && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    Scoresheet - {selectedScoresheet.pattern?.pdf_file_name}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[70vh] overflow-y-auto p-1 space-y-4">
                                <div>
                                    <h3 className="font-semibold mb-2">Pattern Details</h3>
                                    <div className="text-sm space-y-1">
                                        <p><span className="font-medium">Association:</span> {selectedScoresheet.association_abbrev || selectedScoresheet.pattern?.association_name || 'N/A'}</p>
                                        <p><span className="font-medium">Discipline:</span> {selectedScoresheet.discipline || selectedScoresheet.pattern?.discipline || 'N/A'}</p>
                                    </div>
                                </div>
                                {selectedScoresheet.image_url && (
                                    <div>
                                        <h3 className="font-semibold mb-2">Scoresheet Image</h3>
                                        <img
                                            src={selectedScoresheet.image_url}
                                            alt="Scoresheet"
                                            className="w-full h-auto rounded-md border"
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={handleDelete}
                title="Are you sure?"
                description="This will permanently delete the scoresheet and its image. This action cannot be undone."
            />
        </>
    );
};

export default ScoresheetUploadPage;
