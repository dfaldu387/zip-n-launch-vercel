import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Package, Loader2, PlusCircle, Edit, Trash2, ArrowLeft, Search, ChevronLeft, ChevronRight, Wrench, Layers, Filter } from 'lucide-react';
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
import { useEquipmentList, UNIT_TYPES, CONDITIONS } from '@/hooks/useEquipmentList';

const conditionColors = {
  new: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  good: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  fair: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  poor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  needs_repair: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const EquipmentForm = ({ item, onSave, onCancel, isSaving, allCategories, addCustomCategory, locations = [] }) => {
  const [formData, setFormData] = useState({
    name: '', category: 'General', unit_type: 'each',
    total_qty_owned: 0, condition: 'good', description: '', notes: '',
    default_home_location_id: null,
  });
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryValue, setCustomCategoryValue] = useState('');

  useEffect(() => {
    if (item) {
      setFormData({
        ...item,
        description: item.description || '',
        notes: item.notes || '',
      });
      setIsCustomCategory(false);
      setCustomCategoryValue('');
    } else {
      setFormData({ name: '', category: 'General', unit_type: 'each', total_qty_owned: 0, condition: 'good', description: '', notes: '', default_home_location_id: null });
      setIsCustomCategory(false);
      setCustomCategoryValue('');
    }
  }, [item]);

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleCategoryChange = (value) => {
    if (value === '__custom__') {
      setIsCustomCategory(true);
      setCustomCategoryValue('');
    } else {
      setIsCustomCategory(false);
      handleChange('category', value);
    }
  };

  const handleCustomCategoryConfirm = () => {
    const trimmed = customCategoryValue.trim();
    if (trimmed) {
      addCustomCategory(trimmed);
      handleChange('category', trimmed);
      setIsCustomCategory(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Item Name *</Label>
        <Input id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="e.g., Portable PA Speaker" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          {isCustomCategory ? (
            <div className="flex gap-2">
              <Input
                value={customCategoryValue}
                onChange={e => setCustomCategoryValue(e.target.value)}
                placeholder="New category name"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCustomCategoryConfirm())}
                autoFocus
              />
              <Button type="button" size="sm" onClick={handleCustomCategoryConfirm}>Add</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setIsCustomCategory(false)}>Cancel</Button>
            </div>
          ) : (
            <Select onValueChange={handleCategoryChange} value={formData.category}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
                <SelectItem value="__custom__">+ Add Custom Category</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit_type">Unit Type</Label>
          <Select onValueChange={value => handleChange('unit_type', value)} value={formData.unit_type}>
            <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
            <SelectContent>
              {UNIT_TYPES.map(u => (
                <SelectItem key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="total_qty_owned">Total Qty Owned</Label>
          <Input
            id="total_qty_owned"
            type="number"
            min="0"
            value={formData.total_qty_owned}
            onChange={e => handleChange('total_qty_owned', parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="condition">Condition</Label>
          <Select onValueChange={value => handleChange('condition', value)} value={formData.condition}>
            <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
            <SelectContent>
              {CONDITIONS.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {locations.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="default_home_location_id">Default Home Location</Label>
          <Select
            onValueChange={value => handleChange('default_home_location_id', value === '__none__' ? null : value)}
            value={formData.default_home_location_id || '__none__'}
          >
            <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name} ({loc.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} value={formData.description} onChange={e => handleChange('description', e.target.value)} placeholder="Brief description of the item" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={2} value={formData.notes} onChange={e => handleChange('notes', e.target.value)} placeholder="Additional notes (e.g., storage location, maintenance schedule)" />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
};

const EquipmentManagementPage = () => {
  const navigate = useNavigate();
  const {
    items, count, isLoading, totalPages, summaryStats,
    searchTerm, setSearchTerm,
    categoryFilter, setCategoryFilter,
    conditionFilter, setConditionFilter,
    page, setPage,
    editingItem, isDialogOpen, setIsDialogOpen, isSaving,
    openForm, fetchItems, fetchSummaryStats, saveItem, deleteItem,
    allCategories, addCustomCategory,
    transactionTotals, fetchTransactionTotals,
    locations, fetchLocations,
  } = useEquipmentList();

  useEffect(() => { fetchItems(); fetchSummaryStats(); fetchTransactionTotals(); fetchLocations(); }, [fetchItems, fetchSummaryStats, fetchTransactionTotals, fetchLocations]);

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setPage(0);
  };

  const handleCategoryFilterChange = (value) => {
    setCategoryFilter(value);
    setPage(0);
  };

  const handleConditionFilterChange = (value) => {
    setConditionFilter(value);
    setPage(0);
  };

  const conditionLabel = (value) => CONDITIONS.find(c => c.value === value)?.label || value;

  return (
    <>
      <Helmet><title>Equipment Management - Admin</title></Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
              <Button variant="outline" onClick={() => navigate('/horse-show-manager/equipment-planning')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Equipment Planning
              </Button>
              <Button onClick={() => openForm()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Equipment
              </Button>
            </div>

            {/* Hero */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Package className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Equipment Management</h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Manage your master equipment inventory. This is the single source of truth for all equipment used across your shows.
              </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summaryStats.totalItems}</p>
                      <p className="text-xs text-muted-foreground">Total Items</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                      <Layers className="h-5 w-5 text-green-600 dark:text-green-300" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summaryStats.totalQty}</p>
                      <p className="text-xs text-muted-foreground">Total Quantity</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                      <Filter className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summaryStats.categoriesUsed}</p>
                      <p className="text-xs text-muted-foreground">Categories</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg">
                      <Wrench className="h-5 w-5 text-red-600 dark:text-red-300" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summaryStats.needsRepair}</p>
                      <p className="text-xs text-muted-foreground">Needs Repair</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Table Card */}
            <Card>
              <CardHeader>
                <CardTitle>Equipment Inventory ({count})</CardTitle>
                <CardDescription>Your master list of all equipment items</CardDescription>
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or description..."
                      value={searchTerm}
                      onChange={e => handleSearchChange(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select onValueChange={handleCategoryFilterChange} value={categoryFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {allCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select onValueChange={handleConditionFilterChange} value={conditionFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="All Conditions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Conditions</SelectItem>
                      {CONDITIONS.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm || categoryFilter !== 'all' || conditionFilter !== 'all'
                        ? 'No items match your filters'
                        : 'No equipment items yet'}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm || categoryFilter !== 'all' || conditionFilter !== 'all'
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Add your first piece of equipment to start building your inventory.'}
                    </p>
                    {!(searchTerm || categoryFilter !== 'all' || conditionFilter !== 'all') && (
                      <Button onClick={() => openForm()}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Equipment
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Home Location</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Qty Owned</TableHead>
                          <TableHead className="text-right">Checked Out</TableHead>
                          <TableHead className="text-right">Available</TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.name}</p>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground truncate max-w-[300px]">{item.description}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {locations.find(l => l.id === item.default_home_location_id)?.name || '—'}
                            </TableCell>
                            <TableCell className="text-sm">{item.unit_type}</TableCell>
                            <TableCell className="text-right font-medium">{item.total_qty_owned}</TableCell>
                            <TableCell className="text-right font-medium text-orange-600 dark:text-orange-400">
                              {(transactionTotals[item.id]?.checkedIn || 0) - (transactionTotals[item.id]?.checkedOut || 0)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                              {item.total_qty_owned - ((transactionTotals[item.id]?.checkedIn || 0) - (transactionTotals[item.id]?.checkedOut || 0))}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${conditionColors[item.condition] || ''}`}>
                                {conditionLabel(item.condition)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openForm(item)}>
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
                                      <AlertDialogTitle>Delete Equipment Item</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete "{item.name}". This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteItem(item.id)} className="bg-destructive hover:bg-destructive/90">
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
                        <span className="text-sm text-muted-foreground">
                          Page {page + 1} of {totalPages}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

          </motion.div>
        </main>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Equipment Item</DialogTitle>
            <DialogDescription>
              {editingItem?.id ? 'Update the details for this equipment item.' : 'Add a new item to your equipment inventory.'}
            </DialogDescription>
          </DialogHeader>
          <EquipmentForm
            item={editingItem}
            onSave={saveItem}
            onCancel={() => setIsDialogOpen(false)}
            isSaving={isSaving}
            allCategories={allCategories}
            addCustomCategory={addCustomCategory}
            locations={locations}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EquipmentManagementPage;
