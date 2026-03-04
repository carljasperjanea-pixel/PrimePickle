
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

console.log('Testing Login Query...');
console.log('URL:', supabaseUrl);
console.log('Key (first 10 chars):', supabaseKey?.substring(0, 10));

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  const email = 'test@example.com'; // Use a known email or random
  
  console.log(`Attempting to fetch user with email: ${email}`);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    console.error('Login Query Failed:', error);
    if (error.code === '42501') {
        console.error('RLS Policy Violation! You are likely using the Anon Key instead of Service Role Key.');
    }
  } else {
    console.log('Login Query Succeeded (User found or null):', data);
  }
}

testLogin();
