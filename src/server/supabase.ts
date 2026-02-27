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

if (supabaseKey.startsWith('sb_publishable')) {
  console.warn('----------------------------------------------------------------');
  console.warn('WARNING: You are using a Supabase Publishable Key (sb_publishable_...).');
  console.warn('This key usually has restricted permissions (Read-Only or RLS restricted).');
  console.warn('For server-side operations (like Sign Up/Login), you should use the SERVICE ROLE KEY.');
  console.warn('You can find the Service Role Key in Supabase Dashboard > Settings > API.');
  console.warn('----------------------------------------------------------------');
} else if (!supabaseKey.startsWith('ey')) {
  console.warn('----------------------------------------------------------------');
  console.warn('WARNING: Your SUPABASE_KEY does not look like a valid JWT (it should start with "ey...").');
  console.warn('You may have pasted the "Project API keys" secret or database password instead of the Service Role Key.');
  console.warn('Please go to Supabase Dashboard > Settings > API and copy the "service_role" key.');
  console.warn('----------------------------------------------------------------');
} else {
  try {
    // Simple base64 decode of the payload (second part of JWT)
    const payload = JSON.parse(Buffer.from(supabaseKey.split('.')[1], 'base64').toString());
    if (payload.role === 'anon') {
      console.warn('----------------------------------------------------------------');
      console.warn('CRITICAL WARNING: You are using the "anon" (public) key.');
      console.warn('The server requires the "service_role" key to bypass Row Level Security (RLS) and manage users.');
      console.warn('Using the anon key will likely cause "Permission denied" or "new row violates row-level security policy" errors.');
      console.warn('Please go to Supabase Dashboard > Settings > API and copy the "service_role" key (it is hidden by default).');
      console.warn('----------------------------------------------------------------');
    }
  } catch (e) {
    console.warn('Could not decode SUPABASE_KEY to check role.');
  }
}

console.log(`Initializing Supabase with URL: ${supabaseUrl}`);

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey);
export const supabaseKeyConfig = supabaseKey;
export const supabaseUrlConfig = supabaseUrl;
