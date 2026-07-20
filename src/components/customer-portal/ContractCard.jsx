import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, Edit, Eye, FileSignature, MoreVertical, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';

const ContractCard = ({ project, onRefresh }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const projectData = project.project_data || {};
    const hasLinkedShow = !!projectData.linkedProjectId;
    const showName = projectData.showName || projectData.showDetails?.showName;
    const status = project.status || 'Draft';
    const createdAt = project.created_at ? format(new Date(project.created_at), 'MMM d, yyyy') : '—';

    const statusColor = {
        Draft: 'bg-gray-100 text-gray-700',
        'In progress': 'bg-blue-100 text-blue-700',
        Locked: 'bg-amber-100 text-amber-700',
        Final: 'bg-green-100 text-green-700',
    }[status] || 'bg-gray-100 text-gray-700';

    const handleDelete = async () => {
        const { error } = await supabase.from('projects').delete().eq('id', project.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Delete failed', description: error.message });
        } else {
            toast({ title: 'Contract deleted' });
            onRefresh?.();
        }
    };

    return (
        <Card className="group relative flex flex-col hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileSignature className="h-5 w-5 text-primary shrink-0" />
                        <CardTitle className="text-base truncate">{project.project_name || 'Untitled Contract'}</CardTitle>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/horse-show-manager/employee-management/contracts/${project.id}`)}>
                                <Eye className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/horse-show-manager/employee-management/contracts/${project.id}`)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <CardDescription className="text-xs mt-1">Created {createdAt}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-3">
                <div className="flex flex-wrap gap-1.5 mt-1">
                    <Badge variant="outline" className={statusColor}>{status}</Badge>
                    {hasLinkedShow ? (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">Linked to Show</Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">Unassigned</Badge>
                    )}
                </div>
                {showName && (
                    <p className="text-xs text-muted-foreground mt-2 truncate">Show: {showName}</p>
                )}
            </CardContent>
            <CardFooter className="pt-0">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/horse-show-manager/employee-management/contracts/${project.id}`)}
                >
                    <ArrowRight className="mr-2 h-4 w-4" /> Open Contract
                </Button>
            </CardFooter>
        </Card>
    );
};

export default ContractCard;
