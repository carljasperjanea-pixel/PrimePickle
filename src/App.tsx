/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  return (
    <BrowserRouter>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
