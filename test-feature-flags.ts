import { supabase } from './src/server/supabase.js';

async function test() {
  const { data, error } = await supabase.from('feature_flags').select('*');
  console.log('Data:', data);
  console.log('Error:', error);
}
test();
