import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, CheckCircle, XCircle, Eye, X, ChevronLeft, ChevronRight, MapPin, Image, Info, Maximize2, CheckCheck } from 'lucide-react';
import { sarprasApi, korwilApi } from '../../api/index';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { safeStr } from '../../utils/safeStr';

const PER_PAGE_OPTIONS = [15, 30, 50, 100];

const VerifikasiSarpras = () => {
    const user = useAuthStore(s => s.user);
    const role = user?.role || '';
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [detailItem, setDetailItem] = useState(null);
    const [lightboxIdx, setLightboxIdx] = useState(-1);
    const [perPage, setPerPage] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);

    // Fetch data with proper server-side filtering for korwil
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { verified: 'false', limit: 9999 };

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

            const apiData = await sarprasApi.list(params);
            if (apiData?.data) {
                const flat = apiData.data.map(item => {
                    if (item.sarpras) {
                        return {
                            ...item.sarpras,
                            namaSekolah: item.sekolahNama || '',
                            npsn: item.sekolahNpsn || '',
                            kecamatan: item.sekolahKecamatan || '',
                            jenjang: item.sekolahJenjang || '',
                            foto: item.sarpras.foto || [],
                        };
                    }
                    return item;
                });
                setData(flat);
            }
        } catch (e) { console.error('Failed to fetch sarpras:', e); }
        finally { setLoading(false); }
    }, [role, user?.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const refetch = fetchData;

    const pending = useMemo(() =>
        data.filter(s => {
            if (search) {
                const q = search.toLowerCase();
                if (!s.namaSekolah?.toLowerCase().includes(q) && !s.namaRuang?.toLowerCase().includes(q)) return false;
            }
            return !s.verified;
        })
        , [data, search]);

    // Pagination
    const totalPages = Math.ceil(pending.length / perPage);
    const pagedData = pending.slice((currentPage - 1) * perPage, currentPage * perPage);

    useEffect(() => { setCurrentPage(1); }, [search, perPage]);

    const handleVerify = async (id, approved) => {
        try {
            if (approved) await sarprasApi.verify(id);
            else await sarprasApi.unverify(id);
            setData(prev => prev.filter(s => s.sarpras?.id !== id && s.id !== id));
            toast.success(approved ? 'Data sarpras disetujui' : 'Data sarpras ditolak', { style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' } });
            setDetailItem(null);
        } catch (err) {
            toast.error(err.message || 'Gagal memverifikasi');
        }
    };

    const openDetail = (item) => { setDetailItem(item); setLightboxIdx(-1); };

    const handleBatchVerify = async () => {
        if (!pending.length) return;
        if (!window.confirm(`Setujui semua ${pending.length} data sarpras sekaligus?`)) return;
        try {
            const ids = pending.map(s => s.id);
            const result = await sarprasApi.batchVerify(ids);
            toast.success(`${result?.verified || ids.length} data sarpras berhasil disetujui`);
            setData([]);
        } catch (e) { toast.error('Gagal batch verifikasi'); }
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Verifikasi Sarpras</h1>
                    <p>{pending.length} data menunggu verifikasi</p>
                </div>
                {role === 'admin' && pending.length > 0 && (
                    <div className="page-header-right">
                        <button className="btn btn-success" onClick={handleBatchVerify}>
                            <CheckCheck size={16} /> Setujui Semua ({pending.length})
                        </button>
                    </div>
                )}
            </div>
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search"><Search size={16} className="search-icon" /><input placeholder="Cari sekolah atau ruang..." value={search} onChange={e => setSearch(e.target.value)} /></div>
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
                            <tr><th>No</th><th>Sekolah</th><th>NPSN</th><th>Kecamatan</th><th>Jenjang</th><th>Jenis Prasarana</th><th>Nama Ruang</th><th>Kondisi</th><th>Foto</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {pagedData.map((item, i) => (
                                <tr key={item.id}>
                                    <td>{(currentPage - 1) * perPage + i + 1}</td>
                                    <td>{item.namaSekolah}</td>
                                    <td>{safeStr(item.npsn)}</td>
                                    <td>{safeStr(item.kecamatan)}</td>
                                    <td><span className="badge badge-disetujui">{item.jenjang}</span></td>
                                    <td>{item.jenisPrasarana}</td>
                                    <td>{item.namaRuang}</td>
                                    <td>
                                        <span className={`badge ${item.kondisi === 'BAIK' ? 'badge-baik' : item.kondisi === 'RUSAK RINGAN' ? 'badge-rusak-ringan' : item.kondisi === 'RUSAK SEDANG' ? 'badge-rusak-sedang' : 'badge-rusak-berat'}`}>
                                            {item.kondisi}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: item.foto?.length ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                                            <Image size={14} /> {item.foto?.length || 0}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn btn-sm btn-primary" onClick={() => openDetail(item)} title="Lihat Detail & Foto"><Eye size={14} /> Detail</button>
                                            <button className="btn btn-sm btn-success" onClick={() => handleVerify(item.id, true)}><CheckCircle size={14} /> Setujui</button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleVerify(item.id, false)}><XCircle size={14} /> Tolak</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pagedData.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Tidak ada data menunggu verifikasi</td></tr>}
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
                            <h2 style={{ margin: 0, fontSize: 18 }}><Info size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />Detail Sarpras</h2>
                            <button onClick={() => setDetailItem(null)} style={closeBtnStyle}><X size={20} /></button>
                        </div>
                        <div style={modalBodyStyle}>
                            <div style={infoGridStyle}>
                                <div style={infoItemStyle}><span style={labelStyle}>Sekolah</span><span style={valueStyle}>{detailItem.namaSekolah}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>NPSN</span><span style={valueStyle}>{detailItem.npsn}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Kecamatan</span><span style={valueStyle}>{detailItem.kecamatan}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Jenjang</span><span style={valueStyle}>{detailItem.jenjang}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Jenis Prasarana</span><span style={valueStyle}>{detailItem.jenisPrasarana}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Nama Ruang</span><span style={valueStyle}>{detailItem.namaRuang}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Masa Bangunan</span><span style={valueStyle}>{detailItem.masaBangunan}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Lantai</span><span style={valueStyle}>{detailItem.lantai}</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Ukuran (P×L)</span><span style={valueStyle}>{detailItem.panjang} × {detailItem.lebar} m</span></div>
                                <div style={infoItemStyle}><span style={labelStyle}>Luas</span><span style={valueStyle}>{detailItem.luas} m²</span></div>
                                <div style={infoItemStyle}>
                                    <span style={labelStyle}>Kondisi</span>
                                    <span className={`badge ${detailItem.kondisi === 'BAIK' ? 'badge-baik' : detailItem.kondisi === 'RUSAK RINGAN' ? 'badge-rusak-ringan' : detailItem.kondisi === 'RUSAK SEDANG' ? 'badge-rusak-sedang' : 'badge-rusak-berat'}`}>{detailItem.kondisi}</span>
                                </div>
                                <div style={infoItemStyle}><span style={labelStyle}>Keterangan</span><span style={valueStyle}>{detailItem.keterangan}</span></div>
                            </div>
                            <div style={{ marginTop: 20 }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Image size={16} /> Foto Dokumentasi ({detailItem.foto?.length || 0})
                                </h3>
                                {detailItem.foto?.length > 0 ? (
                                    <div style={galleryGridStyle}>
                                        {detailItem.foto.map((f, fi) => (
                                            <div key={f.id} style={galleryItemStyle} onClick={() => setLightboxIdx(fi)}>
                                                <img src={f.url} alt={f.nama} style={thumbStyle} loading="lazy" />
                                                <div style={thumbOverlay}><Maximize2 size={18} color="#fff" /></div>
                                                <div style={thumbInfoStyle}>
                                                    <span style={{ fontSize: 11, fontWeight: 500 }}>{f.nama}</span>
                                                    {f.geoLat && <span style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 2 }}><MapPin size={10} />{f.geoLat.toFixed(4)}, {f.geoLng.toFixed(4)}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                        <Image size={32} style={{ opacity: 0.3, marginBottom: 8 }} /><br />Tidak ada foto
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                                <button className="btn btn-success" onClick={() => handleVerify(detailItem.id, true)}><CheckCircle size={16} /> Setujui</button>
                                <button className="btn btn-danger" onClick={() => handleVerify(detailItem.id, false)}><XCircle size={16} /> Tolak</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== LIGHTBOX ===== */}
            {lightboxIdx >= 0 && detailItem?.foto?.[lightboxIdx] && (
                <div style={lightboxOverlayStyle} onClick={() => setLightboxIdx(-1)}>
                    <button onClick={() => setLightboxIdx(-1)} style={{ ...closeBtnStyle, position: 'absolute', top: 16, right: 16, zIndex: 1002, background: 'rgba(0,0,0,0.5)', color: '#fff' }}><X size={24} /></button>
                    {detailItem.foto.length > 1 && (
                        <>
                            <button onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + detailItem.foto.length) % detailItem.foto.length); }} style={{ ...navBtnStyle, left: 16 }}><ChevronLeft size={32} /></button>
                            <button onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % detailItem.foto.length); }} style={{ ...navBtnStyle, right: 16 }}><ChevronRight size={32} /></button>
                        </>
                    )}
                    <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh', position: 'relative' }}>
                        <img src={detailItem.foto[lightboxIdx].url} alt="" style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
                        <div style={{ textAlign: 'center', color: '#fff', marginTop: 10, fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>{detailItem.foto[lightboxIdx].nama}</div>
                            {detailItem.foto[lightboxIdx].geoLat && (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 4, opacity: 0.7 }}>
                                    <MapPin size={12} /> {detailItem.foto[lightboxIdx].geoLat.toFixed(6)}, {detailItem.foto[lightboxIdx].geoLng.toFixed(6)}
                                </div>
                            )}
                            <div style={{ marginTop: 4, opacity: 0.5 }}>{lightboxIdx + 1} / {detailItem.foto.length}</div>
                        </div>
                    </div>
                </div>
            )}
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

export default VerifikasiSarpras;
