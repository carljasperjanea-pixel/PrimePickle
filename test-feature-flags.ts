import { supabase } from './src/server/supabase.ts';

async function test() {
  const { data, error } = await supabase.from('feature_flags').select('*');
  console.log('Data:', data);
  console.log('Error:', error);
}
test();
