import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, BarChart3, Users, MapPin, Video, Hash } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import AdminBackButton from '@/components/admin/AdminBackButton';


const SponsorshipAnalyticsPage = () => {
    const [extractions, setExtractions] = useState([]);

    useEffect(() => {
        const storedLog = JSON.parse(localStorage.getItem('aiExtractionLog') || '[]');
        setExtractions(storedLog);
    }, []);

    const MetricCard = ({ icon, title, value, description }) => (
        <Card className="bg-secondary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    );
    
    const totalEntries = extractions.reduce((acc, curr) => acc + (curr.data?.entries || 0), 0);
    const showsWithLivestream = extractions.filter(e => e.data?.livestream).length;

    return (
        <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
            <DollarSign className="mx-auto h-16 w-16 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mt-4 mb-4">Sponsorship Analytics</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Leverage data extracted from show schedules to create compelling proposals for potential sponsors.
            </p>
            </motion.div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.5, delay: 0.2 }}
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8"
            >
                <MetricCard icon={<Users className="h-4 w-4 text-muted-foreground"/>} title="Total Potential Reach" value={`${totalEntries.toLocaleString()}+`} description="Sum of all projected entries"/>
                <MetricCard icon={<BarChart3 className="h-4 w-4 text-muted-foreground"/>} title="Total Shows Analyzed" value={extractions.length} description="Number of uploaded show bills"/>
                <MetricCard icon={<Video className="h-4 w-4 text-muted-foreground"/>} title="Livestreamed Events" value={`${showsWithLivestream} (${Math.round((showsWithLivestream/extractions.length || 0)*100)}%)`} description="Shows with a livestream URL provided"/>
                <MetricCard icon={<MapPin className="h-4 w-4 text-muted-foreground"/>} title="Unique Venues" value={new Set(extractions.map(e => e.data?.venue)).size} description="Geographic diversity of events"/>
            </motion.div>


            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                <Card>
                    <CardHeader>
                        <CardTitle>Analyzed Show Data</CardTitle>
                        <CardDescription>This table summarizes key marketing signals extracted from uploaded show bills.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Show Name</TableHead>
                                    <TableHead>Venue</TableHead>
                                    <TableHead>Projected Entries</TableHead>
                                    <TableHead className="text-center">Marketing Opportunities</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {extractions.length > 0 ? extractions.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.extractedName}</TableCell>
                                        <TableCell>{item.data?.venue || 'N/A'}</TableCell>
                                        <TableCell>{item.data?.entries?.toLocaleString() || 'N/A'}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center gap-2">
                                                {item.data?.livestream && <Badge variant="default" className="bg-blue-500/80"><Video className="h-3 w-3 mr-1"/> Livestream</Badge>}
                                                <Badge variant="outline"><Hash className="h-3 w-3 mr-1"/> Hashtags</Badge>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">No data available. Upload show schedules to populate analytics.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>
            
            <div className="text-center mt-12">
                <AdminBackButton />
            </div>
        </div>
        </div>
    );
};

export default SponsorshipAnalyticsPage;