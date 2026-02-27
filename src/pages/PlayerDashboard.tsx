import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest, useUser } from '@/lib/api';
import { Trophy, User, Activity, QrCode, LogOut, Edit2, TrendingUp, Target, BarChart, Camera, Calendar, X, Users, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PlayerDashboard() {
  const [user, setUser] = useState<any>(null);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else {
        setUser(u);
        fetchLobbies();
      }
    });
  }, []);

  const fetchLobbies = async () => {
    try {
      const data = await apiRequest('/lobbies');
      setLobbies(data.lobbies || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (scanning) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true
        },
        /* verbose= */ false
      );
      
      scanner.render(
        (decodedText) => {
          scanner.clear();
          setScanning(false);
          handleJoinLobby(decodedText);
        },
        (errorMessage) => {
          // parse error, ignore to avoid spamming logs
        }
      );

      return () => {
        try {
          scanner.clear();
        } catch (e) {
          // ignore cleanup errors
        }
      };
    }
  }, [scanning]);

  const handleJoinLobby = async (qrPayload: string) => {
    try {
      const res = await apiRequest('/lobbies/join', 'POST', { qr_payload: qrPayload });
      setScanResult(`Joined lobby successfully! ID: ${res.lobby_id}`);
      fetchLobbies(); // Refresh lobbies
      setTimeout(() => setScanResult(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleLogout = () => {
    document.cookie = 'token=; Max-Age=0; path=/;';
    navigate('/login');
  };

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  // Mock Stats (derive from games_played if possible)
  const gamesPlayed = user.games_played || 0;
  const wins = Math.floor(gamesPlayed * 0.6); // Mock 60% win rate
  const losses = gamesPlayed - wins;
  const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : '0.0';

  // Active Lobby (Open or Full or Playing)
  const activeLobby = lobbies.find(l => l.status === 'open' || l.status === 'full' || l.status === 'playing');
  const activeLobbyId = activeLobby?.id;
  const activeLobbyStatus = activeLobby?.status;
  const activeLobbyPlayers = activeLobby?.players;
  
  // Polling for updates
  useEffect(() => {
    if (activeLobbyId) {
      const interval = setInterval(fetchLobbies, 3000);
      return () => clearInterval(interval);
    }
  }, [activeLobbyId]);

  // Redirect if playing
  useEffect(() => {
    if (activeLobbyStatus === 'playing' && activeLobbyId) {
      navigate(`/scorer/${activeLobbyId}`);
    }
  }, [activeLobbyStatus, activeLobbyId]);

  // Countdown Logic
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Check if everyone is ready
  const allReady = activeLobbyPlayers?.length >= 2 && activeLobbyPlayers.every((p: any) => p.is_ready);

  useEffect(() => {
    if (allReady) {
      if (countdown === null) setCountdown(3);
    } else {
      setCountdown(null);
    }
  }, [allReady]); // Only run when readiness changes

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Start Match
      handleStartMatch();
    }
  }, [countdown]);

  const handleStartMatch = async () => {
    if (!activeLobby) return;
    try {
      await apiRequest(`/lobbies/${activeLobby.id}/start`, 'POST');
    } catch (e) {
      console.error(e);
    }
  };

  const handleClaimCaptain = async (team: 'A' | 'B') => {
    if (!activeLobby) return;
    try {
      await apiRequest(`/lobbies/${activeLobby.id}/captain`, 'POST', { team });
      fetchLobbies();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSetGoal = async (goal: number) => {
    if (!activeLobby) return;
    try {
      await apiRequest(`/lobbies/${activeLobby.id}/settings`, 'POST', { match_goal: goal });
      fetchLobbies();
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleToggleReady = async () => {
    if (!activeLobby) return;
    const me = activeLobby.players.find((p: any) => p.id === user.id);
    try {
      await apiRequest(`/lobbies/${activeLobby.id}/ready`, 'POST', { is_ready: !me?.is_ready });
      fetchLobbies();
    } catch (e: any) {
      console.error(e);
    }
  };

  // Helper to check if I am captain
  const isMyTeamCaptain = (team: 'A' | 'B') => {
    if (!activeLobby) return false;
    const captainId = team === 'A' ? activeLobby.team_a_captain_id : activeLobby.team_b_captain_id;
    return captainId === user.id;
  };
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

          {/* Active Lobby or Scan Action */}
          {activeLobby ? (
            <Card className="border-emerald-200 bg-emerald-50/30 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Current Lobby</h3>
                      <p className="text-sm text-gray-600">ID: {activeLobby.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    activeLobby.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {activeLobby.status}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">Players ({activeLobby.players?.length || 0}/4)</div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Team A */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="text-xs font-bold text-blue-600 uppercase">Team A</div>
                        {!activeLobby.team_a_captain_id && activeLobby.players?.slice(0, 2).some((p: any) => p.id === user.id) && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleClaimCaptain('A')}>Become Captain</Button>
                        )}
                        {activeLobby.team_a_captain_id && <div className="text-[10px] text-blue-600 font-bold">Captain Selected</div>}
                      </div>
                      {activeLobby.players?.slice(0, 2).map((p: any) => (
                        <div key={p.id} className={`flex items-center justify-between p-2 bg-white rounded border shadow-sm ${p.is_ready ? 'border-green-400 ring-1 ring-green-400' : 'border-blue-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold relative">
                              {p.display_name.slice(0, 2).toUpperCase()}
                              {activeLobby.team_a_captain_id === p.id && (
                                <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5 border border-white">
                                  <Trophy className="w-2 h-2 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="text-sm font-medium">
                              {p.display_name}
                              {p.id === user.id && <span className="ml-1 text-xs text-gray-400">(You)</span>}
                            </div>
                          </div>
                          {p.is_ready && <div className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">READY</div>}
                        </div>
                      ))}
                      {(!activeLobby.players || activeLobby.players.length < 1) && (
                         <div className="p-2 border border-dashed border-gray-300 rounded text-xs text-gray-400 text-center">Empty Slot</div>
                      )}
                      {(!activeLobby.players || activeLobby.players.length < 2) && (
                         <div className="p-2 border border-dashed border-gray-300 rounded text-xs text-gray-400 text-center">Empty Slot</div>
                      )}
                    </div>

                    {/* Team B */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="text-xs font-bold text-orange-600 uppercase">Team B</div>
                        {!activeLobby.team_b_captain_id && activeLobby.players?.slice(2, 4).some((p: any) => p.id === user.id) && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleClaimCaptain('B')}>Become Captain</Button>
                        )}
                        {activeLobby.team_b_captain_id && <div className="text-[10px] text-orange-600 font-bold">Captain Selected</div>}
                      </div>
                      {activeLobby.players?.slice(2, 4).map((p: any) => (
                        <div key={p.id} className={`flex items-center justify-between p-2 bg-white rounded border shadow-sm ${p.is_ready ? 'border-green-400 ring-1 ring-green-400' : 'border-orange-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold relative">
                              {p.display_name.slice(0, 2).toUpperCase()}
                              {activeLobby.team_b_captain_id === p.id && (
                                <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5 border border-white">
                                  <Trophy className="w-2 h-2 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="text-sm font-medium">
                              {p.display_name}
                              {p.id === user.id && <span className="ml-1 text-xs text-gray-400">(You)</span>}
                            </div>
                          </div>
                          {p.is_ready && <div className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">READY</div>}
                        </div>
                      ))}
                      {(!activeLobby.players || activeLobby.players.length < 3) && (
                         <div className="p-2 border border-dashed border-gray-300 rounded text-xs text-gray-400 text-center">Empty Slot</div>
                      )}
                      {(!activeLobby.players || activeLobby.players.length < 4) && (
                         <div className="p-2 border border-dashed border-gray-300 rounded text-xs text-gray-400 text-center">Empty Slot</div>
                      )}
                    </div>
                  </div>

                  {/* Match Settings (Captain Only) */}
                  {(isMyTeamCaptain('A') || isMyTeamCaptain('B')) && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                      <div className="text-xs font-bold text-gray-500 uppercase mb-2">Match Settings (Captain)</div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Match Point:</span>
                        {[11, 15, 21].map(points => (
                          <button
                            key={points}
                            onClick={() => handleSetGoal(points)}
                            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
                              (activeLobby.match_goal || 11) === points 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-white border text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {points}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Ready / Countdown Area */}
                  <div className="mt-6 p-4 bg-white rounded-lg border text-center">
                    {countdown !== null ? (
                      <div className="flex flex-col items-center justify-center animate-pulse">
                        <div className="text-4xl font-black text-emerald-600 mb-2">{countdown}</div>
                        <div className="text-sm text-gray-500 font-medium">Starting Match...</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-center">
                          <Button 
                            size="lg"
                            onClick={handleToggleReady}
                            className={`w-full sm:w-auto px-8 font-bold transition-all ${
                              activeLobby.players?.find((p: any) => p.id === user.id)?.is_ready
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {activeLobby.players?.find((p: any) => p.id === user.id)?.is_ready ? 'Cancel Ready' : 'LOCK IN READY'}
                          </Button>
                        </div>
                        <div className="text-xs text-gray-400">
                          Waiting for all players to lock in...
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-emerald-200 bg-emerald-50/30 shadow-md">
            <CardContent className="p-6">
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

                  {scanResult && (
                    <div className="p-3 bg-green-100 text-green-800 rounded-md text-sm font-medium text-center animate-in fade-in slide-in-from-top-2">
                      {scanResult}
                    </div>
                  )}
                  {error && (
                    <div className="p-3 bg-red-100 text-red-800 rounded-md text-sm font-medium text-center animate-in fade-in slide-in-from-top-2">
                      {error}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white p-4 rounded-lg border shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-sm">Scanning...</h4>
                    <Button variant="ghost" size="sm" onClick={() => setScanning(false)} className="h-8 w-8 p-0 rounded-full">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div id="reader" className="w-full rounded-lg overflow-hidden"></div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

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
