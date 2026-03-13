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

                toast.success(`Sugeng Rawuh, ${user.namaAkun} (${user.role})`, {
                    duration: 3000,
                    style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
                });
                navigate('/sekolah/data-sarpras');
            } else {
                // Staff login: use Better Auth email/password
                let loginEmail = email;
                if (!loginEmail.includes('@')) {
                    loginEmail = `${loginEmail}@SARDIKA.cilacapkab.go.id`;
                }
                const user = await authLogin(loginEmail, password);

                if (user) {
                    toast.success(`Sugeng Rawuh, ${user.name} (${user.role})`, {
                        duration: 3000,
                        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
                    });
                    const rolePath = user.role?.toLowerCase();
                    if (rolePath === 'admin') navigate('/admin/dashboard');
                    else if (rolePath === 'verifikator') navigate('/verifikator/dashboard');
                    else if (rolePath === 'korwil') navigate('/korwil/dashboard');
                    else navigate('/sekolah/data-sarpras');
                }
            }
        } catch (err) {
            toast.error(err.message || 'Login gagal!', {
                style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
            });
        } finally {
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

            {/* Construction Animation Background */}
            <div className="login-construction-bg" aria-hidden="true">
                <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
                    {/* Ground */}
                    <rect x="0" y="360" width="600" height="40" fill="rgba(255,255,255,0.03)" />
                    <line x1="0" y1="360" x2="600" y2="360" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />

                    {/* Building 1 — tall, animated rise */}
                    <g className="construction-building construction-building-1">
                        <rect x="40" y="160" width="60" height="200" rx="2" fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.2)" strokeWidth="0.5" />
                        {[0,1,2,3,4,5,6].map(i => (
                            <g key={`b1-${i}`}>
                                <rect x="48" y={172 + i * 26} width="12" height="16" rx="1" fill="rgba(59,130,246,0.12)" className="construction-window" style={{ animationDelay: `${i * 0.3}s` }} />
                                <rect x="66" y={172 + i * 26} width="12" height="16" rx="1" fill="rgba(59,130,246,0.12)" className="construction-window" style={{ animationDelay: `${i * 0.3 + 0.15}s` }} />
                                <rect x="84" y={172 + i * 26} width="8" height="16" rx="1" fill="rgba(59,130,246,0.08)" className="construction-window" style={{ animationDelay: `${i * 0.3 + 0.3}s` }} />
                            </g>
                        ))}
                    </g>

                    {/* Building 2 — medium */}
                    <g className="construction-building construction-building-2">
                        <rect x="120" y="220" width="50" height="140" rx="2" fill="rgba(168,85,247,0.07)" stroke="rgba(168,85,247,0.15)" strokeWidth="0.5" />
                        {[0,1,2,3,4].map(i => (
                            <g key={`b2-${i}`}>
                                <rect x="128" y={232 + i * 24} width="10" height="14" rx="1" fill="rgba(168,85,247,0.1)" className="construction-window" style={{ animationDelay: `${i * 0.4 + 1}s` }} />
                                <rect x="144" y={232 + i * 24} width="10" height="14" rx="1" fill="rgba(168,85,247,0.1)" className="construction-window" style={{ animationDelay: `${i * 0.4 + 1.2}s` }} />
                            </g>
                        ))}
                    </g>

                    {/* Building 3 — short wide */}
                    <g className="construction-building construction-building-3">
                        <rect x="460" y="280" width="80" height="80" rx="2" fill="rgba(34,197,94,0.06)" stroke="rgba(34,197,94,0.12)" strokeWidth="0.5" />
                        {[0,1,2].map(i => (
                            <g key={`b3-${i}`}>
                                <rect x="470" y={292 + i * 22} width="10" height="14" rx="1" fill="rgba(34,197,94,0.1)" className="construction-window" style={{ animationDelay: `${i * 0.5 + 2}s` }} />
                                <rect x="486" y={292 + i * 22} width="10" height="14" rx="1" fill="rgba(34,197,94,0.1)" className="construction-window" style={{ animationDelay: `${i * 0.5 + 2.1}s` }} />
                                <rect x="502" y={292 + i * 22} width="10" height="14" rx="1" fill="rgba(34,197,94,0.08)" className="construction-window" style={{ animationDelay: `${i * 0.5 + 2.2}s` }} />
                                <rect x="518" y={292 + i * 22} width="10" height="14" rx="1" fill="rgba(34,197,94,0.1)" className="construction-window" style={{ animationDelay: `${i * 0.5 + 2.3}s` }} />
                            </g>
                        ))}
                    </g>

                    {/* Building 4 — under construction */}
                    <g className="construction-building construction-building-4">
                        <rect x="340" y="200" width="55" height="160" rx="1" fill="none" stroke="rgba(251,191,36,0.15)" strokeWidth="0.5" strokeDasharray="4 2" />
                        {/* Scaffolding lines */}
                        {[0,1,2,3,4].map(i => (
                            <line key={`sc-${i}`} x1="340" y1={200 + i * 32} x2="395" y2={200 + i * 32} stroke="rgba(251,191,36,0.12)" strokeWidth="0.5" />
                        ))}
                        <line x1="355" y1="200" x2="355" y2="360" stroke="rgba(251,191,36,0.1)" strokeWidth="0.5" />
                        <line x1="380" y1="200" x2="380" y2="360" stroke="rgba(251,191,36,0.1)" strokeWidth="0.5" />
                        {/* Bricks filling up */}
                        {[0,1,2,3].map(i => (
                            <rect key={`brick-${i}`} x="342" y={330 - i * 28} width="51" height="24" rx="1" fill="rgba(251,191,36,0.05)" stroke="rgba(251,191,36,0.1)" strokeWidth="0.3" className="construction-brick" style={{ animationDelay: `${i * 1.5}s` }} />
                        ))}
                    </g>

                    {/* Crane */}
                    <g className="construction-crane">
                        {/* Crane vertical pole */}
                        <rect x="268" y="40" width="4" height="320" fill="rgba(251,191,36,0.2)" />
                        {/* Crane arm */}
                        <rect x="200" y="40" width="180" height="3" fill="rgba(251,191,36,0.18)" />
                        {/* Crane cabin */}
                        <rect x="264" y="44" width="12" height="14" rx="1" fill="rgba(251,191,36,0.12)" stroke="rgba(251,191,36,0.2)" strokeWidth="0.5" />
                        {/* Crane cable + hook */}
                        <g className="construction-hook">
                            <line x1="230" y1="43" x2="230" y2="120" stroke="rgba(251,191,36,0.15)" strokeWidth="0.8" />
                            <path d="M225,120 L235,120 L232,130 Q230,134 228,130 Z" fill="rgba(251,191,36,0.2)" />
                        </g>
                        {/* Counter weight */}
                        <rect x="360" y="36" width="16" height="10" rx="1" fill="rgba(251,191,36,0.1)" />
                        {/* Support cables */}
                        <line x1="270" y1="40" x2="200" y2="42" stroke="rgba(251,191,36,0.08)" strokeWidth="0.5" />
                        <line x1="270" y1="40" x2="380" y2="42" stroke="rgba(251,191,36,0.08)" strokeWidth="0.5" />
                    </g>

                    {/* Floating particles / dust */}
                    {[
                        { cx: 80, cy: 150, r: 1.5, dur: '6s', delay: '0s' },
                        { cx: 200, cy: 100, r: 1, dur: '8s', delay: '1s' },
                        { cx: 320, cy: 180, r: 1.2, dur: '7s', delay: '2s' },
                        { cx: 450, cy: 120, r: 0.8, dur: '9s', delay: '0.5s' },
                        { cx: 150, cy: 300, r: 1, dur: '5s', delay: '3s' },
                        { cx: 500, cy: 250, r: 1.3, dur: '6.5s', delay: '1.5s' },
                        { cx: 380, cy: 80, r: 0.7, dur: '7.5s', delay: '4s' },
                        { cx: 550, cy: 180, r: 1, dur: '8.5s', delay: '2.5s' },
                    ].map((p, i) => (
                        <circle key={`particle-${i}`} cx={p.cx} cy={p.cy} r={p.r} fill="rgba(255,255,255,0.15)" className="construction-particle" style={{ animationDuration: p.dur, animationDelay: p.delay }} />
                    ))}

                    {/* Sparkle effects on construction site */}
                    {[
                        { x: 365, y: 290, delay: '0s' },
                        { x: 350, y: 260, delay: '2s' },
                        { x: 375, y: 235, delay: '4s' },
                    ].map((s, i) => (
                        <g key={`spark-${i}`} className="construction-spark" style={{ animationDelay: s.delay }}>
                            <line x1={s.x - 3} y1={s.y} x2={s.x + 3} y2={s.y} stroke="rgba(251,191,36,0.4)" strokeWidth="1" strokeLinecap="round" />
                            <line x1={s.x} y1={s.y - 3} x2={s.x} y2={s.y + 3} stroke="rgba(251,191,36,0.4)" strokeWidth="1" strokeLinecap="round" />
                        </g>
                    ))}
                </svg>
            </div>

            {/* Left Panel */}
            <div className="login-left">
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <School size={28} />
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