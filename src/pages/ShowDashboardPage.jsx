import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Calendar, ShieldCheck, Play, Archive, FilePlus, QrCode, Upload, BarChart, Edit } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

const ActionCard = ({ title, description, icon: Icon, onClick, disabled = false, linkTo }) => {
  const content = (
    <Card className="h-full flex flex-col hover:border-primary transition-all duration-300">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-lg">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  const props = {
    onClick: onClick,
    disabled: disabled,
    className: "text-left h-full w-full p-0"
  };

  if (linkTo) {
    return <Link to={linkTo} className="h-full w-full">{content}</Link>;
  }

  return <Button variant="ghost" {...props}>{content}</Button>;
};

const ShowDashboardPage = () => {
  const { showId } = useParams();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchShow = useCallback(async () => {
    if (!showId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('ep_shows')
      .select('*')
      .eq('id', showId)
      .single();

    if (error) {
      toast({ title: 'Error fetching show data', description: error.message, variant: 'destructive' });
    } else {
      setShow(data);
    }
    setLoading(false);
  }, [showId, toast]);

  useEffect(() => {
    fetchShow();
  }, [fetchShow]);

  const handleNotImplemented = () => {
    toast({
      title: "🚧 Feature Coming Soon!",
      description: "This functionality is under development. Stay tuned!",
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!show) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Show not found.</p>
      </div>
    );
  }

  const isShowManager = profile?.role === 'ShowManager' || profile?.role === 'Admin';
  const isSecretary = profile?.role === 'ShowSecretary' || isShowManager;

  return (
    <>
      <Helmet>
        <title>{show.name} - Show Dashboard</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight">{show.name}</h1>
                <p className="text-lg text-muted-foreground">
                  {format(new Date(show.start_date), 'PPP')} - {format(new Date(show.end_date), 'PPP')}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to={`/horse-show-manager/edit/${show.id}`}><Edit className="mr-2 h-4 w-4" /> Edit Show</Link>
              </Button>
            </div>
          </motion.div>

          <Tabs defaultValue="pre-show" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pre-show"><Calendar className="mr-2 h-4 w-4" />Pre-Show</TabsTrigger>
              <TabsTrigger value="during-show"><Play className="mr-2 h-4 w-4" />During Show</TabsTrigger>
              <TabsTrigger value="post-show"><Archive className="mr-2 h-4 w-4" />Post-Show</TabsTrigger>
            </TabsList>

            <TabsContent value="pre-show" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ActionCard title="Import Classes" description="Define or import all classes for the show." icon={FilePlus} onClick={handleNotImplemented} disabled={!isShowManager} />
                <ActionCard title="Build Pattern Book" description="Select patterns, build, and proof the main pattern book." icon={ShieldCheck} linkTo="/pattern-book-builder" disabled={!isShowManager} />
                <ActionCard title="Batch Assign Patterns" description="One-click assign patterns by discipline, division, or level." icon={FilePlus} onClick={handleNotImplemented} disabled={!isShowManager} />
              </div>
            </TabsContent>

            <TabsContent value="during-show" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ActionCard title="Generate Daily Score Sheets" description="Secretaries can generate score sheet packets per arena/day." icon={FilePlus} onClick={handleNotImplemented} disabled={!isSecretary} />
                <ActionCard title="Distribute via QR Code" description="Create QR codes for judges and stewards to access materials." icon={QrCode} onClick={handleNotImplemented} disabled={!isSecretary} />
                <ActionCard title="Kiosk Mode" description="Launch read-only views for announcers, judges, and scribes." icon={Play} onClick={handleNotImplemented} />
              </div>
            </TabsContent>

            <TabsContent value="post-show" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ActionCard title="Archive Packets" description="Mark all show packets as immutable for historical records." icon={Archive} onClick={handleNotImplemented} disabled={!isShowManager} />
                <ActionCard title="Upload Scored PDFs" description="Upload final scored sheets and link placings to results." icon={Upload} onClick={handleNotImplemented} disabled={!isSecretary} />
                <ActionCard title="Generate Post-Show Report" description="Create a comprehensive report of patterns, judges, and versions." icon={BarChart} onClick={handleNotImplemented} disabled={!isShowManager} />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
};

export default ShowDashboardPage;