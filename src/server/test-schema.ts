import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
async function test() {
  const { data, error } = await supabase.from('profiles').insert({
    id: '00000000-0000-0000-0000-000000000000',
    email: 'test@example.com',
    display_name: 'Test',
    role: 'player'
  });
  console.log(error);
}
test();
