import { useMemo } from 'react';
import { School, Database, FileText, History, AlertCircle, CheckCircle, Clock, TrendingUp, Award } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { useSarprasData, useProposalData, useRiwayatBantuanData, useSekolahData } from '../../data/dataProvider';

const DashboardSekolah = () => {
    const user = useAuthStore(s => s.user);
    const npsn = user?.npsn || user?.email; // sekolah login uses NPSN as email
    const { data: sekolahList } = useSekolahData();
    const sekolah = sekolahList.find(s => s.npsn === npsn);
    const namaSekolah = sekolah?.nama || user?.namaAkun || user?.name || 'Sekolah';

    const { data: sarprasData } = useSarprasData();
    const { data: proposalData } = useProposalData();
    const { data: riwayatData } = useRiwayatBantuanData();

    // Filter data for this school
    const mySarpras = useMemo(() =>
        (sarprasData || []).filter(s => s.npsn === npsn), [sarprasData, npsn]);
    const myProposal = useMemo(() =>
        (proposalData || []).filter(p => p.npsn === npsn), [proposalData, npsn]);
    const myRiwayat = useMemo(() =>
        (riwayatData || []).filter(r => r.npsn === npsn), [riwayatData, npsn]);

    // Stats
    const totalSarpras = mySarpras.length;
    const rusakBerat = mySarpras.filter(s => s.kondisi === 'Rusak Berat').length;
    const rusakSedang = mySarpras.filter(s => s.kondisi === 'Rusak Sedang').length;
    const proposalPending = myProposal.filter(p => !p.status || p.status === 'Pending' || p.status === 'Diajukan').length;
    const proposalDisetujui = myProposal.filter(p => p.status === 'Disetujui' || p.status === 'Diterima').length;
    const totalBantuan = myRiwayat.reduce((sum, r) => sum + (r.nilaiPaket || 0), 0);

    const statCards = [
        { label: 'Total Sarpras', value: totalSarpras, icon: <Database size={20} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
        { label: 'Rusak Berat', value: rusakBerat, icon: <AlertCircle size={20} />, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
        { label: 'Proposal Diajukan', value: proposalPending, icon: <Clock size={20} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
        { label: 'Proposal Disetujui', value: proposalDisetujui, icon: <CheckCircle size={20} />, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
    ];

    const formatRupiah = (n) => n ? `Rp ${n.toLocaleString('id-ID')}` : 'Rp 0';

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard Sekolah</h1>
                    <p>Ringkasan data milik {namaSekolah}</p>
                </div>
            </div>

            {/* School Info Card */}
            {sekolah && (
                <div className="table-container" style={{ padding: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: 14,
                            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '1.4rem', fontWeight: 700, flexShrink: 0
                        }}>
                            <School size={28} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>{sekolah.nama}</div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <span>NPSN: <strong>{sekolah.npsn}</strong></span>
                                <span>Jenjang: <strong>{sekolah.jenjang}</strong></span>
                                <span>Kecamatan: <strong>{sekolah.kecamatan}</strong></span>
                                <span>Kepsek: <strong>{sekolah.kepsek}</strong></span>
                            </div>
                        </div>
                        <div style={{
                            background: sekolah.jenjang === 'SD' ? '#dbeafe' : '#ede9fe',
                            color: sekolah.jenjang === 'SD' ? '#1d4ed8' : '#6d28d9',
                            padding: '6px 16px', borderRadius: 20,
                            fontSize: '0.8rem', fontWeight: 700
                        }}>
                            {sekolah.jenjang}
                        </div>
                    </div>
                </div>
            )}

            {/* Stat Cards */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
                {statCards.map(s => (
                    <div key={s.label} className="stat-card">
                        <div className="stat-label">
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: s.color }}>{s.icon}</span>
                                {s.label}
                            </span>
                        </div>
                        <div className="stat-value">{s.value}</div>
                    </div>
                ))}
            </div>

            <div className="charts-grid">
                {/* Sarpras Data */}
                <div className="table-container">
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Database size={16} style={{ color: '#3b82f6' }} />
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Data Sarpras</h3>
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{totalSarpras} item</span>
                    </div>

                    {mySarpras.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            <Database size={32} style={{ opacity: 0.2, marginBottom: 8 }} /><br />
                            Belum ada data sarpras
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Jenis Prasarana</th>
                                        <th>Kondisi</th>
                                        <th>Lantai</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mySarpras.slice(0, 8).map(s => (
                                        <tr key={s.id}>
                                            <td style={{ fontSize: '0.85rem' }}>{s.jenisPrasarana || s.namaPrasarana}</td>
                                            <td>
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                                                    background: s.kondisi === 'Rusak Berat' ? 'rgba(239,68,68,0.1)' : s.kondisi === 'Rusak Sedang' ? 'rgba(245,158,11,0.1)' : s.kondisi === 'Rusak Ringan' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                                                    color: s.kondisi === 'Rusak Berat' ? '#ef4444' : s.kondisi === 'Rusak Sedang' ? '#f59e0b' : s.kondisi === 'Rusak Ringan' ? '#22c55e' : '#3b82f6'
                                                }}>
                                                    {s.kondisi}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.85rem' }}>{s.lantai || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {mySarpras.length > 8 && (
                                <div style={{ padding: 10, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    +{mySarpras.length - 8} data lainnya
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Proposal & Riwayat */}
                <div>
                    {/* Proposals */}
                    <div className="table-container" style={{ marginBottom: 16 }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={16} style={{ color: '#f59e0b' }} />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Proposal Terbaru</h3>
                        </div>

                        {myProposal.length === 0 ? (
                            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                <FileText size={28} style={{ opacity: 0.2, marginBottom: 6 }} /><br />
                                Belum ada proposal
                            </div>
                        ) : (
                            <div style={{ padding: '8px 16px' }}>
                                {myProposal.slice(0, 5).map(p => {
                                    const statusColor = p.status === 'Disetujui' || p.status === 'Diterima' ? '#22c55e'
                                        : p.status === 'Ditolak' ? '#ef4444' : '#f59e0b';
                                    return (
                                        <div key={p.id} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 0', borderBottom: '1px solid var(--bg-secondary)',
                                            fontSize: '0.85rem'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{p.jenisPrasarana || p.namaPrasarana || 'Proposal'}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString('id-ID') : '-'}
                                                </div>
                                            </div>
                                            <span style={{
                                                background: `${statusColor}15`, color: statusColor,
                                                padding: '3px 10px', borderRadius: 10,
                                                fontSize: '0.72rem', fontWeight: 600
                                            }}>
                                                {p.status || 'Pending'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Riwayat Bantuan */}
                    <div className="table-container">
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <History size={16} style={{ color: '#22c55e' }} />
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Riwayat Bantuan</h3>
                        </div>

                        {myRiwayat.length === 0 ? (
                            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                <History size={28} style={{ opacity: 0.2, marginBottom: 6 }} /><br />
                                Belum ada riwayat bantuan
                            </div>
                        ) : (
                            <div style={{ padding: '8px 16px' }}>
                                {myRiwayat.map(r => (
                                    <div key={r.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 0', borderBottom: '1px solid var(--bg-secondary)',
                                        fontSize: '0.85rem'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{r.namaPaket}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                                {r.volumePaket}
                                            </div>
                                        </div>
                                        <span style={{ fontWeight: 600, color: '#22c55e', fontSize: '0.82rem' }}>
                                            {formatRupiah(r.nilaiPaket)}
                                        </span>
                                    </div>
                                ))}

                                {/* Total */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    padding: '12px 0', fontWeight: 700, fontSize: '0.9rem',
                                    borderTop: '2px solid var(--border-color)', marginTop: 4
                                }}>
                                    <span>Total Bantuan</span>
                                    <span style={{ color: '#22c55e' }}>{formatRupiah(totalBantuan)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardSekolah;
