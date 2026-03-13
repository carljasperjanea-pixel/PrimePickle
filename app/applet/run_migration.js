import { supabase } from './src/server/supabase.js';

async function run() {
  const { error } = await supabase.rpc('exec_sql', { sql_string: 'ALTER TABLE public.club_achievements ADD COLUMN IF NOT EXISTS image_url TEXT;' });
  if (error) {
    console.error('Migration failed:', error);
  } else {
    console.log('Migration successful');
  }
}

run();
