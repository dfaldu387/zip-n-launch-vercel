import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://akvmndheosffcgvxuxbr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrdm1uZGhlb3NmZmNndnh1eGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1ODU0NzEsImV4cCI6MjA3MzE2MTQ3MX0.ZEPNWFq_3jK1RcG3TzIAq2Q7KnTiyzLEa0Tj_siFlL4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});