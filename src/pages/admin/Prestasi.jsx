import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search, Download, Edit, Trash2, Upload, X, Save, AlertTriangle, FileText, FileSpreadsheet, FileDown, ChevronDown, Eye, Settings, Award, BarChart2, Trophy, CheckCircle, XCircle, RefreshCw, ShieldOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSekolahData } from '../../data/dataProvider';
import { TINGKAT_LOMBA } from '../../utils/constants';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import SearchableSelect from '../../components/ui/SearchableSelect';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { prestasiApi } from '../../api/index';
import { useApi } from '../../api/hooks';

// ===== CONSTANTS =====
const KATEGORI_PRESTASI = ['Perorangan', 'Beregu'];
const CAPAIAN_PRESTASI = ['Juara 1', 'Juara 2', 'Juara 3', 'Harapan 1', 'Harapan 2', 'Harapan 3', 'Peserta Terbaik', 'Peserta'];

const Prestasi = () => {
    // ===== AUTHORIZATION =====
    const user = useAuthStore(s => s.user);
    const isAdmin = user?.role === 'Admin';
    const isVerifikator = user?.role === 'Verifikator';
    const isSekolah = user?.role === 'Sekolah';
    const isKorwil = user?.role === 'Korwil';
    const { data: sekolahList } = useSekolahData();

    const canManage = isAdmin || isSekolah;
    const canVerify = isAdmin || isVerifikator;

    // State Tab
    const [activeTab, setActiveTab] = useState('data');

    // State Data Prestasi (from API)
    const { data: apiData, loading, refetch } = useApi(() => prestasiApi.list(), []);
    const [data, setData] = useState([]);

    // State Pengaturan Poin (from API)
    const { data: apiPointData, refetch: refetchPoints } = useApi(() => prestasiApi.listPointRules(), []);
    const [pointSettings, setPointSettings] = useState([]);

    useEffect(() => {
        const raw = apiData?.data || (Array.isArray(apiData) ? apiData : []);
        // Flatten nested { prestasi: {...}, sekolahNama, sekolahNpsn, sekolahKecamatan } into flat objects
        const flat = raw.map(row => {
            if (row.prestasi) {
                const p = row.prestasi;
                return {
                    ...p,
                    namaSekolah: row.sekolahNama || p.namaSekolah || '',
                    npsn: row.sekolahNpsn || p.npsn || '',
                    kecamatan: row.sekolahKecamatan || p.kecamatan || '',
                    sertifikat: p.sertifikat || (p.sertifikatPath ? p.sertifikatPath.split('/').pop().split('\\').pop() : null),
                };
            }
            return row;
        });
        setData(flat);
    }, [apiData]);

    useEffect(() => { if (apiPointData?.data) setPointSettings(apiPointData.data); else if (Array.isArray(apiPointData)) setPointSettings(apiPointData); }, [apiPointData]);

    // UI State
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deletePointTarget, setDeletePointTarget] = useState(null);
    const [showExport, setShowExport] = useState(false);
    const exportRef = useRef(null);
    const [previewFile, setPreviewFile] = useState(null);

    // ===== STATE PAGINASI =====
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // === STATE FOR CUSTOM MODALS ===
    const [statusModal, setStatusModal] = useState({ isOpen: false, type: '', data: null });
    const [rejectionReason, setRejectionReason] = useState('');

    // Form State Prestasi
    // Jika Sekolah, default formSekolah adalah nama akunnya sendiri
    const [formSekolah, setFormSekolah] = useState(isSekolah ? user?.namaAkun : '');
    const [formData, setFormData] = useState({
        jenisPrestasi: '', siswa: '', kategori: KATEGORI_PRESTASI[0],
        tingkat: TINGKAT_LOMBA[0], tahun: new Date().getFullYear(), keterangan: CAPAIAN_PRESTASI[0]
    });
    const [formSertifikat, setFormSertifikat] = useState(null);

    // Form State Poin
    const [showPointModal, setShowPointModal] = useState(false);
    const [editPoint, setEditPoint] = useState(null);
    const [pointForm, setPointForm] = useState({ tingkat: '', kategori: '', capaian: '', poin: 0 });

    // ===== COMPUTED DATA & FILTERING =====

    // 1. Filter Data berdasarkan Role (Hak Akses)
    // Backend already filters by sekolahId for Sekolah role, no additional client filter needed
    const roleFilteredData = useMemo(() => {
        if (!user) return [];
        // Admin & Verifikator: Lihat Semua
        if (isAdmin || isVerifikator) return data;
        // Korwil: Lihat berdasarkan kecamatan pengguna
        if (isKorwil && user.kecamatan) {
            return data.filter(d => d.kecamatan === user.kecamatan);
        }
        // Sekolah: Backend sudah filter by sekolahId, tampilkan semua
        if (isSekolah) return data;
        return [];
    }, [data, user, isAdmin, isVerifikator, isKorwil, isSekolah]);

    // 2. Rekap Data (Dihitung berdasarkan data yang sudah difilter role)
    const rekapData = useMemo(() => {
        const schoolMap = {};
        roleFilteredData.filter(d => d.status === 'Diverifikasi').forEach(d => {
            if (!schoolMap[d.namaSekolah]) schoolMap[d.namaSekolah] = { namaSekolah: d.namaSekolah, npsn: d.npsn, jumlahPrestasi: 0, totalPoin: 0 };
            const rule = pointSettings.find(r => r.tingkat === d.tingkat && r.kategori === d.kategori && r.capaian === d.keterangan);
            schoolMap[d.namaSekolah].jumlahPrestasi += 1;
            schoolMap[d.namaSekolah].totalPoin += rule ? rule.poin : 0;
        });
        return Object.values(schoolMap).sort((a, b) => b.totalPoin - a.totalPoin);
    }, [roleFilteredData, pointSettings]);

    // 3. Source Data untuk Tabel (Dengan Search & Pagination)
    const sourceData = useMemo(() => {
        let result = [];
        if (activeTab === 'data') {
            result = roleFilteredData.filter(d =>
                !search ||
                d.jenisPrestasi.toLowerCase().includes(search.toLowerCase()) ||
                d.siswa.toLowerCase().includes(search.toLowerCase())
            );
        } else if (activeTab === 'poin') {
            result = pointSettings;
        } else if (activeTab === 'rekap') {
            result = rekapData;
        }
        return result;
    }, [activeTab, roleFilteredData, search, pointSettings, rekapData]);

    const totalPages = Math.ceil(sourceData.length / pageSize) || 1;
    const pagedData = useMemo(() => sourceData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [sourceData, currentPage, pageSize]);

    useEffect(() => { setCurrentPage(1); }, [activeTab, search, pageSize]);

    // ===== HANDLERS =====
    const resetForm = () => {
        // Jika sekolah, kembalikan ke nama akunnya. Jika tidak, kosongkan.
        setFormSekolah(isSekolah ? user?.namaAkun : '');
        setFormData({ jenisPrestasi: '', siswa: '', kategori: KATEGORI_PRESTASI[0], tingkat: TINGKAT_LOMBA[0], tahun: new Date().getFullYear(), keterangan: CAPAIAN_PRESTASI[0] });
        setFormSertifikat(null);
        setEditItem(null);
    };

    const handleOpenModal = (item = null) => {
        if (!canManage) return;
        // Sekolah tidak bisa edit data yang sudah diverifikasi
        if (item && isSekolah && item.status === 'Diverifikasi') { toast.error("Data yang sudah diverifikasi tidak dapat diubah."); return; }

        if (item) {
            setEditItem(item);
            setFormSekolah(item.namaSekolah);
            setFormData({ jenisPrestasi: item.jenisPrestasi, siswa: item.siswa, kategori: item.kategori, tingkat: item.tingkat, tahun: item.tahun, keterangan: item.keterangan });
        } else {
            resetForm();
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        const sekolahName = isSekolah ? user.namaAkun : formSekolah;
        const sekolah = sekolahList.find(s => s.nama === sekolahName);
        if (!sekolah) { toast.error('Pilih sekolah yang valid'); return; }
        if (!formData.jenisPrestasi || !formData.siswa) { toast.error('Jenis prestasi dan nama siswa wajib diisi'); return; }
        try {
            if (editItem) {
                const payload = { ...formData, tahun: parseInt(formData.tahun), namaSekolah: sekolah.nama, npsn: sekolah.npsn, kecamatan: sekolah.kecamatan, sekolahId: sekolah.id };
                await prestasiApi.update(editItem.id, payload);
                // Upload sertifikat separately if changed
                if (formSertifikat && editItem.id) {
                    const fd = new FormData();
                    fd.append('sertifikat', formSertifikat);
                    await prestasiApi.uploadSertifikat(editItem.id, fd);
                }
                toast.success('Data diperbarui ✅');
            } else {
                // Use FormData so sertifikat file is included
                const fd = new FormData();
                fd.append('jenisPrestasi', formData.jenisPrestasi);
                fd.append('siswa', formData.siswa);
                fd.append('kategori', formData.kategori);
                fd.append('tingkat', formData.tingkat);
                fd.append('tahun', String(parseInt(formData.tahun)));
                fd.append('keterangan', formData.keterangan);
                fd.append('namaSekolah', sekolah.nama);
                fd.append('npsn', sekolah.npsn);
                fd.append('kecamatan', sekolah.kecamatan);
                fd.append('sekolahId', String(sekolah.id));
                if (formSertifikat) fd.append('sertifikat', formSertifikat);
                await prestasiApi.createWithFile(fd);
                toast.success('Pengajuan berhasil 🚀');
            }
            setShowModal(false); resetForm(); refetch();
        } catch (err) { toast.error(err.message || 'Gagal menyimpan'); }
    };

    const executeDelete = async () => { if (deleteTarget) { try { await prestasiApi.delete(deleteTarget.id); toast.success('Data dihapus 🗑️'); setDeleteTarget(null); refetch(); } catch (err) { toast.error(err.message || 'Gagal hapus'); } } };
    const handleVerify = async (id) => { try { await prestasiApi.verify(id); toast.success("Diverifikasi ✔️"); refetch(); } catch (err) { toast.error(err.message || 'Gagal'); } };
    const openRejectModal = (item) => { setRejectionReason(''); setStatusModal({ isOpen: true, type: 'reject', data: item }); };
    const openUnverifyModal = (item) => { setStatusModal({ isOpen: true, type: 'unverify', data: item }); };

    const executeStatusAction = async () => {
        const { type, data: item } = statusModal;
        try {
            if (type === 'reject') { if (!rejectionReason.trim()) { toast.error("Alasan wajib diisi!"); return; } await prestasiApi.reject(item.id, rejectionReason); toast.error("Ditolak 🚫"); }
            else if (type === 'unverify') { await prestasiApi.unverify(item.id); toast.success("Verifikasi dibatalkan 🔄"); }
            setStatusModal({ isOpen: false, type: '', data: null }); refetch();
        } catch (err) { toast.error(err.message || 'Gagal'); }
    };

    const openPointModal = (item = null) => {
        if (item) { setEditPoint(item); setPointForm({ tingkat: item.tingkat, kategori: item.kategori, capaian: item.capaian, poin: item.poin }); }
        else { setEditPoint(null); setPointForm({ tingkat: TINGKAT_LOMBA[0], kategori: KATEGORI_PRESTASI[0], capaian: CAPAIAN_PRESTASI[0], poin: 0 }); }
        setShowPointModal(true);
    };
    const handleSavePoint = async () => {
        if (!pointForm.poin) { toast.error("Masukkan nilai poin"); return; }
        try {
            if (editPoint) { await prestasiApi.updatePointRule(editPoint.id, pointForm); toast.success(`Aturan diperbarui ✨`); }
            else { await prestasiApi.createPointRule(pointForm); toast.success("Aturan ditambahkan 🎉"); }
            setShowPointModal(false); refetchPoints();
        } catch (err) { toast.error(err.message || 'Gagal menyimpan aturan'); }
    };
    const executeDeletePoint = async () => { if (deletePointTarget) { try { await prestasiApi.deletePointRule(deletePointTarget.id); toast.success(`Aturan dihapus 🗑️`); setDeletePointTarget(null); refetchPoints(); } catch (err) { toast.error(err.message || 'Gagal hapus'); } } };
    const handleExport = (format) => { toast.success(`Ekspor ${format} berhasil`); setShowExport(false); };

    // ===== HELPERS =====
    const schoolNames = sekolahList.map(s => s.nama);
    const renderSchoolOption = (name) => { const sch = sekolahList.find(s => s.nama === name); return (<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{name}</span>{sch && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sch.npsn}</span>}</div>); };
    const renderStatusBadge = (status) => {
        const styles = { 'Menunggu Verifikasi': { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308', icon: RefreshCw }, 'Diverifikasi': { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', icon: CheckCircle }, 'Ditolak': { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: XCircle } };
        const style = styles[status] || styles['Menunggu Verifikasi'];
        const Icon = style.icon;
        return (<span className="badge" style={{ background: style.bg, color: style.color, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}><Icon size={12} /> {status}</span>);
    };
    const renderPagination = () => (
        <div className="table-pagination">
            <div className="table-pagination-info" style={{ fontSize: '0.8rem' }}>Menampilkan {sourceData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, sourceData.length)} dari {sourceData.length}</div>
            <div className="table-pagination-controls">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                <span style={{ padding: '0 10px', fontSize: '0.8rem' }}>Hal {currentPage} dari {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
            </div>
        </div>
    );

    return (
        <div>
            <div className="page-header"><div className="page-header-left"><h1>Prestasi & Poin</h1><p>Manajemen Data Prestasi dan peringkat sekolah</p></div></div>

            <div className="keranjang-tabs" style={{ marginBottom: '1.5rem' }}>
                <button className={`keranjang-tab ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}><Award size={14} style={{ marginRight: 6 }} /> Data Prestasi</button>
                {isAdmin && (
                    <button className={`keranjang-tab ${activeTab === 'poin' ? 'active' : ''}`} onClick={() => setActiveTab('poin')}><Settings size={14} style={{ marginRight: 6 }} /> Atur Poin</button>
                )}
                {/* Korwil dan Admin bisa lihat rekap */}
                {(isAdmin || isKorwil) && (
                    <button className={`keranjang-tab ${activeTab === 'rekap' ? 'active' : ''}`} onClick={() => setActiveTab('rekap')}><BarChart2 size={14} style={{ marginRight: 6 }} /> Rekapitulasi</button>
                )}
            </div>

            {/* ===== TAB 1: DATA PRESTASI ===== */}
            {activeTab === 'data' && (
                <div className="table-container">
                    <div className="table-toolbar">
                        <div className="table-toolbar-left">
                            <div className="table-search"><Search size={16} className="search-icon" /><input placeholder="Cari prestasi..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                    <option value="10">10</option><option value="15">15</option><option value="50">50</option><option value="100">100</option>
                                </select>
                            </div>
                        </div>
                        <div className="table-toolbar-right">
                            {canManage && (<button className="btn btn-primary btn-sm" onClick={() => handleOpenModal()}><Plus size={14} /> Ajukan</button>)}
                            <div className="export-dropdown" ref={exportRef}>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(!showExport)}><Download size={14} /> Ekspor <ChevronDown size={12} /></button>
                                {showExport && (<div className="dropdown-menu"><button className="dropdown-item" onClick={() => handleExport('excel')}>Excel</button></div>)}
                            </div>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead><tr>
                                <th style={{ fontSize: '0.8rem' }}>No</th>
                                {/* Sembunyikan kolom Sekolah jika role Sekolah (karena redundant) */}
                                {!isSekolah && <th style={{ fontSize: '0.8rem' }}>Sekolah</th>}
                                <th style={{ fontSize: '0.8rem' }}>Jenis Prestasi</th>
                                <th style={{ fontSize: '0.8rem' }}>Siswa/Tim</th>
                                <th style={{ fontSize: '0.8rem' }}>Capaian</th>
                                <th style={{ fontSize: '0.8rem' }}>Status</th>
                                <th style={{ fontSize: '0.8rem' }}>Sertifikat</th>
                                <th style={{ fontSize: '0.8rem' }}>Aksi</th>
                            </tr></thead>
                            <tbody>
                                {pagedData.map((d, i) => (
                                    <tr key={d.id}>
                                        <td style={{ fontSize: '0.85rem' }}>{(currentPage - 1) * pageSize + i + 1}</td>
                                        {!isSekolah && <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{d.namaSekolah}</td>}
                                        <td style={{ fontSize: '0.85rem' }}>{d.jenisPrestasi}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{d.siswa}</td>
                                        <td><span className="badge badge-baik" style={{ fontSize: '0.75rem' }}>{d.keterangan}</span></td>
                                        <td>{renderStatusBadge(d.status)}</td>
                                        <td>{d.sertifikat ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-green)', fontSize: '0.8rem' }}><FileText size={14} />{d.sertifikat}</div> : <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Belum ada</span>}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                {d.sertifikat && (<button className="btn-icon" onClick={() => setPreviewFile(d)} title="Lihat" style={{ color: 'var(--accent-blue)' }}><Eye size={16} /></button>)}
                                                {canVerify && d.status === 'Menunggu Verifikasi' && (<><button className="btn-icon" onClick={() => handleVerify(d.id)} title="Verifikasi" style={{ color: 'var(--accent-green)' }}><CheckCircle size={16} /></button><button className="btn-icon" onClick={() => openRejectModal(d)} title="Tolak" style={{ color: 'var(--accent-red)' }}><XCircle size={16} /></button></>)}
                                                {canVerify && d.status === 'Diverifikasi' && (<button className="btn-icon" onClick={() => openUnverifyModal(d)} title="Unverifikasi" style={{ color: 'var(--accent-orange)' }}><ShieldOff size={16} /></button>)}
                                                {(isAdmin || (isSekolah && d.status !== 'Diverifikasi')) ? (<><button className="btn-icon" onClick={() => handleOpenModal(d)} title="Edit"><Edit size={16} /></button><button className="btn-icon" onClick={() => setDeleteTarget(d)} title="Hapus" style={{ color: 'var(--accent-red)' }}><Trash2 size={16} /></button></>) : (!canVerify && <span style={{ width: 50 }}></span>)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination()}
                </div>
            )}

            {/* ===== TAB 2: ATUR POIN (Hanya Admin) ===== */}
            {activeTab === 'poin' && isAdmin && (
                <div className="table-container">
                    <div className="table-toolbar">
                        <div className="table-toolbar-left">
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Atur Bobot Poin</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                    <option value="10">10</option><option value="15">15</option><option value="50">50</option><option value="100">100</option>
                                </select>
                            </div>
                        </div>
                        <div className="table-toolbar-right"><button className="btn btn-primary btn-sm" onClick={() => openPointModal()}><Plus size={14} /> Tambah Aturan</button></div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead><tr>
                                <th style={{ width: 50, fontSize: '0.8rem' }}>No</th>
                                <th style={{ fontSize: '0.8rem' }}>Tingkat</th>
                                <th style={{ fontSize: '0.8rem' }}>Kategori</th>
                                <th style={{ fontSize: '0.8rem' }}>Capaian</th>
                                <th style={{ width: 100, fontSize: '0.8rem' }}>Poin</th>
                                <th style={{ width: 100, fontSize: '0.8rem' }}>Aksi</th>
                            </tr></thead>
                            <tbody>
                                {pagedData.map((p, i) => (
                                    <tr key={p.id}>
                                        <td style={{ fontSize: '0.85rem' }}>{(currentPage - 1) * pageSize + i + 1}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{p.tingkat}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{p.kategori}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{p.capaian}</td>
                                        <td style={{ fontWeight: 700, color: 'var(--accent-blue)', fontSize: '0.9rem' }}>{p.poin}</td>
                                        <td>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                <button className="btn-icon" onClick={() => openPointModal(p)} title="Edit Aturan"><Edit size={16} /></button>
                                                <button className="btn-icon" onClick={() => setDeletePointTarget(p)} style={{ color: 'var(--accent-red)' }} title="Hapus Aturan"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination()}
                </div>
            )}

            {/* ===== TAB 3: REKAPITULASI (Admin & Korwil) ===== */}
            {activeTab === 'rekap' && (isAdmin || isKorwil) && (
                <div className="table-container">
                    <div className="table-toolbar">
                        <div className="table-toolbar-left">
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Rekapitulasi Poin {isKorwil ? `Wilayah ${user?.kecamatan}` : ''}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                    <option value="10">10</option><option value="15">15</option><option value="50">50</option><option value="100">100</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead><tr><th style={{ fontSize: '0.8rem' }}>Peringkat</th><th style={{ fontSize: '0.8rem' }}>Sekolah</th><th style={{ fontSize: '0.8rem' }}>Prestasi</th><th style={{ fontSize: '0.8rem' }}>Total Poin</th></tr></thead>
                            <tbody>
                                {pagedData.map((r, i) => (
                                    <tr key={r.npsn}>
                                        <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>{(currentPage - 1) * pageSize + i + 1}</td>
                                        <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{r.namaSekolah}</td>
                                        <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>{r.jumlahPrestasi}</td>
                                        <td style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: '0.9rem' }}>{r.totalPoin}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination()}
                </div>
            )}

            {/* ===== MODALS ===== */}
            {/* Modal Prestasi */}
            {showModal && (
                <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><div className="modal-title" style={{ fontSize: '1.125rem' }}>{editItem ? 'Edit' : 'Ajukan'} Prestasi</div><button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.875rem' }}>Sekolah *</label>
                                {isSekolah ? (
                                    // Jika Sekolah, tampilkan nama sekolah (disabled)
                                    <input className="form-input" value={user?.namaAkun} disabled style={{ background: 'var(--bg-secondary)' }} />
                                ) : (
                                    // Jika Admin, bisa pilih sekolah
                                    <SearchableSelect options={schoolNames} value={formSekolah} onChange={setFormSekolah} placeholder="-- Pilih --" renderOption={renderSchoolOption} />
                                )}
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label" style={{ fontSize: '0.875rem' }}>Jenis Prestasi</label><input className="form-input" value={formData.jenisPrestasi} onChange={e => setFormData({ ...formData, jenisPrestasi: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label" style={{ fontSize: '0.875rem' }}>Siswa/Tim</label><input className="form-input" value={formData.siswa} onChange={e => setFormData({ ...formData, siswa: e.target.value })} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label" style={{ fontSize: '0.875rem' }}>Tingkat</label><select className="form-select" value={formData.tingkat} onChange={e => setFormData({ ...formData, tingkat: e.target.value })}>{TINGKAT_LOMBA.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                <div className="form-group"><label className="form-label" style={{ fontSize: '0.875rem' }}>Capaian</label><select className="form-select" value={formData.keterangan} onChange={e => setFormData({ ...formData, keterangan: e.target.value })}>{CAPAIAN_PRESTASI.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.875rem' }}>Sertifikat (PDF) {isSekolah && '*'}</label>
                                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}><Upload size={14} style={{ marginRight: 4 }} /> {editItem?.sertifikat ? 'Ganti' : 'Pilih'}<input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) { setFormSertifikat(e.target.files[0]); toast.success('File siap'); } }} /></label>
                                {formSertifikat && <span style={{ fontSize: 12, marginLeft: 8 }}>{formSertifikat.name}</span>}
                                {editItem?.sertifikat && !formSertifikat && <span style={{ fontSize: 12, marginLeft: 8, color: 'var(--text-secondary)' }}>{editItem.sertifikat}</span>}
                            </div>
                        </div>
                        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button><button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Simpan</button></div>
                    </div>
                </div>
            )}

            {/* Modal Status (Tolak/Unverify) */}
            {statusModal.isOpen && (<div className="modal-overlay" onClick={() => setStatusModal({ isOpen: false, type: '', data: null })}><div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}><div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}><div style={{ width: 64, height: 64, borderRadius: '50%', background: statusModal.type === 'reject' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(249, 115, 22, 0.1)', color: statusModal.type === 'reject' ? 'var(--accent-red)' : 'var(--accent-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{statusModal.type === 'reject' ? <XCircle size={32} /> : <ShieldOff size={32} />}</div><h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8 }}>{statusModal.type === 'reject' ? 'Tolak Data Prestasi?' : 'Batalkan Verifikasi?'}</h3><p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 20 }}>{statusModal.type === 'reject' ? `Data prestasi atas nama "${statusModal.data?.siswa}" akan ditolak.` : `Verifikasi akan dibatalkan.`}</p>{statusModal.type === 'reject' && (<div style={{ textAlign: 'left', marginBottom: 24 }}><label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, display: 'block' }}>Alasan Penolakan <span style={{ color: 'var(--accent-red)' }}>*</span></label><textarea className="form-input" rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Tulis alasan..." style={{ fontSize: '0.875rem' }} /></div>)}<div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}><button className="btn btn-ghost" onClick={() => setStatusModal({ isOpen: false, type: '', data: null })} style={{ minWidth: 100 }}>Batal</button><button className="btn btn-primary" onClick={executeStatusAction} style={{ minWidth: 120, background: statusModal.type === 'reject' ? 'var(--accent-red)' : 'var(--accent-orange)', borderColor: statusModal.type === 'reject' ? 'var(--accent-red)' : 'var(--accent-orange)' }}>{statusModal.type === 'reject' ? 'Ya, Tolak' : 'Ya, Batalkan'}</button></div></div></div></div>)}

            {/* Modal Hapus Prestasi */}
            {deleteTarget && (<div className="modal-overlay" onClick={() => setDeleteTarget(null)}><div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}><div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}><div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><AlertTriangle size={32} /></div><h3 style={{ fontSize: '1.125rem' }}>Hapus Data Prestasi?</h3><p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 24 }}>Data atas nama <strong>"{deleteTarget.siswa}"</strong> akan dihapus permanen.</p><div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}><button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Batal</button><button className="btn btn-primary" onClick={executeDelete} style={{ background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}>Hapus</button></div></div></div></div>)}

            {/* Modal Hapus Poin */}
            {deletePointTarget && (<div className="modal-overlay" onClick={() => setDeletePointTarget(null)}><div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}><div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}><div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}><Trash2 size={28} strokeWidth={1.5} /></div><h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8 }}>Hapus Aturan Poin?</h3><p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>Aturan untuk <strong>"{deletePointTarget.capaian}"</strong> ({deletePointTarget.tingkat}) akan dihapus.</p><div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}><button className="btn btn-ghost" onClick={() => setDeletePointTarget(null)} style={{ minWidth: 100 }}>Batal</button><button className="btn btn-primary" onClick={executeDeletePoint} style={{ minWidth: 100, background: '#dc2626', borderColor: '#dc2626' }}><Trash2 size={14} /> Ya, Hapus</button></div></div></div></div>)}

            {/* Modal Poin */}
            {showPointModal && (<div className="modal-overlay" onClick={() => setShowPointModal(false)}><div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}><div className="modal-header"><div className="modal-title" style={{ fontSize: '1.125rem' }}>{editPoint ? 'Edit Aturan' : 'Tambah Aturan'}</div><button className="modal-close" onClick={() => setShowPointModal(false)}><X size={18} /></button></div><div className="modal-body"><div className="form-group"><label className="form-label" style={{ fontSize: '0.875rem' }}>Tingkat</label><select className="form-select" value={pointForm.tingkat} onChange={e => setPointForm({ ...pointForm, tingkat: e.target.value })}>{TINGKAT_LOMBA.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div className="form-group"><label className="form-label" style={{ fontSize: '0.875rem' }}>Kategori</label><select className="form-select" value={pointForm.kategori} onChange={e => setPointForm({ ...pointForm, kategori: e.target.value })}>{KATEGORI_PRESTASI.map(k => <option key={k} value={k}>{k}</option>)}</select></div><div className="form-group"><label className="form-label" style={{ fontSize: '0.875rem' }}>Capaian</label><select className="form-select" value={pointForm.capaian} onChange={e => setPointForm({ ...pointForm, capaian: e.target.value })}>{CAPAIAN_PRESTASI.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div className="form-group"><label className="form-label" style={{ fontSize: '0.875rem' }}>Poin</label><input className="form-input" type="number" value={pointForm.poin} onChange={e => setPointForm({ ...pointForm, poin: parseInt(e.target.value) })} /></div></div><div className="modal-footer"><button className="btn btn-ghost" onClick={() => setShowPointModal(false)}>Batal</button><button className="btn btn-primary" onClick={handleSavePoint}><Save size={14} /> Simpan</button></div></div></div>)}
        </div>
    );
};

export default Prestasi;