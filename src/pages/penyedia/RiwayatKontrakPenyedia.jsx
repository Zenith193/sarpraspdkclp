import { useState, useEffect } from 'react';
import { History, Eye, Search, CheckCircle, Clock, XCircle, X } from 'lucide-react';
import { kontrakApi } from '../../api';

const statusBadge = (status) => {
    const map = {
        'Menunggu': { bg: 'rgba(251,191,36,0.12)', color: '#f59e0b', icon: Clock },
        'Diverifikasi': { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', icon: CheckCircle },
        'Ditolak': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', icon: XCircle },
    };
    const s = map[status] || map['Menunggu'];
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: '0.78rem', fontWeight: 600 }}>
            <s.icon size={13} /> {status}
        </span>
    );
};

const RiwayatKontrakPenyedia = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [detail, setDetail] = useState(null);

    useEffect(() => {
        kontrakApi.listPermohonan().then(r => setData(Array.isArray(r.data) ? r.data : []))
            .catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handleDetail = async (id) => {
        try {
            const res = await kontrakApi.getPermohonan(id);
            setDetail(res.data);
        } catch { }
    };

    const filtered = data.filter(d => {
        const q = search.toLowerCase();
        return (d.namaPaket || '').toLowerCase().includes(q) || (d.kodeSirup || '').includes(q);
    });
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
    const formatCurrency = (v) => v ? `Rp. ${Number(v).toLocaleString('id-ID')}` : '-';

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><History size={24} /> Riwayat Kontrak</h1>
                <p className="page-subtitle">Daftar semua permohonan kontrak yang telah diajukan</p>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                        placeholder="Cari nama paket atau kode SiRUP..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Memuat data...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Belum ada riwayat kontrak</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>KODE SIRUP</th>
                                <th>NAMA PAKET</th>
                                <th>JENIS PENGADAAN</th>
                                <th>METODE</th>
                                <th>STATUS</th>
                                <th>TANGGAL</th>
                                <th>AKSI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p, i) => (
                                <tr key={p.id}>
                                    <td>{i + 1}</td>
                                    <td style={{ fontWeight: 600 }}>{p.kodeSirup}</td>
                                    <td>{p.namaPaket}</td>
                                    <td>{p.jenisPengadaan}</td>
                                    <td>{p.metodePengadaan}</td>
                                    <td>{statusBadge(p.status)}</td>
                                    <td>{formatDate(p.createdAt)}</td>
                                    <td>
                                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}
                                            onClick={() => handleDetail(p.id)}>
                                            <Eye size={14} /> Detail
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal */}
            {detail && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setDetail(null)} />
                    <div style={{ position: 'relative', background: 'var(--bg-primary)', borderRadius: 16, width: 'min(90vw, 720px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Detail Permohonan Kontrak</h3>
                            <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {[
                                    ['Kode SiRUP', detail.kodeSirup],
                                    ['Nama Paket', detail.namaPaket],
                                    ['Jenis Pengadaan', detail.jenisPengadaan],
                                    ['Metode Pengadaan', detail.metodePengadaan],
                                    ['No DPPL', detail.noDppl],
                                    ['Tanggal DPPL', formatDate(detail.tanggalDppl)],
                                    ['No BAHPL', detail.noBahpl],
                                    ['Tanggal BAHPL', formatDate(detail.tanggalBahpl)],
                                    ['Status', detail.status],
                                ].map(([l, v]) => (
                                    <div key={l}>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{l}</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{v || '-'}</div>
                                    </div>
                                ))}
                            </div>
                            {detail.status === 'Diverifikasi' && (
                                <>
                                    <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                                    <h4 style={{ marginBottom: 12 }}>Data Kontrak (dari Verifikator)</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        {[
                                            ['No SPK', detail.noSpk],
                                            ['Nilai Kontrak', formatCurrency(detail.nilaiKontrak)],
                                            ['Terbilang', detail.terbilangKontrak],
                                            ['Tanggal Mulai', formatDate(detail.tanggalMulai)],
                                            ['Tanggal Selesai', formatDate(detail.tanggalSelesai)],
                                            ['Waktu Penyelesaian', detail.waktuPenyelesaian],
                                        ].map(([l, v]) => (
                                            <div key={l}>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{l}</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{v || '-'}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RiwayatKontrakPenyedia;
