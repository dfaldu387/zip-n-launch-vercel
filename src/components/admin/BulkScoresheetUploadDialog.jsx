import React, { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Loader2, X, CheckCircle2, AlertTriangle, RefreshCw, PlusCircle } from 'lucide-react';

// Robert's files are named "Score Sheet <Discipline> CO 4-H.pdf" / "Cheat Sheet <Discipline> CO 4-H.pdf".
// The naming is not perfectly consistent (Sheet/Sheets, "TrailCO", trailing spaces), so strip loosely.
const parseDisciplineFromFileName = (fileName) =>
    fileName
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/^(score|cheat)\s*sheets?\s*/i, '')
        .replace(/\s*CO\s*4-?H\s*$/i, '')
        .replace(/\s*4-?H\s*$/i, '')
        .trim();

const norm = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Storage keys become the file name in the browser's own PDF viewer / Save As dialog,
// so store them readable ("Ranch Riding - Score Sheet.pdf") instead of a UUID.
const safeSegment = (value) => (value || '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const buildStoragePath = ({ association, city, discipline, docType, fileName }) => {
    const extension = (fileName.match(/\.[a-z0-9]+$/i)?.[0] || '.pdf').toLowerCase();
    const label = docType === 'accessory' ? 'Cheat Sheet' : 'Score Sheet';
    const folder = safeSegment([association, city].filter(Boolean).join(' ')) || 'General';
    return `scoresheets/${folder}/${safeSegment(discipline)} - ${label}${extension}`;
};

// File names that don't match the discipline name stored in the database.
const DISCIPLINE_ALIASES = {
    englishcontroledriding: 'English Controlled Riding',
    ranchsorting: 'Ranch Cattle Sorting',
};

