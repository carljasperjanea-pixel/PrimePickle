import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest, useUser } from '@/lib/api';
import { Users, ShieldAlert, LogOut, Trash2, Shield, User as UserIcon, MessageSquare, Pencil, KeyRound, Ban, ShieldCheck, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationsPopover } from '@/components/NotificationsPopover';
import { SendNotificationDialog } from '@/components/SendNotificationDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function SuperAdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else if (u.role !== 'super_admin') navigate('/dashboard');
      else {
        setUser(u);
        fetchUsers();
        fetchMaintenanceMode();
        fetchLogs();
      }
    });
  }, []);

  const fetchMaintenanceMode = async () => {
    try {
      const data = await apiRequest('/system/maintenance');
      setIsMaintenanceMode(data.isMaintenanceMode);
    } catch (e) {
      console.error('Failed to fetch maintenance mode:', e);
    }
  };

  const toggleMaintenanceMode = async (enabled: boolean) => {
    if (enabled) {
      if (!confirm('Are you sure you want to enable Maintenance Mode? All non-admin users will be redirected to a maintenance page.')) return;
    }
    
    try {
      const data = await apiRequest('/super-admin/maintenance', 'POST', { enabled });
      setIsMaintenanceMode(data.isMaintenanceMode);
    } catch (e: any) {
      alert(`Failed to toggle maintenance mode: ${e.message}`);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiRequest('/super-admin/users');
      setUsers(data.users);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await apiRequest('/super-admin/activity-logs');
      setLogs(data.logs || []);
    } catch (e) {
      console.error('Failed to fetch logs:', e);
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

  const handleAction = async (userId: string, action: 'reset-password' | 'toggle-mfa' | 'toggle-suspend') => {
    try {
      if (action === 'reset-password') {
        if (!confirm('Are you sure you want to force a password reset for this user?')) return;
      } else if (action === 'toggle-suspend') {
        if (!confirm('Are you sure you want to toggle the suspension status for this user?')) return;
      }

      await apiRequest(`/admin/users/${userId}/${action}`, 'POST');
      fetchUsers();
    } catch (e) {
      console.error(`Failed to ${action}:`, e);
      alert(`Failed to perform action: ${(e as any).message}`);
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
            <AdminProfileEditor user={user} onUpdate={setUser} />
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

        {/* System Controls */}
        <Card className="border shadow-sm border-amber-200">
          <div className="p-5 border-b bg-amber-50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-amber-900">System Controls</h3>
                <p className="text-sm text-amber-700">Global platform settings and kill-switches.</p>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
              <div>
                <h4 className="font-semibold text-gray-900">Maintenance Mode</h4>
                <p className="text-sm text-gray-500 mt-1">
                  When enabled, all regular players will be redirected to a maintenance page. 
                  Admins and Super Admins will retain full access.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${isMaintenanceMode ? 'text-amber-600' : 'text-gray-500'}`}>
                  {isMaintenanceMode ? 'Active' : 'Disabled'}
                </span>
                <Switch 
                  checked={isMaintenanceMode}
                  onCheckedChange={toggleMaintenanceMode}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Logs */}
        <Card className="border shadow-sm">
          <div className="p-5 border-b bg-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Activity className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">Admin Activity Log</h3>
                <p className="text-sm text-gray-500">Track actions performed by Admins and Super Admins.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs}>Refresh Logs</Button>
          </div>
          <div className="p-0 max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Admin</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Target ID</th>
                  <th className="px-6 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No activity logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-900">
                        {log.admin?.display_name || log.admin?.email || 'Unknown'}
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          {log.admin?.role}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-medium text-slate-700">{log.action_performed}</span>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="text-xs text-slate-400 mt-1 font-mono truncate max-w-[200px]">
                            {JSON.stringify(log.details)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-400">
                        {log.target_id || '-'}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-400">
                        {log.ip_address || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

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
                      <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                        {u.display_name || u.full_name || 'Unnamed'}
                        {u.is_suspended && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">BANNED</span>}
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
                          <div className="flex items-center justify-end gap-2">
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
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                              title="Force Password Reset"
                              onClick={() => handleAction(u.id, 'reset-password')}
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className={`h-8 w-8 p-0 ${u.mfa_enabled ? 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
                              title={u.mfa_enabled ? "Disable MFA" : "Enable MFA"}
                              onClick={() => handleAction(u.id, 'toggle-mfa')}
                            >
                              {u.mfa_enabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className={`h-8 w-8 p-0 ${u.is_suspended ? 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100' : 'text-gray-500 hover:text-rose-600 hover:bg-rose-50'}`}
                              title={u.is_suspended ? "Unban User" : "Suspend/Ban User"}
                              onClick={() => handleAction(u.id, 'toggle-suspend')}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 h-8"
                              onClick={() => handleDeleteUser(u.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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

function AdminProfileEditor({ user, onUpdate }: { user: any, onUpdate: (u: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiRequest('/user/profile', 'PUT', { display_name: displayName });
      onUpdate(res.user);
      setIsOpen(false);
    } catch (e: any) {
      alert('Failed to update profile: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-white hover:bg-white/20 gap-2 px-3">
          <span className="font-medium">{user?.display_name || 'Super Admin'}</span>
          <Pencil className="w-3 h-3 opacity-70" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
              placeholder="Enter your display name"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
