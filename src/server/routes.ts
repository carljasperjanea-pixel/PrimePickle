import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase.js';

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
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    
    const { error } = await supabase
      .from('profiles')
      .insert([
        { id, email, password_hash: hashedPassword, display_name, role: role || 'player' }
      ]);
    
    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Email already exists' });
      }
      throw error;
    }
    
    const token = jwt.sign({ id, email, role: role || 'player' }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.json({ user: { id, email, display_name, role: role || 'player' } });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    
    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  const id = uuidv4();
  const qr_payload = uuidv4(); // Unique string for QR code
  
  try {
    const { error } = await supabase
      .from('lobbies')
      .insert([
        { id, admin_id: req.user.id, qr_payload, status: 'open' }
      ]);

    if (error) throw error;
    res.json({ id, qr_payload, status: 'open' });
  } catch (error) {
    console.error('Create lobby error:', error);
    res.status(500).json({ error: 'Failed to create lobby' });
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
          lobby_players (count)
        `)
        .eq('admin_id', req.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform count format if needed
      const lobbiesWithCount = lobbies.map((l: any) => ({
        ...l,
        player_count: l.lobby_players[0]?.count || 0
      }));

      res.json({ lobbies: lobbiesWithCount });
    } else {
      // Get lobbies the player has joined
      const { data: lobbies, error } = await supabase
        .from('lobbies')
        .select('*')
        .in('id', (
          await supabase
            .from('lobby_players')
            .select('lobby_id')
            .eq('profile_id', req.user.id)
        ).data?.map((lp: any) => lp.lobby_id) || [])
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ lobbies });
    }
  } catch (error) {
    console.error('Fetch lobbies error:', error);
    res.status(500).json({ error: 'Failed to fetch lobbies' });
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
    
    if (lobby.status !== 'open') {
      return res.status(400).json({ error: 'Lobby is not open' });
    }
    
    // Check if player is already in lobby
    const { data: existing } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobby.id)
      .eq('profile_id', req.user.id)
      .single();

    if (existing) {
      return res.json({ message: 'Already joined', lobby_id: lobby.id });
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
    
    // Join
    const { error: joinError } = await supabase
      .from('lobby_players')
      .insert([{ lobby_id: lobby.id, profile_id: req.user.id }]);

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
