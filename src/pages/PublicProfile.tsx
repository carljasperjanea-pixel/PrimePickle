import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';
import { Trophy, Activity, MapPin, Phone, Mail, ArrowLeft, ImageIcon, Shield, Clock, Key } from 'lucide-react';

export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [gears, setGears] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const currentUserId = localStorage.getItem('user_id'); // Assuming user ID is stored here, or we can just try the API

  useEffect(() => {
    if (id) {
      fetchProfile();
    }
  }, [id]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      // Fetch user profile first (critical)
      const userData = await apiRequest(`/public/profile/${id}`);
      setUser(userData.user);

      // Fetch gears and matches (non-critical)
      try {
        const gearsData = await apiRequest(`/public/gears/${id}`);
        setGears(gearsData.gears || []);
      } catch (e) {
        console.warn("Failed to load gears", e);
        setGears([]);
      }

      if (userData.user.role === 'admin' || userData.user.role === 'super_admin') {
        try {
          const logsData = await apiRequest(`/public/admin-logs/${id}`);
          setAdminLogs(logsData.logs || []);
        } catch (e) {
          console.warn("Failed to load admin logs", e);
          setAdminLogs([]);
        }
      } else {
        try {
          const matchesData = await apiRequest(`/public/matches/${id}`);
          setMatches(matchesData.matches || []);
        } catch (e) {
          console.warn("Failed to load matches", e);
          setMatches([]);
        }
      }

      // Fetch follow stats
      try {
        const [isFollowingData, followersData, followingData] = await Promise.all([
          apiRequest(`/user/is-following/${id}`),
          apiRequest(`/user/followers-count/${id}`),
          apiRequest(`/user/following-count/${id}`)
        ]);
        setIsFollowing(isFollowingData.isFollowing);
        setFollowersCount(followersData.count);
        setFollowingCount(followingData.count);
      } catch (e) {
        console.warn("Failed to load follow stats", e);
      }

    } catch (err: any) {
      console.error("Failed to fetch profile", err);
      setError("Failed to load profile. User might not exist.");
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await apiRequest(`/user/follow/${id}`, 'DELETE');
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        await apiRequest(`/user/follow/${id}`, 'POST');
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to toggle follow status', error);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;
  if (error || !user) return <div className="p-8 text-center text-red-500">{error || "User not found"}</div>;

  const gamesPlayed = user.games_played || 0;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Player Profile</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Sidebar: Profile */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardContent className="p-6">
              <div className="flex flex-col items-center mb-8">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg mb-4 overflow-hidden">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                  ) : (
                    user.display_name?.slice(0, 2).toUpperCase()
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{user.display_name}</h2>
                {user.full_name && <p className="text-gray-500">{user.full_name}</p>}
                
                {(user.role === 'admin' || user.role === 'super_admin') && (
                  <div className="mt-2 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full capitalize flex items-center gap-1">
                    <Shield className="w-3 h-3" /> {user.role.replace('_', ' ')}
                  </div>
                )}
                
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

                {id !== currentUserId && (
                  <Button 
                    className="mt-6 w-full" 
                    variant={isFollowing ? "outline" : "default"}
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                  >
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {user.email && (
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Mail className="w-4 h-4 text-gray-400" /> {user.email}
                        </div>
                    </div>
                )}
                {user.phone && (
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone</div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Phone className="w-4 h-4 text-gray-400" /> {user.phone}
                        </div>
                    </div>
                )}
                {user.address && (
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Address</div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <MapPin className="w-4 h-4 text-gray-400" /> {user.address}
                        </div>
                    </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gear */}
          <Card className="border-none shadow-md bg-white">
            <CardContent className="p-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <ImageIcon className="w-5 h-5 text-gray-500" /> Gear
              </h3>
              <div className="space-y-3">
                {gears.length > 0 ? (
                  gears.map((gear) => (
                    <div key={gear.id} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
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
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    No gear listed.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Content: Stats or Admin Info */}
        <div className="lg:col-span-2 space-y-6">
          {(user.role === 'admin' || user.role === 'super_admin') ? (
            <>
              {/* Permissions */}
              <Card className="border-none shadow-md bg-white">
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Key className="w-5 h-5 text-emerald-600" /> Permissions & Access
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="font-medium text-gray-900 mb-1">Role Level</div>
                      <div className="text-sm text-gray-500 capitalize">{user.role.replace('_', ' ')}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="font-medium text-gray-900 mb-1">System Access</div>
                      <div className="text-sm text-gray-500">
                        {user.role === 'super_admin' ? 'Full Platform Control' : 'Tournament & Player Management'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Logs */}
              <Card className="border-none shadow-md bg-white">
                <CardContent className="p-6">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" /> Recent Activity
                    </h3>
                    <div className="space-y-3">
                        {adminLogs.length > 0 ? (
                            adminLogs.map((log) => (
                                <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="mt-0.5">
                                        <Activity className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm text-gray-900">{log.action_performed}</div>
                                        {log.target_id && <div className="text-xs text-gray-500 mt-0.5">Target: {log.target_id}</div>}
                                        <div className="text-xs text-gray-400 mt-1">{new Date(log.created_at).toLocaleString()}</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-400 text-sm">No recent activity found.</div>
                        )}
                    </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-md bg-orange-50/50">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-2 text-orange-600 font-medium mb-2">
                      <Trophy className="w-5 h-5" /> MMR
                    </div>
                    <div className="text-6xl font-bold text-amber-600 mb-1">{user.mmr || 1000}</div>
                    <div className="text-sm text-gray-500">Matchmaking Rating</div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-blue-50/50">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-2 text-blue-600 font-medium mb-2">
                      <Activity className="w-5 h-5" /> Games Played
                    </div>
                    <div className="text-6xl font-bold text-blue-600 mb-1">{gamesPlayed}</div>
                    <div className="text-sm text-gray-500">Total Matches</div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Matches */}
              <Card className="border-none shadow-md bg-white">
                <CardContent className="p-6">
                    <h3 className="font-bold text-gray-900 mb-4">Recent Matches</h3>
                    <div className="space-y-2">
                        {matches.length > 0 ? (
                            matches.map((match) => (
                                <div key={match.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-12 rounded-full ${match.result === 'Win' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <div>
                                            <div className="font-bold text-gray-900">{match.result}</div>
                                            <div className="text-xs text-gray-500">{new Date(match.date).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono font-medium">{match.score || 'N/A'}</div>
                                        <div className={`text-xs font-bold ${match.mmr_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {match.mmr_delta > 0 ? '+' : ''}{match.mmr_delta} MMR
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-400">No recent matches found.</div>
                        )}
                    </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
