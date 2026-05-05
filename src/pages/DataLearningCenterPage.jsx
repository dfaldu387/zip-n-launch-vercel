import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, FileText, Check, ArrowRight, BookCopy, Share2, Bot, Database, Eye } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import AdminBackButton from '@/components/admin/AdminBackButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from '@/components/ui/dialog';

const OntologyCard = ({ title, fields }) => (
    <Card className="bg-background/70 flex-1">
        <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-primary">
                <Database className="h-5 w-5" /> {title}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex flex-wrap gap-1">
                {fields.map(field => <Badge key={field} variant="secondary">{field}</Badge>)}
            </div>
        </CardContent>
    </Card>
);

const disciplineDict = [
    { from: "Trail, W/T Trail, W/J Trail", to: "Trail" },
    { from: "W. Pleasure, WP", to: "Western Pleasure" },
    { from: "HSE, Equitation/NSBA", to: "Hunt Seat Equitation" },
    { from: "HUS, H.U.S.", to: "Hunter Under Saddle" },
    { from: "WWR, Ranch Rail Pleasure", to: "Working Western Rail" },
];

const divisionDict = [
    { from: "Am., Amat", to: "Amateur" },
    { from: "YA", to: "Youth" },
    { from: "W/T, W-J, W/J", to: "Walk/Trot" },
    { from: "L1", to: "L1 (Novice)" },
    { from: "Jr/Sr", to: "Junior/Senior (Horse Age)" },
];

const DataLearningCenterPage = () => {
  const [log, setLog] = useState([]);
  const [selectedLogItem, setSelectedLogItem] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const storedLog = JSON.parse(localStorage.getItem('aiExtractionLog') || '[]');
    setLog(storedLog);
  }, []);

  const handleVerify = (id) => {
    const updatedLog = log.map(item => item.id === id ? { ...item, status: 'Verified' } : item);
    setLog(updatedLog);
    localStorage.setItem('aiExtractionLog', JSON.stringify(updatedLog));
    toast({
        title: "Log Entry Verified!",
        description: "This data will now be used for future AI learning.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
            <BrainCircuit className="mx-auto h-16 w-16 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mt-4 mb-4">Data & Learning Center</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Monitor and manage the AI's self-learning capabilities to improve data extraction accuracy over time.
            </p>
        </motion.div>

        <div className="space-y-12">
            <Card className="bg-secondary/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-2xl"><BookCopy className="h-7 w-7"/>Core Ontology</CardTitle>
                    <CardDescription>This is the target data structure the AI learns to populate from any show bill. It defines how we understand and organize event information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row items-stretch gap-4">
                        <OntologyCard title="Show" fields={["title", "venue", "start_date", "managers[]", "judges[]", "policies[]", "fees[]"]} />
                        <div className="flex items-center justify-center"><ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" /></div>
                        <OntologyCard title="Day/Session" fields={["date", "start_time", "ring", "notes"]} />
                        <div className="flex items-center justify-center"><ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" /></div>
                        <OntologyCard title="ClassRun" fields={["orgs[]", "division", "discipline", "is_nsba_dual", "concurrent_levels[]", "...more"]} />
                    </div>
                </CardContent>
            </Card>
            
            <Card className="bg-secondary/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-2xl"><Share2 className="h-7 w-7"/>Canonical Dictionaries</CardTitle>
                    <CardDescription>The AI uses these editable dictionaries to normalize abbreviations and variations into a single, canonical term. This ensures data consistency.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8">
                    <Table>
                        <TableHeader><TableRow><TableHead>Discipline Abbreviations</TableHead><TableHead>Canonical Name</TableHead></TableRow></TableHeader>
                        <TableBody>{disciplineDict.map(d=><TableRow key={d.to}><TableCell><Badge variant="outline">{d.from}</Badge></TableCell><TableCell>{d.to}</TableCell></TableRow>)}</TableBody>
                    </Table>
                    <Table>
                        <TableHeader><TableRow><TableHead>Division/Level Abbreviations</TableHead><TableHead>Canonical Name</TableHead></TableRow></TableHeader>
                        <TableBody>{divisionDict.map(d=><TableRow key={d.to}><TableCell><Badge variant="outline">{d.from}</Badge></TableCell><TableCell>{d.to}</TableCell></TableRow>)}</TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="bg-secondary/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-2xl"><Bot className="h-7 w-7" />AI Learning Loop & Extraction Log</CardTitle>
                    <CardDescription>Review and verify data extracted from uploaded show schedules. Each verified entry improves the AI model, creating a smarter system over time.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>File Name</TableHead>
                                <TableHead>Extracted Name</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {log.length > 0 ? log.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{item.fileName}</TableCell>
                                    <TableCell>{item.extractedName}</TableCell>
                                    <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                                    <TableCell><Badge variant={item.status === 'Verified' ? 'default' : 'secondary'}>{item.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="sm"><Eye className="h-3 w-3 mr-1"/> View Data</Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle>Raw Extracted JSON</DialogTitle>
                                                        <DialogDescription>This is the data the AI extracted from {item.fileName}.</DialogDescription>
                                                    </DialogHeader>
                                                    <pre className="mt-2 w-full overflow-x-auto text-xs bg-background p-4 rounded-md">
                                                        {JSON.stringify(item.data, null, 2)}
                                                    </pre>
                                                </DialogContent>
                                            </Dialog>
                                            {item.status === 'Unverified' && (
                                                <Button variant="outline" size="sm" onClick={() => handleVerify(item.id)}><Check className="h-3 w-3 mr-1"/> Verify</Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">No extraction data yet. Upload a schedule to begin.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>

        <div className="text-center mt-16">
            <AdminBackButton />
        </div>
      </div>
    </div>
  );
};

export default DataLearningCenterPage;