import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';
import { Users, LogOut, Check, X, Eye, Search } from 'lucide-react';
import { CreateClubDialog } from './CreateClubDialog';

export function ClubsList({ currentUserId }: { currentUserId: string }) {
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    try {
      const data = await apiRequest('/clubs');
      setClubs(data.clubs);
    } catch (error) {
      console.error('Failed to fetch clubs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteResponse = async (clubId: string, action: 'accept' | 'reject') => {
    try {
      await apiRequest(`/clubs/${clubId}/members/${currentUserId}`, 'PUT', { action });
      fetchClubs();
    } catch (error: any) {
      alert(error.message || `Failed to ${action} invite`);
    }
  };

  const handleLeaveClub = async (clubId: string) => {
    if (!confirm('Are you sure you want to leave this club?')) return;
    try {
      await apiRequest(`/clubs/${clubId}/members/${currentUserId}`, 'DELETE');
      fetchClubs();
    } catch (error: any) {
      alert(error.message || 'Failed to leave club');
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-500">Loading clubs...</div>;

  const myClubs = clubs.filter(c => c.is_member || c.is_invited);
  
  const otherClubs = clubs.filter(c => !c.is_member && !c.is_invited).filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(query) || (c.description && c.description.toLowerCase().includes(query));
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">My Clubs</h2>
        <CreateClubDialog onClubCreated={fetchClubs} />
      </div>

      {myClubs.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed text-gray-500">
          You are not a member of any clubs yet. Create one or wait for an invite!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myClubs.map(club => (
            <Card key={club.id} className="overflow-hidden border-none shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-lg text-gray-900">{club.name}</h3>
                  </div>
                  {club.is_invited && (
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-medium">
                      Invited
                    </span>
                  )}
                  {club.is_member && (
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-medium capitalize">
                      {club.user_role}
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
                  {club.description || 'No description provided.'}
                </p>
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{club.member_count} members</span>
                  
                  <div className="flex gap-2">
                    {club.is_invited ? (
                      <>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleInviteResponse(club.id, 'reject')}>
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleInviteResponse(club.id, 'accept')}>
                          <Check className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => navigate(`/clubs/${club.id}`)}>
                          <Eye className="w-3 h-3" /> View
                        </Button>
                        {club.user_role !== 'owner' && (
                          <Button size="sm" variant="outline" className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleLeaveClub(club.id)}>
                            <LogOut className="w-3 h-3" /> Leave
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="pt-6 border-t">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-gray-900">Other Clubs</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Search clubs..."
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {otherClubs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
            {otherClubs.map(club => (
              <Card key={club.id} className="overflow-hidden border-none shadow-sm bg-gray-50 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => navigate(`/clubs/${club.id}`)}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-gray-400" />
                    <h3 className="font-bold text-lg text-gray-700">{club.name}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {club.description || 'No description provided.'}
                  </p>
                  <div className="text-sm text-gray-400">
                    {club.member_count} members
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed text-gray-500">
            {searchQuery ? 'No clubs found matching your search.' : 'No other clubs available.'}
          </div>
        )}
      </div>
    </div>
  );
}
