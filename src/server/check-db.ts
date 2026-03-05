import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  console.log('Checking database connection...');
  console.log('URL:', supabaseUrl);
  console.log('Key Role:', supabaseKey.startsWith('ey') ? 'JWT (Hidden)' : 'Unknown');

  // Check if we can connect and if 'profiles' table exists
  const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error connecting to "profiles" table:', error);
    if (error.code === '42P01') {
      console.error('--> CONCLUSION: The "profiles" table does not exist.');
      console.error('--> ACTION: You MUST run the SQL schema in the Supabase Dashboard SQL Editor.');
    } else if (error.code === '42501') {
      console.error('--> CONCLUSION: Permission denied (Read).');
      console.error('--> ACTION: Ensure you are using the SERVICE ROLE KEY.');
    }
    return;
  } else {
    console.log('Success! "profiles" table exists and is readable.');
    console.log('Row count:', count);
  }

  // Check Write Permissions (Insert Dummy Profile)
  console.log('Checking write permissions...');
  const dummyId = '00000000-0000-0000-0000-000000000000';
  const { error: insertError } = await supabase.from('profiles').insert([
    { id: dummyId, email: 'test-write-check@example.com', password_hash: 'hash', display_name: 'Test' }
  ]);

  if (insertError) {
    console.error('Error inserting into "profiles":', insertError);
    if (insertError.code === '42501') {
      console.error('--> CONCLUSION: Permission denied (Write).');
      console.error('--> ACTION: You are likely using the ANON KEY instead of the SERVICE ROLE KEY.');
      console.error('--> FIX 1: Update SUPABASE_KEY in your .env file with the service_role key.');
      console.error('--> FIX 2: Run "src/server/fix-permissions.sql" in Supabase SQL Editor to allow anonymous access.');
    } else if (insertError.code === '23505') {
       console.log('Write permission confirmed (Duplicate key error means write was attempted).');
    }
  } else {
    console.log('Success! Write permissions confirmed.');
    // Cleanup
    await supabase.from('profiles').delete().eq('id', dummyId);
  }
  // Check for 'started_at' column in 'lobbies'
  console.log('Checking schema for "lobbies.started_at"...');
  const { error: columnError } = await supabase
    .from('lobbies')
    .select('started_at')
    .limit(1);

  if (columnError) {
    console.error('Error checking "lobbies.started_at":', columnError);
    if (columnError.code === '42703') { // Undefined column
      console.error('--> CONCLUSION: The "started_at" column is missing from the "lobbies" table.');
      console.error('--> ACTION: Run "src/server/fix_schema_missing_columns.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "lobbies.started_at" column exists.');
  }

  // Check for 'address' column in 'profiles'
  console.log('Checking schema for "profiles.address"...');
  const { error: addressError } = await supabase
    .from('profiles')
    .select('address')
    .limit(1);

  if (addressError) {
    console.error('Error checking "profiles.address":', addressError);
    if (addressError.code === '42703') { // Undefined column
      console.error('--> CONCLUSION: The "address" column is missing from the "profiles" table.');
      console.error('--> ACTION: Run "src/server/migration_add_profile_fields.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "profiles.address" column exists.');
  }
}

checkDb();
