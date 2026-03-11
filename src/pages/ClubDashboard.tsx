import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, useUser } from '@/lib/api';
import { Users, UserPlus, Shield, User, X, ArrowLeft, Trophy, Calendar, Megaphone, ThumbsUp, ThumbsDown, Pin, Trash2, Image as ImageIcon, Star } from 'lucide-react';
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
  const [achievements, setAchievements] = useState<any[]>([]);
  const [newAchievementTitle, setNewAchievementTitle] = useState('');
  const [newAchievementDesc, setNewAchievementDesc] = useState('');
  const [achievementLoading, setAchievementLoading] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);

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
      fetchAnnouncements();
      fetchAchievements();
      fetchPhotos();
    } catch (err: any) {
      console.error('Failed to fetch club details:', err);
      setError('Failed to load club details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAchievements = async () => {
    try {
      const data = await apiRequest(`/clubs/${id}/achievements`);
      setAchievements(data.achievements || []);
    } catch (err) {
      console.error('Failed to fetch achievements:', err);
    }
  };

  const fetchPhotos = async () => {
    try {
      const data = await apiRequest(`/clubs/${id}/photos`);
      setPhotos(data.photos || []);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
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

  const handleAddAchievement = async () => {
    if (!newAchievementTitle.trim()) return;
    setAchievementLoading(true);
    try {
      await apiRequest(`/clubs/${id}/achievements`, 'POST', { 
        title: newAchievementTitle,
        description: newAchievementDesc
      });
      setNewAchievementTitle('');
      setNewAchievementDesc('');
      fetchAchievements();
    } catch (err: any) {
      alert(err.message || 'Failed to add achievement');
    } finally {
      setAchievementLoading(false);
    }
  };

  const handleDeleteAchievement = async (achievementId: string) => {
    if (!confirm('Are you sure you want to delete this achievement?')) return;
    try {
      await apiRequest(`/clubs/${id}/achievements/${achievementId}`, 'DELETE');
      fetchAchievements();
    } catch (err: any) {
      alert(err.message || 'Failed to delete achievement');
    }
  };

  const handleAddPhoto = async () => {
    if (!newPhotoUrl.trim()) return;
    setPhotoLoading(true);
    try {
      await apiRequest(`/clubs/${id}/photos`, 'POST', { 
        url: newPhotoUrl,
        caption: newPhotoCaption
      });
      setNewPhotoUrl('');
      setNewPhotoCaption('');
      fetchPhotos();
    } catch (err: any) {
      alert(err.message || 'Failed to add photo');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    try {
      await apiRequest(`/clubs/${id}/photos/${photoId}`, 'DELETE');
      fetchPhotos();
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo');
    }
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
      <header className="bg-gradient-to-r from-emerald-700 to-teal-600 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              className="text-white hover:bg-white/20 p-2 h-auto rounded-full"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold leading-tight flex items-center gap-2">
                <Users className="w-6 h-6" /> {club.name}
              </h1>
              <p className="text-emerald-100 text-sm mt-1">{club.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <NotificationsPopover />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Members */}
        <div className="lg:col-span-1 space-y-6">
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
                    <Star className="w-5 h-5 text-amber-500" /> Achievements Showcase
                  </h2>

                  {canInvite && (
                    <div className="mb-6 space-y-3 bg-gray-50 p-4 rounded-lg border">
                      <Input
                        placeholder="Achievement Title (e.g., Summer Tournament Winners)"
                        value={newAchievementTitle}
                        onChange={(e) => setNewAchievementTitle(e.target.value)}
                        className="bg-white"
                      />
                      <Textarea
                        placeholder="Description (optional)"
                        value={newAchievementDesc}
                        onChange={(e) => setNewAchievementDesc(e.target.value)}
                        className="bg-white"
                        rows={2}
                      />
                      <div className="flex justify-end">
                        <Button 
                          onClick={handleAddAchievement}
                          disabled={achievementLoading || !newAchievementTitle.trim()}
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                        >
                          {achievementLoading ? 'Adding...' : 'Add Achievement'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {achievements.length === 0 ? (
                      <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed text-gray-500">
                        No achievements yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {achievements.map((achievement) => (
                          <div key={achievement.id} className="bg-amber-50/50 rounded-lg p-4 border border-amber-100 relative group">
                            {canInvite && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-2 right-2 h-8 w-8 p-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteAchievement(achievement.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                            <div className="flex items-center gap-2 mb-2">
                              <Trophy className="w-5 h-5 text-amber-500" />
                              <h3 className="font-bold text-gray-900">{achievement.title}</h3>
                            </div>
                            {achievement.description && (
                              <p className="text-sm text-gray-700 mb-2">{achievement.description}</p>
                            )}
                            <div className="text-xs text-gray-500">
                              {new Date(achievement.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md bg-white">
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-blue-500" /> Club Photo Album
                  </h2>

                  {canInvite && (
                    <div className="mb-6 space-y-3 bg-gray-50 p-4 rounded-lg border">
                      <Input
                        placeholder="Photo URL (e.g., https://example.com/photo.jpg)"
                        value={newPhotoUrl}
                        onChange={(e) => setNewPhotoUrl(e.target.value)}
                        className="bg-white"
                      />
                      <Input
                        placeholder="Caption (optional)"
                        value={newPhotoCaption}
                        onChange={(e) => setNewPhotoCaption(e.target.value)}
                        className="bg-white"
                      />
                      <div className="flex justify-end">
                        <Button 
                          onClick={handleAddPhoto}
                          disabled={photoLoading || !newPhotoUrl.trim()}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {photoLoading ? 'Uploading...' : 'Add Photo'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {photos.length === 0 ? (
                      <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed text-gray-500">
                        No photos yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {photos.map((photo) => (
                          <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square">
                            <img 
                              src={photo.url} 
                              alt={photo.caption || 'Club photo'} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/club/400/400';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                              {photo.caption && (
                                <p className="text-white text-sm font-medium truncate">{photo.caption}</p>
                              )}
                              <p className="text-white/80 text-xs">
                                By {photo.uploader?.display_name || 'Unknown'}
                              </p>
                            </div>
                            {canInvite && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-2 right-2 h-8 w-8 p-0 text-white bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:bg-black/70"
                                onClick={() => handleDeletePhoto(photo.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
