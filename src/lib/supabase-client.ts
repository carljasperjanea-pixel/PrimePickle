import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ibxuqlhubyrtmtylozyg.supabase.co';
let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_fpMWpktKes4fYWX_ixUcKg_1YvHCGES';

// Validate URL format
if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  console.warn(`Invalid VITE_SUPABASE_URL format: "${supabaseUrl}". Falling back to default.`);
  supabaseUrl = 'https://ibxuqlhubyrtmtylozyg.supabase.co';
}

export const supabase = createClient(supabaseUrl, supabaseKey);
