import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { UploadCloud, File as FileIcon, X, Loader2, Trash2, Eye } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

export const LogoUploader = ({ fieldId, currentLogoUrl, onUploadComplete, showId }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
        accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [], 'image/svg+xml': [] }
    });

    const handleUpload = async () => {
        if (!file || !user || !showId) {
            toast({ title: 'Upload Failed', description: 'File, user, and show ID are required.', variant: 'destructive' });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        const fileExt = file.name.split('.').pop();
        const filePath = `${showId}/${fieldId}_${uuidv4()}.${fileExt}`;

        // If there's an old logo, remove it first.
        if (currentLogoUrl) {
            const oldFilePath = currentLogoUrl.split('/show_logos/').pop();
            await supabase.storage.from('show_logos').remove([oldFilePath]);
        }

        const { error: uploadError } = await supabase.storage
            .from('show_logos')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        // This is a workaround to get progress since the SDK's onUploadProgress is unreliable.
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            setUploadProgress(Math.min(progress, 90));
            if (progress >= 90) clearInterval(interval);
        }, 200);

        if (uploadError) {
            clearInterval(interval);
            toast({ title: 'Storage Upload Failed', description: uploadError.message, variant: 'destructive' });
            setIsUploading(false);
            return;
        }

        const { data: publicUrlData } = supabase.storage.from('show_logos').getPublicUrl(filePath);

        clearInterval(interval);
        setUploadProgress(100);

        toast({ title: 'Upload Successful', description: `${file.name} has been uploaded.` });
        onUploadComplete(publicUrlData.publicUrl);
        handleClose();
        setIsUploading(false);
    };

    const handleRemove = async (e) => {
        e.stopPropagation();
        if (!currentLogoUrl) return;
        
        const filePath = currentLogoUrl.split('/show_logos/').pop();
        const { error } = await supabase.storage.from('show_logos').remove([filePath]);

        if (error) {
            toast({ title: 'Error Removing Logo', description: error.message, variant: 'destructive' });
        } else {
            onUploadComplete('');
            toast({ title: 'Logo Removed' });
        }
    };

    const handleClose = () => {
        setFile(null);
        setUploadProgress(0);
        setIsDialogOpen(false);
    };

    return (
        <>
            <div className="flex items-center gap-2">
                {currentLogoUrl ? (
                    <div className="p-1 border rounded-md flex items-center gap-2 bg-secondary">
                        <img-replace src={currentLogoUrl} alt={`${fieldId} logo preview`} className="h-8 w-8 object-contain rounded" />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); window.open(currentLogoUrl, '_blank')}}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={handleRemove}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                ) : (
                    <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)} className="h-9">
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Upload Logo
                    </Button>
                )}
            </div>
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Logo</DialogTitle>
                        <DialogDescription>Upload a logo for {fieldId}. Recommended format: PNG, JPG, or SVG.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div {...getRootProps()} className={cn(
                            'p-8 border-2 border-dashed rounded-lg text-center cursor-pointer',
                            isDragActive ? 'border-primary bg-primary/10' : 'border-border'
                        )}>
                            <input {...getInputProps()} />
                            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                            {file ? (
                                <div className="mt-4 flex items-center justify-center gap-2">
                                    <FileIcon className="h-5 w-5 text-primary" />
                                    <p className="font-semibold">{file.name}</p>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setFile(null); }}><X className="h-4 w-4" /></Button>
                                </div>
                            ) : (
                                <p className="mt-4 text-muted-foreground">Drag & drop a file here, or click to select</p>
                            )}
                        </div>

                        {isUploading && <Progress value={uploadProgress} className="w-full" />}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" onClick={handleClose} disabled={isUploading}>Cancel</Button></DialogClose>
                        <Button onClick={handleUpload} disabled={!file || isUploading || !user || !showId}>
                            {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : 'Upload & Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};