const BulkScoresheetUploadDialog = ({ open, onOpenChange, associations, disciplines, onComplete }) => {
    const { toast } = useToast();
    const [files, setFiles] = useState([]);
    const [docType, setDocType] = useState('scoresheet');
    const [associationAbbrev, setAssociationAbbrev] = useState('');
    const [cityState, setCityState] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [results, setResults] = useState(null);

    const selectedAssociation = useMemo(
        () => associations.find(a => a.abbreviation === associationAbbrev),
        [associations, associationAbbrev]
    );

    const is4H = !!selectedAssociation && (
        selectedAssociation.abbreviation === '4-H' || selectedAssociation.name?.includes('4-H')
    );

    const availableCities = useMemo(() => {
        if (!is4H || !selectedAssociation) return [];
        const cities = new Set();
        disciplines
            .filter(d => d.association_ids?.includes(selectedAssociation.id) && d.city)
            .forEach(d => cities.add(d.city));
        return Array.from(cities).sort();
    }, [disciplines, is4H, selectedAssociation]);

    // Disciplines valid for the chosen association (and city, for 4-H), de-duplicated by name.
    const targetDisciplines = useMemo(() => {
        if (!selectedAssociation) return [];
        let list = disciplines.filter(d => d.association_ids?.includes(selectedAssociation.id));
        if (is4H && cityState) list = list.filter(d => d.city === cityState);
        const seen = new Set();
        return list.filter(d => {
            if (seen.has(d.name)) return false;
            seen.add(d.name);
            return true;
        });
    }, [disciplines, selectedAssociation, is4H, cityState]);

    // filename -> discipline in the database
    const matchDiscipline = useCallback((fileName) => {
        const parsed = parseDisciplineFromFileName(fileName);
        const aliased = DISCIPLINE_ALIASES[norm(parsed)];
        const wanted = norm(aliased || parsed);
        const hit = targetDisciplines.find(d => norm(d.name) === wanted);
        return { parsed, matched: hit?.name || null };
    }, [targetDisciplines]);

    const onDrop = useCallback((accepted) => {
        setResults(null);
        setFiles(prev => {
            const names = new Set(prev.map(f => f.name));
            return [...prev, ...accepted.filter(f => !names.has(f.name))];
        });
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'], 'image/*': [] },
    });

    const rows = useMemo(
        () => files.map(file => ({ file, ...matchDiscipline(file.name) })),
        [files, matchDiscipline]
    );

    const matchedRows = rows.filter(r => r.matched);
    const unmatchedRows = rows.filter(r => !r.matched);

    const reset = () => {
        setFiles([]);
        setResults(null);
        setProgress({ done: 0, total: 0 });
        setIsUploading(false);
    };

    const handleUpload = async () => {
        if (!associationAbbrev) {
            toast({ title: 'Select an association', variant: 'destructive' });
            return;
        }
        if (is4H && !cityState) {
            toast({ title: 'Select a city', description: '4-H disciplines are city specific.', variant: 'destructive' });
            return;
        }
        if (matchedRows.length === 0) {
            toast({ title: 'Nothing to upload', description: 'No file matched a discipline.', variant: 'destructive' });
            return;
        }

        setIsUploading(true);
        setProgress({ done: 0, total: matchedRows.length });

        // Existing rows for this association/city/type, so we replace instead of creating duplicates.
        let existingQuery = supabase
            .from('tbl_scoresheet')
            .select('id, discipline, storage_path, city_state, doc_type')
            .eq('association_abbrev', associationAbbrev)
            .eq('doc_type', docType);
        if (is4H) existingQuery = existingQuery.eq('city_state', cityState);
        const { data: existing, error: existingError } = await existingQuery;

        if (existingError) {
            setIsUploading(false);
            toast({
                title: 'Could not read existing scoresheets',
                description: existingError.message.includes('doc_type')
                    ? 'The doc_type column is missing. Run the migration first.'
                    : existingError.message,
                variant: 'destructive',
            });
            return;
        }

        const existingByDiscipline = new Map((existing || []).map(row => [norm(row.discipline), row]));
        const outcome = [];

        for (const row of matchedRows) {
            try {
                const filePath = buildStoragePath({
                    association: associationAbbrev,
                    city: is4H ? cityState : '',
                    discipline: row.matched,
                    docType,
                    fileName: row.file.name,
                });
                const { error: uploadError } = await supabase.storage
                    .from('pattern_uploads')
                    .upload(filePath, row.file, { contentType: row.file.type || 'application/pdf', upsert: true });
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('pattern_uploads')
                    .getPublicUrl(filePath);

                const payload = {
                    pattern_id: null,
                    association_abbrev: associationAbbrev,
                    discipline: row.matched,
                    city_state: is4H ? cityState : null,
                    doc_type: docType,
                    image_url: publicUrl,
                    storage_path: filePath,
                    file_name: row.file.name,
                };

                const prior = existingByDiscipline.get(norm(row.matched));
                if (prior) {
                    const { error } = await supabase.from('tbl_scoresheet').update(payload).eq('id', prior.id);
                    if (error) throw error;
                    // Only clear the old object when the new upload landed on a different key,
                    // otherwise upsert already replaced it in place.
                    if (prior.storage_path && prior.storage_path !== filePath) {
                        await supabase.storage.from('pattern_uploads').remove([prior.storage_path]);
                    }
                    outcome.push({ name: row.file.name, discipline: row.matched, action: 'replaced' });
                } else {
                    const { error } = await supabase.from('tbl_scoresheet').insert([payload]);
                    if (error) throw error;
                    outcome.push({ name: row.file.name, discipline: row.matched, action: 'created' });
                }
            } catch (error) {
                outcome.push({ name: row.file.name, discipline: row.matched, action: 'failed', message: error.message });
            }
            setProgress(p => ({ ...p, done: p.done + 1 }));
        }

        setIsUploading(false);
        setResults(outcome);
        onComplete?.();

        const failed = outcome.filter(o => o.action === 'failed').length;
        toast({
            title: failed ? `Finished with ${failed} error(s)` : 'Upload complete',
            description: `${outcome.length - failed} of ${outcome.length} files saved.`,
            variant: failed ? 'destructive' : 'default',
        });
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Bulk Upload Scoresheets &amp; Accessory Documents</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-2 overflow-y-auto pr-2">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Document Type *</Label>
                            <Select value={docType} onValueChange={setDocType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="scoresheet">Score Sheets</SelectItem>
                                    <SelectItem value="accessory">Accessory Documents (Cheat Sheets)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Association *</Label>
                            <Select
                                value={associationAbbrev}
                                onValueChange={(value) => { setAssociationAbbrev(value); setCityState(''); }}
                            >
                                <SelectTrigger><SelectValue placeholder="Select Association" /></SelectTrigger>
                                <SelectContent>
                                    {associations.filter(a => a.abbreviation).map(a => (
                                        <SelectItem key={a.id} value={a.abbreviation}>{a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {is4H && (
                            <div>
                                <Label>City *</Label>
                                <Select value={cityState} onValueChange={setCityState}>
                                    <SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger>
                                    <SelectContent>
                                        {availableCities.map(city => (
                                            <SelectItem key={city} value={city}>{city}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div
                        {...getRootProps()}
                        className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        }`}
                    >
                        <input {...getInputProps()} />
                        <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                            Drag &amp; drop all PDFs here (you can drop the whole folder contents at once)
                        </p>
                    </div>

                    {rows.length > 0 && (
                        <>
                            <div className="flex items-center justify-between text-sm">
                                <span>
                                    <span className="font-medium text-green-600">{matchedRows.length} matched</span>
                                    {unmatchedRows.length > 0 && (
                                        <span className="text-amber-600"> · {unmatchedRows.length} not matched</span>
                                    )}
                                </span>
                                <Button variant="ghost" size="sm" onClick={reset}>
                                    <X className="h-4 w-4 mr-1" /> Clear list
                                </Button>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>File</TableHead>
                                        <TableHead>Discipline</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map(row => {
                                        const result = results?.find(r => r.name === row.file.name);
                                        return (
                                            <TableRow key={row.file.name}>
                                                <TableCell className="text-xs">{row.file.name}</TableCell>
                                                <TableCell className="text-sm">
                                                    {row.matched || <span className="text-muted-foreground">{row.parsed}</span>}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {result ? (
                                                        result.action === 'failed' ? (
                                                            <span className="text-destructive flex items-center gap-1">
                                                                <AlertTriangle className="h-3 w-3" /> {result.message}
                                                            </span>
                                                        ) : (
                                                            <span className="text-green-600 flex items-center gap-1">
                                                                <CheckCircle2 className="h-3 w-3" /> {result.action}
                                                            </span>
                                                        )
                                                    ) : row.matched ? (
                                                        <span className="flex items-center gap-1 text-muted-foreground">
                                                            <RefreshCw className="h-3 w-3" /> replace or create
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-600 flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" /> no matching discipline — skipped
                                                        </span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>Close</Button>
                    <Button onClick={handleUpload} disabled={isUploading || matchedRows.length === 0}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isUploading
                            ? `Uploading ${progress.done}/${progress.total}...`
                            : <><PlusCircle className="mr-2 h-4 w-4" /> Upload {matchedRows.length} file(s)</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default BulkScoresheetUploadDialog;
