import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { UploadCloud, File as FileIcon, X, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Progress } from '@/components/ui/progress';

export const AssetUploader = ({ isOpen, onClose, assetInfo, onUploadComplete }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [file, setFile] = useState(null);
    const [assetType, setAssetType] = useState('scoresheet');
    const [year, setYear] = useState(new Date().getFullYear());
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles.length > 0) {
            if (acceptedFiles[0].type !== 'application/pdf') {
                toast({ title: 'Invalid File Type', description: 'Please upload a PDF file.', variant: 'destructive' });
                return;
            }
            setFile(acceptedFiles[0]);
        }
    }, [toast]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, accept: {'application/pdf': ['.pdf']} });

    React.useEffect(() => {
        if (assetInfo?.type) {
            setAssetType(assetInfo.type);
        }
    }, [assetInfo]);

    const handleUpload = async () => {
        if (!file || !user) {
            toast({ title: 'Upload Failed', description: 'File and user authentication are required.', variant: 'destructive' });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        const fileExt = file.name.split('.').pop();
        const fileName = `${assetInfo.assocId}/${assetInfo.className}/${assetType}_${assetInfo.patternNumber || 'base'}_${uuidv4()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('association_assets')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
                onUploadProgress: (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress(percent);
                    }
                }
            });

        if (uploadError) {
            toast({ title: 'Storage Upload Failed', description: uploadError.message, variant: 'destructive' });
            setIsUploading(false);
            return;
        }

        const { data: publicUrlData } = supabase.storage.from('association_assets').getPublicUrl(fileName);

        const assetData = {
            association_id: assetInfo.assocId,
            class_name: assetInfo.className,
            pattern_number: assetInfo.patternNumber,
            asset_type: assetType,
            year: year,
            file_name: file.name,
            file_url: publicUrlData.publicUrl,
            file_path: fileName,
            uploaded_by: user.id,
        };

        const { error: dbError } = await supabase.from('association_assets').insert([assetData]);

        if (dbError) {
            toast({ title: 'Database Insert Failed', description: dbError.message, variant: 'destructive' });
            // Attempt to remove the file from storage if DB insert fails
            await supabase.storage.from('association_assets').remove([fileName]);
        } else {
            toast({ title: 'Upload Successful', description: `${file.name} has been added to the library.` });
            onUploadComplete();
            handleClose();
        }

        setIsUploading(false);
    };

    const handleClose = () => {
        setFile(null);
        setAssetType('scoresheet');
        setYear(new Date().getFullYear());
        setUploadProgress(0);
        onClose();
    };

    if (!assetInfo) return null;

    const showPatternOptions = assetInfo.patternType === 'rulebook';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload New Asset</DialogTitle>
                    <DialogDescription>
                        For: {assetInfo.assocId} - {assetInfo.className} {assetInfo.patternNumber ? `(Pattern ${assetInfo.patternNumber})` : ''}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div {...getRootProps()} className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                        <input {...getInputProps()} />
                        <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                        {file ? (
                            <div className="mt-4 flex items-center justify-center gap-2">
                                <FileIcon className="h-5 w-5 text-primary" />
                                <p className="font-semibold">{file.name}</p>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setFile(null); }}><X className="h-4 w-4" /></Button>
                            </div>
                        ) : (
                            <p className="mt-4 text-muted-foreground">Drag & drop a PDF here, or click to select</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="asset-type">Asset Type</Label>
                            <Select id="asset-type" value={assetType} onValueChange={setAssetType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="scoresheet">Score Sheet</SelectItem>
                                    {showPatternOptions && <SelectItem value="pattern">Pattern</SelectItem>}
                                    {showPatternOptions && <SelectItem value="verbiage">Verbiage</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="year">Year</Label>
                            <Input id="year" type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} />
                        </div>
                    </div>
                    {isUploading && <Progress value={uploadProgress} className="w-full" />}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isUploading}>Cancel</Button>
                    <Button onClick={handleUpload} disabled={!file || isUploading || !user}>
                        {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : 'Upload & Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};