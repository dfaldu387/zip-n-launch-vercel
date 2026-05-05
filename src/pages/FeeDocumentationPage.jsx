import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, FileText } from 'lucide-react';
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

const FeeDocumentationPage = () => {
    const [extractions, setExtractions] = useState([]);

    useEffect(() => {
        const storedLog = JSON.parse(localStorage.getItem('aiExtractionLog') || '[]');
        const feeData = storedLog
            .filter(item => item.data?.fees && item.data.fees.length > 0)
            .map(item => ({
                showId: item.id,
                showName: item.extractedName,
                date: item.date,
                fees: item.data.fees,
            }));
        setExtractions(feeData);
    }, []);

    return (
        <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
            <DollarSign className="mx-auto h-16 w-16 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mt-4 mb-4">Fee Documentation Center</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                This page documents all fee-related information extracted from uploaded show schedules for internal use and future feature development.
            </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <Card>
                    <CardHeader>
                        <CardTitle>Extracted Fee Data Log</CardTitle>
                        <CardDescription>A centralized log of all show fees automatically collected by the AI.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Show Name</TableHead>
                                    <TableHead>Extraction Date</TableHead>
                                    <TableHead>Fees Detected</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {extractions.length > 0 ? extractions.map(item => (
                                    <TableRow key={item.showId}>
                                        <TableCell className="font-medium">{item.showName}</TableCell>
                                        <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                {item.fees.map((fee, index) => (
                                                   <Badge key={index} variant="secondary">{fee.name}: ${fee.amount}</Badge> 
                                                ))}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24">
                                            No fee data has been extracted yet. Upload show schedules with fee information to populate this log.
                                        </TableCell>
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

export default FeeDocumentationPage;