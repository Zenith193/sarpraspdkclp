import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Building2, Shield, Users, GraduationCap, MapPin, School, UserCheck, Lock, Sun, Moon, LogIn, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { sekolahApi, penggunaApi } from '../api/index';

const Login = () => {
    const [tab, setTab] = useState('staff');
    const [role, setRole] = useState('admin');
    const [email, setEmail] = useState('');
    const [npsn, setNpsn] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [stats, setStats] = useState({ schoolCount: 0, userCount: 0, kecamatanCount: 0, jenjangBreakdown: {} });
    const [showTransition, setShowTransition] = useState(false);
    const [transitionStep, setTransitionStep] = useState(0);
    const [transitionUser, setTransitionUser] = useState(null);
    const pendingNav = useState(null);
    const navigate = useNavigate();
    const authLogin = useAuthStore(s => s.login);
    const { theme, toggleTheme } = useThemeStore();

    // Fetch public stats for the login page (no auth required)
    useEffect(() => {
        fetch('/api/public-stats')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) setStats(data);
            })
            .catch(() => { }); // Silently fail if server is down
    }, []);

    const startTransition = (user, targetPath) => {
        setTransitionUser(user);
        setShowTransition(true);
        setTransitionStep(0);

        // Progress steps
        setTimeout(() => setTransitionStep(1), 400);
        setTimeout(() => setTransitionStep(2), 900);
        setTimeout(() => setTransitionStep(3), 1500);
        setTimeout(() => setTransitionStep(4), 2000);

        // Navigate after animation
        setTimeout(() => {
            navigate(targetPath);
        }, 2500);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (tab === 'sekolah') {
                // NPSN + password login: call custom endpoint
                const res = await fetch('/api/npsn-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ npsn, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login gagal');

                // Set user state directly in auth store
                const user = {
                    ...data.user,
                    role: data.user.role ? data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1) : 'Sekolah',
                    namaAkun: data.user.name,
                };
                useAuthStore.setState({ user, isAuthenticated: true });
                setSubmitting(false);
                startTransition(user, '/sekolah/dashboard');
            } else {
                // Staff login: use Better Auth email/password
                let loginEmail = email;
                if (!loginEmail.includes('@')) {
                    loginEmail = `${loginEmail}@SARDIKA.cilacapkab.go.id`;
                }
                const user = await authLogin(loginEmail, password);

                if (user) {
                    setSubmitting(false);
                    const rolePath = user.role?.toLowerCase();
                    let target = '/sekolah/dashboard';
                    if (rolePath === 'admin') target = '/admin/dashboard';
                    else if (rolePath === 'verifikator') target = '/verifikator/dashboard';
                    else if (rolePath === 'korwil') target = '/korwil/dashboard';
                    startTransition(user, target);
                }
            }
        } catch (err) {
            toast.error(err.message || 'Login gagal!', {
                style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
            });
            setSubmitting(false);
        }
    };

    const roleOptions = [
        { key: 'admin', label: 'Admin', icon: <Shield size={20} /> },
        { key: 'verifikator', label: 'Verifikator', icon: <UserCheck size={20} /> },
        { key: 'korwil', label: 'Korwil', icon: <Building2 size={20} /> },
    ];

    return (
        <div className="login-page">
            <button className="login-theme-toggle" onClick={toggleTheme} title="Ganti Tema">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* ===== LOGIN TRANSITION OVERLAY ===== */}
            {showTransition && (
                <div className="login-transition-overlay">
                    <div className="login-transition-content">
                        {/* Construction Scene */}
                        <div className="login-transition-scene">
                            <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
                                {/* Ground line */}
                                <line x1="0" y1="170" x2="400" y2="170" stroke="rgba(59,130,246,0.3)" strokeWidth="1" />

                                {/* Building 1 */}
                                <g className={`trans-building ${transitionStep >= 0 ? 'active' : ''}`}>
                                    <rect x="30" y="70" width="45" height="100" rx="2" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
                                    {[0,1,2,3].map(i => (
                                        <g key={`tb1-${i}`}>
                                            <rect x="37" y={80 + i * 22} width="8" height="12" rx="1" fill={transitionStep >= 1 ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.15)'} className="trans-window" style={{ animationDelay: `${i * 0.15}s` }} />
                                            <rect x="50" y={80 + i * 22} width="8" height="12" rx="1" fill={transitionStep >= 1 ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.15)'} className="trans-window" style={{ animationDelay: `${i * 0.15 + 0.08}s` }} />
                                            <rect x="63" y={80 + i * 22} width="5" height="12" rx="1" fill={transitionStep >= 1 ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.1)'} className="trans-window" style={{ animationDelay: `${i * 0.15 + 0.16}s` }} />
                                        </g>
                                    ))}
                                </g>

                                {/* Building 2 */}
                                <g className={`trans-building ${transitionStep >= 1 ? 'active' : ''}`} style={{ animationDelay: '0.3s' }}>
                                    <rect x="90" y="95" width="35" height="75" rx="2" fill="rgba(168,85,247,0.12)" stroke="rgba(168,85,247,0.35)" strokeWidth="1" />
                                    {[0,1,2].map(i => (
                                        <g key={`tb2-${i}`}>
                                            <rect x="97" y={105 + i * 20} width="7" height="10" rx="1" fill={transitionStep >= 2 ? 'rgba(168,85,247,0.5)' : 'rgba(168,85,247,0.15)'} className="trans-window" style={{ animationDelay: `${0.3 + i * 0.15}s` }} />
                                            <rect x="110" y={105 + i * 20} width="7" height="10" rx="1" fill={transitionStep >= 2 ? 'rgba(168,85,247,0.5)' : 'rgba(168,85,247,0.15)'} className="trans-window" style={{ animationDelay: `${0.35 + i * 0.15}s` }} />
                                        </g>
                                    ))}
                                </g>

                                {/* Crane */}
                                <g className={`trans-crane ${transitionStep >= 0 ? 'active' : ''}`}>
                                    <rect x="168" y="20" width="3" height="150" fill="rgba(251,191,36,0.4)" />
                                    <rect x="130" y="20" width="100" height="2.5" fill="rgba(251,191,36,0.35)" />
                                    <rect x="165" y="24" width="9" height="10" rx="1" fill="rgba(251,191,36,0.2)" stroke="rgba(251,191,36,0.4)" strokeWidth="0.5" />
                                    <g className="trans-hook">
                                        <line x1="150" y1="22" x2="150" y2="80" stroke="rgba(251,191,36,0.3)" strokeWidth="0.8" />
                                        <path d="M146,80 L154,80 L152,88 Q150,91 148,88 Z" fill="rgba(251,191,36,0.4)" />
                                    </g>
                                    <line x1="170" y1="20" x2="130" y2="22" stroke="rgba(251,191,36,0.15)" strokeWidth="0.5" />
                                    <line x1="170" y1="20" x2="230" y2="22" stroke="rgba(251,191,36,0.15)" strokeWidth="0.5" />
                                </g>

                                {/* Building under construction */}
                                <g className={`trans-building ${transitionStep >= 2 ? 'active' : ''}`} style={{ animationDelay: '0.6s' }}>
                                    <rect x="220" y="90" width="40" height="80" rx="1" fill="none" stroke="rgba(251,191,36,0.3)" strokeWidth="0.8" strokeDasharray="4 2" />
                                    {[0,1,2].map(i => (
                                        <rect key={`tbr-${i}`} x="222" y={148 - i * 22} width="36" height="18" rx="1"
                                            fill={transitionStep >= 3 ? 'rgba(251,191,36,0.12)' : 'rgba(251,191,36,0.04)'}
                                            stroke="rgba(251,191,36,0.2)" strokeWidth="0.3"
                                            className="trans-brick" style={{ animationDelay: `${0.6 + i * 0.4}s` }} />
                                    ))}
                                </g>

                                {/* School building (final) */}
                                <g className={`trans-building ${transitionStep >= 3 ? 'active' : ''}`} style={{ animationDelay: '0.9s' }}>
                                    <rect x="290" y="110" width="70" height="60" rx="2" fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.35)" strokeWidth="1" />
                                    <polygon points="290,110 325,85 360,110" fill="rgba(34,197,94,0.08)" stroke="rgba(34,197,94,0.3)" strokeWidth="0.8" />
                                    <rect x="310" y="140" width="14" height="30" rx="1" fill="rgba(34,197,94,0.2)" stroke="rgba(34,197,94,0.4)" strokeWidth="0.5" />
                                    {[0,1].map(i => (
                                        <g key={`tbs-${i}`}>
                                            <rect x={298 + i * 38} y="120" width="8" height="10" rx="1" fill={transitionStep >= 4 ? 'rgba(34,197,94,0.5)' : 'rgba(34,197,94,0.15)'} className="trans-window" />
                                        </g>
                                    ))}
                                </g>

                                {/* Welding sparks */}
                                {transitionStep >= 2 && [
                                    { x: 240, y: 130 }, { x: 235, y: 110 }, { x: 248, y: 120 },
                                ].map((s, i) => (
                                    <g key={`ts-${i}`} className="trans-spark" style={{ animationDelay: `${i * 0.5}s` }}>
                                        <line x1={s.x - 4} y1={s.y} x2={s.x + 4} y2={s.y} stroke="rgba(251,191,36,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                                        <line x1={s.x} y1={s.y - 4} x2={s.x} y2={s.y + 4} stroke="rgba(251,191,36,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                                    </g>
                                ))}

                                {/* Particles */}
                                {[
                                    { cx: 60, cy: 50, r: 1.2 }, { cx: 170, cy: 60, r: 1 }, { cx: 310, cy: 70, r: 0.8 },
                                    { cx: 100, cy: 140, r: 0.9 }, { cx: 350, cy: 100, r: 1.1 },
                                ].map((p, i) => (
                                    <circle key={`tp-${i}`} cx={p.cx} cy={p.cy} r={p.r} fill="rgba(255,255,255,0.3)" className="trans-particle" style={{ animationDelay: `${i * 0.3}s` }} />
                                ))}
                            </svg>
                        </div>

                        {/* Progress info */}
                        <div className="login-transition-info">
                            <div className="login-transition-logo">
                                <img src="/favicon.png" alt="Logo" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                                <span>SARDIKA</span>
                            </div>
                            <div className="login-transition-greeting">
                                Sugeng Rawuh, {transitionUser?.namaAkun || transitionUser?.name || 'User'}
                            </div>
                            <div className="login-transition-role">
                                {transitionUser?.role || 'Sekolah'}
                            </div>

                            {/* Progress bar */}
                            <div className="login-transition-progress">
                                <div className="login-transition-progress-bar" style={{ width: `${(transitionStep + 1) * 20}%` }} />
                            </div>

                            {/* Status messages */}
                            <div className="login-transition-status">
                                {transitionStep === 0 && '🔐 Memverifikasi akun...'}
                                {transitionStep === 1 && '📦 Memuat data infrastruktur...'}
                                {transitionStep === 2 && '🏗️ Menyiapkan dashboard...'}
                                {transitionStep === 3 && '🏫 Memuat data sekolah...'}
                                {transitionStep === 4 && '✅ Selamat datang!'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Left Panel */}
            <div className="login-left">
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <img src="/favicon.png" alt="Logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                    </div>
                    <h1>SARDIKA</h1>
                </div>
                <p className="login-subtitle">
                    Sistem Aplikasi Registrasi Data Infrastruktur dan Kelengkapan Aset Pendidikan<br />
                    Dinas Pendidikan dan Kebudayaan Kabupaten Cilacap
                </p>

                <div className="login-stats">
                    <div className="login-stat-card">
                        <div className="login-stat-icon"><MapPin size={18} /></div>
                        <div className="login-stat-value">{stats.kecamatanCount} Kecamatan</div>
                        <div className="login-stat-label">Terdata</div>
                    </div>
                    <div className="login-stat-card">
                        <div className="login-stat-icon"><Building2 size={18} /></div>
                        <div className="login-stat-value">{stats.schoolCount} Sekolah</div>
                        <div className="login-stat-label">Terdaftar</div>
                        {Object.keys(stats.jenjangBreakdown || {}).length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                                {Object.entries(stats.jenjangBreakdown).sort().map(([j, count]) => (
                                    <span key={j} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: 8, color: 'rgba(255,255,255,0.7)' }}>
                                        {j}: {count}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="login-stat-card">
                        <div className="login-stat-icon"><Users size={18} /></div>
                        <div className="login-stat-value">{stats.userCount} User</div>
                        <div className="login-stat-label">Aktif</div>
                    </div>
                    <div className="login-stat-card">
                        <div className="login-stat-icon"><Lock size={18} /></div>
                        <div className="login-stat-value">100%</div>
                        <div className="login-stat-label">Aman</div>
                    </div>
                </div>

                <div className="login-footer">
                    © 2026 Dinas Pendidikan dan Kebudayaan<br />
                    Kabupaten Cilacap, Jawa Tengah
                </div>
            </div>

            {/* Right Panel */}
            <div className="login-right">
                <div className="login-form-card">
                    <h2 className="login-form-title">Sugeng Rawuh</h2>
                    <p className="login-form-subtitle">Silakan masuk untuk melanjutkan</p>

                    <div className="login-tab-switcher">
                        <button className={`login-tab ${tab === 'staff' ? 'active' : ''}`} onClick={() => setTab('staff')}>
                            <Users size={16} /> Staf / Dinas
                        </button>
                        <button className={`login-tab ${tab === 'sekolah' ? 'active' : ''}`} onClick={() => setTab('sekolah')}>
                            <GraduationCap size={16} /> Sekolah
                        </button>
                    </div>

                    <form onSubmit={handleLogin}>
                        {tab === 'staff' && (
                            <div className="login-role-section">
                                <div className="login-role-label">Pilih Peran</div>
                                <div className="login-role-cards">
                                    {roleOptions.map(r => (
                                        <button
                                            type="button"
                                            key={r.key}
                                            className={`login-role-card ${role === r.key ? 'active' : ''}`}
                                            onClick={() => setRole(r.key)}
                                        >
                                            <span className="role-icon">{r.icon}</span>
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {tab === 'staff' ? (
                            <div className="login-field">
                                <label>Email</label>
                                <div className="login-input-wrapper">
                                    <input
                                        type="email"
                                        placeholder="nama@cilacap.go.id"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="login-field">
                                <label>NPSN (Nomor Pokok Sekolah Nasional)</label>
                                <div className="login-input-wrapper">
                                    <input
                                        type="text"
                                        placeholder="Contoh: 20300001"
                                        value={npsn}
                                        onChange={e => setNpsn(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Password field for all tabs */}
                        {(
                            <div className="login-field">
                                <label>Password</label>
                                <div className="login-input-wrapper">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Masukkan password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="login-password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button type="submit" className="login-submit-btn" disabled={submitting}>
                            {submitting ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}
                            {submitting ? 'Memproses...' : `Masuk sebagai ${tab === 'staff' ? roleOptions.find(r => r.key === role)?.label : 'Sekolah'}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;