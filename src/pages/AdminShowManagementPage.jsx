import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit, Trash2, Eye, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import Navigation from '@/components/Navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AdminShowManagementPage = () => {
  const [shows, setShows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showToDelete, setShowToDelete] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchShowsAndCreators = async () => {
      setIsLoading(true);
      const { data: showsData, error: showsError } = await supabase
        .from('ep_shows')
        .select('*')
        .order('created_at', { ascending: false });

      if (showsError) {
        toast({
          title: 'Error fetching shows',
          description: showsError.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (showsData && showsData.length > 0) {
        const creatorIds = [...new Set(showsData.map(show => show.created_by).filter(id => id))];
        
        let creatorsMap = {};
        if (creatorIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', creatorIds);

            if (profilesError) {
                toast({
                    title: 'Error fetching creators',
                    description: profilesError.message,
                    variant: 'destructive',
                });
            } else {
                creatorsMap = profilesData.reduce((acc, profile) => {
                    acc[profile.id] = profile;
                    return acc;
                }, {});
            }
        }

        const transformedData = showsData.map(show => {
            const creator = creatorsMap[show.created_by];
            return {
                ...show,
                user: creator ? { full_name: creator.full_name, email: creator.email } : { full_name: 'N/A', email: '' }
            };
        });
        setShows(transformedData);
      } else {
        setShows([]);
      }

      setIsLoading(false);
    };

    fetchShowsAndCreators();
  }, [toast]);

  const handleDeleteShow = async () => {
    if (!showToDelete) return;

    const { error } = await supabase.from('ep_shows').delete().eq('id', showToDelete.id);

    if (error) {
      toast({
        title: 'Error deleting show',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Show Deleted',
        description: `"${showToDelete.name}" has been successfully deleted.`,
      });
      setShows(shows.filter(show => show.id !== showToDelete.id));
    }
    setShowToDelete(null);
  };
  
  const NoShowsFound = () => (
    <div className="text-center py-16">
        <h3 className="text-xl font-semibold">No shows found</h3>
        <p className="text-muted-foreground mt-2 mb-4">It looks like no shows have been created yet.</p>
        <Button onClick={() => navigate('/horse-show-manager/create')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create First Show
        </Button>
    </div>
);

  return (
    <>
      <Helmet>
        <title>Admin: Show Management</title>
        <meta name="description" content="Manage all horse shows created on the platform." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-6">
          <div className="flex items-start justify-between mb-4">
            <AdminBackButton />
            <div className="text-center flex-1">
              <h1 className="text-2xl md:text-3xl font-bold">Show Management</h1>
              <p className="text-sm text-muted-foreground">Oversee and manage all created horse shows.</p>
            </div>
            <div className="w-[70px]" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Shows</CardTitle>
              <CardDescription>A list of all shows created by users.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              ) : shows.length === 0 ? (
                <NoShowsFound />
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Show Name</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created On</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shows.map((show) => (
                        <TableRow key={show.id}>
                          <TableCell className="font-medium">{show.name}</TableCell>
                          <TableCell>
                            <div className="font-medium">{show.user?.full_name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">{show.user?.email}</div>
                          </TableCell>
                          <TableCell>
                            {show.start_date && show.end_date
                              ? `${format(new Date(show.start_date), 'MMM d, yyyy')} - ${format(new Date(show.end_date), 'MMM d, yyyy')}`
                              : 'Not set'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={show.meta?.status === 'published' ? 'default' : 'secondary'}>
                              {show.meta?.status || 'Draft'}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(show.created_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/horse-show-manager/edit/${show.id}`)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/horse-show-manager/show-dashboard/${show.id}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setShowToDelete(show)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <AlertDialog open={!!showToDelete} onOpenChange={() => setShowToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this show?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the show "{showToDelete?.name}" and all of its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteShow} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminShowManagementPage;