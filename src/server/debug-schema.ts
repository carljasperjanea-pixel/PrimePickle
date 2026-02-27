import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!; // Service role key
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSchema() {
  console.log('Debugging Database Schema...');
  
  // Query information_schema to check foreign keys
  const { data, error } = await supabase
    .rpc('get_foreign_keys'); // We can't query information_schema directly via client usually, unless we use a function or direct SQL if enabled.
    
  // Actually, we can't easily query information_schema from the client unless we have a stored procedure.
  // But we can try to insert a dummy record that violates a FK and see the error message, 
  // or just try the failing query again and print the exact error.

  console.log('Attempting the failing query...');
  
  const { data: lobbies, error: queryError } = await supabase
    .from('lobbies')
    .select(`
      id,
      lobby_players (
        profiles (
          id,
          display_name
        )
      )
    `)
    .limit(1);

  if (queryError) {
    console.error('Query Failed:', JSON.stringify(queryError, null, 2));
    
    if (queryError.code === 'PGRST200') {
      console.log('\n--- DIAGNOSIS ---');
      console.log('PostgREST cannot find the relationship.');
      console.log('This usually means the Foreign Key is missing or the Schema Cache is stale.');
    }
  } else {
    console.log('Query Succeeded!');
    console.log('Data:', JSON.stringify(lobbies, null, 2));
  }
}

debugSchema();
