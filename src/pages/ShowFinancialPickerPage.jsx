import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, BarChart3, Calendar, Hash, ChevronRight, FolderOpen } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

const ShowFinancialPickerPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [shows, setShows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchShows = async () => {
            if (!user) { setIsLoading(false); return; }
            const { data, error } = await supabase
                .from('projects')
                .select('id, project_name, project_type, project_data, status, created_at')
                .not('project_type', 'in', '("pattern_folder","pattern_hub","pattern_upload","contract")')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setShows(data);
            }
            setIsLoading(false);
        };
        fetchShows();
    }, [user]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Horse Show Financials</title>
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex items-center gap-3 mb-8">
                        <Button variant="outline" size="icon" onClick={() => navigate('/horse-show-manager')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                <BarChart3 className="h-6 w-6 text-primary" />
                                Horse Show Financials
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Select a show to view its financial projections and analytics.
                            </p>
                        </div>
                    </div>

                    {shows.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center">
                                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No Shows Found</h3>
                                <p className="text-sm text-muted-foreground mb-6">
                                    Create a horse show first, then come back here to view financials.
                                </p>
                                <Button onClick={() => navigate('/horse-show-manager/create')}>
                                    Create Horse Show
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {shows.map((show, index) => {
                                const pd = show.project_data || {};
                                const feeCount = (pd.fees || []).length;
                                const sponsorCount = (pd.sponsors || []).length;
                                const expenseCount = (pd.showExpenses || []).length;
                                const hasFinancialData = feeCount > 0 || sponsorCount > 0 || expenseCount > 0;

                                return (
                                    <motion.div
                                        key={show.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <button
                                            type="button"
                                            className="w-full text-left"
                                            onClick={() => navigate(`/horse-show-manager/financials/${show.id}`)}
                                        >
                                            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                                                <CardContent className="py-4 px-5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h3 className="font-semibold text-base truncate">
                                                                    {show.project_name || 'Untitled Show'}
                                                                </h3>
                                                                {pd.showNumber && (
                                                                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                                                                        <Hash className="h-3 w-3 mr-0.5" />#{pd.showNumber}
                                                                    </Badge>
                                                                )}
                                                                <Badge
                                                                    variant="outline"
                                                                    className={cn('text-xs flex-shrink-0',
                                                                        show.status === 'published' && 'bg-emerald-50 text-emerald-700 border-emerald-300',
                                                                        show.status === 'draft' && 'bg-amber-50 text-amber-700 border-amber-300'
                                                                    )}
                                                                >
                                                                    {show.status || 'draft'}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                                {pd.startDate && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="h-3 w-3" />
                                                                        {pd.startDate}
                                                                    </span>
                                                                )}
                                                                <span>{feeCount} fees</span>
                                                                <span>{sponsorCount} sponsors</span>
                                                                <span>{expenseCount} expenses</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 ml-4">
                                                            {!hasFinancialData && (
                                                                <span className="text-xs text-amber-600">No financial data yet</span>
                                                            )}
                                                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default ShowFinancialPickerPage;
