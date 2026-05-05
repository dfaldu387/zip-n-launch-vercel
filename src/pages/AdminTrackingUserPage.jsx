import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format, subDays } from 'date-fns';
import { Loader2, Search, Eye, Download, MousePointer, Clock, AlertTriangle, Activity, Users, Monitor, Smartphone, Tablet, ChevronDown, User, BarChart3, TrendingUp, Zap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

const AdminTrackingUserPage = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('pattern-events');
    const [selectedUserId, setSelectedUserId] = useState('all'); // For Pattern Events user filter
    const { toast } = useToast();

    // Data states
    const [patternEvents, setPatternEvents] = useState([]);
    const [userSessions, setUserSessions] = useState([]);
    const [behaviorEvents, setBehaviorEvents] = useState([]);
    const [performanceLogs, setPerformanceLogs] = useState([]);
    const [profiles, setProfiles] = useState({});

    // Stats
    const [stats, setStats] = useState({
        totalViews: 0,
        totalDownloads: 0,
        totalSessions: 0,
        avgSessionDuration: 0,
        errorCount: 0
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch profiles for user names
            const { data: profilesData } = await supabase.from('profiles').select('id, full_name');
            const profilesMap = {};
            profilesData?.forEach(p => { profilesMap[p.id] = p.full_name || 'Unknown User'; });
            setProfiles(profilesMap);

            // Always fetch performance logs for error counting
            const { data: perfData } = await supabase
                .from('analytics_performance_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            
            // Always fetch behavior events for error counting (errors like pattern_book_error)
            const { data: behaviorData } = await supabase
                .from('analytics_behavior_events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            
            // Always fetch pattern events for pattern views count
            const { data: patternData } = await supabase
                .from('analytics_pattern_events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            
            setBehaviorEvents(behaviorData || []);
            setPatternEvents(patternData || []);
            
            // Count errors from BOTH performance logs AND behavior events
            const perfErrors = perfData?.filter(l => l.metric_type === 'error' || l.error_message).length || 0;
            const behaviorErrors = behaviorData?.filter(e => 
                e.event_type?.toLowerCase().includes('error') || e.event_data?.error
            ).length || 0;
            const totalErrors = perfErrors + behaviorErrors;
            
            // Calculate pattern views
            const views = patternData?.filter(e => e.action === 'view').length || 0;
            const downloads = patternData?.filter(e => e.action === 'download').length || 0;
            
            setStats(prev => ({ ...prev, errorCount: totalErrors, totalViews: views, totalDownloads: downloads }));
            
            if (activeTab === 'performance') {
                setPerformanceLogs(perfData || []);
            }

            if (activeTab === 'sessions') {
                const { data, error } = await supabase
                    .from('analytics_user_sessions')
                    .select('*')
                    .order('session_start', { ascending: false })
                    .limit(100);
                if (error) throw error;
                setUserSessions(data || []);

                const avgDuration = data?.length > 0 
                    ? data.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / data.length 
                    : 0;
                setStats(prev => ({ ...prev, totalSessions: data?.length || 0, avgSessionDuration: Math.round(avgDuration) }));
            }

        } catch (error) {
            console.error('Error fetching tracking data:', error);
            toast({ title: 'Error', description: 'Failed to fetch tracking data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const getDeviceIcon = (deviceType) => {
        switch (deviceType?.toLowerCase()) {
            case 'mobile': return <Smartphone className="h-4 w-4" />;
            case 'tablet': return <Tablet className="h-4 w-4" />;
            default: return <Monitor className="h-4 w-4" />;
        }
    };

    const getActionBadge = (action) => {
        const colors = {
            view: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
            download: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
            practice: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
            save: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
            revisit: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
        };
        return <Badge className={colors[action] || 'bg-gray-100 text-gray-700'}>{action}</Badge>;
    };

    const StatCard = ({ title, value, icon: Icon, description }) => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </CardContent>
        </Card>
    );

    // Get user display name - only show users with actual profiles
    const getUserDisplayName = (userId) => {
        if (!userId) return null; // Skip anonymous users
        return profiles[userId] || null; // Return null if no profile found
    };

    // Get unique users from pattern events for dropdown
    const getPatternEventUsers = () => {
        const uniqueUsers = new Map();
        patternEvents.forEach(event => {
            if (event.user_id && profiles[event.user_id]) {
                uniqueUsers.set(event.user_id, profiles[event.user_id]);
            }
        });
        return Array.from(uniqueUsers, ([id, name]) => ({ id, name }));
    };

    // Filter pattern events by selected user
    const getFilteredPatternEvents = () => {
        return patternEvents.filter(event => {
            const userName = getUserDisplayName(event.user_id);
            if (!userName) return false; // Hide anonymous/unknown users
            
            // Filter by selected user
            if (selectedUserId !== 'all' && event.user_id !== selectedUserId) return false;
            
            // Filter by search term
            return !searchTerm || 
                userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                event.discipline?.toLowerCase().includes(searchTerm.toLowerCase());
        });
    };

    // Group sessions by user (excluding anonymous)
    const getGroupedSessions = () => {
        const grouped = {};
        
        userSessions.forEach(session => {
            if (!session.user_id) return; // Skip sessions without user_id
            
            const userName = profiles[session.user_id];
            if (!userName) return; // Skip if user not found in profiles
            
            if (!grouped[session.user_id]) {
                grouped[session.user_id] = {
                    userName,
                    userId: session.user_id,
                    sessions: [],
                    totalDuration: 0,
                    sessionCount: 0
                };
            }
            
            grouped[session.user_id].sessions.push(session);
            grouped[session.user_id].totalDuration += session.duration_seconds || 0;
            grouped[session.user_id].sessionCount += 1;
        });

        // Filter by search term
        return Object.values(grouped).filter(user => 
            !searchTerm || user.userName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    // Group behavior events by user (excluding anonymous)
    const getGroupedBehaviorEvents = () => {
        const grouped = {};
        
        behaviorEvents.forEach(event => {
            if (!event.user_id) return;
            
            const userName = profiles[event.user_id];
            if (!userName) return;
            
            if (!grouped[event.user_id]) {
                grouped[event.user_id] = {
                    userName,
                    userId: event.user_id,
                    events: [],
                    eventCount: 0
                };
            }
            
            grouped[event.user_id].events.push(event);
            grouped[event.user_id].eventCount += 1;
        });

        return Object.values(grouped).filter(user => 
            !searchTerm || user.userName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    // Performance Tab Component with Graphs - now uses behavior events for errors
    const PerformanceTab = ({ performanceLogs, behaviorEvents, patternEvents, isLoading, profiles, searchTerm, getUserDisplayName, getDeviceIcon }) => {
        const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
        
        // Get error events from behavior events
        const errorEvents = useMemo(() => {
            return behaviorEvents.filter(e => 
                e.event_type?.toLowerCase().includes('error') || 
                e.event_data?.error
            );
        }, [behaviorEvents]);

        // Get pattern view count
        const patternViewCount = useMemo(() => {
            return patternEvents.filter(e => e.action === 'view').length;
        }, [patternEvents]);

        // Calculate stats for charts - combining performance logs, behavior events, and pattern events
        const chartData = useMemo(() => {
            const pageLoadTimes = {};
            const metricCounts = {};
            const deviceCounts = {};
            const browserCounts = {};
            const dailyMetrics = {};
            
            // Process performance logs
            performanceLogs.forEach(log => {
                if (log.page_path && log.load_time_ms) {
                    const pageName = log.page_path.split('/').filter(Boolean).slice(0, 2).join('/') || 'home';
                    if (!pageLoadTimes[pageName]) {
                        pageLoadTimes[pageName] = { total: 0, count: 0 };
                    }
                    pageLoadTimes[pageName].total += log.load_time_ms;
                    pageLoadTimes[pageName].count += 1;
                }
                
                metricCounts[log.metric_type] = (metricCounts[log.metric_type] || 0) + 1;
                
                const device = log.device_type || 'unknown';
                deviceCounts[device] = (deviceCounts[device] || 0) + 1;
                
                const browser = log.browser || 'unknown';
                browserCounts[browser] = (browserCounts[browser] || 0) + 1;
                
                const day = format(new Date(log.created_at), 'MMM d');
                if (!dailyMetrics[day]) {
                    dailyMetrics[day] = { date: day, page_load: 0, error: 0, download: 0, page_view: 0, pattern_view: 0 };
                }
                dailyMetrics[day][log.metric_type] = (dailyMetrics[day][log.metric_type] || 0) + 1;
            });

            // Process behavior events for metrics
            behaviorEvents.forEach(event => {
                const day = format(new Date(event.created_at), 'MMM d');
                if (!dailyMetrics[day]) {
                    dailyMetrics[day] = { date: day, page_load: 0, error: 0, download: 0, page_view: 0, pattern_view: 0 };
                }

                // Count errors from behavior events
                if (event.event_type?.toLowerCase().includes('error') || event.event_data?.error) {
                    dailyMetrics[day].error = (dailyMetrics[day].error || 0) + 1;
                    metricCounts['error'] = (metricCounts['error'] || 0) + 1;
                }

                // Count downloads
                if (event.event_type?.toLowerCase().includes('download')) {
                    dailyMetrics[day].download = (dailyMetrics[day].download || 0) + 1;
                    metricCounts['download'] = (metricCounts['download'] || 0) + 1;
                }

                // Count page views
                if (event.event_type === 'page_view') {
                    dailyMetrics[day].page_view = (dailyMetrics[day].page_view || 0) + 1;
                    metricCounts['page_view'] = (metricCounts['page_view'] || 0) + 1;
                }
            });

            // Process pattern events for metrics
            patternEvents.forEach(event => {
                const day = format(new Date(event.created_at), 'MMM d');
                if (!dailyMetrics[day]) {
                    dailyMetrics[day] = { date: day, page_load: 0, error: 0, download: 0, page_view: 0, pattern_view: 0 };
                }

                // Count pattern views
                if (event.action === 'view') {
                    dailyMetrics[day].pattern_view = (dailyMetrics[day].pattern_view || 0) + 1;
                    metricCounts['pattern_view'] = (metricCounts['pattern_view'] || 0) + 1;
                }

                // Count pattern downloads
                if (event.action === 'download') {
                    metricCounts['pattern_download'] = (metricCounts['pattern_download'] || 0) + 1;
                }

                // Count pattern saves
                if (event.action === 'save') {
                    metricCounts['pattern_save'] = (metricCounts['pattern_save'] || 0) + 1;
                }
            });
            
            return {
                avgLoadTimeByPage: Object.entries(pageLoadTimes).map(([page, data]) => ({
                    page: page.length > 15 ? page.substring(0, 15) + '...' : page,
                    avgTime: Math.round(data.total / data.count)
                })).slice(0, 8),
                metricDistribution: Object.entries(metricCounts).map(([name, value]) => ({ name, value })),
                deviceDistribution: Object.entries(deviceCounts).map(([name, value]) => ({ name, value })),
                browserDistribution: Object.entries(browserCounts).map(([name, value]) => ({ name, value })),
                dailyTrend: Object.values(dailyMetrics).slice(-7)
            };
        }, [performanceLogs, behaviorEvents, patternEvents]);

        // Summary stats - including behavior event errors and pattern views
        const summaryStats = useMemo(() => {
            const pageLogs = performanceLogs.filter(l => l.metric_type === 'page_load' && l.load_time_ms);
            const avgLoadTime = pageLogs.length > 0 
                ? Math.round(pageLogs.reduce((acc, l) => acc + l.load_time_ms, 0) / pageLogs.length)
                : 0;
            
            // Count errors from both performance logs AND behavior events
            const perfErrors = performanceLogs.filter(l => l.metric_type === 'error' || l.error_message).length;
            const behaviorErrors = errorEvents.length;
            const errorCount = perfErrors + behaviorErrors;
            
            const totalLogs = performanceLogs.length + behaviorEvents.length + patternEvents.length;
            
            return { avgLoadTime, errorCount, totalLogs, patternViewCount };
        }, [performanceLogs, errorEvents, behaviorEvents, patternEvents, patternViewCount]);

        if (isLoading) {
            return (
                <Card>
                    <CardContent className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </CardContent>
                </Card>
            );
        }

        // Use real data only - check both performance logs and behavior events
        const hasData = performanceLogs.length > 0 || behaviorEvents.length > 0;

        // No data state
        if (!hasData) {
            return (
                <div className="space-y-6">
                    {/* Summary Stats - Show zeros when no data */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Avg Load Time</CardTitle>
                                <Zap className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">0ms</div>
                                <p className="text-xs text-muted-foreground">Average page load</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">0</div>
                                <p className="text-xs text-muted-foreground">Performance events</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Errors</CardTitle>
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-destructive">0</div>
                                <p className="text-xs text-muted-foreground">Total errors logged</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No Performance Data Yet</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-md">
                                Performance metrics will appear here as users interact with the application. 
                                Data includes page load times, API calls, and error tracking.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {/* Summary Stats - Real Data */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Pattern Views</CardTitle>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryStats.patternViewCount}</div>
                            <p className="text-xs text-muted-foreground">Total pattern views</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Avg Load Time</CardTitle>
                            <Zap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryStats.avgLoadTime}ms</div>
                            <p className="text-xs text-muted-foreground">Average page load</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryStats.totalLogs}</div>
                            <p className="text-xs text-muted-foreground">Performance events</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Errors</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">{summaryStats.errorCount}</div>
                            <p className="text-xs text-muted-foreground">Total errors logged</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Load Time by Page */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Average Load Time by Page
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {chartData.avgLoadTimeByPage.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={chartData.avgLoadTimeByPage} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis type="number" unit="ms" className="text-xs" />
                                        <YAxis dataKey="page" type="category" width={100} className="text-xs" />
                                        <Tooltip 
                                            formatter={(value) => [`${value}ms`, 'Avg Load Time']}
                                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                        />
                                        <Bar dataKey="avgTime" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-[250px] text-muted-foreground">No page load data</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Daily Trend */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                Daily Performance Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {chartData.dailyTrend.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={chartData.dailyTrend}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="date" className="text-xs" />
                                        <YAxis className="text-xs" />
                                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                                        <Legend />
                                        <Line type="monotone" dataKey="page_load" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Page Loads" />
                                        <Line type="monotone" dataKey="error" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} name="Errors" />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-[250px] text-muted-foreground">No trend data</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Device Distribution */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Monitor className="h-4 w-4" />
                                Device Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {chartData.deviceDistribution.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={chartData.deviceDistribution}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            outerRadius={70}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {chartData.deviceDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-[200px] text-muted-foreground">No device data</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Metric Type Distribution */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Metric Types
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {chartData.metricDistribution.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={chartData.metricDistribution}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="name" className="text-xs" />
                                        <YAxis className="text-xs" />
                                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                                        <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-[200px] text-muted-foreground">No metric data</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Logs Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Performance Logs</CardTitle>
                        <CardDescription>Detailed log entries with load times and errors.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Metric</TableHead>
                                    <TableHead>Page</TableHead>
                                    <TableHead>Load Time</TableHead>
                                    <TableHead>Error</TableHead>
                                    <TableHead>Device</TableHead>
                                    <TableHead>Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {performanceLogs.filter(l => {
                                    const userName = getUserDisplayName(l.user_id);
                                    if (!userName) return false;
                                    return !searchTerm || 
                                        userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        l.page_path?.toLowerCase().includes(searchTerm.toLowerCase());
                                }).map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="font-medium">{profiles[log.user_id]}</TableCell>
                                        <TableCell>
                                            <Badge variant={log.metric_type === 'error' ? 'destructive' : 'outline'}>
                                                {log.metric_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[150px] truncate">{log.page_path || '-'}</TableCell>
                                        <TableCell>{log.load_time_ms ? `${log.load_time_ms}ms` : '-'}</TableCell>
                                        <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                                            {log.error_message || '-'}
                                        </TableCell>
                                        <TableCell className="flex items-center gap-1">{getDeviceIcon(log.device_type)}{log.device_type || 'Unknown'}</TableCell>
                                        <TableCell>{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                                    </TableRow>
                                ))}
                                {performanceLogs.filter(l => getUserDisplayName(l.user_id)).length === 0 && (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No performance logs recorded yet.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Error Events from Behavior Logs */}
                {errorEvents.length > 0 && (
                    <Card className="border-destructive/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-5 w-5" />
                                Error Events ({errorEvents.length})
                            </CardTitle>
                            <CardDescription>Errors captured from user behavior events.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Error Type</TableHead>
                                        <TableHead>Page</TableHead>
                                        <TableHead>Error Details</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {errorEvents.map((event) => (
                                        <TableRow key={event.id}>
                                            <TableCell className="font-medium">{profiles[event.user_id] || 'Unknown'}</TableCell>
                                            <TableCell>
                                                <Badge variant="destructive">{event.event_type}</Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate">{event.page_path || '-'}</TableCell>
                                            <TableCell className="max-w-[300px] truncate text-xs text-destructive">
                                                {event.event_data?.error || JSON.stringify(event.event_data)?.substring(0, 100)}
                                            </TableCell>
                                            <TableCell>{format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    };

    return (
        <>
            <Helmet>
                <title>Tracking User - Admin Dashboard</title>
                <meta name="description" content="View user tracking analytics and behavior data." />
            </Helmet>
            <Navigation />
            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <header className="mb-8">
                    <AdminBackButton className="mb-4" />
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <Activity className="h-8 w-8 text-primary" />
                        Tracking User
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Monitor user behavior, pattern usage, and performance metrics.
                    </p>
                </header>

                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <StatCard title="Pattern Views" value={stats.totalViews} icon={Eye} />
                    <StatCard title="Downloads" value={stats.totalDownloads} icon={Download} />
                    <StatCard title="Sessions" value={stats.totalSessions} icon={Users} />
                    <StatCard title="Avg Duration" value={`${stats.avgSessionDuration}s`} icon={Clock} />
                    <StatCard title="Errors" value={stats.errorCount} icon={AlertTriangle} />
                </div>

                {/* Search */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by user or pattern..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Refresh
                    </Button>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="pattern-events" className="flex items-center gap-2">
                            <Eye className="h-4 w-4" /> Pattern Events
                        </TabsTrigger>
                        <TabsTrigger value="sessions" className="flex items-center gap-2">
                            <Users className="h-4 w-4" /> User Sessions
                        </TabsTrigger>
                        <TabsTrigger value="behavior" className="flex items-center gap-2">
                            <MousePointer className="h-4 w-4" /> Behavior
                        </TabsTrigger>
                        <TabsTrigger value="performance" className="flex items-center gap-2">
                            <Activity className="h-4 w-4" /> Performance
                        </TabsTrigger>
                    </TabsList>

                    {/* Pattern Events Tab */}
                    <TabsContent value="pattern-events">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Pattern Events</CardTitle>
                                    <CardDescription>Track views, downloads, saves, and practice sessions.</CardDescription>
                                </div>
                                {/* User Filter Dropdown */}
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Select User" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Users</SelectItem>
                                            {getPatternEventUsers().map(user => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User</TableHead>
                                                <TableHead>Action</TableHead>
                                                <TableHead>Association</TableHead>
                                                <TableHead>Discipline</TableHead>
                                                <TableHead>Time Spent</TableHead>
                                                <TableHead>Device</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {getFilteredPatternEvents().map((event) => (
                                                <TableRow key={event.id}>
                                                    <TableCell className="font-medium">{profiles[event.user_id]}</TableCell>
                                                    <TableCell>{getActionBadge(event.action)}</TableCell>
                                                    <TableCell>{event.association_id || '-'}</TableCell>
                                                    <TableCell>{event.discipline || '-'}</TableCell>
                                                    <TableCell>{event.time_spent_seconds ? `${event.time_spent_seconds}s` : '-'}</TableCell>
                                                    <TableCell className="flex items-center gap-1">{getDeviceIcon(event.device_type)}{event.device_type || 'Unknown'}</TableCell>
                                                    <TableCell>{format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                                                </TableRow>
                                            ))}
                                            {getFilteredPatternEvents().length === 0 && (
                                                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No pattern events recorded yet.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Sessions Tab - Grouped by User */}
                    <TabsContent value="sessions">
                        <Card>
                            <CardHeader>
                                <CardTitle>User Sessions</CardTitle>
                                <CardDescription>Monitor login timestamps and session durations grouped by user.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                                ) : getGroupedSessions().length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No user sessions recorded yet.</div>
                                ) : (
                                    <Accordion type="single" collapsible className="w-full">
                                        {getGroupedSessions().map((userGroup) => (
                                            <AccordionItem key={userGroup.userId} value={userGroup.userId}>
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="flex items-center justify-between w-full pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <Users className="h-5 w-5 text-primary" />
                                                            <span className="font-semibold">{userGroup.userName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <Badge variant="outline" className="text-xs">
                                                                {userGroup.sessionCount} session{userGroup.sessionCount !== 1 ? 's' : ''}
                                                            </Badge>
                                                            <Badge variant="secondary" className="text-xs">
                                                                Total: {Math.round(userGroup.totalDuration / 60)} min
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Session Start</TableHead>
                                                                <TableHead>Session End</TableHead>
                                                                <TableHead>Duration</TableHead>
                                                                <TableHead>Device</TableHead>
                                                                <TableHead>Browser</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {userGroup.sessions.map((session) => (
                                                                <TableRow key={session.id}>
                                                                    <TableCell>{format(new Date(session.session_start), 'MMM d, yyyy HH:mm')}</TableCell>
                                                                    <TableCell>{session.session_end ? format(new Date(session.session_end), 'MMM d, yyyy HH:mm') : <Badge variant="outline">Active</Badge>}</TableCell>
                                                                    <TableCell>{session.duration_seconds ? `${Math.round(session.duration_seconds / 60)} min` : '-'}</TableCell>
                                                                    <TableCell className="flex items-center gap-1">{getDeviceIcon(session.device_type)}{session.device_type || 'Unknown'}</TableCell>
                                                                    <TableCell>{session.browser || '-'}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Behavior Tab */}
                    <TabsContent value="behavior">
                        <Card>
                            <CardHeader>
                                <CardTitle>Behavior Events</CardTitle>
                                <CardDescription>Track page views, clicks, search terms, and navigation flows.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                                ) : getGroupedBehaviorEvents().length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No behavior events recorded yet.</div>
                                ) : (
                                    <Accordion type="single" collapsible className="w-full">
                                        {getGroupedBehaviorEvents().map((userGroup) => (
                                            <AccordionItem key={userGroup.userId} value={userGroup.userId}>
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="flex items-center justify-between w-full pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <MousePointer className="h-5 w-5 text-primary" />
                                                            <span className="font-semibold">{userGroup.userName}</span>
                                                        </div>
                                                        <Badge variant="outline" className="text-xs">
                                                            {userGroup.eventCount} event{userGroup.eventCount !== 1 ? 's' : ''}
                                                        </Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Event Type</TableHead>
                                                                <TableHead>Page</TableHead>
                                                                <TableHead>Event Data</TableHead>
                                                                <TableHead>Date</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {userGroup.events.map((event) => (
                                                                <TableRow key={event.id}>
                                                                    <TableCell><Badge variant="outline">{event.event_type}</Badge></TableCell>
                                                                    <TableCell className="max-w-[200px] truncate">{event.page_path || '-'}</TableCell>
                                                                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                                                                        {event.event_data ? JSON.stringify(event.event_data) : '-'}
                                                                    </TableCell>
                                                                    <TableCell>{format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Performance Tab */}
                    <TabsContent value="performance">
                        <PerformanceTab 
                            performanceLogs={performanceLogs}
                            behaviorEvents={behaviorEvents}
                            patternEvents={patternEvents}
                            isLoading={isLoading}
                            profiles={profiles}
                            searchTerm={searchTerm}
                            getUserDisplayName={getUserDisplayName}
                            getDeviceIcon={getDeviceIcon}
                        />
                    </TabsContent>
                </Tabs>
            </main>
        </>
    );
};

export default AdminTrackingUserPage;
