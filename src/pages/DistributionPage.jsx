import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, Printer, Link, BarChart2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useToast } from '@/components/ui/use-toast';

const DistributionPage = () => {
  const { toast } = useToast();

  const handleAction = (title) => {
    toast({ title: `${title} feature coming soon!` });
  };

  return (
    <>
      <Helmet>
        <title>Distribution Center - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight">Distribution Center</h1>
            <p className="text-lg text-muted-foreground">Manage access and distribute materials to your team.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader><CardTitle>Create QR Sets</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Generate QR codes for roles, arenas, or specific classes.</p>
                <Button className="w-full" onClick={() => handleAction('Create QR Sets')}><QrCode className="mr-2 h-4 w-4" /> Generate</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Print Handouts</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Create printable sheets with QR codes and access links.</p>
                <Button className="w-full" onClick={() => handleAction('Print Handouts')}><Printer className="mr-2 h-4 w-4" /> Print</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Manage Links</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Expire, revoke, or view access logs for shared links.</p>
                <Button className="w-full" onClick={() => handleAction('Manage Links')}><Link className="mr-2 h-4 w-4" /> Manage</Button>
              </CardContent>
            </Card>
             <Card className="md:col-span-2 lg:col-span-3">
              <CardHeader><CardTitle>Access Log</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">View a log of who has accessed distributed materials.</p>
                <Button className="w-full" onClick={() => handleAction('View Access Log')}><BarChart2 className="mr-2 h-4 w-4" /> View Log</Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
};

export default DistributionPage;