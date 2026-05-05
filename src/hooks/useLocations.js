import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export const LOCATION_TYPES = [
  'Show Office',
  'Ops Office',
  'Arena',
  'Paddock',
  'Announcer Booth',
  'Awards',
  'Storage',
  'Other',
];

export const useLocations = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  const fetchLocations = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', user.id)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast({ title: 'Error', description: 'Failed to load locations.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const saveLocation = useCallback(async (locationData) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: locationData.name.trim(),
        type: locationData.type,
        description: locationData.description?.trim() || null,
      };

      let error;
      if (locationData.id) {
        ({ error } = await supabase
          .from('locations')
          .update(payload)
          .eq('id', locationData.id));
      } else {
        ({ error } = await supabase
          .from('locations')
          .insert(payload));
      }

      if (error) throw error;
      toast({ title: 'Success', description: `Location ${locationData.id ? 'updated' : 'created'}.` });
      setIsDialogOpen(false);
      setEditingLocation(null);
      await fetchLocations();
    } catch (error) {
      console.error('Error saving location:', error);
      const msg = error.message?.includes('locations_user_name_unique')
        ? 'A location with that name already exists.'
        : 'Failed to save location.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [user, toast, fetchLocations]);

  const deleteLocation = useCallback(async (locationId) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;
      toast({ title: 'Deleted', description: 'Location removed.' });
      await fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({ title: 'Error', description: 'Failed to delete location. It may be in use by equipment items.', variant: 'destructive' });
    }
  }, [user, toast, fetchLocations]);

  const openAdd = useCallback(() => {
    setEditingLocation(null);
    setIsDialogOpen(true);
  }, []);

  const openEdit = useCallback((location) => {
    setEditingLocation(location);
    setIsDialogOpen(true);
  }, []);

  return {
    locations,
    isLoading,
    isSaving,
    isDialogOpen,
    setIsDialogOpen,
    editingLocation,
    fetchLocations,
    saveLocation,
    deleteLocation,
    openAdd,
    openEdit,
  };
};
