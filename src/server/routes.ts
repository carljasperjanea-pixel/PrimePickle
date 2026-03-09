import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { supabase, supabaseKeyConfig } from './supabase.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Configure Multer for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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
  const { email, password, display_name, full_name, role, address, phone } = req.body;
  
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
        { 
          id, 
          email, 
          password_hash: hashedPassword, 
          display_name, 
          full_name,
          role: role || 'player',
          address: address || null,
          phone: phone || null
        }
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
      if (error.code === '42P01' || error.code === 'PGRST205') { // Undefined table
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
    res.json({ user: { id, email, display_name, full_name, role: role || 'player' } });
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
        
        if (error.code === '42P01' || error.code === 'PGRST205') { // Undefined table
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
      .select('id, email, display_name, full_name, phone, address, avatar_url, mmr, games_played, role, visibility_settings, behavior_score')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.sendStatus(404);
    res.json({ user });
  } catch (error) {
    console.error('User fetch error:', error);
    res.sendStatus(500);
  }
});

// Update User Profile
router.put('/user/profile', authenticateToken, async (req: any, res) => {
  const { display_name, full_name, address, phone, visibility_settings } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name, full_name, address, phone, visibility_settings })
      .eq('id', req.user.id)
      .select('id, email, display_name, full_name, phone, address, avatar_url, mmr, games_played, role, visibility_settings')
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (error: any) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// Get Public Feature Flags
router.get('/public/feature-flags', async (req, res) => {
  try {
    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('key, is_enabled');

    if (error) {
      // If table doesn't exist, return empty
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return res.json({ flags: [] });
      }
      throw error;
    }
    res.json({ flags: flags || [] });
  } catch (error) {
    console.error('Public feature flags fetch error:', error);
    res.json({ flags: [] }); // Fail open
  }
});

// Get Public Profile (Respects Visibility Settings)
router.get('/public/profile/:id', authenticateToken, async (req: any, res) => {
  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, full_name, phone, address, avatar_url, mmr, games_played, role, visibility_settings')
      .eq('id', req.params.id)
      .single();

    if (error || !user) return res.sendStatus(404);

    // Filter based on visibility settings
    const publicProfile: any = {
      id: user.id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      mmr: user.mmr,
      games_played: user.games_played,
      role: user.role,
    };

    const settings = user.visibility_settings || { email: false, phone: false, address: false };

    if (settings.email) publicProfile.email = user.email;
    if (settings.phone) publicProfile.phone = user.phone;
    if (settings.address) publicProfile.address = user.address;
    if (settings.full_name) publicProfile.full_name = user.full_name;

    res.json({ user: publicProfile });
  } catch (error) {
    console.error('Public profile fetch error:', error);
    res.sendStatus(500);
  }
});

// Upload User Avatar
router.post('/user/avatar', authenticateToken, upload.single('avatar'), async (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const file = req.file;
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${req.user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase
      .storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.log('Upload error:', uploadError);
      // Try to create bucket if it doesn't exist (error message might vary)
      // Common error for missing bucket is "The resource was not found" or similar
      try {
        console.log('Attempting to create "avatars" bucket...');
        const { data: bucket, error: bucketError } = await supabase.storage.createBucket('avatars', {
            public: true,
            fileSizeLimit: 1024 * 1024 * 2, // 2MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
        });
        
        if (bucketError) {
            console.error('Failed to create avatars bucket:', bucketError);
            // If it failed because it already exists (race condition?), we might want to ignore
            if (!bucketError.message.includes('already exists')) {
                 throw uploadError;
            }
        }
        
        // Retry upload
        const { error: retryError } = await supabase
          .storage
          .from('avatars')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });
          
        if (retryError) throw retryError;
        
      } catch (e) {
        console.error('Retry failed:', e);
        throw uploadError;
      }
    }

    // Get Public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Update Profile
    const { data: user, error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', req.user.id)
      .select('id, email, display_name, full_name, phone, address, avatar_url, mmr, games_played, role')
      .single();

    if (updateError) throw updateError;

    res.json({ user, message: 'Avatar uploaded successfully' });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar', details: error.message });
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
          .update({ status: 'in_progress', started_at: new Date(Date.now() + 5000).toISOString() })
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
  let { qr_payload } = req.body;
  if (typeof qr_payload === 'string') {
    qr_payload = qr_payload.trim().replace(/^"|"$/g, '');
  }
  console.log(`[DEBUG] /lobbies/join called. User: ${req.user.id}, Payload: "${qr_payload}"`);
  
  try {
    // Find lobby by QR payload
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('qr_payload', qr_payload)
      .single();
    
    console.log('[DEBUG] Lobby lookup result:', { lobby, error: lobbyError });
    
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
    
    // Fetch players with team info
    const { data: lobbyPlayers, error: lpError } = await supabase
      .from('lobby_players')
      .select('team, profiles(id, display_name, avatar_url, mmr)')
      .eq('lobby_id', req.params.id);

    if (lpError) throw lpError;

    // Transform to match expected format but with team info
    const players = lobbyPlayers.map((lp: any) => ({
      ...lp.profiles,
      team: lp.team
    }));

    res.json({ lobby, players });
  } catch (error) {
    console.error('Lobby details error:', error);
    res.status(500).json({ error: 'Failed to fetch lobby details' });
  }
});

