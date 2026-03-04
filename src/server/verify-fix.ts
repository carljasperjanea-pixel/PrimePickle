
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFix() {
  console.log('Verifying Database Fixes...');

  // 1. Check Columns
  console.log('\n1. Checking Table Columns...');
  
  const { error: lobbyError } = await supabase
    .from('lobbies')
    .select('started_at, status, match_goal, team_a_captain_id')
    .limit(1);

  if (lobbyError) {
    console.error('❌ Lobbies table missing columns or RLS issue:', lobbyError.message);
  } else {
    console.log('✅ Lobbies table has new columns.');
  }

  const { error: playerError } = await supabase
    .from('lobby_players')
    .select('is_ready, team')
    .limit(1);

  if (playerError) {
    console.error('❌ Lobby_players table missing columns or RLS issue:', playerError.message);
  } else {
    console.log('✅ Lobby_players table has new columns.');
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .select('mmr, games_played')
    .limit(1);

  if (profileError) {
    console.error('❌ Profiles table missing columns or RLS issue:', profileError.message);
  } else {
    console.log('✅ Profiles table has new columns.');
  }

  // 2. Test RLS / Insert
  console.log('\n2. Testing Write Permissions (RLS)...');
  const testId = uuidv4();
  const testEmail = `test_rls_${Date.now()}@example.com`;

  const { error: insertError } = await supabase
    .from('profiles')
    .insert([{ id: testId, email: testEmail, display_name: 'RLS Test' }]);

  if (insertError) {
    console.error('❌ RLS Test Failed (Insert Profile):', insertError.message);
    if (insertError.code === '42501') {
      console.error('   -> Permission Denied. Please run the fix_rls.sql script.');
    }
  } else {
    console.log('✅ RLS Test Passed (Insert Profile).');
    // Cleanup
    await supabase.from('profiles').delete().eq('id', testId);
  }

  console.log('\nVerification Complete.');
}

verifyFix();
