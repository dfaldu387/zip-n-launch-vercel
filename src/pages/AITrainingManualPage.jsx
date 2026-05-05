import React from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, BookCopy, Share2, Bot, Database, Eye, Check, ArrowRight, Rss, Code, FileJson, HeartHandshake as Handshake, Building, User, Image, Mail, Search, ListChecks, Download, Target, Gauge, ShieldCheck, Milestone } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AdminBackButton from '@/components/admin/AdminBackButton';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";


const OntologyCard = ({ title, fields, icon }) => (
    <Card className="bg-background/70 flex-1 shadow-md hover:shadow-primary/20 transition-shadow">
        <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-primary">
                {icon} {title}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex flex-wrap gap-1">
                {fields.map(field => <Badge key={field} variant="secondary">{field}</Badge>)}
            </div>
        </CardContent>
    </Card>
);

const KnowledgeGraphEntity = ({ icon, title, fields }) => (
    <AccordionItem value={title}>
        <AccordionTrigger className="font-semibold text-lg flex items-center gap-3">
            {icon} {title}
        </AccordionTrigger>
        <AccordionContent>
            <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-background">
                {fields.map(field => <Badge key={field} variant="outline">{field}</Badge>)}
            </div>
        </AccordionContent>
    </AccordionItem>
);

const HeuristicItem = ({ title, content, cues, regex }) => (
    <div className="p-4 border rounded-lg bg-secondary/20">
        <h5 className="font-semibold text-foreground mb-2">{title}</h5>
        <p className="text-sm text-muted-foreground mb-3">{content}</p>
        {cues && <div className="mb-3"><p className="text-xs font-bold uppercase text-muted-foreground mb-1">Cues</p><div className="flex flex-wrap gap-1">{cues.map(c => <Badge key={c} variant="secondary">{c}</Badge>)}</div></div>}
        {regex && <div className="mt-2"><p className="text-xs font-bold uppercase text-muted-foreground mb-1">Regex Pattern</p><pre className="p-2 bg-background rounded-md text-xs font-mono"><code>{regex}</code></pre></div>}
    </div>
);

