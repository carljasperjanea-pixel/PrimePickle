import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { ShieldAlert } from 'lucide-react';

export default function MaintenanceWrapper({ children, bypassRoles = [] }: { children: React.ReactNode, bypassRoles?: string[] }) {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // We need a public endpoint to check feature flags
        const res = await fetch('/api/public/feature-flags');
        if (res.ok) {
          const data = await res.json();
          const maintenanceFlag = data.flags.find((f: any) => f.key === 'maintenance_mode');
          if (maintenanceFlag && maintenanceFlag.is_enabled) {
            setIsMaintenance(true);
          }
        }
        
        // Check user role if logged in
        const userRes = await fetch('/api/user', {
          headers: {
            // Need to pass cookies if any, fetch does this automatically if credentials included
          }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setUserRole(userData.user.role);
        }
      } catch (e) {
        console.error('Failed to check maintenance status', e);
      } finally {
        setLoading(false);
      }
    };
    
    checkStatus();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (isMaintenance && !bypassRoles.includes(userRole || '')) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <ShieldAlert className="w-16 h-16 text-amber-500 mb-6" />
        <h1 className="text-3xl font-bold text-slate-900 mb-2">System Maintenance</h1>
        <p className="text-slate-500 max-w-md">
          We are currently performing scheduled maintenance to improve your experience. 
          Please check back later.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
