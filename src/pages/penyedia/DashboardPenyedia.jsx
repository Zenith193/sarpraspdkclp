import { useState, useEffect } from 'react';
import { Building2, CheckCircle, Clock, FileText, Send, Eye, XCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { kontrakApi } from '../../api';

const DashboardPenyedia = () => {
    const user = useAuthStore(s => s.user);
    const navigate = useNavigate();
    const [perusahaan, setPerusahaan] = useState(null);
    const [stats, setStats] = useState({ total: 0, menunggu: 0, diverifikasi: 0, ditolak: 0 });
    const [permohonanAktif, setPermohonanAktif] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [pRes, sRes, lRes] = await Promise.all([
                    fetch('/api/perusahaan', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
                    kontrakApi.getStats().then(r => r.data).catch(() => ({ total: 0, menunggu: 0, diverifikasi: 0, ditolak: 0 })),
                    kontrakApi.listPermohonan().then(r => r.data).catch(() => []),
                ]);
                const mine = Array.isArray(pRes) ? pRes.find(p => p.userId === user?.id) : null;
                setPerusahaan(mine);
                setStats(sRes);
                setPermohonanAktif(Array.isArray(lRes) ? lRes.filter(p => p.status === 'Menunggu') : []);
            } catch { }
            setLoading(false);
        };
        load();
    }, [user]);

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 className="page-title">Dashboard Penyedia</h1>
                    <p className="page-subtitle">Selamat datang, {user?.name || 'Penyedia'}</p>
                </div>
                {perusahaan?.status === 'Diverifikasi' && (
                    <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: '0.95rem', fontWeight: 600 }}
                        onClick={() => navigate('/penyedia/permohonan-kontrak')}>
                        <Send size={18} /> AJUKAN PERMOHONAN KONTRAK
                    </button>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Memuat data...</div>
            ) : (
                <>
                    {/* Info Perusahaan + Status */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 32 }}>
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
                                    ['Pemilik', perusahaan?.namaPemilik],
                                    ['Alamat', perusahaan?.alamatPerusahaan],
                                    ['No. Telepon', perusahaan?.noTelp],
                                    ['Email', perusahaan?.emailPerusahaan],
                                    ['NPWP', perusahaan?.npwp],
                                ].map(([label, val]) => val ? (
                                    <div key={label} style={{ display: 'flex', gap: 8, fontSize: '0.875rem' }}>
                                        <span style={{ color: 'var(--text-secondary)', minWidth: 90 }}>{label}:</span>
                                        <span style={{ color: 'var(--text-primary)' }}>{val}</span>
                                    </div>
                                ) : null)}
                            </div>
                        </div>

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

                    {/* Stats Cards */}
                    {perusahaan?.status === 'Diverifikasi' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
                            {[
                                { label: 'Total Permohonan', value: stats.total, icon: FileText, color: 'var(--accent-blue)' },
                                { label: 'Menunggu', value: stats.menunggu, icon: Clock, color: 'var(--accent-yellow)' },
                                { label: 'Diverifikasi', value: stats.diverifikasi, icon: CheckCircle, color: 'var(--accent-green)' },
                                { label: 'Ditolak', value: stats.ditolak, icon: XCircle, color: 'var(--accent-red, #ef4444)' },
                            ].map(s => (
                                <div key={s.label} className="stat-card" style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <s.icon size={22} style={{ color: s.color }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Permohonan Aktif */}
                    {permohonanAktif.length > 0 && (
                        <div className="stat-card" style={{ padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FileText size={20} style={{ color: 'var(--accent-blue)' }} />
                                    Permohonan Kontrak Dalam Proses
                                </h3>
                                <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Total: {permohonanAktif.length} permohonan</span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>NO.</th>
                                            <th>KODE SIRUP</th>
                                            <th>NAMA PAKET</th>
                                            <th>JENIS PENGADAAN</th>
                                            <th>METODE</th>
                                            <th>TANGGAL</th>
                                            <th>AKSI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {permohonanAktif.map((p, i) => (
                                            <tr key={p.id}>
                                                <td>{i + 1}</td>
                                                <td style={{ fontWeight: 600 }}>{p.kodeSirup}</td>
                                                <td>{p.namaPaket}</td>
                                                <td>{p.jenisPengadaan}</td>
                                                <td>{p.metodePengadaan}</td>
                                                <td>{formatDate(p.createdAt)}</td>
                                                <td>
                                                    <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}
                                                        onClick={() => navigate(`/penyedia/riwayat-kontrak`)}>
                                                        <Eye size={14} /> Detail
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default DashboardPenyedia;
