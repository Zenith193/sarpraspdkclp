import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';
import { useEffect } from 'react';
import useIdleLogout from './hooks/useIdleLogout';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages
import Login from './pages/Login';

// Admin
import Dashboard from './pages/admin/Dashboard';
import DataSarpras from './pages/admin/DataSarpras';
import Proposal from './pages/admin/Proposal';
import ProyeksiAnggaran from './pages/admin/ProyeksiAnggaran';
import AktivitasPengguna from './pages/admin/AktivitasPengguna';
import ManajemenPengguna from './pages/admin/ManajemenPengguna';
import ManajemenTemplate from './pages/admin/ManajemenTemplate';
import RiwayatBantuan from './pages/admin/RiwayatBantuan';
import MatriksKegiatan from './pages/admin/MatriksKegiatan';
import CreateBAST from './pages/admin/CreateBAST';
import Pencairan from './pages/admin/Pencairan';
import ManajemenKorwil from './pages/admin/ManajemenKorwil';
import UploadFormKerusakan from './pages/admin/UploadFormKerusakan';
import Prestasi from './pages/admin/Prestasi';
import HakAkses from './pages/admin/HakAkses';
import PengaturanNAS from './pages/admin/PengaturanNAS';
import CountdownSettings from './pages/admin/CountdownSettings';
import ManajemenPenyedia from './pages/admin/ManajemenPenyedia';

// Korwil
import DashboardKorwil from './pages/korwil/DashboardKorwil';

// Sekolah
import DashboardSekolah from './pages/sekolah/DashboardSekolah';

// Penyedia
import DashboardPenyedia from './pages/penyedia/DashboardPenyedia';
import PermohonanKontrak from './pages/penyedia/PermohonanKontrak';
import RiwayatKontrakPenyedia from './pages/penyedia/RiwayatKontrakPenyedia';
import RealisasiPenyedia from './pages/penyedia/RealisasiPenyedia';
import ManajemenKontrak from './pages/admin/ManajemenKontrak';
import MonitoringRealisasi from './pages/admin/MonitoringRealisasi';

// Public
import RegistrasiPenyedia from './pages/RegistrasiPenyedia';
import CekVerifikasi from './pages/CekVerifikasi';

// Shared
import ProfilPengguna from './pages/shared/ProfilPengguna';
import RankingPrioritas from './pages/shared/RankingPrioritas';
import VerifikasiSarpras from './pages/shared/VerifikasiSarpras';
import VerifikasiProposal from './pages/shared/VerifikasiProposal';
import FormKerusakan from './pages/shared/FormKerusakan';
import Feedback from './pages/shared/Feedback';
import ManajemenFeedback from './pages/admin/ManajemenFeedback';
import Iklan from './pages/shared/Iklan';


// Route guard
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role?.toLowerCase())) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Smart root redirect: go to dashboard if authenticated, login if not
const HomeRedirect = () => {
  const { isAuthenticated, user, checkSession } = useAuthStore();

  useEffect(() => { checkSession(); }, []);

  if (isAuthenticated && user?.role) {
    const role = user.role.toLowerCase();
    if (role === 'penyedia') return <Navigate to="/penyedia/dashboard" replace />;
    return <Navigate to={`/${role}/dashboard`} replace />;
  }
  return <Navigate to="/login" replace />;
};

