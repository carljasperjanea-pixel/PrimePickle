/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { apiRequest } from './lib/api';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import PlayerDashboard from './pages/PlayerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Scorer from './pages/Scorer';
import PublicProfile from './pages/PublicProfile';
import ClubDashboard from './pages/ClubDashboard';
import Messages from './pages/Messages';
import Maintenance from './pages/Maintenance';

function GlobalMaintenanceCheck({ children }: { children: React.ReactNode }) {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const data = await apiRequest('/system/maintenance');
        setIsMaintenance(data.isMaintenanceMode);
      } catch (e) {
        // Ignore errors, apiRequest will handle 503s
      } finally {
        setLoading(false);
      }
    };
    checkMaintenance();
  }, []);

  if (loading) return null;

  // If maintenance is active, and we are not on the maintenance page, and not on login/admin pages
  // Note: We rely on the 503 interceptor for logged-in players. This check is primarily for the public Home page.
  const path = window.location.pathname;
  if (isMaintenance && path !== '/maintenance' && path !== '/login' && !path.startsWith('/admin') && !path.startsWith('/super-admin')) {
    window.location.href = '/maintenance';
    return null;
  }

  return <>{children}</>;
}

export default function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';
  
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <BrowserRouter>
        <GlobalMaintenanceCheck>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<PlayerDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/super-admin" element={<SuperAdminDashboard />} />
            <Route path="/scorer/:lobbyId" element={<Scorer />} />
            <Route path="/profile/:id" element={<PublicProfile />} />
            <Route path="/clubs/:id" element={<ClubDashboard />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </GlobalMaintenanceCheck>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}
