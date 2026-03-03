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

// Get Active Lobby and its Players (Visibility System)
router.get('/lobbies/active', authenticateToken, async (req: any, res) => {
  try {
    // 1. Find the active lobby for this user
    // This enforces the restriction: we only look for lobbies that are NOT completed.
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

    // 2. Fetch all players in this lobby with join time for team assignment
    const { data: lobbyPlayers, error: lpError } = await supabase
      .from('lobby_players')
      .select('joined_at, team, is_ready, profiles(id, display_name, avatar_url, mmr)')
      .eq('lobby_id', lobbyData.id)
      .order('joined_at', { ascending: true });

    if (lpError) throw lpError;

    // Assign teams based on stored value or fallback to join order
    const playersWithTeams = lobbyPlayers.map((lp: any, index: number) => ({
      ...lp.profiles,
      joined_at: lp.joined_at,
      team: lp.team || (index < 2 ? 'A' : 'B'),
      is_ready: lp.is_ready || false
    }));

    res.json({ lobby: lobbyData, players: playersWithTeams });
  } catch (error) {
    console.error('Fetch active lobby error:', error);
    res.status(500).json({ error: 'Failed to fetch active lobby' });
  }
});

    // Toggle Ready Status
    router.post('/lobbies/ready', authenticateToken, async (req: any, res) => {
      const { lobby_id, is_ready } = req.body;
      console.log(`[DEBUG] /lobbies/ready called. User: ${req.user.id}, Lobby: ${lobby_id}, Ready: ${is_ready}`);
    
      try {
        // Check if user is in this lobby
        const { data: membership, error: memError } = await supabase
          .from('lobby_players')
          .select('is_ready')
          .eq('lobby_id', lobby_id)
          .eq('profile_id', req.user.id)
          .single();
    
        if (memError || !membership) {
          console.error(`[DEBUG] Membership check failed. Error: ${JSON.stringify(memError)}, Membership: ${JSON.stringify(membership)}`);
          return res.status(400).json({ error: 'You are not in this lobby' });
        }
    
        // Update ready status
        const { error: updateError } = await supabase
          .from('lobby_players')
          .update({ is_ready })
          .eq('lobby_id', lobby_id)
          .eq('profile_id', req.user.id);
    
        if (updateError) {
            console.error('[DEBUG] Failed to update ready status:', updateError);
            throw updateError;
        }
    
        // Check if all players are ready and lobby is full
        if (is_ready) {
          const { count: totalPlayers, error: totalError } = await supabase
            .from('lobby_players')
            .select('*', { count: 'exact', head: true })
            .eq('lobby_id', lobby_id);
          
          if (totalError) throw totalError;
    
          const { count: readyPlayers, error: readyError } = await supabase
            .from('lobby_players')
            .select('*', { count: 'exact', head: true })
            .eq('lobby_id', lobby_id)
            .eq('is_ready', true);
    
          if (readyError) throw readyError;
    
          if ((totalPlayers || 0) === 4 && (readyPlayers || 0) === 4) {
             // We no longer auto-start. Just return success.
             // The frontend will see everyone is ready and show the Start Game button.
             return res.json({ message: 'Ready status updated. Waiting for start.', all_ready: true });
          }
        }
    
        res.json({ message: `Ready status updated to ${is_ready}` });
      } catch (error: any) {
        console.error('Toggle ready error:', error);
        res.status(500).json({ 
            error: 'Failed to update ready status',
            details: error.message || error.toString()
        });
      }
    });

    // Start Game (Manual Trigger)
    router.post('/lobbies/start', authenticateToken, async (req: any, res) => {
      const { lobby_id } = req.body;
      console.log(`[DEBUG] /lobbies/start called. User: ${req.user.id}, Lobby: ${lobby_id}`);

      try {
        // Check if user is in this lobby
        const { data: membership, error: memError } = await supabase
          .from('lobby_players')
          .select('*')
          .eq('lobby_id', lobby_id)
          .eq('profile_id', req.user.id)
          .single();

        if (memError || !membership) {
          return res.status(400).json({ error: 'You are not in this lobby' });
        }

        // Verify all players are ready and lobby is full
        const { count: totalPlayers, error: totalError } = await supabase
          .from('lobby_players')
          .select('*', { count: 'exact', head: true })
          .eq('lobby_id', lobby_id);
        
        if (totalError) throw totalError;

        const { count: readyPlayers, error: readyError } = await supabase
          .from('lobby_players')
          .select('*', { count: 'exact', head: true })
          .eq('lobby_id', lobby_id)
          .eq('is_ready', true);

        if (readyError) throw readyError;

        if ((totalPlayers || 0) !== 4 || (readyPlayers || 0) !== 4) {
          return res.status(400).json({ error: 'Not all players are ready or lobby is not full.' });
        }

        console.log('[DEBUG] Manual start triggered. Starting game...');
        
        // Start Game
        const { error: startError } = await supabase
          .from('lobbies')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', lobby_id);
        
        if (startError) {
            console.error('[DEBUG] Failed to start game:', startError);
            return res.status(500).json({ 
                error: 'Failed to start game', 
                details: startError.message,
                hint: 'Ensure server is using Service Role Key'
            });
        }
        
        return res.json({ message: 'Game started!', game_started: true });

      } catch (error: any) {
        console.error('Start game error:', error);
        res.status(500).json({ 
            error: 'Failed to start game',
            details: error.message || error.toString()
        });
      }
    });

