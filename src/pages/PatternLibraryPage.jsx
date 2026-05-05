import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, AlertTriangle, FileText, Sparkles, ShieldCheck, LayoutGrid, List, Tag, X, SortAsc, Hash } from 'lucide-react';
import Navigation from '@/components/Navigation';
import PatternFolderTree from '@/components/PatternFolderTree';
import PatternTagEditor from '@/components/PatternTagEditor';
import { formatPatternNumber } from '@/lib/patternNumbering';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PatternCard = ({ pattern, onUpdate, viewMode }) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAiAction = async (action) => {
    setIsProcessing(true);
    let functionName = '';
    let body = {};

    if (action === 'auto-tag') {
      functionName = 'ai-auto-tagger';
      body = { patternData: { title: pattern.title, required_maneuvers: pattern.required_maneuvers } };
    } else if (action === 'validate') {
      functionName = 'ai-maneuver-checker';
      body = { discipline: pattern.discipline, required_maneuvers: pattern.required_maneuvers };
    }

    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body: JSON.stringify(body) });
      if (error) throw error;

      if (action === 'auto-tag') {
        const newTags = [...new Set([...(pattern.tags?.split(',') || []), ...data.tags])].join(',');
        const { data: updatedPattern, error: updateError } = await supabase
          .from('ep_patterns')
          .update({ tags: newTags })
          .eq('id', pattern.id)
          .select()
          .single();
        if (updateError) throw updateError;
        onUpdate(updatedPattern);
        toast({ title: 'AI Auto-Tagging Complete', description: `Added tags: ${data.tags.join(', ')}` });
      } else if (action === 'validate') {
        toast({
          title: 'Validation Result',
          description: data.message,
          variant: data.valid ? 'default' : 'destructive',
        });
      }
    } catch (error) {
      toast({ title: `AI Action Failed`, description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (viewMode === 'list') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
        <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center shrink-0">
          {pattern.preview_image_url ? (
            <img src={pattern.preview_image_url} alt={pattern.title} className="w-full h-full object-cover rounded-md" />
          ) : (
            <FileText className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{pattern.title}</p>
            {pattern.pattern_set_number && (
              <Badge variant="outline" className="shrink-0 text-xs font-mono">
                <Hash className="h-3 w-3 mr-0.5" />{pattern.pattern_set_number}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="outline" className="text-xs">{pattern.discipline || 'N/A'}</Badge>
            <Badge variant="outline" className="text-xs">{pattern.division || 'N/A'}</Badge>
            <Badge variant="outline" className="text-xs">{pattern.level || 'N/A'}</Badge>
            {(pattern.tags?.split(',') || []).filter(t => t).slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleAiAction('auto-tag')} disabled={isProcessing}>
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleAiAction('validate')} disabled={isProcessing}>
            <ShieldCheck className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div whileHover={{ y: -3 }} className="h-full">
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center overflow-hidden">
            {pattern.preview_image_url ? (
              <img src={pattern.preview_image_url} alt={pattern.title} className="w-full h-full object-cover rounded-md" />
            ) : (
              <FileText className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm leading-tight">{pattern.title}</CardTitle>
            {pattern.pattern_set_number && (
              <Badge variant="outline" className="shrink-0 text-[10px] font-mono">
                <Hash className="h-2.5 w-2.5 mr-0.5" />{pattern.pattern_set_number}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-grow space-y-2 pt-0">
          <div className="flex flex-wrap gap-1 text-xs">
            <Badge variant="outline">{pattern.discipline || 'N/A'}</Badge>
            <Badge variant="outline">{pattern.division || 'N/A'}</Badge>
            <Badge variant="outline">{pattern.level || 'N/A'}</Badge>
            <Badge variant="secondary">v{pattern.version || 1}</Badge>
            {pattern.checksum && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Dup?</Badge>}
          </div>
          <div className="flex flex-wrap gap-1 text-xs">
            {(pattern.tags?.split(',') || []).filter(t => t).map(tag => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 items-stretch pt-0">
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => handleAiAction('auto-tag')} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Tag
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => handleAiAction('validate')} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
            Validate
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

const PatternLibraryPage = () => {
  const [patterns, setPatterns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [selectedFolderLabel, setSelectedFolderLabel] = useState('All Patterns');
  const [activeTagFilters, setActiveTagFilters] = useState([]);
  const [sortBy, setSortBy] = useState('newest');
  const { toast } = useToast();

  useEffect(() => {
    const fetchPatterns = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ep_patterns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({ title: 'Error fetching patterns', description: error.message, variant: 'destructive' });
      } else {
        setPatterns(data || []);
      }
      setIsLoading(false);
    };
    fetchPatterns();
  }, [toast]);

  const handlePatternUpdate = (updatedPattern) => {
    setPatterns(prevPatterns =>
      prevPatterns.map(p => (p.id === updatedPattern.id ? updatedPattern : p))
    );
  };

  const handleSelectFolder = (folderId, label) => {
    setSelectedFolder(folderId);
    setSelectedFolderLabel(label);
  };

  const toggleTagFilter = (tag) => {
    setActiveTagFilters(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Apply all filters
  const filteredPatterns = useMemo(() => {
    let result = patterns;

    // Folder filter
    if (selectedFolder !== 'all') {
      const parts = selectedFolder.replace('d-', '').split('-');
      if (parts.length >= 1) {
        result = result.filter(p => (p.discipline || 'Uncategorized') === parts[0]);
      }
      if (parts.length >= 2) {
        result = result.filter(p => (p.division || 'General') === parts.slice(1).join('-'));
      }
    }

    // Text search
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p =>
        (p.title?.toLowerCase() || '').includes(lower) ||
        (p.discipline?.toLowerCase() || '').includes(lower) ||
        (p.division?.toLowerCase() || '').includes(lower) ||
        (p.tags?.toLowerCase() || '').includes(lower) ||
        (p.pattern_set_number?.toLowerCase() || '').includes(lower)
      );
    }

    // Tag filters
    if (activeTagFilters.length > 0) {
      result = result.filter(p => {
        const patternTags = (p.tags || '').toLowerCase().split(',').map(t => t.trim());
        return activeTagFilters.every(tag => patternTags.includes(tag.toLowerCase()));
      });
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result = [...result].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'oldest':
        result = [...result].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'title':
        result = [...result].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'number':
        result = [...result].sort((a, b) => (a.pattern_set_number || 'zzz').localeCompare(b.pattern_set_number || 'zzz'));
        break;
      default:
        break;
    }

    return result;
  }, [patterns, selectedFolder, searchTerm, activeTagFilters, sortBy]);

  // Collect all unique tags for the filter bar
  const allTags = useMemo(() => {
    const tagSet = new Set();
    patterns.forEach(p => {
      (p.tags || '').split(',').filter(t => t.trim()).forEach(t => tagSet.add(t.trim()));
    });
    return Array.from(tagSet).sort();
  }, [patterns]);

  return (
    <>
      <Helmet>
        <title>Pattern Library - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight">Pattern Library</h1>
            <p className="text-muted-foreground">Search, organize, and manage all patterns.</p>
          </motion.div>

          <div className="flex gap-6">
            {/* Left Sidebar — Folder Tree */}
            <div className="hidden lg:block w-64 shrink-0">
              <Card className="sticky top-4">
                <CardContent className="p-0 h-[calc(100vh-180px)]">
                  <PatternFolderTree
                    patterns={patterns}
                    selectedFolder={selectedFolder}
                    onSelectFolder={handleSelectFolder}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Search + Controls */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, discipline, tags, number..."
                    className="pl-10 h-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-36 h-10">
                      <SortAsc className="h-4 w-4 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="title">Title A-Z</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-10 w-10 rounded-r-none"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-10 w-10 rounded-l-none"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tag Filter Chips */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <Tag className="h-4 w-4 text-muted-foreground mr-1" />
                  {allTags.slice(0, 20).map(tag => (
                    <Badge
                      key={tag}
                      variant={activeTagFilters.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs hover:opacity-80"
                      onClick={() => toggleTagFilter(tag)}
                    >
                      {tag}
                      {activeTagFilters.includes(tag) && <X className="ml-1 h-3 w-3" />}
                    </Badge>
                  ))}
                  {activeTagFilters.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setActiveTagFilters([])}>
                      Clear filters
                    </Button>
                  )}
                </div>
              )}

              {/* Breadcrumb / Current Folder */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedFolderLabel}</span>
                  {' '}&middot; {filteredPatterns.length} pattern{filteredPatterns.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Pattern Grid/List */}
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              ) : filteredPatterns.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-4" />
                  <p className="text-lg">No patterns found</p>
                  <p className="text-sm">Try adjusting your search or folder filter.</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredPatterns.map(pattern => (
                    <PatternCard key={pattern.id} pattern={pattern} onUpdate={handlePatternUpdate} viewMode={viewMode} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPatterns.map(pattern => (
                    <PatternCard key={pattern.id} pattern={pattern} onUpdate={handlePatternUpdate} viewMode={viewMode} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default PatternLibraryPage;
