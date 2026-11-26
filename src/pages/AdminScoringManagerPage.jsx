import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import ScoringRulesEditor from '@/components/admin/ScoringRulesEditor';
import { SHEET_TYPES } from '@/lib/scoringSheetTypes';
import { supabase } from '@/lib/supabaseClient';

// Scoring Manager: per-discipline starting score, penalties and maneuver scores.
// The Scoring Portal reads these rules (table: scoring_rules, one row per discipline).
const AdminScoringManagerPage = () => {
    const { toast } = useToast();
    const [associations, setAssociations] = useState([]);
    const [disciplines, setDisciplines] = useState([]);
    const [associationId, setAssociationId] = useState('');
    const [disciplineId, setDisciplineId] = useState('');
    const [loadingDisciplines, setLoadingDisciplines] = useState(false);
    const [loadingRules, setLoadingRules] = useState(false);
    // null = nothing picked yet, { exists: false } = picked but no rules saved yet.
    const [rules, setRules] = useState(null);

    useEffect(() => {
        supabase.from('associations').select('id, name').order('name').then(({ data, error }) => {
            if (error) toast({ title: 'Error loading associations', description: error.message, variant: 'destructive' });
            else setAssociations(data || []);
        });
    }, [toast]);

    // Picking another association clears the discipline and its rules.
    useEffect(() => {
        setDisciplineId('');
        setRules(null);
        setDisciplines([]);
        if (!associationId) return;
        let cancelled = false;
        setLoadingDisciplines(true);
        supabase.from('disciplines').select('id, name, sub_association_type').eq('association_id', associationId).order('name')
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error) toast({ title: 'Error loading disciplines', description: error.message, variant: 'destructive' });
                else setDisciplines(data || []);
                setLoadingDisciplines(false);
            });
        return () => { cancelled = true; };
    }, [associationId, toast]);

    // Load the saved rules for the picked discipline (none yet is normal).
    useEffect(() => {
        setRules(null);
        if (!disciplineId) return;
        let cancelled = false;
        setLoadingRules(true);
        supabase.from('scoring_rules').select('*').eq('discipline_id', String(disciplineId)).maybeSingle()
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error) toast({ title: 'Error loading scoring rules', description: error.message, variant: 'destructive' });
                else setRules(data ? { exists: true, ...data } : { exists: false, starting_score: 70, penalties: [], maneuver_scores: [] });
                setLoadingRules(false);
            });
        return () => { cancelled = true; };
    }, [disciplineId, toast]);

    const discipline = disciplines.find(d => String(d.id) === String(disciplineId));
    const disciplineLabel = d => (d.sub_association_type ? `${d.name} (${d.sub_association_type})` : d.name);

    return (
        <>
            <Helmet><title>Scoring Manager - Admin</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 py-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center justify-between mb-4">
                            <AdminBackButton />
                            <div className="text-center flex-1">
                                <h1 className="text-2xl md:text-3xl font-bold">Scoring Manager</h1>
                                <p className="text-sm text-muted-foreground">Set the starting score, penalties and maneuver scores for each discipline.</p>
                            </div>
                            <div className="w-[88px]" />
                        </div>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>Choose an association and discipline</CardTitle></CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Association</Label>
                                    <Select value={associationId} onValueChange={setAssociationId}>
                                        <SelectTrigger><SelectValue placeholder="Pick an association" /></SelectTrigger>
                                        <SelectContent>
                                            {associations.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Discipline</Label>
                                    <Select value={disciplineId} onValueChange={setDisciplineId} disabled={!associationId || loadingDisciplines}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={!associationId ? 'Pick an association first' : loadingDisciplines ? 'Loading...' : disciplines.length === 0 ? 'No disciplines' : 'Pick a discipline'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {disciplines.map(d => <SelectItem key={d.id} value={String(d.id)}>{disciplineLabel(d)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        {disciplineId && (
                            <Card>
                                <CardHeader>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <CardTitle>{discipline ? disciplineLabel(discipline) : 'Scoring rules'}</CardTitle>
                                        {rules && (rules.exists
                                            ? <Badge variant="secondary">Rules saved</Badge>
                                            : <Badge variant="outline">No rules yet</Badge>)}
                                        {rules?.exists && <Badge>{(SHEET_TYPES[rules.sheet_type] || SHEET_TYPES.general).label}</Badge>}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {loadingRules || !rules ? (
                                        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                    ) : (
                                        <ScoringRulesEditor
                                            disciplineId={disciplineId}
                                            associationId={associationId}
                                            rules={rules}
                                            onSaved={setRules}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </motion.div>
                </main>
            </div>
        </>
    );
};

export default AdminScoringManagerPage;
