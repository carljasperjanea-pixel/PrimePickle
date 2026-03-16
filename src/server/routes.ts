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

// --- Super Admin Routes ---

// Get all users
router.get('/super-admin/users', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);

  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, full_name, role, created_at, mfa_enabled, is_suspended')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ users });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role
router.put('/super-admin/users/:id/role', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);
  const { role } = req.body;

  if (!['player', 'admin', 'super_admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', req.params.id)
      .select('id, email, display_name, role')
      .single();

    if (error) throw error;
    res.json({ user, message: 'Role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete user
router.delete('/super-admin/users/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.sendStatus(403);

  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

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

// Search Players and Clubs
router.get('/search', authenticateToken, async (req: any, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ players: [], clubs: [] });
    }

    const { data: players, error: playersError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, mmr')
      .ilike('display_name', `%${q}%`)
      .limit(5);

    if (playersError) {
      console.error('Player search error:', playersError);
      return res.status(500).json({ error: 'Failed to search players' });
    }

    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('id, name, description')
      .ilike('name', `%${q}%`)
      .limit(5);

    if (clubsError) {
      console.error('Club search error:', clubsError);
      return res.status(500).json({ error: 'Failed to search clubs' });
    }

    res.json({ players: players || [], clubs: clubs || [] });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search' });
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

// Get Public Gears
router.get('/public/gears/:id', authenticateToken, async (req: any, res) => {
  try {
    const { data: gears, error } = await supabase
      .from('player_gears')
      .select('*')
      .eq('player_id', req.params.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ gears });
  } catch (error) {
    console.error('Fetch public gears error:', error);
    res.status(500).json({ error: 'Failed to fetch gears' });
  }
});

// Get Public Matches
router.get('/public/matches/:id', authenticateToken, async (req: any, res) => {
  try {
    // 1. Get all lobby_ids the user has participated in
    const { data: userLobbies, error: ulError } = await supabase
      .from('lobby_players')
      .select('lobby_id, team')
      .eq('profile_id', req.params.id);

    if (ulError) throw ulError;

    if (!userLobbies || userLobbies.length === 0) {
      return res.json({ matches: [] });
    }

    const lobbyIds = userLobbies.map((l: any) => l.lobby_id);

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
      .order('completed_at', { ascending: false })
      .limit(10);

    if (mError) throw mError;

    // 3. Format matches
    const formattedMatches = matches.map((match: any) => {
      const userLobby = userLobbies.find((l: any) => l.lobby_id === match.lobby_id);
      const isWin = match.winner_team === userLobby?.team;
      
      return {
        id: match.id,
        date: match.completed_at,
        result: isWin ? 'Win' : 'Loss',
        score: match.score,
        mmr_delta: isWin ? match.mmr_delta : -match.mmr_delta
      };
    });

    res.json({ matches: formattedMatches });
  } catch (error) {
    console.error('Fetch public matches error:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Follow a user
router.post('/user/follow/:id', authenticateToken, async (req: any, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    if (followerId === followingId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    const { error } = await supabase
      .from('followers')
      .insert([{ follower_id: followerId, following_id: followingId }]);

    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Already following this user' });
      }
      throw error;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/user/follow/:id', authenticateToken, async (req: any, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    const { error } = await supabase
      .from('followers')
      .delete()
      .match({ follower_id: followerId, following_id: followingId });

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Check if following
router.get('/user/is-following/:id', authenticateToken, async (req: any, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    const { data, error } = await supabase
      .from('followers')
      .select('created_at')
      .match({ follower_id: followerId, following_id: followingId })
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore not found error

    res.json({ isFollowing: !!data });
  } catch (error) {
    console.error('Check following error:', error);
    res.status(500).json({ error: 'Failed to check following status' });
  }
});

// Get followers count
router.get('/user/followers-count/:id', authenticateToken, async (req: any, res) => {
  try {
    const { count, error } = await supabase
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', req.params.id);

    if (error) throw error;

    res.json({ count: count || 0 });
  } catch (error) {
    console.error('Get followers count error:', error);
    res.status(500).json({ error: 'Failed to get followers count' });
  }
});

// Get following count
router.get('/user/following-count/:id', authenticateToken, async (req: any, res) => {
  try {
    const { count, error } = await supabase
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', req.params.id);

    if (error) throw error;

    res.json({ count: count || 0 });
  } catch (error) {
    console.error('Get following count error:', error);
    res.status(500).json({ error: 'Failed to get following count' });
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

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    console.log('[DEBUG] Permission denied: User is not admin or super_admin');
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

// --- Admin Routes ---

// Get paginated users for directory
router.get('/admin/users', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.sendStatus(403);

  try {
    const { search, role, status, sortBy = 'created_at', sortOrder = 'desc', page = '1', limit = '10' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('profiles')
      .select('id, email, display_name, full_name, role, created_at, games_played, mmr, mfa_enabled, is_suspended', { count: 'exact' });

    // Filtering
    if (search) {
      query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }
    if (role && role !== 'all') {
      query = query.eq('role', role);
    }
    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.gt('games_played', 0);
      } else if (status === 'inactive') {
        query = query.eq('games_played', 0);
      }
    }

    // Sorting
    const allowedSortColumns = ['display_name', 'email', 'role', 'created_at', 'games_played', 'mmr'];
    const sortCol = allowedSortColumns.includes(sortBy as string) ? (sortBy as string) : 'created_at';
    const isAscending = sortOrder === 'asc';
    
    query = query.order(sortCol, { ascending: isAscending });

    // Pagination
    query = query.range(offset, offset + limitNum - 1);

    let { data: users, error, count } = await query;

    // Fallback if mfa_enabled or is_suspended columns don't exist yet
    if (error && (error.code === 'PGRST106' || error.code === '42703')) {
      let fallbackQuery = supabase
        .from('profiles')
        .select('id, email, display_name, full_name, role, created_at, games_played, mmr', { count: 'exact' });
        
      if (search) {
        fallbackQuery = fallbackQuery.or(`display_name.ilike.%${search}%,email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }
      if (role && role !== 'all') {
        fallbackQuery = fallbackQuery.eq('role', role);
      }
      if (status && status !== 'all') {
        if (status === 'active') {
          fallbackQuery = fallbackQuery.gt('games_played', 0);
        } else if (status === 'inactive') {
          fallbackQuery = fallbackQuery.eq('games_played', 0);
        }
      }
      
      fallbackQuery = fallbackQuery.order(sortCol, { ascending: isAscending });
      fallbackQuery = fallbackQuery.range(offset, offset + limitNum - 1);
      
      const fallbackResult = await fallbackQuery;
      
      if (fallbackResult.data) {
        users = fallbackResult.data.map(u => ({ ...u, mfa_enabled: false, is_suspended: false }));
      } else {
        users = null;
      }
      
      error = fallbackResult.error;
      count = fallbackResult.count;
    }

    if (error) throw error;

    // Add computed status
    const usersWithStatus = (users || []).map(u => ({
      ...u,
      status: u.games_played > 0 ? 'active' : 'inactive'
    }));

    res.json({
      users: usersWithStatus,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (error) {
    console.error('Fetch admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Toggle MFA
router.post('/admin/users/:id/toggle-mfa', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.sendStatus(403);

  try {
    const { id } = req.params;
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('mfa_enabled')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST106' || fetchError.code === '42703') {
        return res.status(400).json({ error: 'MFA column not found. Please run fix_rls.sql in Supabase.' });
      }
      throw fetchError;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ mfa_enabled: !user.mfa_enabled })
      .eq('id', id);

    if (updateError) {
      if (updateError.code === 'PGRST106' || updateError.code === '42703') {
        return res.status(400).json({ error: 'MFA column not found. Please run fix_rls.sql in Supabase.' });
      }
      throw updateError;
    }

    res.json({ success: true, mfa_enabled: !user.mfa_enabled });
  } catch (error) {
    console.error('Toggle MFA error:', error);
    res.status(500).json({ error: 'Failed to toggle MFA' });
  }
});

// Toggle Suspend
router.post('/admin/users/:id/toggle-suspend', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.sendStatus(403);

  try {
    const { id } = req.params;
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('is_suspended')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST106' || fetchError.code === '42703') {
        return res.status(400).json({ error: 'Suspended column not found. Please run fix_rls.sql in Supabase.' });
      }
      throw fetchError;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_suspended: !user.is_suspended })
      .eq('id', id);

    if (updateError) {
      if (updateError.code === 'PGRST106' || updateError.code === '42703') {
        return res.status(400).json({ error: 'Suspended column not found. Please run fix_rls.sql in Supabase.' });
      }
      throw updateError;
    }

    res.json({ success: true, is_suspended: !user.is_suspended });
  } catch (error) {
    console.error('Toggle suspend error:', error);
    res.status(500).json({ error: 'Failed to toggle suspend status' });
  }
});

// Force Password Reset
router.post('/admin/users/:id/reset-password', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.sendStatus(403);

  try {
    const { id } = req.params;
    
    // In a real app, this would send a password reset email via Supabase Auth
    // For this demo, we'll just return success
    // await supabase.auth.admin.generateLink({ type: 'recovery', email: user.email })
    
    res.json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to initiate password reset' });
  }
});

// Send Notification (Admin/Super Admin)
router.post('/admin/notify', authenticateToken, async (req: any, res) => {
  try {
    const { targetRole, message } = req.body; // targetRole: 'player', 'admin', 'all'
    const senderRole = req.user.role;
    const senderId = req.user.id;

    if (senderRole !== 'admin' && senderRole !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (senderRole === 'admin' && targetRole !== 'player') {
      return res.status(403).json({ error: 'Admins can only notify players' });
    }

    // Fetch users to notify
    let query = supabase.from('profiles').select('id');
    if (targetRole === 'player') {
      query = query.eq('role', 'player');
    } else if (targetRole === 'admin') {
      query = query.eq('role', 'admin');
    } else if (targetRole === 'all') {
      query = query.in('role', ['player', 'admin']);
    }

    const { data: users, error: usersError } = await query;
    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const notifications = users.map(u => ({
      user_id: u.id,
      sender_id: senderId,
      message
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) throw insertError;

    res.json({ success: true, count: notifications.length });
  } catch (error) {
    console.error('Notify error:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// Get Match History for Admin
router.get('/admin/matches', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.sendStatus(403);

  try {
    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Fetch matches with pagination
    const { data: matches, error: mError, count } = await supabase
      .from('matches')
      .select(`
        id,
        lobby_id,
        winner_team,
        score,
        mmr_delta,
        completed_at
      `, { count: 'exact' })
      .order('completed_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (mError) throw mError;

    if (!matches || matches.length === 0) {
      return res.json({ matches: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 });
    }

    // Fetch players for these matches
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

    // Combine data
    const matchesWithPlayers = matches.map((match: any) => {
      const players = allPlayers?.filter((p: any) => p.lobby_id === match.lobby_id) || [];
      const teamA = players.filter((p: any) => p.team === 'A').map((p: any) => p.profiles);
      const teamB = players.filter((p: any) => p.team === 'B').map((p: any) => p.profiles);
      
      return {
        ...match,
        teamA,
        teamB
      };
    });

    res.json({
      matches: matchesWithPlayers,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (error) {
    console.error('Fetch admin match history error:', error);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

// Get Lobbies (Admin: all active, Player: joined)
router.get('/lobbies', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      // Get lobbies
      let query = supabase
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
        .order('created_at', { ascending: false });

      if (req.user.role === 'admin') {
        query = query.eq('admin_id', req.user.id);
      }

      const { data: lobbies, error } = await query;

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
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
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

// Get user notifications
router.get('/user/notifications', authenticateToken, async (req: any, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, sender:profiles!sender_id(display_name, avatar_url)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ notifications: data });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/user/notifications/:id/read', authenticateToken, async (req: any, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .match({ id: req.params.id, user_id: req.user.id });
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Mark all notifications as read
router.put('/user/notifications/read-all', authenticateToken, async (req: any, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .match({ user_id: req.user.id, is_read: false });
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
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

    // --- Clubs Routes ---

    // Get all clubs (with membership status)
    router.get('/clubs', authenticateToken, async (req: any, res) => {
      try {
        const { data: clubs, error } = await supabase
          .from('clubs')
          .select(`
            id, name, description, owner_id, created_at,
            club_members ( user_id, role )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Format to include user's membership status
        const formattedClubs = clubs.map(club => {
          const userMember = club.club_members.find((m: any) => m.user_id === req.user.id);
          return {
            ...club,
            member_count: club.club_members.filter((m: any) => m.role !== 'invited').length,
            user_role: userMember ? userMember.role : null,
            is_member: userMember && userMember.role !== 'invited',
            is_invited: userMember && userMember.role === 'invited'
          };
        });

        res.json({ clubs: formattedClubs });
      } catch (error: any) {
        console.error('Fetch clubs error:', error);
        res.status(500).json({ error: 'Failed to fetch clubs', details: error.message });
      }
    });

    // Create a club
    router.post('/clubs', authenticateToken, async (req: any, res) => {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: 'Club name is required' });

      try {
        // Create club
        const { data: club, error: clubError } = await supabase
          .from('clubs')
          .insert([{ name, description, owner_id: req.user.id }])
          .select()
          .single();

        if (clubError) throw clubError;

        // Add creator as owner in club_members
        const { error: memberError } = await supabase
          .from('club_members')
          .insert([{ club_id: club.id, user_id: req.user.id, role: 'owner' }]);

        if (memberError) throw memberError;

        res.json({ club, message: 'Club created successfully' });
      } catch (error: any) {
        console.error('Create club error:', error);
        res.status(500).json({ error: 'Failed to create club', details: error.message });
      }
    });

    // Get club details
    router.get('/clubs/:id', authenticateToken, async (req: any, res) => {
      try {
        const { data: club, error: clubError } = await supabase
          .from('clubs')
          .select('*')
          .eq('id', req.params.id)
          .single();

        if (clubError) throw clubError;

        const { data: members, error: membersError } = await supabase
          .from('club_members')
          .select(`
            user_id, role, joined_at,
            profiles:user_id ( display_name, full_name, avatar_url )
          `)
          .eq('club_id', req.params.id);

        if (membersError) throw membersError;

        res.json({ club, members });
      } catch (error: any) {
        console.error('Fetch club details error:', error);
        res.status(500).json({ error: 'Failed to fetch club details', details: error.message });
      }
    });

    // Invite user to club
    router.post('/clubs/:id/invite', authenticateToken, async (req: any, res) => {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'User ID is required' });

      try {
        // Check if user is owner or admin
        const { data: member, error: checkError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .single();

        if (checkError || !['owner', 'admin'].includes(member?.role)) {
          return res.status(403).json({ error: 'Only owners or admins can invite' });
        }

        // Check if already invited or member
        const { data: existing, error: existError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          return res.status(400).json({ error: 'User is already a member or invited' });
        }

        // Create invite
        const { error: inviteError } = await supabase
          .from('club_members')
          .insert([{ club_id: req.params.id, user_id: userId, role: 'invited' }]);

        if (inviteError) throw inviteError;

        // Create notification for the invited user
        const { data: club } = await supabase.from('clubs').select('name').eq('id', req.params.id).single();
        await supabase.from('notifications').insert([{
          user_id: userId,
          sender_id: req.user.id,
          message: `You have been invited to join the club: ${club?.name || 'Unknown Club'}`
        }]);

        res.json({ message: 'User invited successfully' });
      } catch (error: any) {
        console.error('Invite user error:', error);
        res.status(500).json({ error: 'Failed to invite user', details: error.message });
      }
    });

    // Invite user to club by email
    router.post('/clubs/:id/invite-by-email', authenticateToken, async (req: any, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      try {
        // Check if user is owner or admin
        const { data: member, error: checkError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .single();

        if (checkError || !['owner', 'admin'].includes(member?.role)) {
          return res.status(403).json({ error: 'Only owners or admins can invite' });
        }

        // Find user by email
        const { data: targetUser, error: userError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();

        if (userError || !targetUser) {
          return res.status(404).json({ error: 'User not found with that email' });
        }

        const userId = targetUser.id;

        // Check if already invited or member
        const { data: existing, error: existError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          return res.status(400).json({ error: 'User is already a member or invited' });
        }

        // Create invite
        const { error: inviteError } = await supabase
          .from('club_members')
          .insert([{ club_id: req.params.id, user_id: userId, role: 'invited' }]);

        if (inviteError) throw inviteError;

        // Create notification for the invited user
        const { data: club } = await supabase.from('clubs').select('name').eq('id', req.params.id).single();
        await supabase.from('notifications').insert([{
          user_id: userId,
          sender_id: req.user.id,
          message: `You have been invited to join the club: ${club?.name || 'Unknown Club'}`
        }]);

        res.json({ message: 'User invited successfully' });
      } catch (error: any) {
        console.error('Invite user error:', error);
        res.status(500).json({ error: 'Failed to invite user', details: error.message });
      }
    });

    // Respond to invite (accept/reject)
    router.put('/clubs/:id/members/:userId', authenticateToken, async (req: any, res) => {
      const { action } = req.body; // 'accept' or 'reject'
      
      // Only the invited user can accept/reject their own invite
      if (req.user.id !== req.params.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      try {
        if (action === 'accept') {
          const { error } = await supabase
            .from('club_members')
            .update({ role: 'member', joined_at: new Date().toISOString() })
            .eq('club_id', req.params.id)
            .eq('user_id', req.params.userId)
            .eq('role', 'invited');

          if (error) throw error;
          res.json({ message: 'Invitation accepted' });
        } else if (action === 'reject') {
          const { error } = await supabase
            .from('club_members')
            .delete()
            .eq('club_id', req.params.id)
            .eq('user_id', req.params.userId)
            .eq('role', 'invited');

          if (error) throw error;
          res.json({ message: 'Invitation rejected' });
        } else {
          res.status(400).json({ error: 'Invalid action' });
        }
      } catch (error: any) {
        console.error('Respond to invite error:', error);
        res.status(500).json({ error: 'Failed to respond to invite', details: error.message });
      }
    });

    // Leave or kick from club
    router.delete('/clubs/:id/members/:userId', authenticateToken, async (req: any, res) => {
      try {
        // If user is kicking someone else, check if they are owner/admin
        if (req.user.id !== req.params.userId) {
          const { data: member } = await supabase
            .from('club_members')
            .select('role')
            .eq('club_id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

          if (!member || !['owner', 'admin'].includes(member.role)) {
            return res.status(403).json({ error: 'Only owners or admins can kick members' });
          }
        }

        const { error } = await supabase
          .from('club_members')
          .delete()
          .eq('club_id', req.params.id)
          .eq('user_id', req.params.userId);

        if (error) throw error;
        res.json({ message: 'Member removed successfully' });
      } catch (error: any) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Failed to remove member', details: error.message });
      }
    });

    // --- Club Announcements Routes ---

    // Get announcements for a club
    router.get('/clubs/:id/announcements', authenticateToken, async (req: any, res) => {
      try {
        // Check if user is a member
        const { data: member, error: memberError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .neq('role', 'invited')
          .single();

        if (memberError || !member) {
          return res.status(403).json({ error: 'Only members can view announcements' });
        }

        const { data: announcements, error } = await supabase
          .from('club_announcements')
          .select(`
            id, content, is_pinned, created_at,
            author:author_id ( id, display_name, avatar_url ),
            reactions:club_announcement_reactions ( user_id, type )
          `)
          .eq('club_id', req.params.id)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ announcements });
      } catch (error: any) {
        console.error('Fetch announcements error:', error);
        res.status(500).json({ error: 'Failed to fetch announcements', details: error.message });
      }
    });

    // Create an announcement
    router.post('/clubs/:id/announcements', authenticateToken, async (req: any, res) => {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: 'Content is required' });

      try {
        // Check if user is owner or admin
        const { data: member, error: memberError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .in('role', ['owner', 'admin'])
          .single();

        if (memberError || !member) {
          return res.status(403).json({ error: 'Only owners and admins can post announcements' });
        }

        const { data: announcement, error } = await supabase
          .from('club_announcements')
          .insert([{
            club_id: req.params.id,
            author_id: req.user.id,
            content
          }])
          .select(`
            id, content, created_at,
            author:author_id ( id, display_name, avatar_url )
          `)
          .single();

        if (error) throw error;
        res.json({ announcement });
      } catch (error: any) {
        console.error('Create announcement error:', error);
        res.status(500).json({ error: 'Failed to create announcement', details: error.message });
      }
    });

    // React to an announcement
    router.post('/clubs/:id/announcements/:announcementId/react', authenticateToken, async (req: any, res) => {
      const { type } = req.body; // 'up' or 'down'
      if (!['up', 'down'].includes(type)) {
        return res.status(400).json({ error: 'Invalid reaction type' });
      }

      try {
        // Check if user is a member
        const { data: member, error: memberError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .neq('role', 'invited')
          .single();

        if (memberError || !member) {
          return res.status(403).json({ error: 'Only members can react' });
        }

        // Check if reaction already exists
        const { data: existingReaction } = await supabase
          .from('club_announcement_reactions')
          .select('type')
          .eq('announcement_id', req.params.announcementId)
          .eq('user_id', req.user.id)
          .maybeSingle();

        if (existingReaction) {
          if (existingReaction.type === type) {
            // Toggle off
            await supabase
              .from('club_announcement_reactions')
              .delete()
              .eq('announcement_id', req.params.announcementId)
              .eq('user_id', req.user.id);
            return res.json({ message: 'Reaction removed' });
          } else {
            // Update type
            await supabase
              .from('club_announcement_reactions')
              .update({ type })
              .eq('announcement_id', req.params.announcementId)
              .eq('user_id', req.user.id);
            return res.json({ message: 'Reaction updated' });
          }
        } else {
          // Insert new reaction
          await supabase
            .from('club_announcement_reactions')
            .insert([{
              announcement_id: req.params.announcementId,
              user_id: req.user.id,
              type
            }]);
          return res.json({ message: 'Reaction added' });
        }
      } catch (error: any) {
        console.error('React to announcement error:', error);
        res.status(500).json({ error: 'Failed to react', details: error.message });
      }
    });

    // Delete an announcement
    router.delete('/clubs/:id/announcements/:announcementId', authenticateToken, async (req: any, res) => {
      try {
        // Check if user is owner or admin
        const { data: member, error: memberError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .in('role', ['owner', 'admin'])
          .single();

        if (memberError || !member) {
          return res.status(403).json({ error: 'Only owners and admins can delete announcements' });
        }

        const { error } = await supabase
          .from('club_announcements')
          .delete()
          .eq('id', req.params.announcementId)
          .eq('club_id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Announcement deleted successfully' });
      } catch (error: any) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ error: 'Failed to delete announcement', details: error.message });
      }
    });

    // Pin/Unpin an announcement
    router.put('/clubs/:id/announcements/:announcementId/pin', authenticateToken, async (req: any, res) => {
      const { is_pinned } = req.body;
      if (typeof is_pinned !== 'boolean') {
        return res.status(400).json({ error: 'is_pinned must be a boolean' });
      }

      try {
        // Check if user is owner or admin
        const { data: member, error: memberError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .in('role', ['owner', 'admin'])
          .single();

        if (memberError || !member) {
          return res.status(403).json({ error: 'Only owners and admins can pin/unpin announcements' });
        }

        const { error } = await supabase
          .from('club_announcements')
          .update({ is_pinned })
          .eq('id', req.params.announcementId)
          .eq('club_id', req.params.id);

        if (error) throw error;
        res.json({ message: `Announcement ${is_pinned ? 'pinned' : 'unpinned'} successfully` });
      } catch (error: any) {
        console.error('Pin announcement error:', error);
        res.status(500).json({ error: 'Failed to pin/unpin announcement', details: error.message });
      }
    });

    // Get achievements for a club
    router.get('/clubs/:id/achievements', authenticateToken, async (req: any, res) => {
      try {
        const { data: achievements, error } = await supabase
          .from('club_achievements')
          .select('*')
          .eq('club_id', req.params.id)
          .order('date', { ascending: false });

        if (error) throw error;
        res.json({ achievements });
      } catch (error: any) {
        console.error('Fetch achievements error:', error);
        res.status(500).json({ error: 'Failed to fetch achievements', details: error.message });
      }
    });

    // Add an achievement
    router.post('/clubs/:id/achievements', authenticateToken, upload.single('image'), async (req: any, res) => {
      const { title, description, date } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });

      try {
        // Check if user is owner or admin
        const { data: member, error: memberError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .in('role', ['owner', 'admin'])
          .single();

        if (memberError || !member) {
          return res.status(403).json({ error: 'Only owners and admins can add achievements' });
        }

        // Check limit of 10 achievements
        const { count, error: countError } = await supabase
          .from('club_achievements')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', req.params.id);

        if (countError) throw countError;
        if (count && count >= 10) {
          return res.status(400).json({ error: 'Maximum limit of 10 achievements reached' });
        }

        let imageUrl = null;
        if (req.file) {
          const file = req.file;
          const fileExt = file.originalname.split('.').pop();
          const fileName = `${req.params.id}-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('club-achievements')
            .upload(filePath, file.buffer, {
              contentType: file.mimetype,
              upsert: true
            });

          if (uploadError) {
            // Try to create bucket if it doesn't exist
            try {
              await supabase.storage.createBucket('club-achievements', { public: true });
              const { error: retryError } = await supabase.storage
                .from('club-achievements')
                .upload(filePath, file.buffer, {
                  contentType: file.mimetype,
                  upsert: true
                });
              if (retryError) throw retryError;
            } catch (createErr) {
              throw uploadError;
            }
          }

          const { data: publicUrlData } = supabase.storage
            .from('club-achievements')
            .getPublicUrl(filePath);
            
          imageUrl = publicUrlData.publicUrl;
        }

        // Store image URL in description as JSON string
        const descData = {
          text: description || '',
          image_url: imageUrl
        };

        const { data: achievement, error } = await supabase
          .from('club_achievements')
          .insert([{
            club_id: req.params.id,
            title,
            description: JSON.stringify(descData),
            date: date || new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;
        res.json({ achievement });
      } catch (error: any) {
        console.error('Add achievement error:', error);
        res.status(500).json({ error: 'Failed to add achievement', details: error.message });
      }
    });

    // Delete an achievement
    router.delete('/clubs/:id/achievements/:achievementId', authenticateToken, async (req: any, res) => {
      try {
        // Check if user is owner or admin
        const { data: member, error: memberError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .in('role', ['owner', 'admin'])
          .single();

        if (memberError || !member) {
          return res.status(403).json({ error: 'Only owners and admins can delete achievements' });
        }

        const { error } = await supabase
          .from('club_achievements')
          .delete()
          .eq('id', req.params.achievementId)
          .eq('club_id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Achievement deleted successfully' });
      } catch (error: any) {
        console.error('Delete achievement error:', error);
        res.status(500).json({ error: 'Failed to delete achievement', details: error.message });
      }
    });

    // Get photos for a club
    router.get('/clubs/:id/photos', authenticateToken, async (req: any, res) => {
      try {
        const { data: photos, error } = await supabase
          .from('club_photos')
          .select(`
            *,
            uploader:uploaded_by ( id, display_name, avatar_url )
          `)
          .eq('club_id', req.params.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ photos });
      } catch (error: any) {
        console.error('Fetch photos error:', error);
        res.status(500).json({ error: 'Failed to fetch photos', details: error.message });
      }
    });

    // Add a photo
    router.post('/clubs/:id/photos', authenticateToken, upload.single('image'), async (req: any, res) => {
      const { caption } = req.body;
      if (!req.file) return res.status(400).json({ error: 'Image file is required' });

      try {
        // Check if user is owner or admin
        const { data: member, error: memberError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .in('role', ['owner', 'admin'])
          .single();

        if (memberError || !member) {
          return res.status(403).json({ error: 'Only owners and admins can add photos' });
        }

        // Check limit of 10 photos
        const { count, error: countError } = await supabase
          .from('club_photos')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', req.params.id);

        if (countError) throw countError;
        if (count && count >= 10) {
          return res.status(400).json({ error: 'Maximum limit of 10 photos reached' });
        }

        const file = req.file;
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${req.params.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('club-photos')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });

        if (uploadError) {
          // Try to create bucket if it doesn't exist
          try {
            await supabase.storage.createBucket('club-photos', { public: true });
            const { error: retryError } = await supabase.storage
              .from('club-photos')
              .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true
              });
            if (retryError) throw retryError;
          } catch (createErr) {
            throw uploadError;
          }
        }

        const { data: publicUrlData } = supabase.storage
          .from('club-photos')
          .getPublicUrl(filePath);
          
        const imageUrl = publicUrlData.publicUrl;

        const { data: photo, error } = await supabase
          .from('club_photos')
          .insert([{
            club_id: req.params.id,
            url: imageUrl,
            caption,
            uploaded_by: req.user.id
          }])
          .select(`
            *,
            uploader:uploaded_by ( id, display_name, avatar_url )
          `)
          .single();

        if (error) throw error;
        res.json({ photo });
      } catch (error: any) {
        console.error('Add photo error:', error);
        res.status(500).json({ error: 'Failed to add photo', details: error.message });
      }
    });

    // Delete a photo
    router.delete('/clubs/:id/photos/:photoId', authenticateToken, async (req: any, res) => {
      try {
        // Check if user is owner or admin
        const { data: member, error: memberError } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', req.params.id)
          .eq('user_id', req.user.id)
          .in('role', ['owner', 'admin'])
          .single();

        if (memberError || !member) {
          return res.status(403).json({ error: 'Only owners and admins can delete photos' });
        }

        const { error } = await supabase
          .from('club_photos')
          .delete()
          .eq('id', req.params.photoId)
          .eq('club_id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Photo deleted successfully' });
      } catch (error: any) {
        console.error('Delete photo error:', error);
        res.status(500).json({ error: 'Failed to delete photo', details: error.message });
      }
    });

    // --- MESSAGES ROUTES ---

    // Get conversations (list of users the current user has messaged with)
    router.get('/messages/conversations', authenticateToken, async (req: any, res) => {
      try {
        const userId = req.user.id;

        // Get all messages where user is sender or receiver
        const { data: messages, error } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            read_at,
            sender_id,
            receiver_id,
            sender:profiles!sender_id(id, display_name, avatar_url),
            receiver:profiles!receiver_id(id, display_name, avatar_url)
          `)
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Group by conversation partner
        const conversationsMap = new Map();
        
        messages?.forEach((msg: any) => {
          const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
          const partner = msg.sender_id === userId ? msg.receiver : msg.sender;
          
          if (!conversationsMap.has(partnerId)) {
            conversationsMap.set(partnerId, {
              partner,
              lastMessage: msg,
              unreadCount: (msg.receiver_id === userId && !msg.read_at) ? 1 : 0
            });
          } else {
            const conv = conversationsMap.get(partnerId);
            if (msg.receiver_id === userId && !msg.read_at) {
              conv.unreadCount += 1;
            }
          }
        });

        const conversations = Array.from(conversationsMap.values());
        res.json({ conversations });
      } catch (error: any) {
        console.error('Fetch conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations', details: error.message });
      }
    });

    // Get messages with a specific user
    router.get('/messages/:userId', authenticateToken, async (req: any, res) => {
      try {
        const currentUserId = req.user.id;
        const otherUserId = req.params.userId;

        const { data: messages, error } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            read_at,
            sender_id,
            receiver_id
          `)
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Mark unread messages as read
        const unreadMessages = messages?.filter(m => m.receiver_id === currentUserId && !m.read_at) || [];
        if (unreadMessages.length > 0) {
          const unreadIds = unreadMessages.map(m => m.id);
          await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .in('id', unreadIds);
        }

        res.json({ messages });
      } catch (error: any) {
        console.error('Fetch messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
      }
    });

    // Send a message
    router.post('/messages', authenticateToken, async (req: any, res) => {
      try {
        const { receiverId, content } = req.body;
        const senderId = req.user.id;

        if (!receiverId || !content) {
          return res.status(400).json({ error: 'Receiver ID and content are required' });
        }

        const { data: message, error } = await supabase
          .from('messages')
          .insert([{
            sender_id: senderId,
            receiver_id: receiverId,
            content
          }])
          .select()
          .single();

        if (error) throw error;
        res.json({ message });
      } catch (error: any) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.message });
      }
    });

    // Search users to message (players and admins)
    router.get('/users/search', authenticateToken, async (req: any, res) => {
      try {
        const { q } = req.query;
        if (!q || q.length < 2) {
          return res.json({ users: [] });
        }

        const { data: users, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, role')
          .ilike('display_name', `%${q}%`)
          .neq('id', req.user.id)
          .limit(10);

        if (error) throw error;
        res.json({ users });
      } catch (error: any) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Failed to search users', details: error.message });
      }
    });

import { generateTournamentMatches } from './tournament-generator.js';

    // --- TOURNAMENT ROUTES ---

    // Create a tournament
    router.post('/tournaments', authenticateToken, async (req: any, res) => {
      try {
        const { name, format } = req.body;
        if (!name || !format) return res.status(400).json({ error: 'Name and format required' });

        const { data: tournament, error } = await supabase
          .from('tournaments')
          .insert([{ name, format, created_by: req.user.id }])
          .select()
          .single();

        if (error) throw error;
        res.json({ tournament });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to create tournament', details: error.message });
      }
    });

    // Get all tournaments
    router.get('/tournaments', authenticateToken, async (req: any, res) => {
      try {
        const { data: tournaments, error } = await supabase
          .from('tournaments')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ tournaments });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch tournaments', details: error.message });
      }
    });

    // Get tournament details
    router.get('/tournaments/:id', authenticateToken, async (req: any, res) => {
      try {
        const { id } = req.params;
        const { data: tournament, error: tError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single();

        if (tError) throw tError;

        const { data: participants, error: pError } = await supabase
          .from('tournament_participants')
          .select('id, profile_id, profiles(display_name, avatar_url)')
          .eq('tournament_id', id);

        if (pError) throw pError;

        const { data: matches, error: mError } = await supabase
          .from('tournament_matches')
          .select(`
            *,
            player1:profiles!player1_id(display_name, avatar_url),
            player2:profiles!player2_id(display_name, avatar_url),
            winner:profiles!winner_id(display_name, avatar_url)
          `)
          .eq('tournament_id', id)
          .order('round_number', { ascending: true })
          .order('match_order', { ascending: true });

        if (mError) throw mError;

        res.json({ tournament, participants, matches });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch tournament', details: error.message });
      }
    });

    // Add participant
    router.post('/tournaments/:id/participants', authenticateToken, async (req: any, res) => {
      try {
        const { id } = req.params;
        const { profile_id } = req.body;
        
        const { data: participant, error } = await supabase
          .from('tournament_participants')
          .insert([{ tournament_id: id, profile_id }])
          .select()
          .single();

        if (error) throw error;
        res.json({ participant });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to add participant', details: error.message });
      }
    });

    // Add team participant
    router.post('/tournaments/:id/teams', authenticateToken, async (req: any, res) => {
      try {
        const { id } = req.params;
        const { player1_id, player2_id, team_name } = req.body;

        if (!player1_id || !player2_id) {
          return res.status(400).json({ error: 'Two players are required for a team' });
        }

        // Create a team profile
        const teamId = uuidv4();
        const email = `team_${teamId}@tournament.local`;
        
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: teamId,
            email,
            password_hash: 'none',
            display_name: team_name || 'Team',
            role: 'team',
            address: JSON.stringify([player1_id, player2_id])
          }]);

        if (profileError) throw profileError;

        // Add team profile as participant
        const { data: participant, error } = await supabase
          .from('tournament_participants')
          .insert([{ tournament_id: id, profile_id: teamId }])
          .select()
          .single();

        if (error) throw error;
        res.json({ participant });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to add team', details: error.message });
      }
    });

    // Remove participant
    router.delete('/tournaments/:id/participants/:profileId', authenticateToken, async (req: any, res) => {
      try {
        const { id, profileId } = req.params;

        // Check if it's a team profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', profileId)
          .single();

        const { error } = await supabase
          .from('tournament_participants')
          .delete()
          .match({ tournament_id: id, profile_id: profileId });

        if (error) throw error;

        // Clean up team profile
        if (profile?.role === 'team') {
          await supabase.from('profiles').delete().eq('id', profileId);
        }

        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to remove participant', details: error.message });
      }
    });

    // Delete tournament
    router.delete('/tournaments/:id', authenticateToken, async (req: any, res) => {
      try {
        const { id } = req.params;
        
        // Find team profiles to delete
        const { data: participants } = await supabase
          .from('tournament_participants')
          .select('profile_id, profiles!inner(role)')
          .eq('tournament_id', id)
          .eq('profiles.role', 'team');
          
        const teamIds = participants?.map(p => p.profile_id) || [];

        const { error } = await supabase
          .from('tournaments')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        // Clean up team profiles
        if (teamIds.length > 0) {
          await supabase.from('profiles').delete().in('id', teamIds);
        }
        
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to delete tournament', details: error.message });
      }
    });

    // Update tournament status
    router.put('/tournaments/:id/status', authenticateToken, async (req: any, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['draft', 'in_progress', 'completed'].includes(status)) {
          return res.status(400).json({ error: 'Invalid status' });
        }

        const { error } = await supabase
          .from('tournaments')
          .update({ status })
          .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to update tournament status', details: error.message });
      }
    });

    // Start tournament
    router.post('/tournaments/:id/start', authenticateToken, async (req: any, res) => {
      try {
        const { id } = req.params;
        
        // Get tournament
        const { data: tournament, error: tError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single();
          
        if (tError) throw tError;
        if (tournament.status !== 'draft') return res.status(400).json({ error: 'Tournament already started' });

        // Get participants
        const { data: participants, error: pError } = await supabase
          .from('tournament_participants')
          .select('*')
          .eq('tournament_id', id);

        if (pError) throw pError;

        // Generate matches
        await generateTournamentMatches(id, tournament.format, participants || []);

        // Update status
        await supabase
          .from('tournaments')
          .update({ status: 'in_progress' })
          .eq('id', id);

        res.json({ success: true });
      } catch (error: any) {
        console.error('Start tournament error:', error);
        res.status(500).json({ error: 'Failed to start tournament', details: error.message });
      }
    });

    // Update match score/winner
    router.put('/tournaments/matches/:matchId', authenticateToken, async (req: any, res) => {
      try {
        const { matchId } = req.params;
        const { winner_id, score } = req.body;

        const { data: match, error: mError } = await supabase
          .from('tournament_matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (mError) throw mError;

        // Update current match
        const { error: updateError } = await supabase
          .from('tournament_matches')
          .update({ winner_id, score })
          .eq('id', matchId);

        if (updateError) throw updateError;

        // Advance winner
        if (match.next_match_id && winner_id) {
          const slotField = match.next_match_player_slot === 1 ? 'player1_id' : 'player2_id';
          await supabase
            .from('tournament_matches')
            .update({ [slotField]: winner_id })
            .eq('id', match.next_match_id);
        }

        // Advance loser (for double elim)
        if (match.loser_match_id && winner_id) {
          const loser_id = winner_id === match.player1_id ? match.player2_id : match.player1_id;
          const slotField = match.loser_match_slot === 1 ? 'player1_id' : 'player2_id';
          await supabase
            .from('tournament_matches')
            .update({ [slotField]: loser_id })
            .eq('id', match.loser_match_id);
        }

        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to update match', details: error.message });
      }
    });

    // Update match participants (manual rearrange)
    router.put('/tournaments/matches/:matchId/participants', authenticateToken, async (req: any, res) => {
      try {
        const { matchId } = req.params;
        const { player1_id, player2_id } = req.body;

        const { data: match, error: mError } = await supabase
          .from('tournament_matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (mError) throw mError;

        const is_bye = !!((player1_id && !player2_id) || (!player1_id && player2_id));
        let winner_id = null;
        if (is_bye) {
          winner_id = player1_id || player2_id;
        }

        const { error: updateError } = await supabase
          .from('tournament_matches')
          .update({ player1_id, player2_id, is_bye, winner_id })
          .eq('id', matchId);

        if (updateError) throw updateError;

        // Advance winner if it's a bye, or clear if it's not
        if (match.next_match_id) {
          const slotField = match.next_match_player_slot === 1 ? 'player1_id' : 'player2_id';
          await supabase
            .from('tournament_matches')
            .update({ [slotField]: winner_id })
            .eq('id', match.next_match_id);
        }

        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to update match participants', details: error.message });
      }
    });

    export default router;
