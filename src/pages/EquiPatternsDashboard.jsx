import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, CheckSquare, ListTodo, FileArchive, ArrowRight } from 'lucide-react';
import Navigation from '@/components/Navigation';

const DashboardTile = ({ title, value, icon: Icon, linkTo, linkText }) => (
  <motion.div whileHover={{ y: -5 }} className="h-full">
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="text-4xl font-bold">{value}</div>
      </CardContent>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link to={linkTo}>
            {linkText} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  </motion.div>
);

const EquiPatternsDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    todayClasses: 0,
    pendingApprovals: 0,
    openTasks: 0,
    packetsToPublish: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        
        const [classes, approvals, tasks, packets] = await Promise.all([
          supabase.from('ep_classes').select('id', { count: 'exact' }).eq('class_date', today),
          supabase.from('ep_approvals').select('id', { count: 'exact' }).eq('decision', 'pending'),
          supabase.from('ep_tasks').select('id', { count: 'exact' }).eq('status', 'open'),
          supabase.from('ep_packets').select('id', { count: 'exact' }).eq('status', 'approved'),
        ]);

        setStats({
          todayClasses: classes.count || 0,
          pendingApprovals: approvals.count || 0,
          openTasks: tasks.count || 0,
          packetsToPublish: packets.count || 0,
        });

      } catch (error) {
        toast({ title: 'Error fetching dashboard stats', description: error.message, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user, toast]);

  return (
    <>
      <Helmet>
        <title>Dashboard - EquiPatterns</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight">EquiPatterns Dashboard</h1>
            <p className="text-lg text-muted-foreground">Your command center for pattern and show management.</p>
          </motion.div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <DashboardTile title="Today's Classes" value={stats.todayClasses} icon={Calendar} linkTo="/horse-show-manager" linkText="View Schedule" />
              <DashboardTile title="Pending Approvals" value={stats.pendingApprovals} icon={CheckSquare} linkTo="/approvals" linkText="Review Items" />
              <DashboardTile title="Open Tasks" value={stats.openTasks} icon={ListTodo} linkTo="/tasks" linkText="Manage Tasks" />
              <DashboardTile title="Packets to Publish" value={stats.packetsToPublish} icon={FileArchive} linkTo="/packet-builder" linkText="Build Packets" />
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default EquiPatternsDashboard;