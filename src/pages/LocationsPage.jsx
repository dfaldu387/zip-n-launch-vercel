import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { MapPin, Loader2, PlusCircle, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useLocations, LOCATION_TYPES } from '@/hooks/useLocations';

const typeColors = {
  'Show Office': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Ops Office': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  'Arena': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Paddock': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'Announcer Booth': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'Awards': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'Storage': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  'Other': 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
};

const LocationForm = ({ location, onSave, onCancel, isSaving }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'Other',
    description: '',
  });

  useEffect(() => {
    if (location) {
      setFormData({
        name: location.name || '',
        type: location.type || 'Other',
        description: location.description || '',
      });
    } else {
      setFormData({ name: '', type: 'Other', description: '' });
    }
  }, [location]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, id: location?.id });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Location Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g. Arena 1, Show Office"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LOCATION_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Optional notes about this location"
          rows={3}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSaving || !formData.name.trim()}>
          {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : (location ? 'Update' : 'Create')}
        </Button>
      </DialogFooter>
    </form>
  );
};

const LocationsPage = () => {
  const navigate = useNavigate();
  const {
    locations, isLoading, isSaving,
    isDialogOpen, setIsDialogOpen,
    editingLocation,
    fetchLocations, saveLocation, deleteLocation,
    openAdd, openEdit,
  } = useLocations();

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const grouped = LOCATION_TYPES.reduce((acc, type) => {
    const items = locations.filter(l => l.type === type);
    if (items.length > 0) acc[type] = items;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Helmet><title>Locations - EquiPatterns</title></Helmet>
      <Navigation />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate('/horse-show-manager/equipment-planning')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Equipment Planning
          </Button>
        </div>

        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              <MapPin className="h-9 w-9 text-primary" /> Locations
            </h1>
            <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
              Define locations where equipment is stored, staged, or used.
            </p>
          </div>
          <Button onClick={openAdd}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Location
          </Button>
        </header>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-primary">{locations.length}</p>
              <p className="text-sm text-muted-foreground">Total Locations</p>
            </CardContent>
          </Card>
          {['Arena', 'Storage', 'Other'].map(type => (
            <Card key={type}>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold">{locations.filter(l => l.type === type).length}</p>
                <p className="text-sm text-muted-foreground">{type}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Locations</CardTitle>
            <CardDescription>{locations.length} location{locations.length !== 1 ? 's' : ''} defined</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : locations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No locations yet</p>
                <p className="text-sm">Add your first location to get started.</p>
                <Button onClick={openAdd} className="mt-4">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Location
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((loc, index) => (
                    <motion.tr
                      key={loc.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-border"
                    >
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell>
                        <Badge className={typeColors[loc.type] || typeColors['Other']} variant="outline">
                          {loc.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {loc.description || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(loc)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{loc.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove the location. Equipment items using this as their home location will have it cleared.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteLocation(loc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
              <DialogDescription>
                {editingLocation ? 'Update this location.' : 'Create a new location for equipment tracking.'}
              </DialogDescription>
            </DialogHeader>
            <LocationForm
              location={editingLocation}
              onSave={saveLocation}
              onCancel={() => setIsDialogOpen(false)}
              isSaving={isSaving}
            />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default LocationsPage;
