import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, Trash2, Image as ImageIcon, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileUploadEditor } from './FileUploadEditor';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid';

const FilePreview = ({ fileData, onRemove, onEdit }) => (
  <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
    <div className="flex flex-col gap-1 overflow-hidden">
        <div className="flex items-center gap-2">
            <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{fileData.customName || fileData.file?.name || fileData.fileName}</span>
        </div>
        {fileData.tags && fileData.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pl-7">
                {fileData.tags.map(tag => <Badge key={tag} variant="outline">#{tag}</Badge>)}
            </div>
        )}
    </div>
    <div className="flex items-center">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
    </div>
  </div>
);

const FileUploadZone = ({ dropzone, files, onRemove, onEdit, title, description, isUploading }) => {
  const { isDragActive, getRootProps, getInputProps } = dropzone;
  const rootProps = getRootProps();
  
  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      <div 
        {...rootProps}
        className={cn(
          rootProps.className,
          "p-6 border-2 border-dashed rounded-md text-center cursor-pointer hover:border-primary transition-colors",
          isUploading && "cursor-not-allowed opacity-50",
          isDragActive && "border-primary bg-primary/10"
        )}
      >
        <input {...getInputProps()} disabled={isUploading} />
      {isUploading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Uploading...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <UploadCloud className="h-10 w-10" />
            <p className="mt-2 text-sm">{description}</p>
        </div>
      )}
      </div>
      <div className="space-y-2 mt-2">
        {(files || []).map((file, index) => (
          <FilePreview key={index} fileData={file} onRemove={() => onRemove(index)} onEdit={() => onEdit(file, index)} />
        ))}
      </div>
    </div>
  );
};

