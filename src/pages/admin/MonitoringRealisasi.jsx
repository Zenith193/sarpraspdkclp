import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Eye, X, Target, BarChart3, AlertTriangle, Camera } from 'lucide-react';
import { kontrakApi } from '../../api/index';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// Fix image path — use file proxy that searches multiple directories
const fixImgPath = (p) => {
    if (!p) return '';
    const match = p.match(/\/uploads\/kontrak\/(.+)$/);
    if (match) return '/api/file/kontrak/' + encodeURIComponent(match[1]);
    return p;
};

const MonitoringRealisasi = () => {
    const [matrikList, setMatrikList] = useState([]);
    const [realisasiData, setRealisasiData] = useState([]); // all submitted realisasi
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(15);

    // Lightbox state
    const [lightbox, setLightbox] = useState({ open: false, photos: [], index: 0 });
    const openLightbox = (photos, index) => setLightbox({ open: true, photos, index });
    const closeLightbox = () => setLightbox({ open: false, photos: [], index: 0 });
    const lbPrev = () => setLightbox(prev => ({ ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length }));
    const lbNext = () => setLightbox(prev => ({ ...prev, index: (prev.index + 1) % prev.photos.length }));
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedId, setExpandedId] = useState(null);

    // Detail modal
    const [detailMatrik, setDetailMatrik] = useState(null);
    const [detailAnakan, setDetailAnakan] = useState(null); // null = indukan mode
    const [detailRealisasi, setDetailRealisasi] = useState([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Fetch all matrik + all realisasi
    useEffect(() => {
        Promise.all([
            kontrakApi.allMatrikRealisasi(),
            kontrakApi.allRealisasi(),
        ]).then(([matrik, realisasi]) => {
            const mArr = Array.isArray(matrik) ? matrik : (matrik?.data || []);
            const rArr = Array.isArray(realisasi) ? realisasi : (realisasi?.data || []);
            setMatrikList(mArr);
            setRealisasiData(rArr);
        }).catch(e => toast.error('Gagal memuat data: ' + (e.message || '')))
          .finally(() => setLoading(false));
    }, []);

    // Build realisasi lookup by matrikId
    const realisasiByMatrik = useMemo(() => {
        const map = {};
        realisasiData.forEach(r => {
            const mid = r.realisasi?.matrikId || r.matrikId;
            if (mid) {
                if (!map[mid]) map[mid] = [];
                map[mid].push(r);
            }
        });
        return map;
    }, [realisasiData]);

    // Stats
    const stats = useMemo(() => {
        const totalPaket = matrikList.length;
        const totalAnakan = matrikList.reduce((s, m) => s + (m.anakan?.length || 0), 0);
        const totalRealisasi = realisasiData.length;
        // Average realisasi persen
        let avg = 0;
        if (realisasiData.length > 0) {
            const sum = realisasiData.reduce((s, r) => s + Number(r.realisasi?.realisasiPersen || r.realisasiPersen || 0), 0);
            avg = sum / realisasiData.length;
        }
        // Count matrik with realisasi < 80% target
        let belowTarget = 0;
        realisasiData.forEach(r => {
            const real = Number(r.realisasi?.realisasiPersen || r.realisasiPersen || 0);
            const target = Number(r.realisasi?.targetPersen || r.targetPersen || 0);
            if (target > 0 && real < target * 0.8) belowTarget++;
        });
        return { totalPaket, totalAnakan, totalRealisasi, avg, belowTarget };
    }, [matrikList, realisasiData]);

    // Filter & pagination
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return matrikList;
        return matrikList.filter(k =>
            (k.namaPaket || '').toLowerCase().includes(q) ||
            (k.penyedia || '').toLowerCase().includes(q) ||
            (k.noMatrik || '').toLowerCase().includes(q) ||
            (k.jenisPengadaan || '').toLowerCase().includes(q) ||
            (k.anakan || []).some(a => (a.namaSekolah || '').toLowerCase().includes(q))
        );
    }, [matrikList, search]);

    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const paged = useMemo(() => {
        const s = (currentPage - 1) * pageSize;
        return filtered.slice(s, s + pageSize);
    }, [filtered, currentPage, pageSize]);

    // Get latest realisasi for a matrik (or its anakan)
    const getLatestRealisasi = (matrik) => {
        // Check matrik itself
        const direct = realisasiByMatrik[matrik.id] || [];
        // Check anakan
        const anakanRealisasi = (matrik.anakan || []).flatMap(a => realisasiByMatrik[a.id] || []);
        const all = [...direct, ...anakanRealisasi];
        if (all.length === 0) return null;
        // Get latest by sorting
        all.sort((a, b) => {
            const aDate = a.realisasi?.createdAt || a.createdAt || '';
            const bDate = b.realisasi?.createdAt || b.createdAt || '';
            return new Date(bDate) - new Date(aDate);
        });
        return all[0];
    };

    // Get progress summary for a matrik
    const getProgress = (matrik) => {
        const direct = realisasiByMatrik[matrik.id] || [];
        const anakanRealisasi = (matrik.anakan || []).flatMap(a => realisasiByMatrik[a.id] || []);
        const all = [...direct, ...anakanRealisasi];
        if (all.length === 0) return { target: 0, realisasi: 0, count: 0 };
        const latestTarget = Math.max(...all.map(r => Number(r.realisasi?.targetPersen || r.targetPersen || 0)));
        const latestRealisasi = Math.max(...all.map(r => Number(r.realisasi?.realisasiPersen || r.realisasiPersen || 0)));
        return { target: latestTarget, realisasi: latestRealisasi, count: all.length };
    };

    // Open detail - supports both indukan (all) and anakan-specific mode
    const openDetail = async (matrik, anakanItem = null) => {
        setDetailMatrik(matrik);
        setDetailAnakan(anakanItem);
        setLoadingDetail(true);
        try {
            if (anakanItem) {
                // ANAKAN MODE: fetch anakan + parent filtered by school name
                const schoolName = (anakanItem.namaSekolah || anakanItem.namaPaket || '').toUpperCase();
                
                const anakanRl = await kontrakApi.listRealisasiByMatrik(anakanItem.id);
                const anakanArr = (Array.isArray(anakanRl) ? anakanRl : []).map(i => ({
                    ...i, _anakanName: anakanItem.namaSekolah || anakanItem.namaPaket, _noMatrik: anakanItem.noMatrik
                }));
                
                const parentRl = await kontrakApi.listRealisasiByMatrik(matrik.id);
                const parentFiltered = (Array.isArray(parentRl) ? parentRl : []).filter(i => {
                    const s = (i.namaSekolah || '').toUpperCase();
                    return s && s.includes(schoolName.substring(0, 15));
                }).map(i => ({ ...i, _anakanName: i.namaSekolah || anakanItem.namaSekolah, _noMatrik: matrik.noMatrik }));
                
                const existingIds = new Set(anakanArr.map(i => i.id));
                setDetailRealisasi([...anakanArr, ...parentFiltered.filter(i => !existingIds.has(i.id))]);
            } else {
                // INDUKAN MODE: fetch parent + all anakan
                const rl = await kontrakApi.listRealisasiByMatrik(matrik.id);
                const parentList = Array.isArray(rl) ? rl : [];
                const anakanLists = await Promise.all(
                    (matrik.anakan || []).map(a => kontrakApi.listRealisasiByMatrik(a.id).then(r => {
                        const arr = Array.isArray(r) ? r : [];
                        return arr.map(item => ({ ...item, _anakanName: a.namaSekolah || a.namaPaket, _noMatrik: a.noMatrik }));
                    }))
                );
                setDetailRealisasi([
                    ...parentList.map(i => ({ ...i, _anakanName: matrik.namaPaket, _noMatrik: matrik.noMatrik })),
                    ...anakanLists.flat()
                ]);
            }
        } catch { toast.error('Gagal memuat detail realisasi'); }
        setLoadingDetail(false);
    };

    const parsePaths = (p) => {
        if (!p) return [];
        if (Array.isArray(p)) return p.filter(Boolean);
        try {
            const parsed = JSON.parse(p);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
            if (typeof parsed === 'string' && parsed) return [parsed];
            return [];
        } catch {
            if (typeof p === 'string' && p.trim()) return [p.trim()];
            return [];
        }
    };

    // ===== LIGHTBOX =====
    const renderLightbox = () => {
        if (!lightbox.open || lightbox.photos.length === 0) return null;
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
                onClick={closeLightbox}>
                <button onClick={closeLightbox}
                    style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <X size={24} />
                </button>
                <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', zIndex: 10 }}>
                    {lightbox.index + 1} / {lightbox.photos.length}
                </div>
                {lightbox.photos.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); lbPrev(); }}
                        style={{ position: 'absolute', left: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <ChevronLeft size={28} />
                    </button>
                )}
                <img src={lightbox.photos[lightbox.index]} alt=""
                    onClick={e => e.stopPropagation()}
                    style={{ maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
                {lightbox.photos.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); lbNext(); }}
                        style={{ position: 'absolute', right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <ChevronRight size={28} />
                    </button>
                )}
            </div>
        );
    };

    // ===== DETAIL MODAL =====
    const renderDetailModal = () => {
        if (!detailMatrik) return null;
        const progress = getProgress(detailMatrik);
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                onClick={() => setDetailMatrik(null)}>
                <div style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: 24, maxWidth: 900, width: '95%', maxHeight: '85vh', overflow: 'auto', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
                    onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Detail Realisasi</h2>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>{detailMatrik.namaPaket}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                Matrik: <strong>{detailMatrik.noMatrik}</strong> • {detailMatrik.jenisPengadaan}
                                {detailMatrik.penyedia && <> • Penyedia: <strong>{detailMatrik.penyedia}</strong></>}
                            </div>
                        </div>
                        <button className="btn-icon" onClick={() => setDetailMatrik(null)}><X size={20} /></button>
                    </div>

                    {/* Progress summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                        <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Target Tertinggi</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{progress.target.toFixed(2)}%</div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Realisasi Tertinggi</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-green)' }}>{progress.realisasi.toFixed(2)}%</div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Total Laporan</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{progress.count}</div>
                        </div>
                    </div>

                    {/* Anakan badge when viewing specific anakan */}
                    {detailAnakan && (
                        <div style={{ marginBottom: 16, padding: '8px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)', display: 'inline-block' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                                📍 {detailAnakan.namaSekolah || detailAnakan.namaPaket}
                            </span>
                        </div>
                    )}

                    {/* Anakan info - only show in indukan mode */}
                    {!detailAnakan && detailMatrik.anakan?.length > 0 && (
                        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 6 }}>Anakan ({detailMatrik.anakan.length} sekolah)</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {detailMatrik.anakan.map(a => (
                                    <span key={a.id} style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                                        {a.noMatrik} - {a.namaSekolah || a.namaPaket}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Realisasi table */}
                    {loadingDetail ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat...</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 35, borderRight: '1px solid var(--border-color)' }}>No</th>
                                        <th style={{ borderRight: '1px solid var(--border-color)' }}>Sekolah/Paket</th>
                                        <th style={{ width: 60, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Tahun</th>
                                        <th style={{ width: 90, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Bulan</th>
                                        <th style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Target</th>
                                        <th style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Realisasi</th>
                                        <th style={{ borderRight: '1px solid var(--border-color)' }}>Dokumentasi</th>
                                        <th>Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        if (detailRealisasi.length === 0) return (
                                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>Belum ada data realisasi</td></tr>
                                        );
                                        // Sort by school, tahun desc, bulan asc
                                        const sorted = [...detailRealisasi].sort((a, b) => {
                                            const sa = (a.namaSekolah || a._anakanName || '').localeCompare(b.namaSekolah || b._anakanName || '');
                                            if (sa !== 0) return sa;
                                            if (a.tahun !== b.tahun) return b.tahun - a.tahun;
                                            return a.bulan - b.bulan;
                                        });
                                        // Build merged rows
                                        const rows = [];
                                        let prevSchool = null, prevTahun = null;
                                        let schoolCount = 0, tahunCount = 0;
                                        let schoolStart = 0, tahunStart = 0;
                                        sorted.forEach((item) => {
                                            const school = item.namaSekolah || item._anakanName || '-';
                                            const isNewSchool = school !== prevSchool;
                                            const isNewTahun = isNewSchool || item.tahun !== prevTahun;
                                            if (isNewSchool && prevSchool !== null) rows[schoolStart].schoolRowSpan = schoolCount;
                                            if (isNewTahun && prevTahun !== null) rows[tahunStart].tahunRowSpan = tahunCount;
                                            if (isNewSchool) { schoolCount = 0; schoolStart = rows.length; }
                                            if (isNewTahun) { tahunCount = 0; tahunStart = rows.length; }
                                            schoolCount++; tahunCount++;
                                            rows.push({ ...item, _school: school, showSchool: isNewSchool, showTahun: isNewTahun });
                                            prevSchool = school; prevTahun = item.tahun;
                                        });
                                        if (rows.length > 0) { rows[schoolStart].schoolRowSpan = schoolCount; rows[tahunStart].tahunRowSpan = tahunCount; }
                                        
                                        let noCounter = 0;
                                        return rows.map((r, i) => {
                                            const target = Number(r.targetPersen) || 0;
                                            const real = Number(r.realisasiPersen) || 0;
                                            const photos = parsePaths(r.dokumentasiPaths);
                                            if (r.showSchool) noCounter++;
                                            return (
                                                <tr key={r.id || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    {r.showSchool && (
                                                        <td rowSpan={r.schoolRowSpan} style={{ textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontWeight: 600 }}>{noCounter}</td>
                                                    )}
                                                    {r.showSchool && (
                                                        <td rowSpan={r.schoolRowSpan} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontSize: '0.82rem', fontWeight: 600, padding: '10px 8px' }}>
                                                            <div>{r._school}</div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{r._noMatrik}</div>
                                                        </td>
                                                    )}
                                                    {r.showTahun && (
                                                        <td rowSpan={r.tahunRowSpan} style={{ textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontSize: '0.82rem', fontWeight: 600 }}>{r.tahun}</td>
                                                    )}
                                                    <td style={{ textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontSize: '0.82rem' }}>{BULAN[r.bulan - 1]}</td>
                                                    <td style={{ textAlign: 'center', minWidth: 90, verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', padding: '8px 6px' }}>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 2 }}>{target.toFixed(2)}%</div>
                                                        <div style={{ width: '100%', height: 5, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(target, 100)}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: 3 }} />
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center', minWidth: 90, verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', padding: '8px 6px' }}>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 2 }}>{real.toFixed(2)}%</div>
                                                        <div style={{ width: '100%', height: 5, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(real, 100)}%`, height: '100%', background: real < target * 0.8 ? 'var(--accent-red, #ef4444)' : 'var(--accent-green)', borderRadius: 3 }} />
                                                        </div>
                                                    </td>
                                                    <td style={{ verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', padding: '6px' }}>
                                                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                                            {photos.length > 0 ? photos.map((p, j) => {
                                                                const allPhotos = photos.map(pp => fixImgPath(pp));
                                                                return (
                                                                    <div key={j} onClick={() => openLightbox(allPhotos, j)} style={{ cursor: 'pointer' }}>
                                                                        <img src={fixImgPath(p)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-color)', transition: 'transform 0.15s' }}
                                                                            onMouseEnter={e => e.target.style.transform = 'scale(1.1)'}
                                                                            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                                                            onError={e => { e.target.style.display = 'none'; e.target.parentElement.style.display = 'flex'; e.target.parentElement.style.alignItems = 'center'; e.target.parentElement.style.justifyContent = 'center'; e.target.parentElement.style.width = '40px'; e.target.parentElement.style.height = '40px'; e.target.parentElement.style.background = 'var(--bg-secondary)'; e.target.parentElement.style.borderRadius = '4px'; const s = document.createElement('span'); s.textContent = '📷'; s.style.fontSize = '0.9rem'; s.style.opacity = '0.4'; e.target.parentElement.appendChild(s); }} />
                                                                    </div>
                                                                );
                                                            }) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>-</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', verticalAlign: 'middle' }}>{r.keterangan || '-'}</td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ===== MAIN PAGE =====
    return (
        <div>
            {renderLightbox()}
            {renderDetailModal()}

            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-green))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                Monitoring Realisasi
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4, marginBottom: 20 }}>
                Pantau progress pelaksanaan pekerjaan seluruh penyedia
            </p>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
                {[
                    { icon: <BarChart3 size={18} />, label: 'Total Paket', value: stats.totalPaket, sub: `${stats.totalAnakan} sekolah (anakan)`, color: 'var(--accent-blue)' },
                    { icon: <Target size={18} />, label: 'Total Laporan', value: stats.totalRealisasi, sub: `${stats.totalRealisasi} laporan masuk`, color: 'var(--accent-green)' },
                    { icon: <Camera size={18} />, label: 'Rata-rata Realisasi', value: `${stats.avg.toFixed(1)}%`, sub: 'dari semua laporan', color: 'var(--accent-orange, #f59e0b)' },
                    { icon: <AlertTriangle size={18} />, label: 'Di Bawah Target', value: stats.belowTarget, sub: 'realisasi < 80% target', color: 'var(--accent-red, #ef4444)' },
                ].map((s, i) => (
                    <div key={i} style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: s.color }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            {s.icon} {s.label}
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>{s.sub}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left" style={{ gap: 8 }}>
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari penyedia, paket, sekolah..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                <option value="15">15</option><option value="30">30</option><option value="50">50</option>
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat data paket...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 35 }}>No</th>
                                    <th style={{ width: 65 }}>Matrik</th>
                                    <th>Penyedia</th>
                                    <th style={{ minWidth: 220 }}>Nama Paket</th>
                                    <th>Jenis</th>
                                    <th style={{ textAlign: 'center' }}>Progress</th>
                                    <th>Anakan</th>
                                    <th style={{ width: 70 }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((k, i) => {
                                    const hasAnakan = k.anakan && k.anakan.length > 0;
                                    const isExpanded = expandedId === k.id;
                                    const progress = getProgress(k);
                                    return (
                                        <>
                                            <tr key={k.id}>
                                                <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600 }}>{k.noMatrik}</td>
                                                <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>{k.penyedia || '-'}</td>
                                                <td style={{ fontSize: '0.82rem' }}>{k.namaPaket}</td>
                                                <td>
                                                    <span style={{
                                                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap', fontWeight: 500,
                                                        background: k.jenisPengadaan?.includes('Konstruksi') ? 'rgba(34,197,94,0.08)' : k.jenisPengadaan?.includes('Pengawasan') ? 'rgba(59,130,246,0.08)' : 'rgba(245,158,11,0.08)',
                                                        color: k.jenisPengadaan?.includes('Konstruksi') ? 'var(--accent-green)' : k.jenisPengadaan?.includes('Pengawasan') ? 'var(--accent-blue)' : 'var(--accent-orange, #f59e0b)',
                                                    }}>
                                                        {k.jenisPengadaan}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center', minWidth: 120 }}>
                                                    {progress.count > 0 ? (
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 3 }}>
                                                                <span style={{ color: 'var(--accent-blue)' }}>T:{progress.target.toFixed(1)}%</span>
                                                                <span style={{ color: 'var(--accent-green)' }}>R:{progress.realisasi.toFixed(1)}%</span>
                                                            </div>
                                                            <div style={{ width: '100%', height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                                                                <div style={{ width: `${Math.min(progress.target, 100)}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: 3, opacity: 0.3, position: 'absolute' }} />
                                                                <div style={{ width: `${Math.min(progress.realisasi, 100)}%`, height: '100%', background: 'var(--accent-green)', borderRadius: 3, position: 'relative' }} />
                                                            </div>
                                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>{progress.count} laporan</div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Belum ada</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {hasAnakan ? (
                                                        <button className="btn btn-ghost btn-sm" onClick={() => setExpandedId(isExpanded ? null : k.id)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--accent-blue)' }}>
                                                            {k.anakan.length} sekolah {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </button>
                                                    ) : <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>-</span>}
                                                </td>
                                                <td>
                                                    <button className="btn-icon" onClick={() => openDetail(k)} title="Detail"
                                                        style={{ color: 'var(--accent-blue)' }}>
                                                        <Eye size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                            {hasAnakan && isExpanded && k.anakan.map(a => (
                                                <tr key={`${k.id}-${a.id}`} style={{ background: 'rgba(59,130,246,0.03)' }}>
                                                    <td></td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: 12 }}>{a.noMatrik}</td>
                                                    <td></td>
                                                    <td colSpan={2} style={{ fontSize: '0.82rem', paddingLeft: 4 }}>
                                                        <span style={{ color: 'var(--accent-blue)', marginRight: 6 }}>↳</span>
                                                        {a.namaSekolah || a.namaPaket}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {(() => {
                                                            const aRl = realisasiByMatrik[a.id] || [];
                                                            if (aRl.length === 0) return <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>-</span>;
                                                            const maxR = Math.max(...aRl.map(r => Number(r.realisasi?.realisasiPersen || r.realisasiPersen || 0)));
                                                            return <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-green)' }}>{maxR.toFixed(1)}%</span>;
                                                        })()}
                                                    </td>
                                                    <td>
                                                        {a.nilaiKontrak ? (
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)' }}>{formatCurrency(a.nilaiKontrak)}</span>
                                                        ) : null}
                                                    </td>
                                                    <td>
                                                        <button className="btn-icon" onClick={() => openDetail(k, a)} title="Detail anakan"
                                                            style={{ color: 'var(--accent-green)' }}>
                                                            <Eye size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </>
                                    );
                                })}
                                {paged.length === 0 && (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                        Tidak ada paket yang sesuai.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="table-pagination">
                    <div className="table-pagination-info">
                        Menampilkan {filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} paket
                    </div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem' }}>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonitoringRealisasi;
