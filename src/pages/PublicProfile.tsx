import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';
import { Trophy, Activity, MapPin, Phone, Mail, ArrowLeft, ImageIcon } from 'lucide-react';

export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [gears, setGears] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchProfile();
    }
  }, [id]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const [userData, gearsData, matchesData] = await Promise.all([
        apiRequest(`/public/profile/${id}`),
        apiRequest(`/public/gears/${id}`),
        apiRequest(`/public/matches/${id}`)
      ]);

      setUser(userData.user);
      setGears(gearsData.gears || []);
      setMatches(matchesData.matches || []);
    } catch (err: any) {
      console.error("Failed to fetch profile", err);
      setError("Failed to load profile. User might not exist.");
    } finally {
      setLoading(false);
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

        {/* Right Content: Stats */}
        <div className="lg:col-span-2 space-y-6">
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
        </div>
      </main>
    </div>
  );
}
