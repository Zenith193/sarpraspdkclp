import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Download, Eye, ChevronLeft, ChevronRight, FileText, Wallet, Package, Upload, CheckCircle, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatters';
import useMatrikStore from '../../store/matrikStore';
import useAuthStore from '../../store/authStore';
import { bastApi } from '../../api/index';

const RiwayatBantuan = ({ readOnly = false }) => {
    const bastData = useMatrikStore(s => s.bastData);
    const user = useAuthStore(s => s.user);
    const role = user?.role?.toLowerCase();
    const npsn = user?.npsn || user?.email?.split('@')[0];

    // DB-fetched data for sekolah
    const [dbBastData, setDbBastData] = useState([]);
    const [loadingDb, setLoadingDb] = useState(false);

    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewItem, setViewItem] = useState(null);
    const [uploading, setUploading] = useState(null);
    const fileInputRef = useRef(null);
    const uploadTargetRef = useRef(null);

    // Fetch from DB for sekolah role (or readOnly roles)
    useEffect(() => {
        if (readOnly && npsn) {
            setLoadingDb(true);
            bastApi.getByNpsn(npsn)
                .then(items => setDbBastData(items || []))
                .catch(() => setDbBastData([]))
                .finally(() => setLoadingDb(false));
        }
    }, [readOnly, npsn]);

    // For admin: use local store + merge DB bastFisikPath
    // For sekolah: use DB data
    const data = useMemo(() => {
        if (readOnly) {
            // Sekolah: use DB data, normalize field names
            return dbBastData.map(b => ({
                id: b.id,
                matrikId: b.matrikId || b.matrik_id,
                npsn: b.npsn,
                namaSekolah: b.namaSekolah || b.nama_sekolah,
                namaPaket: b.namaPaket || b.nama_paket,
                noBAST: b.noBast || b.no_bast || b.noBAST,
                nilaiKontrak: b.nilaiKontrak || b.nilai_kontrak || 0,
                nilaiBAST: b.nilaiKontrak || b.nilai_kontrak || 0,
                penyedia: b.penyedia,
                bastFisikPath: b.bastFisikPath || b.bast_fisik_path,
                splHistoryId: b.splHistoryId || b.spl_history_id,
                createdAt: b.createdAt || b.created_at,
            }));
        }
        // Admin: use local store data
        let items = bastData || [];
        return items;
    }, [readOnly, bastData, dbBastData]);

    // Search
    const filtered = useMemo(() => {
        if (!search) return data;
        const q = search.toLowerCase();
        return data.filter(d =>
            d.namaSekolah?.toLowerCase().includes(q) ||
            d.npsn?.includes(q) ||
            d.namaPaket?.toLowerCase().includes(q) ||
            d.noBAST?.toLowerCase().includes(q)
        );
    }, [data, search]);

    // Stats
    const stats = useMemo(() => {
        const totalNilaiBAST = data.reduce((sum, b) => sum + (b.nilaiBAST || b.nilaiKontrak || 0), 0);
        const uniqueNpsn = new Set(data.map(b => b.npsn)).size;
        return { total: data.length, totalNilaiBAST, uniqueNpsn };
    }, [data]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    useEffect(() => { setCurrentPage(1); }, [search, pageSize]);

    // Upload handler (admin only)
    const handleUploadClick = (item) => {
        uploadTargetRef.current = item;
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTargetRef.current) return;

        const item = uploadTargetRef.current;
        const matrikId = item.matrikId;
        if (!matrikId) {
            toast.error('Matrik ID tidak ditemukan');
            e.target.value = '';
            return;
        }

        setUploading(matrikId);
        try {
            await bastApi.uploadFisik(matrikId, file);
            toast.success('BAST Fisik berhasil diupload');
            // Update local state for admin
            const store = useMatrikStore.getState();
            if (store.updateBAST) {
                store.updateBAST(item.id, { bastFisikPath: 'uploaded' });
            }
        } catch (err) {
            toast.error(err.message || 'Upload gagal');
        } finally {
            setUploading(null);
            e.target.value = '';
        }
    };

    const handleDownloadFisik = async (item) => {
        const matrikId = item.matrikId;
        try {
            const blob = await bastApi.downloadFisik(matrikId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `BAST_Fisik_${item.noBAST || item.noMatrik || ''}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(err.message || 'Download gagal');
        }
    };

    // Get softfile URL from splHistoryId
    const getSoftfileUrl = (d) => {
        if (d.splHistoryId) return `/api/template/spl-file/pdf/${d.splHistoryId}`;
        return null;
    };

    // Cell style for text wrapping
    const wrapStyle = { fontSize: '0.85rem', whiteSpace: 'normal', wordBreak: 'break-word', minWidth: 120 };

    // Determine columns based on role
    const isSekolah = readOnly && role === 'sekolah';

    return (
        <div>
            {/* Hidden file input for admin upload */}
            {!readOnly && <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />}

            {/* ===== STATS ===== */}
            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <FileText size={14} style={{ marginRight: 4 }} /> Total BAST
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>{stats.total}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <Wallet size={14} style={{ marginRight: 4 }} /> Total Nilai BAST
                    </div>
                    <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: '1.25rem' }}>{formatCurrency(stats.totalNilaiBAST)}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <Package size={14} style={{ marginRight: 4 }} /> {readOnly ? 'Paket Bantuan' : 'Sekolah Penerima'}
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>{readOnly ? stats.total : stats.uniqueNpsn}</div>
                </div>
            </div>

            <div className="page-header">
                <div className="page-header-left">
                    <h1>Riwayat Bantuan</h1>
                    <p>Data BAST yang sudah di-generate{readOnly ? ' untuk sekolah Anda' : ''}</p>
                </div>
            </div>
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari sekolah, paket, NPSN, BAST..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                <option value="10">10</option>
                                <option value="15">15</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                    </div>
                </div>

                {loadingDb ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat data...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                            <colgroup>
                                <col style={{ width: 45 }} />
                                <col style={{ width: '15%' }} />
                                {!isSekolah && <col style={{ width: 85 }} />}
                                <col style={{ width: '22%' }} />
                                <col style={{ width: '16%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '15%' }} />
                                <col style={{ width: 50 }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Nama Sekolah</th>
                                    {!isSekolah && <th>NPSN</th>}
                                    <th>Nama Paket</th>
                                    <th>No BAST</th>
                                    <th style={{ textAlign: 'right' }}>Nilai BAST</th>
                                    <th>{isSekolah ? 'Dokumen' : 'BAST Fisik'}</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((d, i) => (
                                    <tr key={d.id || i}>
                                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                        <td style={wrapStyle}>{d.namaSekolah}</td>
                                        {!isSekolah && <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{d.npsn}</td>}
                                        <td style={{ ...wrapStyle, minWidth: 160 }}>
                                            <div style={{ fontWeight: 500 }}>{d.namaPaket}</div>
                                            {d.jenisPengadaan && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{d.jenisPengadaan}</div>}
                                        </td>
                                        <td style={{ ...wrapStyle, fontFamily: 'monospace', fontSize: '0.75rem' }}>{d.noBAST}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--accent-green)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatCurrency(d.nilaiBAST || d.nilaiKontrak)}</td>

                                        {/* ===== DOKUMEN / BAST FISIK column ===== */}
                                        <td>
                                            {isSekolah ? (
                                                /* SEKOLAH VIEW: show fisik if uploaded, else show generated softfile */
                                                d.bastFisikPath ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                                        <CheckCircle size={14} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 600 }}>Fisik</span>
                                                        <button className="btn-icon" onClick={() => window.open(bastApi.previewFisikUrl(d.matrikId), '_blank')} title="Preview PDF" style={{ color: 'var(--accent-purple)' }}>
                                                            <Eye size={14} />
                                                        </button>
                                                        <button className="btn-icon" onClick={() => handleDownloadFisik(d)} title="Download PDF" style={{ color: 'var(--accent-blue)' }}>
                                                            <Download size={14} />
                                                        </button>
                                                        <button className="btn-icon" onClick={() => { const w = window.open(bastApi.previewFisikUrl(d.matrikId), '_blank'); setTimeout(() => w?.print(), 1000); }} title="Print" style={{ color: 'var(--text-secondary)' }}>
                                                            <Printer size={14} />
                                                        </button>
                                                    </div>
                                                ) : getSoftfileUrl(d) ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                                        <FileText size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', fontWeight: 600 }}>Softfile</span>
                                                        <button className="btn-icon" onClick={() => window.open(getSoftfileUrl(d), '_blank')} title="Preview PDF" style={{ color: 'var(--accent-purple)' }}>
                                                            <Eye size={14} />
                                                        </button>
                                                        <button className="btn-icon" onClick={() => {
                                                            const a = document.createElement('a'); a.href = getSoftfileUrl(d); a.download = `BAST_${d.noBAST || ''}.pdf`; a.click();
                                                        }} title="Download PDF" style={{ color: 'var(--accent-blue)' }}>
                                                            <Download size={14} />
                                                        </button>
                                                        <button className="btn-icon" onClick={() => { const w = window.open(getSoftfileUrl(d), '_blank'); setTimeout(() => w?.print(), 1000); }} title="Print" style={{ color: 'var(--text-secondary)' }}>
                                                            <Printer size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Belum tersedia</span>
                                                )
                                            ) : (
                                                /* ADMIN VIEW: upload/manage BAST fisik */
                                                d.bastFisikPath ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                                        <CheckCircle size={14} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                                                        <button className="btn-icon" onClick={() => window.open(bastApi.previewFisikUrl(d.matrikId), '_blank')} title="Preview BAST Fisik" style={{ color: 'var(--accent-purple)' }}>
                                                            <Eye size={14} />
                                                        </button>
                                                        <button className="btn-icon" onClick={() => handleDownloadFisik(d)} title="Download BAST Fisik" style={{ color: 'var(--accent-blue)' }}>
                                                            <Download size={14} />
                                                        </button>
                                                        <button className="btn btn-sm" onClick={() => handleUploadClick(d)}
                                                            style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-input)' }}
                                                            disabled={uploading === d.matrikId}>
                                                            Ganti
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button className="btn btn-sm" onClick={() => handleUploadClick(d)}
                                                        style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                                                        disabled={uploading === d.matrikId}>
                                                        {uploading === d.matrikId ? (
                                                            <span>Uploading...</span>
                                                        ) : (
                                                            <><Upload size={12} /> Upload</>
                                                        )}
                                                    </button>
                                                )
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-icon" onClick={() => setViewItem(d)} title="Detail"><Eye size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {paginatedData.length === 0 && (
                                    <tr>
                                        <td colSpan={isSekolah ? 7 : 8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            {data.length === 0
                                                ? (isSekolah ? 'Belum ada BAST yang tersedia untuk sekolah Anda' : 'Belum ada BAST yang di-generate. Buat BAST terlebih dahulu di menu Create BAST.')
                                                : 'Tidak ada data ditemukan'}
                                        </td>
                                    </tr>
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
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem' }}>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ===== VIEW DETAIL MODAL ===== */}
            {viewItem && (
                <div className="modal-overlay" onClick={() => setViewItem(null)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Detail Riwayat Bantuan</div>
                            <button className="modal-close" onClick={() => setViewItem(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                                {[
                                    { label: 'No BAST', value: viewItem.noBAST },
                                    { label: 'Nama Paket', value: viewItem.namaPaket },
                                    { label: 'Sekolah', value: viewItem.namaSekolah },
                                    { label: 'NPSN', value: viewItem.npsn },
                                    { label: 'Nilai BAST', value: formatCurrency(viewItem.nilaiBAST || viewItem.nilaiKontrak) },
                                    { label: 'Penyedia', value: viewItem.penyedia },
                                    { label: 'BAST Fisik', value: viewItem.bastFisikPath ? '✅ Sudah diupload' : '❌ Belum diupload' },
                                ].map(item => (
                                    <div key={item.label}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{item.label}</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.value || '-'}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Action buttons in modal */}
                            {isSekolah && (
                                <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {viewItem.bastFisikPath ? (
                                        <>
                                            <button className="btn btn-sm" onClick={() => window.open(bastApi.previewFisikUrl(viewItem.matrikId), '_blank')}
                                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Eye size={14} /> Preview BAST Fisik
                                            </button>
                                            <button className="btn btn-sm" onClick={() => handleDownloadFisik(viewItem)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Download size={14} /> Download BAST Fisik
                                            </button>
                                        </>
                                    ) : getSoftfileUrl(viewItem) ? (
                                        <>
                                            <button className="btn btn-sm" onClick={() => window.open(getSoftfileUrl(viewItem), '_blank')}
                                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Eye size={14} /> Preview Softfile
                                            </button>
                                            <button className="btn btn-sm" onClick={() => { const w = window.open(getSoftfileUrl(viewItem), '_blank'); setTimeout(() => w?.print(), 1000); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Printer size={14} /> Print
                                            </button>
                                        </>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RiwayatBantuan;