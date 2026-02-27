import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = (process.env.SUPABASE_URL || 'https://ibxuqlhubyrtmtylozyg.supabase.co').trim();
const supabaseKey = (process.env.SUPABASE_KEY || 'sb_publishable_fpMWpktKes4fYWX_ixUcKg_1YvHCGES').trim();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_KEY environment variables. App will start but database operations will fail.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey);
