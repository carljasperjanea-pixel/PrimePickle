import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

export default function PlayerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

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

  const handleSelectPlayer = (playerId: string) => {
    setIsOpen(false);
    navigate(`/profile/${playerId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
            setQuery('');
            setResults([]);
        }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-gray-500 bg-white hover:bg-gray-50 border-gray-200 shadow-sm">
          <Search className="mr-2 h-4 w-4" />
          Search players...
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" aria-describedby="search-description">
        <DialogHeader>
          <DialogTitle>Search Players</DialogTitle>
          <DialogDescription id="search-description" className="sr-only">
            Search for players by name to view their profiles.
          </DialogDescription>
        </DialogHeader>
        
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
      </DialogContent>
    </Dialog>
  );
}
