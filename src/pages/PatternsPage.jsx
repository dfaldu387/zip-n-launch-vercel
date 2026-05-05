import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Star, FileText, CheckCircle, XCircle, Shield, Palette, Book, Tag, User, Calendar, ChevronsUpDown } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PatternsPage = () => {
  const [patterns, setPatterns] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    association: 'all',
    level: 'all',
    designer: 'all',
  });
  const [sort, setSort] = useState('newest');
  const { toast } = useToast();

  useEffect(() => {
    const savedPatterns = localStorage.getItem('equiPatterns');
    if (savedPatterns) {
      setPatterns(JSON.parse(savedPatterns));
    } else {
      const samplePatterns = [
        { id: 1, title: 'Western Pleasure Pattern #1', description: 'Classic western pleasure pattern with smooth transitions.', category: 'Western Pleasure', difficulty: 'Beginner', price: 15.99, rating: 4.8, downloads: 234, contributor: 'Sarah Johnson', image: 'Western pleasure pattern with horse and rider performing smooth gaits', tags: ['western', 'pleasure', 'beginner'], association: 'AQHA', available: true, branding: ['Light', 'Dark'], dateAdded: '2025-08-10' },
        { id: 2, title: 'Reining Pattern Advanced', description: 'Complex reining pattern with sharp spins and sliding stops.', category: 'Reining', difficulty: 'Advanced', price: 24.99, rating: 4.9, downloads: 156, contributor: 'Mike Rodriguez', image: 'Advanced reining pattern showing spins and sliding stops', tags: ['reining', 'advanced', 'spins'], association: 'NRHA', available: false, branding: ['Light', 'Dark', 'Custom'], dateAdded: '2025-08-01' },
        { id: 3, title: 'Hunter Under Saddle Flow', description: 'An elegant hunter pattern for smooth movement.', category: 'Hunter', difficulty: 'Intermediate', price: 18.99, rating: 4.7, downloads: 189, contributor: 'Emma Thompson', image: 'Hunter under saddle pattern with elegant movement flow', tags: ['hunter', 'intermediate', 'flow'], association: 'USEF', available: true, branding: ['Light', 'Dark'], dateAdded: '2025-07-25' },
        { id: 4, title: 'Trail Class Challenge', description: 'A comprehensive and engaging trail pattern with obstacles.', category: 'Trail', difficulty: 'Intermediate', price: 21.99, rating: 4.6, downloads: 167, contributor: 'David Wilson', image: 'Trail class pattern featuring various obstacles and challenges', tags: ['trail', 'obstacles', 'intermediate'], association: 'AQHA', available: true, branding: ['Light', 'Dark', 'Custom'], dateAdded: '2025-08-05' }
      ];
      setPatterns(samplePatterns);
      localStorage.setItem('equiPatterns', JSON.stringify(samplePatterns));
    }
  }, []);

  const designers = useMemo(() => ['all', ...new Set(patterns.map(p => p.contributor))], [patterns]);
  const associations = useMemo(() => ['all', ...new Set(patterns.map(p => p.association))], [patterns]);
  const levels = ['all', 'Beginner', 'Intermediate', 'Advanced'];

  const filteredAndSortedPatterns = useMemo(() => {
    return patterns
      .filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || p.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesAssociation = filters.association === 'all' || p.association === filters.association;
        const matchesLevel = filters.level === 'all' || p.difficulty === filters.level;
        const matchesDesigner = filters.designer === 'all' || p.contributor === filters.designer;
        return matchesSearch && matchesAssociation && matchesLevel && matchesDesigner;
      })
      .sort((a, b) => {
        switch (sort) {
          case 'rating': return b.rating - a.rating;
          case 'used': return b.downloads - a.downloads;
          case 'price_asc': return a.price - b.price;
          case 'price_desc': return b.price - a.price;
          case 'newest':
          default:
            return new Date(b.dateAdded) - new Date(a.dateAdded);
        }
      });
  }, [patterns, searchTerm, filters, sort]);

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Patterns Archive</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover professional, association-approved patterns. Ready to customize for your next show.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="glass-effect rounded-lg p-4 mb-8 border border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input placeholder="Search patterns or tags..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-10" />
            </div>
            <Select value={filters.association} onValueChange={(value) => handleFilterChange('association', value)}>
              <SelectTrigger><Shield className="h-4 w-4 mr-2" /> <SelectValue placeholder="Association" /></SelectTrigger>
              <SelectContent>{associations.map(a => <SelectItem key={a} value={a}>{a === 'all' ? 'All Associations' : a}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.level} onValueChange={(value) => handleFilterChange('level', value)}>
              <SelectTrigger><ChevronsUpDown className="h-4 w-4 mr-2" /> <SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>{levels.map(l => <SelectItem key={l} value={l}>{l === 'all' ? 'All Levels' : l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger><ChevronsUpDown className="h-4 w-4 mr-2" /> <SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="used">Most Used</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredAndSortedPatterns.map((pattern, index) => (
            <motion.div key={pattern.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 * index }} className="flex">
              <Card className="bg-secondary border-border hover:border-primary/50 transition-all duration-300 group h-full flex flex-col">
                <CardHeader className="pb-4">
                  <div className="aspect-video bg-background rounded-lg mb-4 flex items-center justify-center pattern-grid overflow-hidden relative">
                    <img alt={pattern.image} className="w-full h-full object-cover rounded-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300" src="https://images.unsplash.com/photo-1647505166452-3e2d7d55b210" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-foreground/70 font-bold text-lg">WATERMARK</div>
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-foreground group-hover:text-primary transition-colors text-lg font-bold">{pattern.title}</CardTitle>
                    <div className="flex items-center space-x-1 text-primary shrink-0 ml-2">
                      <Star className="h-5 w-5 fill-current" />
                      <span className="text-sm font-semibold">{pattern.rating}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{pattern.association}</Badge>
                    <Badge variant="outline">{pattern.difficulty}</Badge>
                    <Badge variant="outline">{pattern.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription>{pattern.description}</CardDescription>
                  <div className={`mt-3 text-sm flex items-center ${pattern.available ? 'text-green-400' : 'text-red-400'}`}>
                    {pattern.available ? <CheckCircle className="h-4 w-4 mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />}
                    {pattern.available ? 'Eligible today in your area' : 'Unavailable due to recent use nearby'}
                  </div>
                </CardContent>
                <CardFooter className="flex-col items-start pt-4">
                  <div className="flex justify-between items-center w-full mb-4">
                    <div className="text-2xl font-bold text-foreground">${pattern.price}</div>
                    <div className="text-right text-xs text-muted-foreground">by {pattern.contributor}</div>
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      <Link to={`/customize/${pattern.id}`}>Customize Pattern</Link>
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => toast({ title: "🚧 Feature not implemented" })}>
                        <Book className="h-4 w-4 mr-1" /> Add to Book
                      </Button>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => toast({ title: "🚧 Feature not implemented" })}>
                        <FileText className="h-4 w-4 mr-1" /> Score Sheet
                      </Button>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredAndSortedPatterns.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="text-muted-foreground text-2xl font-semibold">No patterns found.</div>
            <p className="text-muted-foreground/80 mt-2">Try adjusting your search or filters.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PatternsPage;