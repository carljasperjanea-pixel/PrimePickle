import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { supabase, supabaseKeyConfig } from './supabase.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Auth Routes ---

router.post('/auth/signup', async (req, res) => {
  const { email, password, display_name, role } = req.body;
  
  // Pre-check for Publishable Key
  if (supabaseKeyConfig && supabaseKeyConfig.startsWith('sb_publishable')) {
    console.error('CRITICAL ERROR: Attempting to sign up with a Publishable Key.');
    return res.status(500).json({ 
      error: 'Configuration Error: Server is using a Publishable Key.',
      details: 'You must use the SERVICE ROLE KEY for the server to create users. Update SUPABASE_KEY in your secrets.'
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    
    console.log(`Attempting to create user: ${email}`);
    
    // Debug: Check key role
    try {
      const keyPart = supabaseKeyConfig ? supabaseKeyConfig.split('.')[1] : '';
      if (keyPart) {
        const payload = JSON.parse(Buffer.from(keyPart, 'base64').toString());
        console.log(`[DEBUG] Using Supabase Key Role: ${payload.role}`);
      }
    } catch (e) {
      console.log('[DEBUG] Could not decode key role');
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert([
        { id, email, password_hash: hashedPassword, display_name, role: role || 'player' }
      ])
      .select()
      .single();
    
    if (error) {
      // Force logging of all properties including non-enumerable ones
      console.error('Supabase Insert Error (Full):', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        ...error
      });

      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Email already exists' });
      }
      if (error.code === '42P01') { // Undefined table
        return res.status(500).json({ error: 'Database table "profiles" not found. Please run the SQL schema.' });
      }
      if (error.code === '42501') { // RLS violation
        return res.status(500).json({ error: 'Permission denied (RLS). Ensure you are using the SERVICE ROLE KEY.' });
      }
      
      throw error;
    }
    
    console.log('User created successfully:', id);

    const token = jwt.sign({ id, email, role: role || 'player' }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.json({ user: { id, email, display_name, role: role || 'player' } });
  } catch (error: any) {
    console.error('Signup Exception:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error', 
      details: error.toString()
    });
  }
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Pre-check for Publishable Key
  if (supabaseKeyConfig && supabaseKeyConfig.startsWith('sb_publishable')) {
    console.error('CRITICAL ERROR: Attempting to login with a Publishable Key.');
    return res.status(500).json({ 
      error: 'Configuration Error: Server is using a Publishable Key.',
      details: 'You must use the SERVICE ROLE KEY for the server to authenticate users. Update SUPABASE_KEY in your secrets.'
    });
  }

  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) {
      // Ignore "Row not found" error, it just means invalid credentials
      if (error.code !== 'PGRST116') {
        console.error('Login lookup error (Full):', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          ...error
        });
        
        if (error.code === '42P01') { // Undefined table
          return res.status(500).json({ error: 'Database table "profiles" not found. Please run the SQL schema.' });
        }
        if (error.code === '42501') { // RLS violation
          return res.status(500).json({ error: 'Permission denied (RLS). Ensure you are using the SERVICE ROLE KEY.' });
        }
      }
    }

    if (error || !user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    
    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error: any) {
    console.error('Login Exception:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error', 
      details: error.toString() 
    });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

router.get('/user', authenticateToken, async (req: any, res) => {
  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, phone, address, avatar_url, mmr, games_played, role')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.sendStatus(404);
    res.json({ user });
  } catch (error) {
    console.error('User fetch error:', error);
    res.sendStatus(500);
  }
});

// --- Lobby Routes ---

// Create Lobby (Admin only)
router.post('/lobbies', authenticateToken, async (req: any, res) => {
  console.log('[DEBUG] POST /lobbies called');
  console.log('[DEBUG] User:', req.user);
  
  // Check Key Role
  try {
    const keyPart = supabaseKeyConfig ? supabaseKeyConfig.split('.')[1] : '';
    if (keyPart) {
      const payload = JSON.parse(Buffer.from(keyPart, 'base64').toString());
      console.log(`[DEBUG] Supabase Key Role: ${payload.role}`);
      
      if (payload.role !== 'service_role') {
        console.error('[CRITICAL] Server is NOT using Service Role Key. RLS will block inserts.');
        return res.status(500).json({ 
          error: 'Configuration Error', 
          details: 'Server is using "anon" key instead of "service_role" key. Please update SUPABASE_KEY in Vercel Environment Variables.' 
        });
      }
    }
  } catch (e) {
    console.log('[DEBUG] Could not decode key role');
  }

  if (req.user.role !== 'admin') {
    console.log('[DEBUG] Permission denied: User is not admin');
    return res.sendStatus(403);
  }
  
  const id = uuidv4();
  const qr_payload = uuidv4(); // Unique string for QR code
  
  try {
    const { error } = await supabase
      .from('lobbies')
      .insert([
        { id, admin_id: req.user.id, qr_payload, status: 'open' }
      ]);

    if (error) {
      console.error('Supabase Create Lobby Error:', JSON.stringify(error, null, 2));
      throw error;
    }
    res.json({ id, qr_payload, status: 'open' });
  } catch (error: any) {
    console.error('Create lobby error:', error);
    res.status(500).json({ 
      error: 'Failed to create lobby',
      details: error.message || error.toString()
    });
  }
});