// Complete Match (Admin or Participating Player)
router.post('/matches/complete', authenticateToken, async (req: any, res) => {
  const { lobby_id, winner_team, score } = req.body; // winner_team: 'A' or 'B'
  
  try {
    // Authorization Check
    if (req.user.role !== 'admin') {
      // Check if user is a participant in this lobby
      const { data: membership, error: memError } = await supabase
        .from('lobby_players')
        .select('id')
        .eq('lobby_id', lobby_id)
        .eq('profile_id', req.user.id)
        .single();

      if (memError || !membership) {
        return res.status(403).json({ error: 'Unauthorized: You are not a participant in this match' });
      }
    }

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

    // Optimistic Lock: Try to set status to 'completed' to prevent double submission
    // We do this BEFORE updating MMR to ensure only one request succeeds.
    const { data: lockedLobby, error: lockError } = await supabase
      .from('lobbies')
      .update({ status: 'completed' })
      .eq('id', lobby_id)
      .eq('status', 'in_progress') // Ensure we are the first
      .select()
      .single();

    if (lockError || !lockedLobby) {
       console.log('[DEBUG] Match completion race condition detected or invalid state.');
       return res.status(400).json({ error: 'Match already completed or invalid state' });
    }

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
    const matchId = uuidv4();
    await supabase.from('matches').insert([{
      id: matchId,
      lobby_id, 
      winner_team, 
      score, 
      mmr_delta: mmrDeltaWin
    }]);
      
    // Lobby status is already updated to 'completed' by the optimistic lock above.
    
    res.json({ message: 'Match completed and MMR updated', matchId });
    
  } catch (error) {
    console.error('Complete match error:', error);
    res.status(500).json({ error: 'Failed to complete match' });
  }
});

router.post('/matches/:matchId/rate', authenticateToken, async (req: any, res) => {
  const { matchId } = req.params;
  const { ratings } = req.body; // Array of { ratedId, sportsmanship, communication }

  if (!Array.isArray(ratings) || ratings.length === 0) {
    return res.status(400).json({ error: 'Invalid ratings data' });
  }

  try {
    const raterId = req.user.id;

    // Insert ratings
    const inserts = ratings.map((r: any) => ({
      match_id: matchId,
      rater_id: raterId,
      rated_id: r.ratedId,
      sportsmanship: r.sportsmanship,
      communication: r.communication
    }));

    const { error } = await supabase.from('player_ratings').insert(inserts);
    if (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'You have already rated these players for this match.' });
        }
        throw error;
    }

    // Update Behavior Score for each rated player
    for (const r of ratings) {
      const { data: allRatings, error: fetchError } = await supabase
        .from('player_ratings')
        .select('sportsmanship, communication')
        .eq('rated_id', r.ratedId);

      if (fetchError) continue;

      if (allRatings && allRatings.length > 0) {
        let totalScore = 0;
        for (const ar of allRatings) {
          // Average of sportsmanship and communication (1-5)
          const avg = (ar.sportsmanship + ar.communication) / 2;
          totalScore += avg;
        }
        
        // Scale 1-5 to 20-100
        const averageRating = totalScore / allRatings.length;
        const behaviorScore = Math.round(averageRating * 20);

        await supabase
          .from('profiles')
          .update({ behavior_score: behaviorScore })
          .eq('id', r.ratedId);
      }
    }

    res.json({ message: 'Ratings submitted successfully' });
  } catch (error) {
    console.error('Rating error:', error);
    res.status(500).json({ error: 'Failed to submit ratings' });
  }
});

