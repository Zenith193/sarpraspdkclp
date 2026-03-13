import { useState, useMemo, useRef, useEffect } from 'react';
import { Upload, Search, Download, Eye, Plus, Trash2, X, Save, AlertTriangle, FileText, FileSpreadsheet, FileDown, ChevronDown, CheckCircle, XCircle, RefreshCw, ShieldOff, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { useSekolahData } from '../../data/dataProvider';
import { MASA_BANGUNAN } from '../../utils/constants';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import SearchableSelect from '../../components/ui/SearchableSelect';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { kerusakanApi } from '../../api/index';
import { useApi } from '../../api/hooks';

const UploadFormKerusakan = () => {
    // ===== AUTHORIZATION =====
    const user = useAuthStore(s => s.user);
    const isAdmin = user?.role === 'Admin';
    const isVerifikator = user?.role === 'Verifikator';
    const isSekolah = user?.role === 'Sekolah';
    const canSeeMissing = isAdmin || isVerifikator;
    const canVerify = isAdmin || isVerifikator;
    const { data: sekolahList } = useSekolahData();

    // ===== ACTION DROPDOWN =====
    const [openActionId, setOpenActionId] = useState(null);
    const actionDropdownRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target)) setOpenActionId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ===== STATE DATA (from API) =====
    const { data: apiData, loading, refetch } = useApi(() => kerusakanApi.list(), []);
    const [data, setData] = useState([]);

    useEffect(() => {
        const raw = apiData?.data || (Array.isArray(apiData) ? apiData : []);
        // Flatten nested { formKerusakan: {...}, sekolahNama, sekolahNpsn } into flat objects
        const flat = raw.map(row => {
            if (row.formKerusakan) {
                const fk = row.formKerusakan;
                return {
                    ...fk,
                    id: fk.id,
                    npsn: row.sekolahNpsn || fk.npsn || '',
                    namaSekolah: row.sekolahNama || fk.namaSekolah || '',
                    kecamatan: row.sekolahKecamatan || fk.kecamatan || '',
                    fileName: fk.fileName || fk.file_name || null,
                    filePath: fk.filePath || fk.file_path || null,
                    masaBangunan: fk.masaBangunan || fk.masa_bangunan || '',
                    status: fk.status || 'Belum Upload',
                    fileUrl: fk.filePath ? `/api/file/kerusakan/${fk.id}` : null,
                };
            }
            return row;
        });
        setData(flat);
    }, [apiData]);

    // ===== UI STATE =====
    const [activeTab, setActiveTab] = useState('data');
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [previewItem, setPreviewItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [showExport, setShowExport] = useState(false);
    const exportRef = useRef(null);

    // ===== STATE PAGINASI =====
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // ===== STATE FOR CUSTOM MODALS =====
    const [statusModal, setStatusModal] = useState({ isOpen: false, type: '', data: null });
    const [rejectionReason, setRejectionReason] = useState('');

    // ===== FORM STATE =====
    const [formSekolah, setFormSekolah] = useState('');
    const [formMasa, setFormMasa] = useState(MASA_BANGUNAN[0]);
    const [formFile, setFormFile] = useState(null);

    const missingSchools = useMemo(() => {
        if (!canSeeMissing) return [];
        const uploadedNPSN = new Set(data.filter(d => d.fileName).map(d => d.npsn));
        return sekolahList.filter(s => !uploadedNPSN.has(s.npsn));
    }, [data, canSeeMissing, sekolahList]);

    // ===== FILTERING (Role-Based) =====
    const filtered = useMemo(() => {
        let source = activeTab === 'data' ? data : missingSchools;

        // Backend already filters by sekolahId for Sekolah role, no client filter needed
        // Filter Pencarian
        return source.filter(d => {
            if (search) {
                const q = search.toLowerCase();
                const name = (d.namaSekolah || d.nama || '').toLowerCase();
                const npsn = (d.npsn || '');
                return name.includes(q) || npsn.includes(q);
            }
            return true;
        });
    }, [data, missingSchools, search, activeTab, isSekolah, user]);

    // ===== LOGIC PAGINASI =====
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;

    const pagedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        return filtered.slice(start, end);
    }, [filtered, currentPage, pageSize]);

    // Reset halaman saat search, tab, atau pageSize berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [search, activeTab, pageSize]);

    // ===== HANDLERS =====

    const handleFormFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.type !== 'application/pdf') { toast.error('Hanya file PDF!'); return; }
            if (file.size > 1 * 1024 * 1024) { toast.error('Maks 1MB!'); return; }
            setFormFile(file);
            toast.success('File siap');
        }
    };

    const handleSaveData = async () => {
        const sekolah = sekolahList.find(s => s.nama === formSekolah);
        if (!sekolah) { toast.error('Pilih sekolah'); return; }
        try {
            const fd = new FormData();
            fd.append('sekolahId', sekolah.id);
            fd.append('npsn', isSekolah ? user.npsn : sekolah.npsn);
            fd.append('namaSekolah', isSekolah ? user.namaAkun : sekolah.nama);
            fd.append('masaBangunan', formMasa);
            if (formFile) fd.append('file', formFile);
            await kerusakanApi.create(fd);
            toast.success('Data berhasil diajukan');
            handleCloseModal();
            refetch();
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan');
        }
    };

    const handleDirectUpload = async (e, item) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = null;
        if (file.type !== 'application/pdf') { toast.error('Hanya PDF!'); return; }
        if (file.size > 1 * 1024 * 1024) { toast.error('Maks 1MB!'); return; }

        try {
            const fd = new FormData();
            fd.append('file', file);
            await kerusakanApi.uploadFile(item.id, fd);
            toast.success('File berhasil diunggah');
            refetch();
        } catch (err) {
            toast.error(err.message || 'Gagal upload file');
        }
    };

    const executeDelete = async () => {
        if (deleteTarget) {
            try {
                await kerusakanApi.delete(deleteTarget.id);
                toast.success('Data dihapus');
                setDeleteTarget(null);
                refetch();
            } catch (err) {
                toast.error(err.message || 'Gagal menghapus');
            }
        }
    };

    // ===== VERIFICATION HANDLERS =====
    const handleVerify = async (id) => {
        try {
            await kerusakanApi.verify(id);
            toast.success("Data diverifikasi");
            refetch();
        } catch (err) { toast.error(err.message || 'Gagal verifikasi'); }
    };

    const openRejectModal = (item) => {
        setRejectionReason('');
        setStatusModal({ isOpen: true, type: 'reject', data: item });
    };

    const openUnverifyModal = (item) => {
        setStatusModal({ isOpen: true, type: 'unverify', data: item });
    };

    const executeStatusAction = async () => {
        const { type, data: item } = statusModal;
        try {
            if (type === 'reject') {
                if (!rejectionReason.trim()) { toast.error("Alasan wajib diisi!"); return; }
                await kerusakanApi.reject(item.id, rejectionReason);
                toast.error("Data ditolak");
            } else if (type === 'unverify') {
                await kerusakanApi.unverify(item.id);
                toast.success("Verifikasi dibatalkan");
            }
            setStatusModal({ isOpen: false, type: '', data: null });
            refetch();
        } catch (err) { toast.error(err.message || 'Gagal'); }
    };

    const handleExport = (format) => {
        const dataToExport = isAdmin ? filtered : filtered.filter(d => d.npsn === user.npsn);
        toast.success(`Ekspor ${format} berhasil`);
        setShowExport(false);
    };

    const handleOpenModal = (preSelectedSchool = null) => {
        if (isSekolah) setFormSekolah(user.namaAkun || '');
        else setFormSekolah(preSelectedSchool || '');
        setFormMasa(MASA_BANGUNAN[0]);
        setFormFile(null);
        setShowAddModal(true);
    };

    const handleCloseModal = () => {
        setShowAddModal(false);
        setFormSekolah('');
        setFormMasa(MASA_BANGUNAN[0]);
        setFormFile(null);
    };

    // ===== HELPERS =====
    const renderStatusBadge = (status) => {
        const styles = {
            'Menunggu Verifikasi': { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308', icon: RefreshCw },
            'Diverifikasi': { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', icon: CheckCircle },
            'Ditolak': { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: XCircle },
            'Belum Upload': { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280', icon: AlertTriangle }
        };
        const style = styles[status] || styles['Belum Upload'];
        const Icon = style.icon;
        return (<span className="badge" style={{ background: style.bg, color: style.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon size={12} /> {status}</span>);
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Upload Form Kerusakan</h1>
                    <p>{canSeeMissing ? "Kelola dan verifikasi form kerusakan" : "Upload dan kelola form kerusakan sekolah Anda"}</p>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                        <Plus size={16} /> Tambah Data
                    </button>
                </div>
            </div>

            {/* ===== TABS ===== */}
            <div className="keranjang-tabs" style={{ marginBottom: '1.5rem', maxWidth: '600px' }}>
                <button
                    className={`keranjang-tab ${activeTab === 'data' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('data'); setSearch(''); }}
                >
                    <FileText size={14} style={{ marginRight: 6 }} /> Data {canSeeMissing ? "Upload" : "Saya"}
                </button>

                {canSeeMissing && (
                    <button
                        className={`keranjang-tab ${activeTab === 'missing' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('missing'); setSearch(''); }}
                    >
                        <AlertTriangle size={14} style={{ marginRight: 6 }} /> Belum Upload ({missingSchools.length})
                    </button>
                )}
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        {/* Select Snippet untuk Pembatas Data */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                            >
                                <option value="10">10</option>
                                <option value="15">15</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-toolbar-right">
                        <div className="export-dropdown" ref={exportRef}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(!showExport)}>
                                <Download size={14} /> Ekspor <ChevronDown size={12} />
                            </button>
                            {showExport && (
                                <div className="dropdown-menu">
                                    <button className="dropdown-item" onClick={() => handleExport('excel')}>
                                        <span className="export-icon"><FileSpreadsheet size={14} /></span> Excel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    {/* ===== TABEL 1: DATA UPLOAD ===== */}
                    {activeTab === 'data' && (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>NPSN</th>
                                    <th>Nama Sekolah</th>
                                    <th>Masa Bangunan</th>
                                    <th>Form Kerusakan</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Menggunakan pagedData */}
                                {pagedData.map((d, i) => (
                                    <tr key={d.id}>
                                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                        <td>{d.npsn}</td>
                                        <td>{d.namaSekolah}</td>
                                        <td>Bangunan {d.masaBangunan}</td>
                                        <td>
                                            {d.fileName ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-green)', fontSize: 12 }}>
                                                    <FileText size={14} />
                                                    <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.fileName}>{d.fileName}</span>
                                                </div>
                                            ) : (
                                                <span className="badge badge-ditolak">Belum Upload</span>
                                            )}
                                        </td>
                                        <td>{renderStatusBadge(d.status)}</td>
                                        <td>
                                            <div style={{ position: 'relative' }} ref={openActionId === d.id ? actionDropdownRef : null}>
                                                <button className="btn-icon" onClick={() => setOpenActionId(openActionId === d.id ? null : d.id)} title="Aksi">
                                                    <MoreVertical size={16} />
                                                </button>
                                                {openActionId === d.id && (
                                                    <div className="dropdown-menu" style={{ right: 0, left: 'auto', top: '100%', marginTop: 4, minWidth: 180, zIndex: 50 }}>
                                                        {d.fileUrl && (
                                                            <button className="dropdown-item" onClick={() => { setPreviewItem(d); setOpenActionId(null); }}>
                                                                <Eye size={14} style={{ marginRight: 8, color: 'var(--accent-blue)' }} /> Lihat File
                                                            </button>
                                                        )}
                                                        {(isAdmin || (isSekolah && d.npsn === user.npsn)) && (
                                                            <label className="dropdown-item" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                                <Upload size={14} style={{ marginRight: 8, color: 'var(--accent-blue)' }} /> {d.fileName ? 'Update File' : 'Upload File'}
                                                                <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => { handleDirectUpload(e, d); setOpenActionId(null); }} />
                                                            </label>
                                                        )}
                                                        {canVerify && d.status === 'Menunggu Verifikasi' && (
                                                            <>
                                                                <button className="dropdown-item" onClick={() => { handleVerify(d.id); setOpenActionId(null); }}>
                                                                    <CheckCircle size={14} style={{ marginRight: 8, color: 'var(--accent-green)' }} /> Verifikasi
                                                                </button>
                                                                <button className="dropdown-item" onClick={() => { openRejectModal(d); setOpenActionId(null); }}>
                                                                    <XCircle size={14} style={{ marginRight: 8, color: 'var(--accent-red)' }} /> Tolak
                                                                </button>
                                                            </>
                                                        )}
                                                        {canVerify && d.status === 'Diverifikasi' && (
                                                            <button className="dropdown-item" onClick={() => { openUnverifyModal(d); setOpenActionId(null); }}>
                                                                <ShieldOff size={14} style={{ marginRight: 8, color: 'var(--accent-orange)' }} /> Batalkan Verifikasi
                                                            </button>
                                                        )}
                                                        {(isAdmin || (isSekolah && d.npsn === user.npsn && !d.verified)) && (
                                                            <button className="dropdown-item" onClick={() => { setDeleteTarget(d); setOpenActionId(null); }} style={{ color: 'var(--accent-red)' }}>
                                                                <Trash2 size={14} style={{ marginRight: 8 }} /> Hapus
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {pagedData.length === 0 && (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                        {isSekolah ? "Anda belum memiliki data form kerusakan." : "Tidak ada data"}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* ===== TABEL 2: REKAP BELUM UPLOAD (Hanya Admin) ===== */}
                    {activeTab === 'missing' && canSeeMissing && (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>NPSN</th>
                                    <th>Nama Sekolah</th>
                                    <th>Kecamatan</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Menggunakan pagedData */}
                                {pagedData.map((s, i) => (
                                    <tr key={s.npsn}>
                                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                                        <td>{s.npsn}</td>
                                        <td>{s.nama}</td>
                                        <td>{s.kecamatan || '-'}</td>
                                        <td><span className="badge badge-ditolak">Belum Ada Form</span></td>
                                        <td>
                                            <button className="btn btn-primary btn-sm" onClick={() => handleOpenModal(s.nama)} style={{ padding: '4px 10px', fontSize: 12 }}>
                                                <Plus size={12} style={{ marginRight: 4 }} /> Tambah
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {pagedData.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                        Semua sekolah telah mengunggah form.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer Paginasi */}
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

            {/* ===== MODALS (Tambah, Status, Preview, Hapus) ===== */}
            {/* Kode modal tetap sama seperti sebelumnya, dipersingkat di sini untuk fokus pada perubahan tabel */}
            {showAddModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Tambah Data Form</div>
                            <button className="modal-close" onClick={handleCloseModal}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Pilih Sekolah</label>
                                {isSekolah ? (
                                    <input className="form-input" value={user.namaAkun} disabled />
                                ) : (
                                    <SearchableSelect options={sekolahList.map(s => s.nama)} value={formSekolah} onChange={setFormSekolah} placeholder="-- Cari Sekolah --" />
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Masa Bangunan</label>
                                <select className="form-select" value={formMasa} onChange={e => setFormMasa(e.target.value)}>
                                    {MASA_BANGUNAN.map(m => <option key={m} value={m}>Bangunan {m}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Upload Form (PDF)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                        <Upload size={14} /> {formFile ? 'Ganti' : 'Pilih File'}
                                        <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFormFileChange} />
                                    </label>
                                    {formFile && <span style={{ fontSize: 12 }}>{formFile.name}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={handleCloseModal}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSaveData}><Save size={14} /> Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {statusModal.isOpen && (
                <div className="modal-overlay" onClick={() => setStatusModal({ isOpen: false, type: '', data: null })}>
                    <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: statusModal.type === 'reject' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(249, 115, 22, 0.1)', color: statusModal.type === 'reject' ? 'var(--accent-red)' : 'var(--accent-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                {statusModal.type === 'reject' ? <XCircle size={32} /> : <ShieldOff size={32} />}
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{statusModal.type === 'reject' ? 'Tolak Data Form?' : 'Batalkan Verifikasi?'}</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                                {statusModal.type === 'reject' ? `Data form dari "${statusModal.data?.namaSekolah}" akan ditolak.` : `Verifikasi akan dibatalkan.`}
                            </p>
                            {statusModal.type === 'reject' && (
                                <div style={{ textAlign: 'left', marginBottom: 24 }}>
                                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>Alasan Penolakan <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                                    <textarea className="form-input" rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Tulis alasan penolakan..." />
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={() => setStatusModal({ isOpen: false, type: '', data: null })}>Batal</button>
                                <button className="btn btn-primary" onClick={executeStatusAction} style={{ background: statusModal.type === 'reject' ? 'var(--accent-red)' : 'var(--accent-orange)', borderColor: statusModal.type === 'reject' ? 'var(--accent-red)' : 'var(--accent-orange)' }}>
                                    {statusModal.type === 'reject' ? 'Ya, Tolak' : 'Ya, Batalkan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {previewItem && (
                <div className="modal-overlay" onClick={() => setPreviewItem(null)}>
                    <div style={{ width: '90%', height: '90vh', background: '#fff', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 600 }}>{previewItem.fileName}</div>
                            <button className="btn-icon" onClick={() => setPreviewItem(null)}><X size={18} /></button>
                        </div>
                        <div style={{ flex: 1, background: '#f1f5f9' }}>
                            {previewItem.fileUrl ? <iframe src={previewItem.fileUrl} width="100%" height="100%" style={{ border: 'none' }} title="Preview" /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>File tidak tersedia</div>}
                        </div>
                    </div>
                </div>
            )}

            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><AlertTriangle size={32} /></div>
                            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Hapus Data?</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Data form <strong>"{deleteTarget.namaSekolah}"</strong> akan dihapus permanen.</p>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Batal</button>
                                <button className="btn btn-primary" onClick={executeDelete} style={{ background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}>Hapus</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadFormKerusakan;