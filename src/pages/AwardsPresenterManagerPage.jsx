import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Trophy, Calendar, ClipboardList, Gift, Truck, CheckCircle, Mail } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const awardsTasks = {
    preShow: [
        { id: 'order_awards', label: 'Order Ribbons & Trophies (3-4 months out)', description: 'Decide on high-point divisions, number of awards, and place order. Designate one person to check shipment for accuracy.' },
        { id: 'recruit_coordinator', label: 'Recruit Awards Presenter/Coordinator', description: 'Find a responsible individual to manage all awards-related tasks.' },
        { id: 'start_inventory', label: 'Start Awards Inventory Spreadsheet', description: 'Track all classes, prizes, and sponsors in a central document.' },
        { id: 'verify_shipment', label: 'Verify Awards Shipment & Inventory (1 month out)', description: 'Check quantities and quality against the order. Reorder if necessary.' },
        { id: 'assign_awards', label: 'Assign Awards to Classes', description: 'Sort ribbons and trophies into boxes or bags for each class/division. Label with class number, sponsor, and arena.' },
        { id: 'prepare_schedule', label: 'Prepare Awards Schedule for Posting', description: 'Align awards schedule with class start times and send to show manager/secretary and announcer.' },
    ],
    showDay: [
        { id: 'post_schedule', label: 'Post Final Awards Schedule', description: 'Post in the show office and near arenas for visibility.' },
        { id: 'deliver_awards', label: 'Deliver Awards to Arenas', description: 'Dispatch a runner with awards to the gate 10-15 minutes before each class ends.' },
        { id: 'conduct_ceremony', label: 'Conduct Awards Ceremony', description: 'Checklist: Call class in correct order, cue photographers, ensure sponsors are present, remind riders of dress code/safety.' },
        { id: 'distribute_tests', label: 'Distribute Tests/Ribbons (if no ceremony)', description: 'Return tests to competitors and hand out ribbons after scores are posted.' },
        { id: 'return_unused', label: 'Return Unused Awards', description: 'After each session, collect unused ribbons/trophies and return them to the awards table.' },
    ],
    postShow: [
        { id: 'pack_remaining', label: 'Pack & Return Remaining Awards', description: 'Pack all leftover awards and return to the show manager or awards company.' },
        { id: 'update_inventory', label: 'Update Final Inventory', description: 'Note any shortages or overages for future planning.' },
        { id: 'send_thanks', label: 'Send Thank-You Notes to Sponsors', description: 'Acknowledge sponsors and update their contact information for next year.' },
    ],
};

const TaskItem = ({ task, onToggle, isChecked }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start space-x-4 p-4 border-b last:border-b-0"
    >
        <Checkbox id={task.id} checked={isChecked} onCheckedChange={() => onToggle(task.id)} className="mt-1" />
        <div className="flex-1">
            <Label htmlFor={task.id} className={`text-base font-medium ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                {task.label}
            </Label>
            <p className="text-sm text-muted-foreground">{task.description}</p>
        </div>
    </motion.div>
);

const AwardsPresenterManagerPage = () => {
    const navigate = useNavigate();
    const [checkedTasks, setCheckedTasks] = useState(new Set());

    const handleToggleTask = (taskId) => {
        setCheckedTasks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
                newSet.delete(taskId);
            } else {
                newSet.add(taskId);
            }
            return newSet;
        });
    };

    const sections = [
        { title: 'Pre-Show Coordination', icon: Calendar, tasks: awardsTasks.preShow },
        { title: 'Show Day Execution', icon: ClipboardList, tasks: awardsTasks.showDay },
        { title: 'Post-Show Wrap-Up', icon: CheckCircle, tasks: awardsTasks.postShow },
    ];

    return (
        <>
            <Helmet>
                <title>Awards & Presenters Manager - EquiPatterns</title>
                <meta name="description" content="Coordinate and manage all aspects of horse show awards, from ordering to presentation." />
            </Helmet>
            <div className="min-h-screen bg-gradient-to-b from-background to-blue-50 dark:from-background dark:to-blue-900/20">
                <Navigation />
                <main className="container mx-auto px-4 py-12">
                    <PageHeader title="Awards & Presenters Scheduler" />

                    <Card>
                        <CardContent className="p-0">
                            <Accordion type="multiple" defaultValue={['item-0', 'item-1', 'item-2']} className="w-full">
                                {sections.map((section, index) => (
                                    <AccordionItem key={index} value={`item-${index}`}>
                                        <AccordionTrigger className="px-6 py-4 text-xl font-semibold hover:no-underline bg-muted/50">
                                            <div className="flex items-center gap-3">
                                                <section.icon className="h-6 w-6 text-primary" />
                                                {section.title}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-0">
                                            {section.tasks.map(task => (
                                                <TaskItem
                                                    key={task.id}
                                                    task={task}
                                                    isChecked={checkedTasks.has(task.id)}
                                                    onToggle={handleToggleTask}
                                                />
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </>
    );
};

export default AwardsPresenterManagerPage;