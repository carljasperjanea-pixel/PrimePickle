import { supabase } from './supabase.js';

async function run() {
  console.log('Testing Supabase query from correct client...');
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'blah@example.com')
    .single();

  console.log('Error:', error);
  console.log('Data:', data);
}

run();
