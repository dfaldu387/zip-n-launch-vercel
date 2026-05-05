import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const POLICIES = {
  'terms-of-service': {
    title: 'Terms of Service',
    file: 'terms-of-service.docx',
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    file: 'privacy-policy.docx',
  },
  'refund-policy': {
    title: 'Payment, Renewal & Refund Policy',
    file: 'refund-policy.docx',
  },
};

const PolicyPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, '');
  const policy = POLICIES[slug];

  if (!policy) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold">Policy Not Found</h1>
          <p className="text-muted-foreground mt-2">The requested policy document could not be found.</p>
        </main>
      </div>
    );
  }

  const docUrl = `/documents/governing/${policy.file}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>{policy.title} - EquiPatterns</title>
      </Helmet>
      <Navigation />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{policy.title}</h1>
          <a
            href={docUrl}
            download
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent transition-colors"
          >
            Download
          </a>
        </div>

        <div className="border rounded-lg overflow-hidden bg-white" style={{ height: 'calc(100vh - 240px)' }}>
          <iframe
            src={`https://docs.google.com/gview?url=${window.location.origin}${docUrl}&embedded=true`}
            title={policy.title}
            className="w-full h-full"
            style={{ border: 'none' }}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PolicyPage;
