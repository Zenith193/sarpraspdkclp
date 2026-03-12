import { useMemo } from 'react';
import { School, Database, FileText, History, AlertCircle, CheckCircle, Clock, TrendingUp, Award } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { useSarprasData, useProposalData, useRiwayatBantuanData, useSekolahData } from '../../data/dataProvider';

const DashboardSekolah = () => {
    const user = useAuthStore(s => s.user);
    // Extract NPSN from email (e.g. '20300544@spidol...' -> '20300544')
    const email = user?.email || '';
    const npsn = user?.npsn || email.split('@')[0] || '';
    const sekolahId = user?.sekolahId;
    const { data: sekolahList } = useSekolahData();
    const sekolah = sekolahList.find(s => s.id === sekolahId || s.npsn === npsn);
    const namaSekolah = sekolah?.nama || user?.namaAkun || user?.name || 'Sekolah';
    const matchNpsn = sekolah?.npsn || npsn;

    const { data: sarprasData } = useSarprasData();
    const { data: proposalData } = useProposalData();
    const { data: riwayatData } = useRiwayatBantuanData();

    // Filter data for this school - match by sekolahId or NPSN
    const mySarpras = useMemo(() =>
        (sarprasData || []).filter(s => s.sekolahId === sekolahId || s.npsn === matchNpsn), [sarprasData, sekolahId, matchNpsn]);
    const myProposal = useMemo(() =>
        (proposalData || []).filter(p => p.sekolahId === sekolahId || p.npsn === matchNpsn), [proposalData, sekolahId, matchNpsn]);
    const myRiwayat = useMemo(() =>
        (riwayatData || []).filter(r => r.sekolahId === sekolahId || r.npsn === matchNpsn), [riwayatData, sekolahId, matchNpsn]);

    // Stats
    const totalSarpras = mySarpras.length;
    const baik = mySarpras.filter(s => (s.kondisi || '').toUpperCase() === 'BAIK').length;
    const rusakRingan = mySarpras.filter(s => (s.kondisi || '').toUpperCase() === 'RUSAK RINGAN').length;
    const rusakSedang = mySarpras.filter(s => (s.kondisi || '').toUpperCase() === 'RUSAK SEDANG').length;
    const rusakBerat = mySarpras.filter(s => (s.kondisi || '').toUpperCase() === 'RUSAK BERAT').length;
    const proposalPending = myProposal.filter(p => !p.status || p.status === 'Menunggu Verifikasi' || p.status === 'Pending' || p.status === 'Diajukan').length;
    const proposalDisetujui = myProposal.filter(p => p.status === 'Disetujui' || p.status === 'Diterima').length;
    const totalBantuan = myRiwayat.reduce((sum, r) => sum + (r.nilaiPaket || 0), 0);

    // Recap per jenis prasarana
    const sarprasRecap = useMemo(() => {
        const map = {};
        mySarpras.forEach(s => {
            const jenis = s.jenisPrasarana || s.namaPrasarana || 'Lainnya';
            if (!map[jenis]) map[jenis] = { jenis, total: 0, baik: 0, rr: 0, rs: 0, rb: 0 };
            map[jenis].total++;
            const k = (s.kondisi || '').toUpperCase();
            if (k === 'BAIK') map[jenis].baik++;
            else if (k === 'RUSAK RINGAN') map[jenis].rr++;
            else if (k === 'RUSAK SEDANG') map[jenis].rs++;
            else if (k === 'RUSAK BERAT') map[jenis].rb++;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [mySarpras]);

    const statCards = [
        { label: 'Total Sarpras', value: totalSarpras, icon: <Database size={20} />, color: '#3b82f6' },
        { label: 'Baik', value: baik, icon: <CheckCircle size={20} />, color: '#22c55e' },
        { label: 'Rusak Ringan', value: rusakRingan, icon: <AlertCircle size={20} />, color: '#3b82f6' },
        { label: 'Rusak Sedang', value: rusakSedang, icon: <AlertCircle size={20} />, color: '#f59e0b' },
        { label: 'Rusak Berat', value: rusakBerat, icon: <AlertCircle size={20} />, color: '#ef4444' },
        { label: 'Proposal Diajukan', value: proposalPending, icon: <Clock size={20} />, color: '#f59e0b' },
        { label: 'Proposal Disetujui', value: proposalDisetujui, icon: <CheckCircle size={20} />, color: '#22c55e' },
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
                                        <th style={{ textAlign: 'center' }}>Jumlah</th>
                                        <th style={{ textAlign: 'center' }}>Baik</th>
                                        <th style={{ textAlign: 'center' }}>R. Ringan</th>
                                        <th style={{ textAlign: 'center' }}>R. Sedang</th>
                                        <th style={{ textAlign: 'center' }}>R. Berat</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sarprasRecap.map(r => (
                                        <tr key={r.jenis}>
                                            <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{r.jenis}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.total}</td>
                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#22c55e', fontWeight: 600 }}>{r.baik || '-'}</span></td>
                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#3b82f6', fontWeight: 600 }}>{r.rr || '-'}</span></td>
                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#f59e0b', fontWeight: 600 }}>{r.rs || '-'}</span></td>
                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#ef4444', fontWeight: 600 }}>{r.rb || '-'}</span></td>
                                        </tr>
                                    ))}
                                    {/* Total row */}
                                    <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                                        <td>Total</td>
                                        <td style={{ textAlign: 'center' }}>{totalSarpras}</td>
                                        <td style={{ textAlign: 'center', color: '#22c55e' }}>{baik}</td>
                                        <td style={{ textAlign: 'center', color: '#3b82f6' }}>{rusakRingan}</td>
                                        <td style={{ textAlign: 'center', color: '#f59e0b' }}>{rusakSedang}</td>
                                        <td style={{ textAlign: 'center', color: '#ef4444' }}>{rusakBerat}</td>
                                    </tr>
                                </tbody>
                            </table>
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
