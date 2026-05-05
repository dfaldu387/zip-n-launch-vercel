import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Video, BookOpen, Calendar, ShieldCheck, Zap, ArrowRight, UploadCloud, Star, CheckCircle, FileText, ImageIcon } from 'lucide-react';
import { format, isAfter, isBefore, startOfDay, endOfDay, isSameMonth, isSameYear } from 'date-fns';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabaseClient';
import { useMediaConfig } from '@/contexts/MediaConfigContext';
import { useSiteBranding } from '@/contexts/SiteBrandingContext';
import { useMarketingContent } from '@/contexts/MarketingContentContext';

const getComputedStatus = (event) => {
  if (!event.start_date || !event.end_date) return 'upcoming';
  const now = new Date();
  const start = startOfDay(new Date(event.start_date));
  const end = endOfDay(new Date(event.end_date));
  if (isBefore(now, start)) return 'upcoming';
  if (isAfter(now, end)) return 'completed';
  return 'ongoing';
};

const formatDateRange = (startStr, endStr) => {
  if (!startStr) return '';
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : null;
  if (!end || startStr === endStr) return format(start, 'MMM d, yyyy');
  if (isSameMonth(start, end) && isSameYear(start, end)) {
    return `${format(start, 'MMM d')}-${format(end, 'd, yyyy')}`;
  }
  if (isSameYear(start, end)) {
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
};

const getAssociationLabel = (associations) => {
  if (!associations) return '';
  if (Array.isArray(associations)) return associations.join(', ');
  if (typeof associations === 'string') return associations;
  return '';
};

const HomePage = () => {
  const [liveShows, setLiveShows] = useState([]);
  const { toast } = useToast();
  const { config: mediaConfig } = useMediaConfig();
  const { branding } = useSiteBranding();
  const { content: marketingContent } = useMarketingContent();

  useEffect(() => {
    const fetchShows = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Failed to load events for home page:', error);
        setLiveShows([]);
        return;
      }

      const visible = (data || [])
        .map((event) => ({ event, status: getComputedStatus(event) }))
        .filter(({ status }) => status === 'ongoing' || status === 'upcoming')
        .sort((a, b) => {
          if (a.status === b.status) return 0;
          return a.status === 'ongoing' ? -1 : 1;
        })
        .slice(0, 3)
        .map(({ event, status }) => ({
          id: event.id,
          name: event.name,
          dates: formatDateRange(event.start_date, event.end_date),
          association: getAssociationLabel(event.associations),
          status: status === 'ongoing' ? 'live' : 'upcoming',
          image_url: event.thumbnail_url || null,
        }));

      setLiveShows(visible);
    };

    fetchShows();
  }, []);
  const handleWatchLive = show => {
    toast({
      title: `Redirecting to ${show.name}`,
      description: "🚧 Live stream feature is not yet implemented."
    });
  };
  const handleOpenBook = show => {
    toast({
      title: `Opening pattern book for ${show.name}`,
      description: "🚧 Live pattern book feature is not yet implemented."
    });
  };
  const backgroundImageUrl = branding?.background_url || mediaConfig.home_page?.url;
  
  return (
    <div 
      style={backgroundImageUrl ? { backgroundImage: `url(${backgroundImageUrl})` } : undefined} 
      className="bg-cover bg-fixed bg-center min-h-screen"
    >
      <Navigation />

      <main className="bg-background/80 backdrop-blur-sm">
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">Professionally curated patterns for every class</h1>
                <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">Create association-compliant pattern books & score sheets</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <Link to="/pattern-book-builder" className="block">
                  <div className="space-y-6">
                    <Badge variant="outline" className="text-primary border-primary">Management & Judges</Badge>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Pattern Book Builder</h2>
                    <p className="text-lg text-muted-foreground">Stop Formatting. Start Showing. Generate a pattern book in minutes.</p>
                    <ul className="space-y-4">
                        <li className="flex items-start gap-3"><ShieldCheck className="h-6 w-6 text-primary flex-shrink-0 mt-1" /><span className="text-muted-foreground">Automated pattern generation</span></li>
                        <li className="flex items-start gap-3"><Zap className="h-6 w-6 text-primary flex-shrink-0 mt-1" /><span className="text-muted-foreground">Build better shows, faster</span></li>
                        <li className="flex items-start gap-3"><FileText className="h-6 w-6 text-primary flex-shrink-0 mt-1" /><span className="text-muted-foreground">Score sheets populated</span></li>
                    </ul>
                    <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                        <Link to="/pattern-book-builder">Pattern Book Builder <ArrowRight className="ml-2 h-5 w-5" /></Link>
                    </Button>
                  </div>
                </Link>
                <div className="space-y-6">
                <Badge variant="outline" className="text-primary border-primary">For Designers</Badge>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Earn Creator Benefits & Share Your Expertise</h2>
                <p className="text-lg text-muted-foreground">License your patterns now and earn valuable rewards.</p>
                <ul className="space-y-4">
                    <li className="flex items-start gap-3"><UploadCloud className="h-6 w-6 text-primary flex-shrink-0 mt-1" /><span className="text-muted-foreground">Upload original patterns and earn platform credits.</span></li>
                    <li className="flex items-start gap-3"><Star className="h-6 w-6 text-primary flex-shrink-0 mt-1" /><span className="text-muted-foreground">Earn exclusive perks as a valued creator.</span></li>
                    <li className="flex items-start gap-3"><CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" /><span className="text-muted-foreground">Reach thousands of show organizers and riders.</span></li>
                </ul>
                <p className="text-sm text-muted-foreground">EquiPatterns reserves the <em>right</em> to review, approve, reject, or remove submissions at its discretion.</p>
                <Button asChild size="lg" variant="default">
                    <Link to="/contributor-portal">License Your Patterns <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                </div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/80">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Trusted by the Best in the Sport
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
              Top riders, organizers, and judges rely on EquiPatterns for their events.
            </p>
          </div>
        </section>

        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                Live & Upcoming Shows
              </h2>
              <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                Watch live events and access pattern books in real-time.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {liveShows.map((show, index) => <motion.div key={show.id} initial={{
              opacity: 0,
              y: 20
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.5,
              delay: index * 0.1
            }}>
                  <Card className="bg-card/90 border-border hover:border-primary/50 transition-all duration-300 flex flex-col h-full">
                    <CardHeader>
                      <div className="aspect-video relative mb-4 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                        {show.image_url ? (
                          <img
                            src={show.image_url}
                            alt={show.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-10 w-10 text-muted-foreground/60" />
                        )}
                        <Badge className={`absolute top-2 right-2 ${show.status === 'live' ? 'bg-red-600 text-white' : 'bg-primary/80 text-primary-foreground'}`}>
                          {show.status.toUpperCase()}
                        </Badge>
                      </div>
                      <CardTitle className="text-foreground">{show.name}</CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        <span>{show.association}</span>
                        <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {show.dates}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="mt-auto flex gap-2">
                      <Button onClick={() => handleWatchLive(show)} className="w-full bg-primary/20 text-primary hover:bg-primary/30">
                        <Video className="mr-2 h-4 w-4" /> Watch Live
                      </Button>
                      <Button onClick={() => handleOpenBook(show)} variant="outline" className="w-full">
                        <BookOpen className="mr-2 h-4 w-4" /> Pattern Book
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>)}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/80">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
              Advertise with EquiPatterns
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
              Reach riders, trainers, and fans — in the arena and online.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((num) => {
                const ad = marketingContent.ads.find(a => a.slot === `ad_${num}` && a.is_active);
                if (!ad) {
                  return (
                    <div key={num} className="h-40 bg-muted/50 border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                      Ad Placement {num}
                    </div>
                  );
                }
                const card = (
                  <div className="rounded-lg overflow-hidden border border-border bg-background">
                    {ad.image_url ? (
                      <div className="h-40">
                        <img src={ad.image_url} alt={ad.title || `Ad ${num}`} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-40 flex flex-col items-center justify-center bg-muted/50 p-4 text-center">
                        <p className="font-semibold text-foreground">{ad.title}</p>
                      </div>
                    )}
                    {(ad.title || ad.description) && (
                      <div className="px-3 py-2 text-center">
                        {ad.title && <p className="font-semibold text-sm text-foreground">{ad.title}</p>}
                        {ad.description && <p className="text-xs text-muted-foreground mt-0.5">{ad.description}</p>}
                      </div>
                    )}
                  </div>
                );
                return (
                  <div key={num}>
                    {ad.link_url ? (
                      <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="block hover:shadow-lg transition-shadow duration-200">
                        {card}
                      </a>
                    ) : card}
                  </div>
                );
              })}
            </div>

            {marketingContent.announcements.filter(a => a.is_active).length > 0 && (
              <div className="mt-8 space-y-3">
                {marketingContent.announcements.filter(a => a.is_active).map(ann => (
                  <div key={ann.id} className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                    <p className="font-semibold text-foreground">{ann.title}</p>
                    {ann.description && <p className="text-sm text-muted-foreground mt-1">{ann.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default HomePage;