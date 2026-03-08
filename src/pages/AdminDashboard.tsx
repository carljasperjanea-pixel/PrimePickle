import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  ShieldAlert, 
  Settings, 
  LogOut, 
  Search, 
  Bell, 
  Menu,
  Activity,
  Server,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Lock,
  Eye,
  Ban,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest, useUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// --- Types ---
type Tab = 'overview' | 'users' | 'moderation' | 'settings';

// --- Mock Data for Analytics ---
const growthData = [
  { name: 'Mon', users: 400, active: 240 },
  { name: 'Tue', users: 300, active: 139 },
  { name: 'Wed', users: 200, active: 980 },
  { name: 'Thu', users: 278, active: 390 },
  { name: 'Fri', users: 189, active: 480 },
  { name: 'Sat', users: 239, active: 380 },
  { name: 'Sun', users: 349, active: 430 },
];

const auditLogs = [
  { id: 1, admin: 'Admin User', action: 'Banned User', target: 'spammer_123', time: '2 mins ago' },
  { id: 2, admin: 'Moderator', action: 'Resolved Report', target: 'Report #442', time: '15 mins ago' },
  { id: 3, admin: 'System', action: 'Backup Completed', target: 'Database', time: '1 hour ago' },
  { id: 4, admin: 'Admin User', action: 'Updated Settings', target: 'Feature Flags', time: '3 hours ago' },
];

const reports = [
  { id: 101, user: 'toxic_player_99', reason: 'Harassment', status: 'pending', time: '10 mins ago' },
  { id: 102, user: 'bot_account_x', reason: 'Spam', status: 'pending', time: '32 mins ago' },
  { id: 103, user: 'griefer_007', reason: 'Game Throwing', status: 'reviewed', time: '2 hours ago' },
];

