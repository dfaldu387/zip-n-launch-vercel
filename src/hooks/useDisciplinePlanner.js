import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export const useDisciplinePlanner = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Disciplines (shared reference table)
  const [disciplines, setDisciplines] = useState([]);
  const [isDisciplinesLoading, setIsDisciplinesLoading] = useState(true);
  const [disciplineSearch, setDisciplineSearch] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState(null);

  // Discipline Equipment
  const [disciplineEquipment, setDisciplineEquipment] = useState([]);
  const [isDisciplineEquipmentLoading, setIsDisciplineEquipmentLoading] = useState(false);

  // Class Templates
  const [classTemplates, setClassTemplates] = useState([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateDisciplineFilter, setTemplateDisciplineFilter] = useState('all');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Template Equipment
  const [templateEquipment, setTemplateEquipment] = useState([]);
  const [isTemplateEquipmentLoading, setIsTemplateEquipmentLoading] = useState(false);

  // ---- DISCIPLINES ----

  const fetchDisciplines = useCallback(async (search = '') => {
    setIsDisciplinesLoading(true);

    // Fetch disciplines and associations in parallel (no FK relationship between them)
    const [discResult, assocResult] = await Promise.all([
      (() => {
        let q = supabase.from('disciplines').select('id, name, association_id, category, pattern_type, sort_order');
        if (search) q = q.ilike('name', `%${search}%`);
        return q.order('sort_order').order('name');
      })(),
      supabase.from('associations').select('id, name'),
    ]);

    if (discResult.error) {
      toast({ title: 'Error fetching disciplines', description: discResult.error.message, variant: 'destructive' });
    } else {
      const assocMap = {};
      (assocResult.data || []).forEach(a => { assocMap[a.id] = a; });
      const enriched = (discResult.data || []).map(d => ({
        ...d,
        associations: assocMap[d.association_id] || null,
      }));
      setDisciplines(enriched);
    }
    setIsDisciplinesLoading(false);
  }, [toast]);

  // ---- DISCIPLINE EQUIPMENT ----

  const fetchDisciplineEquipment = useCallback(async (disciplineId) => {
    if (!user || !disciplineId) return;
    setIsDisciplineEquipmentLoading(true);

    const { data, error } = await supabase
      .from('discipline_equipment')
      .select('*, equipment_items(id, name, category, unit_type, total_qty_owned, condition)')
      .eq('user_id', user.id)
      .eq('discipline_id', disciplineId)
      .order('module_name', { ascending: true, nullsFirst: true })
      .order('created_at');

    if (error) {
      toast({ title: 'Error fetching discipline equipment', description: error.message, variant: 'destructive' });
    } else {
      setDisciplineEquipment(data || []);
    }
    setIsDisciplineEquipmentLoading(false);
  }, [user, toast]);

  const addDisciplineEquipment = useCallback(async (payload) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('discipline_equipment')
      .insert({
        user_id: user.id,
        discipline_id: payload.discipline_id,
        equipment_id: payload.equipment_id,
        quantity: payload.quantity || 1,
        is_optional: payload.is_optional || false,
        module_name: payload.module_name || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already assigned', description: 'This equipment is already assigned to this discipline.', variant: 'destructive' });
      } else {
        toast({ title: 'Error adding equipment', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Equipment added to discipline!' });
      fetchDisciplineEquipment(payload.discipline_id);
    }
  }, [user, toast, fetchDisciplineEquipment]);

  const updateDisciplineEquipment = useCallback(async (id, updates) => {
    if (!user) return;

    const { error } = await supabase
      .from('discipline_equipment')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error updating', description: error.message, variant: 'destructive' });
    }
  }, [user, toast]);

  const removeDisciplineEquipment = useCallback(async (id, disciplineId) => {
    if (!user) return;

    const { error } = await supabase
      .from('discipline_equipment')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error removing equipment', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Equipment removed from discipline.' });
      fetchDisciplineEquipment(disciplineId);
    }
  }, [user, toast, fetchDisciplineEquipment]);

  // ---- CLASS TEMPLATES ----

  const fetchClassTemplates = useCallback(async () => {
    if (!user) return;
    setIsTemplatesLoading(true);

    let query = supabase
      .from('class_templates')
      .select('*, disciplines(id, name)')
      .eq('user_id', user.id);

    if (templateDisciplineFilter && templateDisciplineFilter !== 'all') {
      query = query.eq('discipline_id', templateDisciplineFilter);
    }

    query = query.order('name');

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error fetching templates', description: error.message, variant: 'destructive' });
    } else {
      setClassTemplates(data || []);
    }
    setIsTemplatesLoading(false);
  }, [user, templateDisciplineFilter, toast]);

  const saveClassTemplate = useCallback(async (formData) => {
    if (!user) return;
    setIsSavingTemplate(true);

    const { id, created_at, updated_at, disciplines: _d, ...payload } = formData;
    payload.user_id = user.id;

    let result;
    if (id) {
      result = await supabase
        .from('class_templates')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('class_templates')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      toast({ title: 'Error saving template', description: result.error.message, variant: 'destructive' });
    } else {
      toast({ title: `Template ${id ? 'updated' : 'created'} successfully!` });
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
      fetchClassTemplates();
    }
    setIsSavingTemplate(false);
  }, [user, toast, fetchClassTemplates]);

  const deleteClassTemplate = useCallback(async (templateId) => {
    if (!user) return;

    const { error } = await supabase
      .from('class_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error deleting template', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Template deleted.' });
      if (selectedTemplate?.id === templateId) setSelectedTemplate(null);
      fetchClassTemplates();
    }
  }, [user, toast, selectedTemplate, fetchClassTemplates]);

  const duplicateClassTemplate = useCallback(async (templateId) => {
    if (!user) return;

    // Fetch original
    const { data: original, error: fetchErr } = await supabase
      .from('class_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (fetchErr || !original) {
      toast({ title: 'Error duplicating', description: fetchErr?.message || 'Template not found', variant: 'destructive' });
      return;
    }

    // Insert copy
    const { data: newTemplate, error: insertErr } = await supabase
      .from('class_templates')
      .insert({
        user_id: user.id,
        discipline_id: original.discipline_id,
        name: original.name + ' (Copy)',
        default_arena_type: original.default_arena_type,
        setup_notes: original.setup_notes,
        staff_notes: original.staff_notes,
      })
      .select()
      .single();

    if (insertErr) {
      toast({ title: 'Error duplicating', description: insertErr.message, variant: 'destructive' });
      return;
    }

    // Copy equipment rows
    const { data: equipRows } = await supabase
      .from('class_template_equipment')
      .select('equipment_id, quantity')
      .eq('class_template_id', templateId);

    if (equipRows && equipRows.length > 0) {
      await supabase
        .from('class_template_equipment')
        .insert(equipRows.map(r => ({
          class_template_id: newTemplate.id,
          equipment_id: r.equipment_id,
          quantity: r.quantity,
        })));
    }

    toast({ title: 'Template duplicated!' });
    fetchClassTemplates();
  }, [user, toast, fetchClassTemplates]);

  // ---- TEMPLATE EQUIPMENT ----

  const fetchTemplateEquipment = useCallback(async (templateId) => {
    if (!templateId) return;
    setIsTemplateEquipmentLoading(true);

    const { data, error } = await supabase
      .from('class_template_equipment')
      .select('*, equipment_items(id, name, category, unit_type)')
      .eq('class_template_id', templateId)
      .order('created_at');

    if (error) {
      toast({ title: 'Error fetching template equipment', description: error.message, variant: 'destructive' });
    } else {
      setTemplateEquipment(data || []);
    }
    setIsTemplateEquipmentLoading(false);
  }, [toast]);

  const addTemplateEquipment = useCallback(async (templateId, equipmentId, quantity = 1) => {
    const { error } = await supabase
      .from('class_template_equipment')
      .insert({ class_template_id: templateId, equipment_id: equipmentId, quantity })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already added', description: 'This equipment is already on this template.', variant: 'destructive' });
      } else {
        toast({ title: 'Error adding equipment', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Equipment added to template!' });
      fetchTemplateEquipment(templateId);
    }
  }, [toast, fetchTemplateEquipment]);

  const updateTemplateEquipment = useCallback(async (id, quantity, templateId) => {
    const { error } = await supabase
      .from('class_template_equipment')
      .update({ quantity })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error updating', description: error.message, variant: 'destructive' });
    }
  }, [toast]);

  const removeTemplateEquipment = useCallback(async (id, templateId) => {
    const { error } = await supabase
      .from('class_template_equipment')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error removing equipment', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Equipment removed from template.' });
      fetchTemplateEquipment(templateId);
    }
  }, [toast, fetchTemplateEquipment]);

  // ---- EQUIPMENT PICKER HELPER ----

  const fetchUserEquipment = useCallback(async (searchTerm = '') => {
    if (!user) return [];

    let query = supabase
      .from('equipment_items')
      .select('id, name, category, unit_type, total_qty_owned')
      .eq('user_id', user.id);

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`);
    }

    query = query.order('category').order('name').limit(50);

    const { data, error } = await query;
    if (error) return [];
    return data || [];
  }, [user]);

  return {
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
  };
};
