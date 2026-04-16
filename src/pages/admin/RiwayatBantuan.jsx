import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Download, Eye, ChevronLeft, ChevronRight, FileText, Wallet, Package, Upload, CheckCircle, Printer, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatters';
import useMatrikStore from '../../store/matrikStore';
import useAuthStore from '../../store/authStore';
import { bastApi, korwilApi, sekolahApi } from '../../api/index';

const RiwayatBantuan = ({ readOnly = false }) => {
    // bastData now loaded from DB for all roles
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
    const [openMenu, setOpenMenu] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const fileInputRef = useRef(null);
    const uploadTargetRef = useRef(null);
    const menuRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
        };
        if (openMenu) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [openMenu]);

    const isSekolah = role === 'sekolah';
    const isKorwil = role === 'korwil';
    const isAdmin = role === 'admin';

    // Fetch BAST data from DB — role-specific logic
    useEffect(() => {
        setLoadingDb(true);
        if (isSekolah && npsn) {
            // Sekolah: fetch by NPSN only
            bastApi.getByNpsn(npsn)
                .then(items => setDbBastData(items || []))
                .catch(() => setDbBastData([]))
                .finally(() => setLoadingDb(false));
        } else if (isKorwil) {
            // Korwil: fetch all BAST, then filter by assigned kecamatan/jenjang
            Promise.all([
                bastApi.list(),
                korwilApi.list(),
                sekolahApi.list({ limit: 99999 }),
            ]).then(([bastItems, korwilList, sekolahList]) => {
                const bastArr = Array.isArray(bastItems) ? bastItems : (bastItems?.data || []);
                const korwilArr = Array.isArray(korwilList) ? korwilList : (korwilList?.data || []);
                const sekolahArr = Array.isArray(sekolahList) ? sekolahList : (sekolahList?.data || []);
                console.log('[RiwayatBantuan Korwil] bastArr:', bastArr.length, 'korwilArr:', korwilArr.length, 'sekolahArr:', sekolahArr.length);
                console.log('[RiwayatBantuan Korwil] user.id:', user.id, 'sample korwil:', korwilArr.slice(0, 3));
                // Find this korwil's assignments
                const myRows = korwilArr.filter(row => {
                    const ka = row.korwilAssignment || row;
                    return String(ka.userId) === String(user.id);
                });
                const myKecList = [];
                let myJenjang = '';
                myRows.forEach(row => {
                    const ka = row.korwilAssignment || row;
                    if (ka.kecamatan && !myKecList.includes(ka.kecamatan)) myKecList.push(ka.kecamatan);
                    if (ka.jenjang) myJenjang = ka.jenjang;
                });
                console.log('[RiwayatBantuan Korwil] myRows:', myRows.length, 'kecamatan:', myKecList, 'jenjang:', myJenjang);
                // Build NPSN → sekolah lookup
                const npsnToSekolah = {};
                sekolahArr.forEach(s => { if (s.npsn) npsnToSekolah[s.npsn] = s; });
                // Filter BAST by kecamatan/jenjang
                const filtered = bastArr.filter(b => {
                    const sch = npsnToSekolah[b.npsn];
                    if (!sch) return false;
                    const kecMatch = myKecList.length === 0 || myKecList.includes(sch.kecamatan);
                    const jenMatch = !myJenjang || sch.jenjang === myJenjang;
                    return kecMatch && jenMatch;
                });
                console.log('[RiwayatBantuan Korwil] filtered:', filtered.length, 'bastNpsns:', bastArr.map(b => b.npsn));
                setDbBastData(filtered);
            }).catch(err => { console.error('[RiwayatBantuan Korwil] Error:', err); setDbBastData([]); })
              .finally(() => setLoadingDb(false));
        } else {
            // Admin/Verifikator: fetch all
            bastApi.list()
                .then(items => {
                    const arr = Array.isArray(items) ? items : (items?.data || []);
                    setDbBastData(arr);
                })
                .catch(() => setDbBastData([]))
                .finally(() => setLoadingDb(false));
        }
    }, [role, npsn, user?.id]);

    const data = useMemo(() => {
        return dbBastData.map(b => ({
            id: b.id,
            bastId: b.id,
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
        })).sort((a, b) => {
            // Sort by createdAt descending (newest first)
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
    }, [dbBastData]);

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
                                <col style={{ width: isAdmin ? 45 : 45 }} />
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

                                        {/* Aksi — single dropdown button */}
                                        <td>
                                            <div style={{ position: 'relative' }}>
                                                <button className="btn-icon" onClick={(e) => {
                                                    const key = d.matrikId || d.id;
                                                    if (openMenu === key) { setOpenMenu(null); return; }
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                                    setOpenMenu(key);
                                                }} title="Aksi" style={{ color: 'var(--text-primary)' }}>
                                                    <MoreVertical size={16} />
                                                </button>
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

            {/* Fixed dropdown menu portal */}
            {openMenu && (() => {
                const d = data.find(item => (item.matrikId || item.id) === openMenu);
                if (!d) return null;
                const items = [];
                const fileUrl = d.bastFisikPath ? bastApi.previewFisikUrl(d.matrikId) : getSoftfileUrl(d);
                const fileLabel = d.bastFisikPath ? 'BAST Fisik' : 'Softfile';
                if (fileUrl) {
                    items.push({ icon: <Eye size={14} />, label: `Preview ${fileLabel}`, onClick: () => window.open(fileUrl, '_blank') });
                    items.push({ icon: <Download size={14} />, label: `Download ${fileLabel}`, onClick: () => {
                        if (d.bastFisikPath) handleDownloadFisik(d);
                        else { const a = document.createElement('a'); a.href = fileUrl; a.download = `BAST_${d.noBAST || ''}.pdf`; a.click(); }
                    }});
                    if (!isAdmin) {
                        items.push({ icon: <Printer size={14} />, label: 'Print', onClick: () => { const w = window.open(fileUrl, '_blank'); setTimeout(() => w?.print(), 1000); }});
                    }
                }
                items.push({ icon: <Eye size={14} />, label: 'Detail', onClick: () => setViewItem(d) });
                return (
                    <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpenMenu(null)} />
                        <div ref={menuRef} style={{
                            position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 100,
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                            minWidth: 170, padding: '4px 0',
                        }}>
                            {items.map((item, idx) => (
                                <button key={idx} onClick={() => { item.onClick(); setOpenMenu(null); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                        padding: '8px 14px', background: 'none', border: 'none',
                                        color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </>
                );
            })()}

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
