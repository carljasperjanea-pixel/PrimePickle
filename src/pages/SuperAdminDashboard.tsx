import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, useUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Users, Activity, DollarSign, ShieldAlert,
  Settings, Database, AlertCircle, CheckCircle,
  LogOut, Eye, Lock, Ban, ActivitySquare,
  RefreshCw, Shield, Bell
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function SuperAdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('pulse');
  const navigate = useNavigate();

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else if (u.role !== 'super_admin') navigate('/dashboard');
      else setUser(u);
    });
  }, [navigate]);

  const handleLogout = () => {
    document.cookie = 'token=; Max-Age=0; path=/;';
    navigate('/login');
  };

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3 text-white border-b border-slate-800">
          <Shield className="w-8 h-8 text-emerald-500" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Super Admin</h1>
            <p className="text-xs text-slate-400">System Control</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<ActivitySquare />} label="The Pulse" active={activeTab === 'pulse'} onClick={() => setActiveTab('pulse')} />
          <NavItem icon={<Users />} label="User Management" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          <NavItem icon={<ShieldAlert />} label="Moderation Queue" active={activeTab === 'moderation'} onClick={() => setActiveTab('moderation')} />
          <NavItem icon={<Database />} label="Audit Logs" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} />
          <NavItem icon={<Settings />} label="System Config" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
        </nav>
        <div className="p-4 border-t border-slate-800">
          <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800" onClick={handleLogout}>
            <LogOut className="w-5 h-5 mr-3" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {activeTab === 'pulse' && <PulseTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'moderation' && <ModerationTab />}
        {activeTab === 'audit' && <AuditTab />}
        {activeTab === 'config' && <ConfigTab />}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
        active ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Tabs ---

