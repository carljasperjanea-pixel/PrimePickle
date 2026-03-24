import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase-client';
import { apiRequest } from '@/lib/api';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    let isProcessing = false;

    const processSession = async (session: any) => {
      if (!session || isProcessing) return;
      isProcessing = true;
      
      try {
        // Send the access token to our backend to sync the user and get our custom JWT
        const response = await apiRequest('/auth/google', 'POST', {
          access_token: session.access_token
        });

        if (!mounted) return;

        if (response.user.role === 'super_admin') {
          navigate('/super-admin');
        } else if (response.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        if (mounted) {
          setError(err.message || 'Failed to authenticate');
          setTimeout(() => navigate('/login'), 3000);
        }
        isProcessing = false;
      }
    };

    // Check current session first
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        if (mounted) {
          setError(error.message);
          setTimeout(() => navigate('/login'), 3000);
        }
        return;
      }
      
      if (session) {
        processSession(session);
      }
    });

    // Listen for auth state changes (e.g., when the hash is parsed)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        processSession(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="text-center">
        {error ? (
          <div className="text-red-500">
            <p className="font-bold">Authentication Error</p>
            <p className="text-sm">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">Redirecting to login...</p>
          </div>
        ) : (
          <div className="text-gray-500">
            <p className="font-bold">Authenticating...</p>
            <p className="text-sm">Please wait while we log you in.</p>
          </div>
        )}
      </div>
    </div>
  );
}
