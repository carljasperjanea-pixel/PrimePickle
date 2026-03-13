import { supabase } from './src/server/supabase.js';

async function run() {
  const { data, error } = await supabase.from('club_achievements').select('id').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

run();