// Cancel Match (Participating Player)
router.post('/lobbies/cancel', authenticateToken, async (req: any, res) => {
  const { lobby_id } = req.body;

  try {
    // Check if user is in this lobby
    const { data: membership, error: memError } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobby_id)
      .eq('profile_id', req.user.id)
      .single();

    if (memError || !membership) {
      return res.status(403).json({ error: 'Unauthorized: You are not in this lobby' });
    }

    // Check player count to determine if full or open
    const { count } = await supabase
      .from('lobby_players')
      .select('*', { count: 'exact', head: true })
      .eq('lobby_id', lobby_id);

    const newStatus = (count || 0) >= 4 ? 'full' : 'open';

    const { error: updateError } = await supabase
      .from('lobbies')
      .update({ status: newStatus, started_at: null })
      .eq('id', lobby_id);

    if (updateError) throw updateError;

    // Reset ready status for all players
    await supabase
      .from('lobby_players')
      .update({ is_ready: false })
      .eq('lobby_id', lobby_id);

    res.json({ message: 'Match cancelled', status: newStatus });

  } catch (error) {
    console.error('Cancel match error:', error);
    res.status(500).json({ error: 'Failed to cancel match' });
  }
});

// Temporary route to seed a super admin account
router.get('/auth/seed-super-admin', async (req, res) => {
  try {
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
      return res.json({ message: 'Super Admin account already exists', email, password });
    }

    const { error } = await supabase
      .from('profiles')
      .insert([
        { id, email, password_hash: hashedPassword, display_name: 'Super Admin', role: 'super_admin' }
      ]);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Super Admin account created successfully', email, password });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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

// Get Pending Ratings
router.get('/user/pending-ratings', authenticateToken, async (req: any, res) => {
  try {
    // 1. Find recent completed matches for this user (last 24 hours)
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('id, completed_at, lobby_id')
      .gt('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('completed_at', { ascending: false });

    if (matchError) throw matchError;

    if (!matches || matches.length === 0) {
      return res.json({ pending: [] });
    }

    const pendingMatches = [];

    for (const match of matches) {
      // Check if user was in this match
      const { data: membership, error: memError } = await supabase
        .from('lobby_players')
        .select('profile_id')
        .eq('lobby_id', match.lobby_id)
        .eq('profile_id', req.user.id)
        .single();

      if (memError || !membership) continue; // Not in this match

      // Check if user has already rated ANYONE in this match
      const { count, error: ratingError } = await supabase
        .from('player_ratings')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .eq('rater_id', req.user.id);

      if (ratingError) continue;

      if (count === 0) {
        // User hasn't rated anyone yet. Add to pending.
        // Fetch other players in this match to rate
        const { data: otherPlayers, error: opError } = await supabase
          .from('lobby_players')
          .select('profiles(id, display_name, avatar_url)')
          .eq('lobby_id', match.lobby_id)
          .neq('profile_id', req.user.id);

        if (opError) continue;

        pendingMatches.push({
          matchId: match.id,
          playedAt: match.completed_at,
          playersToRate: otherPlayers.map((p: any) => p.profiles)
        });
      }
    }

    res.json({ pending: pendingMatches });

  } catch (error) {
    console.error('Pending ratings error:', error);
    res.status(500).json({ error: 'Failed to fetch pending ratings' });
  }
});

    // Get User Match History
    router.get('/user/matches', authenticateToken, async (req: any, res) => {
      try {
        // 1. Get all lobby_ids the user has participated in
        const { data: userLobbies, error: ulError } = await supabase
          .from('lobby_players')
          .select('lobby_id')
          .eq('profile_id', req.user.id);
    
        if (ulError) throw ulError;
    
        const lobbyIds = userLobbies.map((l: any) => l.lobby_id);
    
        if (lobbyIds.length === 0) {
          return res.json({ matches: [] });
        }
    
        // 2. Fetch matches for these lobbies
        const { data: matches, error: mError } = await supabase
          .from('matches')
          .select(`
            id,
            lobby_id,
            winner_team,
            score,
            mmr_delta,
            completed_at
          `)
          .in('lobby_id', lobbyIds)
          .order('completed_at', { ascending: false });
    
        if (mError) throw mError;
    
        // 3. For each match, fetch the players and their teams
        const { data: allPlayers, error: apError } = await supabase
          .from('lobby_players')
          .select(`
            lobby_id,
            team,
            profiles (
              id,
              display_name,
              avatar_url
            )
          `)
          .in('lobby_id', matches.map((m: any) => m.lobby_id));
    
        if (apError) throw apError;
    
        // 4. Combine data
        const matchesWithPlayers = matches.map((match: any) => {
          const players = allPlayers
            .filter((p: any) => p.lobby_id === match.lobby_id)
            .map((p: any) => ({
              id: p.profiles.id,
              display_name: p.profiles.display_name,
              avatar_url: p.profiles.avatar_url,
              team: p.team
            }));
    
          // Determine if user won
          const userPlayer = players.find((p: any) => p.id === req.user.id);
          const userTeam = userPlayer?.team;
          const isWin = userTeam === match.winner_team;
    
          return {
            ...match,
            players,
            result: isWin ? 'win' : 'loss',
            user_team: userTeam
          };
        });
    
        res.json({ matches: matchesWithPlayers });
    
      } catch (error) {
        console.error('Match history error:', error);
        res.status(500).json({ error: 'Failed to fetch match history' });
      }
    });
    
    // --- Player Gears Routes ---

    // Get User's Gears
    router.get('/user/gears', authenticateToken, async (req: any, res) => {
      try {
        const { data: gears, error } = await supabase
          .from('player_gears')
          .select('*')
          .eq('player_id', req.user.id)
          .order('is_primary', { ascending: false }) // Primary first
          .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ gears });
      } catch (error) {
        console.error('Fetch gears error:', error);
        res.status(500).json({ error: 'Failed to fetch gears' });
      }
    });

    // Add New Gear
    router.post('/user/gears', authenticateToken, upload.single('image'), async (req: any, res) => {
      const { name, type } = req.body;
      let image_url = null;

      try {
        // Handle Image Upload if present
        if (req.file) {
          const file = req.file;
          const fileExt = file.originalname.split('.').pop();
          const fileName = `gear-${req.user.id}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('avatars') // Reusing avatars bucket for now, or create 'gears' bucket
            .upload(fileName, file.buffer, {
              contentType: file.mimetype,
              upsert: true
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
            
          image_url = publicUrl;
        }

        // Insert Gear
        const { data: gear, error } = await supabase
          .from('player_gears')
          .insert([{
            player_id: req.user.id,
            name,
            type,
            image_url,
            is_primary: false // Default to false
          }])
          .select()
          .single();

        if (error) throw error;
        res.json({ gear });

      } catch (error: any) {
        console.error('Add gear error:', error);
        res.status(500).json({ error: 'Failed to add gear', details: error.message });
      }
    });

    // Delete Gear
    router.delete('/user/gears/:id', authenticateToken, async (req: any, res) => {
      try {
        const { error } = await supabase
          .from('player_gears')
          .delete()
          .eq('id', req.params.id)
          .eq('player_id', req.user.id);

        if (error) throw error;
        res.json({ message: 'Gear deleted' });
      } catch (error) {
        console.error('Delete gear error:', error);
        res.status(500).json({ error: 'Failed to delete gear' });
      }
    });

    // Set Primary Gear
    router.put('/user/gears/:id/primary', authenticateToken, async (req: any, res) => {
      try {
        // 1. Get the gear to find its type
        const { data: gear, error: fetchError } = await supabase
          .from('player_gears')
          .select('type')
          .eq('id', req.params.id)
          .eq('player_id', req.user.id)
          .single();
        
        if (fetchError || !gear) throw fetchError || new Error('Gear not found');

        // 2. Unset primary for all gears of this type for this user
        await supabase
          .from('player_gears')
          .update({ is_primary: false })
          .eq('player_id', req.user.id)
          .eq('type', gear.type);

        // 3. Set this gear as primary
        const { data: updated, error: updateError } = await supabase
          .from('player_gears')
          .update({ is_primary: true })
          .eq('id', req.params.id)
          .eq('player_id', req.user.id)
          .select()
          .single();

        if (updateError) throw updateError;
        res.json({ gear: updated });

      } catch (error) {
        console.error('Set primary gear error:', error);
        res.status(500).json({ error: 'Failed to set primary gear' });
      }
    });

    // --- Super Admin Routes ---

    // Middleware for Super Admin
    const authenticateSuperAdmin = async (req: any, res: any, next: any) => {
      authenticateToken(req, res, async () => {
        if (req.user.role !== 'super_admin') {
          return res.status(403).json({ error: 'Super Admin access required' });
        }
        next();
      });
    };

    // Helper to log audit
    const logAudit = async (adminId: string, action: string, targetId?: string, details?: any, ip?: string) => {
      try {
        const { error } = await supabase.from('audit_logs').insert([{
          admin_id: adminId,
          action_performed: action,
          target_id: targetId,
          details,
          ip_address: ip
        }]);
        if (error) console.log('Audit log skipped (table might not exist):', action);
      } catch (e) {
        console.error('Failed to log audit:', e);
      }
    };

    // Get Analytics
    router.get('/superadmin/analytics', authenticateSuperAdmin, async (req: any, res) => {
      try {
        const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: activeLobbies } = await supabase.from('lobbies').select('*', { count: 'exact', head: true }).neq('status', 'completed');
        
        // Mock revenue and system health for now
        res.json({
          totalUsers: totalUsers || 0,
          activeSessions: activeLobbies || 0,
          revenue: 12500,
          systemHealth: {
            uptime: 99.99,
            apiResponseTime: 45,
            errorRate: 0.01,
            status: 'green'
          },
          growth: [
            { date: '2023-10-01', signups: 12 },
            { date: '2023-10-02', signups: 19 },
            { date: '2023-10-03', signups: 15 },
            { date: '2023-10-04', signups: 25 },
            { date: '2023-10-05', signups: 22 },
            { date: '2023-10-06', signups: 30 },
            { date: '2023-10-07', signups: 28 },
          ]
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics' });
      }
    });

    // Get Users
    router.get('/superadmin/users', authenticateSuperAdmin, async (req: any, res) => {
      try {
        const { data: users, error } = await supabase
          .from('profiles')
          .select('id, email, display_name, full_name, role, created_at')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ users });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
      }
    });

    // Update User Role
    router.put('/superadmin/users/:id/role', authenticateSuperAdmin, async (req: any, res) => {
      const { role } = req.body;
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ role })
          .eq('id', req.params.id);
        
        if (error) throw error;
        await logAudit(req.user.id, 'UPDATE_USER_ROLE', req.params.id, { role }, req.ip);
        res.json({ message: 'Role updated' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update user role' });
      }
    });

    // Suspend/Ban User (Mocked via role or status if we had one, using role='banned' for now)
    router.post('/superadmin/users/:id/ban', authenticateSuperAdmin, async (req: any, res) => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ role: 'banned' })
          .eq('id', req.params.id);
        
        if (error) throw error;
        await logAudit(req.user.id, 'BAN_USER', req.params.id, null, req.ip);
        res.json({ message: 'User banned' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to ban user' });
      }
    });
    
    // Get Audit Logs
    router.get('/superadmin/audit-logs', authenticateSuperAdmin, async (req: any, res) => {
      try {
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select('*, profiles(display_name, email)')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) {
           // Return mock data if table doesn't exist
           return res.json({ logs: [
             { id: '1', created_at: new Date().toISOString(), admin_id: 'system', action_performed: 'SYSTEM_START', target_id: null, ip_address: '127.0.0.1', profiles: { email: 'system@local' } }
           ]});
        }
        res.json({ logs });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
      }
    });

    // Get Feature Flags
    router.get('/superadmin/feature-flags', authenticateSuperAdmin, async (req: any, res) => {
      try {
        const { data: flags, error } = await supabase
          .from('feature_flags')
          .select('*')
          .order('key');
        
        if (error) {
           // Return mock data if table doesn't exist
           return res.json({ flags: [
             { id: '1', key: 'maintenance_mode', is_enabled: false, description: 'Global Kill-Switch for maintenance mode' },
             { id: '2', key: 'user_registration', is_enabled: true, description: 'Allow new users to register' }
           ]});
        }
        res.json({ flags });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch feature flags' });
      }
    });

    // Update Feature Flag
    router.put('/superadmin/feature-flags/:key', authenticateSuperAdmin, async (req: any, res) => {
      const { is_enabled } = req.body;
      try {
        const { error } = await supabase
          .from('feature_flags')
          .update({ is_enabled, updated_at: new Date().toISOString() })
          .eq('key', req.params.key);
        
        if (error) {
           // Just return success if table doesn't exist
           return res.json({ message: 'Feature flag updated (mock)' });
        }
        await logAudit(req.user.id, 'UPDATE_FEATURE_FLAG', undefined, { key: req.params.key, is_enabled }, req.ip);
        res.json({ message: 'Feature flag updated' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update feature flag' });
      }
    });

    // Impersonate User
    router.post('/superadmin/impersonate/:id', authenticateSuperAdmin, async (req: any, res) => {
      try {
        const { data: targetUser, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', req.params.id)
          .single();
          
        if (error || !targetUser) return res.status(404).json({ error: 'User not found' });
        
        // Generate a token for the target user
        const token = jwt.sign({ id: targetUser.id, email: targetUser.email, role: targetUser.role, impersonatedBy: req.user.id }, JWT_SECRET);
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        
        await logAudit(req.user.id, 'IMPERSONATE_USER', targetUser.id, null, req.ip);
        
        const { password_hash, ...userWithoutPassword } = targetUser;
        res.json({ user: userWithoutPassword });
      } catch (error) {
        res.status(500).json({ error: 'Failed to impersonate user' });
      }
    });

    export default router;
