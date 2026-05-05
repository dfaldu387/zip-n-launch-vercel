import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Image as ImageIcon,
  Video,
  Folder,
  FileText,
  Wand2,
  Trash2,
  Loader2,
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MediaFolder from '@/components/MediaFolder';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const MediaLibraryPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [currentUploadFolder, setCurrentUploadFolder] = useState({ cat1: '', cat2: ''});
  const [fileName, setFileName] = useState('');
  const [altText, setAltText] = useState('');
  const [tags, setTags] = useState('');
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploadedMedia, setUploadedMedia] = useState({
      Backgrounds: { Homepage: [], Forms: [], OtherPages: [], Videos: [] },
      PatternMedia: { Diagrams: [], Videos: [] },
      GeneralMedia: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const fetchMedia = useCallback(async () => {
    setIsLoading(false);
    toast({ title: 'Error fetching media', description: 'Supabase is not connected.', variant: 'destructive' });
  }, [toast]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleOpenUploadDialog = (cat1, cat2 = '') => {
    setCurrentUploadFolder({cat1, cat2});
    setIsUploadDialogOpen(true);
    setFileName('');
    setAltText('');
    setTags('');
    setFileToUpload(null);
  };

  const handleUploadSubmit = async () => {
    setIsUploading(true);
    toast({ title: 'Upload Failed', description: 'Supabase is not connected.', variant: 'destructive' });
    setIsUploading(false);
  };

  const handleDelete = async (mediaId, filePath) => {
    toast({ title: "Deletion Failed", description: "Supabase is not connected.", variant: 'destructive' });
  }
  
  const handleAddSubfolder = () => {
      toast({
          title: 'Add Subfolder',
          description: '🚧 This feature isn\'t implemented yet—but don\'t worry! You can request it in your next prompt! 🚀'
      });
  }

  const handleAiGenerate = async () => {
    setIsAiGenerating(true);
    toast({
        title: "AI Analysis Failed",
        description: "Supabase is not connected.",
        variant: 'destructive'
    });
    setIsAiGenerating(false);
  }

  const containerVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <>
      <Helmet>
        <title>Media Library - Admin Dashboard</title>
        <meta name="description" content="Manage all media assets for the EquiPatterns platform, including backgrounds, videos, and pattern diagrams." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <CardHeader className="text-center mb-8 px-0">
              <CardTitle className="text-4xl md:text-5xl font-bold">Media Library</CardTitle>
              <CardDescription className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Organize, upload, and manage all your website's visual assets from one central hub.
              </CardDescription>
            </CardHeader>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            ) : (
                <Card>
                <CardContent className="p-6">
                    <motion.div variants={containerVariants} className="space-y-4">
                    <motion.div variants={itemVariants}>
                        <MediaFolder icon={Folder} title="Backgrounds" description="Images and videos for page backgrounds." defaultOpen={true}>
                        <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                            <MediaFolder icon={ImageIcon} title="Homepage" description="Hero backgrounds for the main landing page." onUploadClick={() => handleOpenUploadDialog('Backgrounds', 'Homepage')} mediaItems={uploadedMedia.Backgrounds?.Homepage || []} onDelete={handleDelete} />
                            <MediaFolder icon={ImageIcon} title="Forms" description="Media for form pages or specific sections." onUploadClick={() => handleOpenUploadDialog('Backgrounds', 'Forms')} mediaItems={uploadedMedia.Backgrounds?.Forms || []} onDelete={handleDelete} />
                            <MediaFolder icon={ImageIcon} title="Other Pages" description="Assets for About Us, Contact, etc." onUploadClick={() => handleOpenUploadDialog('Backgrounds', 'OtherPages')} mediaItems={uploadedMedia.Backgrounds?.OtherPages || []} onDelete={handleDelete}/>
                            <MediaFolder icon={Video} title="Videos" description="Video backgrounds for dynamic pages." onUploadClick={() => handleOpenUploadDialog('Backgrounds', 'Videos')} mediaItems={uploadedMedia.Backgrounds?.Videos || []} onDelete={handleDelete}/>
                        </div>
                        </MediaFolder>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <MediaFolder icon={Folder} title="Pattern Media" description="Diagrams and videos related to patterns.">
                        <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                            <MediaFolder icon={FileText} title="Diagrams" description="Illustrations and diagrams of patterns." onUploadClick={() => handleOpenUploadDialog('PatternMedia', 'Diagrams')} mediaItems={uploadedMedia.PatternMedia?.Diagrams || []} onDelete={handleDelete}/>
                            <MediaFolder icon={Video} title="Videos" description="Video demonstrations of routines." onUploadClick={() => handleOpenUploadDialog('PatternMedia', 'Videos')} mediaItems={uploadedMedia.PatternMedia?.Videos || []} onDelete={handleDelete} />
                        </div>
                        </MediaFolder>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <MediaFolder icon={Folder} title="General Media" description="Miscellaneous assets like logos and gallery images." onUploadClick={() => handleOpenUploadDialog('GeneralMedia')} mediaItems={uploadedMedia.GeneralMedia || []} onDelete={handleDelete}/>
                    </motion.div>
                    </motion.div>
                </CardContent>
                </Card>
            )}
          </motion.div>
        </main>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload to {currentUploadFolder.cat2 || currentUploadFolder.cat1}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="file" className="text-right">File</Label>
                <Input id="file" type="file" onChange={(e) => setFileToUpload(e.target.files[0])} className="col-span-3" />
              </div>
               <div className="flex justify-end">
                <Button variant="ghost" onClick={handleAiGenerate} disabled={!fileToUpload || isAiGenerating}>
                    {isAiGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                    AI Generate
                </Button>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fileName" className="text-right">Display Name</Label>
                <Input id="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="e.g., homepage_bg_horse_running.jpg" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="altText" className="text-right">Alt Text</Label>
                <Input id="altText" value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="e.g., Brown horse running in a green field" className="col-span-3"/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="tags" className="text-right">Tags</Label>
                <Textarea id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g., outdoor, horse, action (comma-separated)" className="col-span-3" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUploadSubmit} disabled={isUploading}>
                {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : 'Upload'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};
export default MediaLibraryPage;