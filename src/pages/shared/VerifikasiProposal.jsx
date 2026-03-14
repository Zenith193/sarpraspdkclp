import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, CheckCircle, XCircle, Eye, X, ChevronLeft, ChevronRight, Image, Info, Maximize2, MessageSquare, CheckCheck } from 'lucide-react';
import { proposalApi, korwilApi } from '../../api/index';
import useAuthStore from '../../store/authStore';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { safeStr } from '../../utils/safeStr';
import ConfirmModal from '../../components/ui/ConfirmModal';

const PER_PAGE_OPTIONS = [15, 30, 50, 100];

const VerifikasiProposal = () => {
    const user = useAuthStore(s => s.user);
    const role = user?.role || '';
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [detailItem, setDetailItem] = useState(null);
    const [lightboxIdx, setLightboxIdx] = useState(-1);
    const [perPage, setPerPage] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);
    const [showBatchConfirm, setShowBatchConfirm] = useState(false);

    // Fetch data with proper server-side filtering for korwil
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { status: 'Menunggu Verifikasi', limit: 9999 };

            // For korwil: get assignment first, then filter server-side
            if (role === 'Korwil' && user?.id) {
                try {
                    const korwilList = await korwilApi.list();
                    const myRows = (korwilList || []).filter(row => {
                        const ka = row.korwilAssignment || row;
                        return String(ka.userId) === String(user.id);
                    });
                    if (myRows.length > 0) {
                        const ka = myRows[0].korwilAssignment || myRows[0];
                        if (ka.kecamatan) params.kecamatan = ka.kecamatan;
                        if (ka.jenjang) params.jenjang = ka.jenjang;
                    }
                } catch (e) { console.error('Failed to get korwil assignment:', e); }
            }

            const apiData = await proposalApi.list(params);
            if (apiData?.data) {
                const flat = apiData.data.map(item => {
                    if (item.proposal) {
                        return {
                            ...item.proposal,
                            namaSekolah: item.sekolahNama || '',
                            npsn: item.sekolahNpsn || '',
                            kecamatan: item.sekolahKecamatan || '',
                            jenjang: item.sekolahJenjang || '',
                        };
                    }
                    return item;
                });
                setData(flat);
            }
        } catch (e) { console.error('Failed to fetch proposals:', e); }
        finally { setLoading(false); }
    }, [role, user?.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const refetch = fetchData;

    const pending = useMemo(() =>
        data.filter(p => {
            const status = p.status || p.proposal?.status;
            if (status !== 'Menunggu Verifikasi') return false;

            if (search) {
                const q = search.toLowerCase();
                if (!p.namaSekolah?.toLowerCase().includes(q) && !p.subKegiatan?.toLowerCase().includes(q)) return false;
            }
            return true;
        })
        , [data, search]);

    // Pagination
    const totalPages = Math.ceil(pending.length / perPage);
    const pagedData = pending.slice((currentPage - 1) * perPage, currentPage * perPage);

    useEffect(() => { setCurrentPage(1); }, [search, perPage]);

    const handleVerify = async (id, status) => {
        try {
            await proposalApi.updateStatus(id, status);
            setData(prev => prev.filter(p => p.id !== id && p.proposal?.id !== id));
            toast.success(`Proposal ${status.toLowerCase()}`, { style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' } });
            setDetailItem(null);
        } catch (err) {
            toast.error(err.message || 'Gagal memverifikasi');
        }
    };

    const openDetail = (item) => { setDetailItem(item); setLightboxIdx(-1); };

    const handleBatchApprove = async () => {
        if (!pending.length) return;
        setShowBatchConfirm(true);
    };

    const executeBatchApprove = async () => {
        setShowBatchConfirm(false);
        try {
            const ids = pending.map(p => p.id);
            const result = await proposalApi.batchApprove(ids);
            toast.success(`${result?.approved || ids.length} proposal berhasil disetujui`);
            setData([]);
        } catch (e) { toast.error('Gagal batch approve'); }
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Verifikasi Proposal</h1>
                    <p>{pending.length} proposal menunggu verifikasi</p>
                </div>
                {role.toLowerCase() === 'admin' && pending.length > 0 && (
                    <div className="page-header-right">
                        <button className="btn btn-success" onClick={handleBatchApprove}>
                            <CheckCheck size={16} /> Setujui Semua ({pending.length})
                        </button>
                    </div>
                )}
            </div>
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search"><Search size={16} className="search-icon" /><input placeholder="Cari sekolah atau kegiatan..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                    </div>
                    <div className="table-toolbar-right">
                        <select className="form-input" style={{ width: 'auto', minWidth: 80, padding: '6px 10px' }} value={perPage} onChange={e => setPerPage(Number(e.target.value))}>
                            {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / halaman</option>)}
                        </select>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr><th>No</th><th>Sekolah</th><th>Kecamatan</th><th>Jenjang</th><th>Sub Kegiatan</th><th>Nilai</th><th>Target</th><th>File</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {pagedData.map((p, i) => (
                                <tr key={p.id}>
                                    <td>{(currentPage - 1) * perPage + i + 1}</td>
                                    <td>{p.namaSekolah}</td>
                                    <td>{safeStr(p.kecamatan)}</td>
                                    <td><span className="badge badge-disetujui">{p.jenjang}</span></td>
                                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.subKegiatan}</td>
                                    <td>{formatCurrency(p.nilaiPengajuan)}</td>
                                    <td>{p.target}</td>
                                    <td>
                                        {p.fileName ? (
                                            <a href={`/api/file/proposal-doc/${p.id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-blue)', fontSize: '0.78rem', textDecoration: 'none' }} title={p.fileName}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                PDF
                                            </a>
                                        ) : (
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>-</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn btn-sm btn-primary" onClick={() => openDetail(p)} title="Lihat Detail & Foto"><Eye size={14} /> Detail</button>
                                            <button className="btn btn-sm btn-success" onClick={() => handleVerify(p.id, 'Disetujui')}><CheckCircle size={14} /> Setujui</button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleVerify(p.id, 'Ditolak')}><XCircle size={14} /> Tolak</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pagedData.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Tidak ada proposal menunggu verifikasi</td></tr>}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Menampilkan {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, pending.length)} dari {pending.length}
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={16} /></button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let page;
                                if (totalPages <= 5) page = i + 1;
                                else if (currentPage <= 3) page = i + 1;
                                else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                                else page = currentPage - 2 + i;
                                return <button key={page} className={`btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCurrentPage(page)}>{page}</button>;
                            })}
                            <button className="btn btn-ghost btn-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== DETAIL MODAL ===== */}
            {detailItem && (
                <div style={overlayStyle} onClick={() => setDetailItem(null)}>
                    <div style={modalStyle} onClick={e => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h2 style={{ margin: 0, fontSize: 18 }}><Info size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />Detail Proposal</h2>
                            <button onClick={() => setDetailItem(null)} style={closeBtnStyle}><X size={20} /></button>
                        </div>
                        <div style={modalBodyStyle}>
                            <div style={infoGridStyle}>
                                <div style={infoItemStyle}><span style={labelStyle}>Sekolah</span><span style={valueStyle}>{detailItem.namaSekolah}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>NPSN</span><span style={valueStyle}>{detailItem.npsn}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Kecamatan</span><span style={valueStyle}>{detailItem.kecamatan}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Jenjang</span><span style={valueStyle}>{detailItem.jenjang}</span></div>
                                <div style={{ ...infoItemStyle, gridColumn: '1 / -1' }}><span style={labelStyle}>Sub Kegiatan</span><span style={valueStyle}>{detailItem.subKegiatan}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Nilai Pengajuan</span><span style={{ ...valueStyle, color: 'var(--color-primary)', fontWeight: 700 }}>{formatCurrency(detailItem.nilaiPengajuan)}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Target</span><span style={valueStyle}>{detailItem.target}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Keranjang</span><span style={valueStyle}>{detailItem.keranjang}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Ranking</span><span style={valueStyle}>#{detailItem.ranking} {'⭐'.repeat(detailItem.bintang)}</span></div>
                                {detailItem.noAgendaSurat && <div style={infoItemStyle}><span style={labelStyle}>No. Agenda Surat</span><span style={valueStyle}>{detailItem.noAgendaSurat}</span></div>}
                                {detailItem.tanggalSurat && <div style={infoItemStyle}><span style={labelStyle}>Tanggal Surat</span><span style={valueStyle}>{detailItem.tanggalSurat}</span></div>}
                                <div style={{ ...infoItemStyle, gridColumn: '1 / -1' }}><span style={labelStyle}>Keterangan</span><span style={valueStyle}>{detailItem.keterangan}</span></div>
                            </div>
                            {detailItem.fileName && (
                                <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{detailItem.fileName}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Proposal PDF</div>
                                    </div>
                                    <a href={`/api/file/proposal-doc/${detailItem.id}`} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '6px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Eye size={14} /> Lihat PDF
                                    </a>
                                </div>
                            )}
                            {detailItem.fotoKerusakan?.length > 0 && (
                            <div style={{ marginTop: 20 }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Image size={16} /> Foto Kerusakan ({detailItem.fotoKerusakan.length})
                                </h3>
                                <div style={galleryGridStyle}>
                                    {detailItem.fotoKerusakan.map((f, fi) => (
                                        <div key={f.id} style={galleryItemStyle} onClick={() => setLightboxIdx(fi)}>
                                            <img src={f.url} alt={f.nama} style={thumbStyle} loading="lazy" />
                                            <div style={thumbOverlay}><Maximize2 size={18} color="#fff" /></div>
                                            <div style={thumbInfoStyle}><span style={{ fontSize: 11, fontWeight: 500 }}>{f.nama}</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                                <button className="btn btn-success" onClick={() => handleVerify(detailItem.id, 'Disetujui')}><CheckCircle size={16} /> Setujui</button>
                                <button className="btn btn-danger" onClick={() => handleVerify(detailItem.id, 'Ditolak')}><XCircle size={16} /> Tolak</button>
                                <button className="btn btn-secondary" onClick={() => handleVerify(detailItem.id, 'Revisi')}><MessageSquare size={16} /> Revisi</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== LIGHTBOX ===== */}
            {lightboxIdx >= 0 && detailItem?.fotoKerusakan?.[lightboxIdx] && (
                <div style={lightboxOverlayStyle} onClick={() => setLightboxIdx(-1)}>
                    <button onClick={() => setLightboxIdx(-1)} style={{ ...closeBtnStyle, position: 'absolute', top: 16, right: 16, zIndex: 1002, background: 'rgba(0,0,0,0.5)', color: '#fff' }}><X size={24} /></button>
                    {detailItem.fotoKerusakan.length > 1 && (
                        <>
                            <button onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + detailItem.fotoKerusakan.length) % detailItem.fotoKerusakan.length); }} style={{ ...navBtnStyle, left: 16 }}><ChevronLeft size={32} /></button>
                            <button onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % detailItem.fotoKerusakan.length); }} style={{ ...navBtnStyle, right: 16 }}><ChevronRight size={32} /></button>
                        </>
                    )}
                    <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh', position: 'relative' }}>
                        <img src={detailItem.fotoKerusakan[lightboxIdx].url} alt="" style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
                        <div style={{ textAlign: 'center', color: '#fff', marginTop: 10, fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>{detailItem.fotoKerusakan[lightboxIdx].nama}</div>
                            <div style={{ marginTop: 4, opacity: 0.5 }}>{lightboxIdx + 1} / {detailItem.fotoKerusakan.length}</div>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal
                isOpen={showBatchConfirm}
                title="Setujui Semua Proposal?"
                message={`${pending.length} proposal akan disetujui sekaligus. Pastikan data sudah diperiksa.`}
                confirmText="Ya, Setujui Semua"
                variant="success"
                onConfirm={executeBatchApprove}
                onCancel={() => setShowBatchConfirm(false)}
            />
        </div>
    );
};

// ===== STYLES =====
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' };
const modalStyle = { background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' };
const modalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' };
const modalBodyStyle = { padding: 20, overflowY: 'auto', flex: 1 };
const closeBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, borderRadius: 6, display: 'flex' };
const infoGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 };
const infoItemStyle = { display: 'flex', flexDirection: 'column', gap: 2 };
const labelStyle = { fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 };
const valueStyle = { fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 };
const galleryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 };
const galleryItemStyle = { borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer', position: 'relative', background: 'var(--bg-secondary)', transition: 'transform 0.15s, box-shadow 0.15s' };
const thumbStyle = { width: '100%', height: 140, objectFit: 'cover', display: 'block' };
const thumbOverlay = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' };
const thumbInfoStyle = { padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 };
const lightboxOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const navBtnStyle = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, backdropFilter: 'blur(4px)' };

export default VerifikasiProposal;
