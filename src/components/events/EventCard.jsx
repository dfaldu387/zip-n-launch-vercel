import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, BookOpen, Globe, Facebook } from 'lucide-react';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Compute event status dynamically from dates.
export const getComputedStatus = (event) => {
  if (!event.start_date || !event.end_date) return 'upcoming';
  const now = new Date();
  const start = startOfDay(new Date(event.start_date));
  const end = endOfDay(new Date(event.end_date));
  if (isBefore(now, start)) return 'upcoming';
  if (isAfter(now, end)) return 'completed';
  return 'ongoing';
};

// Stable hue (0-359) from a string, so each event without a photo gets its own
// consistent colored banner instead of a shared default image.
export const eventHue = (str) => {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
};

export const STATUS_BADGE_CONFIG = {
  upcoming: { label: 'Upcoming', variant: 'secondary', className: 'backdrop-blur-sm bg-black/30 text-white' },
  ongoing: { label: 'Ongoing', variant: 'default', className: 'backdrop-blur-sm bg-green-600/80 text-white' },
  completed: { label: 'Completed', variant: 'outline', className: 'backdrop-blur-sm bg-black/30 text-white' },
};

// Shared event card used on /events and the home page so they stay identical.
export const EventCard = ({ event, onPatternBookClick }) => {
  const computedStatus = getComputedStatus(event);
  const badgeConfig = STATUS_BADGE_CONFIG[computedStatus] || STATUS_BADGE_CONFIG.upcoming;
  const locationDisplay = event.location || 'Location TBD';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card className="bg-secondary border-border hover:border-primary/50 transition-all duration-300 group h-full flex flex-col">
        <CardHeader className="p-0">
          <Link to={`/event-detail/${event.id}`}>
            <div className="aspect-video relative overflow-hidden rounded-t-lg">
              {event.thumbnail_url ? (
                <img
                  alt={event.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  src={event.thumbnail_url}
                />
              ) : (
                /* No photo on file — a distinct colored banner per show, using its
                   saved cover color when present, else a stable color from its name. */
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
              <div className="absolute top-2 right-2">
                <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                  {badgeConfig.label}
                </Badge>
              </div>
            </div>
          </Link>
        </CardHeader>
        <CardContent className="pt-4 flex-grow">
          <Link to={`/event-detail/${event.id}`}>
            <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">{event.name}</CardTitle>
          </Link>
          <div className="text-sm text-muted-foreground mt-2 space-y-2">
            {event.start_date && (
              <div className="flex items-center"><Calendar className="h-4 w-4 mr-2" />{format(new Date(event.start_date), 'MMM d, yyyy')}{event.end_date && ` - ${format(new Date(event.end_date), 'MMM d, yyyy')}`}</div>
            )}
            <div className="flex items-center"><MapPin className="h-4 w-4 mr-2" />{locationDisplay}</div>
            {computedStatus === 'upcoming' && (
              <div className="flex items-center">
                <BookOpen className="h-4 w-4 mr-2" />
                {['published', 'Publication'].includes(event.project?.status) ? (
                  <span
                    className="text-green-600 dark:text-green-400 cursor-pointer hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onPatternBookClick && event.pattern_book_id) {
                        onPatternBookClick(event.pattern_book_id);
                      }
                    }}
                  >
                    Published
                  </span>
                ) : ['approved', 'locked'].includes(event.project?.status) ? (
                  <span className="text-blue-600 dark:text-blue-400">Approved</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Pending</span>
                )}
              </div>
            )}
            {(event.show_website || event.showWebsite) && (
              <div className="flex items-center">
                <Globe className="h-4 w-4 mr-2" />
                <a href={event.show_website || event.showWebsite} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{(event.show_website || event.showWebsite).replace(/^https?:\/\//, '')}</a>
              </div>
            )}
            {(event.show_facebook || event.showFacebook) && (
              <div className="flex items-center">
                <Facebook className="h-4 w-4 mr-2" />
                <a href={event.show_facebook || event.showFacebook} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Facebook Event</a>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-4 flex items-center justify-between">
          <Link to={`/event-detail/${event.id}`} className="flex-1">
            <Button variant="ghost" size="sm">View Details</Button>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default EventCard;
