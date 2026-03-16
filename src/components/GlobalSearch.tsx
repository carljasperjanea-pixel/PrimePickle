import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, Users, Shield } from 'lucide-react';
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

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ players: any[], admins: any[], clubs: any[] }>({ players: [], admins: [], clubs: [] });
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length >= 2) {
        handleSearch();
      } else {
        setResults({ players: [], admins: [], clubs: [] });
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSearch = async () => {
    if (!query || query.length < 2) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/search?q=${encodeURIComponent(query)}`);
      setResults({
        players: data.players || [],
        admins: data.admins || [],
        clubs: data.clubs || []
      });
    } catch (error: any) {
      console.error('Search error:', error);
      const errorMessage = error.message || 'Failed to search. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlayer = (playerId: string) => {
    setIsOpen(false);
    navigate(`/profile/${playerId}`);
  };

  const handleSelectClub = (clubId: string) => {
    setIsOpen(false);
    navigate(`/clubs/${clubId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
            setQuery('');
            setResults({ players: [], admins: [], clubs: [] });
        }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-gray-500 bg-white hover:bg-gray-50 border-gray-200 shadow-sm">
          <Search className="mr-2 h-4 w-4" />
          Search players or clubs...
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" aria-describedby="search-description">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
          <DialogDescription id="search-description" className="sr-only">
            Search for players or clubs by name.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex gap-2 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Type to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {loading && <div className="text-center text-sm text-gray-500 py-4">Searching...</div>}
            
            {/* Admins Section */}
            {!loading && results.admins?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Admins</h3>
                <div className="space-y-1">
                  {results.admins.map((admin) => (
                    <div 
                      key={admin.id} 
                      className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200 cursor-pointer"
                      onClick={() => handleSelectPlayer(admin.id)}
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-100 overflow-hidden flex items-center justify-center shrink-0">
                        {admin.avatar_url ? (
                          <img src={admin.avatar_url} alt={admin.display_name} className="w-full h-full object-cover" />
                        ) : (
                          <Shield className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{admin.display_name}</div>
                        <div className="text-xs text-emerald-600 font-medium capitalize">{admin.role.replace('_', ' ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Players Section */}
            {!loading && results.players.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Players</h3>
                <div className="space-y-1">
                  {results.players.map((player) => (
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
                        <div className="font-medium text-gray-900">{player.display_name}</div>
                        <div className="text-xs text-gray-500">MMR: {player.mmr}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clubs Section */}
            {!loading && results.clubs.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2 mt-4">Clubs</h3>
                <div className="space-y-1">
                  {results.clubs.map((club) => (
                    <div 
                      key={club.id} 
                      className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200 cursor-pointer"
                      onClick={() => handleSelectClub(club.id)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {club.photo_url ? (
                          <img src={club.photo_url} alt={club.name} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{club.name}</div>
                        {club.description && (
                          <div className="text-xs text-gray-500 truncate">{club.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="text-center text-red-500 text-sm py-2">{error}</div>
            )}
            
            {results.players.length === 0 && results.admins.length === 0 && results.clubs.length === 0 && query.length >= 2 && !loading && !error && (
              <div className="text-center text-gray-500 text-sm py-8">No players, admins, or clubs found</div>
            )}
            
            {query.length < 2 && (
                <div className="text-center text-gray-400 text-xs py-8">
                    Enter at least 2 characters to search
                </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
