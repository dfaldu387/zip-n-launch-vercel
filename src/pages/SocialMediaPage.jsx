import React from 'react';
import { motion } from 'framer-motion';
import { Instagram, Facebook, Rss } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SocialMediaPage = () => {

  const renderPlaceholderFeed = (platform) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
          className="aspect-square bg-secondary border-border rounded-lg flex items-center justify-center p-4"
        >
          <div className="text-center text-muted-foreground">
            {platform === 'Instagram' && <Instagram className="h-8 w-8 mx-auto mb-2" />}
            {platform === 'Facebook' && <Facebook className="h-8 w-8 mx-auto mb-2" />}
            {platform === 'TikTok' && <Rss className="h-8 w-8 mx-auto mb-2" />}
            <p className="text-sm font-semibold">Embedded {platform} Post</p>
            <p className="text-xs">This is a placeholder for a real social media post.</p>
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Social Media Highlights</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            See what's happening in the community. The latest posts, videos, and updates from across the web.
          </p>
        </motion.div>
        
        <Tabs defaultValue="instagram" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="instagram">
              <Instagram className="h-4 w-4 mr-2" /> Instagram
            </TabsTrigger>
            <TabsTrigger value="facebook">
              <Facebook className="h-4 w-4 mr-2" /> Facebook
            </TabsTrigger>
            <TabsTrigger value="tiktok">
              <Rss className="h-4 w-4 mr-2" /> TikTok
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instagram">
            <Card className="bg-secondary border-border">
              <CardHeader>
                <CardTitle>#EquiPatterns on Instagram</CardTitle>
                <CardDescription>The latest posts from our community.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderPlaceholderFeed('Instagram')}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="facebook">
            <Card className="bg-secondary border-border">
              <CardHeader>
                <CardTitle>EquiPatterns on Facebook</CardTitle>
                <CardDescription>Updates, news, and community stories.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderPlaceholderFeed('Facebook')}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="tiktok">
            <Card className="bg-secondary border-border">
              <CardHeader>
                <CardTitle>Trending on TikTok</CardTitle>
                <CardDescription>Viral moments and training tips from the show ring.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderPlaceholderFeed('TikTok')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SocialMediaPage;