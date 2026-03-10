import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

export async function seedSuperAdmin() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('SUPABASE_URL or SUPABASE_KEY is missing. Skipping super admin seeding.');
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Seeding super admin account...');
  
  const email = 'superadmin@primepickle.com';
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 10);
  const id = uuidv4();

  // Check if exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (existing) {
    console.log('Super Admin account already exists.');
    console.log('Email:', email);
    console.log('Password:', password);
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .insert([
      { id, email, password_hash: hashedPassword, display_name: 'Super Admin', role: 'super_admin' }
    ]);

  if (error) {
    console.error('Error creating super admin:', error.message);
  } else {
    console.log('Super Admin account created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
  }
}