const BlueprintCard = ({ title, description, items }) => (
    <Card className="bg-secondary/50 flex flex-col">
        <CardHeader>
            <CardTitle className="text-xl text-primary">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
            <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                {items.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
        </CardContent>
    </Card>
);


const AITrainingManualPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-16">
            <BrainCircuit className="mx-auto h-20 w-20 text-primary" />
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground mt-4 mb-4 tracking-tight">AI Training Manual</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                The structured knowledge base used to teach the AI how to accurately parse, understand, and act on horse show data.
            </p>
        </motion.div>

        <div className="space-y-12">
            
            <Accordion type="multiple" className="w-full space-y-4" defaultValue={['implementation-blueprint']}>
                <AccordionItem value="show-parsing">
                    <AccordionTrigger className="text-2xl font-bold text-primary py-4">Show Schedule Parsing</AccordionTrigger>
                    <AccordionContent className="space-y-8 pt-4">
                        <Card className="glass-effect">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 text-2xl font-bold"><Database className="h-7 w-7 text-primary"/>Core Ontology</CardTitle>
                                <CardDescription>The target data structure the AI learns to populate. This defines how we organize event information.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-col md:flex-row items-stretch gap-4 text-center">
                                    <OntologyCard title="Show" icon={<Rss className="h-5 w-5"/>} fields={["title", "venue", "start_date", "managers[]", "judges[]", "policies[]", "fees[]"]} />
                                    <div className="flex items-center justify-center transform md:rotate-0 rotate-90"><ArrowRight className="h-6 w-6 text-muted-foreground" /></div>
                                    <OntologyCard title="Day/Session" icon={<Rss className="h-5 w-5"/>} fields={["date", "start_time", "ring", "notes"]} />
                                    <div className="flex items-center justify-center transform md:rotate-0 rotate-90"><ArrowRight className="h-6 w-6 text-muted-foreground" /></div>
                                    <OntologyCard title="ClassRun" icon={<Rss className="h-5 w-5"/>} fields={["orgs[]", "division", "discipline", "is_nsba_dual", "concurrent_levels[]", "...more"]} />
                                </div>
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sponsorship-graph">
                    <AccordionTrigger className="text-2xl font-bold text-primary py-4">Sponsorship & Marketing Knowledge Graph</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                        <p className="text-muted-foreground">This schema defines how the AI identifies and connects sponsors, people, and brands to specific shows, creating a rich graph for marketing and outreach.</p>
                        <Accordion type="single" collapsible className="w-full">
                            <KnowledgeGraphEntity icon={<Handshake className="h-6 w-6" />} title="Sponsorship" fields={["org_ref", "show_ref", "tier", "assets_promised[]", "contract{}", "activation_metrics{}"]} />
                            <KnowledgeGraphEntity icon={<Building className="h-6 w-6" />} title="Organization" fields={["canonical_name", "aka[]", "category", "website", "contacts[]", "logo_assets[]"]} />
                             <KnowledgeGraphEntity icon={<User className="h-6 w-6" />} title="Person" fields={["name", "roles[]", "emails[]", "phones[]", "org_affiliation"]} />
                             <KnowledgeGraphEntity icon={<Image className="h-6 w-6" />} title="Visual Asset (Logo)" fields={["type", "source", "hash", "embedding[]", "dominant_palette[]", "text_ocr"]} />
                             <KnowledgeGraphEntity icon={<Mail className="h-6 w-6" />} title="Communication Artifact" fields={["kind", "source_url", "text", "extracted_contacts[]", "extracted_entities[]"]} />
                        </Accordion>
                    </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="extraction-playbook">
                    <AccordionTrigger className="text-2xl font-bold text-primary py-4">Data Extraction Playbook</AccordionTrigger>
                     <AccordionContent className="space-y-6 pt-4">
                        <p className="text-muted-foreground">The heuristic rules and signals the AI uses to find and structure specific data points from unstructured text and images.</p>
                        <div className="grid md:grid-cols-2 gap-6">
                            <HeuristicItem title="People & Roles" content="Finds show officials and their contact info." cues={["Show Secretary", "Entries", "Show Manager", "Judge", "Contact", "For questions", "Announcer"]} regex={"/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i"} />
                            <HeuristicItem title="Sponsors & Vendors" content="Identifies sponsors and their contribution tier." cues={["Presented by", "Sponsor", "Host Hotel", "Official", "Thanks to our sponsors", "Powered by"]} />
                            <HeuristicItem title="Logo Identification" content="Matches images to brands using visual and text analysis." cues={["Perceptual Hash", "Vector Embedding", "OCR Text", "Color Palette"]} />
                            <HeuristicItem title="Venue & Ops Details" content="Extracts operational info like stall fees and check-in times." cues={["Stalls", "Shavings", "RV/Camping", "Office Hours", "Refund Policy", "Added Money"]} />
                        </div>
                     </AccordionContent>
                </AccordionItem>

                <AccordionItem value="automated-outputs">
                    <AccordionTrigger className="text-2xl font-bold text-primary py-4">Automated Outputs & Exports</AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                        <p className="text-muted-foreground">The primary goal of data extraction is to auto-populate lists and generate assets for both the Pattern Book Builder and marketing outreach.</p>
                        <div className="grid md:grid-cols-2 gap-6">
                            <Card className="bg-secondary/50"><CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-5 w-5"/>Current-Show Contact Sheet</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">One-click export of all key contacts (officials, vendors, sponsors) for the active show.</p></CardContent></Card>
                            <Card className="bg-secondary/50"><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5"/>Sponsor Prospecting List</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Aggregates data across all shows to generate a scored list of potential sponsors based on frequency, tier, and recency.</p></CardContent></Card>
                            <Card className="bg-secondary/50"><CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5"/>Class-Sponsor Auto-Fill</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Automatically links sponsors mentioned inline with a class and provides a dropdown for manual linking in the builder.</p></CardContent></Card>
                            <Card className="bg-secondary/50"><CardHeader><CardTitle className="flex items-center gap-2"><Image className="h-5 w-5"/>Logo Pack for Designers</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Exports a clean, organized folder of all sponsor logos for use in design and marketing materials.</p></CardContent></Card>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="training-governance">
                    <AccordionTrigger className="text-2xl font-bold text-primary py-4">AI Training, Metrics & Governance</AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                        <div className="grid md:grid-cols-3 gap-6">
                            <HeuristicItem title="Training & Labeling" content="The AI learns through weak supervision rules and a human-in-the-loop UI for corrections, improving with each verified document." cues={["Weak Supervision", "Human-in-the-Loop", "Merge Duplicates", "Accept/Reject"]}/>
                            <HeuristicItem title="Performance Metrics" content="We measure success with standard machine learning metrics to ensure accuracy and completeness." cues={["F1 Score (People)", "Precision@1 (Orgs)", "Recall (Logos)", "Graph Completeness"]}/>
                            <HeuristicItem title="Governance & Compliance" content="Data is handled ethically, respecting privacy and usage rights." cues={["robots.txt", "PII Protection", "Opt-Out Flags", "License Tracking"]}/>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="implementation-blueprint">
                    <AccordionTrigger className="text-2xl font-bold text-primary py-4">Implementation Blueprint</AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                        <p className="text-muted-foreground">A phased roadmap for developing these AI capabilities, focusing on delivering value quickly and iterating over time.</p>
                        <div className="grid md:grid-cols-3 gap-6">
                            <BlueprintCard title="MVP" description="Core extraction and export functionality." items={["Parser for People/Sponsors/Logos", "Brand registry CRUD UI", "CSV & Logo Pack exports", "Basic review UI for corrections"]}/>
                            <BlueprintCard title="V1 Enhancements" description="Smarter, more automated systems." items={["Learnable entity resolution", "Logo re-identification with embeddings", "Sponsorship tier classifier", "Lead scoring dashboard"]}/>
                            <BlueprintCard title="V2 (Future)" description="Proactive marketing and forecasting tools." items={["Social handle discovery", "Automatic outreach drafts", "Sponsor budget forecasting"]}/>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>

        <div className="text-center mt-16">
            <AdminBackButton />
        </div>
      </div>
    </div>
  );
};

export default AITrainingManualPage;