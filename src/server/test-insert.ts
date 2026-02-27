import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('Testing insert into profiles...');
  
  const id = uuidv4();
  const email = `test-${Date.now()}@example.com`;
  const password_hash = 'hash';
  
  const { data, error } = await supabase
    .from('profiles')
    .insert([
      { id, email, password_hash, display_name: 'Test User', role: 'player' }
    ])
    .select()
    .single();

  if (error) {
    console.error('Insert failed!');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', error.details);
    console.error('Full error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Insert success!', data);
  }
}

testInsert();
