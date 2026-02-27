import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!; // Should be service role
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLobby() {
  console.log('Debugging Lobby Creation...');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key Length:', supabaseKey?.length);

  // 1. Check if lobbies table exists by selecting 1
  console.log('\n1. Checking lobbies table...');
  const { data: lobbies, error: selectError } = await supabase
    .from('lobbies')
    .select('*')
    .limit(1);

  if (selectError) {
    console.error('Error selecting from lobbies:', selectError);
  } else {
    console.log('Lobbies table exists. Rows found:', lobbies?.length);
  }

  // 2. Try to fetch the admin user
  console.log('\n2. Fetching admin user...');
  const { data: admin, error: adminError } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'admin')
    .limit(1)
    .single();

  if (adminError) {
    console.error('Error fetching admin:', adminError);
    return;
  }

  if (!admin) {
    console.error('No admin user found!');
    return;
  }

  console.log('Found admin:', admin.email, admin.id);

  // 3. Try to insert a lobby
  console.log('\n3. Attempting to insert a lobby...');
  const lobbyId = uuidv4();
  const qrPayload = uuidv4();

  const { data: insertData, error: insertError } = await supabase
    .from('lobbies')
    .insert([
      { id: lobbyId, admin_id: admin.id, qr_payload: qrPayload, status: 'open' }
    ])
    .select();

  if (insertError) {
    console.error('Insert failed:', insertError);
    console.error('Full Error:', JSON.stringify(insertError, null, 2));
  } else {
    console.log('Insert successful:', insertData);
    
    // Cleanup
    console.log('Cleaning up...');
    await supabase.from('lobbies').delete().eq('id', lobbyId);
  }
}

debugLobby();
