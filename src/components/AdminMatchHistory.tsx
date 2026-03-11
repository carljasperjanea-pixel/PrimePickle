import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { ChevronLeft, ChevronRight, Trophy, Clock, Swords } from 'lucide-react';

export function AdminMatchHistory() {
  const [matches, setMatches] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/admin/matches?page=${page}&limit=10`);
      setMatches(data.matches);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e) {
      console.error('Failed to fetch match history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [page]);

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 border-b">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Match ID</th>
                <th className="px-6 py-4 text-center">Team A</th>
                <th className="px-6 py-4 text-center">Score</th>
                <th className="px-6 py-4 text-center">Team B</th>
                <th className="px-6 py-4 text-right">MMR Delta</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      Loading match history...
                    </div>
                  </td>
                </tr>
              ) : matches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No matches found.
                  </td>
                </tr>
              ) : (
                matches.map((match) => (
                  <tr key={match.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(match.completed_at).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      {match.id.split('-')[0]}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        {match.teamA?.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-medium border border-blue-100">
                            {match.winner_team === 'A' && <Trophy className="w-3 h-3 text-amber-500" />}
                            {p.display_name}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-gray-700">
                      <div className="flex items-center justify-center gap-2">
                        <span className={match.winner_team === 'A' ? 'text-emerald-600' : 'text-gray-400'}>
                          {match.score ? match.score.split('-')[0] : (match.winner_team === 'A' ? '11' : '0')}
                        </span>
                        <Swords className="w-4 h-4 text-gray-300" />
                        <span className={match.winner_team === 'B' ? 'text-emerald-600' : 'text-gray-400'}>
                          {match.score ? match.score.split('-')[1] : (match.winner_team === 'B' ? '11' : '0')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        {match.teamB?.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-2 py-1 rounded-md text-xs font-medium border border-orange-100">
                            {match.winner_team === 'B' && <Trophy className="w-3 h-3 text-amber-500" />}
                            {p.display_name}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-bold border border-emerald-100">
                        ±{match.mmr_delta || 20}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t bg-gray-50/50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-900">{matches.length > 0 ? (page - 1) * 10 + 1 : 0}</span> to <span className="font-medium text-gray-900">{Math.min(page * 10, total)}</span> of <span className="font-medium text-gray-900">{total}</span> matches
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
