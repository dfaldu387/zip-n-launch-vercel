import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Search, Loader2 } from 'lucide-react';
import { format, isAfter, endOfDay } from 'date-fns';
import Navigation from '@/components/Navigation';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';

// Pick a cover photo from whatever the organizer already uploaded (matches EventsPage).
const IMG_RE = /\.(jpe?g|png|webp|gif|jfif|avif)(\?|$)/i;
const deriveCoverUrl = (pd = {}) => {
  if (pd.coverImageUrl) return pd.coverImageUrl;
  const fromLogos = (pd.showLogos || []).find(l => l?.url && IMG_RE.test(l.url));
  if (fromLogos) return fromLogos.url;
  const fromMarketing = (pd.generalMarketing || []).find(f => (f?.fileUrl && IMG_RE.test(f.fileUrl)) || (f?.fileName && IMG_RE.test(f.fileName)));
  if (fromMarketing) return fromMarketing.fileUrl;
  if (pd.showLogoUrl && IMG_RE.test(pd.showLogoUrl)) return pd.showLogoUrl;
  return null;
};

// Stable color for cards without a photo.
const eventHue = (str) => {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
};

const isCompleted = (endDate) => !!endDate && isAfter(new Date(), endOfDay(new Date(endDate)));

const PastEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);

      // 1) Manually-created events from the events table.
      const { data: eventsData } = await supabase.from('events').select('*');
      const fromEvents = (eventsData || []).map(e => ({
        id: e.id,
        name: e.name,
        start_date: e.start_date,
        end_date: e.end_date,
        location: e.location || '',
        association: Array.isArray(e.associations) ? e.associations.join(', ') : '',
        thumbnail_url: e.thumbnail_url || null,
        coverColor: null,
      }));

      // 2) Published shows & pattern books (same source as /events).
      const { data: projData } = await supabase
        .from('projects')
        .select('id, project_name, project_type, project_data, status')
        .in('project_type', ['show', 'pattern_book']);
      const fromProjects = (projData || [])
        .filter(p => {
          const pd = p.project_data || {};
          const housing = pd.moduleStatuses?.housing === 'published';
          const pattern = ['Final', 'Publication', 'published'].includes(p.status) || pd.moduleStatuses?.patternBook === 'published';
          if (!housing && !pattern) return false;
          const general = pd.showDetails?.general || {};
          return !!(general.startDate || pd.startDate) && !!(general.endDate || pd.endDate);
        })
        .map(p => {
          const pd = p.project_data || {};
          const general = pd.showDetails?.general || {};
          const venue = pd.showDetails?.venue || {};
          return {
            id: p.id,
            name: p.project_name || general.showName || 'Untitled',
            start_date: general.startDate || pd.startDate,
            end_date: general.endDate || pd.endDate,
            location: venue.facilityName || venue.address || pd.venueName || pd.venueAddress || '',
            association: pd.associations ? Object.keys(pd.associations).filter(k => pd.associations[k]).join(', ') : '',
            thumbnail_url: deriveCoverUrl(pd),
            coverColor: pd.coverColor || null,
          };
        });

      // Merge, dedupe by id, keep only events whose end date has passed.
      const eventIds = new Set(fromEvents.map(e => e.id));
      const merged = [...fromEvents, ...fromProjects.filter(p => !eventIds.has(p.id))];
      const completed = merged
        .filter(e => isCompleted(e.end_date))
        .sort((a, b) => new Date(b.end_date) - new Date(a.end_date));

      setEvents(completed);
      setIsLoading(false);
    };
    load();
  }, []);

  const filteredEvents = events.filter(event =>
    (event.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.association || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Past Events Archive</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Relive the excitement. Explore results, photos, and pattern books from past events.
          </p>
          <Link to="/events" className="inline-block mt-3 text-sm text-primary hover:underline">← Back to current events</Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="glass-effect rounded-lg p-4 mb-8 border border-border max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input placeholder="Search events, locations, or associations..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-10" />
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : filteredEvents.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">No past events yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((event, index) => (
              <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 * index }} className="flex">
                <Card className="bg-secondary border-border hover:border-primary/50 transition-all duration-300 group h-full flex flex-col">
                  <CardHeader className="p-0">
                    <Link to={`/event-detail/${event.id}`}>
                      <div className="aspect-video relative overflow-hidden rounded-t-lg">
                        {event.thumbnail_url ? (
                          <img alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src={event.thumbnail_url} />
                        ) : (
                          <div
                            className="w-full h-full flex flex-col items-center justify-center px-4 text-center text-white transition-transform duration-300 group-hover:scale-105"
                            style={event.coverColor
                              ? { background: `linear-gradient(135deg, ${event.coverColor}, rgba(0,0,0,0.35))` }
                              : { background: `linear-gradient(135deg, hsl(${eventHue(event.name)} 62% 45%), hsl(${(eventHue(event.name) + 40) % 360} 68% 32%))` }}
                          >
                            <span className="text-4xl mb-1" aria-hidden="true">🐎</span>
                            <span className="font-semibold text-sm line-clamp-2 drop-shadow">{event.name}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute top-2 right-2">
                          <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">Completed</Badge>
                        </div>
                        {event.association && (
                          <div className="absolute bottom-3 left-3">
                            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">{event.association}</Badge>
                          </div>
                        )}
                      </div>
                    </Link>
                  </CardHeader>
                  <CardContent className="flex-grow pt-6">
                    <Link to={`/event-detail/${event.id}`}>
                      <CardTitle className="text-foreground group-hover:text-primary transition-colors text-xl font-bold">{event.name}</CardTitle>
                    </Link>
                    <div className="flex items-center text-muted-foreground text-sm mt-2 gap-4 flex-wrap">
                      {event.start_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(event.start_date), 'MMM d, yyyy')}
                          {event.end_date && ` - ${format(new Date(event.end_date), 'MMM d, yyyy')}`}
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {event.location}</div>
                      )}
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
        )}
      </div>
    </div>
  );
};

export default PastEventsPage;
