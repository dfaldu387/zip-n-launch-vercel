import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import {
    Circle,
    Paperclip,
    Link2,
    Send,
    ExternalLink,
    FileText,
    Clock,
    Calendar,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


const ProjectDetailModal = ({ 
    open, 
    onClose, 
    project, 
    onRefresh,
    isFromJudgesPortal = false
}) => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const [description, setDescription] = useState('');
    const [newComment, setNewComment] = useState('');
    const [comments, setComments] = useState([]);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentText, setEditingCommentText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const isPatternBook = project?.project_type === 'pattern_book';
    // Add judgeView mode param when opening from Judges Portal
    const editPath = isPatternBook
        ? `/pattern-book-builder/${project?.id}${isFromJudgesPortal ? '?mode=judgeView' : ''}`
        : `/horse-show-manager/edit/${project?.id}${isFromJudgesPortal ? '?mode=judgeView' : ''}`;

    useEffect(() => {
        if (project) {
            setDescription(project.project_data?.description || '');
            setComments(project.project_data?.comments || []);
        }
    }, [project]);

    // Check if current user is assigned as a judge/staff in this project
    const getAssignedNameForProject = () => {
        const userEmail = user?.email?.toLowerCase();
        if (!userEmail || !project?.project_data) return null;
        
        // Check in associationJudges (judges data from Step 3/4)
        // Structure: associationJudges[assocId] = { count: number, judges: [...] }
        const associationJudges = project.project_data.associationJudges || {};
        for (const assocId in associationJudges) {
            const assocData = associationJudges[assocId];
            // Handle nested structure: { judges: [...] }
            const judgesList = assocData?.judges || (Array.isArray(assocData) ? assocData : []);
            if (Array.isArray(judgesList)) {
                const matchedJudge = judgesList.find(j => j.email?.toLowerCase() === userEmail);
                if (matchedJudge?.name) return matchedJudge.name;
            }
        }
        
        // Check in officials (staff data from Step 4)
        const officials = project.project_data.officials || [];
        const matchedOfficial = officials.find(o => o.email?.toLowerCase() === userEmail);
        if (matchedOfficial?.name) return matchedOfficial.name;
        
        return null;
    };
    
    const assignedName = getAssignedNameForProject();
    const currentUserName = assignedName || profile?.full_name || user?.email || 'User';
    const userInitials = currentUserName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const handleSaveDescription = async () => {
        if (!project) return;
        setIsSaving(true);
        try {
            const updatedData = { ...project.project_data, description };
            await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', project.id);
            toast({ title: "Description saved" });
        } catch (error) {
            toast({ title: "Error saving description", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !project) return;
        
        const comment = {
            id: Date.now().toString(),
            text: newComment,
            author: currentUserName,
            authorId: user?.id,
            createdAt: new Date().toISOString(),
        };
        
        const updatedComments = [comment, ...comments];
        setComments(updatedComments);
        setNewComment('');
        
        try {
            const updatedData = { ...project.project_data, comments: updatedComments };
            await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', project.id);
            // Don't call onRefresh here to prevent modal from closing
        } catch (error) {
            toast({ title: "Error saving comment", variant: "destructive" });
        }
    };

    const handleEditComment = async (commentId, newText) => {
        const updatedComments = comments.map(c => 
            c.id === commentId ? { ...c, text: newText, editedAt: new Date().toISOString() } : c
        );
        setComments(updatedComments);
        setEditingCommentId(null);
        setEditingCommentText('');
        
        try {
            const updatedData = { ...project.project_data, comments: updatedComments };
            await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', project.id);
        } catch (error) {
            toast({ title: "Error updating comment", variant: "destructive" });
        }
    };

    const handleDeleteComment = async (commentId) => {
        const updatedComments = comments.filter(c => c.id !== commentId);
        setComments(updatedComments);
        
        try {
            const updatedData = { ...project.project_data, comments: updatedComments };
            await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', project.id);
            toast({ title: "Comment deleted" });
        } catch (error) {
            toast({ title: "Error deleting comment", variant: "destructive" });
        }
    };

    // Check if project is locked (status is "Lock & Approve Mode")
    const isLocked = project?.status === 'Lock & Approve Mode';
    
    const handleOpenProject = () => {
        if (isLocked) {
            toast({
                variant: "destructive",
                title: "Pattern Book Locked",
                description: "Your pattern is Lock & Approve Mode. You cannot edit it.",
            });
            return;
        }
        navigate(editPath);
        onClose();
    };

    if (!project) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onClose();
            }}
        >
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
                <div className="flex flex-col lg:flex-row h-[calc(90vh-40px)]">
                    {/* Left Side - Project Details */}
                    <div className="flex-1 p-6 overflow-y-auto border-r border-border">
                        {/* Title Section */}
                        <div className="flex items-start gap-3 mb-6">
                            <Circle className="h-5 w-5 mt-1 text-muted-foreground" />
                            <div className="flex-1">
                                <h2 className="text-xl font-semibold">{project.project_name || 'Untitled Project'}</h2>
                                <p className="text-sm text-muted-foreground">
                                    {isPatternBook ? 'Pattern Book' : 'Horse Show'}
                                </p>
                            </div>
                        </div>

                        {/* Project Info */}
                        <div className="space-y-3 mb-6 p-4 rounded-lg border bg-muted/30">
                            {/* Last Saved */}
                            {project.updated_at && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Last saved:</span>
                                    <span>{format(new Date(project.updated_at), "MMMM d, yyyy 'at' h:mm a")}</span>
                                </div>
                            )}
                            
                            {/* Due Date */}
                            {project.project_data?.dueDate && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Due:</span>
                                    <span>{format(new Date(project.project_data.dueDate), "MMM d, yyyy")}</span>
                                </div>
                            )}
                            
                            {/* Status */}
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge variant={project.status === 'Lock & Approve Mode' ? 'default' : 'secondary'}>
                                    {project.status === 'Lock & Approve Mode' ? 'Lock & Approve Mode' : project.status === 'Draft' ? 'Draft' : project.status || 'In Progress'}
                                </Badge>
                            </div>
                        </div>

                        {/* Link to editor */}
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Open editor</p>
                            <div className={cn(
                                "flex items-center justify-between p-3 border rounded-lg transition-colors",
                                isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"
                            )}>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded">
                                        <Link2 className="h-4 w-4 text-primary" />
                                    </div>
                                    <button
                                        onClick={handleOpenProject}
                                        disabled={isLocked}
                                        className={cn(
                                            "text-sm font-medium",
                                            isLocked ? "text-muted-foreground cursor-not-allowed" : "text-primary hover:underline"
                                        )}
                                    >
                                        Open {isPatternBook ? 'Pattern Book' : 'Show'} Editor
                                    </button>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8" 
                                    onClick={handleOpenProject}
                                    disabled={isLocked}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Comments */}
                    <div className="w-full lg:w-[380px] flex flex-col bg-muted/30">
                        {/* Comments Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="font-medium">Comments and activity</span>
                            </div>
                            <Button variant="ghost" size="sm">Show details</Button>
                        </div>

                        {/* Comment Input */}
                        <div className="p-4 border-b border-border">
                            <div className="flex gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                        {userInitials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 relative">
                                    <Input
                                        placeholder="Write a comment..."
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                                        className="pr-10"
                                    />
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                        onClick={handleAddComment}
                                        disabled={!newComment.trim()}
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Comments List */}
                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-4">
                                {comments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        No comments yet. Be the first to comment!
                                    </p>
                                ) : (
                                    comments.map((comment) => {
                                        const commentInitials = comment.author?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
                                        const isOwner = comment.authorId === user?.id;
                                        
                                        return (
                                            <div key={comment.id} className="flex gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="bg-amber-500 text-white text-xs">
                                                        {commentInitials}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-sm">{comment.author}</span>
                                                        <span className="text-xs text-primary hover:underline cursor-pointer">
                                                            {format(new Date(comment.createdAt), "MMM d, yyyy, h:mm a")}
                                                        </span>
                                                    </div>
                                                    
                                                    {editingCommentId === comment.id ? (
                                                        <div className="space-y-2">
                                                            <Textarea
                                                                value={editingCommentText}
                                                                onChange={(e) => setEditingCommentText(e.target.value)}
                                                                className="min-h-[60px]"
                                                            />
                                                            <div className="flex gap-2">
                                                                <Button 
                                                                    size="sm" 
                                                                    onClick={() => handleEditComment(comment.id, editingCommentText)}
                                                                >
                                                                    Save
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline" 
                                                                    onClick={() => {
                                                                        setEditingCommentId(null);
                                                                        setEditingCommentText('');
                                                                    }}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="bg-background p-3 rounded-lg border text-sm">
                                                                {comment.text}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                                <Paperclip className="h-3 w-3" />
                                                                {isOwner && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <button 
                                                                            className="hover:text-foreground"
                                                                            onClick={() => {
                                                                                setEditingCommentId(comment.id);
                                                                                setEditingCommentText(comment.text);
                                                                            }}
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <span>•</span>
                                                                        <button 
                                                                            className="hover:text-destructive"
                                                                            onClick={() => handleDeleteComment(comment.id)}
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectDetailModal;
