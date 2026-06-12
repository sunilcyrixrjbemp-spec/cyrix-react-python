import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Reset from './pages/Reset';
import Retrieve from './pages/Retrieve';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Approval from './pages/Approval';
import Expense from './pages/Expense';
import Month from './pages/Month';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
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

        {/* Authenticated Layout Routes */}
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/approval" element={<Approval />} />
          <Route path="/expense" element={<Expense />} />
          <Route path="/month" element={<Month />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Fallback to Login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
