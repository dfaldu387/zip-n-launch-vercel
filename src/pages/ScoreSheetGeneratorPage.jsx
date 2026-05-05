import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Upload, Wand2, Printer, Loader2, BookOpenCheck, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { extractPatternSteps, generateScoreSheetPdf } from '@/lib/pdfUtils';
import { scoreSheetTemplates } from '@/lib/scoreSheetTemplates';
import ScoreSheetLayout from '@/components/score-sheet-generator/ScoreSheetLayout';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';

const ScoreSheetGeneratorPage = () => {
    const { toast } = useToast();
    const [pdfFile, setPdfFile] = useState(null);
    const [extractedSteps, setExtractedSteps] = useState(null);
    const [patternInfo, setPatternInfo] = useState({ className: '', patternName: '', association: '', year: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const fileInputRef = useRef(null);
    const [associationsData, setAssociationsData] = useState([]);
    const [disciplineLibrary, setDisciplineLibrary] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            const { data: assocData, error: assocError } = await supabase.from('associations').select('*');
            if (assocError) toast({ title: 'Error fetching associations', description: assocError.message, variant: 'destructive' });
            else setAssociationsData(assocData);

            const { data: discData, error: discError } = await supabase.from('disciplines').select('*');
            if (discError) toast({ title: 'Error fetching disciplines', description: discError.message, variant: 'destructive' });
            else setDisciplineLibrary(discData);
        };
        fetchData();
    }, [toast]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            setPdfFile(file);
            setExtractedSteps(null);
        } else {
            toast({
                title: 'Invalid File',
                description: 'Please select a PDF file.',
                variant: 'destructive',
            });
        }
    };

    const handleGenerate = async () => {
        if (!pdfFile) {
            toast({ title: 'No PDF selected', description: 'Please upload a pattern PDF first.', variant: 'destructive' });
            return;
        }
        if (!patternInfo.association || !patternInfo.className) {
            toast({ title: 'Selection Missing', description: 'Please select an association and discipline.', variant: 'destructive' });
            return;
        }
        setIsLoading(true);
        setExtractedSteps(null);
        try {
            const steps = await extractPatternSteps(pdfFile);
            setExtractedSteps(steps);
            
            const stepCount = Object.keys(steps).length;
            if (stepCount > 15) {
                 toast({
                    title: 'Quality Check Warning',
                    description: `Pattern has ${stepCount} steps, but the template only supports 15. Extra steps will be ignored.`,
                    variant: 'destructive',
                    duration: 8000
                });
            } else {
                toast({ title: 'Success!', description: `Extracted ${stepCount} steps from your PDF.` });
            }

        } catch (error) {
            toast({ title: 'Extraction Failed', description: error.message, variant: 'destructive' });
            setExtractedSteps(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = async () => {
        if (!selectedTemplate || !extractedSteps) {
            toast({ title: 'Cannot Download', description: 'Please generate a score sheet first.', variant: 'destructive' });
            return;
        }
        setIsDownloading(true);
        try {
            const pdfBytes = await generateScoreSheetPdf(selectedTemplate.path, extractedSteps, patternInfo);
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${patternInfo.association}_${patternInfo.className}_${patternInfo.patternName || 'Scoresheet'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: 'Download Started', description: 'Your PDF score sheet is being downloaded.' });
        } catch (error) {
            console.error("PDF Generation failed:", error);
            toast({ title: 'Download Failed', description: 'Could not generate the PDF file.', variant: 'destructive' });
        } finally {
            setIsDownloading(false);
        }
    };

    const availableClasses = useMemo(() => {
        if (!patternInfo.association) return [];
        const classNamesInTemplates = Object.keys(scoreSheetTemplates[patternInfo.association] || {});
        return disciplineLibrary.filter(c => classNamesInTemplates.includes(c.name));
    }, [patternInfo.association, disciplineLibrary]);

    const selectedTemplate = useMemo(() => {
        const { association, className, year } = patternInfo;
        if (!association || !className) return null;
        
        const templatesForClass = scoreSheetTemplates[association]?.[className];
        if (!templatesForClass) return null;

        const effectiveYear = year || Math.max(...Object.keys(templatesForClass).map(Number));
        if (patternInfo.year !== effectiveYear.toString()) {
            setTimeout(() => setPatternInfo(p => ({...p, year: effectiveYear.toString()})), 0);
        }
        
        return templatesForClass[effectiveYear] || null;
    }, [patternInfo.association, patternInfo.className, patternInfo.year]);

    const availableYears = useMemo(() => {
         const { association, className } = patternInfo;
        if (!association || !className) return [];
        const templatesForClass = scoreSheetTemplates[association]?.[className];
        if (!templatesForClass) return [];
        return Object.keys(templatesForClass).sort((a,b) => b-a);
    }, [patternInfo.association, patternInfo.className]);

    return (
        <>
            <Helmet>
                <title>AI Score Sheet Generator - EquiPatterns</title>
                <meta name="description" content="Automatically generate formatted score sheets from horse show pattern PDFs using official templates." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-12">
                     <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <CardHeader className="text-center px-0 mb-8">
                            <CardTitle className="text-4xl md:text-5xl font-bold">AI Score Sheet Generator</CardTitle>
                            <CardDescription className="text-xl text-muted-foreground max-w-3xl mx-auto">
                                Upload a pattern PDF and instantly get a formatted, ready-to-print score sheet.
                            </CardDescription>
                        </CardHeader>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                            <div className="lg:col-span-1 space-y-8 sticky top-24">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>1. Configuration</CardTitle>
                                        <CardDescription>Select template and upload your pattern.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-2">
                                            <Label>Select Template</Label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <Select value={patternInfo.association} onValueChange={value => setPatternInfo({ ...patternInfo, association: value, className: '', year: '' })}>
                                                    <SelectTrigger><SelectValue placeholder="Association" /></SelectTrigger>
                                                    <SelectContent>
                                                        {Object.keys(scoreSheetTemplates).map(id => (
                                                            <SelectItem key={id} value={id}>{associationsData.find(a => a.id === id)?.name || id}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select value={patternInfo.className} onValueChange={value => setPatternInfo({ ...patternInfo, className: value, year: '' })} disabled={!patternInfo.association}>
                                                    <SelectTrigger><SelectValue placeholder="Discipline" /></SelectTrigger>
                                                    <SelectContent>
                                                        {availableClasses.map(c => (
                                                            <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                             {availableYears.length > 1 && (
                                                <Select value={patternInfo.year} onValueChange={value => setPatternInfo({ ...patternInfo, year: value })}>
                                                    <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                                                    <SelectContent>
                                                        {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                             )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="patternName">Pattern Name (Optional)</Label>
                                            <Input id="patternName" value={patternInfo.patternName} onChange={(e) => setPatternInfo(p => ({...p, patternName: e.target.value}))} placeholder="E.g., Pattern A" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="pdf-upload">Upload Pattern PDF</Label>
                                            <div
                                                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    {pdfFile ? pdfFile.name : 'Click or drag to upload'}
                                                </p>
                                            </div>
                                            <Input ref={fileInputRef} id="pdf-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} />
                                        </div>
                                        <Button onClick={handleGenerate} className="w-full" disabled={isLoading || !pdfFile || !selectedTemplate}>
                                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                            Generate & Check
                                        </Button>
                                    </CardContent>
                                </Card>
                                
                                {extractedSteps && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>2. Quality Check</CardTitle>
                                            <CardDescription>Review extracted maneuvers.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                                                {Object.entries(extractedSteps).map(([num, text]) => (
                                                    <div key={num} className="flex items-start text-sm">
                                                        <Badge variant="secondary" className="mr-2">{num}</Badge>
                                                        <span className="flex-1">{text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button onClick={handleDownload} variant="default" className="w-full" disabled={isDownloading}>
                                                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                                    Download PDF
                                                </Button>
                                                <Button onClick={handlePrint} variant="outline" className="w-full">
                                                    <Printer className="mr-2 h-4 w-4" /> Print
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                            <div className="lg:col-span-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Score Sheet Preview</CardTitle>
                                        <CardDescription>{selectedTemplate ? `Using ${patternInfo.association} ${patternInfo.className} ${patternInfo.year} Template` : 'Select a template to begin.'}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                       {selectedTemplate ? (
                                            <ScoreSheetLayout steps={extractedSteps || {}} patternInfo={patternInfo} template={selectedTemplate} />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-center text-muted-foreground bg-secondary/30 aspect-[8.5/11] rounded-lg">
                                                <BookOpenCheck className="h-16 w-16 mb-4" />
                                                <p className="text-lg font-medium">Please select an association and discipline</p>
                                                <p>to load the official score sheet template.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </motion.div>
                </main>
            </div>
            <style jsx="true" global="true">{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .printable-area, .printable-area * {
                        visibility: visible;
                    }
                    .printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        max-width: 100%;
                        box-shadow: none;
                        margin: 0;
                        padding: 0;
                    }
                }
            `}</style>
        </>
    );
};

export default ScoreSheetGeneratorPage;