// Get Lobbies (Admin: all active, Player: joined)
router.get('/lobbies', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role === 'admin') {
      // Get all lobbies created by this admin
      const { data: lobbies, error } = await supabase
        .from('lobbies')
        .select(`
          *,
          lobby_players!lobby_players_lobby_id_fkey (
            joined_at,
            profiles!lobby_players_profile_id_fkey (
              id,
              display_name,
              mmr,
              avatar_url
            )
          )
        `)
        .eq('admin_id', req.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data structure for frontend
      const lobbiesWithPlayers = lobbies.map((l: any) => ({
        ...l,
        players: l.lobby_players.map((lp: any) => ({
          ...lp.profiles,
          joined_at: lp.joined_at
        })).sort((a: any, b: any) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()),
        player_count: l.lobby_players.length
      }));

      res.json({ lobbies: lobbiesWithPlayers });
    } else {
      // Get lobbies the player has joined using a join
      const { data: lobbies, error } = await supabase
        .from('lobbies')
        .select('*, lobby_players!inner(profile_id)')
        .eq('lobby_players.profile_id', req.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ lobbies });
    }
  } catch (error) {
    console.error('Fetch lobbies error:', error);
    res.status(500).json({ error: 'Failed to fetch lobbies' });
  }
});

// Run Schema Migration (Temporary)
router.get('/admin/migrate-schema', async (req, res) => {
  try {
    // Attempt to add columns if they don't exist
    // Note: Supabase JS client doesn't support DDL directly usually, but we can try via RPC if setup, 
    // or we just have to hope the user runs the SQL.
    // However, since I cannot run SQL directly, I will assume the columns are added or I will try to use them.
    // If this fails, the user needs to run the SQL manually.
    
    // Actually, I can't run DDL here. I will just log that this needs to be done.
    console.log('Please run the following SQL in your Supabase SQL Editor:');
    console.log('ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS team text;');
    console.log('ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS slot_index int;');
    
    res.json({ message: 'Please check server logs for SQL commands to run.' });
  } catch (error) {
    res.status(500).json({ error: 'Migration failed' });
  }
});

// Get Active Lobby and its Players (Visibility System)
router.get('/lobbies/active', authenticateToken, async (req: any, res) => {
  try {
    // 1. Find the active lobby for this user
    const { data: activeLobbies, error: lobbyError } = await supabase
      .from('lobbies')
      .select('*, lobby_players!inner(profile_id)')
      .eq('lobby_players.profile_id', req.user.id)
      .neq('status', 'completed');

    if (lobbyError) throw lobbyError;

    const lobbyData = activeLobbies?.[0];

    if (!lobbyData) {
      return res.json({ lobby: null, players: [] });
    }

    // 2. Fetch all players in this lobby with slot/team info
    const { data: lobbyPlayers, error: lpError } = await supabase
      .from('lobby_players')
      .select('joined_at, team, slot_index, profiles(id, display_name, avatar_url, mmr)')
      .eq('lobby_id', lobbyData.id)
      .order('slot_index', { ascending: true });

    if (lpError) throw lpError;

    // Map players
    const playersWithTeams = lobbyPlayers.map((lp: any) => ({
      ...lp.profiles,
      joined_at: lp.joined_at,
      team: lp.team,
      slot_index: lp.slot_index
    }));

    res.json({ lobby: lobbyData, players: playersWithTeams });
  } catch (error) {
    console.error('Fetch active lobby error:', error);
    res.status(500).json({ error: 'Failed to fetch active lobby' });
  }
});