function PulseTab() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiRequest('/superadmin/analytics').then(setData).catch(console.error);
  }, []);

  if (!data) return <div>Loading analytics...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-2xl font-bold text-slate-900">System Pulse</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Total Users" value={data.totalUsers} icon={<Users className="w-6 h-6 text-blue-500" />} />
        <KpiCard title="Active Sessions" value={data.activeSessions} icon={<Activity className="w-6 h-6 text-emerald-500" />} />
        <KpiCard title="Revenue" value={`$${data.revenue}`} icon={<DollarSign className="w-6 h-6 text-amber-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health */}
        <Card className="lg:col-span-1 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-slate-500" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <HealthMetric label="Server Uptime" value={`${data.systemHealth.uptime}%`} status="green" />
            <HealthMetric label="API Response" value={`${data.systemHealth.apiResponseTime}ms`} status="green" />
            <HealthMetric label="Error Rate" value={`${data.systemHealth.errorRate}%`} status="yellow" />
          </CardContent>
        </Card>

        {/* Growth Chart */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Growth Visualization</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs">7D</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-100">30D</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">90D</Button>
            </div>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.growth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="signups" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await apiRequest('/superadmin/users');
      setUsers(res.users);
    } catch (e) {
      console.error(e);
    }
  };

  const handleImpersonate = async (id: string) => {
    try {
      await apiRequest(`/superadmin/impersonate/${id}`, 'POST');
      window.location.href = '/dashboard';
    } catch (e) {
      alert('Failed to impersonate');
    }
  };

  const handleForceReset = async (id: string) => {
    if (!confirm('Force password reset for this user?')) return;
    try {
      // Mocked endpoint
      alert('Password reset email sent (mocked)');
    } catch (e) {
      alert('Failed to force reset');
    }
  };

  const handleToggleMFA = async (id: string) => {
    if (!confirm('Toggle MFA for this user?')) return;
    try {
      // Mocked endpoint
      alert('MFA toggled (mocked)');
    } catch (e) {
      alert('Failed to toggle MFA');
    }
  };

  const handleBan = async (id: string) => {
    if (!confirm('Are you sure you want to suspend/ban this user?')) return;
    try {
      await apiRequest(`/superadmin/users/${id}/ban`, 'POST');
      fetchUsers();
    } catch (e) {
      alert('Failed to ban user');
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase()) || 
    (u.display_name && u.display_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">User Directory</h2>
        <input 
          type="text" 
          placeholder="Search users..." 
          className="px-4 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Joined</th>
                <th className="px-6 py-4 font-medium text-right">Actions & Security Toolbar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{u.display_name || 'Unknown'}</div>
                    <div className="text-slate-500 text-xs">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                      u.role === 'banned' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => handleImpersonate(u.id)}>
                      <Eye className="w-3 h-3" /> Impersonate
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 text-slate-600 hover:text-slate-700 hover:bg-slate-100" onClick={() => handleForceReset(u.id)}>
                      <RefreshCw className="w-3 h-3" /> Reset Pwd
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 text-slate-600 hover:text-slate-700 hover:bg-slate-100" onClick={() => handleToggleMFA(u.id)}>
                      <Lock className="w-3 h-3" /> Toggle MFA
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleBan(u.id)}>
                      <Ban className="w-3 h-3" /> Suspend
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ModerationTab() {
  const [reports, setReports] = useState<any[]>([
    { id: '1', type: 'Inappropriate Content', target: 'User A', status: 'Pending', date: '2023-10-08T10:00:00Z' },
    { id: '2', type: 'Harassment', target: 'User B', status: 'Pending', date: '2023-10-08T11:30:00Z' },
  ]);

  const handleAction = (id: string, action: 'approve' | 'reject') => {
    setReports(reports.filter(r => r.id !== id));
    alert(`Report ${id} ${action}ed (mocked)`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-2xl font-bold text-slate-900">Moderation Queue</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Target</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map(report => (
                <tr key={report.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-500">{new Date(report.date).toLocaleString()}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{report.type}</td>
                  <td className="px-6 py-4 text-slate-500">{report.target}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleAction(report.id, 'approve')}>
                      Approve
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleAction(report.id, 'reject')}>
                      Reject
                    </Button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No pending reports</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    apiRequest('/superadmin/audit-logs').then(res => setLogs(res.logs)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-2xl font-bold text-slate-900">Global Audit Log</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Timestamp</th>
                <th className="px-6 py-4 font-medium">Admin</th>
                <th className="px-6 py-4 font-medium">Action</th>
                <th className="px-6 py-4 font-medium">Target ID</th>
                <th className="px-6 py-4 font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-6 py-3 text-slate-900">{log.profiles?.email || log.admin_id}</td>
                  <td className="px-6 py-3 font-semibold text-slate-700">{log.action_performed}</td>
                  <td className="px-6 py-3 text-slate-500">{log.target_id || '-'}</td>
                  <td className="px-6 py-3 text-slate-500">{log.ip_address || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-sans text-sm">No audit logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConfigTab() {
  const [flags, setFlags] = useState<any[]>([]);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      const res = await apiRequest('/superadmin/feature-flags');
      setFlags(res.flags);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFlag = async (key: string, current: boolean) => {
    try {
      await apiRequest(`/superadmin/feature-flags/${key}`, 'PUT', { is_enabled: !current });
      fetchFlags();
    } catch (e) {
      alert('Failed to update flag');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-2xl font-bold text-slate-900">System Configuration</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Flags */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Feature Flags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {flags.map(flag => (
              <div key={flag.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50">
                <div>
                  <Label className="text-base font-semibold text-slate-900">{flag.key}</Label>
                  <p className="text-sm text-slate-500 mt-1">{flag.description}</p>
                </div>
                <Switch 
                  checked={flag.is_enabled} 
                  onCheckedChange={() => toggleFlag(flag.key, flag.is_enabled)} 
                />
              </div>
            ))}
            {flags.length === 0 && <div className="text-sm text-slate-500">No feature flags configured.</div>}
          </CardContent>
        </Card>

        {/* Communication Center */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5" /> Communication Center
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Broadcast Message</Label>
              <textarea 
                className="w-full min-h-[100px] p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter message to broadcast to all users..."
              ></textarea>
            </div>
            <div className="flex gap-3">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Send Push</Button>
              <Button variant="outline">Set In-App Banner</Button>
            </div>
          </CardContent>
        </Card>

        {/* RBAC Permissions */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5" /> RBAC Permissions (Mock)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium">Permission</th>
                    <th className="px-6 py-4 font-medium text-center">Super Admin</th>
                    <th className="px-6 py-4 font-medium text-center">Admin</th>
                    <th className="px-6 py-4 font-medium text-center">Moderator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">Manage Users</td>
                    <td className="px-6 py-4 text-center"><Switch checked={true} disabled /></td>
                    <td className="px-6 py-4 text-center"><Switch checked={false} /></td>
                    <td className="px-6 py-4 text-center"><Switch checked={false} /></td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">Manage Lobbies</td>
                    <td className="px-6 py-4 text-center"><Switch checked={true} disabled /></td>
                    <td className="px-6 py-4 text-center"><Switch checked={true} /></td>
                    <td className="px-6 py-4 text-center"><Switch checked={false} /></td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">System Config</td>
                    <td className="px-6 py-4 text-center"><Switch checked={true} disabled /></td>
                    <td className="px-6 py-4 text-center"><Switch checked={false} /></td>
                    <td className="px-6 py-4 text-center"><Switch checked={false} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Helpers ---

function KpiCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthMetric({ label, value, status }: { label: string, value: string, status: 'green' | 'yellow' | 'red' }) {
  const statusColors = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500'
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`}></div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}
