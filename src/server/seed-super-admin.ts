import { supabase } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export async function seedSuperAdmin() {
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


