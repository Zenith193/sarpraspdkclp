import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, BarChart3, Eye, X, Image as ImageIcon, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { kontrakApi } from '../../api/index';
import toast from 'react-hot-toast';

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const MonitoringRealisasi = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterBulan, setFilterBulan] = useState('');
    const [filterTahun, setFilterTahun] = useState('');
    const [pageSize, setPageSize] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewItem, setViewItem] = useState(null);

    useEffect(() => {
        kontrakApi.allRealisasi().then(res => {
            const arr = Array.isArray(res) ? res : (res?.data || []);
            setData(arr);
        }).catch(e => toast.error('Gagal memuat data realisasi')).finally(() => setLoading(false));
    }, []);

    // Flatten and enrich
    const rows = useMemo(() => {
        return data.map(d => ({
            ...d.realisasi,
            namaPerusahaan: d.namaPerusahaan,
            namaPaket: d.namaPaket,
            noSpk: d.noSpk,
            jenisPengadaan: d.jenisPengadaan,
        }));
    }, [data]);

    // Stats
    const stats = useMemo(() => {
        const total = rows.length;
        const avgTarget = total ? rows.reduce((s, r) => s + (Number(r.targetPersen) || 0), 0) / total : 0;
        const avgRealisasi = total ? rows.reduce((s, r) => s + (Number(r.realisasiPersen) || 0), 0) / total : 0;
        const behindSchedule = rows.filter(r => (Number(r.realisasiPersen) || 0) < (Number(r.targetPersen) || 0) * 0.8).length;
        const uniqueKontrak = new Set(rows.map(r => r.kontrakId)).size;
        return { total, avgTarget, avgRealisasi, behindSchedule, uniqueKontrak };
    }, [rows]);

    // Filter
    const filtered = useMemo(() => {
        let result = rows;
        const q = search.toLowerCase();
        if (q) {
            result = result.filter(r =>
                (r.namaPerusahaan || '').toLowerCase().includes(q) ||
                (r.namaPaket || '').toLowerCase().includes(q) ||
                (r.namaSekolah || '').toLowerCase().includes(q) ||
                (r.noSpk || '').toLowerCase().includes(q)
            );
        }
        if (filterBulan) result = result.filter(r => r.bulan === Number(filterBulan));
        if (filterTahun) result = result.filter(r => r.tahun === Number(filterTahun));
        return result;
    }, [rows, search, filterBulan, filterTahun]);

    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const paged = useMemo(() => {
        const s = (currentPage - 1) * pageSize;
        return filtered.slice(s, s + pageSize);
    }, [filtered, currentPage, pageSize]);

    // Available years
    const years = useMemo(() => {
        const s = new Set(rows.map(r => r.tahun));
        return [...s].sort((a, b) => b - a);
    }, [rows]);

    const parsePaths = (p) => { try { return JSON.parse(p); } catch { return []; } };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Monitoring Realisasi</h1>
                    <p>Pantau progress pelaksanaan pekerjaan seluruh penyedia</p>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <BarChart3 size={14} style={{ marginRight: 4 }} /> Total Laporan
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>{stats.total}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{stats.uniqueKontrak} kontrak</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <TrendingUp size={14} style={{ marginRight: 4 }} /> Rata-rata Realisasi
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--accent-green)' }}>{stats.avgRealisasi.toFixed(1)}%</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Target: {stats.avgTarget.toFixed(1)}%</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-orange, #f59e0b)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <AlertTriangle size={14} style={{ marginRight: 4 }} /> Di Bawah Target
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--accent-orange, #f59e0b)' }}>{stats.behindSchedule}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>realisasi {'<'} 80% target</div>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari penyedia, paket, sekolah..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
                        </div>
                        <select value={filterBulan} onChange={e => { setFilterBulan(e.target.value); setCurrentPage(1); }}
                            style={{ padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            <option value="">Semua Bulan</option>
                            {BULAN.map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
                        </select>
                        <select value={filterTahun} onChange={e => { setFilterTahun(e.target.value); setCurrentPage(1); }}
                            style={{ padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            <option value="">Semua Tahun</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
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
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat data...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>No</th>
                                    <th>Penyedia</th>
                                    <th style={{ minWidth: 200 }}>Nama Paket</th>
                                    <th>Sekolah</th>
                                    <th>Periode</th>
                                    <th style={{ textAlign: 'center', width: 110 }}>Target</th>
                                    <th style={{ textAlign: 'center', width: 110 }}>Realisasi</th>
                                    <th style={{ width: 80 }}>Foto</th>
                                    <th style={{ width: 50 }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((r, i) => {
                                    const target = Number(r.targetPersen) || 0;
                                    const real = Number(r.realisasiPersen) || 0;
                                    const photos = parsePaths(r.dokumentasiPaths);
                                    const behind = real < target * 0.8;
                                    return (
                                        <tr key={r.id} style={{ background: behind ? 'rgba(239,68,68,0.03)' : undefined }}>
                                            <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                            <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>{r.namaPerusahaan || '-'}</td>
                                            <td>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{r.namaPaket || '-'}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{r.jenisPengadaan}</div>
                                            </td>
                                            <td style={{ fontSize: '0.82rem' }}>{r.namaSekolah || '-'}</td>
                                            <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{BULAN[r.bulan - 1]} {r.tahun}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 2 }}>{target.toFixed(2)}%</div>
                                                <div style={{ width: '100%', height: 5, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(target, 100)}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: 3 }} />
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 2, color: behind ? 'var(--accent-red, #ef4444)' : undefined }}>{real.toFixed(2)}%</div>
                                                <div style={{ width: '100%', height: 5, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(real, 100)}%`, height: '100%', background: behind ? 'var(--accent-red, #ef4444)' : 'var(--accent-green)', borderRadius: 3 }} />
                                                </div>
                                            </td>
                                            <td>
                                                {photos.length > 0 ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <ImageIcon size={14} style={{ color: 'var(--text-secondary)' }} />
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{photos.length}</span>
                                                    </div>
                                                ) : <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>-</span>}
                                            </td>
                                            <td>
                                                <button className="btn-icon" onClick={() => setViewItem(r)} title="Detail"><Eye size={16} /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paged.length === 0 && (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Belum ada data realisasi</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="table-pagination">
                    <div className="table-pagination-info">
                        Menampilkan {filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} data
                    </div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem' }}>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {viewItem && (
                <div className="modal-overlay" onClick={() => setViewItem(null)}>
                    <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Detail Realisasi</div>
                            <button className="modal-close" onClick={() => setViewItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                {[
                                    ['Penyedia', viewItem.namaPerusahaan],
                                    ['Nama Paket', viewItem.namaPaket],
                                    ['Sekolah', viewItem.namaSekolah],
                                    ['Jenis', viewItem.jenisPengadaan],
                                    ['Periode', `${BULAN[viewItem.bulan - 1]} ${viewItem.tahun}`],
                                    ['No SPK', viewItem.noSpk],
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{value || '-'}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Progress bars */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Target</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{(Number(viewItem.targetPersen) || 0).toFixed(2)}%</div>
                                    <div style={{ width: '100%', height: 8, background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
                                        <div style={{ width: `${Math.min(Number(viewItem.targetPersen) || 0, 100)}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: 4 }} />
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Realisasi</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-green)' }}>{(Number(viewItem.realisasiPersen) || 0).toFixed(2)}%</div>
                                    <div style={{ width: '100%', height: 8, background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
                                        <div style={{ width: `${Math.min(Number(viewItem.realisasiPersen) || 0, 100)}%`, height: '100%', background: 'var(--accent-green)', borderRadius: 4 }} />
                                    </div>
                                </div>
                            </div>

                            {viewItem.keterangan && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Keterangan</div>
                                    <div style={{ fontSize: '0.85rem', background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>{viewItem.keterangan}</div>
                                </div>
                            )}

                            {/* Photos */}
                            {(() => {
                                const photos = parsePaths(viewItem.dokumentasiPaths);
                                return photos.length > 0 ? (
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>Dokumentasi ({photos.length} foto)</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                            {photos.map((p, j) => (
                                                <a key={j} href={p} target="_blank" rel="noopener noreferrer">
                                                    <img src={p} alt={`Foto ${j + 1}`}
                                                        style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color)' }} />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonitoringRealisasi;
