import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Public Identity Pages
import Login from './pages/Login';
import Reset from './pages/Reset';
import Retrieve from './pages/Retrieve';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/retrieve" element={<Retrieve />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Authenticated Layout Container Route */}
        <Route element={<Layout />}>
          <Route path="/home" element={<div />} /> {/* Layout renders page components directly based on state */}
        </Route>

        {/* Redirect older routes to /home to maintain clean address bar */}
        <Route path="/admin" element={<Navigate to="/home" replace />} />
        <Route path="/approval" element={<Navigate to="/home" replace />} />
        <Route path="/expense" element={<Navigate to="/home" replace />} />
        <Route path="/month" element={<Navigate to="/home" replace />} />
        <Route path="/dashboard" element={<Navigate to="/home" replace />} />
        <Route path="/upload" element={<Navigate to="/home" replace />} />
        <Route path="/profile" element={<Navigate to="/home" replace />} />

        {/* Fallback to Login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