// Join Lobby via QR Scan
router.post('/lobbies/join', authenticateToken, async (req: any, res) => {
  const { qr_payload } = req.body;
  
  try {
    // Find lobby by QR payload
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('qr_payload', qr_payload)
      .single();
    
    if (lobbyError || !lobby) {
      return res.status(404).json({ error: 'Invalid QR Code' });
    }

    // Check if player is already in ANY active lobby (status != completed)
    const { data: activeLobbies } = await supabase
      .from('lobbies')
      .select('*, lobby_players!inner(profile_id)')
      .eq('lobby_players.profile_id', req.user.id)
      .neq('status', 'completed');

    if (activeLobbies && activeLobbies.length > 0) {
      const active = activeLobbies[0];
      if (active.id === lobby.id) {
        return res.json({ message: 'Already joined', lobby_id: lobby.id });
      }
      return res.status(400).json({ error: 'You are already in an active lobby. Please leave it first.' });
    }
    
    if (lobby.status !== 'open') {
      return res.status(400).json({ error: 'Lobby is not open' });
    }
    
    // Get current players to determine next slot
    const { data: currentPlayers, error: cpError } = await supabase
      .from('lobby_players')
      .select('slot_index')
      .eq('lobby_id', lobby.id);

    if (cpError) throw cpError;
    
    const occupiedSlots = currentPlayers.map((p: any) => p.slot_index);
    let nextSlot = -1;
    // Find first available slot (0-3)
    for (let i = 0; i < 4; i++) {
      if (!occupiedSlots.includes(i)) {
        nextSlot = i;
        break;
      }
    }

    if (nextSlot === -1) {
      return res.status(400).json({ error: 'Lobby is full' });
    }

    // Assign Team based on Slot
    // Slots 0,1 -> Team A
    // Slots 2,3 -> Team B
    const team = nextSlot < 2 ? 'A' : 'B';
    
    // Join with Slot and Team
    const { error: joinError } = await supabase
      .from('lobby_players')
      .insert([{ 
        lobby_id: lobby.id, 
        profile_id: req.user.id,
        slot_index: nextSlot,
        team: team
      }]);

    if (joinError) throw joinError;
    
    // Check if now full
    if (occupiedSlots.length + 1 === 4) {
      await supabase
        .from('lobbies')
        .update({ status: 'full' })
        .eq('id', lobby.id);
    }
    
    res.json({ message: 'Joined successfully', lobby_id: lobby.id, slot: nextSlot, team });
  } catch (error) {
    console.error('Join lobby error:', error);
    res.status(500).json({ error: 'Failed to join lobby' });
  }
});

// Switch Slot/Team
router.post('/lobbies/switch-slot', authenticateToken, async (req: any, res) => {
  const { target_slot } = req.body; // 0-3

  if (target_slot < 0 || target_slot > 3) {
    return res.status(400).json({ error: 'Invalid slot index' });
  }

  try {
    // Get active lobby for user
    const { data: activeLobbies } = await supabase
      .from('lobbies')
      .select('*, lobby_players!inner(profile_id)')
      .eq('lobby_players.profile_id', req.user.id)
      .neq('status', 'completed');

    const lobby = activeLobbies?.[0];
    if (!lobby) return res.status(400).json({ error: 'No active lobby found' });

    // Check if target slot is occupied
    const { data: occupied } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobby.id)
      .eq('slot_index', target_slot)
      .single();

    if (occupied) {
      return res.status(400).json({ error: 'Slot is already occupied' });
    }

    // Determine new team
    const newTeam = target_slot < 2 ? 'A' : 'B';

    // Update user's slot and team
    const { error: updateError } = await supabase
      .from('lobby_players')
      .update({ slot_index: target_slot, team: newTeam })
      .eq('lobby_id', lobby.id)
      .eq('profile_id', req.user.id);

    if (updateError) throw updateError;

    res.json({ message: 'Slot updated', slot: target_slot, team: newTeam });
  } catch (error) {
    console.error('Switch slot error:', error);
    res.status(500).json({ error: 'Failed to switch slot' });
  }
});

// Leave Lobby
router.post('/lobbies/leave', authenticateToken, async (req: any, res) => {
  const { lobby_id } = req.body;

  try {
    // Check if player is in lobby
    const { data: existing, error: existingError } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobby_id)
      .eq('profile_id', req.user.id)
      .single();

    if (existingError || !existing) {
      return res.status(400).json({ error: 'Not in this lobby' });
    }

    // Remove player
    const { error: deleteError } = await supabase
      .from('lobby_players')
      .delete()
      .eq('lobby_id', lobby_id)
      .eq('profile_id', req.user.id);

    if (deleteError) throw deleteError;

    // Check remaining player count
    const { count, error: countError } = await supabase
      .from('lobby_players')
      .select('*', { count: 'exact', head: true })
      .eq('lobby_id', lobby_id);

    if (countError) throw countError;

    // If lobby was full, set back to open
    const { data: lobby } = await supabase
      .from('lobbies')
      .select('status')
      .eq('id', lobby_id)
      .single();

    if (lobby && lobby.status === 'full' && (count || 0) < 4) {
      await supabase
        .from('lobbies')
        .update({ status: 'open' })
        .eq('id', lobby_id);
    }

    res.json({ message: 'Left lobby successfully' });
  } catch (error) {
    console.error('Leave lobby error:', error);
    res.status(500).json({ error: 'Failed to leave lobby' });
  }
});

