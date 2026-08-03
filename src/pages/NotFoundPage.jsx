import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Unknown URLs used to redirect straight to the home page. That looked like the app
// had lost the page the visitor asked for, and it hid broken internal links from us
// (a dead link and a working one behaved identically). Now the address stays put and
// says what happened.
const NotFoundPage = () => {
  const location = useLocation();

  return (
    <>
      <Helmet>
        <title>Page Not Found - EquiPatterns</title>
        <meta name="description" content="The page you are looking for does not exist." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="flex-grow flex items-center justify-center container mx-auto px-4 py-8">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
              <FileQuestion className="h-16 w-16 text-muted-foreground mx-auto" />
              <CardTitle className="text-3xl font-bold mt-4">Page Not Found</CardTitle>
              <CardDescription>
                We couldn&apos;t find the page you were looking for.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-2 text-sm">
                The link may be out of date, or the address may have a typo.
              </p>
              <p className="text-xs text-muted-foreground mb-6 break-all">
                <code>{location.pathname}</code>
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button asChild>
                  <Link to="/">
                    <Home className="mr-2 h-4 w-4" />
                    Go to Homepage
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => window.history.back()}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
};

export default NotFoundPage;
