import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest, useUser } from '@/lib/api';
import { Trophy, User, Activity, QrCode, LogOut, Edit2, TrendingUp, Target, BarChart, Camera, Calendar, X, Upload, Eye, EyeOff, Shield, Plus, Trash2, Star, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import Scorer from './Scorer';
import RatingPrompt from '@/components/RatingPrompt';
import PlayerSearch from '@/components/PlayerSearch';

export default function PlayerDashboard() {
  const [user, setUser] = useState<any>(null);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [activeLobbyPlayers, setActiveLobbyPlayers] = useState<any[]>([]);
  const [currentLobby, setCurrentLobby] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  
  // Rating State
  const [pendingRatingMatch, setPendingRatingMatch] = useState<any>(null);
  
  // Gear State
  const [gears, setGears] = useState<any[]>([]);
  const [isAddGearOpen, setIsAddGearOpen] = useState(false);
  const [gearForm, setGearForm] = useState({ name: '', type: 'Paddle' });
  const [gearImage, setGearImage] = useState<File | null>(null);

  // Edit Profile State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    display_name: '',
    address: '',
    phone: '',
    visibility_settings: {
      email: false,
      phone: false,
      address: false,
      full_name: false
    }
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else {
        setUser(u);
        setEditForm({
          full_name: u.full_name || '',
          display_name: u.display_name || '',
          address: u.address || '',
          phone: u.phone || '',
          visibility_settings: u.visibility_settings || { email: false, phone: false, address: false, full_name: false }
        });
        fetchLobbies();
        fetchActiveLobby();
        fetchPendingRatings();
        fetchMatches();
        fetchGears();
        fetchFollowStats(u.id);
      }
    });

    // Poll for lobby updates (especially for countdown/start)
    const interval = setInterval(() => {
      fetchLobbies();
      fetchActiveLobby();
      fetchPendingRatings();
      fetchMatches();
    }, 2000); // Reduced frequency slightly to avoid spamming rating checks

    return () => clearInterval(interval);
  }, []);

  // Countdown Logic
  useEffect(() => {
    if (currentLobby?.status === 'in_progress' && currentLobby.started_at) {
      const startTime = new Date(currentLobby.started_at).getTime();
      const now = new Date().getTime();
      // Calculate diff based on future started_at timestamp
      const diff = Math.ceil((startTime - now) / 1000);

      if (diff > 0) {
        setCountdown(diff);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(timer);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
        return () => clearInterval(timer);
      }
    }
  }, [currentLobby?.status, currentLobby?.started_at]);

  const fetchFollowStats = async (userId: string) => {
    try {
      const [followersData, followingData] = await Promise.all([
        apiRequest(`/user/followers-count/${userId}`),
        apiRequest(`/user/following-count/${userId}`)
      ]);
      setFollowersCount(followersData.count);
      setFollowingCount(followingData.count);
    } catch (e) {
      console.error("Failed to fetch follow stats", e);
    }
  };

  const fetchGears = async () => {
    try {
      const data = await apiRequest('/user/gears');
      setGears(data.gears || []);
    } catch (e) {
      console.error("Failed to fetch gears", e);
    }
  };

  const fetchPendingRatings = async () => {
    try {
      const data = await apiRequest('/user/pending-ratings');
      if (data.pending && data.pending.length > 0) {
        // Just take the first one for now
        setPendingRatingMatch(data.pending[0]);
      } else {
        setPendingRatingMatch(null);
      }
    } catch (e) {
      console.error("Failed to fetch pending ratings", e);
    }
  };

  const fetchMatches = async () => {
    try {
      const data = await apiRequest('/user/matches');
      setMatches(data.matches || []);
    } catch (e) {
      console.error("Failed to fetch matches", e);
    }
  };

  const fetchLobbies = async () => {
    try {
      const data = await apiRequest('/lobbies');
      setLobbies(data.lobbies || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActiveLobby = async () => {
    try {
      const data = await apiRequest('/lobbies/active');
      if (data.lobby) {
        setCurrentLobby(data.lobby);
        if (data.players) {
          setActiveLobbyPlayers(data.players);
        } else {
          setActiveLobbyPlayers([]);
        }
      } else {
        setCurrentLobby(null);
        setActiveLobbyPlayers([]);
      }
    } catch (e) {
      console.error("Failed to fetch active lobby players", e);
      // Do not clear currentLobby on error to prevent unmounting Scorer
      // setActiveLobbyPlayers([]); 
      // setCurrentLobby(null);
    }
  };

  const handleJoinLobby = async (qrPayload: string) => {
    try {
      const res = await apiRequest('/lobbies/join', 'POST', { qr_payload: qrPayload });
      setScanResult(`Joined lobby successfully! ID: ${res.lobby_id}`);
      fetchLobbies(); // Refresh lobbies
      fetchActiveLobby(); // Refresh active lobby players
      setTimeout(() => setScanResult(null), 3000);
    } catch (err: any) {
      console.error("Join error:", err);
      // Show more detailed error for debugging
      const payloadSnippet = qrPayload && typeof qrPayload === 'string' ? qrPayload.substring(0, 15) : 'invalid';
      setError(`${err.message} (Payload: ${payloadSnippet}...)`);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleLeaveLobby = async (lobbyId: string) => {
    try {
      await apiRequest('/lobbies/leave', 'POST', { lobby_id: lobbyId });
      setScanResult('Left lobby successfully');
      setCurrentLobby(null); // Clear current lobby immediately
      setActiveLobbyPlayers([]); // Clear active lobby players
      fetchLobbies(); // Refresh lobbies
      fetchActiveLobby(); // Sync state
      setTimeout(() => setScanResult(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleSwitchTeam = async (team: string) => {
    if (!currentLobby?.id) {
      console.error("No active lobby found when switching team");
      return;
    }
    try {
      await apiRequest('/lobbies/team', 'POST', { lobby_id: currentLobby.id, team });
      fetchActiveLobby();
    } catch (err: any) {
      console.error("Switch team error:", err);
      setError(err.message);
      fetchActiveLobby(); // Sync state in case of error (e.g. kicked)
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleStartGame = async () => {
    if (!currentLobby?.id) return;
    try {
      await apiRequest('/lobbies/start', 'POST', { lobby_id: currentLobby.id });
      // The polling will pick up the status change to 'in_progress'
      // which will then trigger the countdown visual if we keep it.
      fetchActiveLobby();
      fetchLobbies();
    } catch (err: any) {
      console.error("Start game error:", err);
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleReadyToggle = async () => {
    if (!currentLobby?.id || !user?.id) {
      console.error("Missing lobby or user data when toggling ready");
      return;
    }
    try {
      const currentUser = activeLobbyPlayers.find(p => p.id === user.id);
      if (!currentUser) return;
      
      const newStatus = !currentUser.is_ready;
      await apiRequest('/lobbies/ready', 'POST', { lobby_id: currentLobby.id, is_ready: newStatus });
      
      fetchActiveLobby();
      fetchLobbies(); // Update lobby status immediately
      
    } catch (err: any) {
      console.error("Ready toggle error:", err);
      setError(err.message);
      fetchActiveLobby(); // Sync state in case of error
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleLogout = async () => {
    if (currentLobby) {
      try {
        await apiRequest('/lobbies/leave', 'POST', { lobby_id: currentLobby.id });
      } catch (error) {
        console.error('Failed to leave lobby on logout', error);
      }
    }
    document.cookie = 'token=; Max-Age=0; path=/;';
    navigate('/login');
  };

  const handleUpdateProfile = async () => {
    try {
      const res = await apiRequest('/user/profile', 'PUT', editForm);
      setUser(res.user);
      setIsEditOpen(false);
      setScanResult('Profile updated successfully');
      setTimeout(() => setScanResult(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setIsUploading(true);
    try {
      // Need to use fetch directly for FormData since apiRequest might assume JSON
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, let browser set it with boundary
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload avatar');
      }

      const data = await res.json();
      setUser(data.user);
      setScanResult('Avatar uploaded successfully');
      setTimeout(() => setScanResult(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddGear = async () => {
    if (!gearForm.name) return;

    const formData = new FormData();
    formData.append('name', gearForm.name);
    formData.append('type', gearForm.type);
    if (gearImage) {
      formData.append('image', gearImage);
    }

    try {
      const res = await fetch('/api/user/gears', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to add gear');

      fetchGears();
      setIsAddGearOpen(false);
      setGearForm({ name: '', type: 'Paddle' });
      setGearImage(null);
      setScanResult('Gear added successfully');
      setTimeout(() => setScanResult(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDeleteGear = async (id: string) => {
    try {
      await apiRequest(`/user/gears/${id}`, 'DELETE');
      fetchGears();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleSetPrimaryGear = async (id: string) => {
    try {
      await apiRequest(`/user/gears/${id}/primary`, 'PUT');
      fetchGears();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  // Mock Stats (derive from games_played if possible)
  const gamesPlayed = user.games_played || 0;
  const wins = Math.floor(gamesPlayed * 0.6); // Mock 60% win rate
  const losses = gamesPlayed - wins;
  const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : '0.0';


  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 to-amber-500 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold leading-tight">Player Dashboard</h1>
          </div>
          <Button 
            variant="secondary" 
            className="bg-white text-gray-800 hover:bg-gray-100 border-none shadow-sm gap-2"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Sidebar: Profile */}
        <div className="lg:col-span-1 space-y-6">
          <PlayerSearch />
          <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardContent className="p-6 relative">
              <div className="absolute top-6 right-6">
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <DialogTrigger asChild>
                    <div className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Edit Profile</DialogTitle>
                      <DialogDescription>
                        Make changes to your profile here. Click save when you're done.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="full_name" className="text-right">
                          Full Name
                        </Label>
                        <Input
                          id="full_name"
                          value={editForm.full_name}
                          onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 -mt-2">
                        <div className="col-start-2 col-span-3 flex items-center space-x-2">
                          <Switch
                            id="vis-full_name"
                            checked={editForm.visibility_settings?.full_name}
                            onCheckedChange={(checked) => setEditForm({...editForm, visibility_settings: {...editForm.visibility_settings, full_name: checked}})}
                          />
                          <Label htmlFor="vis-full_name" className="text-xs text-gray-500 font-normal">Show publicly</Label>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="display_name" className="text-right">
                          Display Name
                        </Label>
                        <Input
                          id="display_name"
                          value={editForm.display_name}
                          onChange={(e) => setEditForm({...editForm, display_name: e.target.value})}
                          className="col-span-3"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="address" className="text-right">
                          Address
                        </Label>
                        <Input
                          id="address"
                          value={editForm.address}
                          onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 -mt-2">
                        <div className="col-start-2 col-span-3 flex items-center space-x-2">
                          <Switch
                            id="vis-address"
                            checked={editForm.visibility_settings?.address}
                            onCheckedChange={(checked) => setEditForm({...editForm, visibility_settings: {...editForm.visibility_settings, address: checked}})}
                          />
                          <Label htmlFor="vis-address" className="text-xs text-gray-500 font-normal">Show publicly</Label>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phone" className="text-right">
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 -mt-2">
                        <div className="col-start-2 col-span-3 flex items-center space-x-2">
                          <Switch
                            id="vis-phone"
                            checked={editForm.visibility_settings?.phone}
                            onCheckedChange={(checked) => setEditForm({...editForm, visibility_settings: {...editForm.visibility_settings, phone: checked}})}
                          />
                          <Label htmlFor="vis-phone" className="text-xs text-gray-500 font-normal">Show publicly</Label>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Email</Label>
                        <div className="col-span-3 flex items-center space-x-2">
                          <Switch
                            id="vis-email"
                            checked={editForm.visibility_settings?.email}
                            onCheckedChange={(checked) => setEditForm({...editForm, visibility_settings: {...editForm.visibility_settings, email: checked}})}
                          />
                          <Label htmlFor="vis-email" className="text-xs text-gray-500 font-normal">Show publicly</Label>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" onClick={handleUpdateProfile}>Save changes</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              <h2 className="text-lg font-semibold mb-6">My Profile</h2>
              
              <div className="flex flex-col items-center mb-8 relative group">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-lime-500 to-amber-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4 overflow-hidden relative">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                  ) : (
                    user.display_name?.slice(0, 2).toUpperCase()
                  )}
                  
                  {/* Upload Overlay */}
                  <div 
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleAvatarUpload}
                />
                {isUploading && <div className="text-xs text-blue-600 font-medium animate-pulse">Uploading...</div>}
                
                <div className="flex gap-4 mt-4 text-sm">
                  <div className="text-center">
                    <span className="font-bold text-gray-900 block">{followersCount}</span>
                    <span className="text-gray-500">Followers</span>
                  </div>
                  <div className="text-center">
                    <span className="font-bold text-gray-900 block">{followingCount}</span>
                    <span className="text-gray-500">Following</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                    <span title={user.visibility_settings?.full_name ? "Public" : "Private"}>
                      {user.visibility_settings?.full_name ? <Eye className="w-3 h-3 text-emerald-500" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                    </span>
                  </div>
                  <div className="font-medium text-gray-900">{user.full_name || user.display_name}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                    <span title={user.visibility_settings?.email ? "Public" : "Private"}>
                      {user.visibility_settings?.email ? <Eye className="w-3 h-3 text-emerald-500" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 truncate" title={user.email}>{user.email}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</label>
                    <span title={user.visibility_settings?.address ? "Public" : "Private"}>
                      {user.visibility_settings?.address ? <Eye className="w-3 h-3 text-emerald-500" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">{user.address || 'Not provided'}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</label>
                    <span title={user.visibility_settings?.phone ? "Public" : "Private"}>
                      {user.visibility_settings?.phone ? <Eye className="w-3 h-3 text-emerald-500" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">{user.phone || 'Not provided'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Gear */}
          <Card className="border-none shadow-md bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-gray-500" /> My Gear
                </h3>
                <Dialog open={isAddGearOpen} onOpenChange={setIsAddGearOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-gray-100">
                      <Plus className="w-4 h-4 text-gray-600" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Gear</DialogTitle>
                      <DialogDescription>Add your paddle, shoes, or other equipment.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="gear-name" className="text-right">Name</Label>
                        <Input 
                          id="gear-name" 
                          value={gearForm.name}
                          onChange={(e) => setGearForm({...gearForm, name: e.target.value})}
                          className="col-span-3" 
                          placeholder="e.g. Carbon Pro Paddle"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="gear-type" className="text-right">Type</Label>
                        <select 
                          id="gear-type"
                          value={gearForm.type}
                          onChange={(e) => setGearForm({...gearForm, type: e.target.value})}
                          className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="Paddle">Paddle</option>
                          <option value="Shoes">Shoes</option>
                          <option value="Apparel">Apparel</option>
                          <option value="Accessory">Accessory</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="gear-image" className="text-right">Image</Label>
                        <Input 
                          id="gear-image" 
                          type="file"
                          accept="image/*"
                          onChange={(e) => setGearImage(e.target.files?.[0] || null)}
                          className="col-span-3" 
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddGear}>Add Gear</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-3">
                {gears.length > 0 ? (
                  gears.map((gear) => (
                    <div key={gear.id} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 group relative">
                      <div className="w-12 h-12 bg-white rounded-md border flex items-center justify-center overflow-hidden shrink-0">
                        {gear.image_url ? (
                          <img src={gear.image_url} alt={gear.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{gear.name}</div>
                        <div className="text-xs text-gray-500">{gear.type}</div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`h-7 w-7 p-0 ${gear.is_primary ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}
                          onClick={() => handleSetPrimaryGear(gear.id)}
                          title={gear.is_primary ? "Primary Gear" : "Set as Primary"}
                        >
                          <Star className={`w-4 h-4 ${gear.is_primary ? 'fill-amber-500' : ''}`} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteGear(gear.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    No gear added yet.
                    <br />
                    Show off your equipment!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Content: Stats & Actions */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* MMR Card */}
            <Card className="border-none shadow-md bg-orange-50/50">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 text-orange-600 font-medium mb-2">
                  <Trophy className="w-5 h-5" /> Current MMR
                </div>
                <div className="text-6xl font-bold text-amber-600 mb-1">{user.mmr || 1000}</div>
                <div className="text-sm text-gray-500">Matchmaking Rating</div>
              </CardContent>
            </Card>

            {/* Behavior Score Card */}
            <Card className="border-none shadow-md bg-indigo-50/50">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 text-indigo-600 font-medium mb-2">
                  <Shield className="w-5 h-5" /> Behavior Score
                </div>
                <div className="text-6xl font-bold text-indigo-600 mb-1">{user.behavior_score || 100}</div>
                <div className="text-sm text-gray-500">Reputation Points</div>
              </CardContent>
            </Card>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatsCard 
              icon={<TrendingUp className="w-5 h-5 text-green-600" />} 
              bg="bg-green-100" 
              value={wins} 
              label="Wins" 
              valueColor="text-green-700"
            />
            <StatsCard 
              icon={<Target className="w-5 h-5 text-red-600" />} 
              bg="bg-red-100" 
              value={losses} 
              label="Losses" 
              valueColor="text-red-700"
            />
            <StatsCard 
              icon={<BarChart className="w-5 h-5 text-blue-600" />} 
              bg="bg-blue-100" 
              value={`${winRate}%`} 
              label="Win Rate" 
              valueColor="text-blue-700"
            />
          </div>

          {/* Scan Action Card */}
          <Card className="border-emerald-200 bg-emerald-50/30 shadow-md relative overflow-hidden">
            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center flex-col animate-in fade-in duration-300">
                <div className="text-white text-2xl font-bold mb-4 animate-bounce">Match Starting In</div>
                <div className="text-9xl font-black text-emerald-400 animate-pulse">{countdown}</div>
              </div>
            )}

            <CardContent className="p-6">
              {currentLobby ? (
                <div>
                  <div className="flex items-start gap-4 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {currentLobby.status === 'in_progress' ? 'Match In Progress' : 'Active Lobby'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {currentLobby.status === 'in_progress' 
                          ? 'Good luck! Play your best.' 
                          : 'You are currently in a lobby waiting for the match to start.'}
                      </p>
                      <div className="mt-2 text-xs font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                        Lobby ID: {currentLobby.id.slice(0, 8)}
                      </div>
                      
                      {/* Teams Display */}
                      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Team A */}
                        <div className={`rounded-lg p-3 border ${currentLobby.status === 'in_progress' ? 'bg-blue-100 border-blue-300' : 'bg-blue-50/50 border-blue-100'}`}>
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">Team A</h4>
                            <span className="text-xs font-mono bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                              {activeLobbyPlayers.filter(p => p.team === 'A').length}/2
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {activeLobbyPlayers.filter(p => p.team === 'A').map((p: any) => (
                              <div key={p.id} className="flex items-center gap-2 bg-white border border-blue-100 rounded-md p-2 shadow-sm">
                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 relative">
                                  {p.avatar_url ? (
                                    <img src={p.avatar_url} alt={p.display_name} className="w-full h-full object-cover" />
                                  ) : (
                                    p.display_name?.slice(0, 2).toUpperCase() || '??'
                                  )}
                                  {p.is_ready && currentLobby.status !== 'in_progress' && (
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-medium text-gray-700 truncate">{p.display_name}</span>
                                  {p.is_ready && currentLobby.status !== 'in_progress' && <span className="text-[10px] text-green-600 font-bold leading-none">READY</span>}
                                </div>
                                {p.id === user.id && <span className="ml-auto text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">YOU</span>}
                              </div>
                            ))}
                            
                            {/* Join Team A Button */}
                            {currentLobby.status !== 'in_progress' && 
                             activeLobbyPlayers.find(p => p.id === user.id)?.team !== 'A' && 
                             activeLobbyPlayers.filter(p => p.team === 'A').length < 2 && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700 h-8 text-xs"
                                onClick={() => handleSwitchTeam('A')}
                              >
                                Join Team A
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Team B */}
                        <div className={`rounded-lg p-3 border ${currentLobby.status === 'in_progress' ? 'bg-orange-100 border-orange-300' : 'bg-orange-50/50 border-orange-100'}`}>
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-orange-800 text-sm uppercase tracking-wider">Team B</h4>
                            <span className="text-xs font-mono bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                              {activeLobbyPlayers.filter(p => p.team === 'B').length}/2
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {activeLobbyPlayers.filter(p => p.team === 'B').map((p: any) => (
                              <div key={p.id} className="flex items-center gap-2 bg-white border border-orange-100 rounded-md p-2 shadow-sm">
                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 relative">
                                  {p.avatar_url ? (
                                    <img src={p.avatar_url} alt={p.display_name} className="w-full h-full object-cover" />
                                  ) : (
                                    p.display_name?.slice(0, 2).toUpperCase() || '??'
                                  )}
                                  {p.is_ready && currentLobby.status !== 'in_progress' && (
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-medium text-gray-700 truncate">{p.display_name}</span>
                                  {p.is_ready && currentLobby.status !== 'in_progress' && <span className="text-[10px] text-green-600 font-bold leading-none">READY</span>}
                                </div>
                                {p.id === user.id && <span className="ml-auto text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">YOU</span>}
                              </div>
                            ))}

                            {/* Join Team B Button */}
                            {currentLobby.status !== 'in_progress' && 
                             activeLobbyPlayers.find(p => p.id === user.id)?.team !== 'B' && 
                             activeLobbyPlayers.filter(p => p.team === 'B').length < 2 && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700 h-8 text-xs"
                                onClick={() => handleSwitchTeam('B')}
                              >
                                Join Team B
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {currentLobby.status !== 'in_progress' ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                        <Button 
                          className={`flex-1 h-12 text-lg font-medium shadow-sm transition-all hover:shadow-md ${
                            activeLobbyPlayers.find(p => p.id === user.id)?.is_ready 
                              ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          onClick={handleReadyToggle}
                        >
                          {activeLobbyPlayers.find(p => p.id === user.id)?.is_ready ? 'Not Ready' : 'Ready Up!'}
                        </Button>

                        <Button 
                          variant="destructive"
                          className="h-12 w-12 p-0 shadow-sm transition-all hover:shadow-md shrink-0"
                          onClick={() => handleLeaveLobby(currentLobby.id)}
                          title="Leave Lobby"
                        >
                          <LogOut className="w-5 h-5" />
                        </Button>
                      </div>
                      
                      {/* Start Game Button - Only visible when all 4 players are ready */}
                      {activeLobbyPlayers.length === 4 && activeLobbyPlayers.every(p => p.is_ready) && (
                        <Button 
                          className="w-full h-12 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md animate-in fade-in slide-in-from-bottom-2"
                          onClick={handleStartGame}
                        >
                          Start Game
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <Scorer 
                        lobbyId={currentLobby.id} 
                        onMatchComplete={() => {
                          fetchActiveLobby();
                          fetchLobbies();
                          fetchPendingRatings();
                        }} 
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-4 mb-6">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Ready to Play?</h3>
                      <p className="text-sm text-gray-600 mt-1">Scan the court's QR code to join a lobby and start your match</p>
                    </div>
                  </div>

                  {!scanning ? (
                    <div className="space-y-4">
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-lg font-medium shadow-sm transition-all hover:shadow-md"
                        onClick={() => setScanning(true)}
                      >
                        <QrCode className="w-5 h-5 mr-2" /> Scan QR Code to Join Match
                      </Button>
                      
                      {/* Manual Entry Fallback */}
                      <div className="flex items-center gap-2">
                        <div className="h-px bg-gray-200 flex-1"></div>
                        <span className="text-xs text-gray-400 uppercase font-medium">Or enter code</span>
                        <div className="h-px bg-gray-200 flex-1"></div>
                      </div>
                      
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Enter Lobby Code manually..." 
                          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleJoinLobby((e.target as HTMLInputElement).value);
                            }
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-black p-0 rounded-lg border shadow-inner overflow-hidden relative aspect-square">
                      <div className="absolute top-2 right-2 z-10">
                        <Button variant="secondary" size="sm" onClick={() => setScanning(false)} className="h-8 w-8 p-0 rounded-full bg-white/80 hover:bg-white text-black">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <Scanner 
                        onScan={(result) => {
                          if (result && result[0]) {
                            setScanning(false);
                            // @ts-ignore - rawValue exists in the library but might be missing in types
                            const rawValue = result[0].rawValue || result[0].text || '';
                            console.log('Raw Scanned Value:', rawValue);
                            
                            let payloadToSend = rawValue;
                            
                            try {
                                // Strategy 1: Try parsing raw value directly
                                // Handles: {"type":"...","payload":"..."}
                                const parsed = JSON.parse(rawValue);
                                if (parsed) {
                                    if (parsed.payload) {
                                        payloadToSend = parsed.payload;
                                    } else if (parsed.lobbyId) {
                                        // Fallback to Lobby ID if payload is missing (supported by backend now)
                                        payloadToSend = parsed.lobbyId;
                                    }
                                }
                            } catch (e) {
                                // Strategy 2: Try cleaning quotes and parsing
                                // Handles: "{\"type\":\"...\",\"payload\":\"...\"}"
                                const cleanValue = rawValue.replace(/^"|"$/g, '').trim();
                                try {
                                    const parsedClean = JSON.parse(cleanValue);
                                    if (parsedClean) {
                                        if (parsedClean.payload) {
                                            payloadToSend = parsedClean.payload;
                                        } else if (parsedClean.lobbyId) {
                                            payloadToSend = parsedClean.lobbyId;
                                        } else {
                                            // Strategy 3: Use cleaned value (fallback for old UUID codes)
                                            payloadToSend = cleanValue;
                                        }
                                    }
                                } catch (e2) {
                                    // Strategy 4: Not JSON, use cleaned value
                                    // Handles: some-uuid-string
                                    payloadToSend = cleanValue;
                                }
                            }
                            
                            console.log('Final Payload to Send:', payloadToSend);
                            handleJoinLobby(payloadToSend);
                          }
                        }}
                        onError={(error: any) => console.log(error?.message)}
                      />
                      <div className="absolute inset-0 pointer-events-none border-2 border-emerald-500/50 rounded-lg"></div>
                    </div>
                  )}
                </>
              )}

              {scanResult && (
                <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md text-sm font-medium text-center animate-in fade-in slide-in-from-top-2">
                  {scanResult}
                </div>
              )}
              {error && (
                <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md text-sm font-medium text-center animate-in fade-in slide-in-from-top-2">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Matches */}
          <Card className="border-none shadow-md bg-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-gray-500" />
                <h3 className="font-bold text-gray-900">Match History</h3>
              </div>

              <div className="space-y-4">
                {matches.length > 0 ? (
                  matches.map((match) => (
                    <div key={match.id} className={`flex flex-col p-4 border rounded-lg transition-colors ${match.result === 'win' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${match.result === 'win' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <div>
                            <div className="font-bold text-gray-900">
                              {match.result === 'win' ? 'Victory' : 'Defeat'}
                            </div>
                            <div className="text-xs text-gray-500">{new Date(match.completed_at).toLocaleDateString()} • {new Date(match.completed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900 text-lg">{match.score}</div>
                          <div className={`text-xs font-medium ${match.result === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                            {match.result === 'win' ? '+' : '-'}{match.mmr_delta} MMR
                          </div>
                        </div>
                      </div>
                      
                      {/* Players */}
                      <div className="flex items-center justify-between text-sm">
                         {/* Team A */}
                         <div className="flex gap-2">
                           {match.players.filter((p: any) => p.team === 'A').map((p: any) => (
                             <div key={p.id} className="flex items-center gap-1 bg-white/60 px-2 py-1 rounded border border-gray-100" title={p.display_name}>
                               <div className="w-4 h-4 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                                 {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <span className="text-[8px]">{p.display_name?.slice(0, 2).toUpperCase()}</span>}
                               </div>
                               <span className={`text-xs ${p.id === user.id ? 'font-bold' : ''}`}>{p.display_name.split(' ')[0]}</span>
                             </div>
                           ))}
                         </div>
                         <div className="text-xs text-gray-400 font-mono">VS</div>
                         {/* Team B */}
                         <div className="flex gap-2">
                           {match.players.filter((p: any) => p.team === 'B').map((p: any) => (
                             <div key={p.id} className="flex items-center gap-1 bg-white/60 px-2 py-1 rounded border border-gray-100" title={p.display_name}>
                               <div className="w-4 h-4 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                                 {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <span className="text-[8px]">{p.display_name?.slice(0, 2).toUpperCase()}</span>}
                               </div>
                               <span className={`text-xs ${p.id === user.id ? 'font-bold' : ''}`}>{p.display_name.split(' ')[0]}</span>
                             </div>
                           ))}
                         </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No matches played yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </main>

      {/* Rating Prompt */}
      {pendingRatingMatch && (
        <RatingPrompt
          matchId={pendingRatingMatch.matchId}
          players={pendingRatingMatch.playersToRate}
          isOpen={!!pendingRatingMatch}
          onComplete={() => {
            setPendingRatingMatch(null);
            fetchPendingRatings(); // Refresh to see if there are more
          }}
        />
      )}
    </div>
  );
}

function StatsCard({ icon, bg, value, label, valueColor }: { icon: React.ReactNode, bg: string, value: string | number, label: string, valueColor: string }) {
  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div>
          <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
          <div className="text-sm text-gray-500 font-medium">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
