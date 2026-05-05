import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ROWS_PER_PAGE = 15;

export const DEFAULT_CATEGORIES = [
  'Technology & Communication',
  'Show Office & Administration',
  'Operations & Production',
  'Supplies',
  'Arena, Trail & Ranch Equipment',
  'Jumping / Hunter Equipment',
  'Announcer Booth & Audio',
  'Paddock / In-Gate Equipment',
  'Marketing, Sponsorship & Branding',
  'Awards & Ceremonies',
  'Comfort, Facilities & Maintenance',
  'Safety Equipment',
  'Barns & Stalling',
  'General',
];

export const UNIT_TYPES = ['each', 'set', 'pair', 'roll', 'box', 'case', 'bag', 'bundle'];

export const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'needs_repair', label: 'Needs Repair' },
];

export const useEquipmentList = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [summaryStats, setSummaryStats] = useState({ totalItems: 0, totalQty: 0, categoriesUsed: 0, needsRepair: 0 });

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [page, setPage] = useState(0);

  const [editingItem, setEditingItem] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [customCategories, setCustomCategories] = useState([]);
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  // Transaction-based availability: { equipmentId: { checkedIn, checkedOut } }
  const [transactionTotals, setTransactionTotals] = useState({});

  // Locations for default home location picker
  const [locations, setLocations] = useState([]);

  // Fetch summary stats across ALL user items (unfiltered)
  const fetchSummaryStats = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('equipment_items')
      .select('id, total_qty_owned, category, condition')
      .eq('user_id', user.id);

    if (!error && data) {
      const categories = new Set(data.map(i => i.category));
      const customs = [...categories].filter(c => !DEFAULT_CATEGORIES.includes(c));
      setCustomCategories(prev => [...new Set([...prev, ...customs])]);

      setSummaryStats({
        totalItems: data.length,
        totalQty: data.reduce((sum, i) => sum + (i.total_qty_owned || 0), 0),
        categoriesUsed: categories.size,
        needsRepair: data.filter(i => i.condition === 'needs_repair').length,
      });
    }
  }, [user]);

  // Fetch transaction totals for availability calculation
  const fetchTransactionTotals = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('equipment_transactions')
      .select('equipment_id, transaction_type, quantity')
      .eq('user_id', user.id);

    if (!error && data) {
      const totals = {};
      for (const tx of data) {
        if (!totals[tx.equipment_id]) totals[tx.equipment_id] = { checkedIn: 0, checkedOut: 0 };
        if (tx.transaction_type === 'check_in') {
          totals[tx.equipment_id].checkedIn += tx.quantity;
        } else if (tx.transaction_type === 'check_out') {
          totals[tx.equipment_id].checkedOut += tx.quantity;
        }
        // transfers don't affect global availability (move between arenas)
      }
      setTransactionTotals(totals);
    }
  }, [user]);

  // Fetch locations for the home location picker
  const fetchLocations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, type')
      .eq('user_id', user.id)
      .order('name');
    if (!error && data) setLocations(data);
  }, [user]);

  // Fetch paginated, filtered items
  const fetchItems = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const from = page * ROWS_PER_PAGE;
    const to = from + ROWS_PER_PAGE - 1;

    let query = supabase
      .from('equipment_items')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }
    if (categoryFilter && categoryFilter !== 'all') {
      query = query.eq('category', categoryFilter);
    }
    if (conditionFilter && conditionFilter !== 'all') {
      query = query.eq('condition', conditionFilter);
    }

    query = query.order('category').order('name').range(from, to);

    const { data, error, count: totalCount } = await query;

    if (error) {
      toast({ title: 'Error fetching equipment', description: error.message, variant: 'destructive' });
    } else {
      setItems(data || []);
      setCount(totalCount || 0);
    }

    setIsLoading(false);
  }, [user, page, searchTerm, categoryFilter, conditionFilter, toast]);

  const saveItem = useCallback(async (formData) => {
    if (!user) return;
    setIsSaving(true);

    const { id, created_at, updated_at, ...payload } = formData;
    payload.user_id = user.id;

    // Check for duplicate name (different item with same name)
    const { data: existing } = await supabase
      .from('equipment_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', payload.name)
      .maybeSingle();

    if (existing && existing.id !== id) {
      toast({ title: 'Duplicate name', description: `An equipment item named "${payload.name}" already exists.`, variant: 'destructive' });
      setIsSaving(false);
      return;
    }

    let result;
    if (id) {
      result = await supabase
        .from('equipment_items')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('equipment_items')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      toast({ title: 'Error saving equipment item', description: result.error.message, variant: 'destructive' });
    } else {
      toast({ title: `Item ${id ? 'updated' : 'created'} successfully!` });
      setIsDialogOpen(false);
      setEditingItem(null);
      fetchItems();
      fetchSummaryStats();
    }

    setIsSaving(false);
  }, [user, toast, fetchItems, fetchSummaryStats]);

  const deleteItem = useCallback(async (itemId) => {
    if (!user) return;
    const { error } = await supabase
      .from('equipment_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error deleting item', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Equipment item deleted.' });
      fetchItems();
      fetchSummaryStats();
    }
  }, [user, toast, fetchItems, fetchSummaryStats]);

  const openForm = (item = null) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const addCustomCategory = (category) => {
    if (category && !allCategories.includes(category)) {
      setCustomCategories(prev => [...prev, category]);
    }
  };

  const totalPages = Math.ceil(count / ROWS_PER_PAGE);

  return {
    items,
    count,
    isLoading,
    totalPages,
    summaryStats,

    searchTerm, setSearchTerm,
    categoryFilter, setCategoryFilter,
    conditionFilter, setConditionFilter,
    page, setPage,

    editingItem,
    isDialogOpen, setIsDialogOpen,
    isSaving,
    openForm,

    fetchItems,
    fetchSummaryStats,
    saveItem,
    deleteItem,

    allCategories,
    addCustomCategory,
    ROWS_PER_PAGE,

    transactionTotals,
    fetchTransactionTotals,

    locations,
    fetchLocations,
  };
};