// Switch Team
router.post('/lobbies/team', authenticateToken, async (req: any, res) => {
  const { lobby_id, team } = req.body;
  console.log(`[DEBUG] /lobbies/team called. User: ${req.user.id}, Lobby: ${lobby_id}, Team: ${team}`);

  if (!['A', 'B'].includes(team)) {
    return res.status(400).json({ error: 'Invalid team selection' });
  }

  try {
    // Check if user is in this lobby
    const { data: membership, error: memError } = await supabase
      .from('lobby_players')
      .select('team')
      .eq('lobby_id', lobby_id)
      .eq('profile_id', req.user.id)
      .single();

    if (memError || !membership) {
      console.error(`[DEBUG] Membership check failed. Error: ${JSON.stringify(memError)}, Membership: ${JSON.stringify(membership)}`);
      return res.status(400).json({ error: 'You are not in this lobby' });
    }

    if (membership.team === team) {
      return res.json({ message: 'Already on this team' });
    }

    // Check if target team is full (max 2)
    const { count, error: countError } = await supabase
      .from('lobby_players')
      .select('*', { count: 'exact', head: true })
      .eq('lobby_id', lobby_id)
      .eq('team', team);

    if (countError) throw countError;

    if ((count || 0) >= 2) {
      return res.status(400).json({ error: `Team ${team} is full` });
    }

    // Update team
    const { error: updateError } = await supabase
      .from('lobby_players')
      .update({ team })
      .eq('lobby_id', lobby_id)
      .eq('profile_id', req.user.id);

    if (updateError) throw updateError;

    res.json({ message: `Switched to Team ${team}` });
  } catch (error: any) {
    console.error('Switch team error:', error);
    res.status(500).json({ error: 'Failed to switch team' });
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
      // If already in THIS lobby, return success (idempotent)
      if (active.id === lobby.id) {
        return res.json({ message: 'Already joined', lobby_id: lobby.id });
      }
      // Otherwise, block joining a new one
      return res.status(400).json({ error: 'You are already in an active lobby. Please leave it first.' });
    }
    
    if (lobby.status !== 'open') {
      return res.status(400).json({ error: 'Lobby is not open' });
    }
    
    // Check player count
    const { count, error: countError } = await supabase
      .from('lobby_players')
      .select('*', { count: 'exact', head: true })
      .eq('lobby_id', lobby.id);

    if (countError) throw countError;
    
    if ((count || 0) >= 4) {
      return res.status(400).json({ error: 'Lobby is full' });
    }

    // Determine Team Assignment
    const { count: countA } = await supabase
      .from('lobby_players')
      .select('*', { count: 'exact', head: true })
      .eq('lobby_id', lobby.id)
      .eq('team', 'A');
    
    const team = (countA || 0) < 2 ? 'A' : 'B';
    
    // Join
    const { error: joinError } = await supabase
      .from('lobby_players')
      .insert([{ lobby_id: lobby.id, profile_id: req.user.id, team }]);

    if (joinError) throw joinError;
    
    // If full (4 players), update status
    if ((count || 0) + 1 === 4) {
      await supabase
        .from('lobbies')
        .update({ status: 'full' })
        .eq('id', lobby.id);
    }
    
    res.json({ message: 'Joined successfully', lobby_id: lobby.id });
  } catch (error) {
    console.error('Join lobby error:', error);
    res.status(500).json({ error: 'Failed to join lobby' });
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
