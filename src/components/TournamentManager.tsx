import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/api';
import { Trophy, Plus, Users, Play, CheckCircle, Search, X } from 'lucide-react';

export function TournamentManager() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTournament, setNewTournament] = useState({ name: '', format: 'single_elimination' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const data = await apiRequest('/tournaments');
      setTournaments(data.tournaments);
    } catch (e) {
      console.error('Failed to fetch tournaments', e);
    }
  };

  const fetchTournamentDetails = async (id: string) => {
    try {
      const data = await apiRequest(`/tournaments/${id}`);
      setSelectedTournament(data);
    } catch (e) {
      console.error('Failed to fetch tournament details', e);
    }
  };

  const handleCreateTournament = async () => {
    try {
      await apiRequest('/tournaments', 'POST', newTournament);
      setIsCreating(false);
      setNewTournament({ name: '', format: 'single_elimination' });
      fetchTournaments();
    } catch (e) {
      alert('Failed to create tournament');
    }
  };

  const handleSearchUsers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await apiRequest(`/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(data.users);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddParticipant = async (profileId: string) => {
    try {
      await apiRequest(`/tournaments/${selectedTournament.tournament.id}/participants`, 'POST', { profile_id: profileId });
      setSearchQuery('');
      setSearchResults([]);
      fetchTournamentDetails(selectedTournament.tournament.id);
    } catch (e) {
      alert('Failed to add participant');
    }
  };

  const handleRemoveParticipant = async (profileId: string) => {
    try {
      await apiRequest(`/tournaments/${selectedTournament.tournament.id}/participants/${profileId}`, 'DELETE');
      fetchTournamentDetails(selectedTournament.tournament.id);
    } catch (e) {
      alert('Failed to remove participant');
    }
  };

  const handleStartTournament = async () => {
    if (!confirm('Are you sure you want to start the tournament? No more participants can be added.')) return;
    try {
      await apiRequest(`/tournaments/${selectedTournament.tournament.id}/start`, 'POST');
      fetchTournamentDetails(selectedTournament.tournament.id);
      fetchTournaments();
    } catch (e: any) {
      alert(`Failed to start tournament: ${e.message}`);
    }
  };

  const handleUpdateMatch = async (matchId: string, winnerId: string, score: string) => {
    try {
      await apiRequest(`/tournaments/matches/${matchId}`, 'PUT', { winner_id: winnerId, score });
      fetchTournamentDetails(selectedTournament.tournament.id);
    } catch (e) {
      alert('Failed to update match');
    }
  };

  if (selectedTournament) {
    const { tournament, participants, matches } = selectedTournament;
    
    // Group matches by round
    const roundsMap = new Map();
    matches?.forEach((m: any) => {
      if (!roundsMap.has(m.round_number)) {
        roundsMap.set(m.round_number, { name: m.round_name, matches: [] });
      }
      roundsMap.get(m.round_number).matches.push(m);
    });
    const rounds = Array.from(roundsMap.values()).sort((a, b) => a.matches[0].round_number - b.matches[0].round_number);

    const renderMatch = (match: any) => (
      <Card key={match.id} className={`w-full min-w-[250px] border-l-4 ${match.winner_id ? 'border-l-emerald-500' : 'border-l-gray-300'} shadow-sm`}>
        <CardContent className="p-3">
          <div className="text-xs text-gray-500 mb-2 font-medium">Match {match.match_order} {match.is_bye && '(Bye)'}</div>
          <div className="space-y-1">
            {[
              { id: match.player1_id, profile: match.player1 },
              { id: match.player2_id, profile: match.player2 }
            ].map((player, pIdx) => (
              <div key={pIdx} className={`flex items-center justify-between p-2 rounded text-sm ${match.winner_id === player.id && player.id ? 'bg-emerald-50 font-bold text-emerald-700' : 'bg-gray-50'}`}>
                <span className="truncate">{player.profile?.display_name || (match.is_bye ? 'BYE' : 'TBD')}</span>
                {match.winner_id === player.id && player.id && <CheckCircle className="w-4 h-4 text-emerald-500" />}
              </div>
            ))}
          </div>
          
          {!match.winner_id && !match.is_bye && match.player1_id && match.player2_id && (
            <div className="mt-3 pt-3 border-t flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => {
                const score = prompt('Enter score (e.g., 11-9):', '11-0');
                if (score !== null) handleUpdateMatch(match.id, match.player1_id, score);
              }}>
                P1 Wins
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => {
                const score = prompt('Enter score (e.g., 11-9):', '11-0');
                if (score !== null) handleUpdateMatch(match.id, match.player2_id, score);
              }}>
                P2 Wins
              </Button>
            </div>
          )}
          {match.score && (
            <div className="mt-2 text-center text-xs font-medium text-gray-600">
              Score: {match.score}
            </div>
          )}
        </CardContent>
      </Card>
    );

    const renderBracket = (bracketRounds: any[]) => (
      <div className="flex flex-row gap-8 overflow-x-auto pb-8 pt-4 px-2">
        {bracketRounds.map((round: any, idx: number) => (
          <div key={idx} className="flex flex-col min-w-[250px] gap-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider text-center mb-2">{round.name}</h3>
            <div className="flex flex-col justify-around flex-1 gap-6">
              {round.matches.map((match: any) => renderMatch(match))}
            </div>
          </div>
        ))}
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setSelectedTournament(null)}>Back</Button>
            <h2 className="text-2xl font-bold">{tournament.name}</h2>
            <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium capitalize">
              {tournament.format.replace('_', ' ')}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
              tournament.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
              tournament.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {tournament.status.replace('_', ' ')}
            </span>
          </div>
          {tournament.status === 'draft' && (
            <Button onClick={handleStartTournament} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Play className="w-4 h-4" /> Start Tournament
            </Button>
          )}
        </div>

        {tournament.status === 'draft' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Participants ({participants?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      placeholder="Search users to add..." 
                      className="pl-9"
                      value={searchQuery}
                      onChange={handleSearchUsers}
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map(u => (
                          <div key={u.id} className="flex items-center justify-between p-2 hover:bg-gray-50 border-b last:border-0">
                            <span className="text-sm font-medium">{u.display_name}</span>
                            <Button size="sm" variant="ghost" onClick={() => handleAddParticipant(u.id)}>Add</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {participants?.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden">
                            {p.profiles.avatar_url ? (
                              <img src={p.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              p.profiles.display_name?.charAt(0)
                            )}
                          </div>
                          <span className="font-medium">{p.profiles.display_name}</span>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemoveParticipant(p.profile_id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {participants?.length === 0 && (
                      <div className="text-center text-gray-500 py-4">No participants added yet.</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-8 bg-white p-6 rounded-xl border shadow-sm">
            {tournament.format === 'round_robin' ? (
              <div className="space-y-8">
                {rounds.map((round: any, idx: number) => (
                  <div key={idx} className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2">{round.name}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {round.matches.map((match: any) => renderMatch(match))}
                    </div>
                  </div>
                ))}
              </div>
            ) : tournament.format === 'double_elimination' ? (
              <div className="space-y-12">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" /> Winners Bracket
                  </h3>
                  {renderBracket(rounds.filter(r => r.matches[0].round_number < 100))}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-gray-400" /> Losers Bracket
                  </h3>
                  {renderBracket(rounds.filter(r => r.matches[0].round_number >= 100))}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" /> Championship Bracket
                </h3>
                {renderBracket(rounds)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Tournaments</h2>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Create Tournament
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tournament</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tournament Name</label>
                <Input 
                  placeholder="e.g., Summer Championship 2026" 
                  value={newTournament.name}
                  onChange={e => setNewTournament({...newTournament, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Format</label>
                <Select value={newTournament.format} onValueChange={v => setNewTournament({...newTournament, format: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_elimination">Single Elimination</SelectItem>
                    <SelectItem value="double_elimination">Double Elimination</SelectItem>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateTournament} disabled={!newTournament.name}>
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments.map(t => (
          <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => fetchTournamentDetails(t.id)}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Trophy className="w-6 h-6 text-emerald-700" />
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                  t.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  t.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {t.status.replace('_', ' ')}
                </span>
              </div>
              <h3 className="font-bold text-lg mb-1 truncate">{t.name}</h3>
              <p className="text-sm text-gray-500 capitalize">{t.format.replace('_', ' ')}</p>
              <div className="mt-4 text-xs text-gray-400">
                Created {new Date(t.created_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
        {tournaments.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No tournaments created yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
