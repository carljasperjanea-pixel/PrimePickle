import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, Trophy, Activity, MapPin, Phone, Mail } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function PlayerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  const handleSearch = async () => {
    if (!query || query.length < 2) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/players/search?q=${encodeURIComponent(query)}`);
      setResults(data.players || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlayer = async (playerId: string) => {
    setLoading(true);
    try {
      const data = await apiRequest(`/public/profile/${playerId}`);
      setSelectedPlayer(data.user);
    } catch (error) {
      console.error('Fetch profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const closeProfile = () => {
    setSelectedPlayer(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
            setQuery('');
            setResults([]);
            setSelectedPlayer(null);
        }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-gray-500 bg-white hover:bg-gray-50 border-gray-200 shadow-sm">
          <Search className="mr-2 h-4 w-4" />
          Search players...
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{selectedPlayer ? 'Player Profile' : 'Search Players'}</DialogTitle>
        </DialogHeader>
        
        {selectedPlayer ? (
            <div className="space-y-6">
                <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4 overflow-hidden">
                        {selectedPlayer.avatar_url ? (
                            <img src={selectedPlayer.avatar_url} alt={selectedPlayer.display_name} className="w-full h-full object-cover" />
                        ) : (
                            selectedPlayer.display_name?.slice(0, 2).toUpperCase()
                        )}
                    </div>
                    <h2 className="text-xl font-bold">{selectedPlayer.display_name}</h2>
                    {selectedPlayer.full_name && <p className="text-gray-500">{selectedPlayer.full_name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-orange-50 p-4 rounded-lg text-center">
                        <div className="flex justify-center mb-2"><Trophy className="w-5 h-5 text-orange-500" /></div>
                        <div className="text-2xl font-bold text-orange-700">{selectedPlayer.mmr}</div>
                        <div className="text-xs text-orange-600">MMR</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <div className="flex justify-center mb-2"><Activity className="w-5 h-5 text-blue-500" /></div>
                        <div className="text-2xl font-bold text-blue-700">{selectedPlayer.games_played || 0}</div>
                        <div className="text-xs text-blue-600">Games Played</div>
                    </div>
                </div>

                <div className="space-y-3">
                    {selectedPlayer.email && (
                        <div className="flex items-center gap-3 text-sm">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span>{selectedPlayer.email}</span>
                        </div>
                    )}
                    {selectedPlayer.phone && (
                        <div className="flex items-center gap-3 text-sm">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{selectedPlayer.phone}</span>
                        </div>
                    )}
                    {selectedPlayer.address && (
                        <div className="flex items-center gap-3 text-sm">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{selectedPlayer.address}</span>
                        </div>
                    )}
                </div>

                <Button variant="outline" className="w-full" onClick={closeProfile}>
                    Back to Search
                </Button>
            </div>
        ) : (
            <div className="grid gap-4 py-4">
            <div className="flex gap-2">
                <Input
                placeholder="Search by name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                {loading ? '...' : <Search className="h-4 w-4" />}
                </Button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {results.map((player) => (
                <div 
                    key={player.id} 
                    className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200 cursor-pointer"
                    onClick={() => handleSelectPlayer(player.id)}
                >
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                    {player.avatar_url ? (
                        <img src={player.avatar_url} alt={player.display_name} className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-5 h-5 text-gray-400" />
                    )}
                    </div>
                    <div>
                    <div className="font-medium">{player.display_name}</div>
                    <div className="text-xs text-gray-500">MMR: {player.mmr}</div>
                    </div>
                </div>
                ))}
                {results.length === 0 && query.length >= 2 && !loading && (
                <div className="text-center text-gray-500 text-sm py-4">No players found</div>
                )}
                {query.length < 2 && (
                    <div className="text-center text-gray-400 text-xs py-2">
                        Enter at least 2 characters to search
                    </div>
                )}
            </div>
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
