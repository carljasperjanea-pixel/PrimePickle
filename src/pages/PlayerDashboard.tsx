import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest, useUser } from '@/lib/api';
import { Trophy, User, Activity, QrCode, LogOut, Edit2, TrendingUp, Target, BarChart, Camera, Calendar, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';

export default function PlayerDashboard() {
  const [user, setUser] = useState<any>(null);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [activeLobbyPlayers, setActiveLobbyPlayers] = useState<any[]>([]);
  const [currentLobby, setCurrentLobby] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else {
        setUser(u);
        fetchLobbies();
        fetchActiveLobby();
      }
    });

    // Poll for lobby updates (especially for countdown/start)
    const interval = setInterval(() => {
      fetchLobbies();
      fetchActiveLobby();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Countdown Logic
  useEffect(() => {
    if (currentLobby?.status === 'in_progress' && currentLobby.started_at) {
      const startTime = new Date(currentLobby.started_at).getTime();
      const now = new Date().getTime();
      const diff = Math.ceil((startTime + 3000 - now) / 1000); // 3 seconds from start

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
      } else {
        setCurrentLobby(null);
      }
      
      if (data.players) {
        setActiveLobbyPlayers(data.players);
      } else {
        setActiveLobbyPlayers([]);
      }
    } catch (e) {
      console.error("Failed to fetch active lobby players", e);
      setActiveLobbyPlayers([]);
      setCurrentLobby(null);
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
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleLeaveLobby = async (lobbyId: string) => {
    try {
      await apiRequest('/lobbies/leave', 'POST', { lobby_id: lobbyId });
      setScanResult('Left lobby successfully');
      fetchLobbies(); // Refresh lobbies
      setActiveLobbyPlayers([]); // Clear active lobby players
      setTimeout(() => setScanResult(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleSwitchTeam = async (team: string) => {
    try {
      await apiRequest('/lobbies/team', 'POST', { lobby_id: currentLobby.id, team });
      fetchActiveLobby();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleReadyToggle = async () => {
    try {
      const currentUser = activeLobbyPlayers.find(p => p.id === user.id);
      if (!currentUser) return;
      
      const newStatus = !currentUser.is_ready;
      const res = await apiRequest('/lobbies/ready', 'POST', { lobby_id: currentLobby.id, is_ready: newStatus });
      
      fetchActiveLobby();
      fetchLobbies(); // Update lobby status immediately
      
      if (res.game_started) {
        // Game started logic if needed
      }
    } catch (err: any) {
      setError(err.message);
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

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  // Mock Stats (derive from games_played if possible)
  const gamesPlayed = user.games_played || 0;
  const wins = Math.floor(gamesPlayed * 0.6); // Mock 60% win rate
  const losses = gamesPlayed - wins;
  const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : '0.0';

  // Recent Matches (Completed Lobbies)
  const recentMatches = lobbies.filter(l => l.status === 'completed').slice(0, 5);
  
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
          <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardContent className="p-6 relative">
              <div className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 cursor-pointer">
                <Edit2 className="w-4 h-4" />
              </div>
              
              <h2 className="text-lg font-semibold mb-6">My Profile</h2>
              
              <div className="flex flex-col items-center mb-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-lime-500 to-amber-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4">
                  {user.display_name.slice(0, 2).toUpperCase()}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                  <div className="font-medium text-gray-900">{user.display_name}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                  <div className="text-sm text-gray-600 truncate" title={user.email}>{user.email}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</label>
                  <div className="text-sm text-gray-600">{user.address || '123 Pickleball Lane, Austin, TX'}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</label>
                  <div className="text-sm text-gray-600">{user.phone || '(555) 123-4567'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Content: Stats & Actions */}
        <div className="lg:col-span-2 space-y-6">
          
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
                  ) : (
                    <div className="mt-4 p-4 bg-gray-100 rounded-lg text-center text-gray-600 font-medium animate-pulse">
                      Match is currently being played...
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
                            handleJoinLobby(result[0].rawValue);
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
                <h3 className="font-bold text-gray-900">Recent Matches</h3>
              </div>

              <div className="space-y-4">
                {recentMatches.length > 0 ? (
                  recentMatches.map((match, i) => (
                    <div key={match.id} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${i % 2 === 0 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                        <div>
                          <div className="font-bold text-gray-900">Court {match.id.slice(0, 4).toUpperCase()}</div>
                          <div className="text-xs text-gray-500">{new Date(match.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">11-7</div>
                        <div className="text-xs font-medium text-emerald-600">+20 MMR</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No recent matches found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
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
