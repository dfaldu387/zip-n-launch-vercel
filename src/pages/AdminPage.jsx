import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Users, BarChart2, DollarSign, Settings, Layers, Code, HardDrive, FileText, Bot, PenTool, Gauge, FileImage, Receipt, Image, Calendar, Megaphone } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';

const AdminPage = () => {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      const { count, error } = await supabase
        .from('patterns')
        .select('*', { count: 'exact', head: true })
        .eq('review_status', 'pending');
      if (!error && count !== null) setPendingCount(count);
    };
    fetchPendingCount();
  }, []);

  const tools = [
    { name: 'User Management', path: '/admin/users', icon: Users, description: 'Manage users, roles, and permissions.' },
    { name: 'Role Management', path: '/admin/roles', icon: Settings, description: 'Configure user roles and their capabilities.' },
    { name: 'Show Management', path: '/admin/show-management', icon: BookOpen, description: 'Oversee all shows created by organizers.' },
    { name: 'Event Management', path: '/admin/events', icon: Calendar, description: 'Control which events appear on the public Events page.' },
    { name: 'Association Management', path: '/admin/associations', icon: Layers, description: 'Manage recognized associations.' },
    { name: 'Discipline Management', path: '/admin/disciplines', icon: Code, description: 'Administer show disciplines.' },
    { name: 'Division Management', path: '/admin/divisions', icon: HardDrive, description: 'Organize and manage divisions.' },
    { name: 'Division Level Management', path: '/admin/division-levels', icon: BarChart2, description: 'Set up levels within divisions.' },
    { name: 'Pattern Level Management', path: '/admin/pattern-levels', icon: Gauge, description: 'Manage pattern levels (ALL, L1, L2, etc.).' },
    { name: 'Sponsorship Packages', path: '/admin/sponsorship-packages', icon: DollarSign, description: 'Create and manage sponsorship tiers.' },
    { name: 'Pattern Extractor', path: '/admin/pattern-extractor', icon: Bot, description: 'AI-powered PDF pattern data extraction.' },
    { name: 'Manual Pattern Entry', path: '/admin/manual-pattern-entry', icon: PenTool, description: 'Manually input pattern data.' },
    { name: 'Scoresheet Upload', path: '/admin/scoresheet-upload', icon: FileImage, description: 'Upload scoresheet images and link to patterns.' },
    { name: 'Pattern Review', path: '/admin/pattern-review', icon: FileText, description: 'Review and approve submitted patterns.' },
    { name: 'Billing & Revenue', path: '/admin/billing-report', icon: Receipt, description: 'View all subscriptions, purchases, and revenue.' },
    { name: 'Site Branding', path: '/admin/site-branding', icon: Image, description: 'Upload homepage background image and site logo.' },
    { name: 'Marketing Content', path: '/admin/marketing-content', icon: Megaphone, description: 'Manage homepage ads, announcements, and promotional content.' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Admin Dashboard</h1>
          <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">Welcome, Admin. Here are your tools to manage the platform.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, index) => (
            <motion.div
              key={tool.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={tool.path} className="block h-full">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 flex flex-col h-full border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary">
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-3 rounded-full mr-4">
                      <tool.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tool.name}</h2>
                    {tool.path === '/admin/pattern-review' && pendingCount > 0 && (
                      <Badge variant="destructive" className="ml-2">{pendingCount}</Badge>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 flex-grow">{tool.description}</p>
                  <div className="mt-4 text-right">
                    <span className="text-primary font-semibold">Go to tool &rarr;</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;