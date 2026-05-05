import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { UploadCloud, Award, Sparkles, FolderOpen, Plus, ScanLine } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const PatternUploadLandingPage = () => {
  const { user, isAdmin } = useAuth();
  const features = [
    {
      icon: <UploadCloud className="h-8 w-8 text-primary" />,
      title: 'Seamless Uploads',
      description: 'Upload up to four patterns at once to create a complete set for any class.',
    },
    {
      icon: <Sparkles className="h-8 w-8 text-primary" />,
      title: 'Intelligent Tagging',
      description: 'Our system helps you tag patterns with the correct associations, divisions, and classes.',
    },
    {
      icon: <Award className="h-8 w-8 text-primary" />,
      title: 'Reach a Global Audience',
      description: 'Your patterns will be available to show managers and equestrians worldwide.',
    },
  ];

  return (
    <>
      <Helmet>
        <title>Upload Patterns - EquiPatterns</title>
        <meta name="description" content="Become a contributor. Upload your custom horse show patterns, tag them with our intelligent system, and reach thousands of equestrians and show managers worldwide." />
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="flex-grow">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center"
            >
              <Badge variant="secondary" className="mb-4">For Designers & Contributors</Badge>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6">
                Share Your Expertise. <br />
                <span className="text-primary">Power the Next Champion.</span>
              </h1>
              <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground mb-10">
                Join our community of elite pattern designers. Upload your custom patterns, tag them with our intelligent system, and get them in front of thousands of equestrians and show managers.
              </p>
              <div className="flex items-center justify-center gap-4">
                {isAdmin && (
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/upload-patterns/extractor">
                      <ScanLine className="mr-2 h-5 w-5" /> PDF Extractor
                    </Link>
                  </Button>
                )}
                <Button size="lg" asChild>
                  <Link to="/upload-patterns/new">
                    <Plus className="mr-2 h-5 w-5" /> Start New Upload
                  </Link>
                </Button>
                {user && (
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/contributor-portal">
                      <FolderOpen className="mr-2 h-5 w-5" /> My Uploads
                    </Link>
                  </Button>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-20"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                  <Card key={index} className="text-center bg-secondary/50 border-border/50">
                    <CardHeader>
                      <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                        {feature.icon}
                      </div>
                      <CardTitle>{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </>
  );
};

export default PatternUploadLandingPage;