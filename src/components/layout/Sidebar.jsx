import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
    const [showLogoutTransition, setShowLogoutTransition] = useState(false);
    const [logoutStep, setLogoutStep] = useState(0);

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
        setShowLogoutTransition(true);
        setLogoutStep(0);

        setTimeout(() => setLogoutStep(1), 500);
        setTimeout(() => setLogoutStep(2), 1200);
        setTimeout(() => setLogoutStep(3), 1900);

        setTimeout(() => {
            logout();
            navigate('/login');
        }, 2800);
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
                    <img src="/favicon.png" alt="Logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                </div>
                {!collapsed && (
                    <div className="sidebar-brand">
                        <h2>SARDIKA</h2>
                    </div>
                )}
            </div>

            <div className="sidebar-user" style={{ marginBottom: 8 }}>
                <div className="sidebar-user-avatar">
                    <span>{user?.namaAkun?.charAt(0) || 'U'}</span>
                    {user?.image && !user.image.startsWith('gdrive://') && (
                        <img src={user.image} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
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

            {/* ===== LOGOUT TRANSITION OVERLAY ===== */}
            {showLogoutTransition && (
                <div className="logout-transition-overlay">
                    <div className="logout-transition-content">
                        {/* School Scene */}
                        <div className="logout-transition-scene">
                            <svg viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
                                {/* Sky gradient */}
                                <defs>
                                    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgba(59,130,246,0.08)" />
                                        <stop offset="100%" stopColor="rgba(168,85,247,0.04)" />
                                    </linearGradient>
                                </defs>
                                <rect x="0" y="0" width="400" height="180" fill="url(#skyGrad)" />

                                {/* Sun/Moon */}
                                <g className={`logout-sun ${logoutStep >= 0 ? 'active' : ''}`}>
                                    <circle cx="320" cy="45" r="20" fill="rgba(251,191,36,0.15)" />
                                    <circle cx="320" cy="45" r="14" fill="rgba(251,191,36,0.25)" />
                                    {[0,1,2,3,4,5,6,7].map(i => (
                                        <line key={`ray-${i}`}
                                            x1={320 + Math.cos(i * Math.PI / 4) * 22}
                                            y1={45 + Math.sin(i * Math.PI / 4) * 22}
                                            x2={320 + Math.cos(i * Math.PI / 4) * 28}
                                            y2={45 + Math.sin(i * Math.PI / 4) * 28}
                                            stroke="rgba(251,191,36,0.2)" strokeWidth="1.5" strokeLinecap="round"
                                            className="logout-ray"
                                            style={{ animationDelay: `${i * 0.15}s` }}
                                        />
                                    ))}
                                </g>

                                {/* Clouds */}
                                <g className="logout-cloud" style={{ animationDelay: '0s' }}>
                                    <ellipse cx="80" cy="40" rx="25" ry="10" fill="rgba(255,255,255,0.06)" />
                                    <ellipse cx="95" cy="35" rx="18" ry="8" fill="rgba(255,255,255,0.05)" />
                                </g>
                                <g className="logout-cloud" style={{ animationDelay: '1s' }}>
                                    <ellipse cx="220" cy="30" rx="22" ry="9" fill="rgba(255,255,255,0.05)" />
                                    <ellipse cx="235" cy="26" rx="15" ry="7" fill="rgba(255,255,255,0.04)" />
                                </g>

                                {/* Ground */}
                                <rect x="0" y="175" width="400" height="45" fill="rgba(34,197,94,0.06)" />
                                <line x1="0" y1="175" x2="400" y2="175" stroke="rgba(34,197,94,0.15)" strokeWidth="1" />

                                {/* Path/road to school */}
                                <path d="M0,195 Q100,185 200,190 Q300,195 400,188" stroke="rgba(168,85,247,0.1)" strokeWidth="8" fill="none" strokeLinecap="round" />

                                {/* Tree left */}
                                <g className={`logout-tree ${logoutStep >= 0 ? 'active' : ''}`}>
                                    <rect x="58" y="140" width="4" height="35" rx="1" fill="rgba(139,92,46,0.3)" />
                                    <circle cx="60" cy="130" r="16" fill="rgba(34,197,94,0.12)" />
                                    <circle cx="52" cy="135" r="10" fill="rgba(34,197,94,0.1)" />
                                    <circle cx="68" cy="133" r="11" fill="rgba(34,197,94,0.1)" />
                                </g>

                                {/* Main School Building */}
                                <g className={`logout-school ${logoutStep >= 1 ? 'active' : ''}`}>
                                    {/* Main body */}
                                    <rect x="130" y="105" width="140" height="70" rx="3" fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.3)" strokeWidth="1" />
                                    {/* Roof */}
                                    <polygon points="120,105 200,65 280,105" fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
                                    {/* Flag */}
                                    <line x1="200" y1="65" x2="200" y2="45" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                                    <rect x="200" y="45" width="15" height="10" rx="1" fill="rgba(220,38,38,0.3)" className="logout-flag" />
                                    {/* Door */}
                                    <rect x="185" y="145" width="30" height="30" rx="2" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.35)" strokeWidth="0.8" />
                                    <circle cx="210" cy="162" r="1.5" fill="rgba(251,191,36,0.4)" />
                                    {/* Windows */}
                                    {[0,1,2,3].map(i => (
                                        <rect key={`sw-${i}`}
                                            x={140 + i * 32} y="118"
                                            width="16" height="14" rx="1"
                                            fill={logoutStep >= 2 ? 'rgba(251,191,36,0.25)' : 'rgba(59,130,246,0.1)'}
                                            stroke="rgba(59,130,246,0.2)" strokeWidth="0.5"
                                            className="logout-window"
                                            style={{ animationDelay: `${i * 0.2}s` }}
                                        />
                                    ))}
                                    {/* Sign */}
                                    <rect x="166" y="93" width="68" height="10" rx="2" fill="rgba(255,255,255,0.08)" />
                                    <text x="200" y="101" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="6" fontWeight="600">SEKOLAH</text>
                                </g>

                                {/* Tree right */}
                                <g className={`logout-tree ${logoutStep >= 1 ? 'active' : ''}`} style={{ animationDelay: '0.3s' }}>
                                    <rect x="318" y="135" width="4" height="40" rx="1" fill="rgba(139,92,46,0.3)" />
                                    <circle cx="320" cy="122" r="18" fill="rgba(34,197,94,0.1)" />
                                    <circle cx="310" cy="128" r="12" fill="rgba(34,197,94,0.09)" />
                                    <circle cx="330" cy="126" r="13" fill="rgba(34,197,94,0.09)" />
                                </g>

                                {/* Stars appearing */}
                                {logoutStep >= 2 && [
                                    { x: 50, y: 25, r: 1.5 }, { x: 150, y: 18, r: 1 }, { x: 280, y: 22, r: 1.2 },
                                    { x: 370, y: 35, r: 0.8 }, { x: 120, y: 50, r: 1 },
                                ].map((s, i) => (
                                    <circle key={`star-${i}`} cx={s.x} cy={s.y} r={s.r}
                                        fill="rgba(255,255,255,0.3)"
                                        className="logout-star"
                                        style={{ animationDelay: `${i * 0.2}s` }}
                                    />
                                ))}
                            </svg>
                        </div>

                        {/* Thank you info */}
                        <div className="logout-transition-info">
                            <div className="logout-transition-logo">
                                <img src="/favicon.png" alt="Logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                <span>SARDIKA</span>
                            </div>
                            <div className="logout-transition-thanks">
                                Terima Kasih, {user?.namaAkun || user?.name || 'User'}!
                            </div>
                            <div className="logout-transition-message">
                                Atas kontribusi Anda dalam pendataan<br />
                                infrastruktur pendidikan Kabupaten Cilacap
                            </div>
                            <div className="logout-transition-role-badge">
                                {user?.role || 'Sekolah'}
                            </div>

                            {/* Progress bar */}
                            <div className="logout-transition-progress">
                                <div className="logout-transition-progress-bar" style={{ width: `${(logoutStep + 1) * 25}%` }} />
                            </div>

                            <div className="logout-transition-status">
                                {logoutStep === 0 && '📊 Menyimpan sesi terakhir...'}
                                {logoutStep === 1 && '🔒 Mengamankan data...'}
                                {logoutStep === 2 && '🙏 Matur Nuwun!'}
                                {logoutStep === 3 && '👋 Sampai jumpa kembali!'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
