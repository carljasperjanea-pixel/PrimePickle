import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ibxuqlhubyrtmtylozyg.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_fpMWpktKes4fYWX_ixUcKg_1YvHCGES';

export const supabase = createClient(supabaseUrl, supabaseKey);
