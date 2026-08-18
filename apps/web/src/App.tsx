import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/store';
import Layout from './components/Layout';
import { Loading } from './components/ui';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import Patrols from './pages/Patrols';
import PatrolDetail from './pages/PatrolDetail';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import Panic from './pages/Panic';
import Schedule from './pages/Schedule';
import Attendance from './pages/Attendance';
import Guards from './pages/Guards';
import GuardDetail from './pages/GuardDetail';
import Handovers from './pages/Handovers';
import Visitors from './pages/Visitors';
import Vehicles from './pages/Vehicles';
import Equipment from './pages/Equipment';
import Clients from './pages/Clients';
import Sites from './pages/Sites';
import CheckpointsRoutes from './pages/CheckpointsRoutes';
import Announcements from './pages/Announcements';
import Reports from './pages/Reports';
import AuditTrail from './pages/AuditTrail';
import Profile from './pages/Profile';
import Tasks from './pages/Tasks';
import Kpi from './pages/Kpi';
import Floors from './pages/Floors';
import Leaves from './pages/Leaves';
import Sirene from './pages/Sirene';

function Guard({ children }: { children: JSX.Element }) {
  const { me, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="grid h-screen place-items-center"><Loading label="Menyiapkan pusat komando…" /></div>;
  if (!me) return <Navigate to="/masuk" state={{ from: loc.pathname }} replace />;
  return children;
}

export default function App() {
  const load = useAuth((s) => s.load);
  useEffect(() => {
    load();
  }, []);

  return (
    <Routes>
      <Route path="/masuk" element={<Login />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/peta" element={<LiveMap />} />
        <Route path="/patroli" element={<Patrols />} />
        <Route path="/patroli/:id" element={<PatrolDetail />} />
        <Route path="/insiden" element={<Incidents />} />
        <Route path="/insiden/:id" element={<IncidentDetail />} />
        <Route path="/darurat" element={<Panic />} />
        <Route path="/jadwal" element={<Schedule />} />
        <Route path="/presensi" element={<Attendance />} />
        <Route path="/personel" element={<Guards />} />
        <Route path="/personel/:id" element={<GuardDetail />} />
        <Route path="/serah-terima" element={<Handovers />} />
        <Route path="/tugas" element={<Tasks />} />
        <Route path="/kpi" element={<Kpi />} />
        <Route path="/lantai" element={<Floors />} />
        <Route path="/cuti" element={<Leaves />} />
        <Route path="/sirene" element={<Sirene />} />
        <Route path="/tamu" element={<Visitors />} />
        <Route path="/kendaraan" element={<Vehicles />} />
        <Route path="/inventaris" element={<Equipment />} />
        <Route path="/klien" element={<Clients />} />
        <Route path="/site" element={<Sites />} />
        <Route path="/titik" element={<CheckpointsRoutes />} />
        <Route path="/pengumuman" element={<Announcements />} />
        <Route path="/laporan" element={<Reports />} />
        <Route path="/jejak-audit" element={<AuditTrail />} />
        <Route path="/profil" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
