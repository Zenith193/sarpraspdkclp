import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Download, Filter, Edit, Trash2, X, FileSpreadsheet, FileText, FileDown, ChevronDown, Save, AlertTriangle, Radio, Columns } from 'lucide-react';
import { useAktivitasData } from '../../data/dataProvider';
import { aktivitasApi } from '../../api/index';
import { formatDateTime, formatCurrency } from '../../utils/formatters';
import { JENIS_AKUN } from '../../utils/constants';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const PER_PAGE_OPTIONS = [10, 15, 50, 100];

const AktivitasPengguna = () => {
    const currentUser = useAuthStore((state) => state.user);

    // Cek role untuk menentukan hak akses
    const isAdmin = currentUser?.role?.toLowerCase() === 'admin';
    // Hanya Admin yang bisa melihat semua log
    const canViewAll = isAdmin;

    const { data: aktivitasRaw } = useAktivitasData(isAdmin ? {} : { myOnly: true });

    // State Data
    const [data, setData] = useState([]);

    // Filter & Search
    const [search, setSearch] = useState('');
    const [filterJenis, setFilterJenis] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(15);

    // Modals
    const [showEditModal, setShowEditModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [showExport, setShowExport] = useState(false);
    const exportRef = useRef(null);

    // ===== COLUMN VISIBILITY =====
    const ALL_COLUMNS = [
        { key: 'no', label: 'No', width: 40, alwaysVisible: true },
        ...(canViewAll ? [{ key: 'namaAkun', label: 'Nama Pengguna' }] : []),
        { key: 'jenisAkun', label: 'Jenis Akun' },
        { key: 'aktivitas', label: 'Aktivitas' },
        { key: 'keterangan', label: 'Keterangan Detail', minWidth: 400 },
        { key: 'waktu', label: 'Waktu', width: 160 },
        ...(isAdmin ? [{ key: 'aksi', label: 'Aksi', width: 90, alwaysVisible: true }] : []),
    ];
    // Aktivitas auto-hidden by default
    const defaultCols = ALL_COLUMNS.filter(c => c.key !== 'aktivitas').map(c => c.key);
    const [visibleCols, setVisibleCols] = useState(defaultCols);
    const [showColPicker, setShowColPicker] = useState(false);
    const colPickerRef = useRef(null);
    const toggleCol = (key) => {
        const col = ALL_COLUMNS.find(c => c.key === key);
        if (col?.alwaysVisible) return;
        setVisibleCols(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
    };
    const activeColumns = ALL_COLUMNS.filter(c => visibleCols.includes(c.key));

    useEffect(() => { if (aktivitasRaw?.length) setData(aktivitasRaw); }, [aktivitasRaw]);

    // Auto-refetch real data every 30 seconds for live updates
    useEffect(() => {
        if (!canViewAll) return;
        const interval = setInterval(() => {
            aktivitasApi.list({ limit: 50 }).then(res => {
                const items = res?.data || (Array.isArray(res) ? res : []);
                if (items.length) setData(items);
            }).catch(() => { });
        }, 30000);
        return () => clearInterval(interval);
    }, [canViewAll]);

    // Effects for closing dropdown
    useEffect(() => {
        const handler = (e) => {
            if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false);
            if (colPickerRef.current && !colPickerRef.current.contains(e.target)) setShowColPicker(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ===== FILTERING LOGIC (MODIFIED) =====
    const filtered = useMemo(() => {
        return data.filter(a => {
            // 1. Filter Hak Akses: Jika bukan Admin/Verifikator, hanya tampilkan log milik sendiri
            if (!canViewAll && a.namaAkun !== currentUser?.namaAkun) {
                return false;
            }

            // 2. Filter Search
            if (search) {
                const q = search.toLowerCase();
                if (!a.namaAkun.toLowerCase().includes(q) && !a.keterangan.toLowerCase().includes(q)) return false;
            }

            // 3. Filter Jenis Akun (Hanya relevan jika bisa melihat semua)
            if (filterJenis && a.jenisAkun !== filterJenis) return false;

            return true;
        });
    }, [data, search, filterJenis, currentUser, canViewAll]);

    const paged = filtered.slice((page - 1) * perPage, page * perPage);
    const totalPages = Math.ceil(filtered.length / perPage) || 1;

    const getPaginationRange = () => {
        const range = [];
        const maxShow = 5;
        let start = Math.max(1, page - Math.floor(maxShow / 2));
        let end = Math.min(totalPages, start + maxShow - 1);
        if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
        for (let i = start; i <= end; i++) range.push(i);
        return range;
    };

    // ===== HANDLERS =====
    const requestDelete = (item) => setDeleteTarget(item);

    const executeDelete = async () => {
        if (deleteTarget) {
            try {
                await aktivitasApi.delete(deleteTarget.id);
                setData(prev => prev.filter(d => d.id !== deleteTarget.id));
                toast.success('Log aktivitas dihapus');
            } catch (err) {
                toast.error(err?.message || 'Gagal menghapus');
            }
            setDeleteTarget(null);
        }
    };

    const handleOpenEdit = (item) => {
        setEditItem({ ...item });
        setShowEditModal(true);
    };

    const handleSaveEdit = () => {
        if (!editItem.keterangan) {
            toast.error('Keterangan tidak boleh kosong');
            return;
        }
        setData(prev => prev.map(d => d.id === editItem.id ? { ...editItem, waktu: new Date().toISOString() } : d));
        toast.success('Log berhasil diperbarui');
        setShowEditModal(false);
        setEditItem(null);
    };

    const handleExport = (format) => {
        const exportCols = [
            { header: 'No', accessor: (_, i) => i + 1 },
            { header: 'Nama Akun', key: 'namaAkun' },
            { header: 'Jenis Akun', key: 'jenisAkun' },
            { header: 'Aktivitas', key: 'aktivitas' },
            { header: 'Keterangan', key: 'keterangan' },
            { header: 'Waktu', accessor: (r) => formatDateTime(r.createdAt) },
        ];
        try {
            if (format === 'excel') exportToExcel(filtered, exportCols, 'Log_Aktivitas');
            else if (format === 'csv') exportToCSV(filtered, exportCols, 'Log_Aktivitas');
            else if (format === 'pdf') exportToPDF(filtered, exportCols, 'Log_Aktivitas', 'Log Aktivitas Pengguna');
            toast.success(`Berhasil ekspor ${format.toUpperCase()}`);
        } catch (err) {
            toast.error('Gagal mengekspor data');
        }
        setShowExport(false);
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Aktivitas Pengguna</h1>
                    <p>{canViewAll ? 'Log sistem realtime semua pengguna' : 'Riwayat aktivitas akun Anda'}</p>
                </div>
                <div className="page-header-right">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 'var(--radius-full)', border: '1px solid rgba(34, 197, 94, 0.2)', color: '#16a34a', fontSize: 12, fontWeight: 500 }}>
                        <Radio size={14} className="pulse-animation" /> Live
                    </div>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder={canViewAll ? "Cari nama akun atau keterangan..." : "Cari keterangan..."} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                        </div>

                        {/* Filter Jenis Akun hanya tampil jika bisa melihat semua */}
                        {canViewAll && (
                            <button className={`btn ${filterJenis ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setShowFilters(!showFilters)}>
                                <Filter size={14} /> Filter {filterJenis && <span style={{ background: '#fff', color: 'var(--accent-blue)', borderRadius: 'var(--radius-full)', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, marginLeft: 2 }}>1</span>}
                            </button>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                            Tampil
                            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }}>
                                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            data
                        </div>
                    </div>
                    <div className="table-toolbar-right" style={{ display: 'flex', gap: 8 }}>
                        <div style={{ position: 'relative' }} ref={colPickerRef}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowColPicker(!showColPicker)}>
                                <Columns size={14} /> Kolom
                            </button>
                            {showColPicker && (
                                <div className="dropdown-menu" style={{ minWidth: 200, right: 0, left: 'auto' }}>
                                    {ALL_COLUMNS.filter(c => !c.alwaysVisible).map(c => (
                                        <label key={c.key} className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 14px', fontSize: '0.82rem' }}>
                                            <input type="checkbox" checked={visibleCols.includes(c.key)} onChange={() => toggleCol(c.key)} style={{ accentColor: 'var(--accent-blue)' }} />
                                            {c.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="export-dropdown" ref={exportRef}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(!showExport)}>
                                <Download size={14} /> Ekspor <ChevronDown size={12} />
                            </button>
                            {showExport && (
                                <div className="dropdown-menu">
                                    <button className="dropdown-item" onClick={() => handleExport('excel')}>
                                        <span className="export-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}><FileSpreadsheet size={14} /></span>
                                        Excel (.xlsx)
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExport('csv')}>
                                        <span className="export-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}><FileDown size={14} /></span>
                                        CSV
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleExport('pdf')}>
                                        <span className="export-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}><FileText size={14} /></span>
                                        PDF
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filter Bar hanya tampil jika bisa melihat semua */}
                {showFilters && canViewAll && (
                    <div className="filter-bar" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, alignItems: 'center' }}>
                        <select value={filterJenis} onChange={e => { setFilterJenis(e.target.value); setPage(1); }} style={{ minWidth: 200 }}>
                            <option value="">Semua Jenis Akun</option>
                            {JENIS_AKUN.map(j => <option key={j} value={j}>{j}</option>)}
                        </select>
                        {filterJenis && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setFilterJenis('')}>Reset Filter</button>
                        )}
                    </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                {activeColumns.map(col => (
                                    <th key={col.key} style={{ width: col.width, minWidth: col.minWidth, textAlign: 'center', verticalAlign: 'middle' }}>{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paged.map((a, i) => (
                                <tr key={a.id}>
                                    {activeColumns.map(col => {
                                        switch (col.key) {
                                            case 'no': return <td key={col.key} style={{ textAlign: 'center' }}>{(page - 1) * perPage + i + 1}</td>;
                                            case 'namaAkun': return <td key={col.key} style={{ textAlign: 'left' }}><div style={{ fontWeight: 500 }}>{a.namaAkun}</div></td>;
                                            case 'jenisAkun': return <td key={col.key} style={{ textAlign: 'center' }}><span className="badge badge-disetujui">{a.jenisAkun}</span></td>;
                                            case 'aktivitas': return <td key={col.key} style={{ textAlign: 'center', fontWeight: 600, color: 'var(--accent-blue)' }}>{a.aktivitas}</td>;
                                            case 'keterangan': return <td key={col.key} style={{ maxWidth: 600, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.8125rem', color: 'var(--text-primary)', textAlign: 'left' }}><span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>[{a.aktivitas}]</span> {a.keterangan}</td>;
                                            case 'waktu': return <td key={col.key} style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', textAlign: 'center' }}>{formatDateTime(a.createdAt)}</td>;
                                            case 'aksi': return <td key={col.key} style={{ textAlign: 'center' }}><div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}><button className="btn-icon" onClick={() => handleOpenEdit(a)} title="Edit"><Edit size={16} /></button><button className="btn-icon" onClick={() => requestDelete(a)} title="Hapus" style={{ color: 'var(--accent-red)' }}><Trash2 size={16} /></button></div></td>;
                                            default: return <td key={col.key}>-</td>;
                                        }
                                    })}
                                </tr>
                            ))}
                            {paged.length === 0 && (
                                <tr><td colSpan={activeColumns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Tidak ada data ditemukan</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="table-pagination">
                    <div className="table-pagination-info">Menampilkan {filtered.length > 0 ? (page - 1) * perPage + 1 : 0}-{Math.min(page * perPage, filtered.length)} dari {filtered.length} data</div>
                    <div className="table-pagination-controls">
                        <button onClick={() => setPage(1)} disabled={page === 1}>«</button>
                        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>‹</button>
                        {getPaginationRange().map(p => (
                            <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
                        ))}
                        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>›</button>
                        <button onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
                    </div>
                </div>
            </div>

            {/* ===== EDIT MODAL ===== */}
            {showEditModal && editItem && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" style={{ maxWidth: 550 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Edit Log Aktivitas</div>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nama Akun</label>
                                <input className="form-input" value={editItem.namaAkun} disabled style={{ background: 'var(--bg-secondary)' }} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Jenis Akun</label>
                                    <select className="form-select" value={editItem.jenisAkun} onChange={e => setEditItem({ ...editItem, jenisAkun: e.target.value })}>
                                        {JENIS_AKUN.map(j => <option key={j} value={j}>{j}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Jenis Aktivitas</label>
                                    <input className="form-input" value={editItem.aktivitas} onChange={e => setEditItem({ ...editItem, aktivitas: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Keterangan Detail</label>
                                <textarea className="form-input" rows={4} value={editItem.keterangan} onChange={e => setEditItem({ ...editItem, keterangan: e.target.value })}></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSaveEdit}>
                                <Save size={14} /> Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DELETE MODAL ===== */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <AlertTriangle size={32} strokeWidth={1.5} />
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                                Hapus Log Aktivitas?
                            </h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
                                Log aktivitas <strong>"{deleteTarget.namaAkun}"</strong> akan dihapus permanen.
                            </p>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} style={{ minWidth: 100 }}>Batal</button>
                                <button className="btn btn-primary" onClick={executeDelete} style={{ minWidth: 100, background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}>
                                    <Trash2 size={14} /> Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AktivitasPengguna;