export const Step4_Uploads = ({ formData, setFormData, isClinicMode, isEducationMode, stepNumber = 6, purposeName }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [coverImage, setCoverImage] = useState(formData.marketing?.coverImage || null);
  const coverPageRef = useRef(null);
  const [editingFile, setEditingFile] = useState(null);
  const [editingFileIndex, setEditingFileIndex] = useState(null);
  const [editingFileType, setEditingFileType] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!formData.coverPageOption && coverPageRef.current) {
      coverPageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);
  
  const handleEditFile = (fileData, index, type) => {
    setEditingFile(fileData);
    setEditingFileIndex(index);
    setEditingFileType(type);
  };

  const handleSaveFile = (updatedFileData) => {
    setFormData(prev => {
        const newFormData = { ...prev };
        if (editingFileType === 'general_marketing') {
            newFormData.generalMarketing = newFormData.generalMarketing || [];
            newFormData.generalMarketing[editingFileIndex] = updatedFileData;
        } else if (editingFileType === 'lesson_plan') {
            newFormData.lessonPlans = newFormData.lessonPlans || [];
            newFormData.lessonPlans[editingFileIndex] = updatedFileData;
        } else if (editingFileType === 'sponsor_logo') {
            newFormData.marketing = newFormData.marketing || {};
            newFormData.marketing.sponsorLogos = newFormData.marketing.sponsorLogos || [];
            newFormData.marketing.sponsorLogos[editingFileIndex] = updatedFileData;
        } else if (editingFileType === 'show_documents') {
            newFormData.showDocuments = newFormData.showDocuments || [];
            newFormData.showDocuments[editingFileIndex] = updatedFileData;
        }
        return newFormData;
    });
    setEditingFile(null);
    setEditingFileIndex(null);
    setEditingFileType(null);
  };

  const uploadFile = async (file, type) => {
    if (!user || !formData.id) {
        toast({ title: 'Error', description: 'Please save the project first.', variant: 'destructive' });
        return null;
    }
    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${formData.id}/${type}/${uuidv4()}.${fileExt}`;

    const { error } = await supabase.storage.from('project_files').upload(filePath, file);
    setIsUploading(false);

    if (error) {
        toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
        return null;
    }
    
    const { data: { publicUrl } } = supabase.storage.from('project_files').getPublicUrl(filePath);
    return { fileUrl: publicUrl, filePath, fileName: file.name };
  };

  const handleDrop = useCallback(async (acceptedFiles, type) => {
    for (const file of acceptedFiles) {
        const uploadResult = await uploadFile(file, type);
        if (uploadResult) {
            const newFileObject = { ...uploadResult, file, type, customName: file.name, tags: [] };
            setFormData(prev => {
                const newFormData = { ...prev };
                if (type === 'general_marketing') {
                    newFormData.generalMarketing = [...(prev.generalMarketing || []), newFileObject];
                } else if (type === 'lesson_plan') {
                    newFormData.lessonPlans = [...(prev.lessonPlans || []), newFileObject];
                } else if (type === 'sponsor_logo') {
                    newFormData.marketing = { ...prev.marketing, sponsorLogos: [...(prev.marketing?.sponsorLogos || []), newFileObject] };
                } else if (type === 'show_documents') {
                    newFormData.showDocuments = [...(prev.showDocuments || []), newFileObject];
                }
                return newFormData;
            });
        }
    }
  }, [setFormData, user, formData.id, toast]);

  const handleCoverImageDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (!file.type.startsWith('image/')) {
        toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload an image file.' });
        return;
      }
      const uploadResult = await uploadFile(file, 'cover_image');
      if (uploadResult) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const image = { ...uploadResult, file, preview: reader.result };
            setCoverImage(image);
            setFormData(prev => ({ ...prev, marketing: { ...prev.marketing, coverImage: image } }));
        };
        reader.readAsDataURL(file);
      }
    }
  }, [setFormData, toast, user, formData.id]);

  const removeFile = async (index, type) => {
    let fileToRemove = null;
    if (type === 'general_marketing') {
      fileToRemove = formData.generalMarketing?.[index];
    } else if (type === 'lesson_plan') {
      fileToRemove = formData.lessonPlans?.[index];
    } else if (type === 'sponsor_logo') {
      fileToRemove = formData.marketing?.sponsorLogos?.[index];
    } else if (type === 'show_documents') {
      fileToRemove = formData.showDocuments?.[index];
    }
    
    if (fileToRemove?.filePath) {
        await supabase.storage.from('project_files').remove([fileToRemove.filePath]);
    }
    
    if (type === 'general_marketing') {
      setFormData(prev => ({ ...prev, generalMarketing: (prev.generalMarketing || []).filter((_, i) => i !== index) }));
    } else if (type === 'lesson_plan') {
      setFormData(prev => ({ ...prev, lessonPlans: (prev.lessonPlans || []).filter((_, i) => i !== index) }));
    } else if (type === 'sponsor_logo') {
      setFormData(prev => ({ ...prev, marketing: { ...prev.marketing, sponsorLogos: (prev.marketing?.sponsorLogos || []).filter((_, i) => i !== index) } }));
    } else if (type === 'show_documents') {
      setFormData(prev => ({ ...prev, showDocuments: (prev.showDocuments || []).filter((_, i) => i !== index) }));
    }
  };

  const coverImageDropzone = useDropzone({ onDrop: handleCoverImageDrop, multiple: false, accept: {'image/*': ['.jpeg', '.png', '.jpg']}, disabled: isUploading });
  const generalMarketingDropzone = useDropzone({ onDrop: (files) => handleDrop(files, 'general_marketing'), accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpeg', '.png', '.jpg'] }, disabled: isUploading });
  const lessonPlanDropzone = useDropzone({ onDrop: (files) => handleDrop(files, 'lesson_plan'), disabled: isUploading });
  const sponsorLogoDropzone = useDropzone({ onDrop: (files) => handleDrop(files, 'sponsor_logo'), accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpeg', '.png', '.jpg'] }, disabled: isUploading });
  const showDocumentsDropzone = useDropzone({ 
    onDrop: (files) => handleDrop(files, 'show_documents'), 
    accept: { 
      'application/pdf': ['.pdf'], 
      'image/*': ['.jpeg', '.png', '.jpg'] 
    }, 
    disabled: isUploading
  });

  return (
    <>
      <CardHeader>
        <CardTitle>Step {stepNumber}: Uploads & Media</CardTitle>
        <CardDescription>Upload any relevant files or media for your show book. Your project must be saved first.</CardDescription>
      </CardHeader>
      <div className="space-y-6">
        <FileUploadZone
          dropzone={showDocumentsDropzone}
          files={formData.showDocuments}
          onRemove={(index) => removeFile(index, 'show_documents')}
          onEdit={(file, index) => handleEditFile(file, index, 'show_documents')}
          title={purposeName ? `${purposeName} Information (Optional)` : "Show Schedule/Show Bill (Optional)"}
          description="Upload JPEGs or PDFs of schedule and information documents."
          isUploading={isUploading}
        />

        {isEducationMode ? (
          <FileUploadZone
            dropzone={lessonPlanDropzone}
            files={formData.lessonPlans}
            onRemove={(index) => removeFile(index, 'lesson_plan')}
            onEdit={(file, index) => handleEditFile(file, index, 'lesson_plan')}
            title="Lesson Plans (Optional)"
            description="Upload lesson plans or other educational documents."
            isUploading={isUploading}
          />
        ) : (
          <FileUploadZone
            dropzone={generalMarketingDropzone}
            files={formData.generalMarketing}
            onRemove={(index) => removeFile(index, 'general_marketing')}
            onEdit={(file, index) => handleEditFile(file, index, 'general_marketing')}
            title={purposeName ? `${purposeName} Logos (Optional)` : "Show Logos (Optional)"}
            description="Upload JPEGs or PDFs of logos and branding materials."
            isUploading={isUploading}
          />
        )}

        <FileUploadZone
          dropzone={sponsorLogoDropzone}
          files={formData.marketing?.sponsorLogos}
          onRemove={(index) => removeFile(index, 'sponsor_logo')}
          onEdit={(file, index) => handleEditFile(file, index, 'sponsor_logo')}
          title="Sponsor Logos (Optional)"
          description="Upload JPEGs or PDFs for sponsor logos to be included in the document."
          isUploading={isUploading}
        />
        
      </div>
      <FileUploadEditor
        isOpen={!!editingFile}
        onOpenChange={() => setEditingFile(null)}
        fileData={editingFile}
        onSave={handleSaveFile}
      />
    </>
  );
};