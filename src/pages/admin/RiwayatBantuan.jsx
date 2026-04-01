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

    const [dbBastData, setDbBastData] = useState([]);
    const [loadingDb, setLoadingDb] = useState(false);
    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewItem, setViewItem] = useState(null);
    const [uploading, setUploading] = useState(null);
    const fileInputRef = useRef(null);
    const uploadTargetRef = useRef(null);

    const isSekolah = role === 'sekolah';
    const isKorwil = role === 'korwil';
    const isAdmin = role === 'admin';

    // Fetch from DB for non-admin roles
    useEffect(() => {
        if (readOnly && npsn) {
            setLoadingDb(true);
            bastApi.getByNpsn(npsn)
                .then(items => setDbBastData(items || []))
                .catch(() => setDbBastData([]))
                .finally(() => setLoadingDb(false));
        }
    }, [readOnly, npsn]);

    const data = useMemo(() => {
        if (readOnly) {
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
        return bastData || [];
    }, [readOnly, bastData, dbBastData]);

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

    const stats = useMemo(() => {
        const totalNilaiBAST = data.reduce((sum, b) => sum + (b.nilaiBAST || b.nilaiKontrak || 0), 0);
        const uniqueNpsn = new Set(data.map(b => b.npsn)).size;
        return { total: data.length, totalNilaiBAST, uniqueNpsn };
    }, [data]);

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
        if (!matrikId) { toast.error('Matrik ID tidak ditemukan'); e.target.value = ''; return; }

        setUploading(matrikId);
        try {
            await bastApi.uploadFisik(matrikId, file);
            toast.success('BAST Fisik berhasil diupload');
            const store = useMatrikStore.getState();
            if (store.updateBAST) store.updateBAST(item.id, { bastFisikPath: 'uploaded' });
        } catch (err) {
            toast.error(err.message || 'Upload gagal');
        } finally {
            setUploading(null);
            e.target.value = '';
        }
    };

    const handleDownloadFisik = async (item) => {
        try {
            const blob = await bastApi.downloadFisik(item.matrikId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `BAST_Fisik_${item.noBAST || ''}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) { toast.error(err.message || 'Download gagal'); }
    };

    const getSoftfileUrl = (d) => d.splHistoryId ? `/api/template/spl-file/pdf/${d.splHistoryId}` : null;

    // Show Nama Sekolah only for korwil and admin
    const showNamaSekolah = isKorwil || isAdmin;

    const wrapStyle = { fontSize: '0.85rem', whiteSpace: 'normal', wordBreak: 'break-word', minWidth: 100 };

    return (
        <div>
            {!readOnly && <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />}

            {/* Stats */}
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
                            <input placeholder="Cari paket, NPSN, BAST..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
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
                                <col style={{ width: 35 }} />
                                {showNamaSekolah && <col style={{ width: '15%' }} />}
                                <col style={{ width: '25%' }} />
                                <col style={{ width: '18%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: isAdmin ? '14%' : '18%' }} />
                                <col style={{ width: isAdmin ? 90 : 110 }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>No</th>
                                    {showNamaSekolah && <th>Nama Sekolah</th>}
                                    <th>Nama Paket</th>
                                    <th>No BAST</th>
                                    <th style={{ textAlign: 'right' }}>Nilai BAST</th>
                                    <th>{isAdmin ? 'BAST Fisik' : 'Status'}</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((d, i) => (
                                    <tr key={d.id || i}>
                                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                        {showNamaSekolah && <td style={wrapStyle}>{d.namaSekolah}</td>}
                                        <td style={{ ...wrapStyle, minWidth: 140 }}>
                                            <div style={{ fontWeight: 500 }}>{d.namaPaket}</div>
                                            {d.jenisPengadaan && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{d.jenisPengadaan}</div>}
                                        </td>
                                        <td style={{ ...wrapStyle, fontFamily: 'monospace', fontSize: '0.75rem' }}>{d.noBAST}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--accent-green)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                                            {formatCurrency(d.nilaiBAST || d.nilaiKontrak)}
                                        </td>

                                        {/* Status / BAST Fisik column */}
                                        <td>
                                            {isAdmin ? (
                                                /* ADMIN: upload BAST fisik */
                                                d.bastFisikPath ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <CheckCircle size={14} style={{ color: 'var(--accent-green)' }} />
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-green)', fontWeight: 600 }}>Uploaded</span>
                                                        <button className="btn btn-sm" onClick={() => handleUploadClick(d)}
                                                            style={{ fontSize: '0.65rem', padding: '1px 5px', background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-input)', marginLeft: 2 }}
                                                            disabled={uploading === d.matrikId}>Ganti</button>
                                                    </div>
                                                ) : (
                                                    <button className="btn btn-sm" onClick={() => handleUploadClick(d)}
                                                        style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                                                        disabled={uploading === d.matrikId}>
                                                        {uploading === d.matrikId ? 'Uploading...' : <><Upload size={12} /> Upload</>}
                                                    </button>
                                                )
                                            ) : (
                                                /* SEKOLAH/KORWIL: show status */
                                                d.bastFisikPath ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                                                        <CheckCircle size={14} /> BAST Fisik
                                                    </span>
                                                ) : getSoftfileUrl(d) ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                                                        <FileText size={14} /> Softfile
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>-</span>
                                                )
                                            )}
                                        </td>

                                        {/* Aksi column — all buttons here */}
                                        <td>
                                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                                {isAdmin ? (
                                                    /* Admin actions */
                                                    <>
                                                        {d.bastFisikPath && (
                                                            <>
                                                                <button className="btn-icon" onClick={() => window.open(bastApi.previewFisikUrl(d.matrikId), '_blank')} title="Preview Fisik" style={{ color: 'var(--accent-purple)' }}><Eye size={15} /></button>
                                                                <button className="btn-icon" onClick={() => handleDownloadFisik(d)} title="Download Fisik" style={{ color: 'var(--accent-blue)' }}><Download size={15} /></button>
                                                            </>
                                                        )}
                                                        <button className="btn-icon" onClick={() => setViewItem(d)} title="Detail"><Eye size={15} /></button>
                                                    </>
                                                ) : (
                                                    /* Sekolah/Korwil actions */
                                                    <>
                                                        {d.bastFisikPath ? (
                                                            <>
                                                                <button className="btn-icon" onClick={() => window.open(bastApi.previewFisikUrl(d.matrikId), '_blank')} title="Preview" style={{ color: 'var(--accent-purple)' }}><Eye size={15} /></button>
                                                                <button className="btn-icon" onClick={() => handleDownloadFisik(d)} title="Download" style={{ color: 'var(--accent-blue)' }}><Download size={15} /></button>
                                                                <button className="btn-icon" onClick={() => { const w = window.open(bastApi.previewFisikUrl(d.matrikId), '_blank'); setTimeout(() => w?.print(), 1000); }} title="Print" style={{ color: 'var(--text-secondary)' }}><Printer size={15} /></button>
                                                            </>
                                                        ) : getSoftfileUrl(d) ? (
                                                            <>
                                                                <button className="btn-icon" onClick={() => window.open(getSoftfileUrl(d), '_blank')} title="Preview" style={{ color: 'var(--accent-purple)' }}><Eye size={15} /></button>
                                                                <button className="btn-icon" onClick={() => { const a = document.createElement('a'); a.href = getSoftfileUrl(d); a.download = `BAST_${d.noBAST || ''}.pdf`; a.click(); }} title="Download" style={{ color: 'var(--accent-blue)' }}><Download size={15} /></button>
                                                                <button className="btn-icon" onClick={() => { const w = window.open(getSoftfileUrl(d), '_blank'); setTimeout(() => w?.print(), 1000); }} title="Print" style={{ color: 'var(--text-secondary)' }}><Printer size={15} /></button>
                                                            </>
                                                        ) : null}
                                                        <button className="btn-icon" onClick={() => setViewItem(d)} title="Detail"><Eye size={15} /></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {paginatedData.length === 0 && (
                                    <tr>
                                        <td colSpan={showNamaSekolah ? 7 : 6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            {data.length === 0
                                                ? (isSekolah ? 'Belum ada BAST yang tersedia untuk sekolah Anda' : 'Belum ada BAST yang di-generate.')
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
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem' }}>Hal {currentPage} dari {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {viewItem && (
                <div className="modal-overlay" onClick={() => setViewItem(null)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Detail BAST</div>
                            <button className="modal-close" onClick={() => setViewItem(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                                {[
                                    { label: 'No BAST', value: viewItem.noBAST },
                                    { label: 'Sekolah', value: viewItem.namaSekolah },
                                    { label: 'Nama Paket', value: viewItem.namaPaket },
                                    { label: 'NPSN', value: viewItem.npsn },
                                    { label: 'Nilai BAST', value: formatCurrency(viewItem.nilaiBAST || viewItem.nilaiKontrak) },
                                    { label: 'Penyedia', value: viewItem.penyedia },
                                    { label: 'Status', value: viewItem.bastFisikPath ? '✅ BAST Fisik tersedia' : (viewItem.splHistoryId ? '📄 Softfile tersedia' : '⏳ Menunggu') },
                                ].map(item => (
                                    <div key={item.label}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{item.label}</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{item.value || '-'}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Action buttons */}
                            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {viewItem.bastFisikPath && (
                                    <>
                                        <button className="btn btn-sm" onClick={() => window.open(bastApi.previewFisikUrl(viewItem.matrikId), '_blank')}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Eye size={14} /> Preview BAST Fisik
                                        </button>
                                        <button className="btn btn-sm" onClick={() => handleDownloadFisik(viewItem)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Download size={14} /> Download
                                        </button>
                                    </>
                                )}
                                {!viewItem.bastFisikPath && getSoftfileUrl(viewItem) && (
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
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RiwayatBantuan;