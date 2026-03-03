import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  console.log('Checking database connection...');
  console.log('URL:', supabaseUrl);
  console.log('Key Role:', supabaseKey.startsWith('ey') ? 'JWT (Hidden)' : 'Unknown');

  // Check if we can connect and if 'profiles' table exists
  const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });

  if (error) {
    console.error('Error connecting to "profiles" table:', error);
    if (error.code === '42P01') {
      console.error('--> CONCLUSION: The "profiles" table does not exist.');
      console.error('--> ACTION: You MUST run the SQL schema in the Supabase Dashboard SQL Editor.');
    } else if (error.code === '42501') {
      console.error('--> CONCLUSION: Permission denied.');
      console.error('--> ACTION: Ensure you are using the SERVICE ROLE KEY.');
    }
  } else {
    console.log('Success! "profiles" table exists and is accessible.');
    console.log('Row count:', data);
  }
}

checkDb();
