import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase-client';
import { apiRequest } from '@/lib/api';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const hasRun = React.useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const handleCallback = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        let session;

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data.session;
        } else if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            if (error) throw error;
            session = data.session;
          }
        }

        if (session) {
          const pendingRegStr = sessionStorage.getItem('pendingRegistration');
          let extraData = {};
          if (pendingRegStr) {
            try {
              extraData = JSON.parse(pendingRegStr);
              sessionStorage.removeItem('pendingRegistration');
            } catch (e) {}
          }

          const response = await apiRequest('/auth/google', 'POST', {
            access_token: session.access_token,
            ...extraData
          });

          if (response.user.role === 'super_admin') {
            navigate('/super-admin');
          } else if (response.user.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        } else {
          throw new Error('No session found');
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'Failed to authenticate');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="text-center">
        {error ? (
          <div className="text-red-500">
            <h2 className="text-xl font-bold mb-2">Authentication Error</h2>
            <p>{error}</p>
            <p className="text-sm mt-4 text-muted-foreground">Redirecting to login...</p>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold mb-2">Completing Authentication...</h2>
            <p className="text-muted-foreground">Please wait while we set up your account.</p>
          </div>
        )}
      </div>
    </div>
  );
}
