import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest, useUser } from '@/lib/api';
import { Trophy, User, Activity, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PlayerDashboard() {
  const [user, setUser] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else setUser(u);
    });
  }, []);

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
      // Refresh user data or redirect to lobby view
    } catch (err: any) {
      setError(err.message);
      setScanResult(null);
    }
  };

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Player Dashboard</h1>
          <Button variant="outline" onClick={() => {
            document.cookie = 'token=; Max-Age=0; path=/;';
            navigate('/login');
          }}>Sign Out</Button>
        </header>

        {/* Profile Card */}
        <Card>
          <CardContent className="flex items-center gap-6 p-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user.display_name}</h2>
              <p className="text-muted-foreground">{user.email}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="bg-accent/10 text-accent px-2 py-1 rounded font-medium">
                  {user.role.toUpperCase()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Current MMR</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{user.mmr}</div>
              <p className="text-xs text-muted-foreground">Top 15% of players</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Games Played</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{user.games_played}</div>
              <p className="text-xs text-muted-foreground">Lifetime matches</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle>Ready to Play?</CardTitle>
          </CardHeader>
          <CardContent>
            {!scanning ? (
              <div className="text-center py-8">
                <Button size="lg" className="w-full md:w-auto gap-2" onClick={() => setScanning(true)}>
                  <QrCode className="w-5 h-5" />
                  Scan Lobby QR Code
                </Button>
                
                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="text-sm text-muted-foreground">or enter code manually:</span>
                </div>
                <div className="flex gap-2 max-w-xs mx-auto mt-2">
                  <input 
                    type="text" 
                    placeholder="Lobby Code" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleJoinLobby((e.target as HTMLInputElement).value);
                      }
                    }}
                  />
                </div>

                {scanResult && (
                  <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg">
                    {scanResult}
                  </div>
                )}
                {error && (
                  <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-sm mx-auto">
                <div id="reader" className="w-full"></div>
                <Button variant="ghost" className="w-full mt-4" onClick={() => setScanning(false)}>
                  Cancel Scan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
