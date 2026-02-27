import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiRequest, useUser } from '@/lib/api';
import { Users, Plus, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [selectedLobby, setSelectedLobby] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else if (u.role !== 'admin') navigate('/dashboard');
      else {
        setUser(u);
        fetchLobbies();
      }
    });
  }, []);

  const fetchLobbies = async () => {
    try {
      const data = await apiRequest('/lobbies');
      setLobbies(data.lobbies);
    } catch (e) {
      console.error(e);
    }
  };

  const createLobby = async () => {
    try {
      await apiRequest('/lobbies', 'POST');
      fetchLobbies();
    } catch (e) {
      console.error(e);
    }
  };

  const completeMatch = async (lobbyId: string, winnerTeam: 'A' | 'B') => {
    try {
      await apiRequest('/matches/complete', 'POST', {
        lobby_id: lobbyId,
        winner_team: winnerTeam,
        score: '11-0' // Placeholder score
      });
      fetchLobbies();
      setSelectedLobby(null);
    } catch (e) {
      alert('Failed to complete match: ' + (e as any).message);
    }
  };

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary">Organizer Dashboard</h1>
            <p className="text-muted-foreground">Manage lobbies and matches</p>
          </div>
          <div className="flex gap-4">
             <Button onClick={createLobby} className="gap-2">
              <Plus className="w-4 h-4" /> New Lobby
            </Button>
            <Button variant="outline" onClick={() => {
              document.cookie = 'token=; Max-Age=0; path=/;';
              navigate('/login');
            }}>Sign Out</Button>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Lobbies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{lobbies.filter(l => l.status === 'open').length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{lobbies.filter(l => l.status === 'completed').length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">--</div>
            </CardContent>
          </Card>
        </div>

        {/* Lobby Manager */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Lobby List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Recent Lobbies</h2>
            {lobbies.map((lobby) => (
              <Card key={lobby.id} className={`cursor-pointer transition-colors ${selectedLobby?.id === lobby.id ? 'border-primary bg-primary/5' : ''}`} onClick={() => setSelectedLobby(lobby)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground mb-1">ID: {lobby.id.slice(0, 8)}...</div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        lobby.status === 'open' ? 'bg-green-500' : 
                        lobby.status === 'full' ? 'bg-yellow-500' : 'bg-gray-300'
                      }`} />
                      <span className="font-medium capitalize">{lobby.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{lobby.player_count}/4</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(lobby.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Selected Lobby Detail / QR */}
          <div className="lg:col-span-1">
            {selectedLobby ? (
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Lobby Control</CardTitle>
                  <CardDescription>ID: {selectedLobby.id.slice(0, 8)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {selectedLobby.status !== 'completed' && (
                    <div className="flex flex-col items-center p-4 bg-white rounded-lg border">
                      <QRCodeSVG value={selectedLobby.qr_payload} size={200} />
                      <p className="mt-4 text-sm text-muted-foreground text-center">
                        Scan to join this lobby
                      </p>
                    </div>
                  )}

                  {selectedLobby.status === 'open' && (
                    <div className="text-center p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
                      Waiting for players... ({selectedLobby.player_count}/4)
                    </div>
                  )}

                  {(selectedLobby.status === 'full' || selectedLobby.player_count > 0) && selectedLobby.status !== 'completed' && (
                    <div className="space-y-3">
                      <h3 className="font-medium">Complete Match</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <Button onClick={() => completeMatch(selectedLobby.id, 'A')} className="bg-blue-600 hover:bg-blue-700">
                          Team A Won
                        </Button>
                        <Button onClick={() => completeMatch(selectedLobby.id, 'B')} className="bg-red-600 hover:bg-red-700">
                          Team B Won
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedLobby.status === 'completed' && (
                    <div className="flex items-center justify-center gap-2 text-green-600 font-medium p-4 bg-green-50 rounded-lg">
                      <CheckCircle className="w-5 h-5" />
                      Match Completed
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg p-8">
                Select a lobby to manage
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
