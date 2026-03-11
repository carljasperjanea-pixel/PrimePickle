import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, useUser } from '@/lib/api';
import { Users, UserPlus, Shield, User, X, ArrowLeft, Trophy, Calendar, Megaphone, ThumbsUp, ThumbsDown, Pin, Trash2, Edit2, Image as ImageIcon, Plus, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { NotificationsPopover } from '@/components/NotificationsPopover';

export default function ClubDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [club, setClub] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState('');
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [announcementLoading, setAnnouncementLoading] = useState(false);

  // Edit Club State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    photo_url: '',
    achievements: [] as string[]
  });
  const [newAchievement, setNewAchievement] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else {
        setUser(u);
        fetchClubDetails();
      }
    });
  }, [id]);

  const fetchClubDetails = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/clubs/${id}`);
      setClub(data.club);
      setMembers(data.members);
      setEditForm({
        name: data.club.name || '',
        description: data.club.description || '',
        photo_url: data.club.photo_url || '',
        achievements: data.club.achievements || []
      });
      fetchAnnouncements();
    } catch (err: any) {
      console.error('Failed to fetch club details:', err);
      setError('Failed to load club details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const data = await apiRequest(`/clubs/${id}/announcements`);
      setAnnouncements(data.announcements);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!newAnnouncement.trim()) return;
    setAnnouncementLoading(true);
    try {
      await apiRequest(`/clubs/${id}/announcements`, 'POST', { content: newAnnouncement });
      setNewAnnouncement('');
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message || 'Failed to post announcement');
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleReact = async (announcementId: string, type: 'up' | 'down') => {
    try {
      await apiRequest(`/clubs/${id}/announcements/${announcementId}/react`, 'POST', { type });
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message || 'Failed to react');
    }
  };

  const handlePinAnnouncement = async (announcementId: string, isPinned: boolean) => {
    try {
      await apiRequest(`/clubs/${id}/announcements/${announcementId}/pin`, 'PUT', { is_pinned: isPinned });
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message || 'Failed to pin announcement');
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await apiRequest(`/clubs/${id}/announcements/${announcementId}`, 'DELETE');
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message || 'Failed to delete announcement');
    }
  };

  const handleSaveClub = async () => {
    setIsSaving(true);
    try {
      await apiRequest(`/clubs/${id}`, 'PUT', editForm);
      setIsEditOpen(false);
      fetchClubDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to update club');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAchievement = () => {
    if (newAchievement.trim()) {
      setEditForm({
        ...editForm,
        achievements: [...editForm.achievements, newAchievement.trim()]
      });
      setNewAchievement('');
    }
  };

  const handleRemoveAchievement = (index: number) => {
    const newAchievements = [...editForm.achievements];
    newAchievements.splice(index, 1);
    setEditForm({
      ...editForm,
      achievements: newAchievements
    });
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setError('');
    
    try {
      await apiRequest(`/clubs/${id}/invite-by-email`, 'POST', { email: inviteEmail });
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
      await apiRequest(`/clubs/${id}/members/${userId}`, 'DELETE');
      fetchClubDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Club not found</h2>
        <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  const currentUserMember = members.find(m => m.user_id === user.id);
  const canInvite = currentUserMember && ['owner', 'admin'].includes(currentUserMember.role);
  const isMember = currentUserMember && currentUserMember.role !== 'invited';

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 to-teal-600 text-white p-6 shadow-lg relative">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              className="text-white hover:bg-white/20 p-2 h-auto rounded-full"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {club.photo_url ? (
              <div className="w-16 h-16 rounded-full bg-white/20 overflow-hidden border-2 border-white/50 shrink-0">
                <img src={club.photo_url} alt={club.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/50 shrink-0">
                <Users className="w-8 h-8 text-white/80" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold leading-tight flex items-center gap-2">
                {club.name}
              </h1>
              <p className="text-emerald-100 text-sm mt-1">{club.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {currentUserMember?.role === 'owner' && (
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Club
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Edit Club Details</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Club Name</label>
                      <Input 
                        value={editForm.name} 
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea 
                        value={editForm.description} 
                        onChange={(e) => setEditForm({...editForm, description: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Photo URL</label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="https://example.com/photo.jpg"
                          value={editForm.photo_url} 
                          onChange={(e) => setEditForm({...editForm, photo_url: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Achievements</label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="e.g., 2025 City Champions"
                          value={newAchievement} 
                          onChange={(e) => setNewAchievement(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddAchievement()}
                        />
                        <Button type="button" onClick={handleAddAchievement} variant="secondary">
                          Add
                        </Button>
                      </div>
                      <div className="mt-2 space-y-2">
                        {editForm.achievements.map((achievement, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm border border-gray-100">
                            <span>{achievement}</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRemoveAchievement(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {editForm.achievements.length === 0 && (
                          <div className="text-sm text-gray-500 italic">No achievements added yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveClub} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <NotificationsPopover />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Members & Achievements */}
        <div className="lg:col-span-1 space-y-6">
          {club.achievements && club.achievements.length > 0 && (
            <Card className="border-none shadow-md bg-white">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Achievements
                </h2>
                <div className="space-y-3">
                  {club.achievements.map((achievement: string, index: number) => (
                    <div key={index} className="flex items-start gap-3 bg-yellow-50/50 p-3 rounded-lg border border-yellow-100">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                        <Star className="w-3 h-3 text-yellow-600 fill-yellow-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-800">{achievement}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-md bg-white">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
                <span>Members ({members.filter(m => m.role !== 'invited').length})</span>
              </h2>

              {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

              {canInvite && (
                <div className="mb-6 space-y-2 bg-gray-50 p-4 rounded-lg border">
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
                {members.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden">
                        {member.profiles?.avatar_url ? (
                          <img src={member.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          member.profiles?.display_name?.charAt(0) || <User className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {member.profiles?.display_name || 'Unknown Player'}
                          {member.user_id === user.id && ' (You)'}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {member.role === 'owner' && <Shield className="w-3 h-3 text-amber-500" />}
                          <span className="text-xs text-gray-500 capitalize">{member.role}</span>
                        </div>
                      </div>
                    </div>
                    
                    {canInvite && member.user_id !== user.id && member.role !== 'owner' && (
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
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Club Activity / Stats */}
        <div className="lg:col-span-2 space-y-6">
          {!isMember ? (
            <Card className="border-none shadow-md bg-white">
              <CardContent className="p-12 text-center text-gray-500">
                You must be a member of this club to view its activity.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-md bg-emerald-50/50">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-2 text-emerald-600 font-medium mb-2">
                      <Trophy className="w-5 h-5" /> Club Rank
                    </div>
                    <div className="text-5xl font-bold text-emerald-700 mb-1">Unranked</div>
                    <div className="text-sm text-gray-500">Play more matches to rank up</div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-blue-50/50">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-2 text-blue-600 font-medium mb-2">
                      <Calendar className="w-5 h-5" /> Active Since
                    </div>
                    <div className="text-3xl font-bold text-blue-700 mb-1">
                      {new Date(club.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    </div>
                    <div className="text-sm text-gray-500">Club Founded</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-md bg-white">
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-emerald-600" /> Announcements
                  </h2>
                  
                  {canInvite && (
                    <div className="mb-6 space-y-3">
                      <Textarea
                        placeholder="Post an announcement to the club..."
                        value={newAnnouncement}
                        onChange={(e) => setNewAnnouncement(e.target.value)}
                        className="bg-gray-50"
                        rows={3}
                      />
                      <div className="flex justify-end">
                        <Button 
                          onClick={handlePostAnnouncement}
                          disabled={announcementLoading || !newAnnouncement.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {announcementLoading ? 'Posting...' : 'Post Announcement'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {announcements.length === 0 ? (
                      <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed text-gray-500">
                        No announcements yet.
                      </div>
                    ) : (
                      announcements.map((announcement) => {
                        const upvotes = announcement.reactions?.filter((r: any) => r.type === 'up').length || 0;
                        const downvotes = announcement.reactions?.filter((r: any) => r.type === 'down').length || 0;
                        const userReaction = announcement.reactions?.find((r: any) => r.user_id === user.id)?.type;

                        return (
                          <div key={announcement.id} className={`bg-gray-50 rounded-lg p-4 border ${announcement.is_pinned ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'}`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden">
                                  {announcement.author?.avatar_url ? (
                                    <img src={announcement.author.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                  ) : (
                                    announcement.author?.display_name?.charAt(0) || <User className="w-4 h-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 text-sm flex items-center gap-2">
                                    {announcement.author?.display_name}
                                    {announcement.is_pinned && <Pin className="w-3 h-3 text-emerald-600 fill-emerald-600" />}
                                  </div>
                                  <div className="text-xs text-gray-500">{new Date(announcement.created_at).toLocaleString()}</div>
                                </div>
                              </div>
                              
                              {canInvite && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 w-8 p-0 ${announcement.is_pinned ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                    onClick={() => handlePinAnnouncement(announcement.id, !announcement.is_pinned)}
                                    title={announcement.is_pinned ? "Unpin announcement" : "Pin announcement"}
                                  >
                                    <Pin className={`w-4 h-4 ${announcement.is_pinned ? 'fill-emerald-600' : ''}`} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => handleDeleteAnnouncement(announcement.id)}
                                    title="Delete announcement"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <p className="text-gray-800 whitespace-pre-wrap mb-4 mt-2">{announcement.content}</p>
                            <div className="flex items-center gap-2 border-t pt-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`gap-1.5 h-8 px-2 ${userReaction === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                onClick={() => handleReact(announcement.id, 'up')}
                              >
                                <ThumbsUp className={`w-4 h-4 ${userReaction === 'up' ? 'fill-emerald-600' : ''}`} />
                                <span className="text-xs font-medium">{upvotes}</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`gap-1.5 h-8 px-2 ${userReaction === 'down' ? 'text-red-600 bg-red-50' : 'text-gray-500 hover:text-red-600 hover:bg-red-50'}`}
                                onClick={() => handleReact(announcement.id, 'down')}
                              >
                                <ThumbsDown className={`w-4 h-4 ${userReaction === 'down' ? 'fill-red-600' : ''}`} />
                                <span className="text-xs font-medium">{downvotes}</span>
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md bg-white">
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-500" /> Recent Club Activity
                  </h2>
                  <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed text-gray-500">
                    No recent activity to show.
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

      </main>
    </div>
  );
}
