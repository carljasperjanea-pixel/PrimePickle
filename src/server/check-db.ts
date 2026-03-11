import { supabase, supabaseUrlConfig, supabaseKeyConfig } from './supabase.js';

async function checkDb() {
  console.log('Checking database connection...');
  console.log('URL:', supabaseUrlConfig);
  console.log('Key Role:', supabaseKeyConfig?.startsWith('ey') ? 'JWT (Hidden)' : 'Unknown');

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
  // Check for 'full_name' column in 'profiles'
  console.log('Checking schema for "profiles.full_name"...');
  const { error: fullNameError } = await supabase
    .from('profiles')
    .select('full_name')
    .limit(1);

  if (fullNameError) {
    console.error('Error checking "profiles.full_name":', fullNameError);
    if (fullNameError.code === '42703') { // Undefined column
      console.error('--> CONCLUSION: The "full_name" column is missing from the "profiles" table.');
      console.error('--> ACTION: Run "src/server/migration_add_full_name.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "profiles.full_name" column exists.');
  }

  // Check for 'visibility_settings' column in 'profiles'
  console.log('Checking schema for "profiles.visibility_settings"...');
  const { error: visibilityError } = await supabase
    .from('profiles')
    .select('visibility_settings')
    .limit(1);

  if (visibilityError) {
    console.error('Error checking "profiles.visibility_settings":', visibilityError);
    if (visibilityError.code === '42703') { // Undefined column
      console.error('--> CONCLUSION: The "visibility_settings" column is missing from the "profiles" table.');
      console.error('--> ACTION: Run "src/server/migration_add_visibility_settings.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "profiles.visibility_settings" column exists.');
  }

  // Check for 'behavior_score' column in 'profiles'
  console.log('Checking schema for "profiles.behavior_score"...');
  const { error: behaviorError } = await supabase
    .from('profiles')
    .select('behavior_score')
    .limit(1);

  if (behaviorError) {
    console.error('Error checking "profiles.behavior_score":', behaviorError);
    if (behaviorError.code === '42703') { // Undefined column
      console.error('--> CONCLUSION: The "behavior_score" column is missing from the "profiles" table.');
      console.error('--> ACTION: Run "src/server/migration_add_behavior_score.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "profiles.behavior_score" column exists.');
  }

  // Check for 'matches' table and columns
  console.log('Checking schema for "matches"...');
  const { error: matchesError } = await supabase
    .from('matches')
    .select('completed_at')
    .limit(1);

  if (matchesError) {
    console.error('Error checking "matches.completed_at":', matchesError);
    if (matchesError.code === '42703') {
        console.error('--> CONCLUSION: The "completed_at" column is missing from the "matches" table.');
    }
  } else {
    console.log('Success! "matches.completed_at" column exists.');
  }

  // Check for 'player_gears' table
  console.log('Checking schema for "player_gears"...');
  const { error: gearsError } = await supabase
    .from('player_gears')
    .select('id')
    .limit(1);

  if (gearsError) {
    console.error('Error checking "player_gears":', gearsError);
    if (gearsError.code === '42P01') { // Undefined table
      console.error('--> CONCLUSION: The "player_gears" table does not exist.');
      console.error('--> ACTION: Run "src/server/migration_add_player_gears.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "player_gears" table exists.');
  }
  // Check for 'audit_logs' table
  console.log('Checking schema for "audit_logs"...');
  const { error: auditError } = await supabase
    .from('audit_logs')
    .select('id')
    .limit(1);

  if (auditError) {
    console.error('Error checking "audit_logs":', auditError);
    if (auditError.code === '42P01') { // Undefined table
      console.error('--> CONCLUSION: The "audit_logs" table does not exist.');
      console.error('--> ACTION: Run "src/server/migration_super_admin.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "audit_logs" table exists.');
  }

  // Check for 'followers' table
  console.log('Checking schema for "followers"...');
  const { error: followersError } = await supabase
    .from('followers')
    .select('follower_id')
    .limit(1);

  if (followersError) {
    console.error('Error checking "followers":', followersError);
    if (followersError.code === '42P01') { // Undefined table
      console.error('--> CONCLUSION: The "followers" table does not exist.');
      console.error('--> ACTION: Run "src/server/migration_add_followers.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "followers" table exists.');
  }
  // Check for 'notifications' table
  console.log('Checking schema for "notifications"...');
  const { error: notificationsError } = await supabase
    .from('notifications')
    .select('id')
    .limit(1);

  if (notificationsError) {
    console.error('Error checking "notifications":', notificationsError);
    if (notificationsError.code === '42P01') { // Undefined table
      console.error('--> CONCLUSION: The "notifications" table does not exist.');
      console.error('--> ACTION: Run "src/server/migration_add_notifications.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "notifications" table exists.');
  }
  // Check for 'club_achievements' table
  console.log('Checking schema for "club_achievements"...');
  const { error: achievementsError } = await supabase
    .from('club_achievements')
    .select('id')
    .limit(1);

  if (achievementsError) {
    console.error('Error checking "club_achievements":', achievementsError);
    if (achievementsError.code === '42P01' || achievementsError.code === 'PGRST205') { // Undefined table
      console.error('--> CONCLUSION: The "club_achievements" table does not exist.');
      console.error('--> ACTION: Run "src/server/migration_add_club_customization.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "club_achievements" table exists.');
  }
  // Check for 'messages' table
  console.log('Checking schema for "messages"...');
  const { error: messagesError } = await supabase
    .from('messages')
    .select('id')
    .limit(1);

  if (messagesError) {
    console.error('Error checking "messages":', messagesError);
    if (messagesError.code === '42P01' || messagesError.code === 'PGRST205') { // Undefined table
      console.error('--> CONCLUSION: The "messages" table does not exist.');
      console.error('--> ACTION: Run "src/server/migration_add_messages.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "messages" table exists.');
  }
  // Check for 'tournaments' table
  console.log('Checking schema for "tournaments"...');
  const { error: tournamentsError } = await supabase
    .from('tournaments')
    .select('id')
    .limit(1);

  if (tournamentsError) {
    console.error('Error checking "tournaments":', tournamentsError);
    if (tournamentsError.code === '42P01' || tournamentsError.code === 'PGRST205') { // Undefined table
      console.error('--> CONCLUSION: The "tournaments" table does not exist.');
      console.error('--> ACTION: Run "src/server/migration_add_tournaments.sql" in Supabase SQL Editor.');
    }
  } else {
    console.log('Success! "tournaments" table exists.');
  }
}

checkDb();
