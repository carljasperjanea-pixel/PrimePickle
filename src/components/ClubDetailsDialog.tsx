import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';
import { Users, UserPlus, Shield, User, X, Check } from 'lucide-react';

export function ClubDetailsDialog({ 
  clubId, 
  isOpen, 
  onClose,
  currentUserId
}: { 
  clubId: string | null; 
  isOpen: boolean; 
  onClose: () => void;
  currentUserId: string;
}) {
  const [club, setClub] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && clubId) {
      fetchClubDetails();
    }
  }, [isOpen, clubId]);

  const fetchClubDetails = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/clubs/${clubId}`);
      setClub(data.club);
      setMembers(data.members);
    } catch (err: any) {
      console.error('Failed to fetch club details:', err);
      setError('Failed to load club details');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setError('');
    
    try {
      // First, find the user by email (in a real app, you might have a dedicated search endpoint)
      // For this demo, we'll assume there's an endpoint or we can just send the email to the backend
      // Wait, our backend invite route expects `userId`. Let's create a quick search or modify the backend.
      // Actually, let's just use the existing `/super-admin/users` if we are admin, but players can't access that.
      // Let's add a quick user search endpoint for invites, or just search by email on the frontend if we have a directory.
      // Since we don't have a public user search by email yet, let's assume the backend invite route can take an email.
      // I'll need to update the backend route to accept `email` instead of `userId` for easier inviting.
      
      const res = await apiRequest(`/clubs/${clubId}/invite-by-email`, 'POST', { email: inviteEmail });
      setInviteEmail('');
      fetchClubDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to invite user');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await apiRequest(`/clubs/${clubId}/members/${userId}`, 'DELETE');
      fetchClubDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  if (!club) return null;

  const currentUserMember = members.find(m => m.user_id === currentUserId);
  const canInvite = currentUserMember && ['owner', 'admin'].includes(currentUserMember.role);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="w-6 h-6 text-emerald-600" />
            {club.name}
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">{club.description}</p>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

          {canInvite && (
            <div className="space-y-2 bg-gray-50 p-4 rounded-lg border">
              <label className="text-sm font-medium text-gray-700">Invite Player</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Player's email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-white"
                />
                <Button 
                  onClick={handleInvite} 
                  disabled={inviteLoading || !inviteEmail.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {inviteLoading ? '...' : <UserPlus className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 flex items-center justify-between">
              <span>Members ({members.filter(m => m.role !== 'invited').length})</span>
            </h4>
            
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                      {member.profiles?.display_name?.charAt(0) || <User className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {member.profiles?.display_name || 'Unknown Player'}
                        {member.user_id === currentUserId && ' (You)'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {member.role === 'owner' && <Shield className="w-3 h-3 text-amber-500" />}
                        <span className="text-xs text-gray-500 capitalize">{member.role}</span>
                      </div>
                    </div>
                  </div>
                  
                  {canInvite && member.user_id !== currentUserId && member.role !== 'owner' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                      onClick={() => handleRemoveMember(member.user_id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
