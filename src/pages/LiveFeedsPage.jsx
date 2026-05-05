import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize, Search, BookOpen } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const LiveFeedsPage = () => {
  const [liveShows, setLiveShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load live shows from localStorage or initialize with sample data
    const savedShows = localStorage.getItem('liveShows');
    if (savedShows) {
      setLiveShows(JSON.parse(savedShows));
    } else {
      const sampleShows = [
        {
          id: 1,
          title: 'Spring Championship Horse Show',
          location: 'Wellington, FL',
          status: 'live',
          viewers: 1247,
          currentClass: 'Open Western Pleasure',
          patterns: [
            { id: 1, name: 'Western Pleasure Pattern A', active: true },
            { id: 2, name: 'Western Pleasure Pattern B', active: false },
            { id: 3, name: 'Reining Pattern 1', active: false }
          ],
          streamUrl: 'https://example.com/stream1',
          thumbnail: 'Live horse show arena with western pleasure competition'
        },
        {
          id: 2,
          title: 'Youth Regional Championships',
          location: 'Lexington, KY',
          status: 'live',
          viewers: 892,
          currentClass: 'Youth Hunter Under Saddle',
          patterns: [
            { id: 4, name: 'Hunter Pattern 1', active: true },
            { id: 5, name: 'Hunter Pattern 2', active: false }
          ],
          streamUrl: 'https://example.com/stream2',
          thumbnail: 'Youth horse show with hunter under saddle competition'
        },
        {
          id: 3,
          title: 'Ranch Horse Versatility Show',
          location: 'Fort Worth, TX',
          status: 'upcoming',
          viewers: 0,
          currentClass: 'Starting in 2 hours',
          patterns: [
            { id: 6, name: 'Ranch Riding Pattern', active: false },
            { id: 7, name: 'Ranch Trail Pattern', active: false }
          ],
          streamUrl: 'https://example.com/stream3',
          thumbnail: 'Ranch horse versatility show arena setup'
        }
      ];
      setLiveShows(sampleShows);
      localStorage.setItem('liveShows', JSON.stringify(sampleShows));
    }
  }, []);

  const filteredShows = liveShows.filter(show =>
    show.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    show.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    show.currentClass.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectShow = (show) => {
    setSelectedShow(show);
    toast({
      title: "🚧 Live stream playback isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
      description: `Selected: ${show.title}`,
    });
  };

  const handlePatternSelect = (pattern) => {
    toast({
      title: "🚧 Pattern viewing isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
      description: `Pattern: ${pattern.name}`,
    });
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    toast({
      title: "🚧 Video controls aren't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
      description: isPlaying ? "Pausing stream" : "Playing stream",
    });
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    toast({
      title: "🚧 Audio controls aren't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
      description: isMuted ? "Unmuting stream" : "Muting stream",
    });
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Live Horse Shows
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto">
            Watch live horse shows with searchable pattern books side-by-side. 
            Follow along with the current patterns and learn from the best.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Show List */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="lg:col-span-1"
          >
            <Card className="glass-effect border-white/20 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Live Shows</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
                  <Input
                    placeholder="Search shows..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredShows.map((show) => (
                  <div
                    key={show.id}
                    onClick={() => handleSelectShow(show)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedShow?.id === show.id 
                        ? 'bg-gradient-to-r from-yellow-400/20 to-orange-500/20 border border-yellow-400/30' 
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-white font-medium text-sm">{show.title}</h3>
                      <Badge 
                        variant={show.status === 'live' ? 'default' : 'secondary'}
                        className={show.status === 'live' 
                          ? 'bg-red-500 text-white' 
                          : 'bg-gray-500 text-white'
                        }
                      >
                        {show.status}
                      </Badge>
                    </div>
                    <p className="text-white/70 text-xs mb-1">{show.location}</p>
                    <p className="text-white/60 text-xs mb-2">{show.currentClass}</p>
                    {show.status === 'live' && (
                      <div className="flex items-center text-xs text-white/60">
                        <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                        {show.viewers} viewers
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:col-span-3"
          >
            {selectedShow ? (
              <div className="space-y-6">
                {/* Video Player */}
                <Card className="glass-effect border-white/20">
                  <CardContent className="p-0">
                    <div className="relative aspect-video bg-black rounded-t-lg overflow-hidden">
                      <img  alt={selectedShow.thumbnail} className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1569587889770-9134d27b292e" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="flex items-center space-x-4">
                          <Button
                            onClick={togglePlayPause}
                            size="lg"
                            className="bg-white/20 hover:bg-white/30 text-white border-0"
                          >
                            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                          </Button>
                          <Button
                            onClick={toggleMute}
                            size="lg"
                            className="bg-white/20 hover:bg-white/30 text-white border-0"
                          >
                            {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                          </Button>
                          <Button
                            size="lg"
                            className="bg-white/20 hover:bg-white/30 text-white border-0"
                          >
                            <Maximize className="h-6 w-6" />
                          </Button>
                        </div>
                      </div>
                      {selectedShow.status === 'live' && (
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-red-500 text-white">
                            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                            LIVE
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <h2 className="text-2xl font-bold text-white mb-2">{selectedShow.title}</h2>
                      <p className="text-white/80 mb-4">{selectedShow.location} • {selectedShow.currentClass}</p>
                      {selectedShow.status === 'live' && (
                        <p className="text-white/60">{selectedShow.viewers} viewers watching</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Pattern Book */}
                <Card className="glass-effect border-white/20">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <BookOpen className="h-6 w-6 mr-2" />
                      Pattern Book
                    </CardTitle>
                    <CardDescription className="text-white/70">
                      Follow along with the current patterns being used in this show
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedShow.patterns.map((pattern) => (
                        <div
                          key={pattern.id}
                          onClick={() => handlePatternSelect(pattern)}
                          className={`p-4 rounded-lg cursor-pointer transition-all ${
                            pattern.active 
                              ? 'bg-gradient-to-r from-yellow-400/20 to-orange-500/20 border border-yellow-400/30' 
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <h3 className="text-white font-medium">{pattern.name}</h3>
                            {pattern.active && (
                              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black">
                                Current
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="glass-effect border-white/20 h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <Play className="h-16 w-16 text-white/40 mx-auto mb-4" />
                  <h3 className="text-white text-xl mb-2">Select a Show to Watch</h3>
                  <p className="text-white/70">Choose a live show from the list to start watching</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LiveFeedsPage;