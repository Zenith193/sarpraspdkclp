import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
    LayoutDashboard, Database, FileText, DollarSign, Activity, Users, FileSpreadsheet,
    History, Grid3X3, FilePlus, Wallet, Map, Upload, Trophy, LogOut, School,
    ChevronLeft, ChevronRight, CheckCircle, Star, ClipboardList, Eye,
    Shield, HardDrive, Timer, Megaphone
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useSettingsStore from '../../store/settingsStore';
import { settingsApi } from '../../api/index';
import toast from 'react-hot-toast';

const Sidebar = ({ collapsed, onToggle, className = '' }) => {
    const { user, logout } = useAuthStore();
    const { accessConfig, setAccessConfig } = useSettingsStore();
    const navigate = useNavigate();
    const role = user?.role?.toLowerCase();

    // Fetch latest access config from server on mount
    useEffect(() => {
        settingsApi.getAccess().then(res => {
            let serverConfig = res;
            if (res && res.value) {
                serverConfig = typeof res.value === 'string' ? JSON.parse(res.value) : res.value;
            }
            if (serverConfig && typeof serverConfig === 'object' && (serverConfig.admin || serverConfig.verifikator)) {
                setAccessConfig(serverConfig);
            }
        }).catch(() => {});
    }, []);

    const handleLogout = () => {
        logout();
        toast.success('Logout berhasil', {
            style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
        });
        navigate('/login');
    };

    // Helper: extract menu key from path e.g. '/admin/data-sarpras' → 'data-sarpras'
    const getMenuKey = (path) => path.split('/').pop();

    // Filter menu items based on access config
    const filterByAccess = (items) => {
        if (!role || !accessConfig[role]) return items;
        return items.filter(item => accessConfig[role].includes(getMenuKey(item.path)));
    };

    const adminMenu = filterByAccess([
        { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/admin/dashboard' },
        { label: 'Data Sarpras', icon: <Database size={18} />, path: '/admin/data-sarpras' },
        { label: 'Proposal', icon: <FileText size={18} />, path: '/admin/proposal' },
        { label: 'Proyeksi Anggaran', icon: <DollarSign size={18} />, path: '/admin/proyeksi-anggaran' },
        { label: 'Aktivitas Pengguna', icon: <Activity size={18} />, path: '/admin/aktivitas' },
        { label: 'Manajemen Pengguna', icon: <Users size={18} />, path: '/admin/manajemen-pengguna' },
        { label: 'Manajemen Template', icon: <FileSpreadsheet size={18} />, path: '/admin/manajemen-template' },
        { label: 'Riwayat Bantuan', icon: <History size={18} />, path: '/admin/riwayat-bantuan' },
        { label: 'Matriks Kegiatan', icon: <Grid3X3 size={18} />, path: '/admin/matriks-kegiatan' },
        { label: 'Create BAST', icon: <FilePlus size={18} />, path: '/admin/create-bast' },
        { label: 'Pencairan', icon: <Wallet size={18} />, path: '/admin/pencairan' },
        { label: 'Manajemen Korwil', icon: <Map size={18} />, path: '/admin/manajemen-korwil' },
        { label: 'Upload Form Kerusakan', icon: <Upload size={18} />, path: '/admin/form-kerusakan' },
        { label: 'Prestasi', icon: <Trophy size={18} />, path: '/admin/prestasi' },
        { label: 'Verifikasi Sarpras', icon: <CheckCircle size={18} />, path: '/admin/verifikasi-sarpras' },
        { label: 'Verifikasi Proposal', icon: <ClipboardList size={18} />, path: '/admin/verifikasi-proposal' },
        { label: 'Ranking & Prioritas', icon: <Star size={18} />, path: '/admin/ranking' },
        { label: 'Iklan', icon: <Megaphone size={18} />, path: '/admin/iklan' },
    ]);

    const adminSettingsMenu = filterByAccess([
        { label: 'Hak Akses', icon: <Shield size={18} />, path: '/admin/hak-akses' },
        { label: 'Pengaturan NAS', icon: <HardDrive size={18} />, path: '/admin/pengaturan-nas' },
        { label: 'Countdown Timer', icon: <Timer size={18} />, path: '/admin/countdown-settings' },
    ]);

    const verifikatorMenu = filterByAccess([
        { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/verifikator/dashboard' },
        { label: 'Data Sarpras', icon: <Database size={18} />, path: '/verifikator/data-sarpras' },
        { label: 'Proposal', icon: <FileText size={18} />, path: '/verifikator/proposal' },
        { label: 'Verifikasi Sarpras', icon: <CheckCircle size={18} />, path: '/verifikator/verifikasi-sarpras' },
        { label: 'Verifikasi Proposal', icon: <ClipboardList size={18} />, path: '/verifikator/verifikasi-proposal' },
        { label: 'Ranking & Prioritas', icon: <Star size={18} />, path: '/verifikator/ranking' },
        { label: 'Riwayat Bantuan', icon: <History size={18} />, path: '/verifikator/riwayat-bantuan' },
        { label: 'Manajemen Template', icon: <FileSpreadsheet size={18} />, path: '/verifikator/manajemen-template' },
        { label: 'Matriks Kegiatan', icon: <Grid3X3 size={18} />, path: '/verifikator/matriks-kegiatan' },
        { label: 'Create BAST', icon: <FilePlus size={18} />, path: '/verifikator/create-bast' },
        { label: 'Pencairan', icon: <Wallet size={18} />, path: '/verifikator/pencairan' },
        { label: 'Upload Form Kerusakan', icon: <Upload size={18} />, path: '/verifikator/form-kerusakan' },
        { label: 'Prestasi', icon: <Trophy size={18} />, path: '/verifikator/prestasi' },
        { label: 'Iklan', icon: <Megaphone size={18} />, path: '/verifikator/iklan' },
    ]);

    const korwilMenu = filterByAccess([
        { label: 'Dashboard Korwil', icon: <LayoutDashboard size={18} />, path: '/korwil/dashboard' },
        { label: 'Verifikasi Sarpras', icon: <CheckCircle size={18} />, path: '/korwil/verifikasi-sarpras' },
        { label: 'Verifikasi Proposal', icon: <ClipboardList size={18} />, path: '/korwil/verifikasi-proposal' },
        { label: 'Ranking Prioritas', icon: <Star size={18} />, path: '/korwil/ranking' },
        { label: 'Data Sarpras', icon: <Database size={18} />, path: '/korwil/data-sarpras' },
        { label: 'Data Proposal', icon: <FileText size={18} />, path: '/korwil/proposal' },
        { label: 'Riwayat Bantuan', icon: <History size={18} />, path: '/korwil/riwayat-bantuan' },
        { label: 'Form Kerusakan', icon: <Eye size={18} />, path: '/korwil/form-kerusakan' },
        { label: 'Iklan', icon: <Megaphone size={18} />, path: '/korwil/iklan' },
    ]);

    const sekolahMenu = filterByAccess([
        { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/sekolah/dashboard' },
        { label: 'Data Sarpras', icon: <Database size={18} />, path: '/sekolah/data-sarpras' },
        { label: 'Proposal', icon: <FileText size={18} />, path: '/sekolah/proposal' },
        { label: 'Riwayat Bantuan', icon: <History size={18} />, path: '/sekolah/riwayat-bantuan' },
        { label: 'Prestasi', icon: <Trophy size={18} />, path: '/sekolah/prestasi' },
        { label: 'Form Kerusakan', icon: <Eye size={18} />, path: '/sekolah/form-kerusakan' },
        { label: 'Iklan', icon: <Megaphone size={18} />, path: '/sekolah/iklan' },
    ]);

    const bottomMenu = [
        { label: 'Profil', icon: <Users size={18} />, path: `/${role}/profil` },
        { label: 'Aktivitas', icon: <Activity size={18} />, path: `/${role}/aktivitas` },
    ];

    const getMenu = () => {
        switch (role) {
            case 'admin': return adminMenu;
            case 'verifikator': return verifikatorMenu;
            case 'korwil': return korwilMenu;
            case 'sekolah': return sekolahMenu;
            default: return [];
        }
    };

    const menu = getMenu();
    const showSettingsSection = role === 'admin' && adminSettingsMenu.length > 0;

    return (
        <div className={`sidebar ${collapsed ? 'collapsed' : ''} ${className}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <School size={20} />
                </div>
                {!collapsed && (
                    <div className="sidebar-brand">
                        <h2>SARDIKA</h2>
                    </div>
                )}
            </div>

            <div className="sidebar-user" style={{ marginBottom: 8 }}>
                <div className="sidebar-user-avatar">
                    {user?.image ? (
                        <img src={user.image} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                        user?.namaAkun?.charAt(0) || 'U'
                    )}
                </div>
                {!collapsed && (
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.namaAkun}</div>
                        <div className="sidebar-user-role">{user?.role}</div>
                    </div>
                )}
            </div>

            <nav className="sidebar-nav">
                {!collapsed && <div className="sidebar-section-title">Menu Utama</div>}
                {menu.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        <span className="sidebar-icon">{item.icon}</span>
                        {!collapsed && item.label}
                    </NavLink>
                ))}

                {showSettingsSection && (
                    <>
                        {!collapsed && <div className="sidebar-section-title" style={{ marginTop: 12 }}>Pengaturan</div>}
                        {adminSettingsMenu.map(item => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            >
                                <span className="sidebar-icon">{item.icon}</span>
                                {!collapsed && item.label}
                            </NavLink>
                        ))}
                    </>
                )}

                {!collapsed && <div className="sidebar-section-title" style={{ marginTop: 12 }}>Akun</div>}
                {bottomMenu.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        <span className="sidebar-icon">{item.icon}</span>
                        {!collapsed && item.label}
                    </NavLink>
                ))}
            </nav>



            <button className="sidebar-logout" onClick={handleLogout}>
                <LogOut size={18} />
                {!collapsed && 'Logout'}
            </button>
        </div>
    );
};

export default Sidebar;
