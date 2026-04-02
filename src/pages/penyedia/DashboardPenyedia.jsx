import { useState, useEffect } from 'react';
import { Building2, CheckCircle, Clock, FileText, User } from 'lucide-react';
import useAuthStore from '../../store/authStore';

const DashboardPenyedia = () => {
    const user = useAuthStore(s => s.user);
    const [perusahaan, setPerusahaan] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Try to fetch company info linked to this user
        fetch('/api/perusahaan', { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                // Find the one linked to current user
                const mine = Array.isArray(data) ? data.find(p => p.userId === user?.id) : null;
                setPerusahaan(mine);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [user]);

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard Penyedia</h1>
                    <p className="page-subtitle">Selamat datang, {user?.name || 'Penyedia'}</p>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Memuat data...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                    {/* Profile Card */}
                    <div className="stat-card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Building2 size={28} style={{ color: 'var(--accent-blue)' }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{perusahaan?.namaPerusahaan || user?.name || '-'}</h3>
                                {perusahaan?.namaPerusahaanSingkat && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{perusahaan.namaPerusahaanSingkat}</div>}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gap: 10 }}>
                            {[
                                ['NPWP', perusahaan?.npwp],
                                ['Pemilik', perusahaan?.namaPemilik],
                                ['Alamat', perusahaan?.alamatPerusahaan],
                                ['Telepon', perusahaan?.noTelp],
                                ['Email', perusahaan?.emailPerusahaan],
                            ].map(([label, val]) => val ? (
                                <div key={label} style={{ display: 'flex', gap: 8, fontSize: '0.875rem' }}>
                                    <span style={{ color: 'var(--text-secondary)', width: 80 }}>{label}:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{val}</span>
                                </div>
                            ) : null)}
                        </div>
                    </div>

                    {/* Status Card */}
                    <div className="stat-card" style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        {perusahaan?.status === 'Diverifikasi' ? (
                            <>
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <CheckCircle size={32} style={{ color: 'var(--accent-green)' }} />
                                </div>
                                <h3 style={{ color: 'var(--accent-green)', marginBottom: 8 }}>Akun Terverifikasi</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Perusahaan Anda telah diverifikasi oleh Admin Dinas Pendidikan.</p>
                            </>
                        ) : (
                            <>
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(251,191,36,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <Clock size={32} style={{ color: 'var(--accent-yellow)' }} />
                                </div>
                                <h3 style={{ color: 'var(--accent-yellow)', marginBottom: 8 }}>Menunggu Verifikasi</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Data perusahaan Anda sedang ditinjau. Hubungi admin untuk informasi lebih lanjut.</p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardPenyedia;
