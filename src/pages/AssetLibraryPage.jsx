import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Upload, Image as ImageIcon, BookOpen, Layers, Shield, File, Loader2, ServerCrash, Lightbulb, Search, Folder, ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { addLogoToAssociations, getAssociationLogo, getDefaultAssociationIcon } from '@/lib/associationsData';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"


const AssetLibraryPage = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [disciplines, setDisciplines] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [currentView, setCurrentView] = useState('main'); // 'main', 'association', 'discipline'
  const [selectedAssociation, setSelectedAssociation] = useState(null);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch associations
      const { data: associationsData, error: associationsError } = await supabase
        .from('associations')
        .select('*')
        .order('name');

      if (associationsError) throw associationsError;

      // Fetch disciplines
      const { data: disciplinesData, error: disciplinesError } = await supabase
        .from('disciplines')
        .select('*')
        .order('name');

      if (disciplinesError) throw disciplinesError;

      // Fetch custom pattern counts
      const { data: customPatternsData, error: customPatternsError } = await supabase
        .from('patterns')
        .select('class_name')
        .eq('is_custom', true);

      if (customPatternsError) throw customPatternsError;

      // Count patterns by class
      const patternCounts = customPatternsData.reduce((acc, pattern) => {
        acc[pattern.class_name] = (acc[pattern.class_name] || 0) + 1;
        return acc;
      }, {});

      // Add pattern counts to disciplines
      const disciplinesWithCounts = disciplinesData.map(discipline => ({
        ...discipline,
        customPatternCount: patternCounts[discipline.name] || 0
      }));
      setAssociations(addLogoToAssociations(associationsData));
      setDisciplines(disciplinesWithCounts);
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
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const filteredAssociations = useMemo(() => {
    if (!searchTerm) return associations;
    return associations.filter(assoc =>
      assoc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assoc.abbreviation?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [associations, searchTerm]);

  const filteredDisciplines = useMemo(() => {
    if (!searchTerm) return disciplines;
    return disciplines.filter(discipline =>
      discipline.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      discipline.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [disciplines, searchTerm]);

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Asset Library - EquiPatterns</title>
          <meta name="description" content="Comprehensive library of horse show assets including patterns, score sheets, and verbiage." />
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
          <title>Asset Library - EquiPatterns</title>
          <meta name="description" content="Comprehensive library of horse show assets including patterns, score sheets, and verbiage." />
        </Helmet>
        <div className="min-h-screen bg-background">
          <Navigation />
          <main className="container mx-auto px-4 py-12">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ServerCrash className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Failed to Load Asset Library</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchInitialData}>Try Again</Button>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Asset Library - EquiPatterns</title>
        <meta name="description" content="Comprehensive library of horse show assets including patterns, score sheets, and verbiage." />
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
            <div className="mb-6 flex items-center justify-between gap-4">
              <AdminBackButton />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/admin"><Home className="h-4 w-4" /></Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Asset Library</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Asset Library</h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Comprehensive library of horse show assets including patterns, score sheets, and verbiage organized by associations and disciplines.
              </p>
            </div>

            {/* Search */}
            <div className="max-w-md mx-auto mb-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search associations or disciplines..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Association Assets */}
              <div>
                <div className="flex items-center mb-6">
                  <Shield className="h-6 w-6 text-primary mr-2" />
                  <h2 className="text-2xl font-bold">Association Assets</h2>
                </div>
                <div className="space-y-4">
                  {filteredAssociations.map((association, index) => {
                    const logoUrl = getAssociationLogo(association);
                    const DefaultIcon = getDefaultAssociationIcon(association);
                    
                    return (
                      <motion.div
                        key={association.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <Link to={`/admin/asset-library/association/${association.id}`}>
                          <Card className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer group">
                            <CardContent className="p-6">
                              <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                  {logoUrl ? (
                                    <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden">
                                      <img 
                                        src={logoUrl} 
                                        alt={association.name} 
                                        className="h-12 w-12 object-contain"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.nextSibling.style.display = 'flex';
                                        }}
                                      />
                                      <div className="h-12 w-12 bg-primary/10 rounded-lg items-center justify-center" style={{ display: 'none' }}>
                                        <DefaultIcon className="h-6 w-6 text-primary" />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                      <DefaultIcon className="h-6 w-6 text-primary" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                                    {association.name}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {association.abbreviation && `${association.abbreviation} • `}
                                    Official patterns, score sheets & verbiage
                                  </p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Pattern Library */}
              <div>
                <div className="flex items-center mb-6">
                  <BookOpen className="h-6 w-6 text-primary mr-2" />
                  <h2 className="text-2xl font-bold">Custom Pattern Library</h2>
                </div>
                <div className="space-y-4">
                  {filteredDisciplines.map((discipline, index) => (
                    <motion.div
                      key={discipline.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Link to={`/admin/custom-pattern-set/${discipline.name}`}>
                        <Card className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer group">
                          <CardContent className="p-6">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                <div className="h-12 w-12 bg-secondary rounded-lg flex items-center justify-center">
                                  <Folder className="h-6 w-6 text-primary" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                                  {discipline.name}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {discipline.category && `${discipline.category} • `}
                                  {discipline.customPatternCount} custom pattern{discipline.customPatternCount !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Help Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-16"
            >
              <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-6 w-6 text-primary" />
                    Asset Management Guide
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Association Assets:</strong> Official patterns, score sheets, and verbiage from recognized associations</p>
                      <p><strong>Custom Patterns:</strong> User-submitted patterns organized by discipline</p>
                    </div>
                    <div>
                      <p><strong>Upload Assets:</strong> Click on any association to upload new official assets</p>
                      <p><strong>Delete Content:</strong> Use the delete buttons within each asset category to remove unwanted files</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </>
  );
};

export default AssetLibraryPage;