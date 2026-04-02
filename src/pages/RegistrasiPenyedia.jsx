import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, User, CreditCard, Lock, Eye, EyeOff, Loader2, CheckCircle, ArrowLeft, FileText, Phone, Mail, MapPin, Hash, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import useThemeStore from '../store/themeStore';

const INITIAL = {
    nikPemilik: '', namaPemilik: '', jabatanPemilik: 'Direktur', jabatanManual: '', alamatPemilik: '',
    namaPerusahaan: '', namaPerusahaanSingkat: '',
    noAkta: '', namaNotaris: '', tanggalAkta: '',
    alamatPerusahaan: '', noTelp: '', emailPerusahaan: '', npwp: '',
    noRekening: '', namaRekening: '', bank: '',
    email: '', password: '', confirmPassword: '',
    agree: false,
};

// Auto-format NPWP: 93.290.382.0-382.323
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

const RegistrasiPenyedia = () => {
    const [form, setForm] = useState(INITIAL);
    const [showPw, setShowPw] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();
    const { theme, toggleTheme } = useThemeStore();

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.agree) { toast.error('Anda harus menyetujui pernyataan kebenaran data'); return; }
        if (!form.npwp) { toast.error('NPWP wajib diisi'); return; }
        if (!form.namaPerusahaan) { toast.error('Nama perusahaan wajib diisi'); return; }
        if (!form.email) { toast.error('Email wajib diisi'); return; }
        if (!form.password || form.password.length < 6) { toast.error('Password minimal 6 karakter'); return; }
        if (form.password !== form.confirmPassword) { toast.error('Password dan konfirmasi tidak cocok'); return; }

        setSubmitting(true);
        try {
            const payload = { ...form };
            if (payload.jabatanPemilik === '_manual') {
                payload.jabatanPemilik = payload.jabatanManual || 'Lainnya';
            }
            delete payload.jabatanManual;

            const res = await fetch('/api/perusahaan/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registrasi gagal');
            setSuccess(true);
            toast.success('Registrasi berhasil!');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="login-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ maxWidth: 500, width: '100%', padding: 40, textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <CheckCircle size={40} style={{ color: 'var(--accent-green)' }} />
                    </div>
                    <h2 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>Registrasi Berhasil!</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Data perusahaan Anda telah diterima dan sedang menunggu verifikasi oleh admin.</p>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: '0.875rem' }}>Anda dapat mengecek status verifikasi melalui halaman <strong>Cek Verifikasi</strong> dengan memasukkan NPWP perusahaan.</p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <Link to="/cek-verifikasi" className="btn btn-primary">Cek Verifikasi</Link>
                        <Link to="/login" className="btn btn-secondary">Ke Halaman Login</Link>
                    </div>
                </div>
            </div>
        );
    }

    const sectionStyle = { marginBottom: 32 };
    const sectionTitle = (icon, text) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
            {icon}
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{text}</h3>
        </div>
    );

    return (
        <div className="login-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px' }}>
            <button className="login-theme-toggle" onClick={toggleTheme} title="Ganti Tema" style={{ position: 'fixed', top: 16, right: 16, zIndex: 100 }}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 32, maxWidth: 600 }}>
                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-blue)', fontSize: '0.875rem', marginBottom: 16, textDecoration: 'none' }}>
                    <ArrowLeft size={16} /> Kembali ke Login
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
                    <img src="/favicon.png" alt="Logo" style={{ width: 36, height: 46, objectFit: 'contain' }} />
                    <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>SARDIKA</h1>
                </div>
                <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Registrasi Perusahaan</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Daftarkan perusahaan Anda sebagai Penyedia di sistem SARDIKA</p>
            </div>

            {/* Form Card */}
            <div style={{ maxWidth: 720, width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '32px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                <form onSubmit={handleSubmit}>
                    {/* Section 1: Data Pemilik */}
                    <div style={sectionStyle}>
                        {sectionTitle(<User size={20} style={{ color: 'var(--accent-blue)' }} />, 'Data Pemilik / Direktur')}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group"><label className="form-label">NIK <span style={{ color: 'var(--accent-red)' }}>*</span></label><input className="form-input" placeholder="Nomor Induk Kependudukan" value={form.nikPemilik} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 16); set('nikPemilik', v); }} maxLength={16} required /><div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>Maks. 16 digit angka</div></div>
                            <div className="form-group"><label className="form-label">Nama Lengkap <span style={{ color: 'var(--accent-red)' }}>*</span></label><input className="form-input" placeholder="Nama sesuai KTP" value={form.namaPemilik} onChange={e => set('namaPemilik', e.target.value)} required /></div>
                            <div className="form-group"><label className="form-label">Jabatan</label><select className="form-select" value={form.jabatanPemilik} onChange={e => set('jabatanPemilik', e.target.value)}><option>Direktur</option><option>Kepala Cabang</option><option value="_manual">Input Manual...</option></select>{form.jabatanPemilik === '_manual' && <input className="form-input" style={{ marginTop: 8 }} placeholder="Ketik jabatan..." value={form.jabatanManual} onChange={e => set('jabatanManual', e.target.value)} />}</div>
                            <div className="form-group"><label className="form-label">Alamat (sesuai KTP)</label><input className="form-input" placeholder="Alamat lengkap" value={form.alamatPemilik} onChange={e => set('alamatPemilik', e.target.value)} /></div>
                        </div>
                    </div>

                    {/* Section 2: Data Perusahaan */}
                    <div style={sectionStyle}>
                        {sectionTitle(<Building2 size={20} style={{ color: 'var(--accent-purple)' }} />, 'Data Perusahaan')}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group"><label className="form-label">Nama Perusahaan (Lengkap) <span style={{ color: 'var(--accent-red)' }}>*</span></label><input className="form-input" placeholder="PT/CV ..." value={form.namaPerusahaan} onChange={e => set('namaPerusahaan', e.target.value)} required /></div>
                            <div className="form-group"><label className="form-label">Nama Perusahaan (Singkat)</label><input className="form-input" placeholder="Singkatan" value={form.namaPerusahaanSingkat} onChange={e => set('namaPerusahaanSingkat', e.target.value)} /></div>
                            <div className="form-group"><label className="form-label">No. Akta Notaris</label><input className="form-input" placeholder="Nomor akta" value={form.noAkta} onChange={e => set('noAkta', e.target.value)} /></div>
                            <div className="form-group"><label className="form-label">Nama Notaris</label><input className="form-input" placeholder="Nama notaris" value={form.namaNotaris} onChange={e => set('namaNotaris', e.target.value)} /></div>
                            <div className="form-group"><label className="form-label">Tanggal Akta</label><input className="form-input" type="date" value={form.tanggalAkta} onChange={e => set('tanggalAkta', e.target.value)} /></div>
                            <div className="form-group"><label className="form-label">NPWP Perusahaan <span style={{ color: 'var(--accent-red)' }}>*</span></label><input className="form-input" placeholder="93.290.382.0-382.323" value={form.npwp} onChange={e => set('npwp', formatNpwp(e.target.value))} required /><div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>Format: 93.290.382.0-382.323</div></div>
                        </div>
                        <div className="form-group" style={{ marginTop: 16 }}><label className="form-label">Alamat Perusahaan</label><input className="form-input" placeholder="Alamat kantor lengkap" value={form.alamatPerusahaan} onChange={e => set('alamatPerusahaan', e.target.value)} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                            <div className="form-group"><label className="form-label">No. Telepon</label><input className="form-input" placeholder="081234567890" value={form.noTelp} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 13); set('noTelp', v); }} maxLength={13} /><div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>Maks. 13 digit angka</div></div>
                            <div className="form-group"><label className="form-label">Email Perusahaan</label><input className="form-input" type="email" placeholder="info@perusahaan.com" value={form.emailPerusahaan} onChange={e => set('emailPerusahaan', e.target.value)} /></div>
                        </div>
                    </div>

                    {/* Section 3: Data Rekening */}
                    <div style={sectionStyle}>
                        {sectionTitle(<CreditCard size={20} style={{ color: 'var(--accent-green)' }} />, 'Data Rekening')}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                            <div className="form-group"><label className="form-label">Bank</label><input className="form-input" placeholder="Ketik nama bank sesuai rekening koran" value={form.bank} onChange={e => set('bank', e.target.value)} /></div>
                            <div className="form-group"><label className="form-label">Nomor Rekening</label><input className="form-input" placeholder="123456789" value={form.noRekening} onChange={e => set('noRekening', e.target.value)} /></div>
                            <div className="form-group"><label className="form-label">Nama Pemilik Rekening</label><input className="form-input" placeholder="Atas nama..." value={form.namaRekening} onChange={e => set('namaRekening', e.target.value)} /></div>
                        </div>
                    </div>

                    {/* Section 4: Akun Login */}
                    <div style={sectionStyle}>
                        {sectionTitle(<Lock size={20} style={{ color: 'var(--accent-yellow)' }} />, 'Akun Login')}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Email Login <span style={{ color: 'var(--accent-red)' }}>*</span></label><input className="form-input" type="email" placeholder="email@anda.com" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
                            <div className="form-group">
                                <label className="form-label">Password <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                                <div style={{ position: 'relative' }}>
                                    <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Minimal 6 karakter" value={form.password} onChange={e => set('password', e.target.value)} required style={{ paddingRight: 40 }} />
                                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                                </div>
                            </div>
                            <div className="form-group"><label className="form-label">Konfirmasi Password <span style={{ color: 'var(--accent-red)' }}>*</span></label><input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Ketik ulang password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} required /></div>
                        </div>
                    </div>

                    {/* Agreement */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 24, border: '1px solid var(--border-color)' }}>
                        <label style={{ display: 'flex', gap: 12, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            <input type="checkbox" checked={form.agree} onChange={e => set('agree', e.target.checked)} style={{ marginTop: 4, accentColor: 'var(--accent-blue)' }} />
                            <span>Dengan ini saya menyatakan bahwa data yang saya sampaikan adalah <strong>benar</strong> sesuai dengan fakta yang ada, dan apabila dikemudian hari data perusahaan yang saya sampaikan tidak benar, maka saya bersedia untuk diproses secara hukum sesuai dengan ketentuan Undang-Undang yang berlaku.</span>
                        </label>
                    </div>

                    {/* Submit */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Link to="/login" style={{ color: 'var(--accent-blue)', fontSize: '0.875rem' }}>Sudah punya akun? Login</Link>
                        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 200 }}>
                            {submitting ? <Loader2 size={16} className="spin" /> : <CheckCircle size={16} />}
                            {submitting ? 'Mendaftar...' : 'Daftar Sekarang'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: 32, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                © 2026 Dinas Pendidikan dan Kebudayaan Kabupaten Cilacap
            </div>
        </div>
    );
};

export default RegistrasiPenyedia;