function App() {
  const theme = useThemeStore(s => s.theme);
  const checkSession = useAuthStore(s => s.checkSession);

  // Revalidate server session on mount (handles new tabs)
  useEffect(() => { checkSession(); }, []);

  // Auto-logout after 5 minutes of inactivity
  useIdleLogout();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registrasi-penyedia" element={<RegistrasiPenyedia />} />
        <Route path="/cek-verifikasi" element={<CekVerifikasi />} />
        <Route path="/" element={<HomeRedirect />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="data-sarpras" element={<DataSarpras />} />
          <Route path="proposal" element={<Proposal />} />
          <Route path="proyeksi-anggaran" element={<ProyeksiAnggaran />} />
          <Route path="aktivitas" element={<AktivitasPengguna />} />
          <Route path="manajemen-pengguna" element={<ManajemenPengguna />} />
          <Route path="manajemen-template" element={<ManajemenTemplate />} />
          <Route path="riwayat-bantuan" element={<RiwayatBantuan />} />
          <Route path="matriks-kegiatan" element={<MatriksKegiatan />} />
          <Route path="create-bast" element={<CreateBAST />} />
          <Route path="pencairan" element={<Pencairan />} />
          <Route path="manajemen-korwil" element={<ManajemenKorwil />} />
          <Route path="form-kerusakan" element={<UploadFormKerusakan />} />
          <Route path="prestasi" element={<Prestasi />} />
          <Route path="verifikasi-sarpras" element={<VerifikasiSarpras />} />
          <Route path="verifikasi-proposal" element={<VerifikasiProposal />} />
          <Route path="ranking" element={<RankingPrioritas lockable />} />
          <Route path="hak-akses" element={<HakAkses />} />
          <Route path="pengaturan-nas" element={<PengaturanNAS />} />
          <Route path="countdown-settings" element={<CountdownSettings />} />
          <Route path="manajemen-penyedia" element={<ManajemenPenyedia />} />
          <Route path="manajemen-kontrak" element={<ManajemenKontrak />} />
          <Route path="monitoring-realisasi" element={<MonitoringRealisasi />} />
          <Route path="feedback" element={<ManajemenFeedback />} />
          <Route path="iklan" element={<Iklan />} />
          <Route path="profil" element={<ProfilPengguna />} />
        </Route>

        {/* Verifikator Routes */}
        <Route path="/verifikator" element={<ProtectedRoute allowedRoles={['verifikator']}><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="data-sarpras" element={<DataSarpras readOnly />} />
          <Route path="proposal" element={<Proposal />} />
          <Route path="proyeksi-anggaran" element={<ProyeksiAnggaran />} />
          <Route path="verifikasi-sarpras" element={<VerifikasiSarpras />} />
          <Route path="verifikasi-proposal" element={<VerifikasiProposal />} />
          <Route path="ranking" element={<RankingPrioritas lockable />} />
          <Route path="riwayat-bantuan" element={<RiwayatBantuan />} />
          <Route path="manajemen-template" element={<ManajemenTemplate />} />
          <Route path="matriks-kegiatan" element={<MatriksKegiatan />} />
          <Route path="create-bast" element={<CreateBAST />} />
          <Route path="pencairan" element={<Pencairan />} />
          <Route path="form-kerusakan" element={<UploadFormKerusakan />} />
          <Route path="prestasi" element={<Prestasi />} />
          <Route path="manajemen-penyedia" element={<ManajemenPenyedia />} />
          <Route path="manajemen-kontrak" element={<ManajemenKontrak />} />
          <Route path="monitoring-realisasi" element={<MonitoringRealisasi />} />
          <Route path="profil" element={<ProfilPengguna />} />
          <Route path="aktivitas" element={<AktivitasPengguna />} />
        </Route>

        {/* Korwil Routes */}
        <Route path="/korwil" element={<ProtectedRoute allowedRoles={['korwil']}><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<DashboardKorwil />} />
          <Route path="verifikasi-sarpras" element={<VerifikasiSarpras />} />
          <Route path="verifikasi-proposal" element={<VerifikasiProposal />} />
          <Route path="ranking" element={<RankingPrioritas />} />
          <Route path="data-sarpras" element={<DataSarpras readOnly />} />
          <Route path="proposal" element={<Proposal readOnly />} />
          <Route path="riwayat-bantuan" element={<RiwayatBantuan readOnly />} />
          <Route path="form-kerusakan" element={<UploadFormKerusakan />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="profil" element={<ProfilPengguna />} />
          <Route path="aktivitas" element={<AktivitasPengguna />} />
        </Route>

        {/* Sekolah Routes */}
        <Route path="/sekolah" element={<ProtectedRoute allowedRoles={['sekolah']}><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<DashboardSekolah />} />
          <Route path="data-sarpras" element={<DataSarpras />} />
          <Route path="proposal" element={<Proposal />} />
          <Route path="riwayat-bantuan" element={<RiwayatBantuan readOnly />} />
          <Route path="prestasi" element={<Prestasi />} />
          <Route path="form-kerusakan" element={<UploadFormKerusakan />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="profil" element={<ProfilPengguna />} />
          <Route path="aktivitas" element={<AktivitasPengguna />} />
        </Route>

        {/* Penyedia Routes */}
        <Route path="/penyedia" element={<ProtectedRoute allowedRoles={['penyedia']}><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<DashboardPenyedia />} />
          <Route path="permohonan-kontrak" element={<PermohonanKontrak />} />
          <Route path="riwayat-kontrak" element={<RiwayatKontrakPenyedia />} />
          <Route path="realisasi" element={<RealisasiPenyedia />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="profil" element={<ProfilPengguna />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
