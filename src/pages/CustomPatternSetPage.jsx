import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Edit, Trash2, Eye, PlusCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import PatternPreviewModal from '@/components/pattern-upload/PatternPreviewModal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { addLogoToAssociations } from '@/lib/associationsData';


const CustomPatternSetPage = () => {
  const { classType } = useParams();
  const { toast } = useToast();
  const [patternSet, setPatternSet] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewingPattern, setPreviewingPattern] = useState(null);
  const [deletingPattern, setDeletingPattern] = useState(null);
  const [associationsData, setAssociationsData] = useState([]);

  useEffect(() => {
    const fetchAssociations = async () => {
        const { data, error } = await supabase.from('associations').select('*');
        if (error) {
            toast({ title: 'Error fetching associations', description: error.message, variant: 'destructive' });
        } else {
            setAssociationsData(addLogoToAssociations(data));
        }
    };
    fetchAssociations();
  }, [toast]);

  useEffect(() => {
    const fetchPatternSet = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('patterns')
        .select(`
          *, approved_associations,
          pattern_associations ( association_id, difficulty ),
          pattern_divisions ( association_id, division_level )
        `)
        .eq('class_name', classType)
        .eq('is_custom', true)
        .order('hierarchy_order', { ascending: true });

      if (error) {
        toast({ title: 'Error fetching pattern set', description: error.message, variant: 'destructive' });
      } else {
        setPatternSet(data);
      }
      setIsLoading(false);
    };

    if (classType) {
      fetchPatternSet();
    }
  }, [classType, toast]);

  const handleDelete = async () => {
    if (!deletingPattern) return;

    const { error } = await supabase.from('patterns').delete().match({ id: deletingPattern.id });
    if (error) {
      toast({ title: 'Error deleting pattern', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pattern Deleted', description: `${deletingPattern.name} has been removed.` });
      setPatternSet(prev => prev.filter(p => p.id !== deletingPattern.id));
    }
    setDeletingPattern(null);
  };

  const getAssociationName = (id) => associationsData.find(a => a.id === id)?.name || id;

  const PatternCard = ({ pattern }) => {
    // Use approved_associations if set by admin, otherwise fall back to submitted pattern_associations
    const uniqueAssociations = (pattern.approved_associations && pattern.approved_associations.length > 0)
      ? pattern.approved_associations
      : [...new Set(pattern.pattern_associations.map(pa => pa.association_id))];
    
    return (
      <Card className="overflow-hidden transition-all hover:shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{pattern.pattern_set_name || 'Untitled Set'}</CardTitle>
              <CardDescription>Hierarchy: {pattern.hierarchy_order + 1}</CardDescription>
            </div>
            <Badge variant={pattern.review_status === 'approved' ? 'default' : 'secondary'}>
              {pattern.review_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="aspect-w-16 aspect-h-9 mb-4 bg-muted rounded-md flex items-center justify-center">
            <img-replace src={pattern.preview_image_url || 'https://placehold.co/600x400?text=Pattern'} alt={pattern.display_name || pattern.name} className="object-cover w-full h-full" />
          </div>
          <p className="font-semibold text-sm truncate mb-2">{pattern.display_name || pattern.name}</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p><strong>Associations:</strong> {uniqueAssociations.map(getAssociationName).join(', ')}</p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" size="icon" onClick={() => setPreviewingPattern(pattern)}><Eye className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => toast({ title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀"})}><Edit className="h-4 w-4" /></Button>
            <a href={pattern.file_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
            </a>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingPattern(pattern)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Helmet>
        <title>{classType ? `${classType} - Custom Pattern Set` : 'Custom Pattern Set'}</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center mb-8">
              <AdminBackButton to="/admin/asset-library" className="mr-4" />
              <div>
                <h1 className="text-3xl font-bold">Custom Pattern Set: {classType}</h1>
                <p className="text-muted-foreground">Manage all custom patterns uploaded for this discipline.</p>
              </div>
              <Link to="/upload-patterns/new" className="ml-auto">
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New Pattern Set
                </Button>
              </Link>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : patternSet.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {patternSet.map(pattern => (
                  <PatternCard key={pattern.id} pattern={pattern} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 border-2 border-dashed rounded-lg">
                <h2 className="text-xl font-semibold">No Patterns Found</h2>
                <p className="text-muted-foreground mt-2">There are no custom patterns for {classType} yet.</p>
              </div>
            )}
          </motion.div>
        </main>
      </div>
      <PatternPreviewModal
        isOpen={!!previewingPattern}
        onClose={() => setPreviewingPattern(null)}
        pattern={previewingPattern}
      />
      <ConfirmationDialog
        isOpen={!!deletingPattern}
        onClose={() => setDeletingPattern(null)}
        onConfirm={handleDelete}
        title="Are you sure?"
        description={`This will permanently delete the pattern "${deletingPattern?.name}". This action cannot be undone.`}
        confirmText="Delete"
      />
    </>
  );
};

export default CustomPatternSetPage;