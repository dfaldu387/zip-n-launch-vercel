import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Award, BookOpen, Search } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const ContributorsPage = () => {
  const [contributors, setContributors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const sampleContributors = [
      { id: 1, name: 'Sarah Johnson', bio: 'AQHA Professional Horseman with 20+ years of experience in Western Pleasure and Horsemanship.', specialties: ['Western Pleasure', 'Horsemanship'], rating: 4.9, patterns: 15, image: 'Portrait of Sarah Johnson, a professional horse trainer' },
      { id: 2, name: 'Mike Rodriguez', bio: 'NRHA Million Dollar Rider specializing in high-performance reining patterns for all levels.', specialties: ['Reining', 'Ranch Riding'], rating: 4.8, patterns: 22, image: 'Portrait of Mike Rodriguez, a reining horse specialist' },
      { id: 3, name: 'Emma Thompson', bio: 'USEF "R" Judge and Hunter/Jumper trainer focused on creating flowing, effective courses.', specialties: ['Hunter Under Saddle', 'Equitation'], rating: 4.9, patterns: 18, image: 'Portrait of Emma Thompson, a hunter/jumper trainer' },
      { id: 4, name: 'David Wilson', bio: 'Versatile trainer with a passion for creating challenging and educational trail patterns.', specialties: ['Trail', 'Versatility'], rating: 4.7, patterns: 12, image: 'Portrait of David Wilson, a trail pattern designer' },
      { id: 5, name: 'Jessica Chen', bio: 'FEI Dressage competitor and trainer, bringing elegance and precision to every pattern.', specialties: ['Dressage', 'Freestyle'], rating: 5.0, patterns: 9, image: 'Portrait of Jessica Chen, a dressage competitor' },
      { id: 6, name: 'Brian O\'Connell', bio: 'Specializing in patterns for young horses and amateur riders, focusing on confidence building.', specialties: ['Youth Classes', 'Amateur'], rating: 4.8, patterns: 25, image: 'Portrait of Brian O\'Connell, a youth horse trainer' },
    ];
    setContributors(sampleContributors);
  }, []);

  const filteredContributors = contributors.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Meet Our Designers</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            A community of professional trainers, judges, and riders dedicated to creating the highest quality horse show patterns.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="glass-effect rounded-lg p-4 mb-8 border border-border max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input placeholder="Search designers or specialties..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-10" />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredContributors.map((contributor, index) => (
            <motion.div key={contributor.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 * index }} className="flex">
              <Card className="bg-secondary border-border hover:border-primary/50 transition-all duration-300 group h-full flex flex-col text-center">
                <CardHeader className="items-center pb-4">
                  <div className="relative w-32 h-32 mb-4">
                    <img  className="rounded-full w-full h-full object-cover border-4 border-secondary group-hover:border-primary transition-colors" alt={contributor.image} src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee" />
                  </div>
                  <CardTitle className="text-foreground group-hover:text-primary transition-colors text-xl font-bold">{contributor.name}</CardTitle>
                  <div className="flex items-center space-x-1 text-primary">
                    <Star className="h-5 w-5 fill-current" />
                    <span className="text-sm font-semibold">{contributor.rating}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription>{contributor.bio}</CardDescription>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {contributor.specialties.map(spec => <Badge key={spec} variant="outline">{spec}</Badge>)}
                  </div>
                </CardContent>
                <CardFooter className="flex-col items-center pt-4 space-y-4">
                  <div className="flex justify-around w-full text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {contributor.patterns} Patterns</div>
                    <div className="flex items-center gap-1.5"><Award className="h-4 w-4" /> Pro Designer</div>
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/patterns">View Patterns</Link>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContributorsPage;