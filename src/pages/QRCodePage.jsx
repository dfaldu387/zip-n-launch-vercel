import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, ExternalLink, Calendar, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const QRCodePage = () => {
  const { code } = useParams();
  const [eventData, setEventData] = useState(null);
  const [showPreRoll, setShowPreRoll] = useState(true);
  const [preRollCountdown, setPreRollCountdown] = useState(3);

  useEffect(() => {
    // Simulate loading event data based on QR code
    const mockEventData = {
      eventName: 'Spring Championship Horse Show',
      classTitle: 'Open Western Pleasure',
      date: '2024-03-15',
      location: 'Wellington, FL',
      eventLink: 'https://springchampionship.com',
      sponsorName: 'Equine Excellence Feed',
      sponsorLink: 'https://equineexcellence.com',
      sponsorLogo: 'Equine Excellence Feed company logo with horse silhouette',
      eventLogo: 'Spring Championship Horse Show official logo with trophy'
    };
    
    setEventData(mockEventData);

    // Pre-roll countdown
    if (showPreRoll) {
      const interval = setInterval(() => {
        setPreRollCountdown(prev => {
          if (prev <= 1) {
            setShowPreRoll(false);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [showPreRoll]);

  if (!eventData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading event...</div>
      </div>
    );
  }

  if (showPreRoll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mb-8">
            <img  alt={eventData.sponsorLogo} className="w-32 h-32 mx-auto mb-4 rounded-lg" src="https://images.unsplash.com/photo-1673249556301-bffb6cf2ab4f" />
            <h1 className="text-4xl font-bold text-white mb-2">{eventData.sponsorName}</h1>
            <p className="text-xl text-white/80">Proud Sponsor of Equestrian Excellence</p>
          </div>
          
          <div className="text-6xl font-bold text-white mb-4">{preRollCountdown}</div>
          <p className="text-white/80">Redirecting to event page...</p>
          
          <motion.div
            className="w-64 h-2 bg-white/20 rounded-full mx-auto mt-8 overflow-hidden"
            initial={{ width: 0 }}
            animate={{ width: 256 }}
            transition={{ duration: 3 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 3 }}
            />
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="mb-6">
            <img  alt={eventData.eventLogo} className="w-24 h-24 mx-auto mb-4 rounded-lg" src="https://images.unsplash.com/photo-1695480497603-381a2bee1c05" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {eventData.eventName}
          </h1>
          <h2 className="text-2xl text-yellow-400 mb-6">
            {eventData.classTitle}
          </h2>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 text-white/80">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              <span>{new Date(eventData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div className="flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              <span>{eventData.location}</span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Event Information */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <Card className="glass-effect border-white/20 h-full">
              <CardHeader>
                <CardTitle className="text-white">Event Details</CardTitle>
                <CardDescription className="text-white/70">
                  Everything you need to know about this class
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-white font-medium mb-2">Class Information</h3>
                    <div className="bg-white/5 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-white/70">Class:</span>
                        <span className="text-white">{eventData.classTitle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Date:</span>
                        <span className="text-white">{new Date(eventData.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Location:</span>
                        <span className="text-white">{eventData.location}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white font-medium mb-2">Pattern Information</h3>
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="text-white/80 text-sm">
                        This QR code provides access to the official pattern for this class. 
                        The pattern has been customized specifically for this event and includes 
                        all necessary details for competitors and judges.
                      </p>
                    </div>
                  </div>
                </div>

                {eventData.eventLink && (
                  <Button 
                    asChild
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-semibold"
                  >
                    <a href={eventData.eventLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Event Website
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Sponsor Information */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <Card className="glass-effect border-white/20 h-full">
              <CardHeader>
                <CardTitle className="text-white">Event Sponsor</CardTitle>
                <CardDescription className="text-white/70">
                  Proudly sponsored by
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <img  alt={eventData.sponsorLogo} className="w-32 h-32 mx-auto mb-4 rounded-lg" src="https://images.unsplash.com/photo-1673249556301-bffb6cf2ab4f" />
                  <h3 className="text-2xl font-bold text-white mb-2">{eventData.sponsorName}</h3>
                  <p className="text-white/80 mb-6">
                    Thank you to our generous sponsor for making this event possible. 
                    Their support helps us continue to provide excellent equestrian competitions.
                  </p>
                </div>

                {eventData.sponsorLink && (
                  <Button 
                    asChild
                    variant="outline"
                    className="w-full border-white/20 text-white hover:bg-white/10"
                  >
                    <a href={eventData.sponsorLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Sponsor Website
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Pattern Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-8"
        >
          <Card className="glass-effect border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Pattern Preview</CardTitle>
              <CardDescription className="text-white/70">
                Official pattern for this class
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center pattern-grid">
                <div className="text-center">
                  <Play className="h-16 w-16 text-white/60 mx-auto mb-4" />
                  <p className="text-white/80 text-lg">Pattern Diagram</p>
                  <p className="text-white/60">Customized for {eventData.eventName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default QRCodePage;