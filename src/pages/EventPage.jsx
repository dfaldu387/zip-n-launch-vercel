import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, Trophy, Clock, ExternalLink } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const EventPage = () => {
  const { id } = useParams();
  const [eventData, setEventData] = useState(null);

  useEffect(() => {
    // Simulate loading event data
    const mockEventData = {
      id: id,
      name: 'Spring Championship Horse Show',
      description: 'Join us for the premier spring horse show featuring multiple disciplines and classes for all skill levels.',
      date: '2024-03-15',
      endDate: '2024-03-17',
      location: 'Wellington Equestrian Center, Wellington, FL',
      organizer: 'Florida Horse Show Association',
      website: 'https://springchampionship.com',
      image: 'Professional horse show arena with multiple rings and spectator seating',
      classes: [
        { name: 'Open Western Pleasure', time: '9:00 AM', ring: 'Ring 1', entries: 24 },
        { name: 'Youth Hunter Under Saddle', time: '10:30 AM', ring: 'Ring 2', entries: 18 },
        { name: 'Amateur Reining', time: '1:00 PM', ring: 'Ring 1', entries: 15 },
        { name: 'Open Trail', time: '2:30 PM', ring: 'Ring 3', entries: 21 },
        { name: 'Youth Western Pleasure', time: '4:00 PM', ring: 'Ring 1', entries: 19 }
      ],
      sponsors: [
        { name: 'Equine Excellence Feed', logo: 'Equine Excellence Feed company logo' },
        { name: 'Wellington Tack Shop', logo: 'Wellington Tack Shop logo with horse equipment' },
        { name: 'Champion Trailers', logo: 'Champion Trailers logo with horse trailer' }
      ],
      totalEntries: 97,
      totalPrizes: '$25,000'
    };
    
    setEventData(mockEventData);
  }, [id]);

  if (!eventData) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-white text-xl">Loading event...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12"
        >
          <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg mb-8 overflow-hidden">
            <img  alt={eventData.image} className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1595872018818-97555653a011" />
          </div>
          
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {eventData.name}
            </h1>
            <p className="text-xl text-white/80 max-w-3xl mx-auto mb-6">
              {eventData.description}
            </p>
            
            <div className="flex flex-wrap justify-center gap-6 text-white/80 mb-8">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                <span>
                  {new Date(eventData.date).toLocaleDateString()} - {new Date(eventData.endDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                <span>{eventData.location}</span>
              </div>
              <div className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                <span>{eventData.totalEntries} Entries</span>
              </div>
              <div className="flex items-center">
                <Trophy className="h-5 w-5 mr-2" />
                <span>{eventData.totalPrizes} in Prizes</span>
              </div>
            </div>

            {eventData.website && (
              <Button 
                asChild
                size="lg"
                className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-semibold"
              >
                <a href={eventData.website} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Visit Event Website
                </a>
              </Button>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Class Schedule */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="glass-effect border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Clock className="h-6 w-6 mr-2" />
                  Class Schedule
                </CardTitle>
                <CardDescription className="text-white/70">
                  Today's competition schedule
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {eventData.classes.map((classItem, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 * index }}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                    >
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">{classItem.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-white/70">
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {classItem.time}
                          </span>
                          <span>{classItem.ring}</span>
                          <span>{classItem.entries} entries</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-white/20 text-white">
                        Active
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Event Info & Sponsors */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Event Information */}
            <Card className="glass-effect border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Event Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-white font-medium mb-2">Organizer</h4>
                  <p className="text-white/80">{eventData.organizer}</p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">Location</h4>
                  <p className="text-white/80">{eventData.location}</p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">Duration</h4>
                  <p className="text-white/80">3 Days</p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">Prize Money</h4>
                  <p className="text-white/80">{eventData.totalPrizes}</p>
                </div>
              </CardContent>
            </Card>

            {/* Sponsors */}
            <Card className="glass-effect border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Event Sponsors</CardTitle>
                <CardDescription className="text-white/70">
                  Thank you to our generous sponsors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {eventData.sponsors.map((sponsor, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
                    <img  alt={sponsor.logo} className="w-12 h-12 rounded" src="https://images.unsplash.com/photo-1701439063562-fae1a60c6ba2" />
                    <span className="text-white font-medium">{sponsor.name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="glass-effect border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/70">Total Classes</span>
                  <span className="text-white font-medium">{eventData.classes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Total Entries</span>
                  <span className="text-white font-medium">{eventData.totalEntries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Prize Money</span>
                  <span className="text-white font-medium">{eventData.totalPrizes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Sponsors</span>
                  <span className="text-white font-medium">{eventData.sponsors.length}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default EventPage;