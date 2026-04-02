import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowLeft, CheckCircle, Clock, XCircle, Building2, Loader2, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import useThemeStore from '../store/themeStore';

const formatNpwp = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 15);
    let fmt = '';
    for (let i = 0; i < digits.length; i++) {
        if (i === 2 || i === 5 || i === 8) fmt += '.';
        if (i === 9) fmt += '-';
        if (i === 12) fmt += '.';
        fmt += digits[i];
    }
    return fmt;
};

const CekVerifikasi = () => {
    const [npwp, setNpwp] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const { theme, toggleTheme } = useThemeStore();

    const handleCheck = async (e) => {
        e.preventDefault();
        if (!npwp.trim()) { toast.error('Masukkan NPWP perusahaan'); return; }
        setLoading(true);
        setResult(null);
        setSearched(true);
        try {
            const res = await fetch(`/api/perusahaan/check/${encodeURIComponent(npwp.trim())}`);
            const data = await res.json();
            if (!res.ok) {
                setResult({ error: data.error || 'NPWP tidak ditemukan' });
            } else {
                setResult(data);
            }
        } catch (err) {
            setResult({ error: 'Gagal menghubungi server' });
        } finally {
            setLoading(false);
        }
    };

    const statusConfig = {
        'Menunggu': { icon: <Clock size={32} />, color: 'var(--accent-yellow)', bg: 'rgba(251,191,36,0.12)', label: 'Menunggu Verifikasi', desc: 'Data perusahaan Anda sedang dalam antrian verifikasi oleh admin.' },
        'Diverifikasi': { icon: <CheckCircle size={32} />, color: 'var(--accent-green)', bg: 'rgba(34,197,94,0.12)', label: 'Diverifikasi', desc: 'Selamat! Perusahaan Anda telah diverifikasi. Silakan login untuk mengakses sistem.' },
        'Ditolak': { icon: <XCircle size={32} />, color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.12)', label: 'Ditolak', desc: 'Mohon maaf, registrasi Anda ditolak. Periksa keterangan di bawah.' },
    };

    return (
        <div className="login-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
            <button className="login-theme-toggle" onClick={toggleTheme} title="Ganti Tema" style={{ position: 'fixed', top: 16, right: 16, zIndex: 100 }}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
                {/* Header */}
                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-blue)', fontSize: '0.875rem', marginBottom: 24, textDecoration: 'none' }}>
                    <ArrowLeft size={16} /> Kembali ke Login
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
                    <img src="/favicon.png" alt="Logo" style={{ width: 32, height: 42, objectFit: 'contain' }} />
                    <h1 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary)' }}>SARDIKA</h1>
                </div>
                <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)', fontSize: '0.78rem', fontWeight: 600, marginBottom: 12 }}>Verifikasi</div>
                <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800 }}>CEK VERIFIKASI PERUSAHAAN</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 32 }}>Cek status verifikasi Perusahaan anda dengan memasukkan <em>NPWP</em> pada form di bawah ini.</p>

                {/* Form */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', textAlign: 'left' }}>
                    <form onSubmit={handleCheck}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>NPWP <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                            <div style={{ position: 'relative' }}>
                                <Building2 size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input className="form-input" placeholder="Masukkan NPWP (contoh: 93.290.382.0-382.323)" value={npwp} onChange={e => setNpwp(formatNpwp(e.target.value))} style={{ paddingLeft: 36 }} />
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6 }}>Contoh format: 93.290.382.0-382.323</div>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8, padding: '12px 20px' }}>
                            {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                            {loading ? 'Memeriksa...' : 'CEK STATUS'}
                        </button>
                    </form>
                </div>

                {/* Result */}
                {searched && !loading && result && (
                    <div style={{ marginTop: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 28, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                        {result.error ? (
                            <>
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <XCircle size={32} style={{ color: 'var(--accent-red)' }} />
                                </div>
                                <h3 style={{ color: 'var(--accent-red)', marginBottom: 8 }}>Tidak Ditemukan</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{result.error}</p>
                                <Link to="/registrasi-penyedia" className="btn btn-secondary" style={{ marginTop: 16 }}>Daftar Sekarang</Link>
                            </>
                        ) : (
                            <>
                                {(() => {
                                    const cfg = statusConfig[result.status] || statusConfig['Menunggu'];
                                    return (
                                        <>
                                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: cfg.color }}>
                                                {cfg.icon}
                                            </div>
                                            <h3 style={{ color: cfg.color, marginBottom: 4 }}>{cfg.label}</h3>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 16 }}>{cfg.desc}</p>
                                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'left' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.85rem' }}>
                                                    <div><strong style={{ color: 'var(--text-secondary)' }}>Perusahaan:</strong></div>
                                                    <div style={{ color: 'var(--text-primary)' }}>{result.namaPerusahaan}</div>
                                                    <div><strong style={{ color: 'var(--text-secondary)' }}>NPWP:</strong></div>
                                                    <div style={{ color: 'var(--text-primary)' }}>{result.npwp}</div>
                                                    <div><strong style={{ color: 'var(--text-secondary)' }}>Terdaftar:</strong></div>
                                                    <div style={{ color: 'var(--text-primary)' }}>{result.createdAt ? new Date(result.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</div>
                                                </div>
                                                {result.keteranganVerifikasi && (
                                                    <div style={{ marginTop: 12, padding: '10px 12px', background: result.status === 'Ditolak' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                                                        <strong>Keterangan:</strong> {result.keteranganVerifikasi}
                                                    </div>
                                                )}
                                            </div>
                                            {result.status === 'Diverifikasi' && (
                                                <Link to="/login" className="btn btn-primary" style={{ marginTop: 16 }}>Login Sekarang</Link>
                                            )}
                                        </>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div style={{ marginTop: 32, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Belum mendaftar? <Link to="/registrasi-penyedia" style={{ color: 'var(--accent-blue)' }}>Registrasi Perusahaan</Link>
                </div>
            </div>
        </div>
    );
};

export default CekVerifikasi;