// Get Lobby Details (Players in lobby)
router.get('/lobbies/:id', authenticateToken, async (req: any, res) => {
  try {
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (lobbyError || !lobby) return res.sendStatus(404);
    
    const { data: players, error: playersError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, mmr')
      .in('id', (
        await supabase
          .from('lobby_players')
          .select('profile_id')
          .eq('lobby_id', req.params.id)
      ).data?.map((lp: any) => lp.profile_id) || []);
    
    if (playersError) throw playersError;

    res.json({ lobby, players });
  } catch (error) {
    console.error('Lobby details error:', error);
    res.status(500).json({ error: 'Failed to fetch lobby details' });
  }
});

// Complete Match (Admin only)
router.post('/matches/complete', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  const { lobby_id, winner_team, score } = req.body; // winner_team: 'A' or 'B'
  
  try {
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobby_id)
      .single();

    if (lobbyError || !lobby) return res.status(404).json({ error: 'Lobby not found' });
    if (lobby.status === 'completed') return res.status(400).json({ error: 'Match already completed' });
    
    // Get players joined in order
    const { data: lobbyPlayers, error: lpError } = await supabase
      .from('lobby_players')
      .select('profile_id, joined_at')
      .eq('lobby_id', lobby_id)
      .order('joined_at', { ascending: true });

    if (lpError) throw lpError;

    // Get full profiles for MMR calculation
    const { data: players, error: pError } = await supabase
      .from('profiles')
      .select('id, mmr, games_played')
      .in('id', lobbyPlayers?.map((lp: any) => lp.profile_id) || []);

    if (pError) throw pError;

    // Map back to ordered list
    const orderedPlayers = lobbyPlayers?.map((lp: any) => players?.find((p: any) => p.id === lp.profile_id)).filter(Boolean) || [];
    
    if (orderedPlayers.length < 2) { 
       // proceed for testing
    }

    const teamA = orderedPlayers.slice(0, 2);
    const teamB = orderedPlayers.slice(2, 4);
    
    const mmrDeltaWin = 20;
    const mmrDeltaLoss = 15;
    
    // Prepare updates
    const updates = [];

    // Team A
    for (const p of teamA) {
      const isWinner = winner_team === 'A';
      const newMMR = isWinner ? (p.mmr || 1000) + mmrDeltaWin : (p.mmr || 1000) - mmrDeltaLoss;
      updates.push(supabase.from('profiles').update({ mmr: newMMR, games_played: (p.games_played || 0) + 1 }).eq('id', p.id));
    }

    // Team B
    for (const p of teamB) {
      const isWinner = winner_team === 'B';
      const newMMR = isWinner ? (p.mmr || 1000) + mmrDeltaWin : (p.mmr || 1000) - mmrDeltaLoss;
      updates.push(supabase.from('profiles').update({ mmr: newMMR, games_played: (p.games_played || 0) + 1 }).eq('id', p.id));
    }

    // Execute all updates
    await Promise.all(updates);

    // Create Match Record
    await supabase.from('matches').insert([{
      id: uuidv4(),
      lobby_id, 
      winner_team, 
      score, 
      mmr_delta: mmrDeltaWin
    }]);
      
    // Close Lobby
    await supabase.from('lobbies').update({ status: 'completed' }).eq('id', lobby_id);
    
    res.json({ message: 'Match completed and MMR updated' });
    
  } catch (error) {
    console.error('Complete match error:', error);
    res.status(500).json({ error: 'Failed to complete match' });
  }
});

// Temporary route to seed an admin account
router.get('/auth/seed-admin', async (req, res) => {
  try {
    const email = 'admin@primepickle.com';
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
      return res.json({ message: 'Admin account already exists', email, password });
    }

    const { error } = await supabase
      .from('profiles')
      .insert([
        { id, email, password_hash: hashedPassword, display_name: 'System Admin', role: 'admin' }
      ]);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Admin account created successfully', email, password });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
