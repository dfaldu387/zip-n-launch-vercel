import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Plus, Trash2, Loader2, Save, Search, Filter, Edit2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Default level categories based on APHA Western Riding patterns spec
const DEFAULT_LEVEL_CATEGORIES = ['ALL', 'GR', 'NOV', 'L1', 'Beginner'];

// Level category colors for badges
const levelCategoryColors = {
  'ALL': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'GR': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  'NOV': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  'L1': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'Beginner': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'GR/NOV': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
};

const AdminPatternLevelManagementPage = () => {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentPattern, setCurrentPattern] = useState(null);
  const [customLevels, setCustomLevels] = useState([]);
  const [newLevel, setNewLevel] = useState('');

  // Fetch patterns from ep_patterns table
  const fetchPatterns = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ep_patterns')
        .select('id, title, discipline, level, level_category, pattern_set_number, parent_pattern_id, status')
        .is('deleted_at', null)
        .order('discipline', { ascending: true })
        .order('pattern_set_number', { ascending: true });

      if (error) throw error;

      setPatterns(data || []);

      // Extract unique custom levels from patterns
      const uniqueLevels = [...new Set((data || [])
        .map(p => p.level_category)
        .filter(l => l && !DEFAULT_LEVEL_CATEGORIES.includes(l)))];
      setCustomLevels(uniqueLevels);
    } catch (error) {
      toast({
        title: 'Error fetching patterns',
        description: error.message,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  // Get all available level categories
  const allLevelCategories = [...DEFAULT_LEVEL_CATEGORIES, ...customLevels];

  // Filter patterns based on search and filter
  const filteredPatterns = patterns.filter(pattern => {
    const matchesSearch = !searchTerm || 
      pattern.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pattern.discipline?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterLevel === 'all' || pattern.level_category === filterLevel;
    return matchesSearch && matchesFilter;
  });

  // Group patterns by pattern_set_number for display
  const groupedPatterns = filteredPatterns.reduce((acc, pattern) => {
    const setKey = pattern.pattern_set_number 
      ? `Set ${pattern.pattern_set_number} - ${pattern.discipline || 'Unknown'}` 
      : `Individual - ${pattern.title}`;
    if (!acc[setKey]) {
      acc[setKey] = [];
    }
    acc[setKey].push(pattern);
    return acc;
  }, {});

  // Handle opening edit dialog
  const handleEditPattern = (pattern) => {
    setCurrentPattern({ ...pattern });
    setEditDialogOpen(true);
  };

  // Handle saving pattern level
  const handleSavePattern = async () => {
    if (!currentPattern) return;

    try {
      const { error } = await supabase
        .from('ep_patterns')
        .update({
          level_category: currentPattern.level_category,
          pattern_set_number: currentPattern.pattern_set_number,
          parent_pattern_id: currentPattern.parent_pattern_id,
        })
        .eq('id', currentPattern.id);

      if (error) throw error;

      toast({
        title: 'Pattern Updated',
        description: 'Pattern level category has been updated successfully.',
      });

      setEditDialogOpen(false);
      fetchPatterns();
    } catch (error) {
      toast({
        title: 'Error updating pattern',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Handle adding a custom level
  const handleAddCustomLevel = () => {
    if (!newLevel.trim()) return;
    const normalized = newLevel.trim().toUpperCase();
    if (allLevelCategories.includes(normalized)) {
      toast({
        title: 'Level already exists',
        description: `"${normalized}" is already a level category.`,
        variant: 'destructive',
      });
      return;
    }
    setCustomLevels(prev => [...prev, normalized]);
    setNewLevel('');
    toast({
      title: 'Custom Level Added',
      description: `"${normalized}" has been added to level categories.`,
    });
  };

  // Handle bulk update of pattern set
  const handleBulkUpdateSet = async (setPatterns, levelCategory) => {
    try {
      const ids = setPatterns.map(p => p.id);
      const { error } = await supabase
        .from('ep_patterns')
        .update({ level_category: levelCategory })
        .in('id', ids);

      if (error) throw error;

      toast({
        title: 'Patterns Updated',
        description: `${ids.length} patterns updated to ${levelCategory}.`,
      });

      fetchPatterns();
    } catch (error) {
      toast({
        title: 'Error updating patterns',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin: Pattern Level Management - EquiPatterns</title>
        <meta name="description" content="Manage pattern level categories (ALL, L1, L2, etc.) and pattern sets." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-start justify-between mb-4">
              <AdminBackButton />
              <div className="text-center flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">Pattern Level Management</h1>
                <p className="text-sm text-muted-foreground">
                  Configure pattern level categories (ALL, L1, L2, etc.) and manage pattern sets.
                </p>
              </div>
              <div className="w-[70px]" />
            </div>

            {/* Level Categories Management */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">Level Categories</CardTitle>
                <CardDescription>
                  ALL = Universal (available for all divisions). L1, L2, etc. = Simplified patterns for specific levels.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {allLevelCategories.map(level => (
                    <Badge 
                      key={level} 
                      className={levelCategoryColors[level] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}
                    >
                      {level}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom level (e.g., L4)"
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button onClick={handleAddCustomLevel}>
                    <Plus className="mr-2 h-4 w-4" /> Add Level
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Search and Filter */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="search" className="sr-only">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search patterns..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="w-[200px]">
                    <Select value={filterLevel} onValueChange={setFilterLevel}>
                      <SelectTrigger>
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Filter by level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        {allLevelCategories.map(level => (
                          <SelectItem key={level} value={level}>{level}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patterns Table */}
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedPatterns).length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <p>No patterns found. Pattern levels can be assigned when patterns are created.</p>
                    </CardContent>
                  </Card>
                ) : (
                  Object.entries(groupedPatterns).map(([setName, setPatterns]) => (
                    <Card key={setName}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg">{setName}</CardTitle>
                          <div className="flex gap-2">
                            {allLevelCategories.map(level => (
                              <Button
                                key={level}
                                size="sm"
                                variant="outline"
                                onClick={() => handleBulkUpdateSet(setPatterns, level)}
                              >
                                Set All to {level}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Title</TableHead>
                              <TableHead>Discipline</TableHead>
                              <TableHead>Level Category</TableHead>
                              <TableHead>Set #</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {setPatterns.map(pattern => (
                              <TableRow key={pattern.id}>
                                <TableCell className="font-medium">{pattern.title}</TableCell>
                                <TableCell>{pattern.discipline || '-'}</TableCell>
                                <TableCell>
                                  <Badge className={levelCategoryColors[pattern.level_category] || 'bg-gray-100 text-gray-800'}>
                                    {pattern.level_category || 'ALL'}
                                  </Badge>
                                </TableCell>
                                <TableCell>{pattern.pattern_set_number || '-'}</TableCell>
                                <TableCell>
                                  <Badge variant={pattern.status === 'approved' ? 'default' : 'secondary'}>
                                    {pattern.status || 'draft'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => handleEditPattern(pattern)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {/* Edit Pattern Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pattern Level</DialogTitle>
          </DialogHeader>
          {currentPattern && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Pattern Title</Label>
                <p className="text-muted-foreground">{currentPattern.title}</p>
              </div>

              <div>
                <Label htmlFor="level-category">Level Category</Label>
                <Select 
                  value={currentPattern.level_category || 'ALL'} 
                  onValueChange={(value) => setCurrentPattern(prev => ({ ...prev, level_category: value }))}
                >
                  <SelectTrigger id="level-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allLevelCategories.map(level => (
                      <SelectItem key={level} value={level}>
                        <span className="flex items-center gap-2">
                          {level}
                          <Badge className={`text-xs ${levelCategoryColors[level] || ''}`}>
                            {level === 'ALL' ? 'Universal' : 'Level Specific'}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="set-number">Pattern Set Number</Label>
                <Input
                  id="set-number"
                  type="number"
                  value={currentPattern.pattern_set_number || ''}
                  onChange={(e) => setCurrentPattern(prev => ({ 
                    ...prev, 
                    pattern_set_number: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  placeholder="e.g., 1, 2, 3..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Group related patterns (ALL and L1 versions) with the same set number.
                </p>
              </div>

              <div>
                <Label htmlFor="parent-pattern">Parent Pattern ID (for L1/L2 linking)</Label>
                <Input
                  id="parent-pattern"
                  value={currentPattern.parent_pattern_id || ''}
                  onChange={(e) => setCurrentPattern(prev => ({ ...prev, parent_pattern_id: e.target.value || null }))}
                  placeholder="UUID of parent ALL pattern"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Link this pattern to its parent ALL version for automatic matching.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePattern}>
              <Save className="mr-2 h-4 w-4" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminPatternLevelManagementPage;
