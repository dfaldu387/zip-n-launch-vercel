import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Ruler, Loader2, PlusCircle, Edit, Trash2, ArrowLeft, Search, Copy, Package, Layers, FolderPlus } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useDisciplinePlanner } from '@/hooks/useDisciplinePlanner';
import EquipmentPicker from '@/components/equipment-planner/EquipmentPicker';

// ---- Inline editable quantity with debounce ----
const DebouncedQuantityInput = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef(null);

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleChange = (e) => {
    const v = parseInt(e.target.value, 10) || 1;
    setLocalValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 500);
  };

  return <Input type="number" min={1} value={localValue} onChange={handleChange} className="w-20 h-8 text-center" />;
};

// ---- Equipment Module Table (reusable for baseline + modules) ----
const EquipmentModuleTable = ({ items, onUpdateQty, onToggleOptional, onRemove, onChangeModule, allModuleNames }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Equipment</TableHead>
        <TableHead>Category</TableHead>
        <TableHead className="text-center">Qty</TableHead>
        <TableHead className="text-center">Optional</TableHead>
        <TableHead>Module</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map(row => (
        <TableRow key={row.id}>
          <TableCell>
            <p className="font-medium text-sm">{row.equipment_items?.name}</p>
            <p className="text-xs text-muted-foreground">{row.equipment_items?.unit_type}</p>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs">{row.equipment_items?.category}</Badge>
          </TableCell>
          <TableCell className="text-center">
            <DebouncedQuantityInput value={row.quantity} onChange={(v) => onUpdateQty(row.id, v)} />
          </TableCell>
          <TableCell className="text-center">
            <Switch checked={row.is_optional} onCheckedChange={(checked) => onToggleOptional(row.id, checked)} />
          </TableCell>
          <TableCell>
            <Select value={row.module_name || '__none__'} onValueChange={(v) => onChangeModule(row.id, v === '__none__' ? null : v)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Standard Kit</SelectItem>
                {allModuleNames.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="text-right">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Equipment</AlertDialogTitle>
                  <AlertDialogDescription>Remove "{row.equipment_items?.name}" from this discipline?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onRemove(row.id)} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const ClassTemplateForm = ({ template, disciplines, onSave, onCancel, isSaving }) => {
  const [formData, setFormData] = useState({
    name: '', discipline_id: '', default_arena_type: '', setup_notes: '', staff_notes: '',
  });

  useEffect(() => {
    if (template) {
      setFormData({
        ...template,
        default_arena_type: template.default_arena_type || '',
        setup_notes: template.setup_notes || '',
        staff_notes: template.staff_notes || '',
      });
    } else {
      setFormData({ name: '', discipline_id: '', default_arena_type: '', setup_notes: '', staff_notes: '' });
    }
  }, [template]);

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tmpl-name">Template Name *</Label>
        <Input id="tmpl-name" value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="e.g., Youth Trail Setup" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Discipline *</Label>
          <Select onValueChange={v => handleChange('discipline_id', v)} value={formData.discipline_id}>
            <SelectTrigger><SelectValue placeholder="Select discipline" /></SelectTrigger>
            <SelectContent>
              {disciplines.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="arena-type">Default Arena Type</Label>
          <Input id="arena-type" value={formData.default_arena_type} onChange={e => handleChange('default_arena_type', e.target.value)} placeholder="e.g., Main Arena" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="setup-notes">Setup Notes</Label>
        <Textarea id="setup-notes" rows={2} value={formData.setup_notes} onChange={e => handleChange('setup_notes', e.target.value)} placeholder="Equipment setup instructions" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="staff-notes">Staff Notes</Label>
        <Textarea id="staff-notes" rows={2} value={formData.staff_notes} onChange={e => handleChange('staff_notes', e.target.value)} placeholder="Staffing requirements and notes" />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSaving || !formData.name || !formData.discipline_id}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
        </Button>
      </DialogFooter>
    </form>
  );
};

// ---- Main Page ----
const DisciplinePlannerPage = () => {
  const navigate = useNavigate();
  const {
    disciplines, isDisciplinesLoading, disciplineSearch, setDisciplineSearch,
    selectedDiscipline, setSelectedDiscipline, fetchDisciplines,
    disciplineEquipment, isDisciplineEquipmentLoading,
    fetchDisciplineEquipment, addDisciplineEquipment, updateDisciplineEquipment, removeDisciplineEquipment,
    classTemplates, isTemplatesLoading, selectedTemplate, setSelectedTemplate,
    templateDisciplineFilter, setTemplateDisciplineFilter,
    isSavingTemplate, isTemplateDialogOpen, setIsTemplateDialogOpen,
    editingTemplate, setEditingTemplate,
    fetchClassTemplates, saveClassTemplate, deleteClassTemplate, duplicateClassTemplate,
    templateEquipment, isTemplateEquipmentLoading,
    fetchTemplateEquipment, addTemplateEquipment, updateTemplateEquipment, removeTemplateEquipment,
    fetchUserEquipment,
  } = useDisciplinePlanner();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerContext, setPickerContext] = useState(null); // 'discipline' | 'template'
  const [pickerModuleName, setPickerModuleName] = useState(null); // module to assign when adding from picker
  const [inheritedEquipment, setInheritedEquipment] = useState([]);
  const [newModuleName, setNewModuleName] = useState('');
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);

  useEffect(() => { fetchDisciplines(); }, [fetchDisciplines]);
  useEffect(() => { fetchClassTemplates(); }, [fetchClassTemplates]);

  // When discipline selected, fetch its equipment
  const handleSelectDiscipline = (disc) => {
    setSelectedDiscipline(disc);
    fetchDisciplineEquipment(disc.id);
  };

  // When template selected, fetch its equipment + inherited from discipline
  const handleSelectTemplate = (tmpl) => {
    setSelectedTemplate(tmpl);
    fetchTemplateEquipment(tmpl.id);
    // Reuse the hook to fetch inherited discipline baseline
    fetchDisciplineEquipment(tmpl.discipline_id);
  };

  // Keep inherited equipment in sync with disciplineEquipment when viewing templates
  useEffect(() => {
    if (selectedTemplate) {
      setInheritedEquipment(disciplineEquipment);
    }
  }, [disciplineEquipment, selectedTemplate]);

  // Equipment picker handlers
  const openPickerForDiscipline = (moduleName = null) => {
    setPickerContext('discipline');
    setPickerModuleName(moduleName);
    setIsPickerOpen(true);
  };

  const openPickerForTemplate = () => {
    setPickerContext('template');
    setPickerModuleName(null);
    setIsPickerOpen(true);
  };

  const handlePickerSelect = (item) => {
    if (pickerContext === 'discipline' && selectedDiscipline) {
      addDisciplineEquipment({
        discipline_id: selectedDiscipline.id,
        equipment_id: item.id,
        module_name: pickerModuleName,
      });
    } else if (pickerContext === 'template' && selectedTemplate) {
      addTemplateEquipment(selectedTemplate.id, item.id);
    }
  };

  // Compute module groupings for discipline equipment
  const moduleGroups = useMemo(() => {
    const groups = {};
    for (const row of disciplineEquipment) {
      const key = row.module_name || '__baseline__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return groups;
  }, [disciplineEquipment]);

  const moduleNames = useMemo(() => {
    return [...new Set(disciplineEquipment.map(r => r.module_name).filter(Boolean))];
  }, [disciplineEquipment]);

  const handleCreateModule = () => {
    if (newModuleName.trim()) {
      openPickerForDiscipline(newModuleName.trim());
      setNewModuleName('');
      setIsModuleDialogOpen(false);
    }
  };

  const getPickerExcludeIds = () => {
    if (pickerContext === 'discipline') {
      return disciplineEquipment.map(de => de.equipment_id);
    }
    if (pickerContext === 'template') {
      const inherited = inheritedEquipment.map(ie => ie.equipment_id);
      const templateIds = templateEquipment.map(te => te.equipment_id);
      return [...inherited, ...templateIds];
    }
    return [];
  };

  // Filtered discipline list
  const filteredDisciplines = disciplines.filter(d =>
    !disciplineSearch || d.name.toLowerCase().includes(disciplineSearch.toLowerCase())
  );

  return (
    <>
      <Helmet><title>Discipline & Class Planner - Admin</title></Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
              <Button variant="outline" onClick={() => navigate('/horse-show-manager/equipment-planning')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Equipment Planning
              </Button>
            </div>

            {/* Hero */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Ruler className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Discipline & Class Planner</h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Define baseline equipment kits for each discipline and create reusable class templates.
              </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="discipline-profiles" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="discipline-profiles">Discipline Equipment Profiles</TabsTrigger>
                <TabsTrigger value="class-templates">Class Templates</TabsTrigger>
              </TabsList>

              {/* ==================== TAB 1: DISCIPLINE PROFILES ==================== */}
              <TabsContent value="discipline-profiles">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Left: Discipline list */}
                  <Card className="w-full md:w-1/3">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Disciplines</CardTitle>
                      <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search disciplines..."
                          value={disciplineSearch}
                          onChange={e => setDisciplineSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[500px]">
                        {isDisciplinesLoading ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : filteredDisciplines.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8 text-sm">No disciplines found.</p>
                        ) : (
                          filteredDisciplines.map(disc => (
                            <button
                              key={disc.id}
                              onClick={() => handleSelectDiscipline(disc)}
                              className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-accent ${
                                selectedDiscipline?.id === disc.id ? 'bg-accent border-l-2 border-l-primary' : ''
                              }`}
                            >
                              <p className="font-medium text-sm">{disc.name}</p>
                              <div className="flex gap-2 mt-1">
                                {disc.associations?.name && (
                                  <Badge variant="outline" className="text-xs">{disc.associations.name}</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">{disc.category?.replace(/_/g, ' ')}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Right: Equipment kit */}
                  <Card className="w-full md:w-2/3">
                    {!selectedDiscipline ? (
                      <CardContent className="flex flex-col items-center justify-center py-20">
                        <Ruler className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Select a Discipline</h3>
                        <p className="text-muted-foreground text-sm">Choose a discipline from the list to view and edit its equipment profile.</p>
                      </CardContent>
                    ) : (
                      <>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>{selectedDiscipline.name}</CardTitle>
                              <CardDescription className="mt-1">
                                {selectedDiscipline.associations?.name && (
                                  <Badge variant="outline" className="mr-2">{selectedDiscipline.associations.name}</Badge>
                                )}
                                {selectedDiscipline.pattern_type && (
                                  <span className="text-xs">Pattern: {selectedDiscipline.pattern_type}</span>
                                )}
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={() => openPickerForDiscipline(null)} size="sm">
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Equipment
                              </Button>
                              <Button onClick={() => setIsModuleDialogOpen(true)} size="sm" variant="outline">
                                <FolderPlus className="mr-2 h-4 w-4" /> New Module
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {isDisciplineEquipmentLoading ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : disciplineEquipment.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                              <p className="text-sm">No equipment assigned yet.</p>
                              <p className="text-xs mt-1">Click "Add Equipment" to build the baseline kit or create an optional module.</p>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {/* Baseline equipment (no module) */}
                              {moduleGroups['__baseline__'] && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                    <Package className="h-4 w-4" /> Standard Kit
                                    <Badge variant="secondary" className="text-xs">{moduleGroups['__baseline__'].length} items</Badge>
                                  </h4>
                                  <EquipmentModuleTable
                                    items={moduleGroups['__baseline__']}
                                    onUpdateQty={(id, v) => updateDisciplineEquipment(id, { quantity: v })}
                                    onToggleOptional={(id, checked) => updateDisciplineEquipment(id, { is_optional: checked })}
                                    onRemove={(id) => removeDisciplineEquipment(id, selectedDiscipline.id)}
                                    onChangeModule={(id, moduleName) => updateDisciplineEquipment(id, { module_name: moduleName || null })}
                                    allModuleNames={moduleNames}
                                  />
                                </div>
                              )}

                              {/* Optional modules */}
                              {Object.entries(moduleGroups)
                                .filter(([key]) => key !== '__baseline__')
                                .map(([moduleName, items]) => (
                                  <div key={moduleName} className="border rounded-lg p-4 bg-muted/30">
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary" /> {moduleName}
                                        <Badge className="text-xs">{items.length} items</Badge>
                                        <Badge variant="outline" className="text-xs">Optional Module</Badge>
                                      </h4>
                                      <Button size="sm" variant="ghost" onClick={() => openPickerForDiscipline(moduleName)}>
                                        <PlusCircle className="mr-1 h-3 w-3" /> Add
                                      </Button>
                                    </div>
                                    <EquipmentModuleTable
                                      items={items}
                                      onUpdateQty={(id, v) => updateDisciplineEquipment(id, { quantity: v })}
                                      onToggleOptional={(id, checked) => updateDisciplineEquipment(id, { is_optional: checked })}
                                      onRemove={(id) => removeDisciplineEquipment(id, selectedDiscipline.id)}
                                      onChangeModule={(id, newModName) => updateDisciplineEquipment(id, { module_name: newModName || null })}
                                      allModuleNames={moduleNames}
                                    />
                                  </div>
                                ))}
                            </div>
                          )}
                        </CardContent>
                      </>
                    )}
                  </Card>
                </div>
              </TabsContent>

              {/* ==================== TAB 2: CLASS TEMPLATES ==================== */}
              <TabsContent value="class-templates">
                {/* Top controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <Select onValueChange={v => setTemplateDisciplineFilter(v)} value={templateDisciplineFilter}>
                    <SelectTrigger className="w-full sm:w-[250px]">
                      <SelectValue placeholder="All Disciplines" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Disciplines</SelectItem>
                      {disciplines.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => { setEditingTemplate(null); setIsTemplateDialogOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> New Template
                  </Button>
                </div>

                {/* Template list */}
                <Card>
                  <CardContent className="p-0">
                    {isTemplatesLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : classTemplates.length === 0 ? (
                      <div className="text-center py-12">
                        <Ruler className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No class templates yet</h3>
                        <p className="text-muted-foreground text-sm mb-4">Create reusable templates for your classes.</p>
                        <Button onClick={() => { setEditingTemplate(null); setIsTemplateDialogOpen(true); }}>
                          <PlusCircle className="mr-2 h-4 w-4" /> New Template
                        </Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Template Name</TableHead>
                            <TableHead>Discipline</TableHead>
                            <TableHead>Arena Type</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classTemplates.map(tmpl => (
                            <TableRow
                              key={tmpl.id}
                              className={`cursor-pointer ${selectedTemplate?.id === tmpl.id ? 'bg-accent' : ''}`}
                              onClick={() => handleSelectTemplate(tmpl)}
                            >
                              <TableCell className="font-medium">{tmpl.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{tmpl.disciplines?.name || 'Unknown'}</Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{tmpl.default_arena_type || 'Any'}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" onClick={() => { setEditingTemplate(tmpl); setIsTemplateDialogOpen(true); }}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => duplicateClassTemplate(tmpl.id)}>
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Template</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Delete "{tmpl.name}" and all its equipment assignments? This cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteClassTemplate(tmpl.id)} className="bg-destructive hover:bg-destructive/90">
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
                    )}
                  </CardContent>
                </Card>

                {/* Template detail */}
                {selectedTemplate && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="mt-6">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{selectedTemplate.name} - Equipment</CardTitle>
                            {selectedTemplate.setup_notes && (
                              <CardDescription className="mt-1">{selectedTemplate.setup_notes}</CardDescription>
                            )}
                          </div>
                          <Button onClick={openPickerForTemplate} size="sm">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Equipment
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Inherited from discipline */}
                        {inheritedEquipment.length > 0 && (
                          <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                              Inherited from Discipline
                              <Badge variant="secondary" className="text-xs">Read-only</Badge>
                            </h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Equipment</TableHead>
                                  <TableHead>Category</TableHead>
                                  <TableHead className="text-center">Qty</TableHead>
                                  <TableHead>Type</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {inheritedEquipment.map(row => (
                                  <TableRow key={row.id} className="opacity-60">
                                    <TableCell className="text-sm">{row.equipment_items?.name}</TableCell>
                                    <TableCell><Badge variant="outline" className="text-xs">{row.equipment_items?.category}</Badge></TableCell>
                                    <TableCell className="text-center text-sm">{row.quantity} {row.equipment_items?.unit_type}</TableCell>
                                    <TableCell className="text-xs">{row.is_optional ? 'Optional' : 'Required'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {/* Template-specific equipment */}
                        <h4 className="font-semibold text-sm mb-2">Additional Equipment</h4>
                        {isTemplateEquipmentLoading ? (
                          <div className="flex justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : templateEquipment.length === 0 ? (
                          <p className="text-center text-muted-foreground text-sm py-6">
                            No additional equipment. Click "Add Equipment" to add items beyond the discipline baseline.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Equipment</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-center">Qty</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {templateEquipment.map(row => (
                                <TableRow key={row.id}>
                                  <TableCell>
                                    <p className="font-medium text-sm">{row.equipment_items?.name}</p>
                                    <p className="text-xs text-muted-foreground">{row.equipment_items?.unit_type}</p>
                                  </TableCell>
                                  <TableCell><Badge variant="outline" className="text-xs">{row.equipment_items?.category}</Badge></TableCell>
                                  <TableCell className="text-center">
                                    <DebouncedQuantityInput
                                      value={row.quantity}
                                      onChange={(v) => updateTemplateEquipment(row.id, v, selectedTemplate.id)}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Remove Equipment</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Remove "{row.equipment_items?.name}" from this template?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => removeTemplateEquipment(row.id, selectedTemplate.id)} className="bg-destructive hover:bg-destructive/90">
                                            Remove
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </TabsContent>
            </Tabs>

          </motion.div>
        </main>
      </div>

      {/* Template Create/Edit Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingTemplate?.id ? 'Edit' : 'Create'} Class Template</DialogTitle>
            <DialogDescription>
              {editingTemplate?.id ? 'Update the template details.' : 'Create a new reusable class template.'}
            </DialogDescription>
          </DialogHeader>
          <ClassTemplateForm
            template={editingTemplate}
            disciplines={disciplines}
            onSave={saveClassTemplate}
            onCancel={() => setIsTemplateDialogOpen(false)}
            isSaving={isSavingTemplate}
          />
        </DialogContent>
      </Dialog>

      {/* Shared Equipment Picker */}
      <EquipmentPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handlePickerSelect}
        excludeIds={getPickerExcludeIds()}
        fetchUserEquipment={fetchUserEquipment}
      />

      {/* New Module Dialog */}
      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create Optional Module</DialogTitle>
            <DialogDescription>
              Create a named optional equipment module (e.g., "Gate Kit", "Measurement Kit", "Signage Kit").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="module-name">Module Name *</Label>
              <Input
                id="module-name"
                value={newModuleName}
                onChange={e => setNewModuleName(e.target.value)}
                placeholder="e.g., Gate Kit"
                onKeyDown={e => e.key === 'Enter' && handleCreateModule()}
              />
            </div>
            {moduleNames.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Existing modules:</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {moduleNames.map(m => (
                    <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModuleDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateModule} disabled={!newModuleName.trim()}>
                Create & Add Equipment
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DisciplinePlannerPage;
