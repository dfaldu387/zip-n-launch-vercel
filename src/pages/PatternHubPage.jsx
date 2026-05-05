import React from 'react';
    import { HelmetProvider, Helmet } from 'react-helmet-async';
    import { useParams } from 'react-router-dom';
    import Navigation from '@/components/Navigation';
    import { PatternHub } from '@/components/pattern-hub/PatternHub';

    const PatternHubPage = () => {
      const { projectId } = useParams();
      
      return (
        <HelmetProvider>
          <Helmet>
            <title>Pattern & Scoresheet Selector - EquiPatterns</title>
            <meta name="description" content="Search and discover individual horse show patterns and score sheets. Filter by association, class, and division to find exactly what you need." />
            <meta property="og:title" content="Pattern Selector - Find Equestrian Patterns & Score Sheets" />
            <meta property="og:description" content="Browse our extensive library of official patterns and score sheets. Perfect for clinics, practice, or individual show classes." />
          </Helmet>
          <div className="min-h-screen bg-background text-foreground">
            <Navigation />
            <main className="container mx-auto px-4 py-8">
                <PatternHub projectId={projectId} />
            </main>
          </div>
        </HelmetProvider>
      );
    };

    export default PatternHubPage;