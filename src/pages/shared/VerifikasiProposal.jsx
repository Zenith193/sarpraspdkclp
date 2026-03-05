import { useState, useMemo, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Eye, X, ChevronLeft, ChevronRight, Image, Info, Maximize2, MessageSquare } from 'lucide-react';
import { proposalApi } from '../../api/index';
import { useApi } from '../../api/hooks';
import useAuthStore from '../../store/authStore';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';

const VerifikasiProposal = () => {
    const user = useAuthStore(s => s.user);
    const wilayah = user?.wilayah || [];
    const { data: apiData, loading, refetch } = useApi(() => proposalApi.list({ status: 'Menunggu Verifikasi', limit: 200 }), []);
    const [data, setData] = useState([]);
    const [search, setSearch] = useState('');
    const [detailItem, setDetailItem] = useState(null);
    const [lightboxIdx, setLightboxIdx] = useState(-1);

    useEffect(() => { if (apiData?.data) setData(apiData.data); }, [apiData]);

    const pending = useMemo(() =>
        data.filter(p => {
            if (p.status !== 'Menunggu Verifikasi') return false;
            if (wilayah.length && !wilayah.includes(p.kecamatan)) return false;
            if (search) {
                const q = search.toLowerCase();
                if (!p.namaSekolah.toLowerCase().includes(q) && !p.subKegiatan.toLowerCase().includes(q)) return false;
            }
            return true;
        })
        , [data, search, wilayah]);

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

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Verifikasi Proposal</h1>
                    <p>{pending.length} proposal menunggu verifikasi</p>
                </div>
            </div>
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search"><Search size={16} className="search-icon" /><input placeholder="Cari sekolah atau kegiatan..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr><th>No</th><th>Sekolah</th><th>Kecamatan</th><th>Sub Kegiatan</th><th>Nilai</th><th>Target</th><th>Foto</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {pending.map((p, i) => (
                                <tr key={p.id}>
                                    <td>{i + 1}</td>
                                    <td>{p.namaSekolah}</td>
                                    <td>{p.kecamatan}</td>
                                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.subKegiatan}</td>
                                    <td>{formatCurrency(p.nilaiPengajuan)}</td>
                                    <td>{p.target}</td>
                                    <td>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: p.fotoKerusakan?.length ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                                            <Image size={14} /> {p.fotoKerusakan?.length || 0}
                                        </span>
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
                            {pending.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Tidak ada proposal menunggu verifikasi</td></tr>}
                        </tbody>
                    </table>
                </div>
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
                            {/* Info Grid */}
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

                            {/* Photo Gallery */}
                            <div style={{ marginTop: 20 }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Image size={16} /> Foto Kerusakan ({detailItem.fotoKerusakan?.length || 0})
                                </h3>
                                {detailItem.fotoKerusakan?.length > 0 ? (
                                    <div style={galleryGridStyle}>
                                        {detailItem.fotoKerusakan.map((f, fi) => (
                                            <div key={f.id} style={galleryItemStyle} onClick={() => setLightboxIdx(fi)}>
                                                <img src={f.url} alt={f.nama} style={thumbStyle} loading="lazy" />
                                                <div style={thumbOverlay}>
                                                    <Maximize2 size={18} color="#fff" />
                                                </div>
                                                <div style={thumbInfoStyle}>
                                                    <span style={{ fontSize: 11, fontWeight: 500 }}>{f.nama}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                        <Image size={32} style={{ opacity: 0.3, marginBottom: 8 }} /><br />Tidak ada foto kerusakan
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
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
