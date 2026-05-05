import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { BrainCircuit, BookOpen, Wand2, ShieldCheck, ThumbsUp, Database, FileDigit, GitBranch, PlusCircle, AlertTriangle, MessageSquare as MessageSquareWarning, GitPullRequestArrow } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const RuleCard = ({ rule, icon, example }) => (
    <div className="border p-3 rounded-lg bg-background/50 flex items-start gap-3">
        {icon}
        <div>
            <p className="font-semibold text-foreground">{rule}</p>
            <p className="text-xs text-muted-foreground">{example}</p>
        </div>
    </div>
);

const AIPatternGeneratorStudioPage = () => {
    const { toast } = useToast();
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [validationResult, setValidationResult] = useState(null);

    const handleGenerate = () => {
        if (!prompt.trim()) {
            toast({ title: 'Prompt is empty', description: 'Please enter a prompt to generate a pattern.', variant: 'destructive' });
            return;
        }
        setIsLoading(true);
        setValidationResult(null);
        toast({ title: 'Generating Pattern...', description: 'Our AI is crafting a new pattern based on your prompt. This is a simulation.' });

        setTimeout(() => {
            setIsLoading(false);
            setValidationResult({
                status: 'warning',
                feedback: [
                    { type: 'error', message: 'Obstacle 5 (gate) is not allowed in Novice patterns for APHA.' },
                    { type: 'suggestion', message: 'Distance between poles in obstacle 3 looks too short per AQHA rules. Recommended: 3-4 feet.' }
                ]
            });
            toast({ title: 'Generated with Warnings', description: 'The AI generated a pattern but found potential rule violations. Please review the feedback.', duration: 8000 });
        }, 2000);
    };

    const handleOnboardAssociation = () => {
      toast({
        title: "Onboarding New Association...",
        description: "Simulating AI parsing of rulebook, extraction of class structures, and ingestion of score sheet templates for the new association."
      })
    }

    return (
        <>
            <Helmet>
                <title>AI Pattern Studio - EquiPatterns</title>
                <meta name="description" content="Design and validate horse show patterns with the power of Artificial Intelligence." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="container mx-auto px-4 py-12">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <CardHeader className="text-center px-0 mb-8">
                            <CardTitle className="text-4xl md:text-5xl font-bold flex items-center justify-center">
                                <Wand2 className="mr-4 h-12 w-12 text-primary" /> AI Pattern Studio
                            </CardTitle>
                            <CardDescription className="text-xl text-muted-foreground max-w-3xl mx-auto">
                                A glimpse into the future: A generative AI assistant for creating and validating horse show patterns.
                            </CardDescription>
                        </CardHeader>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            <div className="space-y-8">
                                <Card className="glass-effect">
                                    <CardHeader>
                                        <CardTitle>Generative Pattern Design</CardTitle>
                                        <CardDescription>Prompt the AI to create a new pattern from scratch. It learns from thousands of existing patterns to generate novel, yet logical, courses.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Select><SelectTrigger><SelectValue placeholder="Select Association..." /></SelectTrigger><SelectContent><SelectItem value="AQHA">AQHA</SelectItem><SelectItem value="APHA">APHA</SelectItem><SelectItem value="NSBA">NSBA</SelectItem></SelectContent></Select>
                                            <Select><SelectTrigger><SelectValue placeholder="Select Class..." /></SelectTrigger><SelectContent><SelectItem value="trail">Trail</SelectItem><SelectItem value="horsemanship">Western Horsemanship</SelectItem><SelectItem value="reining">Reining</SelectItem></SelectContent></Select>
                                        </div>
                                        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., 'Design an advanced APHA trail pattern for a novice rider...'" className="min-h-[120px]" />
                                        <Button onClick={handleGenerate} disabled={isLoading} className="w-full">{isLoading ? "Generating..." : <><Wand2 className="mr-2 h-4 w-4" /> Generate & Validate Pattern</>}</Button>
                                    </CardContent>
                                </Card>

                                {validationResult && (
                                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                        <Card className="border-yellow-500/50">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-yellow-600"><AlertTriangle /> Validation Feedback</CardTitle>
                                                <CardDescription>The AI flagged the following issues based on the selected association's rulebook.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                {validationResult.feedback.map((item, index) => (
                                                    <div key={index} className={`flex items-start gap-2 p-2 rounded-md ${item.type === 'error' ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                                                        <MessageSquareWarning className={`h-5 w-5 mt-0.5 ${item.type === 'error' ? 'text-red-500' : 'text-blue-500'}`} />
                                                        <p className={`text-sm ${item.type === 'error' ? 'text-red-700' : 'text-blue-700'}`}>{item.message}</p>
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                )}
                            </div>
                            
                            <div className="space-y-8">
                                <Card className="glass-effect">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-3"><BrainCircuit className="text-primary"/> Continuous Learning Loop</CardTitle>
                                        <CardDescription>Human expertise is vital. The AI continuously improves through a feedback loop.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                       <ul className="space-y-3 text-sm">
                                            <li className="flex items-start gap-3"><GitPullRequestArrow className="h-5 w-5 text-primary mt-0.5 shrink-0"/><div><span className="font-semibold">User Interaction Data:</span> Most frequently used patterns and community ratings guide the AI on what constitutes a good design.</div></li>
                                            <li className="flex items-start gap-3"><ThumbsUp className="h-5 w-5 text-primary mt-0.5 shrink-0"/><div><span className="font-semibold">Error Correction:</span> Manual adjustments and corrections are fed back into the model to prevent repeating mistakes.</div></li>
                                            <li className="flex items-start gap-3"><BookOpen className="h-5 w-5 text-primary mt-0.5 shrink-0"/><div><span className="font-semibold">Rulebook Updates:</span> The AI's knowledge base is updated annually by re-parsing new rulebooks.</div></li>
                                       </ul>
                                    </CardContent>
                                </Card>

                                <Card className="glass-effect">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-3"><GitBranch className="text-primary"/> Scalability & Extensibility</CardTitle>
                                        <CardDescription>The system is designed to easily onboard new associations and disciplines.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground mb-4">Adding a new association is a streamlined process. The AI ingests the new rulebook and templates, integrating them into its validation and generation logic.</p>
                                        <Button variant="outline" className="w-full" onClick={handleOnboardAssociation}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Simulate Onboarding a New Association
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </motion.div>
                </main>
            </div>
        </>
    );
};

export default AIPatternGeneratorStudioPage;