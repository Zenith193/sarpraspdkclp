import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Download, Plus, Edit, Trash2, X, Save, Columns, ChevronDown, AlertTriangle, FileText, FileSpreadsheet, FileDown, TrendingUp, Package, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import useMatrikStore, { isIndukan, naturalSort } from '../../store/matrikStore';
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
    const currentYear = new Date().getFullYear();
    const [filterTahun, setFilterTahun] = useState(String(currentYear));

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Column Visibility
    const [showColPicker, setShowColPicker] = useState(false);
    const colPickerRef = useRef(null);
    const [visibleCols, setVisibleCols] = useState([
        'no', 'namaPaket', 'penyerapan', 'nilaiKontrak', 'pencairan', 'status', 'aksi'
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
                const p = pencairanMap[m.id] || { pencairanPersen: 0, status: 'Belum Masuk', noRegister: '', noSp2d: '', tanggalSp2d: '' };
                return {
                    ...m,
                    pencairanPersen: p.pencairanPersen ?? 0,
                    status: p.status || 'Belum Masuk',
                    noRegister: p.noRegister || '',
                    noSp2d: p.noSp2d || '',
                    tanggalSp2d: p.tanggalSp2d || '',
                    cv: m.penyedia || '-',
                    subBidang: m.subBidang || '-',
                };
            })
            .sort((a, b) => naturalSort(String(a.noMatrik), String(b.noMatrik)));
    }, [matrikData, pencairanMap]);

    // ===== AVAILABLE YEARS =====
    const availableYears = useMemo(() => {
        const years = [...new Set(combinedData.map(d => d.tahunAnggaran).filter(Boolean))];
        if (!years.includes(currentYear)) years.push(currentYear);
        return years.sort((a, b) => b - a);
    }, [combinedData]);

    // ===== YEAR FILTER =====
    const yearFiltered = useMemo(() => {
        if (filterTahun === 'semua') return combinedData;
        return combinedData.filter(d => String(d.tahunAnggaran) === filterTahun);
    }, [combinedData, filterTahun]);

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
        { key: 'tanggalSp2d', label: 'Tanggal SP2D' },
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

    const [filterJenis, setFilterJenis] = useState('all');
    const [filterSumber, setFilterSumber] = useState('all');

    // ===== FILTERING (with jenis + sumber) =====
    const filteredCombined = useMemo(() => {
        return yearFiltered.filter(d => {
            if (filterJenis !== 'all' && d.jenisPengadaan !== filterJenis) return false;
            if (filterSumber !== 'all' && d.sumberDana !== filterSumber) return false;
            return true;
        });
    }, [yearFiltered, filterJenis, filterSumber]);

    // Recalculate global stats based on filtered data
    const globalStats = useMemo(() => {
        const totalKontrak = filteredCombined.reduce((sum, item) => sum + (item.nilaiKontrak || 0), 0);
        const totalPenyerapan = filteredCombined.reduce((sum, item) => sum + calculatePenyerapan(item), 0);
        const totalPaket = filteredCombined.length;
        const paketSelesai = filteredCombined.filter(d => ['Clear', 'SP2D'].includes(getEffectiveStatus(d))).length;
        const paketSisa = totalPaket - paketSelesai;
        const pctSerap = totalKontrak > 0 ? ((totalPenyerapan / totalKontrak) * 100) : 0;
        const jenisStats = {};
        filteredCombined.forEach(item => {
            const jenis = item.jenisPengadaan || 'Lainnya';
            if (!jenisStats[jenis]) jenisStats[jenis] = { total: 0, clear: 0 };
            jenisStats[jenis].total++;
            if (['Clear', 'SP2D'].includes(getEffectiveStatus(item))) jenisStats[jenis].clear++;
        });
        return { totalKontrak, totalPenyerapan, totalPaket, paketSisa, paketSelesai, pctSerap, jenisStats };
    }, [filteredCombined]);

    const recapStatusStats = useMemo(() => {
        const stats = {};
        STATUS_OPTIONS.forEach(s => stats[s] = 0);
        filteredCombined.forEach(item => {
            const status = getEffectiveStatus(item);
            if (stats.hasOwnProperty(status)) stats[status]++;
        });
        return stats;
    }, [filteredCombined]);

    // Unique sumber dana & jenis from data
    const sumberDanaList = useMemo(() => [...new Set(yearFiltered.map(d => d.sumberDana).filter(Boolean))], [yearFiltered]);
    const jenisPengadaanList = useMemo(() => [...new Set(yearFiltered.map(d => d.jenisPengadaan).filter(Boolean))], [yearFiltered]);

    // Penyerapan circle SVG helper
    const PenyerapanCircle = ({ pct }) => {
        const r = 38, c = 2 * Math.PI * r;
        const offset = c - (pct / 100) * c;
        return (
            <svg width="90" height="90" viewBox="0 0 90 90" style={{ display: 'block', margin: '0 auto 8px' }}>
                <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth="7" />
                <circle cx="45" cy="45" r={r} fill="none" stroke="url(#penyerapanGrad)" strokeWidth="7"
                    strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease', transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
                <defs><linearGradient id="penyerapanGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#10b981" />
                </linearGradient></defs>
                <text x="45" y="49" textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="700">{pct.toFixed(0)}%</text>
            </svg>
        );
    };

    // ===== SEARCH FILTERING =====
    const filtered = useMemo(() => {
        return filteredCombined.filter(d => {
            if (search) {
                const q = search.toLowerCase();
                return d.namaPaket?.toLowerCase().includes(q) ||
                    d.noRegister?.toLowerCase().includes(q) ||
                    d.cv?.toLowerCase().includes(q) ||
                    d.namaSekolah?.toLowerCase().includes(q);
            }
            return true;
        });
    }, [filteredCombined, search]);

    // ===== PAGINATION =====
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const pagedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    useEffect(() => { setCurrentPage(1); }, [search, pageSize, filterJenis, filterSumber, filterTahun]);

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
                tanggalSp2d: item.tanggalSp2d
            });
        } else {
            setEditItem(null);
            setFormData({
                pencairanPersen: 0, status: 'Belum Masuk', noRegister: '', noSp2d: '', tanggalSp2d: ''
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
            updatePencairan(deleteTarget.id, { pencairanPersen: 0, status: 'Belum Masuk', noRegister: '', noSp2d: '', tanggalSp2d: '' });
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
        const fileName = 'Data_Pencairan';
        try {
            if (format === 'excel') exportToExcel(exportData, exportCols, fileName);
            else if (format === 'csv') exportToCSV(exportData, exportCols, fileName);
            else if (format === 'pdf') exportToPDF(exportData, exportCols, fileName, 'Data Pencairan');
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
            {/* ===== PAGE HEADER ===== */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Pencairan</h1>
                    <p>Monitoring pencairan anggaran dari Matriks Kegiatan</p>
                </div>
            </div>

            {/* ===== FILTER CHIPS ===== */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Filter:</span>
                <button onClick={() => { setFilterJenis('all'); setFilterSumber('all'); }}
                    style={{
                        padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                        border: filterJenis === 'all' && filterSumber === 'all' ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                        background: filterJenis === 'all' && filterSumber === 'all' ? 'rgba(59,130,246,0.12)' : 'var(--bg-secondary)',
                        color: filterJenis === 'all' && filterSumber === 'all' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.2s'
                    }}>Semua</button>
                {jenisPengadaanList.map(j => (
                    <button key={j} onClick={() => setFilterJenis(filterJenis === j ? 'all' : j)}
                        style={{
                            padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                            border: filterJenis === j ? '2px solid var(--accent-purple)' : '1px solid var(--border-color)',
                            background: filterJenis === j ? 'rgba(168,85,247,0.12)' : 'var(--bg-secondary)',
                            color: filterJenis === j ? 'var(--accent-purple)' : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}>{j}</button>
                ))}
                <span style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
                {sumberDanaList.map(s => (
                    <button key={s} onClick={() => setFilterSumber(filterSumber === s ? 'all' : s)}
                        style={{
                            padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                            border: filterSumber === s ? '2px solid var(--accent-orange)' : '1px solid var(--border-color)',
                            background: filterSumber === s ? 'rgba(249,115,22,0.12)' : 'var(--bg-secondary)',
                            color: filterSumber === s ? 'var(--accent-orange)' : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}>{s}</button>
                ))}
            </div>

            {/* ===== FINANCIAL RECAP ===== */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className="stat-card" style={{ position: 'relative', overflow: 'hidden', padding: '20px 16px' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #3b82f6, #6366f1)' }} />
                    <div className="stat-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                        <Wallet size={14} style={{ marginRight: 6 }} /> Total Nilai Kontrak
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.15rem', marginTop: 4 }}>{formatCurrency(globalStats.totalKontrak)}</div>
                </div>
                <div className="stat-card" style={{ position: 'relative', overflow: 'hidden', padding: '20px 16px' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #22c55e, #10b981)' }} />
                    <PenyerapanCircle pct={globalStats.pctSerap} />
                    <div style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Penyerapan</div>
                    <div style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-green)', marginTop: 2 }}>{formatCurrency(globalStats.totalPenyerapan)}</div>
                </div>
                <div className="stat-card" style={{ position: 'relative', overflow: 'hidden', padding: '20px 16px' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #a855f7, #ec4899)' }} />
                    <div className="stat-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                        <Package size={14} style={{ marginRight: 6 }} /> Total Paket
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.8rem', marginTop: 4 }}>{globalStats.totalPaket}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.75rem' }}>
                        <span style={{ color: '#22c55e' }}>✓ {globalStats.paketSelesai} Clear</span>
                        <span style={{ color: 'var(--accent-red)' }}>✗ {globalStats.paketSisa} Sisa</span>
                    </div>
                </div>
                <div className="stat-card" style={{ position: 'relative', overflow: 'hidden', padding: '20px 16px' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
                    <div className="stat-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Progress Status</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                        {Object.entries(recapStatusStats).filter(([, c]) => c > 0).map(([status, count]) => {
                            const pct = globalStats.totalPaket > 0 ? (count / globalStats.totalPaket * 100) : 0;
                            const colorMap = { 'SP2D': '#16a34a', 'Clear': '#22c55e', 'Keuangan': '#6366f1', 'Masuk': '#3b82f6', 'Belum Masuk': '#ef4444', 'Revisi Admin 1': '#f59e0b', 'Revisi Admin 2': '#f59e0b' };
                            return (
                                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem' }}>
                                    <span style={{ width: 70, color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status}</span>
                                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(100,116,139,0.12)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: 3, background: colorMap[status] || '#64748b', width: `${pct}%`, transition: 'width 0.8s ease' }} />
                                    </div>
                                    <span style={{ fontWeight: 700, color: colorMap[status] || '#64748b', minWidth: 18, textAlign: 'right' }}>{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ===== JENIS PENGADAAN RECAP ===== */}
            {Object.keys(globalStats.jenisStats).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Object.keys(globalStats.jenisStats).length, 4)}, 1fr)`, gap: 12, marginBottom: 20 }}>
                    {Object.entries(globalStats.jenisStats).map(([jenis, stats]) => {
                        const pct = stats.total > 0 ? (stats.clear / stats.total * 100) : 0;
                        return (
                            <div key={jenis} className="stat-card" style={{ padding: '12px 16px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{jenis}</span>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: pct === 100 ? '#22c55e' : 'var(--text-primary)' }}>{pct.toFixed(0)}%</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: 'rgba(100,116,139,0.12)', overflow: 'hidden', marginBottom: 6 }}>
                                    <div style={{ height: '100%', borderRadius: 3, background: pct === 100 ? '#22c55e' : pct > 50 ? '#3b82f6' : '#f59e0b', width: `${pct}%`, transition: 'width 0.8s ease' }} />
                                </div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    <span style={{ color: '#22c55e' }}>{stats.clear}</span> <span style={{ color: 'var(--text-secondary)' }}>/ {stats.total} clear</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-toolbar-left">
                        <div className="table-search">
                            <Search size={16} className="search-icon" />
                            <input placeholder="Cari paket, sekolah, CV..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tahun:</span>
                            <select value={filterTahun} onChange={e => { setFilterTahun(e.target.value); setCurrentPage(1); }}
                                style={{ padding: '4px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                <option value="semua">Semua Tahun</option>
                                {availableYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
                            </select>
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
                                    <th key={col.key} style={{ whiteSpace: 'nowrap', textAlign: ['nilaiKontrak', 'penyerapan', 'pencairan'].includes(col.key) ? 'right' : 'left', fontSize: '0.85rem' }}>
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
                                                case 'tanggalSp2d':
                                                    return <td key={col.key} style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{d.tanggalSp2d || '-'}</td>;
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
                                                    return <td key={col.key} style={{ whiteSpace: col.key === 'namaPaket' ? 'normal' : 'nowrap', fontSize: '0.85rem', maxWidth: col.key === 'namaPaket' ? 320 : undefined, wordBreak: col.key === 'namaPaket' ? 'break-word' : undefined }}>{d[col.key] || '-'}</td>;
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
                                    <label className="form-label">Tanggal SP2D</label>
                                    <input className="form-input" type="date" value={formData.tanggalSp2d || ''} onChange={e => setFormData({ ...formData, tanggalSp2d: e.target.value })} />
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