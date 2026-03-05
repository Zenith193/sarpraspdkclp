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
    const [stats, setStats] = useState({ schoolCount: 0, userCount: 0, kecamatanCount: 0 });
    const navigate = useNavigate();
    const authLogin = useAuthStore(s => s.login);
    const { theme, toggleTheme } = useThemeStore();

    // Stats are populated after login or from public endpoint
    // Pre-auth calls removed to avoid 401 redirect loops

    const handleLogin = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // For sekolah tab, use NPSN as email (convention from our user setup)
            const loginEmail = tab === 'sekolah' ? npsn : email;
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
        } catch (err) {
            toast.error(err.message || 'Email/NPSN atau password salah!', {
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

            {/* Left Panel */}
            <div className="login-left">
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <School size={28} />
                    </div>
                    <h1>SPIDOL</h1>
                </div>
                <p className="login-subtitle">
                    Sistem Pengelolaan Informasi Data Sarana Prasarana Online<br />
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