// --- Main Component ---
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else if (u.role !== 'admin') navigate('/dashboard');
      else setUser(u);
    });
  }, []);

  const handleGlobalSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Redirect to User Management with search query
      setActiveTab('users');
      // We'll need to pass this search term down, but for now let's just switch tabs
      // A better implementation would be to use a URL query param or context
      console.log('Searching for:', globalSearch);
    }
  };

  const handleNotificationClick = () => {
    alert('No new notifications');
  };

  if (!user) return <div className="flex h-screen items-center justify-center">Loading Admin Panel...</div>;

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-slate-900 text-white transition-all duration-300 ease-in-out flex flex-col ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          {isSidebarOpen && (
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <ShieldAlert className="text-emerald-500" />
              <span>Admin<span className="text-emerald-500">Panel</span></span>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Menu size={20} />
          </Button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Overview" 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
            collapsed={!isSidebarOpen}
          />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="User Management" 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')}
            collapsed={!isSidebarOpen}
          />
          <SidebarItem 
            icon={<ShieldAlert size={20} />} 
            label="Moderation" 
            active={activeTab === 'moderation'} 
            onClick={() => setActiveTab('moderation')}
            collapsed={!isSidebarOpen}
            badge={reports.filter(r => r.status === 'pending').length}
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            collapsed={!isSidebarOpen}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className={`flex items-center gap-3 ${!isSidebarOpen && 'justify-center'}`}>
            <Avatar className="h-9 w-9 border-2 border-emerald-500">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback>{user.display_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {isSidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{user.display_name}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            )}
            {isSidebarOpen && (
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400" onClick={() => navigate('/login')}>
                <LogOut size={18} />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-800">
              {activeTab === 'overview' && 'Dashboard Overview'}
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'moderation' && 'Moderation Queue'}
              {activeTab === 'settings' && 'System Settings'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Global Search..." 
                className="pl-9 w-64 bg-gray-50 border-gray-200 focus:bg-white transition-all" 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={handleGlobalSearch}
              />
            </div>
            <Button variant="ghost" size="icon" className="relative text-gray-500" onClick={handleNotificationClick}>
              <Bell size={20} />
              <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <div className="max-w-7xl mx-auto space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'overview' && <OverviewTab />}
                {activeTab === 'users' && <UserManagementTab />}
                {activeTab === 'moderation' && <ModerationTab />}
                {activeTab === 'settings' && <SettingsTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Sub-Components ---

function SidebarItem({ icon, label, active, onClick, collapsed, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
        active 
          ? 'bg-emerald-500/10 text-emerald-400 font-medium' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      } ${collapsed ? 'justify-center' : ''}`}
    >
      <span className={`${active ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white'}`}>
        {icon}
      </span>
      {!collapsed && <span>{label}</span>}
      {active && !collapsed && (
        <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
      )}
      {badge > 0 && !collapsed && (
        <span className="absolute right-8 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

// --- Phase 1: The Pulse (Overview) ---
function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiRequest('/admin/stats');
        setStats(data);
      } catch (e) {
        console.error('Failed to fetch stats:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading analytics...</div>;
  if (!stats) return <div className="p-8 text-center text-red-500">Failed to load analytics.</div>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Total Users" 
          value={stats.totalUsers} 
          change="+12%" 
          trend="up" 
          icon={<Users className="text-blue-500" />} 
        />
        <KPICard 
          title="Active Sessions" 
          value={stats.activeSessions} 
          change="+5%" 
          trend="up" 
          icon={<Activity className="text-emerald-500" />} 
        />
        <KPICard 
          title="Revenue (MoM)" 
          value={`$${stats.revenue}`} 
          change="+8.2%" 
          trend="up" 
          icon={<TrendingUp className="text-purple-500" />} 
        />
        <KPICard 
          title="Server Health" 
          value={stats.serverHealth.status === 'operational' ? '99.9%' : 'Degraded'} 
          change="Stable" 
          trend="neutral" 
          icon={<Server className="text-orange-500" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Graph */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Growth Visualization</CardTitle>
            <CardDescription>User sign-ups and active sessions over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  cursor={{ stroke: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="users" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
                <Area type="monotone" dataKey="active" stroke="#3b82f6" strokeWidth={2} fillOpacity={0} fill="transparent" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Health Monitor */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Real-time server metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">CPU Usage</span>
                <span className="font-medium text-gray-900">{stats.serverHealth.cpu}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.serverHealth.cpu}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Memory</span>
                <span className="font-medium text-gray-900">{stats.serverHealth.memory}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.serverHealth.memory}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">API Latency</span>
                <span className="font-medium text-gray-900">{stats.serverHealth.latency}ms</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[20%] rounded-full"></div>
              </div>
            </div>
            <div className="pt-4 border-t">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-700">All Systems Operational</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ title, value, change, trend, icon }: any) {
  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
          <Badge variant={trend === 'up' ? 'default' : 'secondary'} className={trend === 'up' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700'}>
            {change}
          </Badge>
        </div>
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Phase 2: User & Access Management ---
function UserManagementTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiRequest('/admin/users');
      setUsers(data.users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (userId: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      const res = await apiRequest(`/admin/users/${userId}/${action}`, 'POST');
      if (res.token) {
        // Handle impersonation
        alert(`Impersonation token received: ${res.token.slice(0, 10)}... (In a real app, this would log you in as the user)`);
      } else {
        alert(res.message);
      }
      fetchUsers(); // Refresh list
    } catch (e: any) {
      alert(`Action failed: ${e.message}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search users..." 
            className="pl-9" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Users className="mr-2 h-4 w-4" /> Add User
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
              <tr>
                <th className="p-4 pl-6">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">MMR</th>
                <th className="p-4 text-right">Joined</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center">Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No users found.</td></tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{u.display_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-gray-900">{u.display_name}</div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary" className="bg-green-50 text-green-700">Active</Badge>
                    </td>
                    <td className="p-4 text-right font-mono text-gray-600">{u.mmr}</td>
                    <td className="p-4 text-right text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-gray-500 hover:text-blue-600" 
                          title="Impersonate"
                          onClick={() => handleAction(u.id, 'impersonate')}
                        >
                          <Eye size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-gray-500 hover:text-orange-600" 
                          title="Reset Password"
                          onClick={() => handleAction(u.id, 'reset-password')}
                        >
                          <Lock size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-gray-500 hover:text-red-600" 
                          title="Ban User"
                          onClick={() => handleAction(u.id, 'ban')}
                        >
                          <Ban size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// --- Phase 3: Content & Moderation Tools ---
function ModerationTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [logsData, reportsData] = await Promise.all([
          apiRequest('/admin/audit-logs'),
          apiRequest('/admin/reports')
        ]);
        setLogs(logsData.logs);
        setReports(reportsData.reports);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleReportAction = async (id: number, action: string) => {
    if (!confirm(`Are you sure you want to ${action} this report?`)) return;
    try {
      const res = await apiRequest(`/admin/reports/${id}/${action}`, 'POST');
      alert(res.message);
      // Optimistically update UI
      setReports(reports.filter(r => r.id !== id));
    } catch (e: any) {
      alert(`Action failed: ${e.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Moderation Queue</CardTitle>
            <CardDescription>Review flagged content and reported users</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading reports...</div>
              ) : reports.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No pending reports.</div>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 p-2 rounded-full ${
                        report.status === 'pending' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">Report #{report.id}</span>
                          <Badge variant="outline" className="text-xs">{report.reason}</Badge>
                        </div>
                        <p className="text-sm text-gray-500">Reported User: <span className="font-medium text-gray-700">{report.user}</span></p>
                        <p className="text-xs text-gray-400 mt-1">{report.time}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-green-600 hover:bg-green-50 border-green-200"
                        onClick={() => handleReportAction(report.id, 'approve')}
                      >
                        <CheckCircle size={14} className="mr-1" /> Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:bg-red-50 border-red-200"
                        onClick={() => handleReportAction(report.id, 'ban')}
                      >
                        <XCircle size={14} className="mr-1" /> Ban
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-sm bg-slate-900 text-white">
          <CardHeader>
            <CardTitle className="text-white">Global Audit Log</CardTitle>
            <CardDescription className="text-slate-400">Recent administrative actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center text-slate-500">Loading logs...</div>
            ) : logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="mt-1 min-w-[4px] h-4 rounded-full bg-slate-700"></div>
                <div>
                  <p className="text-slate-300">
                    <span className="font-semibold text-white">{log.admin}</span> {log.action}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{log.target} • {log.time}</p>
                </div>
              </div>
            ))}
            <Button variant="link" className="text-emerald-400 p-0 h-auto text-xs mt-2">View Full Log</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Phase 4: System Configuration ---
function SettingsTab() {
  const [broadcastType, setBroadcastType] = useState('in-app');
  const [broadcastAudience, setBroadcastAudience] = useState('All Users');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const handleMaintenanceToggle = async (checked: boolean) => {
    if (checked && !confirm('Are you sure you want to enable Maintenance Mode? This will block all users.')) return;
    try {
      const res = await apiRequest('/admin/maintenance', 'POST', { enabled: checked });
      setMaintenanceMode(checked);
      alert(res.message);
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    }
  };

  const handleFlushCache = async () => {
    if (!confirm('Are you sure you want to flush the system cache?')) return;
    try {
      const res = await apiRequest('/admin/cache/flush', 'POST');
      alert(res.message);
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastContent) return alert('Please enter a message');
    try {
      const res = await apiRequest('/admin/broadcast', 'POST', {
        type: broadcastType,
        audience: broadcastAudience,
        content: broadcastContent
      });
      alert(res.message);
      setBroadcastContent('');
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Feature Flags */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Feature Flags</CardTitle>
            <CardDescription>Toggle system features dynamically</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium text-gray-900">New Matchmaking Algorithm</div>
                <div className="text-sm text-gray-500">Enable v2.0 matchmaking logic</div>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium text-gray-900">Public Profiles</div>
                <div className="text-sm text-gray-500">Allow users to view public profiles</div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium text-gray-900">Beta Features</div>
                <div className="text-sm text-gray-500">Enable experimental features for beta testers</div>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Mode */}
        <Card className="border-red-100 bg-red-50/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-red-900">Danger Zone</CardTitle>
            <CardDescription className="text-red-700">Critical system controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-100">
              <div className="space-y-0.5">
                <div className="font-medium text-red-900 flex items-center gap-2">
                  <AlertTriangle size={16} /> Maintenance Mode
                </div>
                <div className="text-sm text-red-600">Disable access for all non-admin users</div>
              </div>
              <Switch 
                className="data-[state=checked]:bg-red-600" 
                checked={maintenanceMode}
                onCheckedChange={handleMaintenanceToggle}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-100">
              <div className="space-y-0.5">
                <div className="font-medium text-red-900">Flush Cache</div>
                <div className="text-sm text-red-600">Clear all server-side caches immediately</div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleFlushCache}
              >
                Execute
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Communication Center */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Communication Center</CardTitle>
          <CardDescription>Broadcast messages to all users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Message Type</label>
                <div className="flex gap-2">
                  <Button 
                    variant={broadcastType === 'in-app' ? 'outline' : 'ghost'} 
                    className={`flex-1 ${broadcastType === 'in-app' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}`}
                    onClick={() => setBroadcastType('in-app')}
                  >
                    In-App Banner
                  </Button>
                  <Button 
                    variant={broadcastType === 'push' ? 'outline' : 'ghost'} 
                    className={`flex-1 ${broadcastType === 'push' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}`}
                    onClick={() => setBroadcastType('push')}
                  >
                    Push Notification
                  </Button>
                  <Button 
                    variant={broadcastType === 'email' ? 'outline' : 'ghost'} 
                    className={`flex-1 ${broadcastType === 'email' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}`}
                    onClick={() => setBroadcastType('email')}
                  >
                    Email Blast
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Target Audience</label>
                <select 
                  className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={broadcastAudience}
                  onChange={(e) => setBroadcastAudience(e.target.value)}
                >
                  <option>All Users</option>
                  <option>Active in last 7 days</option>
                  <option>Premium Users</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Message Content</label>
              <textarea 
                className="w-full min-h-[100px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter your broadcast message here..."
                value={broadcastContent}
                onChange={(e) => setBroadcastContent(e.target.value)}
              ></textarea>
            </div>
            <div className="flex justify-end">
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleBroadcast}
              >
                <MessageSquare className="mr-2 h-4 w-4" /> Send Broadcast
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

