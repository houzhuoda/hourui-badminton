import { ConfigProvider, App as AntApp } from 'antd';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MainLayout from './components/MainLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Members from './pages/Members.jsx';
import MemberDetail from './pages/MemberDetail.jsx';
import Courses from './pages/Courses.jsx';
import SchedulePrivate from './pages/SchedulePrivate.jsx';
import ScheduleGroup from './pages/ScheduleGroup.jsx';
import ScheduleCommunity from './pages/ScheduleCommunity.jsx';
import Coaches from './pages/Coaches.jsx';
import Courts from './pages/Courts.jsx';
import Commissions from './pages/Commissions.jsx';
import Sales from './pages/Sales.jsx';
import Channels from './pages/Channels.jsx';
import Reports from './pages/Reports.jsx';
import MemberEndConfig from './pages/MemberEndConfig.jsx';
import Orders from './pages/Orders.jsx';

const sportTheme = {
  token: {
    colorPrimary: '#FF4D28',
    colorPrimaryHover: '#FF7A5C',
    colorPrimaryActive: '#E63E18',
    colorLink: '#FF4D28',
    colorSuccess: '#2E7D5A',
    colorWarning: '#FF7A2F',
    colorError: '#ff4d4f',
    colorInfo: '#06B6D4',
    colorText: '#0F172A',
    colorTextSecondary: '#6B7280',
    colorBgLayout: '#F3F4F6',
    colorBgContainer: '#FFFFFF',
    borderRadius: 12,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  components: {
    Button: { primaryShadow: '0 4px 14px rgba(255, 77, 40, 0.28)', borderRadius: 10 },
    Menu: { darkItemBg: '#0F172A', darkItemSelectedBg: '#FF4D28', darkSubMenuItemBg: '#1E293B' },
    Layout: { siderBg: '#0F172A', headerBg: '#FFFFFF' },
    Card: { boxShadow: '0 8px 24px rgba(15, 23, 42, 0.10)' },
  },
};

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('admin_token'));

  useEffect(() => {
    const handler = () => setLoggedIn(!!localStorage.getItem('admin_token'));
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const routes = !loggedIn ? (
    <Routes>
      <Route path="/login" element={<Login onLogin={() => setLoggedIn(true)} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  ) : (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<MainLayout onLogout={() => setLoggedIn(false)} />}>
        <Route index element={<Dashboard />} />
        <Route path="members" element={<Members />} />
        <Route path="members/:id" element={<MemberDetail />} />
        <Route path="courses" element={<Courses />} />
        <Route path="schedule" element={<Navigate to="/schedule-private" replace />} />
        <Route path="schedule-private" element={<SchedulePrivate />} />
        <Route path="schedule-group" element={<ScheduleGroup />} />
        <Route path="schedule-community" element={<ScheduleCommunity />} />
        <Route path="coaches" element={<Coaches />} />
        <Route path="courts" element={<Courts />} />
        <Route path="commissions" element={<Commissions />} />
        <Route path="sales" element={<Sales />} />
        <Route path="channels" element={<Channels />} />
        <Route path="orders" element={<Orders />} />
        <Route path="reports" element={<Reports />} />
        <Route path="member-end-config" element={<MemberEndConfig />} />
      </Route>
    </Routes>
  );

  return (
    <ConfigProvider theme={sportTheme}>
      <AntApp>
        {routes}
      </AntApp>
    </ConfigProvider>
  );
}
