import { useState, useMemo, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Clock, Building2, Trash2, Eye, X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { perusahaanApi } from '../../api/index';

const ManajemenPenyedia = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [detailItem, setDetailItem] = useState(null);
    const [verifyTarget, setVerifyTarget] = useState(null);
    const [verifyStatus, setVerifyStatus] = useState('');
    const [verifyKeterangan, setVerifyKeterangan] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [page, setPage] = useState(1);
    const perPage = 20;

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await perusahaanApi.list();
            setData(result);
        } catch (err) {
            toast.error('Gagal memuat data');
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = useMemo(() => {
        return data.filter(p => {
            const matchSearch = !search || [p.namaPerusahaan, p.npwp, p.namaPemilik, p.emailPerusahaan].some(f => f?.toLowerCase().includes(search.toLowerCase()));
            const matchStatus = !filterStatus || p.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [data, search, filterStatus]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const paged = filtered.slice((page - 1) * perPage, page * perPage);

    const statusBadge = (status) => {
        const cfg = {
            'Menunggu': { color: 'var(--accent-yellow)', bg: 'rgba(251,191,36,0.12)', icon: <Clock size={12} /> },
            'Diverifikasi': { color: 'var(--accent-green)', bg: 'rgba(34,197,94,0.12)', icon: <CheckCircle size={12} /> },
            'Ditolak': { color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.12)', icon: <XCircle size={12} /> },
        }[status] || { color: 'var(--text-secondary)', bg: 'var(--bg-secondary)', icon: null };
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: cfg.color, background: cfg.bg }}>{cfg.icon} {status}</span>;
    };

    const handleVerify = async () => {
        if (!verifyTarget || !verifyStatus) return;
        try {
            await perusahaanApi.verify(verifyTarget.id, { status: verifyStatus, keterangan: verifyKeterangan });
            toast.success(`Perusahaan ${verifyStatus === 'Diverifikasi' ? 'diverifikasi' : 'ditolak'}`);
            setVerifyTarget(null); setVerifyStatus(''); setVerifyKeterangan('');
            fetchData();
        } catch (err) { toast.error(err?.message || 'Gagal'); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await perusahaanApi.delete(deleteTarget.id);
            toast.success('Perusahaan dihapus');
            setDeleteTarget(null);
            fetchData();
        } catch (err) { toast.error(err?.message || 'Gagal menghapus'); }
    };

    const countByStatus = (st) => data.filter(d => d.status === st).length;

    return (
        <div className="page-container">
            <div className="page-header">
                <div><h1 className="page-title">Manajemen Penyedia</h1><p className="page-subtitle">Kelola data perusahaan penyedia (PT/CV)</p></div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                {[
                    { label: 'Total', value: data.length, color: 'var(--accent-blue)' },
                    { label: 'Menunggu', value: countByStatus('Menunggu'), color: 'var(--accent-yellow)' },
                    { label: 'Diverifikasi', value: countByStatus('Diverifikasi'), color: 'var(--accent-green)' },
                    { label: 'Ditolak', value: countByStatus('Ditolak'), color: 'var(--accent-red)' },
                ].map(s => (
                    <div key={s.label} className="stat-card" style={{ cursor: 'pointer', borderLeft: `3px solid ${s.color}` }} onClick={() => setFilterStatus(filterStatus === s.label && s.label !== 'Total' ? '' : s.label === 'Total' ? '' : s.label)}>
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Search & Filter */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
                    <Search size={16} className="search-icon" />
                    <input className="search-input" placeholder="Cari perusahaan, NPWP, email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className="form-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} style={{ width: 180 }}>
                    <option value="">Semua Status</option>
                    <option>Menunggu</option>
                    <option>Diverifikasi</option>
                    <option>Ditolak</option>
                </select>
            </div>

            {/* Table */}
            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: 40 }}>No</th>
                            <th>Nama Perusahaan</th>
                            <th>NPWP</th>
                            <th>Pemilik</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th style={{ width: 140 }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>Memuat data...</td></tr>
                        ) : paged.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>Belum ada data penyedia</td></tr>
                        ) : paged.map((p, i) => (
                            <tr key={p.id}>
                                <td style={{ textAlign: 'center' }}>{(page - 1) * perPage + i + 1}</td>
                                <td>
                                    <div style={{ fontWeight: 500 }}>{p.namaPerusahaan}</div>
                                    {p.namaPerusahaanSingkat && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.namaPerusahaanSingkat}</div>}
                                </td>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{p.npwp}</td>
                                <td>{p.namaPemilik || '-'}</td>
                                <td style={{ fontSize: '0.85rem' }}>{p.emailPerusahaan || '-'}</td>
                                <td>{statusBadge(p.status)}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn-icon" title="Detail" onClick={() => setDetailItem(p)}><Eye size={15} /></button>
                                        {p.status === 'Menunggu' && (
                                            <>
                                                <button className="btn-icon" title="Verifikasi" style={{ color: 'var(--accent-green)' }} onClick={() => { setVerifyTarget(p); setVerifyStatus('Diverifikasi'); }}><CheckCircle size={15} /></button>
                                                <button className="btn-icon" title="Tolak" style={{ color: 'var(--accent-red)' }} onClick={() => { setVerifyTarget(p); setVerifyStatus('Ditolak'); }}><XCircle size={15} /></button>
                                            </>
                                        )}
                                        <button className="btn-icon" title="Hapus" style={{ color: 'var(--accent-red)' }} onClick={() => setDeleteTarget(p)}><Trash2 size={15} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                    <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Halaman {page} / {totalPages}</span>
                    <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
                </div>
            )}

            {/* ===== MODAL DETAIL ===== */}
            {detailItem && (
                <div className="modal-overlay" onClick={() => setDetailItem(null)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Detail Perusahaan</div>
                            <button className="modal-close" onClick={() => setDetailItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0 }}>{detailItem.namaPerusahaan}</h3>
                                {statusBadge(detailItem.status)}
                            </div>
                            {[
                                ['NPWP', detailItem.npwp],
                                ['Nama Singkat', detailItem.namaPerusahaanSingkat],
                                ['Pemilik', detailItem.namaPemilik],
                                ['NIK', detailItem.nikPemilik],
                                ['Jabatan', detailItem.jabatanPemilik],
                                ['Alamat Pemilik', detailItem.alamatPemilik],
                                ['Alamat Perusahaan', detailItem.alamatPerusahaan],
                                ['Telepon', detailItem.noTelp],
                                ['Email', detailItem.emailPerusahaan],
                                ['No. Akta', detailItem.noAkta],
                                ['Nama Notaris', detailItem.namaNotaris],
                                ['Tanggal Akta', detailItem.tanggalAkta],
                                ['Bank', detailItem.bank],
                                ['No. Rekening', detailItem.noRekening],
                                ['Nama Rekening', detailItem.namaRekening],
                                ['Terdaftar', detailItem.createdAt ? new Date(detailItem.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'],
                            ].map(([label, value]) => value ? (
                                <div key={label} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                                    <div style={{ width: 150, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</div>
                                    <div style={{ color: 'var(--text-primary)' }}>{value}</div>
                                </div>
                            ) : null)}
                            {detailItem.keteranganVerifikasi && (
                                <div style={{ marginTop: 16, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
                                    <strong>Keterangan Verifikasi:</strong> {detailItem.keteranganVerifikasi}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setDetailItem(null)}>Tutup</button>
                            {detailItem.status === 'Menunggu' && (
                                <>
                                    <button className="btn btn-secondary" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)' }} onClick={() => { setVerifyTarget(detailItem); setVerifyStatus('Ditolak'); setDetailItem(null); }}>Tolak</button>
                                    <button className="btn btn-primary" onClick={() => { setVerifyTarget(detailItem); setVerifyStatus('Diverifikasi'); setDetailItem(null); }}>Verifikasi</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL VERIFIKASI ===== */}
            {verifyTarget && (
                <div className="modal-overlay" onClick={() => setVerifyTarget(null)}>
                    <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{verifyStatus === 'Diverifikasi' ? '✅ Verifikasi' : '❌ Tolak'} Perusahaan</div>
                            <button className="modal-close" onClick={() => setVerifyTarget(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: 16 }}>
                                {verifyStatus === 'Diverifikasi'
                                    ? <>Anda akan <strong>memverifikasi</strong> perusahaan <strong>{verifyTarget.namaPerusahaan}</strong>. Akun login perusahaan akan diaktifkan.</>
                                    : <>Anda akan <strong>menolak</strong> registrasi <strong>{verifyTarget.namaPerusahaan}</strong>.</>}
                            </p>
                            <div className="form-group">
                                <label className="form-label">Keterangan (opsional)</label>
                                <textarea className="form-input" rows={3} placeholder="Tambahkan catatan..." value={verifyKeterangan} onChange={e => setVerifyKeterangan(e.target.value)} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setVerifyTarget(null)}>Batal</button>
                            <button className="btn btn-primary" style={verifyStatus === 'Ditolak' ? { background: 'var(--accent-red)' } : {}} onClick={handleVerify}>
                                {verifyStatus === 'Diverifikasi' ? 'Verifikasi' : 'Tolak'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL DELETE ===== */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title">Hapus Perusahaan</div><button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={18} /></button></div>
                        <div className="modal-body" style={{ textAlign: 'center' }}>
                            <AlertTriangle size={48} style={{ color: 'var(--accent-red)', marginBottom: 16 }} />
                            <p>Anda yakin ingin menghapus <strong>{deleteTarget.namaPerusahaan}</strong>? Akun login terkait juga akan dihapus.</p>
                        </div>
                        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Batal</button><button className="btn btn-primary" style={{ background: 'var(--accent-red)' }} onClick={handleDelete}>Hapus</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManajemenPenyedia;
