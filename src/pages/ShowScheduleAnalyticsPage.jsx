import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Clock, Users, FileText } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import AdminBackButton from '@/components/admin/AdminBackButton';

const ShowScheduleAnalyticsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Show Schedule Analytics</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Analyze time management data extracted from uploaded show schedules to optimize event flow.
          </p>
        </motion.div>

        <Card className="bg-secondary/50 border-border text-center">
            <CardHeader>
                <BarChart3 className="h-16 w-16 mx-auto text-primary mb-4" />
                <CardTitle>Analytics Dashboard Under Construction</CardTitle>
                <CardDescription>This is where data from the Pattern Book Builder's Time Management feature will be displayed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                    Once users start creating pattern books and estimating class times, this dashboard will come to life with valuable insights, such as:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                    <div className="p-4 bg-background/50 rounded-lg border">
                        <h4 className="font-semibold flex items-center mb-2"><Clock className="mr-2 h-4 w-4"/>Average Time Per Pattern</h4>
                        <p className="text-sm text-muted-foreground">Track which patterns run faster or slower on average across all shows.</p>
                    </div>
                    <div className="p-4 bg-background/50 rounded-lg border">
                        <h4 className="font-semibold flex items-center mb-2"><Users className="mr-2 h-4 w-4"/>Entry-to-Time Correlation</h4>
                        <p className="text-sm text-muted-foreground">Analyze how the number of entries impacts the total duration of different class types.</p>
                    </div>
                    <div className="p-4 bg-background/50 rounded-lg border">
                        <h4 className="font-semibold flex items-center mb-2"><FileText className="mr-2 h-4 w-4"/>Show Schedule Accuracy</h4>
                        <p className="text-sm text-muted-foreground">Compare estimated schedules against actuals (future feature) to improve planning.</p>
                    </div>
                </div>
                 <div className="mt-6 inline-block">
                    <AdminBackButton />
                 </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ShowScheduleAnalyticsPage;