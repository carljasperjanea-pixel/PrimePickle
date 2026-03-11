import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest, useUser } from '@/lib/api';
import { Users, ShieldAlert, LogOut, Trash2, Shield, User as UserIcon, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationsPopover } from '@/components/NotificationsPopover';
import { SendNotificationDialog } from '@/components/SendNotificationDialog';

export default function SuperAdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else if (u.role !== 'super_admin') navigate('/dashboard');
      else {
        setUser(u);
        fetchUsers();
      }
    });
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiRequest('/super-admin/users');
      setUsers(data.users);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Change user role to ${newRole}?`)) return;
    try {
      await apiRequest(`/super-admin/users/${userId}/role`, 'PUT', { role: newRole });
      fetchUsers();
    } catch (e: any) {
      alert(`Failed to update role: ${e.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await apiRequest(`/super-admin/users/${userId}`, 'DELETE');
      fetchUsers();
    } catch (e: any) {
      alert(`Failed to delete user: ${e.message}`);
    }
  };

  const handleLogout = () => {
    document.cookie = 'token=; Max-Age=0; path=/;';
    navigate('/login');
  };

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  const adminsCount = users.filter(u => u.role === 'admin').length;
  const playersCount = users.filter(u => u.role === 'player').length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-700 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-400" />
            <div>
              <h1 className="text-2xl font-bold leading-tight">Super Admin Dashboard</h1>
              <p className="text-slate-300 text-sm opacity-90">System & User Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              className="text-white hover:bg-white/20 p-2 h-auto rounded-full"
              onClick={() => navigate('/messages')}
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
            <NotificationsPopover />
            <Button 
              variant="secondary" 
              className="bg-white/20 text-white hover:bg-white/30 border-none shadow-sm"
              onClick={() => navigate('/admin')}
            >
              Admin Dashboard
            </Button>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard 
            icon={<Users className="w-6 h-6 text-blue-600" />} 
            bg="bg-blue-100" 
            value={users.length} 
            label="Total Users" 
          />
          <StatsCard 
            icon={<Shield className="w-6 h-6 text-emerald-600" />} 
            bg="bg-emerald-100" 
            value={adminsCount} 
            label="Admins" 
          />
          <StatsCard 
            icon={<UserIcon className="w-6 h-6 text-purple-600" />} 
            bg="bg-purple-100" 
            value={playersCount} 
            label="Players" 
          />
        </div>

        {/* Users List */}
        <Card className="border shadow-sm">
          <div className="p-5 border-b bg-white flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg text-gray-900">User Accounts</h3>
              <p className="text-sm text-gray-500">Manage roles and access across the platform.</p>
            </div>
            <SendNotificationDialog userRole={user.role} />
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Joined</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {u.display_name || u.full_name || 'Unnamed'}
                      </td>
                      <td className="px-6 py-4">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'super_admin' ? 'bg-rose-100 text-rose-800' :
                          u.role === 'admin' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {u.id !== user.id && (
                          <>
                            <select 
                              className="text-xs border rounded p-1 bg-gray-50 text-gray-700"
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            >
                              <option value="player">Player</option>
                              <option value="admin">Admin</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2"
                              onClick={() => handleDeleteUser(u.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </main>
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
