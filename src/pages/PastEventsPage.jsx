import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Award, Search } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PastEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const sampleEvents = [
      { id: 1, name: 'Summer Classic 2024', date: '2024-07-15', location: 'Lexington, KY', association: 'AQHA', image: 'Horse show arena with summer lighting and a crowd watching' },
      { id: 2, name: 'Autumn Gold Futurity', date: '2024-10-02', location: 'Fort Worth, TX', association: 'NRHA', image: 'Indoor arena during an autumn reining competition' },
      { id: 3, name: 'Winter Equestrian Festival Week 5', date: '2025-02-08', location: 'Wellington, FL', association: 'USEF', image: 'Large equestrian festival grounds in winter' },
      { id: 4, name: 'APHA World Show', date: '2024-09-20', location: 'Tulsa, OK', association: 'APHA', image: 'APHA World Show arena with colorful paint horses' },
    ];
    setEvents(sampleEvents);
  }, []);

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.association.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Past Events Archive</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Relive the excitement. Explore results, photos, and pattern books from our featured past events.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="glass-effect rounded-lg p-4 mb-8 border border-border max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input placeholder="Search events, locations, or associations..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-10" />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEvents.map((event, index) => (
            <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 * index }} className="flex">
              <Card className="bg-secondary border-border hover:border-primary/50 transition-all duration-300 group h-full flex flex-col">
                <CardHeader className="p-0">
                  <div className="aspect-video relative overflow-hidden rounded-t-lg">
                    <img  alt={event.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="https://images.unsplash.com/photo-1593463043671-8ba6cd12b829" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-4 left-4">
                       <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">{event.association}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow pt-6">
                  <CardTitle className="text-foreground group-hover:text-primary transition-colors text-xl font-bold">{event.name}</CardTitle>
                  <div className="flex items-center text-muted-foreground text-sm mt-2 gap-4">
                    <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {new Date(event.date).toLocaleDateString()}</div>
                    <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {event.location}</div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link to={`/event-detail/${event.id}`}>View Details</Link>
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

export default PastEventsPage;