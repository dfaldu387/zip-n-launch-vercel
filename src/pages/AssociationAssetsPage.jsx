import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { Upload, FileText, Image as ImageIcon, Loader2, ServerCrash, Trash2, Download, PlusCircle, Home } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const AssociationAssetsPage = () => {
  const { associationId } = useParams();
  const { toast } = useToast();
  const [association, setAssociation] = useState(null);
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteState, setDeleteState] = useState({ isOpen: false, asset: null });

  // Form states for new asset upload
  const [newAssetFile, setNewAssetFile] = useState(null);
  const [newAssetType, setNewAssetType] = useState('');
  const [newAssetClassName, setNewAssetClassName] = useState('');
  const [newAssetPatternNumber, setNewAssetPatternNumber] = useState('');
  const [newAssetYear, setNewAssetYear] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fetchAssociationAndAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch association details
      const { data: assocData, error: assocError } = await supabase
        .from('associations')
        .select('*')
        .eq('id', associationId)
        .single();

      if (assocError) throw assocError;
      setAssociation(assocData);

      // Fetch assets for this association
      const { data: assetsData, error: assetsError } = await supabase
        .from('association_assets')
        .select('*')
        .eq('association_id', associationId)
        .order('created_at', { ascending: false });

      if (assetsError) throw assetsError;
      setAssets(assetsData);

    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error loading data',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [associationId, toast]);

  useEffect(() => {
    fetchAssociationAndAssets();
  }, [fetchAssociationAndAssets]);

  const handleDeleteAsset = async () => {
    if (!deleteState.asset) return;

    try {
      // Delete from storage first
      if (deleteState.asset.file_path) {
        const { error: storageError } = await supabase.storage
          .from('association_assets') // Assuming a bucket named 'association_assets'
          .remove([deleteState.asset.file_path]);

        if (storageError) {
          console.warn('Storage deletion failed:', storageError);
          // Don't throw, proceed to delete from DB even if storage fails
        }
      }

      // Delete the asset record from the database
      const { error: dbError } = await supabase
        .from('association_assets')
        .delete()
        .eq('id', deleteState.asset.id);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: 'Asset Deleted',
        description: 'The asset has been permanently removed.',
      });
      fetchAssociationAndAssets(); // Refresh the list
    } catch (err) {
      toast({
        title: 'Error deleting asset',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDeleteState({ isOpen: false, asset: null });
    }
  };

  const handleDownloadAsset = (asset) => {
    if (asset.file_url) {
      const link = document.createElement('a');
      link.href = asset.file_url;
      link.download = asset.file_name || 'asset';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFileChange = (event) => {
    setNewAssetFile(event.target.files[0]);
  };

  const handleUploadNewAsset = async (e) => {
    e.preventDefault();
    if (!newAssetFile || !newAssetType || !newAssetClassName) {
      toast({
        title: 'Missing Information',
        description: 'Please select a file, asset type, and class name.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExtension = newAssetFile.name.split('.').pop();
      const fileName = `${associationId}_${newAssetType}_${newAssetClassName}_${Date.now()}.${fileExtension}`;
      const filePath = `public/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('association_assets') // Ensure this bucket exists and has appropriate policies
        .upload(filePath, newAssetFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('association_assets')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      const { data: insertData, error: insertError } = await supabase
        .from('association_assets')
        .insert({
          association_id: associationId,
          class_name: newAssetClassName,
          asset_type: newAssetType,
          pattern_number: newAssetPatternNumber || null,
          year: newAssetYear ? parseInt(newAssetYear) : null,
          file_name: newAssetFile.name,
          file_url: publicUrl,
          file_path: filePath,
          uploaded_by: (await supabase.auth.getUser()).data.user.id, // Get current user ID
        });

      if (insertError) throw insertError;

      toast({
        title: 'Asset Uploaded',
        description: 'New asset has been successfully added.',
      });
      setNewAssetFile(null);
      setNewAssetType('');
      setNewAssetClassName('');
      setNewAssetPatternNumber('');
      setNewAssetYear('');
      fetchAssociationAndAssets(); // Refresh the list
    } catch (err) {
      toast({
        title: 'Error uploading asset',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>{association?.name || 'Association'} Assets - EquiPatterns</title>
          <meta name="description" content={`Manage assets for ${association?.name || 'this association'}.`} />
        </Helmet>
        <div className="min-h-screen bg-background">
          <Navigation />
          <main className="container mx-auto px-4 py-12">
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          </main>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Helmet>
          <title>{association?.name || 'Association'} Assets - EquiPatterns</title>
          <meta name="description" content={`Manage assets for ${association?.name || 'this association'}.`} />
        </Helmet>
        <div className="min-h-screen bg-background">
          <Navigation />
          <main className="container mx-auto px-4 py-12">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ServerCrash className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="2xl font-bold mb-2">Failed to Load Assets</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchAssociationAndAssets}>Try Again</Button>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{association?.name || 'Association'} Assets - EquiPatterns</title>
        <meta name="description" content={`Manage assets for ${association?.name || 'this association'}.`} />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Breadcrumb Navigation */}
            <div className="mb-6">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/admin"><Home className="h-4 w-4" /></Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/admin/asset-library">Asset Library</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{association?.name || 'Association'}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="mb-6 flex items-center justify-between">
              <AdminBackButton to="/admin/asset-library" />
            </div>

            <CardHeader className="text-center px-0 mb-8">
              <CardTitle className="text-4xl md:text-5xl font-bold">{association?.name} Assets</CardTitle>
              <CardDescription className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Manage official patterns, score sheets, and verbiage for {association?.name}.
              </CardDescription>
            </CardHeader>

            {/* Upload New Asset Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5" /> Upload New Asset
                </CardTitle>
                <CardDescription>Add new official documents or images for this association.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUploadNewAsset} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assetFile">File</Label>
                    <Input id="assetFile" type="file" onChange={handleFileChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assetType">Asset Type</Label>
                    <Select value={newAssetType} onValueChange={setNewAssetType} required>
                      <SelectTrigger id="assetType">
                        <SelectValue placeholder="Select asset type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pattern">Pattern</SelectItem>
                        <SelectItem value="scoresheet">Score Sheet</SelectItem>
                        <SelectItem value="verbiage">Verbiage</SelectItem>
                        <SelectItem value="logo">Logo</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="className">Class Name</Label>
                    <Input id="className" value={newAssetClassName} onChange={(e) => setNewAssetClassName(e.target.value)} placeholder="e.g., Western Pleasure" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patternNumber">Pattern Number (Optional)</Label>
                    <Input id="patternNumber" value={newAssetPatternNumber} onChange={(e) => setNewAssetPatternNumber(e.target.value)} placeholder="e.g., 1, 2, A" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year (Optional)</Label>
                    <Input id="year" type="number" value={newAssetYear} onChange={(e) => setNewAssetYear(e.target.value)} placeholder="e.g., 2023" />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button type="submit" disabled={isUploading}>
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" /> Upload Asset
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Existing Assets List */}
            <div className="space-y-4">
              {assets.length > 0 ? (
                assets.map((asset, index) => (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="flex items-center justify-between p-4">
                      <div className="flex items-center space-x-4">
                        {asset.asset_type === 'pattern' || asset.asset_type === 'scoresheet' || asset.asset_type === 'verbiage' ? (
                          <FileText className="h-8 w-8 text-primary" />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-primary" />
                        )}
                        <div>
                          <p className="font-semibold">{asset.file_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {asset.asset_type} • {asset.class_name}
                            {asset.pattern_number && ` • Pattern ${asset.pattern_number}`}
                            {asset.year && ` • ${asset.year}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleDownloadAsset(asset)}>
                          <Download className="h-4 w-4 mr-2" /> Download
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteState({ isOpen: true, asset })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-4" />
                  <p className="text-lg">No assets found for {association?.name}.</p>
                  <p className="text-sm">Use the form above to upload new assets.</p>
                </div>
              )}
            </div>
          </motion.div>
        </main>
      </div>
      <ConfirmationDialog
        isOpen={deleteState.isOpen}
        onClose={() => setDeleteState({ isOpen: false, asset: null })}
        onConfirm={handleDeleteAsset}
        title="Delete Asset Permanently?"
        description={`This will permanently delete "${deleteState.asset?.file_name}" from storage and the database. This action cannot be undone.`}
        confirmText="Delete"
      />
    </>
  );
};

export default AssociationAssetsPage;