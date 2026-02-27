import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabaseUrl = (process.env.SUPABASE_URL || '').trim();
let supabaseKey = (process.env.SUPABASE_KEY || '').trim();

// Fallback to hardcoded values if env vars are missing or empty
if (!supabaseUrl) {
  supabaseUrl = 'https://ibxuqlhubyrtmtylozyg.supabase.co';
}
if (!supabaseKey) {
  supabaseKey = 'sb_publishable_fpMWpktKes4fYWX_ixUcKg_1YvHCGES';
}

// Validate URL format
if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  console.warn(`Invalid SUPABASE_URL format: "${supabaseUrl}". Falling back to default.`);
  supabaseUrl = 'https://ibxuqlhubyrtmtylozyg.supabase.co';
}

console.log(`Initializing Supabase with URL: ${supabaseUrl}`);

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey);
