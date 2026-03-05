import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Download, Plus, Edit, Trash2, X, Save, Columns, ChevronDown, AlertTriangle, FileText, FileSpreadsheet, FileDown, TrendingUp, Package, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import useMatrikStore, { isIndukan } from '../../store/matrikStore';
import toast from 'react-hot-toast';

// --- CONSTANTS ---
const STATUS_OPTIONS = ['Belum Masuk', 'Masuk', 'Revisi Admin 1', 'Revisi Admin 2', 'Keuangan', 'Clear', 'SP2D'];
const PENCAIRAN_OPTIONS = [0, 30, 70, 100];

const DROPDOWN_STYLE = {
    backgroundColor: '#ffffff',
    color: '#111827',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    padding: '0.25rem 0.5rem',
    outline: 'none',
    cursor: 'pointer'
};

const Pencairan = () => {
    // ===== SHARED STORE =====
    const { matrikData, pencairanMap, updatePencairan } = useMatrikStore();

    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Column Visibility
    const [showColPicker, setShowColPicker] = useState(false);
    const colPickerRef = useRef(null);
    const [visibleCols, setVisibleCols] = useState([
        'no', 'namaPaket', 'penyerapan', 'nilaiKontrak', 'pencairan', 'status', 'noRegister', 'noSp2d', 'aksi'
    ]);

    const [showExport, setShowExport] = useState(false);
    const exportRef = useRef(null);
    const [formData, setFormData] = useState({});

    useEffect(() => {
        const handler = (e) => {
            if (colPickerRef.current && !colPickerRef.current.contains(e.target)) setShowColPicker(false);
            if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ===== COMBINE matrikData + pencairanMap (INDUKAN ONLY) =====
    const combinedData = useMemo(() => {
        return matrikData
            .filter(m => isIndukan(m.noMatrik))
            .map(m => {
                const p = pencairanMap[m.id] || { pencairanPersen: 0, status: 'Belum Masuk', noRegister: '', noSp2d: '', hariKalender: 0 };
                return {
                    ...m,
                    pencairanPersen: p.pencairanPersen ?? 0,
                    status: p.status || 'Belum Masuk',
                    noRegister: p.noRegister || '',
                    noSp2d: p.noSp2d || '',
                    hariKalender: p.hariKalender || 0,
                    cv: m.penyedia || '-',
                    subBidang: m.subBidang || '-',
                };
            });
    }, [matrikData, pencairanMap]);

    // ===== COLUMN DEFINITIONS =====
    const ALL_COLUMNS = [
        { key: 'no', label: 'No', alwaysVisible: true },
        { key: 'namaPaket', label: 'Nama Paket', alwaysVisible: true },
        { key: 'metode', label: 'Metode Pemilihan' },
        { key: 'jenisPengadaan', label: 'Jenis Pengadaan' },
        { key: 'penyerapan', label: 'Penyerapan (Rp)' },
        { key: 'nilaiKontrak', label: 'Nilai Kontrak' },
        { key: 'pencairan', label: 'Pencairan (%)', editable: true },
        { key: 'cv', label: 'CV' },
        { key: 'subBidang', label: 'Sub Bidang' },
        { key: 'sumberDana', label: 'Sumber Dana' },
        { key: 'hariKalender', label: 'Hari Kalender' },
        { key: 'status', label: 'Status', editable: true },
        { key: 'noRegister', label: 'No Register' },
        { key: 'noSp2d', label: 'No SP2D' },
        { key: 'aksi', label: 'Aksi', alwaysVisible: true },
    ];

    // ===== HELPER FUNCTIONS =====
    const getEffectiveStatus = (item) => {
        if (item.noRegister && item.noSp2d) return 'SP2D';
        return item.status || 'Belum Masuk';
    };

    const calculatePenyerapan = (item) => {
        return (item.nilaiKontrak || 0) * ((item.pencairanPersen || 0) / 100);
    };

    // ===== RECAPITULATION =====
    const globalStats = useMemo(() => {
        const totalKontrak = combinedData.reduce((sum, item) => sum + (item.nilaiKontrak || 0), 0);
        const totalPenyerapan = combinedData.reduce((sum, item) => sum + calculatePenyerapan(item), 0);
        const totalPaket = combinedData.length;
        const paketSelesai = combinedData.filter(d => ['Clear', 'SP2D'].includes(getEffectiveStatus(d))).length;
        const paketSisa = totalPaket - paketSelesai;
        const jenisStats = {};
        combinedData.forEach(item => {
            const jenis = item.jenisPengadaan || 'Lainnya';
            if (!jenisStats[jenis]) jenisStats[jenis] = { total: 0, clear: 0 };
            jenisStats[jenis].total++;
            if (['Clear', 'SP2D'].includes(getEffectiveStatus(item))) jenisStats[jenis].clear++;
        });
        return { totalKontrak, totalPenyerapan, totalPaket, paketSisa, jenisStats };
    }, [combinedData]);

    const recapStatusStats = useMemo(() => {
        const stats = {};
        STATUS_OPTIONS.forEach(s => stats[s] = 0);
        combinedData.forEach(item => {
            const status = getEffectiveStatus(item);
            if (stats.hasOwnProperty(status)) stats[status]++;
        });
        return stats;
    }, [combinedData]);

    // ===== FILTERING =====
    const filtered = useMemo(() => {
        return combinedData.filter(d => {
            if (search) {
                const q = search.toLowerCase();
                return d.namaPaket?.toLowerCase().includes(q) ||
                    d.noRegister?.toLowerCase().includes(q) ||
                    d.cv?.toLowerCase().includes(q) ||
                    d.namaSekolah?.toLowerCase().includes(q);
            }
            return true;
        });
    }, [combinedData, search]);

    // ===== PAGINATION =====
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const pagedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    useEffect(() => { setCurrentPage(1); }, [search, pageSize]);

    // ===== HANDLERS =====
    const toggleCol = (key) => {
        const col = ALL_COLUMNS.find(c => c.key === key);
        if (col?.alwaysVisible) return;
        setVisibleCols(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
    };

    const handleInlineChange = (id, key, value) => {
        if (key === 'pencairanPersen') {
            updatePencairan(id, { pencairanPersen: value });
        } else if (key === 'status') {
            updatePencairan(id, { status: value });
        }
        toast.success('Data diperbarui');
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditItem(item);
            setFormData({
                pencairanPersen: item.pencairanPersen,
                status: item.status,
                noRegister: item.noRegister,
                noSp2d: item.noSp2d,
                hariKalender: item.hariKalender
            });
        } else {
            setEditItem(null);
            setFormData({
                pencairanPersen: 0, status: 'Belum Masuk', noRegister: '', noSp2d: '', hariKalender: 0
            });
        }
        setShowModal(true);
    };

    const handleSave = () => {
        if (editItem) {
            updatePencairan(editItem.id, formData);
            toast.success('Data berhasil diperbarui');
        }
        setShowModal(false);
    };

    const executeDelete = () => {
        if (deleteTarget) {
            // Reset pencairan data for this matrik
            updatePencairan(deleteTarget.id, { pencairanPersen: 0, status: 'Belum Masuk', noRegister: '', noSp2d: '', hariKalender: 0 });
            toast.success('Data pencairan direset');
            setDeleteTarget(null);
        }
    };

    const handleExport = (format) => {
        const exportData = filtered.map(item => ({
            ...item,
            penyerapan: calculatePenyerapan(item),
            status: getEffectiveStatus(item)
        }));
        const exportCols = ALL_COLUMNS.filter(c => c.key !== 'aksi').map(c => ({ header: c.label, key: c.key }));
        try {
            if (format === 'excel') exportToExcel(exportData, exportCols, 'pencairan');
            else if (format === 'csv') exportToCSV(exportData, exportCols, 'pencairan');
            else if (format === 'pdf') exportToPDF(exportData, exportCols, 'pencairan', 'Data Pencairan');
            toast.success(`Berhasil ekspor ${format.toUpperCase()}`);
        } catch (err) { toast.error('Gagal ekspor'); }
        setShowExport(false);
    };

    // ===== RENDER HELPERS =====
    const getStatusBadge = (status) => {
        const map = {
            'Belum Masuk': { bg: '#fee2e2', color: '#dc2626' },
            'Masuk': { bg: '#dbeafe', color: '#2563eb' },
            'Revisi Admin 1': { bg: '#fef3c7', color: '#d97706' },
            'Revisi Admin 2': { bg: '#fef3c7', color: '#d97706' },
            'Keuangan': { bg: '#e0e7ff', color: '#4f46e5' },
            'Clear': { bg: '#d1fae5', color: '#059669' },
            'SP2D': { bg: '#dcfce7', color: '#16a34a', border: '2px solid #16a34a' }
        };
        const style = map[status] || { bg: '#f3f4f6', color: '#374151' };
        return (
            <span style={{
                background: style.bg, color: style.color, border: style.border || 'none',
                padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)',
                fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block'
            }}>
                {status}
            </span>
        );
    };

    const activeColumns = ALL_COLUMNS.filter(c => visibleCols.includes(c.key));

    return (
        <div>
            {/* ===== FINANCIAL RECAP ===== */}
            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <Wallet size={14} style={{ marginRight: 4 }} /> Total Nilai Kontrak
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>{formatCurrency(globalStats.totalKontrak)}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <TrendingUp size={14} style={{ marginRight: 4 }} /> Total Penyerapan
                    </div>
                    <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: '1.25rem' }}>
                        {formatCurrency(globalStats.totalPenyerapan)}
                    </div>
                    <div className="stat-subtitle" style={{ fontSize: '0.75rem' }}>
                        {((globalStats.totalPenyerapan / globalStats.totalKontrak) * 100 || 0).toFixed(1)}% Terserap
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
                    <div className="stat-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        <Package size={14} style={{ marginRight: 4 }} /> Total Paket
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>{globalStats.totalPaket}</div>
                    <div className="stat-subtitle" style={{ fontSize: '0.75rem' }}>{globalStats.paketSisa} Paket Belum Clear</div>
                </div>
            </div>

            {/* ===== JENIS PENGADAAN RECAP ===== */}
            {Object.keys(globalStats.jenisStats).length > 0 && (
                <div className="stats-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: `repeat(${Object.keys(globalStats.jenisStats).length}, 1fr)` }}>
                    {Object.entries(globalStats.jenisStats).map(([jenis, stats]) => (
                        <div key={jenis} className="stat-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.625rem 1rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{jenis}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                                {stats.clear} clear / {stats.total} total
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ===== STATUS RECAP ===== */}
            <div className="stats-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
                {Object.entries(recapStatusStats).map(([status, count]) => (
                    <div key={status} className="stat-card" style={{ borderLeft: `3px solid ${status === 'SP2D' ? '#16a34a' : status === 'Belum Masuk' ? '#ef4444' : '#3b82f6'}`, padding: '0.625rem 0.75rem' }}>
                        <div className="stat-label" style={{ fontSize: '0.7rem', fontWeight: 500 }}>{status}</div>
                        <div className="stat-value" style={{ fontSize: '1rem' }}>{count}</div>
                    </div>
                ))}
            </div>

            {/* ===== PAGE HEADER ===== */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Pencairan</h1>
                    <p>Data pencairan anggaran dari Matriks Kegiatan</p>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari paket, sekolah, CV..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tampil:</span>
                            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                <option value="10">10</option><option value="15">15</option><option value="50">50</option><option value="100">100</option>
                            </select>
                        </div>
                        <div style={{ position: 'relative' }} ref={colPickerRef}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowColPicker(!showColPicker)}>
                                <Columns size={14} /> Kolom
                            </button>
                            {showColPicker && (
                                <div className="dropdown-menu" style={{ left: 0, minWidth: 220 }}>
                                    {ALL_COLUMNS.filter(c => !c.alwaysVisible).map(col => (
                                        <label key={col.key} className="dropdown-item" style={{ cursor: 'pointer', gap: 8, fontSize: '0.85rem' }}>
                                            <input type="checkbox" checked={visibleCols.includes(col.key)} onChange={() => toggleCol(col.key)} />
                                            {col.label}
                                        </label>
                                    ))}
                                </div>
                            )}
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
                                    <button className="dropdown-item" onClick={() => handleExport('csv')}>
                                        <span className="export-icon"><FileDown size={14} /></span> CSV
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExport('pdf')}>
                                        <span className="export-icon"><FileText size={14} /></span> PDF
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                {activeColumns.map(col => (
                                    <th key={col.key} style={{ whiteSpace: 'nowrap', textAlign: ['nilaiKontrak', 'penyerapan', 'pencairan', 'hariKalender'].includes(col.key) ? 'right' : 'left', fontSize: '0.85rem' }}>
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pagedData.map((d, i) => {
                                const effectiveStatus = getEffectiveStatus(d);
                                return (
                                    <tr key={d.id}>
                                        {activeColumns.map(col => {
                                            switch (col.key) {
                                                case 'no': return <td key={col.key} style={{ fontSize: '0.85rem' }}>{(currentPage - 1) * pageSize + i + 1}</td>;
                                                case 'penyerapan':
                                                    const val = calculatePenyerapan(d);
                                                    return <td key={col.key} style={{ textAlign: 'right', color: val > 0 ? 'var(--accent-green)' : 'inherit', whiteSpace: 'nowrap', fontWeight: 500, fontSize: '0.85rem' }}>{formatCurrency(val)}</td>;
                                                case 'nilaiKontrak':
                                                    return <td key={col.key} style={{ textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatCurrency(d.nilaiKontrak)}</td>;
                                                case 'pencairan':
                                                    return (
                                                        <td key={col.key} style={{ textAlign: 'right' }}>
                                                            <select value={d.pencairanPersen || 0}
                                                                onChange={(e) => handleInlineChange(d.id, 'pencairanPersen', parseInt(e.target.value))}
                                                                style={{ ...DROPDOWN_STYLE, width: 80, height: 30, fontSize: '0.8rem', textAlign: 'right', padding: '0 0.5rem' }}>
                                                                {PENCAIRAN_OPTIONS.map(opt => (
                                                                    <option key={opt} value={opt} style={{ color: '#111827', background: '#fff' }}>{opt}%</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                    );
                                                case 'hariKalender':
                                                    return <td key={col.key} style={{ textAlign: 'right', fontSize: '0.85rem' }}>{d.hariKalender || 0}</td>;
                                                case 'status':
                                                    if (effectiveStatus === 'SP2D') {
                                                        return <td key={col.key}>{getStatusBadge(effectiveStatus)}</td>;
                                                    }
                                                    return (
                                                        <td key={col.key}>
                                                            <select value={d.status || 'Belum Masuk'}
                                                                onChange={(e) => handleInlineChange(d.id, 'status', e.target.value)}
                                                                style={{ ...DROPDOWN_STYLE, fontSize: '0.75rem', height: 28, minWidth: 120 }}>
                                                                {STATUS_OPTIONS.filter(s => s !== 'SP2D').map(s => (
                                                                    <option key={s} value={s} style={{ color: '#111827', background: '#fff' }}>{s}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                    );
                                                case 'aksi':
                                                    return (
                                                        <td key={col.key}>
                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                <button className="btn-icon" onClick={() => handleOpenModal(d)} title="Edit Detail"><Edit size={16} /></button>
                                                                <button className="btn-icon" onClick={() => setDeleteTarget(d)} title="Reset" style={{ color: 'var(--accent-red)' }}><Trash2 size={16} /></button>
                                                            </div>
                                                        </td>
                                                    );
                                                default:
                                                    return <td key={col.key} style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{d[col.key] || '-'}</td>;
                                            }
                                        })}
                                    </tr>
                                );
                            })}
                            {pagedData.length === 0 && (
                                <tr><td colSpan={activeColumns.length} style={{ textAlign: 'center', padding: 40, fontSize: '0.9rem' }}>Tidak ada data. Tambahkan paket di Matriks Kegiatan.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

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

            {/* ===== MODAL EDIT PENCAIRAN ===== */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Edit Detail Pencairan</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            {editItem && (
                                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                                    <strong>{editItem.namaPaket}</strong> — {editItem.namaSekolah}
                                    <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Nilai Kontrak: {formatCurrency(editItem.nilaiKontrak)}</div>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                                <div className="form-group">
                                    <label className="form-label">Pencairan (%)</label>
                                    <select className="form-select" value={formData.pencairanPersen || 0} onChange={e => setFormData({ ...formData, pencairanPersen: parseInt(e.target.value) })}>
                                        {PENCAIRAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}%</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-select" value={formData.status || ''} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">No Register</label>
                                    <input className="form-input" value={formData.noRegister || ''} onChange={e => setFormData({ ...formData, noRegister: e.target.value })} placeholder="Otomatis jadi SP2D jika terisi" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">No SP2D</label>
                                    <input className="form-input" value={formData.noSp2d || ''} onChange={e => setFormData({ ...formData, noSp2d: e.target.value })} placeholder="Otomatis jadi SP2D jika terisi" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hari Kalender</label>
                                    <input className="form-input" type="number" value={formData.hariKalender || ''} onChange={e => setFormData({ ...formData, hariKalender: parseInt(e.target.value) || 0 })} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DELETE/RESET MODAL ===== */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <AlertTriangle size={32} strokeWidth={1.5} />
                            </div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 8 }}>Reset Data Pencairan?</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
                                Data pencairan untuk <strong>"{deleteTarget.namaPaket}"</strong> akan direset ke awal.
                            </p>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} style={{ minWidth: 100 }}>Batal</button>
                                <button className="btn btn-primary" onClick={executeDelete} style={{ minWidth: 100, background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}>
                                    <Trash2 size={14} /> Reset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Pencairan;