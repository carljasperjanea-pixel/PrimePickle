import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest, useUser } from '@/lib/api';
import { supabase } from '@/lib/supabase-client';
import { Users, Plus, CheckCircle, Trophy, Activity, DollarSign, LogOut, QrCode, Clock, X, Search, MessageSquare, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserDirectory } from '@/components/UserDirectory';
import { AdminMatchHistory } from '@/components/AdminMatchHistory';
import { TournamentManager } from '@/components/TournamentManager';
import GlobalSearch from '@/components/GlobalSearch';
import { NotificationsPopover } from '@/components/NotificationsPopover';
import { SendNotificationDialog } from '@/components/SendNotificationDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [qrLobby, setQrLobby] = useState<any>(null); // Lobby to show QR for
  const [activeTab, setActiveTab] = useState<'lobbies' | 'directory' | 'history' | 'tournaments'>('lobbies');
  const navigate = useNavigate();

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else if (u.role !== 'admin' && u.role !== 'super_admin') navigate('/dashboard');
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

  const [isCreating, setIsCreating] = useState(false);

  const createLobby = async () => {
    setIsCreating(true);
    try {
      console.log('Sending create lobby request...');
      const res = await apiRequest('/lobbies', 'POST');
      console.log('Create lobby response:', res);
      await fetchLobbies();
    } catch (e: any) {
      console.error('Create lobby failed:', e);
      alert(`Failed to create lobby.\nError: ${e.message}\nDetails: ${JSON.stringify(e)}`);
    } finally {
      setIsCreating(false);
    }
  };

  const completeMatch = async (lobbyId: string, winnerTeam: 'A' | 'B') => {
    if (!confirm(`Confirm Team ${winnerTeam} won?`)) return;
    try {
      await apiRequest('/matches/complete', 'POST', {
        lobby_id: lobbyId,
        winner_team: winnerTeam,
        score: '11-0'
      });
      fetchLobbies();
    } catch (e) {
      alert('Failed to complete match: ' + (e as any).message);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Supabase signout error:', e);
    }
    document.cookie = 'token=; Max-Age=0; path=/;';
    navigate('/login');
  };

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  // Calculate stats
  const activeLobbiesCount = lobbies.filter(l => l.status === 'open' || l.status === 'full').length;
  const completedMatchesCount = lobbies.filter(l => l.status === 'completed').length;
  const totalPlayersMock = 156; // Mock data as per design
  const revenueMock = 2450; // Mock data as per design

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 to-amber-500 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold leading-tight">Admin Dashboard</h1>
              <p className="text-emerald-100 text-sm opacity-90">Lobby & Business Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AdminProfileEditor user={user} onUpdate={setUser} />
            <Button 
              variant="ghost" 
              className="text-white hover:bg-white/20 p-2 h-auto rounded-full"
              onClick={() => navigate('/messages')}
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
            <NotificationsPopover />
            {user?.role === 'super_admin' && (
              <Button 
                variant="secondary" 
                className="bg-white/20 text-white hover:bg-white/30 border-none shadow-sm"
                onClick={() => navigate('/super-admin')}
              >
                Super Admin Panel
              </Button>
            )}
            <Button 
              variant="secondary" 
              className="bg-white text-gray-800 hover:bg-gray-100 border-none shadow-sm gap-2"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard 
            icon={<Users className="w-6 h-6 text-blue-600" />} 
            bg="bg-blue-100" 
            value={totalPlayersMock} 
            label="Total Players" 
          />
          <StatsCard 
            icon={<Activity className="w-6 h-6 text-emerald-600" />} 
            bg="bg-emerald-100" 
            value={activeLobbiesCount} 
            label="Active Lobbies" 
          />
          <StatsCard 
            icon={<Trophy className="w-6 h-6 text-purple-600" />} 
            bg="bg-purple-100" 
            value={completedMatchesCount} 
            label="Today's Matches" 
          />
          <StatsCard 
            icon={<DollarSign className="w-6 h-6 text-orange-600" />} 
            bg="bg-orange-100" 
            value={`$${revenueMock}`} 
            label="Revenue (Mock)" 
          />
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button 
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'lobbies' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab('lobbies')}
            >
              Lobbies
            </button>
            <button 
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'directory' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab('directory')}
            >
              User Directory
            </button>
            <button 
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab('history')}
            >
              Match History
            </button>
            <button 
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'tournaments' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab('tournaments')}
            >
              Tournaments
            </button>
          </div>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <SendNotificationDialog userRole={user.role} />
            <div className="w-full sm:w-64">
              <GlobalSearch />
            </div>
            {activeTab === 'lobbies' && (
              <Button 
                onClick={createLobby} 
                disabled={isCreating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-full px-6 shadow-md transition-all hover:shadow-lg whitespace-nowrap"
              >
                {isCreating ? <Activity className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {isCreating ? 'Creating...' : 'Open New Court / Lobby'}
              </Button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'lobbies' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {lobbies.filter(l => l.status !== 'completed').map((lobby, index) => (
              <LobbyCard 
                key={lobby.id} 
                lobby={lobby} 
                index={index} 
                onViewQR={() => setQrLobby(lobby)}
                onCompleteMatch={completeMatch}
              />
            ))}
          </div>
        )}
        
        {activeTab === 'directory' && <UserDirectory />}
        
        {activeTab === 'history' && <AdminMatchHistory />}
        
        {activeTab === 'tournaments' && <TournamentManager />}
      </main>

      {/* QR Code Modal */}
      {qrLobby && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">Lobby QR Code</h3>
              <Button variant="ghost" size="icon" onClick={() => setQrLobby(null)} className="h-8 w-8 rounded-full hover:bg-gray-200">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-8 flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-xl shadow-inner border">
                <QRCodeSVG value={String(qrLobby.qr_payload)} size={200} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Scan to join Lobby</p>
                <div className="font-mono text-xs bg-gray-100 px-3 py-1 rounded border select-all">
                  {qrLobby.qr_payload}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsCard({ icon, bg, value, label }: { icon: React.ReactNode, bg: string, value: string | number, label: string }) {
  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500 font-medium">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LobbyCard({ lobby, index, onViewQR, onCompleteMatch }: { lobby: any, index: number, onViewQR: () => void, onCompleteMatch: (id: string, team: 'A' | 'B') => void }) {
  const players = lobby.players || [];
  const teamA = players.slice(0, 2);
  const teamB = players.slice(2, 4);
  const isFull = players.length >= 4;
  const navigate = useNavigate();

  return (
    <Card className="border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5 border-b flex justify-between items-start bg-white">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg text-gray-900">
              {index === 0 ? 'New' : `Court ${index + 1}`}
            </h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              lobby.status === 'open' ? 'bg-gray-100 text-gray-600' : 
              lobby.status === 'full' ? 'bg-black text-white' : 'bg-green-100 text-green-700'
            }`}>
              {lobby.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">{players.length}/4 players joined</p>
        </div>
        <Button variant="outline" size="sm" onClick={onViewQR} className="gap-2 text-gray-600 border-gray-300">
          <QrCode className="w-4 h-4" /> QR
        </Button>
      </div>

      <div className="p-5 bg-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Team A
          </div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">VS</div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            Team B <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Slot 1 */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            {teamA[0] ? <PlayerRow player={teamA[0]} color="blue" /> : <WaitingRow />}
            <div className="text-gray-300 font-medium text-xs">vs</div>
            {teamB[0] ? <PlayerRow player={teamB[0]} color="orange" reverse /> : <WaitingRow />}
          </div>
          
          {/* Slot 2 */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            {teamA[1] ? <PlayerRow player={teamA[1]} color="blue" /> : <WaitingRow />}
            <div className="text-gray-300 font-medium text-xs">vs</div>
            {teamB[1] ? <PlayerRow player={teamB[1]} color="orange" reverse /> : <WaitingRow />}
          </div>
        </div>
      </div>

      {isFull && lobby.status !== 'completed' && (
        <div className="p-4 bg-gray-50 border-t">
          <div className="grid grid-cols-2 gap-3">
             <Button 
              onClick={() => onCompleteMatch(lobby.id, 'A')} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
            >
              <CheckCircle className="w-4 h-4 mr-2" /> Team A Won
            </Button>
            <Button 
              onClick={() => onCompleteMatch(lobby.id, 'B')} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
            >
               <CheckCircle className="w-4 h-4 mr-2" /> Team B Won
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function PlayerRow({ player, color, reverse = false }: { player: any, color: 'blue' | 'orange', reverse?: boolean }) {
  const bgClass = color === 'blue' ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100';
  const textClass = color === 'blue' ? 'text-blue-700' : 'text-orange-700';
  
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${bgClass} ${reverse ? 'flex-row-reverse' : ''}`}>
      <div className={`flex items-center gap-3 ${reverse ? 'flex-row-reverse text-right' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color === 'blue' ? 'bg-blue-200 text-blue-700' : 'bg-orange-200 text-orange-700'}`}>
          {player.display_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">{player.display_name}</div>
          <div className="text-xs text-gray-500">MMR: {player.mmr}</div>
        </div>
      </div>
      <UserIcon className={`w-4 h-4 shrink-0 ${textClass} ${reverse ? 'mr-2' : ''}`} />
    </div>
  );
}

function WaitingRow() {
  return (
    <div className="flex items-center justify-center p-3 h-[62px] rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 text-sm gap-2">
      <Clock className="w-4 h-4 shrink-0" />
      <span className="truncate">Waiting...</span>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function AdminProfileEditor({ user, onUpdate }: { user: any, onUpdate: (u: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiRequest('/user/profile', 'PUT', { display_name: displayName });
      onUpdate(res.user);
      setIsOpen(false);
    } catch (e: any) {
      alert('Failed to update profile: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-white hover:bg-white/20 gap-2 px-3">
          <span className="font-medium">{user?.display_name || 'Admin'}</span>
          <Pencil className="w-3 h-3 opacity-70" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
              placeholder="Enter your display name"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
