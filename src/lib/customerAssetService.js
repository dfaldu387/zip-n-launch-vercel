import { supabase } from '@/lib/supabaseClient';

export const getCustomers = async (searchTerm) => {
  let query = supabase.from('customers').select('*');
  if (searchTerm) {
    query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
  }
  const { data, error } = await query.order('last_name', { ascending: true });
  if (error) throw error;
  return data;
};

export const getCustomerDetails = async (customerId) => {
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, user_id, full_name, email')
    .eq('id', customerId)
    .single();
  if (customerError) throw customerError;

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', customer.user_id)
    .order('created_at', { ascending: false });
  if (projectsError) throw projectsError;

  const { data: assets, error: assetsError } = await supabase
    .from('project_assets')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (assetsError) throw assetsError;

  return { customer, projects, assets };
};

export const getCustomerDataForUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
    
    if (customerError) {
        console.error("Error fetching customer:", customerError);
        throw customerError;
    }

    const customerId = customer?.id;

    const [projectsRes, assetsRes, patternsRes] = await Promise.all([
        supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
        customerId ? supabase
            .from('project_assets')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
        supabase
            .from('patterns')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
    ]);

    if (projectsRes.error) throw projectsRes.error;
    if (assetsRes.error) throw assetsRes.error;
    if (patternsRes.error) throw patternsRes.error;

    return { 
        projects: projectsRes.data || [], 
        assets: assetsRes.data || [],
        patterns: patternsRes.data || []
    };
};